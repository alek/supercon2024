/**
 * Main Script
 * Handles UI stuff and control over it
 */



// Mobile Navigation Menu
(function initMobileNav() {
    // Wait for DOM to be ready
    function setup() {
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu:not(.nav-menu--mobile)');
        const navLinks = document.querySelectorAll('.nav-menu__link');
        
        if (!navToggle || !navMenu) {
            // Retry if elements not found
            setTimeout(setup, 100);
            return;
        }
        
        // Create mobile menu container
        const mobileMenu = document.createElement('nav');
        mobileMenu.className = 'nav-menu nav-menu--mobile';
        
        // Clone navigation links for mobile menu
        navLinks.forEach((link) => {
            const clone = link.cloneNode(true);
            mobileMenu.appendChild(clone);
        });
        
        document.body.appendChild(mobileMenu);
        
        // Toggle mobile menu
        navToggle.addEventListener('click', () => {
            const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
            navToggle.setAttribute('aria-expanded', !isOpen);
            mobileMenu.classList.toggle('nav-menu--open', !isOpen);
        });
        
        // Close menu when clicking on a link
        mobileMenu.querySelectorAll('.nav-menu__link').forEach((link) => {
            link.addEventListener('click', () => {
                navToggle.setAttribute('aria-expanded', 'false');
                mobileMenu.classList.remove('nav-menu--open');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const isMenuOpen = mobileMenu.classList.contains('nav-menu--open');
            if (isMenuOpen && !mobileMenu.contains(e.target) && !navToggle.contains(e.target)) {
                navToggle.setAttribute('aria-expanded', 'false');
                mobileMenu.classList.remove('nav-menu--open');
            }
        });
        
        // Close menu on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenu.classList.contains('nav-menu--open')) {
                navToggle.setAttribute('aria-expanded', 'false');
                mobileMenu.classList.remove('nav-menu--open');
            }
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
})();




function setupScrollAnchors() {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return;
    }

    const scrollTargets = document.querySelectorAll('[data-scroll-top]');
    if (!scrollTargets.length) {
        return;
    }

    const handleClick = (event) => {
        if (event) {
            event.preventDefault();
        }
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const options = prefersReducedMotion ? { top: 0 } : { top: 0, behavior: 'smooth' };
        try {
            window.scrollTo(options);
        } catch (_error) {
            window.scrollTo(0, 0);
        }
    };

    scrollTargets.forEach((target) => {
        target.addEventListener('click', handleClick);
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupScrollAnchors);
    } else {
        setupScrollAnchors();
    }
}




