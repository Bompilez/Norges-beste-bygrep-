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
const consentVersion = 3;
const metaPixelId = '1688891142036047';
const defaultPreferences = {
    page_views: true,
    city_choices: true,
    submissions: true,
    marketing: true
};

let analyticsInstance = null;
let analyticsReady = Promise.resolve(null);
let consentPreferences = null;
let marketingPixelStarted = false;

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
        if (hasMarketingConsent(consentPreferences)) {
            startMarketingPixel();
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

    const isAccepted = hasAnyAnalyticsConsent(consentPreferences) || hasMarketingConsent(consentPreferences);
    const hasStoredChoice = Boolean(consentPreferences);
    const banner = document.createElement('section');
    banner.className = 'cookie-banner';
    banner.setAttribute('aria-label', 'Informasjon om informasjonskapsler');
    banner.innerHTML = `
        <div class="cookie-banner__content">
            <div class="cookie-banner__text">
                <h2>Får vi bruke valgfrie informasjonskapsler?</h2>
                <p>Hvis du svarer ja, kan vi se hvordan nettsiden brukes og om annonser for kampanjen fungerer. Det hjelper oss å forbedre siden og bruke markedsføringen smartere.</p>
                <p>Du kan når som helst endre samtykket ditt via lenken i bunnmenyen.</p>
                <p>Du kan lese mer om hvordan vi håndterer data i vår <a href="/personvern" rel="noopener">personvernerklæring</a>.</p>
                ${hasStoredChoice ? `<p class="cookie-banner__status">Ditt valg: <strong>${isAccepted ? 'Analyse og markedsføring er tillatt' : 'Analyse og markedsføring er avslått'}</strong></p>` : ''}
            </div>
            <div class="cookie-banner__actions">
                <button class="cookie-banner__button ${hasStoredChoice && isAccepted ? 'is-selected' : ''}" type="button" data-cookie-consent="accept-all" aria-pressed="${hasStoredChoice && isAccepted}">Ja</button>
                <button class="cookie-banner__button cookie-banner__button--secondary ${hasStoredChoice && !isAccepted ? 'is-selected' : ''}" type="button" data-cookie-consent="reject" aria-pressed="${hasStoredChoice && !isAccepted}">Nei</button>
            </div>
        </div>
    `;

    banner.querySelector('[data-cookie-consent="accept-all"]')?.addEventListener('click', () => {
        savePreferences(defaultPreferences);
        closeCookieBanner(banner);
        startAnalytics();
        startMarketingPixel();
    });

    banner.querySelector('[data-cookie-consent="reject"]')?.addEventListener('click', () => {
        savePreferences({
            page_views: false,
            city_choices: false,
            submissions: false,
            marketing: false
        });
        revokeMarketingPixelConsent();
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

        if (storedConsent === legacyAcceptedValue) return null;
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
    return ['page_views', 'city_choices', 'submissions'].some((key) => Boolean(preferences?.[key]));
}

function hasMarketingConsent(preferences) {
    return Boolean(preferences?.marketing);
}

function startMarketingPixel() {
    if (!hasMarketingConsent(consentPreferences)) return;

    if (window.fbq) {
        window.fbq('consent', 'grant');

        if (!marketingPixelStarted) {
            window.fbq('track', 'PageView');
            marketingPixelStarted = true;
        }

        return;
    }

    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('consent', 'grant');
    window.fbq('init', metaPixelId);
    window.fbq('track', 'PageView');
    marketingPixelStarted = true;
}

function revokeMarketingPixelConsent() {
    if (!window.fbq) return;

    window.fbq('consent', 'revoke');
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
