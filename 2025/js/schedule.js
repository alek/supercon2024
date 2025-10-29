(function () {
    const PROGRAM_MANIFEST_PATH = 'js/program-manifest.js';
    const SCHEDULE_MANIFEST_PATH = 'js/schedule-manifest.js';
    const FALLBACK_TIMEZONE = 'America/Los_Angeles';
    const FALLBACK_DURATION_MINUTES = 60;
    const DEFAULT_TIME_FORMAT = '12h';

    const CATEGORY_INFO = {
        talks: { dataType: 'talk' },
        talk: { dataType: 'talk' },
        workshops: { dataType: 'workshop' },
        workshop: { dataType: 'workshop' },
        panels: { dataType: 'panel' },
        panel: { dataType: 'panel' },
        lunch: { dataType: 'logistics' },
        dinner: { dataType: 'logistics' },
        party: { dataType: 'social' },
        social: { dataType: 'social' },
        other: { dataType: 'logistics' }
    };

    const AUTO_INCLUDE_SESSION_CATEGORIES = new Set(['lunch', 'dinner', 'party', 'other']);

    let scheduleCache = null;
    let scheduleRoot = null;
    let activeScheduleFormat = DEFAULT_TIME_FORMAT;

    const TIMEZONE_DEFINITION = [
        'BEGIN:VTIMEZONE',
        'TZID:America/Los_Angeles',
        'X-LIC-LOCATION:America/Los_Angeles',
        'BEGIN:DAYLIGHT',
        'TZOFFSETFROM:-0800',
        'TZOFFSETTO:-0700',
        'TZNAME:PDT',
        'DTSTART:19700308T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
        'END:DAYLIGHT',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:-0700',
        'TZOFFSETTO:-0800',
        'TZNAME:PST',
        'DTSTART:19701101T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
        'END:STANDARD',
        'END:VTIMEZONE'
    ];

    const TIMEZONE_ALIASES = {
    'america/los angeles': 'America/Los_Angeles',
    'america los angeles': 'America/Los_Angeles',
    'los angeles': 'America/Los_Angeles',
    'pasadena': 'America/Los_Angeles',
        'pacific standard time': 'America/Los_Angeles',
        'pacific daylight time': 'America/Los_Angeles',
        'pacific time': 'America/Los_Angeles',
        'pst': 'America/Los_Angeles',
        'pdt': 'America/Los_Angeles'
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSchedule);
    } else {
        initSchedule();
    }

    function initSchedule() {
        const root = document.querySelector('[data-schedule-root]');
        if (!root) {
            return;
        }

        scheduleRoot = root;

        loadScheduleData()
            .then((schedule) => {
                scheduleCache = schedule;
                activeScheduleFormat = normaliseTimeFormat(schedule?.timeFormat || DEFAULT_TIME_FORMAT);

                scheduleCache = { ...scheduleCache, timeFormat: activeScheduleFormat };
                renderSchedule(root, scheduleCache);
            })
            .catch((error) => {
                console.error('Failed to load schedule data', error);
                root.setAttribute('data-schedule-error', 'true');
            });
    }

    function loadScheduleData() {
        return Promise.all([fetchScheduleManifest(), fetchProgramManifest()])
            .then(([scheduleManifest, programManifest]) => mergeScheduleData(scheduleManifest, programManifest));
    }

    function fetchScheduleManifest() {
        return fetch(SCHEDULE_MANIFEST_PATH, { cache: 'no-cache' })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.text();
            })
            .then((text) => {
                const match = text.match(/window\.SCHEDULE_MANIFEST\s*=\s*({[\s\S]*?});/i);
                if (!match) {
                    throw new Error('Schedule manifest payload missing.');
                }
                const payload = JSON.parse(match[1]);
                if (!payload || typeof payload !== 'object') {
                    throw new Error('Schedule manifest payload malformed.');
                }
                return payload;
            })
            .catch((error) => {
                console.warn('Schedule manifest unavailable, using defaults.', error);
                return {};
            });
    }

    function fetchProgramManifest() {
        const versions = window.S9_VERSIONS || {};
        const versionToken = versions.PROGRAM_MANIFEST_VERSION || versions.SCRIPT_VERSION || versions.APP_VERSION || Date.now();
        const url = `${PROGRAM_MANIFEST_PATH}?v=${versionToken}`;
        return fetch(url, { cache: 'no-cache' })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.text();
            })
            .then((text) => {
                const match = text.match(/window\.PROGRAM_MANIFEST\s*=\s*({[\s\S]*?});/i);
                if (!match) {
                    throw new Error('Program manifest payload missing.');
                }
                const payload = JSON.parse(match[1]);
                if (!payload || typeof payload !== 'object') {
                    throw new Error('Program manifest payload malformed.');
                }
                return payload;
            })
            .catch((error) => {
                console.warn('Program manifest unavailable, schedule rendering limited.', error);
                return {};
            });
    }

    function mergeScheduleData(scheduleManifest, programManifest) {
        const manifest = scheduleManifest || {};
        const timezone = normaliseTimezone(manifest.timezone || FALLBACK_TIMEZONE);
        const defaultDurationMinutes = toPositiveInteger(manifest.defaultDurationMinutes)
            || FALLBACK_DURATION_MINUTES;
        const timeFormat = normaliseTimeFormat(manifest.timeFormat || DEFAULT_TIME_FORMAT);

        const programMetadata = programManifest && programManifest.metadata ? programManifest.metadata : {};
        const venues = normaliseVenues(manifest.venues, programMetadata.venues);
        const days = normaliseDays(manifest.days, programMetadata.days);
        const sessionsById = buildSessionIndex(programManifest);

        const derivedEntries = buildEntriesFromSessions(programManifest, days, venues);

        const sourceEntries = Array.isArray(manifest.entries) && manifest.entries.length
            ? mergeScheduleEntries(manifest.entries, derivedEntries)
            : derivedEntries;

        const entries = normaliseEntries(sourceEntries, days, venues, sessionsById, {
            timezone,
            defaultDurationMinutes
        });

        const eventStartDate = manifest.eventStartDate || (days[0]?.date ?? '');
        const eventEndDate = manifest.eventEndDate || (days[days.length - 1]?.date ?? eventStartDate);

        return {
            timezone,
            defaultDurationMinutes,
            venues,
            days,
            entries,
            location: manifest.location || '',
            eventStartDate,
            eventEndDate,
            lastUpdated: manifest.lastUpdated || '',
            version: manifest.version || '',
            timeFormat
        };
    }

    function mergeScheduleEntries(primaryEntries, derivedEntries) {
        if (!Array.isArray(primaryEntries) || !primaryEntries.length) {
            return Array.isArray(derivedEntries) ? derivedEntries : [];
        }
        if (!Array.isArray(derivedEntries) || !derivedEntries.length) {
            return primaryEntries.slice();
        }

        const merged = primaryEntries.slice();
        const seenKeys = new Set();

        const remember = (entry) => {
            const key = buildEntryKey(entry);
            if (key) {
                seenKeys.add(key);
            }
        };

        merged.forEach(remember);

        derivedEntries.forEach((entry) => {
            if (!entry) {
                return;
            }
            const category = safeLower(entry.category);
            if (!AUTO_INCLUDE_SESSION_CATEGORIES.has(category)) {
                return;
            }
            const key = buildEntryKey(entry);
            if (key && seenKeys.has(key)) {
                return;
            }
            merged.push(entry);
            if (key) {
                seenKeys.add(key);
            }
        });

        return merged;
    }

    function buildEntryKey(entry) {
        if (!entry || typeof entry !== 'object') {
            return '';
        }
        if (entry.sessionId) {
            return `session:${String(entry.sessionId)}`;
        }
        const day = safeLower(entry.dayId || entry.day);
        const start = normaliseTimeValue(entry.startTime || entry.time);
        const venue = safeLower(entry.venueId || entry.venue);
        if (!day || !start || !venue) {
            return '';
        }
        return `slot:${day}|${start}|${venue}`;
    }

    function buildSessionIndex(programManifest) {
        const index = new Map();
        if (!programManifest || !Array.isArray(programManifest.sessions)) {
            return index;
        }
        programManifest.sessions.forEach((session) => {
            if (session && session.id) {
                index.set(session.id, session);
            }
        });
        return index;
    }

    function buildEntriesFromSessions(programManifest, days, venues) {
        if (!programManifest || !Array.isArray(programManifest.sessions) || !days.length || !venues.length) {
            return [];
        }

        const dayIdByDate = new Map();
        days.forEach((day) => {
            if (day && day.date) {
                dayIdByDate.set(day.date, day.id);
            }
        });

        const venueLookup = new Map();
        venues.forEach((venue) => {
            if (!venue || !venue.id) {
                return;
            }
            const id = venue.id;
            [venue.id, venue.name, venue.label].forEach((value) => {
                if (value) {
                    venueLookup.set(safeLower(value), id);
                }
            });
        });
        const fallbackVenueId = venues[0]?.id || 'hq';

        return programManifest.sessions
            .filter((session) => session && typeof session === 'object')
            .map((session, index) => {
                const date = (session.date || '').trim();
                const startTime = normaliseTimeValue(session.startTime || '');
                if (!date || !startTime) {
                    return null;
                }

                const dayIdRaw = dayIdByDate.get(date) || date;
                const venueKey = safeLower(session.venue || '');
                const venueId = venueLookup.get(venueKey) || fallbackVenueId;

                return {
                    id: session.id ? `session-entry-${session.id}` : `session-entry-${index}`,
                    sessionId: session.id || '',
                    dayId: dayIdRaw,
                    startTime,
                    endTime: normaliseTimeValue(session.endTime || ''),
                    category: session.category || 'talks',
                    venueId,
                    durationMinutes: toPositiveInteger(session.durationMinutes || session.expectedDurationMinutes || 0)
                };
            })
            .filter(Boolean);
    }

    function normaliseVenues(scheduleVenues, metadataVenues) {
        const venueMap = new Map();

        const addVenue = (rawVenue) => {
            if (!rawVenue) {
                return;
            }
            const id = safeLower(rawVenue.id || rawVenue.key || rawVenue.code || rawVenue.slug);
            if (!id) {
                return;
            }
            const existing = venueMap.get(id) || {};
            const venue = {
                id,
                name: rawVenue.name || existing.name || rawVenue.label || existing.label || id.toUpperCase(),
                label: rawVenue.label || existing.label || rawVenue.name || existing.name || id.toUpperCase(),
                location: rawVenue.location || existing.location || '',
                mapUrl: rawVenue.mapUrl || existing.mapUrl || '',
                order: Number.isFinite(rawVenue.order) ? Number(rawVenue.order) : (existing.order ?? venueMap.size)
            };
            venueMap.set(id, venue);
        };

        if (Array.isArray(scheduleVenues)) {
            scheduleVenues.forEach(addVenue);
        } else if (scheduleVenues && typeof scheduleVenues === 'object') {
            Object.values(scheduleVenues).forEach(addVenue);
        }

        if (Array.isArray(metadataVenues)) {
            metadataVenues.forEach(addVenue);
        }

        return Array.from(venueMap.values()).sort((a, b) => {
            const orderDiff = (a.order ?? 0) - (b.order ?? 0);
            if (orderDiff !== 0) {
                return orderDiff;
            }
            return a.label.localeCompare(b.label);
        });
    }

    function normaliseDays(scheduleDays, metadataDays) {
        const dayMap = new Map();

        const addDay = (rawDay) => {
            if (!rawDay) {
                return;
            }
            const id = safeLower(rawDay.id || rawDay.key || rawDay.date);
            if (!id) {
                return;
            }
            const existing = dayMap.get(id) || {};
            const date = rawDay.date || existing.date || '';
            const day = {
                id,
                label: rawDay.label || existing.label || formatDayLabel(date) || id,
                subtitle: rawDay.subtitle || existing.subtitle || '',
                date,
                order: Number.isFinite(rawDay.order) ? Number(rawDay.order) : (existing.order ?? dayMap.size)
            };
            dayMap.set(id, day);
        };

        if (Array.isArray(scheduleDays)) {
            scheduleDays.forEach(addDay);
        } else if (scheduleDays && typeof scheduleDays === 'object') {
            Object.values(scheduleDays).forEach(addDay);
        }

        if (Array.isArray(metadataDays)) {
            metadataDays.forEach(addDay);
        }

        return Array.from(dayMap.values()).sort((a, b) => {
            const orderDiff = (a.order ?? 0) - (b.order ?? 0);
            if (orderDiff !== 0) {
                return orderDiff;
            }
            if (a.date && b.date) {
                const dateDiff = a.date.localeCompare(b.date);
                if (dateDiff !== 0) {
                    return dateDiff;
                }
            }
            return a.label.localeCompare(b.label);
        });
    }

    function formatDayLabel(date) {
        if (!date) {
            return '';
        }
        const parsed = new Date(`${date}T12:00:00`);
        if (Number.isNaN(parsed.getTime())) {
            return '';
        }
        return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(parsed);
    }

    function parseIsoDateFlexible(isoString, fallbackUtc = false) {
        if (!isoString) {
            return null;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
            const suffix = fallbackUtc ? 'Z' : '';
            const candidate = new Date(`${isoString}T12:00:00${suffix}`);
            return Number.isNaN(candidate.getTime()) ? null : candidate;
        }
        const date = new Date(isoString);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatIsoDateDisplay(isoString) {
        const date = parseIsoDateFlexible(isoString, true);
        if (!date) {
            return '';
        }
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    }

    function formatDateRange(start, end) {
        const startLabel = formatIsoDateDisplay(start);
        const endLabel = formatIsoDateDisplay(end);
        if (!startLabel && !endLabel) {
            return 'Dates TBA';
        }
        if (!endLabel || startLabel === endLabel) {
            return startLabel;
        }
        return `${startLabel} → ${endLabel}`;
    }

    function normaliseTimeFormat(value) {
        const raw = (value ?? '').toString().trim().toLowerCase();
        if (!raw) {
            return DEFAULT_TIME_FORMAT;
        }
        if (raw === '24h' || raw === '24-hour' || raw === '24 hour' || raw === '24hour' || raw === '24') {
            return '24h';
        }
        if (raw === '12h' || raw === '12-hour' || raw === '12 hour' || raw === '12hour' || raw === '12' || raw === 'am/pm' || raw === 'ampm') {
            return '12h';
        }
        if (raw.includes('24')) {
            return '24h';
        }
        if (raw.includes('12') || raw.includes('am') || raw.includes('pm')) {
            return '12h';
        }
        return DEFAULT_TIME_FORMAT;
    }

    function formatTimeDisplay(time, format, timezone) {
        const normalisedTime = normaliseTimeValue(time);
        if (!normalisedTime) {
            return time || '';
        }
        const safeFormat = normaliseTimeFormat(format);
        if (safeFormat === '24h') {
            return normalisedTime;
        }
        const [hourPart, minutePart] = normalisedTime.split(':');
        let hours = Number(hourPart);
        if (!Number.isFinite(hours)) {
            return normalisedTime;
        }
        const minutes = (minutePart || '00').padStart(2, '0');
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = (hours % 12) || 12;
        return `${hours}:${minutes} ${period}`;
    }

    function formatLastUpdated(lastUpdated, version) {
        const timestamp = parseIsoDateFlexible(lastUpdated);
        if (!timestamp && !version) {
            return '';
        }
        let label = '';
        if (timestamp) {
            const formatted = new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short'
            }).format(timestamp);
            label = `Updated ${formatted}`;
        }
        if (version) {
            const versionLabel = `Version ${version}`;
            label = label ? `${label} · ${versionLabel}` : versionLabel;
        }
        return label;
    }

    function normaliseEntries(entries, days, venues, sessionsById, options) {
        const result = [];
        if (!Array.isArray(entries) || !days.length || !venues.length) {
            return result;
        }

        const timezone = normaliseTimezone(options?.timezone || FALLBACK_TIMEZONE);

        const dayMap = new Map();
        days.forEach((day) => {
            dayMap.set(safeLower(day.id), day);
        });

        const venueMap = new Map();
        venues.forEach((venue) => {
            venueMap.set(safeLower(venue.id), venue);
        });

        entries.forEach((rawEntry) => {
            if (!rawEntry) {
                return;
            }
            const dayId = safeLower(rawEntry.dayId || rawEntry.day);
            const day = dayMap.get(dayId);
            if (!day) {
                return;
            }
            const venueId = safeLower(rawEntry.venueId || rawEntry.venue);
            const venue = venueMap.get(venueId);
            if (!venue) {
                return;
            }
            const startTime = normaliseTimeValue(rawEntry.startTime || rawEntry.time);
            if (!startTime) {
                return;
            }

            let endTime = normaliseTimeValue(rawEntry.endTime || rawEntry.end);
            let durationMinutes = null;
            if (endTime) {
                const diff = Math.max(diffMinutes(startTime, endTime), 0);
                if (diff > 0) {
                    durationMinutes = diff;
                }
            }
            if (!durationMinutes) {
                durationMinutes = toPositiveInteger(rawEntry.durationMinutes);
            }
            if (!durationMinutes) {
                durationMinutes = options.defaultDurationMinutes;
            }
            let computedEndTime = endTime;

            const sessionId = rawEntry.sessionId || rawEntry.session || '';
            const session = sessionId ? sessionsById.get(sessionId) : null;
            const speakers = extractSpeakerNames(session);

            const categoryKeyRaw = safeLower(rawEntry.category);
            const categoryKey = CATEGORY_INFO[categoryKeyRaw] ? categoryKeyRaw : 'other';
            const categoryMeta = CATEGORY_INFO[categoryKey] || CATEGORY_INFO.other;

            const title = rawEntry.title || (session && session.title) || 'Untitled Entry';
            const subtitle = rawEntry.subtitle || rawEntry.display || rawEntry.description || (speakers.length ? speakers.join(', ') : '');
            const detailDescription = rawEntry.description || rawEntry.notes || (session && session.description) || '';
            const description = buildEntryDescription({
                detailDescription,
                subtitle,
                speakers
            });

            const baseStartIso = day.date ? `${day.date}T${startTime}` : '';
            let startIso = baseStartIso;
            let startUtcIso = '';
            let startPartsLocal = null;

            if (baseStartIso) {
                const parsedStart = parseIsoParts(baseStartIso);
                if (parsedStart) {
                    startPartsLocal = normalisePartsForTimezone(parsedStart, timezone);
                    startIso = formatIsoStringWithTimezone(parsedStart, timezone);
                    startUtcIso = createDateInTimezone(parsedStart, timezone).toISOString();
                }
            }

            if (!computedEndTime) {
                if (startPartsLocal && durationMinutes) {
                    const computedEndParts = addMinutesToParts(startPartsLocal, durationMinutes, timezone);
                    computedEndTime = `${String(computedEndParts.hour).padStart(2, '0')}:${String(computedEndParts.minute).padStart(2, '0')}`;
                } else {
                    computedEndTime = addMinutesToTime(startTime, durationMinutes);
                }
            }

            result.push({
                id: rawEntry.id || `${day.id}-${venue.id}-${startTime}`,
                title,
                subtitle,
                description,
                category: categoryKey,
                dataType: categoryMeta.dataType,
                dayId: day.id,
                dayLabel: day.label,
                date: day.date,
                startTime,
                endTime: computedEndTime,
                durationMinutes,
                startIso,
                startUtc: startUtcIso,
                venueId: venue.id,
                venueName: venue.name || venue.label,
                venueLabel: venue.label || venue.name || venue.id.toUpperCase(),
                venueLocation: venue.location || venue.name || venue.label,
                venueMapUrl: venue.mapUrl || '',
                sessionId,
                speakers,
                detailDescription
            });
        });

        result.sort((a, b) => {
            const dayDiff = a.dayId.localeCompare(b.dayId);
            if (dayDiff !== 0) {
                return dayDiff;
            }
            const timeDiff = compareTimeStrings(a.startTime, b.startTime);
            if (timeDiff !== 0) {
                return timeDiff;
            }
            return a.venueId.localeCompare(b.venueId);
        });

        return result;
    }

    function extractSpeakerNames(session) {
        if (!session || !Array.isArray(session.speakers)) {
            return [];
        }
        return session.speakers
            .map((speaker) => speaker.displayName || speaker.name || '')
            .filter(Boolean);
    }

    function buildEntryDescription({ detailDescription, subtitle }) {
        const parts = [];
        if (detailDescription) {
            parts.push(detailDescription);
        } else if (subtitle) {
            parts.push(subtitle);
        }
        return parts.join('\n').trim();
    }

    function formatDurationMinutes(minutes) {
        if (!Number.isFinite(minutes) || minutes <= 0) {
            return '';
        }
        const rounded = Math.round(minutes);
        const hours = Math.floor(rounded / 60);
        const remainder = rounded % 60;
        const parts = [];
        if (hours > 0) {
            parts.push(`${hours} ${hours === 1 ? 'hr' : 'hrs'}`);
        }
        if (remainder > 0 || parts.length === 0) {
            parts.push(`${remainder} min`);
        }
        return parts.join(' ');
    }

    function renderSchedule(root, schedule) {
        root.removeAttribute('data-schedule-error');
        root.removeAttribute('data-schedule-empty');
        root.removeAttribute('data-schedule-loaded');

        const locationEl = root.querySelector('[data-schedule-location]');
        const timezoneEl = root.querySelector('[data-schedule-timezone]');
        const datesEl = root.querySelector('[data-schedule-dates]');
        const updatedEl = root.querySelector('[data-schedule-updated]');
        const noteEl = root.querySelector('[data-schedule-note]');
        const venueList = root.querySelector('[data-schedule-venue-list]');
        const dayContainer = root.querySelector('[data-schedule-days]');
        if (!venueList || !dayContainer) {
            return;
        }

        const activeFormat = normaliseTimeFormat(schedule.timeFormat);
        root.dataset.scheduleFormat = activeFormat;

        const defaultEmptyNote = 'Schedule details coming soon.';
        const defaultActiveNote = '';

        if (locationEl) {
            locationEl.textContent = schedule.location || 'Pasadena, CA';
        }
        if (timezoneEl) {
            timezoneEl.textContent = schedule.timezone || FALLBACK_TIMEZONE;
        }
        if (datesEl) {
            datesEl.textContent = formatDateRange(schedule.eventStartDate, schedule.eventEndDate);
        }
        if (updatedEl) {
            updatedEl.textContent = formatLastUpdated(schedule.lastUpdated, schedule.version);
        }

        venueList.innerHTML = '';
        if (schedule.venues.length === 0) {
            const placeholder = document.createElement('p');
            placeholder.className = 'schedule-empty';
            placeholder.textContent = 'Venue information coming soon.';
            venueList.appendChild(placeholder);
        }

        schedule.venues.forEach((venue) => {
            const link = document.createElement('a');
            link.className = 'schedule-venue';
            link.setAttribute('role', 'listitem');
            link.dataset.venue = venue.id;
            if (venue.mapUrl) {
                link.href = venue.mapUrl;
                link.target = '_blank';
                link.rel = 'noopener';
                link.setAttribute('aria-label', `Open map for ${venue.name || venue.label}`);
            } else {
                link.href = '#';
                link.addEventListener('click', (event) => event.preventDefault());
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'schedule-venue-name';
            nameSpan.textContent = venue.name || venue.label;
            link.appendChild(nameSpan);

            const addrSpan = document.createElement('span');
            addrSpan.className = 'schedule-venue-address';
            addrSpan.textContent = venue.location || '';
            link.appendChild(addrSpan);

            if (venue.mapUrl) {
                const noteSpan = document.createElement('span');
                noteSpan.className = 'schedule-venue-note schedule-action schedule-map';
                noteSpan.textContent = 'View Map';
                link.appendChild(noteSpan);
            }

            venueList.appendChild(link);
        });

        const entriesByDay = new Map();
        schedule.entries.forEach((entry) => {
            if (!entriesByDay.has(entry.dayId)) {
                entriesByDay.set(entry.dayId, []);
            }
            entriesByDay.get(entry.dayId).push(entry);
        });

    dayContainer.innerHTML = '';
        if (!schedule.days.length || !schedule.entries.length) {
            const placeholder = document.createElement('p');
            placeholder.className = 'schedule-empty';
            placeholder.textContent = 'Schedule details coming soon.';
            dayContainer.appendChild(placeholder);
            if (noteEl) {
                const noteText = schedule.note || defaultEmptyNote;
                noteEl.textContent = noteText;
                noteEl.hidden = noteText.trim() === '';
            }
            root.setAttribute('data-schedule-empty', 'true');
            return;
        }

        schedule.days.forEach((day) => {
            const dayEntries = entriesByDay.get(day.id) || [];
            renderDay(dayContainer, day, dayEntries, schedule);
        });

        if (noteEl) {
            const noteText = schedule.note || defaultActiveNote;
            noteEl.textContent = noteText;
            noteEl.hidden = noteText.trim() === '';
        }

        root.setAttribute('data-schedule-loaded', 'true');
    }

    function renderDay(dayContainer, day, entries, schedule) {
        const article = document.createElement('article');
        article.className = 'schedule-day';
        const activeFormat = normaliseTimeFormat(schedule.timeFormat);

        const header = document.createElement('header');
        header.className = 'schedule-day-header';

        const headingGroup = document.createElement('div');
        headingGroup.className = 'schedule-day-heading';

        const title = document.createElement('h3');
        title.textContent = day.label;
        headingGroup.appendChild(title);

        if (day.subtitle) {
            const subtitle = document.createElement('p');
            subtitle.className = 'schedule-day-sub';
            subtitle.textContent = day.subtitle;
            headingGroup.appendChild(subtitle);
        }

    header.appendChild(headingGroup);

        article.appendChild(header);

        const table = document.createElement('div');
        table.className = 'schedule-table';
        article.appendChild(table);

        const headerRow = document.createElement('div');
        headerRow.className = 'schedule-row schedule-row--header';

        const timeHeader = document.createElement('span');
        timeHeader.className = 'schedule-cell schedule-cell--time';
        timeHeader.textContent = activeFormat === '24h' ? 'Time (24)' : 'Time (12)';
        headerRow.appendChild(timeHeader);

        schedule.venues.forEach((venue) => {
            const venueHeader = document.createElement('span');
            venueHeader.className = 'schedule-cell';
            venueHeader.dataset.venue = venue.id;
            venueHeader.textContent = venue.label || venue.name || venue.id.toUpperCase();
            headerRow.appendChild(venueHeader);
        });

        table.appendChild(headerRow);

        if (!entries.length) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'schedule-day-empty';
            emptyMessage.textContent = 'No entries scheduled yet.';
            article.appendChild(emptyMessage);
            dayContainer.appendChild(article);
            return;
        }

        const entryMap = new Map();
        entries.forEach((entry) => {
            const key = `${entry.startTime}|${entry.venueId}`;
            entryMap.set(key, entry);
        });

        const timeSlots = Array.from(new Set(entries.map((entry) => entry.startTime))).sort(compareTimeStrings);

        timeSlots.forEach((slot) => {
            const row = document.createElement('div');
            row.className = 'schedule-row';

            const timeCell = document.createElement('div');
            timeCell.className = 'schedule-cell schedule-cell--time';
            const timeEl = document.createElement('time');
            if (day.date) {
                timeEl.setAttribute('datetime', `${day.date}T${slot}`);
            }
            const displayTime = formatTimeDisplay(slot, activeFormat, schedule.timezone);
            timeEl.textContent = displayTime;
            timeEl.dataset.originalTime = slot;
            if (activeFormat === '12h') {
                timeEl.title = `${slot} (${displayTime})`;
            } else {
                timeEl.removeAttribute('title');
            }
            timeCell.appendChild(timeEl);
            row.appendChild(timeCell);

            schedule.venues.forEach((venue) => {
                const key = `${slot}|${venue.id}`;
                const entry = entryMap.get(key);
                const cell = document.createElement('div');
                cell.className = 'schedule-cell';
                cell.dataset.venue = venue.id;

                if (!entry) {
                    cell.classList.add('schedule-cell--empty');
                    cell.setAttribute('aria-hidden', 'true');
                    row.appendChild(cell);
                    return;
                }

                if (entry.dataType) {
                    cell.dataset.type = entry.dataType;
                }
                if (entry.durationMinutes) {
                    cell.dataset.duration = String(entry.durationMinutes);
                }

                const titleEl = document.createElement('strong');
                titleEl.textContent = entry.title;
                cell.appendChild(titleEl);

                if (entry.subtitle) {
                    const subtitleEl = document.createElement('span');
                    subtitleEl.textContent = entry.subtitle;
                    cell.appendChild(subtitleEl);
                }

                const durationLabel = formatDurationMinutes(entry.durationMinutes);
                if (durationLabel) {
                    const durationEl = document.createElement('span');
                    durationEl.className = 'schedule-duration';
                    durationEl.textContent = `Duration: ${durationLabel}`;
                    cell.appendChild(durationEl);
                }

                const openEntryModal = () => {
                    showScheduleEntryModal({
                        entry,
                        day,
                        schedule,
                        format: activeFormat,
                        trigger: cell
                    });
                };

                const setModalFocusPreference = (origin) => {
                    if (!cell.dataset) {
                        return;
                    }
                    cell.dataset.scheduleRestoreFocus = origin === 'keyboard' ? 'true' : 'false';
                };

                const startLabel = formatTimeDisplay(entry.startTime, activeFormat, schedule.timezone);
                const endLabel = entry.endTime ? formatTimeDisplay(entry.endTime, activeFormat, schedule.timezone) : '';
                const ariaDetails = [];
                if (startLabel) {
                    ariaDetails.push(endLabel ? `${startLabel} – ${endLabel}` : startLabel);
                }
                if (entry.venueLabel) {
                    ariaDetails.push(entry.venueLabel);
                }

                cell.classList.add('schedule-cell--entry');
                cell.tabIndex = 0;
                cell.setAttribute('role', 'button');
                cell.setAttribute('aria-label', ariaDetails.length
                    ? `View details for ${entry.title} · ${ariaDetails.join(' · ')}`
                    : `View details for ${entry.title}`);

                cell.addEventListener('click', (event) => {
                    const isKeyboardActivated = event.detail === 0;
                    if (isKeyboardActivated) {
                        return;
                    }
                    setModalFocusPreference('pointer');
                    event.preventDefault();
                    openEntryModal();
                });

                cell.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        setModalFocusPreference('keyboard');
                        event.preventDefault();
                        openEntryModal();
                    }
                });

                row.appendChild(cell);
            });

            table.appendChild(row);
        });

        dayContainer.appendChild(article);
    }

    function buildIcsEvent(options) {
        if (!options || !options.startIso) {
            return '';
        }

        const timezone = normaliseTimezone(options.timezone || FALLBACK_TIMEZONE);
        const startPartsRaw = parseIsoParts(options.startIso);
        if (!startPartsRaw) {
            return '';
        }

        const startParts = normalisePartsForTimezone(startPartsRaw, timezone);
        if (!startParts) {
            return '';
        }

        const parsedDuration = Number(options.durationMinutes);
        const durationMinutes = Number.isFinite(parsedDuration) && parsedDuration > 0
            ? parsedDuration
            : FALLBACK_DURATION_MINUTES;

        const endParts = addMinutesToParts(startParts, durationMinutes, timezone);
        const dtStart = formatPartsForIcs(startParts);
        const dtEnd = formatPartsForIcs(endParts);
        const dtStamp = formatDateUtc(new Date());
        const uid = `${dtStart}-${slugify(options.summary)}-${slugify(options.location || 'location')}@supercon9.com`;

        const descriptionSections = [];
        if (options.dayLabel) {
            descriptionSections.push(options.dayLabel);
        }
        if (options.description) {
            descriptionSections.push(options.description);
        }
        if (options.location) {
            descriptionSections.push(options.location);
        }
        if (options.mapUrl) {
            descriptionSections.push(`Map: ${options.mapUrl}`);
        }
        descriptionSections.push('Hackaday Supercon 2025');

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Hackaday Supercon 2025//Schedule//EN',
            'CALSCALE:GREGORIAN',
            `X-WR-TIMEZONE:${timezone}`
        ];

        if (timezone === 'America/Los_Angeles') {
            lines.push(...TIMEZONE_DEFINITION);
        }

        lines.push(
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${dtStamp}`,
            `DTSTART;TZID=${timezone}:${dtStart}`,
            `DTEND;TZID=${timezone}:${dtEnd}`,
            `SUMMARY:${escapeIcs(options.summary)}`,
            `DESCRIPTION:${escapeIcs(descriptionSections.join('\n'))}`,
            `LOCATION:${escapeIcs(options.location || '')}`,
            `URL:${escapeIcs(options.pageUrl || '')}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            'END:VEVENT',
            'END:VCALENDAR'
        );

        return lines.join('\r\n');
    }

    function parseIsoParts(isoString) {
        if (!isoString || typeof isoString !== 'string') {
            return null;
        }

        const match = isoString.trim().match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?(?:([+-][0-9]{2}):?([0-9]{2})|Z)?$/);
        if (!match) {
            return null;
        }

        return {
            year: Number(match[1]),
            month: Number(match[2]),
            day: Number(match[3]),
            hour: Number(match[4]),
            minute: Number(match[5]),
            second: Number(match[6] || '0')
        };
    }

    const dateTimeFormatterCache = new Map();

    function getTimezoneFormatter(timezone) {
        const key = timezone || '__default__';
        if (!dateTimeFormatterCache.has(key)) {
            dateTimeFormatterCache.set(key, new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }));
        }
        return dateTimeFormatterCache.get(key);
    }

    function extractZonedDateParts(date, timezone) {
        const formatter = getTimezoneFormatter(timezone);
        const record = Object.create(null);
        formatter.formatToParts(date).forEach(({ type, value }) => {
            if (type !== 'literal') {
                record[type] = value;
            }
        });

        return {
            year: Number(record.year),
            month: Number(record.month),
            day: Number(record.day),
            hour: Number(record.hour),
            minute: Number(record.minute),
            second: Number(record.second || '0')
        };
    }

    function getTimezoneOffsetMilliseconds(date, timezone) {
        const parts = extractZonedDateParts(date, timezone);
        const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
        return asUtc - date.getTime();
    }

    function createDateInTimezone(parts, timezone) {
        const safeSecond = Number.isFinite(parts?.second) ? Number(parts.second) : 0;
        const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, safeSecond));
        const offset = getTimezoneOffsetMilliseconds(utcGuess, timezone);
        return new Date(utcGuess.getTime() - offset);
    }

    function normalisePartsForTimezone(parts, timezone) {
        if (!parts) {
            return null;
        }
        const zonedDate = createDateInTimezone(parts, timezone);
        return extractZonedDateParts(zonedDate, timezone);
    }

    function addMinutesToParts(parts, minutes, timezone) {
        const zonedDate = createDateInTimezone(parts, timezone);
        zonedDate.setUTCMinutes(zonedDate.getUTCMinutes() + minutes);
        return extractZonedDateParts(zonedDate, timezone);
    }

    function formatIsoStringWithTimezone(parts, timezone) {
        const zonedDate = createDateInTimezone(parts, timezone);
        const displayParts = extractZonedDateParts(zonedDate, timezone);
        const pad = (value) => String(value).padStart(2, '0');
        const offsetMinutes = Math.round(getTimezoneOffsetMilliseconds(zonedDate, timezone) / 60000);
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const absolute = Math.abs(offsetMinutes);
        const offsetHours = Math.floor(absolute / 60);
        const offsetMinute = absolute % 60;
        return `${displayParts.year}-${pad(displayParts.month)}-${pad(displayParts.day)}T${pad(displayParts.hour)}:${pad(displayParts.minute)}:${pad(displayParts.second)}${sign}${pad(offsetHours)}:${pad(offsetMinute)}`;
    }

    function formatPartsForIcs(parts) {
        const pad = (value) => String(value).padStart(2, '0');
        const second = Number.isFinite(parts?.second) ? Number(parts.second) : 0;
        return `${parts.year}${pad(parts.month)}${pad(parts.day)}T${pad(parts.hour)}${pad(parts.minute)}${pad(second)}`;
    }

    function formatDateUtc(date) {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }

    function escapeIcs(text) {
        return (text || '')
            .replace(/\\/g, '\\\\')
            .replace(/\r\n|\r|\n/g, '\\n')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,');
    }

    function normaliseTimezone(rawTimezone) {
        if (!rawTimezone) {
            return FALLBACK_TIMEZONE;
        }

        let timezone = String(rawTimezone).trim();
        if (timezone === '') {
            return FALLBACK_TIMEZONE;
        }

        const aliasKey = timezone.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
        if (aliasKey && TIMEZONE_ALIASES[aliasKey]) {
            timezone = TIMEZONE_ALIASES[aliasKey];
        } else {
            timezone = timezone.replace(/\s+/g, '_');
        }

        if (isValidTimezone(timezone)) {
            return timezone;
        }

        const candidate = timezone
            .split('/')
            .map((segment) => segment
                .split('_')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join('_'))
            .join('/');

        if (isValidTimezone(candidate)) {
            return candidate;
        }

        return FALLBACK_TIMEZONE;
    }

    function isValidTimezone(timezone) {
        if (!timezone) {
            return false;
        }

        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            return true;
        } catch (error) {
            return false;
        }
    }

    function slugify(text) {
        return (text || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'event';
    }

    let scheduleModalElements = null;
    let scheduleModalActiveTrigger = null;
    let scheduleModalKeyListenerAttached = false;

    function ensureScheduleEntryModal() {
        if (scheduleModalElements) {
            return scheduleModalElements;
        }

        const overlay = document.createElement('div');
        overlay.className = 'schedule-entry-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        const wrapper = document.createElement('div');
        wrapper.className = 'schedule-entry-modal';
        wrapper.setAttribute('role', 'dialog');
        wrapper.setAttribute('aria-modal', 'true');
        wrapper.setAttribute('tabindex', '-1');
        wrapper.setAttribute('aria-hidden', 'true');

        const header = document.createElement('header');
        header.className = 'schedule-entry-modal__header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'schedule-entry-modal__titlegroup';

    const titleEl = document.createElement('h3');
        titleEl.className = 'schedule-entry-modal__title';
        titleEl.id = 'schedule-entry-modal-title';
        titleEl.textContent = '';

        const subtitleEl = document.createElement('p');
        subtitleEl.className = 'schedule-entry-modal__subtitle';
        subtitleEl.textContent = '';
        subtitleEl.hidden = true;

        titleGroup.appendChild(titleEl);
        titleGroup.appendChild(subtitleEl);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'schedule-entry-modal__close';
        closeButton.setAttribute('aria-label', 'Close schedule details');
        closeButton.textContent = '×';

        header.appendChild(titleGroup);
        header.appendChild(closeButton);

        const body = document.createElement('div');
        body.className = 'schedule-entry-modal__body';

        const meta = document.createElement('div');
        meta.className = 'schedule-entry-modal__meta';

        const createMetaRow = (label) => {
            const row = document.createElement('div');
            row.className = 'schedule-entry-modal__meta-item';

            const labelEl = document.createElement('span');
            labelEl.className = 'schedule-entry-modal__meta-label';
            labelEl.textContent = label;

            const valueEl = document.createElement('span');
            valueEl.className = 'schedule-entry-modal__meta-value';

            row.append(labelEl, valueEl);
            meta.appendChild(row);

            return { row, label: labelEl, value: valueEl };
        };

        const timeMeta = createMetaRow('Time');
        const venueMeta = createMetaRow('Location');
        const speakersMeta = createMetaRow('Speakers');

        const descriptionEl = document.createElement('p');
        descriptionEl.className = 'schedule-entry-modal__description';
        descriptionEl.textContent = '';
        descriptionEl.hidden = true;

        const footer = document.createElement('div');
        footer.className = 'schedule-entry-modal__footer';

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'schedule-action schedule-add schedule-entry-modal__add';
        addButton.textContent = 'Add to Calendar';

        footer.appendChild(addButton);

        body.appendChild(meta);
        body.appendChild(descriptionEl);
        body.appendChild(footer);

        wrapper.setAttribute('aria-labelledby', titleEl.id);
        wrapper.appendChild(header);
        wrapper.appendChild(body);
        overlay.appendChild(wrapper);
        document.body.appendChild(overlay);

        const hideOnOverlayClick = (event) => {
            if (event.target === overlay) {
                hideScheduleEntryModal();
            }
        };

        closeButton.addEventListener('click', hideScheduleEntryModal);
        overlay.addEventListener('click', hideOnOverlayClick);

        if (!scheduleModalKeyListenerAttached) {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && scheduleModalElements && scheduleModalElements.overlay.classList.contains('schedule-entry-overlay--visible')) {
                    hideScheduleEntryModal();
                }
            });
            scheduleModalKeyListenerAttached = true;
        }

        scheduleModalElements = {
            overlay,
            wrapper,
            header,
            body,
            titleEl,
            subtitleEl,
            descriptionEl,
            closeButton,
            addButton,
            timeMetaRow: timeMeta.row,
            timeMetaValue: timeMeta.value,
            venueMetaRow: venueMeta.row,
            venueMetaLabel: venueMeta.label,
            venueMetaValue: venueMeta.value,
            speakersMetaRow: speakersMeta.row,
            speakersMetaLabel: speakersMeta.label,
            speakersMetaValue: speakersMeta.value
        };

        return scheduleModalElements;
    }

    function showScheduleEntryModal({ entry, day, schedule, format, trigger }) {
        if (!entry) {
            return;
        }

        const modal = ensureScheduleEntryModal();
        const {
            overlay,
            wrapper,
            titleEl,
            subtitleEl,
            descriptionEl,
            closeButton,
            addButton,
            timeMetaRow,
            timeMetaValue,
            venueMetaRow,
            venueMetaLabel,
            venueMetaValue,
            speakersMetaRow,
            speakersMetaLabel,
            speakersMetaValue
        } = modal;

        titleEl.textContent = entry.title || 'Schedule Entry';

        const speakerList = Array.isArray(entry.speakers) ? entry.speakers.join(', ') : '';
        if (entry.subtitle && entry.subtitle.trim() && entry.subtitle.trim() !== speakerList) {
            subtitleEl.textContent = entry.subtitle;
            subtitleEl.hidden = false;
        } else {
            subtitleEl.textContent = '';
            subtitleEl.hidden = true;
        }

        const timezone = schedule?.timezone || FALLBACK_TIMEZONE;
        const displayFormat = normaliseTimeFormat(format || schedule?.timeFormat || DEFAULT_TIME_FORMAT);
        const startLabel = formatTimeDisplay(entry.startTime, displayFormat, timezone);
        const endLabel = entry.endTime ? formatTimeDisplay(entry.endTime, displayFormat, timezone) : '';
        const dayLabel = entry.dayLabel || day?.label || formatDayLabel(entry.date);
        const durationLabel = formatDurationMinutes(entry.durationMinutes);

        let timeLabel = '';
        const rangeLabel = startLabel ? (endLabel ? `${startLabel} – ${endLabel}` : startLabel) : '';
        if (dayLabel && rangeLabel) {
            timeLabel = `${dayLabel} • ${rangeLabel}`;
        } else if (dayLabel) {
            timeLabel = dayLabel;
        } else if (rangeLabel) {
            timeLabel = rangeLabel;
        }
        if (durationLabel) {
            timeLabel = timeLabel ? `${timeLabel} (${durationLabel})` : durationLabel;
        }

        if (timeLabel) {
            timeMetaValue.textContent = timeLabel;
            timeMetaRow.hidden = false;
        } else {
            timeMetaValue.textContent = '';
            timeMetaRow.hidden = true;
        }

        venueMetaValue.textContent = '';
        venueMetaLabel.textContent = 'Location';
        const venueDisplay = entry.venueLabel || entry.venueName || '';
        const hasVenueInfo = Boolean(venueDisplay) || Boolean(entry.venueMapUrl);
        if (hasVenueInfo) {
            if (venueDisplay) {
                venueMetaValue.textContent = venueDisplay;
            }
            if (entry.venueMapUrl) {
                if (venueDisplay) {
                    venueMetaValue.appendChild(document.createTextNode(' '));
                }
                const mapLink = document.createElement('a');
                mapLink.href = entry.venueMapUrl;
                mapLink.target = '_blank';
                mapLink.rel = 'noopener';
                mapLink.className = 'schedule-entry-modal__map-link';
                /* mapLink.textContent = 'View Map'; */
                venueMetaValue.appendChild(mapLink);
            }
            venueMetaRow.hidden = false;
        } else {
            venueMetaValue.textContent = '';
            venueMetaRow.hidden = true;
        }

        const dataType = (entry.dataType || '').toLowerCase();
        const category = (entry.category || '').toLowerCase();
        if (dataType === 'panel' || category === 'panel') {
            speakersMetaLabel.textContent = 'Panel';
        } else if (dataType === 'workshop' || category === 'workshops' || category === 'workshop') {
            speakersMetaLabel.textContent = 'Workshop';
        } else {
            speakersMetaLabel.textContent = 'Speakers';
        }

        const hasSpeakers = Array.isArray(entry.speakers)
            && entry.speakers.some((name) => typeof name === 'string' && name.trim().length > 0);

        if (hasSpeakers) {
            speakersMetaValue.textContent = entry.speakers
                .filter((name) => typeof name === 'string' && name.trim().length > 0)
                .join(', ');
        } else {
            speakersMetaValue.textContent = '';
        }

        speakersMetaRow.hidden = !hasSpeakers;
        speakersMetaRow.setAttribute('aria-hidden', hasSpeakers ? 'false' : 'true');
        if (!hasSpeakers) {
            speakersMetaRow.classList.add('is-hidden');
            speakersMetaRow.style.display = 'none';
        } else {
            speakersMetaRow.classList.remove('is-hidden');
            speakersMetaRow.style.display = '';
        }

        const descriptionText = entry.detailDescription || entry.description || entry.subtitle || '';
        if (descriptionText) {
            descriptionEl.textContent = descriptionText;
            descriptionEl.hidden = false;
        } else {
            descriptionEl.textContent = 'More details coming soon.';
            descriptionEl.hidden = false;
        }

        addButton.onclick = null;
        if (entry.startIso) {
            const addLabelParts = [entry.title];
            if (startLabel) {
                addLabelParts.push(endLabel ? `${startLabel} – ${endLabel}` : startLabel);
            }
            if (entry.venueLabel) {
                addLabelParts.push(entry.venueLabel);
            }
            addButton.hidden = false;
            addButton.disabled = false;
            addButton.setAttribute('aria-label', `Add ${addLabelParts.filter(Boolean).join(' · ')} to your calendar`);
            addButton.onclick = () => {
                const icsDescriptionParts = [];
                if (entry.detailDescription) {
                    icsDescriptionParts.push(entry.detailDescription);
                } else if (entry.description) {
                    icsDescriptionParts.push(entry.description);
                } else if (entry.subtitle) {
                    icsDescriptionParts.push(entry.subtitle);
                }
                if (entry.speakers && entry.speakers.length) {
                    icsDescriptionParts.push(`Speakers: ${entry.speakers.join(', ')}`);
                }

                const icsContent = buildIcsEvent({
                    summary: entry.title,
                    description: icsDescriptionParts.join('\n'),
                    location: entry.venueLocation,
                    startIso: entry.startIso,
                    durationMinutes: entry.durationMinutes || schedule.defaultDurationMinutes || FALLBACK_DURATION_MINUTES,
                    dayLabel: entry.dayLabel || day?.label || '',
                    pageUrl: getCanonicalUrl(),
                    mapUrl: entry.venueMapUrl,
                    timezone
                });
                const filename = `${slugify(entry.title)}-${entry.startIso.replace(/[:T+\-]/g, '')}.ics`;
                downloadIcsFile(filename, icsContent);
            };
        } else {
            addButton.hidden = true;
            addButton.disabled = true;
        }

        overlay.classList.add('schedule-entry-overlay--visible');
        wrapper.classList.add('schedule-entry-modal--visible');
        overlay.setAttribute('aria-hidden', 'false');
        wrapper.setAttribute('aria-hidden', 'false');

        scheduleModalActiveTrigger = trigger instanceof HTMLElement ? trigger : null;
        document.body.classList.add('schedule-modal-open');

        requestAnimationFrame(() => {
            if (closeButton && typeof closeButton.focus === 'function') {
                closeButton.focus({ preventScroll: true });
            } else {
                wrapper.focus({ preventScroll: true });
            }
        });
    }

    function hideScheduleEntryModal() {
        if (!scheduleModalElements) {
            return;
        }
        const { overlay, wrapper, addButton } = scheduleModalElements;
        if (!overlay.classList.contains('schedule-entry-overlay--visible')) {
            return;
        }

        overlay.classList.remove('schedule-entry-overlay--visible');
        wrapper.classList.remove('schedule-entry-modal--visible');
        overlay.setAttribute('aria-hidden', 'true');
        wrapper.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('schedule-modal-open');

        if (addButton) {
            addButton.onclick = null;
        }

        const trigger = scheduleModalActiveTrigger;
        scheduleModalActiveTrigger = null;
        if (trigger) {
            const shouldRestoreFocus = trigger.dataset?.scheduleRestoreFocus !== 'false';
            if (trigger.dataset) {
                delete trigger.dataset.scheduleRestoreFocus;
            }
            if (shouldRestoreFocus && typeof trigger.focus === 'function') {
                trigger.focus({ preventScroll: true });
            } else if (!shouldRestoreFocus && typeof trigger.blur === 'function') {
                trigger.blur();
            }
        }
    }

    function downloadIcsFile(filename, icsContent) {
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function getCanonicalUrl() {
        const { origin, pathname } = window.location;
        return `${origin}${pathname}`;
    }

    function normaliseTimeValue(value) {
        if (!value) {
            return '';
        }
        const match = /^\s*(\d{1,2}):(\d{2})/.exec(value);
        if (!match) {
            return '';
        }
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (!Number.isFinite(hours) || hours < 0 || hours > 23) {
            return '';
        }
        if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
            return '';
        }
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    function addMinutesToTime(time, minutes) {
        const [hour, minute] = time.split(':').map(Number);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
            return time;
        }
        const date = new Date(Date.UTC(1970, 0, 1, hour, minute));
        date.setUTCMinutes(date.getUTCMinutes() + minutes);
        const h = String(date.getUTCHours()).padStart(2, '0');
        const m = String(date.getUTCMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    function diffMinutes(start, end) {
        const [startHour, startMinute] = start.split(':').map(Number);
        const [endHour, endMinute] = end.split(':').map(Number);
        if ([startHour, startMinute, endHour, endMinute].some((value) => !Number.isFinite(value))) {
            return 0;
        }
        let diff = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
        if (diff < 0) {
            diff += 24 * 60; // Handle sessions that pass midnight
        }
        return diff;
    }

    function toPositiveInteger(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0) {
            return null;
        }
        return Math.round(number);
    }

    function compareTimeStrings(a, b) {
        return a.localeCompare(b);
    }

    function safeLower(value) {
        return typeof value === 'string' ? value.toLowerCase() : '';
    }
})();
