(function () {
    const MANIFEST_PATH = 'js/program-manifest.js';
    const SCHEDULE_MANIFEST_PATH = 'js/schedule-manifest.js';
    const HEADSHOT_BASE_PATH = 'images/headshots/';
    const HEADSHOT_PLACEHOLDER = `${HEADSHOT_BASE_PATH}placeholder.svg`;
    const HEADSHOT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
    const FALLBACK_TIMEZONE = 'America/Los_Angeles';
    const FALLBACK_TIME_FORMAT = '12h';
    const DEFAULT_CALENDAR_DURATION = 60;
    let calendarTimeFormat = FALLBACK_TIME_FORMAT;
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
        pst: 'America/Los_Angeles',
        pdt: 'America/Los_Angeles'
    };

    let speakerPopupElements = null;
    let speakerPopupTarget = null;
    let speakerPopupKeydownHandlerAttached = false;
    let scheduleContext = defaultScheduleContext();
    let speakerSessionsByKey = new Map();

    document.addEventListener('DOMContentLoaded', () => {
        const target = document.querySelector('#program-sections .program-content');
        if (!target) {
            return;
        }

        Promise.all([loadProgramManifest(), loadScheduleContext()])
            .then(([sessions, scheduleInfo]) => {
                scheduleContext = scheduleInfo;
                const resolvedTimeFormat = normaliseTimeFormat(scheduleContext.timeFormat || FALLBACK_TIME_FORMAT);
                calendarTimeFormat = resolvedTimeFormat;
                scheduleContext.timeFormat = resolvedTimeFormat;
                speakerSessionsByKey = buildSpeakerSessionIndex(sessions, scheduleContext);
                if (!sessions.length) {
                    target.innerHTML = '<p class="program-empty">Program details coming soon.</p>';
                    return;
                }
                renderSessions(target, sessions);
            })
            .catch((error) => {
                console.error('Failed to load program data', error);
                target.innerHTML = '<p class="program-error">Unable to load program details right now.</p>';
            });
    });

    function loadProgramManifest() {
        return fetchManifest()
            .then((manifest) => {
                const sessions = normaliseManifestSessions(manifest);
                window.PROGRAM_MANIFEST = manifest;
                return sessions;
            });
    }

    function loadScheduleContext() {
        return fetchScheduleManifest()
            .then((manifest) => normaliseScheduleContext(manifest))
            .catch((error) => {
                console.warn('Failed to load schedule manifest for speaker sessions', error);
                return defaultScheduleContext();
            });
    }

    function fetchManifest() {
        const versions = window.S9_VERSIONS || {};
        const versionToken = versions.PROGRAM_MANIFEST_VERSION || versions.SCRIPT_VERSION || versions.APP_VERSION || Date.now();
        const url = `${MANIFEST_PATH}?v=${versionToken}`;
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
            });
    }

    function fetchScheduleManifest() {
        const versions = window.S9_VERSIONS || {};
        const versionToken = versions.SCHEDULE_MANIFEST_VERSION || versions.SCRIPT_VERSION || versions.APP_VERSION || Date.now();
        const url = `${SCHEDULE_MANIFEST_PATH}?v=${versionToken}`;
        return fetch(url, { cache: 'no-cache' })
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
            });
    }

    function normaliseScheduleContext(manifest) {
        const context = defaultScheduleContext();
        if (!manifest || typeof manifest !== 'object') {
            return context;
        }

    context.timezone = normaliseTimezone(manifest.timezone || FALLBACK_TIMEZONE);
    context.timeFormat = normaliseTimeFormat(manifest.timeFormat || context.timeFormat);

        if (Array.isArray(manifest.venues)) {
            manifest.venues.forEach((venue) => {
                if (!venue || typeof venue !== 'object') {
                    return;
                }
                const id = (venue.id || venue.name || venue.label || '').toString().trim().toLowerCase();
                if (!id) {
                    return;
                }
                context.venues.set(id, {
                    id,
                    label: venue.label || venue.name || venue.id || id.toUpperCase(),
                    name: venue.name || venue.label || venue.id || id.toUpperCase(),
                    location: venue.location || venue.address || '',
                    mapUrl: venue.mapUrl || venue.map || ''
                });
            });
        }

        if (Array.isArray(manifest.days)) {
            manifest.days.forEach((day) => {
                if (!day) {
                    return;
                }
                const label = (day.label || day.subtitle || day.date || '').toString().trim();
                const id = (day.id || day.date || '').toString().trim();
                if (day.date) {
                    context.dayLabelsByDate.set(day.date, label || id || day.date);
                }
                if (id) {
                    context.dayLabelsById.set(id, label || id);
                }
            });
        }

        return context;
    }

    function defaultScheduleContext() {
        return {
            timezone: FALLBACK_TIMEZONE,
            timeFormat: FALLBACK_TIME_FORMAT,
            venues: new Map(),
            dayLabelsByDate: new Map(),
            dayLabelsById: new Map()
        };
    }

    function normaliseManifestSessions(manifest) {
        if (!manifest || !Array.isArray(manifest.sessions)) {
            return [];
        }
        return manifest.sessions
            .map((session, index) => normaliseSession(session, index))
            .filter((session) => {
                if (!session.title || !session.speakers.length) {
                    return false;
                }
                return session.category === 'talks' || session.category === 'workshops';
            });
    }

    function normaliseSession(session, index) {
        const rawCategory = typeof session.category === 'string' ? session.category.toLowerCase() : '';
        let category = rawCategory;
        if (category === 'workshop') {
            category = 'workshops';
        }
        if (category !== 'workshops') {
            category = 'talks';
        }

        const id = (session.id || session.sessionId || '').toString().trim() || `session-${index + 1}`;
        const date = (session.date || '').toString().trim().slice(0, 10);
        const dayLabel = (session.day || session.dayLabel || '').toString().trim();
        const startTime = normaliseTimeValue(session.startTime || session.time || '');
        const rawEndTime = normaliseTimeValue(session.endTime || session.finishTime || '');
        let durationMinutes = null;
        if (startTime && rawEndTime) {
            const diff = Math.max(diffMinutes(startTime, rawEndTime), 0);
            if (diff > 0) {
                durationMinutes = diff;
            }
        }
        if (!durationMinutes) {
            durationMinutes = toPositiveInteger(session.durationMinutes);
        }
        let endTime = rawEndTime;
        if (!endTime && startTime && durationMinutes) {
            endTime = addMinutesToTime(startTime, durationMinutes);
        }
        const startIso = date && startTime ? `${date}T${startTime}` : '';
        const venueId = (session.venue || session.venueId || '').toString().trim();

        const data = {
            id,
            title: session.title || '',
            description: session.description || '',
            rawType: session.format || session.rawType || '',
            rawCategory,
            category,
            order: Number.isFinite(session.order) ? Number(session.order) : index,
            isKeynote: Boolean(session.isKeynote),
            date,
            day: dayLabel,
            startTime,
            endTime,
            startIso,
            durationMinutes: durationMinutes || null,
            venue: venueId,
            speakers: Array.isArray(session.speakers)
                ? session.speakers.map((speaker) => normaliseSpeaker(speaker))
                : []
        };
        return data;
    }

    function normaliseSpeaker(speaker) {
        const name = speaker?.name || '';
        return {
            id: speaker?.id || '',
            name,
            displayName: speaker?.displayName || formatSpeakerDisplayName(name),
            bio: speaker?.bio || '',
            headshot: speaker?.headshot || '',
            localHeadshot: speaker?.localHeadshot || ''
        };
    }

    function renderSessions(target, sessions) {
        if (!sessions.length) {
            target.innerHTML = '<p class="program-empty">Program details coming soon.</p>';
            return;
        }

        target.innerHTML = '';

        const dedupedSessions = mergeMultipartWorkshops(sessions);
        const groups = new Map();
        const order = ['talks', 'workshops'];
        const labels = {
            talks: 'Keynote, Talks & Panels',
            workshops: 'Workshops'
        };
        const sectionIds = {
            talks: 'program-speakers',
            workshops: 'program-workshops'
        };

        dedupedSessions.forEach((session) => {
            const key = order.includes(session.category) ? session.category : 'talks';
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(session);
        });

        order.forEach((key) => {
            const list = groups.get(key);
            if (!list || !list.length) {
                return;
            }
            list.sort((a, b) => {
                if (key === 'talks') {
                    if (a.isKeynote && !b.isKeynote) return -1;
                    if (!a.isKeynote && b.isKeynote) return 1;
                }
                return a.order - b.order;
            });
            const groupSection = document.createElement('section');
            groupSection.className = 'program-group';

            const heading = document.createElement('h3');
            heading.className = 'program-group-title';
            heading.id = sectionIds[key] || `program-${key}`;
            heading.textContent = labels[key] || key;
            groupSection.appendChild(heading);

            const grid = document.createElement('div');
            grid.className = 'session-grid';
            list.forEach((session) => {
                grid.appendChild(renderSessionCard(session));
            });

            groupSection.appendChild(grid);
            target.appendChild(groupSection);
        });
    }

    function mergeMultipartWorkshops(sessions) {
        if (!Array.isArray(sessions) || !sessions.length) {
            return [];
        }

        const output = [];
        const multiPartGroups = new Map();

        sessions.forEach((session) => {
            if (!session || session.category !== 'workshops') {
                output.push(session);
                return;
            }

            const partMeta = extractWorkshopPartMeta(session.title || '');
            if (!partMeta) {
                output.push(session);
                return;
            }

            const signature = buildWorkshopPartSignature(session, partMeta);
            const existing = multiPartGroups.get(signature);
            if (!existing) {
                const clone = { ...session };
                multiPartGroups.set(signature, {
                    session: clone,
                    baseTitle: partMeta.baseTitle,
                    parts: new Set(Number.isFinite(partMeta.partNumber) ? [partMeta.partNumber] : []),
                    rawSessions: [session]
                });
                output.push(clone);
                return;
            }

            existing.rawSessions.push(session);
            if (Number.isFinite(partMeta.partNumber)) {
                existing.parts.add(partMeta.partNumber);
            }
            const candidateOrder = Number.isFinite(session.order) ? Number(session.order) : null;
            const currentOrder = Number.isFinite(existing.session.order) ? Number(existing.session.order) : null;
            if (candidateOrder !== null && (currentOrder === null || candidateOrder < currentOrder)) {
                existing.session.order = candidateOrder;
            }
        });

        multiPartGroups.forEach((group) => {
            if (!group || !group.rawSessions || !group.rawSessions.length) {
                return;
            }

            if (group.rawSessions.length === 1) {
                group.session.title = group.rawSessions[0].title;
                return;
            }

            const sortedParts = Array.from(group.parts)
                .filter((value) => Number.isFinite(value))
                .sort((a, b) => a - b);

            if (!sortedParts.length) {
                group.session.title = group.baseTitle;
                return;
            }

            const isSequential = sortedParts.every((value, index, array) => index === 0 || value === array[index - 1] + 1);
            let partLabel;
            if (isSequential) {
                partLabel = sortedParts.length === 1
                    ? `${sortedParts[0]}`
                    : `${sortedParts[0]}-${sortedParts[sortedParts.length - 1]}`;
            } else {
                partLabel = sortedParts.join(', ');
            }

            const prefix = sortedParts.length === 1 ? 'Part' : 'Parts';
            group.session.title = `${group.baseTitle} (${prefix} ${partLabel})`;
        });

        return output;
    }

    function extractWorkshopPartMeta(title) {
        const pattern = /^(.*?)(?:\s*[-:\u2013\u2014]\s*|\s+)Part\s+(\d+)\b.*$/i;
        const match = pattern.exec(title);
        if (!match) {
            return null;
        }
        const baseTitle = (match[1] || '').trim();
        if (!baseTitle) {
            return null;
        }
        const partNumber = Number.parseInt(match[2], 10);
        return {
            baseTitle,
            partNumber: Number.isFinite(partNumber) ? partNumber : null
        };
    }

    function buildWorkshopPartSignature(session, meta) {
        const description = normaliseWhitespace(session.description || '').toLowerCase();
        const speakerKey = Array.isArray(session.speakers)
            ? session.speakers
                .map((speaker) => (speaker.displayName || speaker.name || '').toLowerCase().trim())
                .filter(Boolean)
                .sort()
                .join('|')
            : '';
        const typeKey = normaliseWhitespace(session.rawType || '').toLowerCase();
        return `${meta.baseTitle.toLowerCase()}|${description}|${speakerKey}|${typeKey}`;
    }

    function normaliseWhitespace(value) {
        return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    }

    function buildSpeakerSessionIndex(sessions, context) {
        const index = new Map();
        if (!Array.isArray(sessions)) {
            return index;
        }

        sessions.forEach((session) => {
            if (!session || !Array.isArray(session.speakers) || !session.speakers.length) {
                return;
            }
            const baseEntry = buildSpeakerSessionBase(session, context);
            session.speakers.forEach((speaker) => {
                if (!speaker) {
                    return;
                }
                const key = getSpeakerKey(speaker);
                if (!key) {
                    return;
                }
                const coSpeakers = session.speakers
                    .filter((other) => other && other !== speaker)
                    .map((other) => other.displayName || other.name || '')
                    .filter(Boolean);
                const entry = {
                    ...baseEntry,
                    coSpeakers,
                    speakerName: speaker.displayName || speaker.name || ''
                };
                if (!index.has(key)) {
                    index.set(key, []);
                }
                const list = index.get(key);
                const alreadyPresent = list.some((existing) => existing.id === entry.id);
                if (!alreadyPresent) {
                    list.push(entry);
                }
            });
        });

        index.forEach((list) => {
            list.sort(compareSpeakerSessions);
        });

        return index;
    }

    function buildSpeakerSessionBase(session, context) {
        const timezone = context?.timezone || FALLBACK_TIMEZONE;
        const startTime = normaliseTimeValue(session.startTime);
        const providedEndTime = normaliseTimeValue(session.endTime);
        let durationMinutes = null;
        if (startTime && providedEndTime) {
            const diff = Math.max(diffMinutes(startTime, providedEndTime), 0);
            if (diff > 0) {
                durationMinutes = diff;
            }
        }
        if (!durationMinutes) {
            durationMinutes = toPositiveInteger(session.durationMinutes);
        }
        let endTime = providedEndTime;
        const date = (session.date || '').toString().trim();
        let startIso = session.startIso || (date && startTime ? `${date}T${startTime}` : '');
        let startUtc = '';
        let startPartsLocal = null;
        if (startIso) {
            const parsedStart = parseIsoParts(startIso);
            if (parsedStart) {
                startPartsLocal = normalisePartsForTimezone(parsedStart, timezone);
                startIso = formatIsoStringWithTimezone(parsedStart, timezone);
                startUtc = createDateInTimezone(parsedStart, timezone).toISOString();
            }
        }
        if (!endTime) {
            if (startPartsLocal && durationMinutes) {
                const computedEndParts = addMinutesToParts(startPartsLocal, durationMinutes, timezone);
                endTime = `${String(computedEndParts.hour).padStart(2, '0')}:${String(computedEndParts.minute).padStart(2, '0')}`;
            } else if (startTime && durationMinutes) {
                endTime = addMinutesToTime(startTime, durationMinutes);
            }
        }
        const formatPreference = context?.timeFormat || calendarTimeFormat;
        const dayLabel = session.day
            || context?.dayLabelsByDate.get(date)
            || context?.dayLabelsById.get(session.day)
            || formatIsoDateDisplayLocal(date);
        const timeLabel = formatTimeRangeDisplay(startTime, endTime, formatPreference);
        const venueId = (session.venue || '').toString().trim().toLowerCase();
        const venueInfo = context?.venues?.get(venueId) || null;
        const venueLabel = venueInfo?.label || venueInfo?.name || (session.venue || '').toString().toUpperCase();
        const venueLocation = venueInfo?.location || venueInfo?.name || venueLabel;

        return {
            id: session.id,
            title: session.title,
            description: session.description,
            category: session.category,
            rawType: session.rawType,
            typeLabel: session.rawType || (session.category === 'workshops' ? 'Workshop' : 'Talk'),
            dayLabel: dayLabel || '',
            date,
            timeLabel,
            startTime,
            endTime,
            startIso,
            startUtc,
            durationMinutes: durationMinutes || null,
            timezone,
            venueId,
            venueLabel: venueLabel || '',
            venueLocation: venueLocation || '',
            venueMapUrl: venueInfo?.mapUrl || '',
            order: Number.isFinite(session.order) ? Number(session.order) : 0
        };
    }

    function compareSpeakerSessions(a, b) {
        if (a.startIso && b.startIso && a.startIso !== b.startIso) {
            return a.startIso.localeCompare(b.startIso);
        }
        const orderA = Number.isFinite(a.order) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(b.order) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        return (a.title || '').localeCompare(b.title || '');
    }

    function getSpeakerKey(speaker) {
        if (!speaker) {
            return '';
        }
        const display = (speaker.displayName || speaker.name || '').toString().replace(/\s+/g, ' ').trim();
        if (display) {
            const nameSlug = slugify(display);
            if (nameSlug && nameSlug !== 'event') {
                return `name:${nameSlug}`;
            }
        }

        const bioSnippet = (speaker.bio || '').toString().slice(0, 64).replace(/\s+/g, ' ').trim();
        if (bioSnippet) {
            const bioSlug = slugify(bioSnippet);
            if (bioSlug && bioSlug !== 'event') {
                return `bio:${bioSlug}`;
            }
        }

        const rawId = (speaker.id || '').toString().trim().toLowerCase();
        if (rawId) {
            const idSlug = rawId.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            if (idSlug) {
                return `id:${idSlug}`;
            }
        }
        return '';
    }

    function renderSessionCard(session) {
        const card = document.createElement('article');
        card.className = 'session-card';
        card.dataset.category = session.category;
        card.setAttribute('role', 'listitem');
        if (session.isKeynote) {
            card.classList.add('session-card--keynote');
        }

        const header = document.createElement('header');
        header.className = 'session-card-header';

        if (session.rawType) {
            const meta = document.createElement('p');
            meta.className = 'session-meta';
            const icon = createSessionCategoryIcon(session.category);
            if (icon) {
                meta.appendChild(icon);
            }
            const metaText = document.createElement('span');
            metaText.textContent = session.rawType;
            meta.appendChild(metaText);
            header.appendChild(meta);
        }

        const titleEl = document.createElement('h4');
        titleEl.className = 'session-title';
        titleEl.textContent = session.title;
        header.appendChild(titleEl);

        card.appendChild(header);

        if (session.description) {
            const desc = document.createElement('p');
            desc.className = 'session-description';
            desc.textContent = session.description;
            card.appendChild(desc);
        }

        if (session.speakers.length) {
            const speakerList = document.createElement('ul');
            speakerList.className = 'session-speakers';
            speakerList.setAttribute('role', 'list');
            speakerList.dataset.count = session.speakers.length;
            session.speakers.forEach((speaker) => {
                speakerList.appendChild(renderSpeakerEntry(speaker));
            });
            card.appendChild(speakerList);
        }

        return card;
    }

    function renderSpeakerEntry(speaker) {
        const item = document.createElement('li');
        item.className = 'speaker-entry';
        item.setAttribute('role', 'listitem');

        const bioText = sanitiseBio(speaker.bio);
        const displayName = speaker.displayName || speaker.name || '';
        const speakerKey = getSpeakerKey(speaker);
        const sessionEntries = speakerSessionsByKey.get(speakerKey) || [];
        const popupSessions = sessionEntries.map((entry) => ({
            ...entry,
            coSpeakers: Array.isArray(entry.coSpeakers) ? [...entry.coSpeakers] : []
        }));
        const hasBio = Boolean(bioText);
        const hasSessions = sessionEntries.length > 0;
        let popupData = null;
        if (hasBio || hasSessions) {
            item.dataset.bio = bioText || ' ';
            item.tabIndex = 0;
            item.setAttribute('aria-haspopup', 'dialog');
            item.setAttribute('aria-expanded', 'false');
            popupData = {
                name: displayName,
                bio: bioText,
                image: '',
                sessions: popupSessions
            };
        }

        const ariaParts = [displayName];
        if (bioText) {
            ariaParts.push(bioText);
        }
        item.setAttribute('aria-label', ariaParts.join('. '));

        const nameEl = document.createElement('span');
        nameEl.className = 'speaker-name';
        nameEl.textContent = displayName;
        item.appendChild(nameEl);

        const headshotSources = resolveHeadshotSources(speaker);
        if (headshotSources.length) {
            const img = document.createElement('img');
            img.alt = `${displayName || 'Speaker'} headshot`;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';

            let sourceIndex = 0;
            const useInitials = () => {
                if (img.parentNode === item) {
                    item.removeChild(img);
                }
                const initials = document.createElement('span');
                initials.className = 'speaker-initials';
                initials.textContent = extractInitials(displayName || speaker.name);
                item.insertBefore(initials, nameEl);
                if (popupData) {
                    popupData.image = '';
                    if (speakerPopupTarget === item && speakerPopupElements && speakerPopupElements.wrapper.classList.contains('speaker-popup--visible')) {
                        showSpeakerPopup(item, popupData);
                    }
                }
            };

            const tryNextSource = () => {
                if (sourceIndex >= headshotSources.length) {
                    img.onerror = null;
                    useInitials();
                    return;
                }
                const nextSrc = headshotSources[sourceIndex];
                sourceIndex += 1;
                if (!nextSrc) {
                    tryNextSource();
                    return;
                }
                img.src = nextSrc;
            };

            img.onerror = () => {
                tryNextSource();
            };

            img.onload = () => {
                img.onerror = null;
                if (popupData) {
                    popupData.image = img.currentSrc || img.src || '';
                    if (speakerPopupTarget === item && speakerPopupElements && speakerPopupElements.wrapper.classList.contains('speaker-popup--visible')) {
                        showSpeakerPopup(item, popupData);
                    }
                }
            };

            item.insertBefore(img, nameEl);
            tryNextSource();
        } else {
            const initials = document.createElement('span');
            initials.className = 'speaker-initials';
            initials.textContent = extractInitials(displayName || speaker.name);
            item.insertBefore(initials, nameEl);
            if (popupData) {
                popupData.image = '';
            }
        }

        if (popupData) {
            attachSpeakerPopup(item, popupData);
        }

        return item;
    }

    function createSessionCategoryIcon(category) {
        const info = getSessionCategoryIconInfo(category);
        if (!info) {
            return null;
        }
        const img = document.createElement('img');
        img.className = 'session-category-icon';
        img.src = info.src;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.setAttribute('aria-hidden', 'true');
        img.title = info.tooltip;
        return img;
    }

    function getSessionCategoryIconInfo(category) {
        const key = category && category.toLowerCase() === 'workshops' ? 'workshops' : 'talks';
        const map = {
            talks: {
                src: 'images/ui/microphone.svg',
                tooltip: 'Talk, panel, or keynote'
            },
            workshops: {
                src: 'images/ui/cog.svg',
                tooltip: 'Workshop'
            }
        };
        const info = map[key];
        if (!info) {
            return null;
        }
        return { key, ...info };
    }

    function attachSpeakerPopup(targetEl, data) {
        if (!targetEl) {
            return;
        }

        const setRestorePreference = (origin) => {
            if (!targetEl.dataset) {
                return;
            }
            targetEl.dataset.popupRestoreFocus = origin === 'keyboard' ? 'true' : 'false';
        };

        targetEl.addEventListener('click', (event) => {
            const isKeyboardActivated = event.detail === 0;
            if (isKeyboardActivated) {
                return;
            }
            setRestorePreference('pointer');
            event.preventDefault();
            showSpeakerPopup(targetEl, data);
        });

        targetEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                setRestorePreference('keyboard');
                event.preventDefault();
                showSpeakerPopup(targetEl, data);
                return;
            }
            if (event.key === 'Escape') {
                hideSpeakerPopup();
            }
        });
    }

    function normaliseLocalHeadshot(path) {
        if (!path) {
            return '';
        }
        if (/^https?:/i.test(path)) {
            return path;
        }
        let trimmed = path.replace(/^\.\//, '');
        if (!trimmed.includes('/')) {
            trimmed = `${HEADSHOT_BASE_PATH}${trimmed}`;
        }
        return trimmed;
    }

    function resolveHeadshotSources(speaker) {
        const sources = [];
        const seen = new Set();
        const addSource = (src) => {
            if (!src || seen.has(src)) {
                return;
            }
            seen.add(src);
            sources.push(src);
        };

        const primaryPath = normaliseLocalHeadshot(speaker.localHeadshot || speaker.headshot);
        if (primaryPath) {
            addSource(primaryPath);
        }

        const slugCandidates = buildHeadshotSlugCandidates(
            speaker.displayName || speaker.name,
            speaker.name,
            primaryPath
        );
        slugCandidates.forEach((slug) => {
            HEADSHOT_EXTENSIONS.forEach((extension) => {
                addSource(`${HEADSHOT_BASE_PATH}${slug}.${extension}`);
            });
        });

        addSource(HEADSHOT_PLACEHOLDER);

        return sources;
    }

    function ensureSpeakerPopup() {
        if (speakerPopupElements) {
            return speakerPopupElements;
        }

        const overlay = document.createElement('div');
        overlay.className = 'speaker-popup-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        const wrapper = document.createElement('div');
        wrapper.className = 'speaker-popup';
        wrapper.setAttribute('role', 'dialog');
        wrapper.setAttribute('aria-modal', 'true');
        wrapper.setAttribute('tabindex', '-1');
        wrapper.setAttribute('aria-hidden', 'true');

        const titleBar = document.createElement('div');
        titleBar.className = 'speaker-popup-titlebar';

        const titleGroup = document.createElement('span');
        titleGroup.className = 'speaker-popup-titlegroup';

        const titleIcon = document.createElement('img');
        titleIcon.className = 'speaker-popup-title-icon';
        titleIcon.alt = '';
        titleIcon.setAttribute('aria-hidden', 'true');
        titleIcon.src = (window.S9_VERSIONS && typeof window.S9_VERSIONS.getImageVersion === 'function')
            ? window.S9_VERSIONS.getImageVersion('images/ui/llogo.svg')
            : 'images/ui/llogo.svg';

        const titleEl = document.createElement('span');
        titleEl.className = 'speaker-popup-title';
        titleEl.id = 'speaker-popup-title';
        titleEl.textContent = '';

        titleGroup.appendChild(titleIcon);
        titleGroup.appendChild(titleEl);

        wrapper.setAttribute('aria-labelledby', titleEl.id);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'speaker-popup-close';
        closeButton.setAttribute('aria-label', 'Close speaker details');
        closeButton.textContent = '×';

    titleBar.appendChild(titleGroup);
        titleBar.appendChild(closeButton);

        const body = document.createElement('div');
        body.className = 'speaker-popup-body';

        const image = document.createElement('img');
        image.className = 'speaker-popup-image';
        image.alt = '';

        const content = document.createElement('div');
        content.className = 'speaker-popup-content';

        const bioEl = document.createElement('p');
        bioEl.className = 'speaker-popup-bio';
        bioEl.textContent = '';

        const sessionsContainer = document.createElement('div');
        sessionsContainer.className = 'speaker-popup-sessions';
        sessionsContainer.hidden = true;

        const sessionsTitle = document.createElement('h4');
        sessionsTitle.className = 'speaker-popup-section-title';
        sessionsTitle.textContent = 'Talks & Workshops';

        const sessionsList = document.createElement('div');
        sessionsList.className = 'speaker-popup-session-list';
        sessionsList.setAttribute('role', 'list');

        sessionsContainer.appendChild(sessionsTitle);
        sessionsContainer.appendChild(sessionsList);

        content.appendChild(bioEl);
        content.appendChild(sessionsContainer);
        body.appendChild(image);
        body.appendChild(content);

        wrapper.appendChild(titleBar);
        wrapper.appendChild(body);
        overlay.appendChild(wrapper);
        document.body.appendChild(overlay);

        closeButton.addEventListener('click', () => {
            hideSpeakerPopup();
        });

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                hideSpeakerPopup();
            }
        });

        if (!speakerPopupKeydownHandlerAttached) {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    hideSpeakerPopup();
                }
            });
            speakerPopupKeydownHandlerAttached = true;
        }

        speakerPopupElements = {
            overlay,
            wrapper,
            image,
            bioEl,
            titleEl,
            titleIcon,
            body,
            closeButton,
            sessionsContainer,
            sessionsTitle,
            sessionsList
        };
        return speakerPopupElements;
    }

    function showSpeakerPopup(targetEl, data) {
        if (!targetEl || !data) {
            return;
        }
        const popup = ensureSpeakerPopup();
        const { overlay, wrapper, image, bioEl, titleEl, titleIcon, body, closeButton, sessionsContainer, sessionsTitle, sessionsList } = popup;

        titleEl.textContent = data.name || 'Speaker';
        if (titleIcon) {
            titleIcon.hidden = false;
        }
        wrapper.setAttribute('aria-label', data.name ? `${data.name} bio` : 'Speaker details');
        bioEl.textContent = data.bio || '';
        bioEl.hidden = !data.bio;
        const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    updateSpeakerSessions(sessionsContainer, sessionsList, sessionsTitle, sessions);
        body.scrollTop = 0;

        if (data.image) {
            image.src = data.image;
            image.alt = `${data.name || 'Speaker'} headshot`;
            image.hidden = false;
            wrapper.classList.remove('speaker-popup--no-image');
        } else {
            image.removeAttribute('src');
            image.alt = '';
            image.hidden = true;
            wrapper.classList.add('speaker-popup--no-image');
        }

        overlay.classList.add('speaker-popup-overlay--visible');
        wrapper.classList.add('speaker-popup--visible');
        overlay.setAttribute('aria-hidden', 'false');
        wrapper.setAttribute('aria-hidden', 'false');
        document.body.classList.add('speaker-modal-open');

        if (speakerPopupTarget && speakerPopupTarget !== targetEl && speakerPopupTarget.hasAttribute('aria-expanded')) {
            speakerPopupTarget.setAttribute('aria-expanded', 'false');
        }

        speakerPopupTarget = targetEl;
        if (targetEl && targetEl.hasAttribute('aria-expanded')) {
            targetEl.setAttribute('aria-expanded', 'true');
        }

        requestAnimationFrame(() => {
            if (closeButton && typeof closeButton.focus === 'function') {
                closeButton.focus({ preventScroll: true });
            } else {
                wrapper.focus({ preventScroll: true });
            }
        });
    }

    function hideSpeakerPopup() {
        if (!speakerPopupElements) {
            return;
        }
        const { overlay, wrapper } = speakerPopupElements;
        if (!overlay.classList.contains('speaker-popup-overlay--visible')) {
            return;
        }

        overlay.classList.remove('speaker-popup-overlay--visible');
        wrapper.classList.remove('speaker-popup--visible');
        overlay.setAttribute('aria-hidden', 'true');
        wrapper.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('speaker-modal-open');

        const targetToFocus = speakerPopupTarget;
        const shouldRestoreFocus = targetToFocus?.dataset?.popupRestoreFocus !== 'false';
        speakerPopupTarget = null;

        if (targetToFocus && targetToFocus.hasAttribute('aria-expanded')) {
            targetToFocus.setAttribute('aria-expanded', 'false');
        }

        let focusRestored = false;
        const restoreFocus = () => {
            if (focusRestored) {
                return;
            }
            focusRestored = true;
            if (targetToFocus && targetToFocus.dataset) {
                delete targetToFocus.dataset.popupRestoreFocus;
            }
            if (!targetToFocus) {
                return;
            }
            if (shouldRestoreFocus && typeof targetToFocus.focus === 'function') {
                targetToFocus.focus({ preventScroll: true });
            } else if (!shouldRestoreFocus && typeof targetToFocus.blur === 'function') {
                targetToFocus.blur();
            }
        };

        const fallbackTimer = setTimeout(restoreFocus, 200);
        overlay.addEventListener('transitionend', () => {
            clearTimeout(fallbackTimer);
            restoreFocus();
        }, { once: true });
    }

    function updateSpeakerSessions(container, listEl, titleEl, sessions) {
        if (!container || !listEl) {
            return;
        }

        listEl.innerHTML = '';

        if (!Array.isArray(sessions) || !sessions.length) {
            container.hidden = true;
            return;
        }

        container.hidden = false;
        if (titleEl) {
            const headingLabel = sessions.length > 1 ? 'Talks & Workshops' : 'Talk or Workshop';
            titleEl.textContent = headingLabel;
        }

        sessions.forEach((session) => {
            if (!session) {
                return;
            }
            const item = document.createElement('article');
            item.className = 'speaker-popup-session';
            item.setAttribute('role', 'listitem');

            const header = document.createElement('div');
            header.className = 'speaker-popup-session-header';

            const title = document.createElement('h5');
            title.className = 'speaker-popup-session-title';
            title.textContent = session.title || 'Session';
            header.appendChild(title);

            if (session.typeLabel) {
                const tag = document.createElement('span');
                tag.className = 'speaker-popup-session-tag';
                const iconInfo = getSessionCategoryIconInfo(session.category);
                if (iconInfo) {
                    const icon = document.createElement('img');
                    icon.src = iconInfo.src;
                    icon.alt = '';
                    icon.loading = 'lazy';
                    icon.decoding = 'async';
                    icon.setAttribute('aria-hidden', 'true');
                    icon.className = 'speaker-popup-session-tag-icon';
                    tag.appendChild(icon);
                }
                tag.appendChild(document.createTextNode(session.typeLabel));
                header.appendChild(tag);
            }

            item.appendChild(header);

            const metaParts = [];
            if (session.dayLabel) {
                metaParts.push(session.dayLabel);
            }
            if (session.timeLabel) {
                metaParts.push(session.timeLabel);
            }
            if (metaParts.length) {
                const meta = document.createElement('p');
                meta.className = 'speaker-popup-session-meta';
                meta.textContent = metaParts.join(' · ');
                item.appendChild(meta);
            }

            if (session.venueLabel || session.venueLocation) {
                const venue = document.createElement('p');
                venue.className = 'speaker-popup-session-venue';
                const venueParts = [];
                if (session.venueLabel) {
                    venueParts.push(session.venueLabel);
                }
                if (session.venueLocation && session.venueLocation !== session.venueLabel) {
                    venueParts.push(session.venueLocation);
                }
                venue.textContent = `@ ${venueParts.join(' · ')}`;
                item.appendChild(venue);
            }

            if (Array.isArray(session.coSpeakers) && session.coSpeakers.length) {
                const coLine = document.createElement('p');
                coLine.className = 'speaker-popup-session-co';
                coLine.textContent = `With ${session.coSpeakers.join(', ')}`;
                item.appendChild(coLine);
            }

            const actions = document.createElement('div');
            actions.className = 'speaker-popup-session-actions schedule-actions';

            if (session.startIso) {
                const addButton = document.createElement('button');
                addButton.type = 'button';
                addButton.className = 'schedule-action schedule-add';
                addButton.textContent = 'Add to Calendar';

                const buttonParts = [session.title];
                if (session.timeLabel) {
                    buttonParts.push(session.timeLabel);
                }
                if (session.venueLabel) {
                    buttonParts.push(session.venueLabel);
                }
                addButton.setAttribute('aria-label', `Add ${buttonParts.filter(Boolean).join(' · ')} to your calendar`);

                addButton.addEventListener('click', () => {
                    const timezone = session.timezone || scheduleContext.timezone || FALLBACK_TIMEZONE;
                    const duration = session.durationMinutes
                        || (session.startTime && session.endTime ? Math.max(diffMinutes(session.startTime, session.endTime), 0) : 0)
                        || DEFAULT_CALENDAR_DURATION;
                    const icsContent = buildIcsEvent({
                        summary: session.title,
                        description: session.description,
                        location: session.venueLocation || session.venueLabel || 'Hackaday Supercon',
                        startIso: session.startIso,
                        durationMinutes: duration,
                        dayLabel: session.dayLabel,
                        pageUrl: getCanonicalUrl(),
                        mapUrl: session.venueMapUrl,
                        timezone
                    });
                    const timestampFragment = session.startIso ? session.startIso.replace(/[:T+\-]/g, '') : Date.now();
                    const filename = `${slugify(session.title)}-${timestampFragment}.ics`;
                    downloadIcsFile(filename, icsContent);
                });

                actions.appendChild(addButton);
            }

            if (actions.childElementCount > 0) {
                item.appendChild(actions);
            }

            listEl.appendChild(item);
        });
    }

    function buildHeadshotSlugCandidates(name, fallbackName, primaryPath) {
        const variants = [];
        const addVariant = (value) => {
            if (!value) {
                return;
            }
            const cleaned = value.replace(/[,]+/g, ' ').replace(/\s+/g, ' ').trim();
            if (!cleaned) {
                return;
            }
            if (!variants.includes(cleaned)) {
                variants.push(cleaned);
            }
        };

        if (name) {
            const parenthetical = name.match(/([^()]+)\(([^)]+)\)/);
            if (parenthetical) {
                const inside = parenthetical[2];
                const outside = parenthetical[1];
                addVariant(inside);
                addVariant(outside);
            }
            addVariant(name);
        }

        if (fallbackName && fallbackName !== name) {
            const fallbackParenthetical = fallbackName.match(/([^()]+)\(([^)]+)\)/);
            if (fallbackParenthetical) {
                const inside = fallbackParenthetical[2];
                const outside = fallbackParenthetical[1];
                addVariant(inside);
                addVariant(outside);
            }
            addVariant(fallbackName);
        }

        const primaryStem = extractRemoteFileStem(primaryPath);
        if (primaryStem) {
            addVariant(primaryStem);
        }

        return variants
            .map((variant) => variant.replace(/[()"']/g, '').trim())
            .filter(Boolean)
            .map((variant) => variant.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
            .filter(Boolean);
    }

    function extractRemoteFileStem(url) {
        if (!url) {
            return '';
        }
        try {
            const parsed = new URL(url, window.location.origin);
            const segments = parsed.pathname.split('/').filter(Boolean);
            if (!segments.length) {
                return '';
            }
            const lastSegment = decodeURIComponent(segments[segments.length - 1]);
            if (!lastSegment) {
                return '';
            }
            const [stem] = lastSegment.split('.');
            return stem.replace(/[+_]+/g, ' ').trim();
        } catch (err) {
            return '';
        }
    }

    function formatIsoDateDisplayLocal(dateString) {
        const clean = (dateString || '').toString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
            return '';
        }
        const [year, month, day] = clean.split('-').map(Number);
        if (![year, month, day].every((value) => Number.isFinite(value))) {
            return '';
        }
        const date = new Date(Date.UTC(year, month - 1, day));
        const timezone = scheduleContext?.timezone || FALLBACK_TIMEZONE;
        try {
            return new Intl.DateTimeFormat('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                timeZone: timezone
            }).format(date);
        } catch (error) {
            return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
        }
    }

    function normaliseTimeFormat(value) {
        const raw = (value ?? '').toString().trim().toLowerCase();
        if (!raw) {
            return FALLBACK_TIME_FORMAT;
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
        return FALLBACK_TIME_FORMAT;
    }

    function formatTimeRangeDisplay(startTime, endTime, format = calendarTimeFormat) {
        const resolvedFormat = normaliseTimeFormat(format);
        const start = formatTimeDisplay(startTime, resolvedFormat);
        const end = formatTimeDisplay(endTime, resolvedFormat);
        if (start && end && start !== end) {
            return `${start} – ${end}`;
        }
        return start || '';
    }

    function formatTimeDisplay(time, format) {
        const normalisedTime = normaliseTimeValue(time);
        if (!normalisedTime) {
            return time || '';
        }
        const use24Hour = (format || '').toString().toLowerCase() === '24h';
        if (use24Hour) {
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
        const [hour, minute] = (time || '').split(':').map(Number);
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
        const [startHour, startMinute] = (start || '').split(':').map(Number);
        const [endHour, endMinute] = (end || '').split(':').map(Number);
        if ([startHour, startMinute, endHour, endMinute].some((value) => !Number.isFinite(value))) {
            return 0;
        }
        return (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    }

    function toPositiveInteger(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0) {
            return null;
        }
        return Math.round(number);
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
        const duration = Number.isFinite(parsedDuration) && parsedDuration > 0
            ? parsedDuration
            : DEFAULT_CALENDAR_DURATION;
        const endParts = addMinutesToParts(startParts, duration, timezone);
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
            'PRODID:-//Hackaday Supercon 2025//Program//EN',
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

    function downloadIcsFile(filename, icsContent) {
        if (!icsContent) {
            return;
        }
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

    function formatSpeakerDisplayName(name) {
        if (!name) {
            return '';
        }
        const trimmed = name.replace(/\s+/g, ' ').trim();
        if (!trimmed) {
            return '';
        }
        return trimmed;
    }

    function sanitiseBio(bio) {
        if (!bio) {
            return '';
        }
        return bio.replace(/\s+/g, ' ').trim();
    }

    function extractInitials(name) {
        if (!name) return '';
        const parts = name.split(/\s+/).filter(Boolean);
        if (!parts.length) return '';
        const letters = parts.slice(0, 2).map((part) => part[0].toUpperCase());
        return letters.join('');
    }

})();
