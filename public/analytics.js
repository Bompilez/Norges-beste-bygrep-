import {
    getAnalytics,
    initializeAnalytics,
    isSupported,
    logEvent
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js';
import { getCityRankingFirebaseApp } from './firebase-client.js';

const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const consentStorageKey = 'cityRankingAnalyticsConsent';
const legacyAcceptedValue = 'accepted';
const legacyRejectedValue = 'rejected';
const consentVersion = 2;
const defaultPreferences = {
    page_views: true,
    city_choices: true,
    submissions: true
};

let analyticsInstance = null;
let analyticsReady = Promise.resolve(null);
let consentPreferences = null;

window.siteAnalytics = {
    get ready() {
        return analyticsReady;
    },
    async logEvent(eventName, eventParams = {}) {
        if (!canTrackEvent(eventName)) return;

        const analytics = await analyticsReady;
        if (!analytics) return;

        logEvent(analytics, eventName, withDebugParams(eventParams));
    }
};

initializeCookieConsent();
initializeCookieSettingsLinks();

function initializeCookieConsent() {
    consentPreferences = getStoredPreferences();

    if (consentPreferences) {
        if (hasAnyAnalyticsConsent(consentPreferences)) {
            startAnalytics();
        }
        return;
    }

    showCookieBanner();
}

async function createAnalytics() {
    try {
        if (!(await isSupported())) return null;

        const app = getCityRankingFirebaseApp();
        const analytics = analyticsInstance || initializeAnalytics(app, {
            config: {
                send_page_view: false
            }
        });

        if (canTrackEvent('page_view')) {
            logEvent(analytics, 'page_view', withDebugParams({
                page_location: window.location.href,
                page_path: window.location.pathname,
                page_title: document.title
            }));
        }

        return analytics;
    } catch {
        try {
            return getAnalytics(getCityRankingFirebaseApp());
        } catch {
            return null;
        }
    }
}

function startAnalytics() {
    if (!analyticsInstance) {
        analyticsReady = createAnalytics();
        analyticsReady.then((analytics) => {
            analyticsInstance = analytics;
        });
    }

    return analyticsReady;
}

function showCookieBanner() {
    document.querySelector('.cookie-banner')?.remove();

    const isAccepted = hasAnyAnalyticsConsent(consentPreferences);
    const hasStoredChoice = Boolean(consentPreferences);
    const banner = document.createElement('section');
    banner.className = 'cookie-banner';
    banner.setAttribute('aria-label', 'Informasjon om informasjonskapsler');
    banner.innerHTML = `
        <div class="cookie-banner__content">
            <div class="cookie-banner__text">
                <h2>Informasjonskapsler</h2>
                <p>Vi bruker nødvendige cookies for at siden skal fungere. Med ditt samtykke bruker vi også Google Analytics til anonym statistikk. Vi sender ikke navn, kontaktinfo eller fritekstsvar. <a href="/personvernerklaering.html">Les mer</a>.</p>
                ${hasStoredChoice ? `<p class="cookie-banner__status">Ditt valg: <strong>${isAccepted ? 'Analytics er tillatt' : 'Analytics er avslått'}</strong></p>` : ''}
            </div>
            <div class="cookie-banner__actions">
                <button class="cookie-banner__button cookie-banner__button--secondary ${hasStoredChoice && !isAccepted ? 'is-selected' : ''}" type="button" data-cookie-consent="reject" aria-pressed="${hasStoredChoice && !isAccepted}">Avslå</button>
                <button class="cookie-banner__button ${hasStoredChoice && isAccepted ? 'is-selected' : ''}" type="button" data-cookie-consent="accept-all" aria-pressed="${hasStoredChoice && isAccepted}">Godta alle</button>
            </div>
        </div>
    `;

    banner.querySelector('[data-cookie-consent="accept-all"]')?.addEventListener('click', () => {
        savePreferences(defaultPreferences);
        closeCookieBanner(banner);
        startAnalytics();
    });

    banner.querySelector('[data-cookie-consent="reject"]')?.addEventListener('click', () => {
        savePreferences({
            page_views: false,
            city_choices: false,
            submissions: false
        });
        closeCookieBanner(banner);
    });

    document.body.appendChild(banner);
}

async function initializeCookieSettingsLinks() {
    if (window.siteComponentsReady) {
        await window.siteComponentsReady;
    }

    document.querySelectorAll('[data-open-cookie-settings]').forEach((button) => {
        button.addEventListener('click', () => {
            showCookieBanner();
        });
    });
}

function closeCookieBanner(banner) {
    banner.classList.add('cookie-banner--hidden');
    banner.addEventListener('transitionend', () => banner.remove(), { once: true });
}

function savePreferences(preferences) {
    consentPreferences = normalizePreferences(preferences);
    setStoredPreferences(consentPreferences);
}

function getStoredPreferences() {
    try {
        const storedConsent = localStorage.getItem(consentStorageKey);
        if (!storedConsent) return null;

        if (storedConsent === legacyAcceptedValue) return { ...defaultPreferences };
        if (storedConsent === legacyRejectedValue) {
            return {
                page_views: false,
                city_choices: false,
                submissions: false
            };
        }

        const parsedConsent = JSON.parse(storedConsent);
        if (parsedConsent?.version !== consentVersion) return null;
        return normalizePreferences(parsedConsent.preferences);
    } catch (error) {
        return null;
    }
}

function setStoredPreferences(preferences) {
    try {
        localStorage.setItem(consentStorageKey, JSON.stringify({
            version: consentVersion,
            preferences
        }));
    } catch {}
}

function normalizePreferences(preferences) {
    return Object.fromEntries(Object.keys(defaultPreferences).map((key) => {
        return [key, Boolean(preferences?.[key])];
    }));
}

function hasAnyAnalyticsConsent(preferences) {
    return Object.values(preferences || {}).some(Boolean);
}

function canTrackEvent(eventName) {
    if (!consentPreferences) return false;

    if (eventName === 'page_view') return consentPreferences.page_views;
    if (eventName === 'select_city') return consentPreferences.city_choices;
    if (eventName === 'submit_nomination') return consentPreferences.submissions;

    return hasAnyAnalyticsConsent(consentPreferences);
}

function withDebugParams(eventParams) {
    return isLocalhost ? { ...eventParams, debug_mode: true } : eventParams;
}
