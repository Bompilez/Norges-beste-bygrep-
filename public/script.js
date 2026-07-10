import { getCityRankingFirebaseApp } from './firebase-client.js';
import {
    initializeAppCheck,
    ReCaptchaV3Provider
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app-check.js';
import {
    getFunctions,
    httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';

if (window.siteComponentsReady) {
    await window.siteComponentsReady;
}

const recaptchaSiteKey = '6LfdI_0sAAAAAB6DYhwD03TbNC17Tr3CQd_SyfRQ';
const submissionsClosed = true;
const submissionsClosedMessage = 'Innsendingen av forslag er nå stengt. Takk til alle som har sendt inn bygrep.';

const firebaseApp = getCityRankingFirebaseApp();

if (isRecaptchaSiteKeyConfigured()) {
    initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true
    });
}

const functions = getFunctions(firebaseApp, 'europe-west1');
const submitVote = httpsCallable(functions, 'submitVote');

const cityNameButtons = document.querySelectorAll('.city-name-button');
const cityNameDetails = document.querySelectorAll('.city-name-details');
const cityNameGroups = document.querySelectorAll('.city-names, .city-card');
const cityNavOptions = document.querySelectorAll('.city-nav-option');
const cityNavMobileMedia = window.matchMedia('(max-width: 48rem)');
const submitButtons = document.querySelectorAll('.submit-button');
const giveawayCheckboxes = document.querySelectorAll('.giveaway-checkbox');
const cityIllustrations = [
    {
        src: '/illustrations/Oslo.svg',
        alt: 'Illustrasjon av byrom, gater og bygninger i Oslo.'
    },
    {
        src: '/illustrations/Trondheim.svg',
        alt: 'Illustrasjon av byrom, gater og bygninger i Trondheim.'
    },
    {
        src: '/illustrations/Fredrikstad-Sarpsborg.svg',
        alt: 'Illustrasjon av byrom, gater og bygninger i Fredrikstad og Sarpsborg.'
    },
    {
        src: '/illustrations/Drammen.svg',
        alt: 'Illustrasjon av byrom, gater og bygninger i Drammen.'
    },
    {
        src: '/illustrations/Kristiansand.svg',
        alt: 'Illustrasjon av byrom, gater og bygninger i Kristiansand.'
    },
    {
        src: '/illustrations/Stavanger-Sandnes.svg',
        alt: 'Illustrasjon av byrom, gater og bygninger i Sandnes og Stavanger.'
    },
    {
        src: '/illustrations/Bergen.svg',
        alt: 'Illustrasjon av byrom, gater og bygninger i Bergen.'
    },
    {
        src: '/illustrations/Skien-Porsgrunn.svg',
        alt: 'Illustrasjon av byrom, gater og bygninger i Skien og Porsgrunn.'
    },
    {
        src: '/illustrations/Tromsø.svg',
        alt: 'Illustrasjon av byrom, gater og bygninger i Tromsø.'
    }
];

syncCityIllustrationAccessibility();
initializeCityIllustrationRotator();
syncCheckboxLabels();
syncCityFormAccessibility();
initializeClosedSubmissionState();
initializeAnimatedPanels();
openCityFromHash();
initializeCityNavActiveTracking();

cityNameDetails.forEach((details) => {
    updateCityConceptLabel(details);
});

cityNameButtons.forEach((button, index) => {
    button.setAttribute('aria-expanded', String(cityNameDetails[index]?.classList.contains('open')));

    button.addEventListener('click', () => {
        trackCityEvent(index, 'city_button', cityNameDetails[index]?.classList.contains('open') ? 'close' : 'open');
        toggleCityDetails(index);
    });
});

cityNavOptions.forEach((button) => {
    button.addEventListener('click', (event) => {
        if (button.dataset.cityIndex === undefined) return;

        event.preventDefault();
        const cityIndex = Number(button.dataset.cityIndex);
        trackCityEvent(cityIndex, 'header_nav', 'open');
        window.closeCityNav?.();
        const target = getHashTarget(button.getAttribute('href'));
        if (target?.classList.contains('city-card')) {
            scrollToElement(target);
            setActiveCityNavOption(cityIndex, true);
            return;
        }

        openCityDetails(cityIndex, true);

    });
});

window.addEventListener('hashchange', openCityFromHash);

function toggleCityDetails(index) {
    const details = cityNameDetails[index];
    if (!details) return;

    const shouldOpen = !details.classList.contains('open');
    setAllCityDetailsClosed();

    if (shouldOpen) {
        setCityDetailsOpen(index, true);
    }
}

function openCityDetails(index, shouldScroll = false) {
    if (!cityNameDetails[index]) return;

    setAllCityDetailsClosed();
    setCityDetailsOpen(index, true);

    if (shouldScroll) {
        scrollToCity(index);
    }
}

function scrollToCity(index) {
    const cityButton = cityNameButtons[index];
    if (!cityButton) return;

    scrollToElement(cityButton);
}

function scrollToElement(element) {
    if (!element) return;

    requestAnimationFrame(() => {
        const headerOffset = getFixedHeaderOffset();
        const top = element.getBoundingClientRect().top + window.scrollY - headerOffset;

        window.scrollTo({
            top: Math.max(0, top),
            behavior: 'smooth'
        });
    });
}

function getHashTarget(url) {
    const hash = String(url || '').split('#')[1];
    return hash ? document.getElementById(hash) : null;
}

function getFixedHeaderOffset() {
    const header = document.querySelector('.site-header');
    const headerHeight = header?.classList.contains('site-header--static')
        ? 0
        : header?.getBoundingClientRect().height || 0;

    return headerHeight + 16;
}

function openCityFromHash() {
    const cityIndexByHash = {
        '#city-oslo': 0,
        '#city-trondheim': 1,
        '#city-fredrikstad-sarpsborg': 2,
        '#city-drammen': 3,
        '#city-kristiansand': 4,
        '#city-sandnes-stavanger': 5,
        '#city-skien-porsgrunn': 6,
        '#city-bergen': 7,
        '#city-tromso': 8
    };
    const cityIndex = cityIndexByHash[window.location.hash];

    if (cityIndex === undefined) return;

    const target = document.getElementById(window.location.hash.slice(1));
    if (target?.classList.contains('city-card')) {
        setActiveCityNavOption(cityIndex, true);
        return;
    }

    openCityDetails(cityIndex, false);
}

function setAllCityDetailsClosed() {
    cityNameDetails.forEach((details, index) => {
        setCityDetailsOpen(index, false);
    });
}

function setCityDetailsOpen(index, isOpen) {
    const details = cityNameDetails[index];
    if (!details) return;

    if (isOpen) {
        updateCityConceptLabel(details);
    }

    setPanelOpen(details, isOpen);
    cityNameButtons[index]?.setAttribute('aria-expanded', String(isOpen));
    setActiveCityNavOption(index, isOpen);
}

function setActiveCityNavOption(index, isActive) {
    if (!cityNavMobileMedia.matches) {
        clearActiveCityNavOption();
        return;
    }

    cityNavOptions.forEach((option) => {
        const shouldActivate = isActive && Number(option.dataset.cityIndex) === index;
        option.classList.toggle('is-active', shouldActivate);
        option.toggleAttribute('aria-current', shouldActivate);
    });
}

function clearActiveCityNavOption() {
    cityNavOptions.forEach((option) => {
        option.classList.remove('is-active');
        option.removeAttribute('aria-current');
    });
}

function initializeCityNavActiveTracking() {
    const cityCardNavTargets = Array.from(cityNavOptions)
        .map((option) => ({
            index: Number(option.dataset.cityIndex),
            target: getHashTarget(option.getAttribute('href'))
        }))
        .filter(({ index, target }) => Number.isFinite(index) && target?.classList.contains('city-card'));

    if (!cityCardNavTargets.length) return;

    let ticking = false;

    const queueUpdate = () => {
        if (ticking) return;

        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            updateActiveCityNavFromScroll(cityCardNavTargets);
        });
    };

    window.addEventListener('scroll', queueUpdate, { passive: true });
    window.addEventListener('resize', queueUpdate);
    cityNavMobileMedia.addEventListener?.('change', queueUpdate);
    queueUpdate();
}

function updateActiveCityNavFromScroll(cityCardNavTargets) {
    if (!cityNavMobileMedia.matches) {
        clearActiveCityNavOption();
        return;
    }

    const headerOffset = getFixedHeaderOffset();
    const referenceY = headerOffset + (window.innerHeight - headerOffset) * 0.35;
    const activeTarget = cityCardNavTargets.find(({ target }) => {
        const rect = target.getBoundingClientRect();
        return rect.top <= referenceY && rect.bottom >= referenceY;
    });

    if (!activeTarget) {
        clearActiveCityNavOption();
        return;
    }

    setActiveCityNavOption(activeTarget.index, true);
}

function setPanelOpen(panel, isOpen) {
    if (!panel) return;

    const wasOpen = panel.classList.contains('open');

    if (isOpen) {
        panel.classList.remove('close');
        updatePanelHeight(panel);
        panel.classList.add('open');
    } else {
        if (wasOpen) {
            updatePanelHeight(panel);
            void panel.offsetHeight;
        }

        panel.classList.remove('open');
        panel.classList.add('close');
    }

    setPanelInteractivity(panel, isOpen);
    updateOpenAncestorPanelHeights(panel);
    requestAnimationFrame(() => updateOpenAncestorPanelHeights(panel));
}

function initializeAnimatedPanels() {
    const panels = document.querySelectorAll('.city-name-details, .giveaway-details');

    panels.forEach((panel) => {
        updatePanelHeight(panel);
        setPanelInteractivity(panel, panel.classList.contains('open'));
    });

    if (!('ResizeObserver' in window)) return;

    const resizeObserver = new ResizeObserver((entries) => {
        entries.forEach(({ target }) => {
            if (target.classList.contains('open')) {
                updatePanelHeight(target);
                updateOpenAncestorPanelHeights(target);
            }
        });
    });

    panels.forEach((panel) => {
        resizeObserver.observe(panel);
    });
}

function updatePanelHeight(panel) {
    panel.style.setProperty('--panel-open-height', `${panel.scrollHeight}px`);
}

function updateOpenAncestorPanelHeights(panel) {
    const ancestorPanel = panel.parentElement?.closest('.city-name-details.open');
    if (!ancestorPanel) return;

    updatePanelHeight(ancestorPanel);
}

function setPanelInteractivity(panel, isOpen) {
    panel.setAttribute('aria-hidden', String(!isOpen));

    if ('inert' in panel) {
        panel.inert = !isOpen;
    }
}

function updateCityConceptLabel(detailsContainer) {
    const label = detailsContainer.querySelector('.city-concept-label');
    if (!label) return;

    label.textContent = 'Skriv inn bygrepet du ønsker å fremheve:';
}

function syncCheckboxLabels() {
    document.querySelectorAll('.giveaway-checkbox-container, .consent-container').forEach((container, index) => {
        const checkbox = container.querySelector('input[type="checkbox"]');
        const label = container.querySelector('label');
        if (!checkbox || !label) return;

        const checkboxId = checkbox.id || `checkbox-${index + 1}`;
        checkbox.id = checkboxId;
        checkbox.removeAttribute('aria-label');
        label.htmlFor = checkboxId;
    });
}

function syncCityIllustrationAccessibility() {
    const images = document.querySelectorAll('.city-illustration-image');
    images.forEach((image, index) => {
        setIllustrationImageState(image, cityIllustrations[index] || null, image.classList.contains('is-active'));
    });
}

function initializeCityIllustrationRotator() {
    const container = document.querySelector('.city-illustration');
    const images = container?.querySelectorAll('.city-illustration-image');

    if (!container || !images || images.length < 2 || cityIllustrations.length < 2) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let currentIndex = 0;
    let activeImage = images[0];
    let inactiveImage = images[1];
    let rotationTimeout = null;

    cityIllustrations.slice(1).forEach(({ src }) => preloadImage(src));

    const rotateIllustration = () => {
        const nextIndex = (currentIndex + 1) % cityIllustrations.length;
        const nextIllustration = cityIllustrations[nextIndex];

        setIllustrationImageState(inactiveImage, nextIllustration, false);
        waitForImage(inactiveImage).finally(() => {
            inactiveImage.classList.add('is-active');
            activeImage.classList.remove('is-active');
            setIllustrationImageState(inactiveImage, nextIllustration, true);
            setIllustrationImageState(activeImage, cityIllustrations[currentIndex], false);

            [activeImage, inactiveImage] = [inactiveImage, activeImage];
            currentIndex = nextIndex;
            preloadImage(cityIllustrations[(currentIndex + 1) % cityIllustrations.length].src);
            scheduleRotation();
        });
    };

    const scheduleRotation = () => {
        window.clearTimeout(rotationTimeout);
        if (document.hidden) return;
        rotationTimeout = window.setTimeout(rotateIllustration, 6500);
    };

    document.addEventListener('visibilitychange', scheduleRotation);
    scheduleRotation();
}

function setIllustrationImageState(image, illustration, isVisibleToAssistiveTech) {
    if (!image) return;

    if (illustration?.src && image.getAttribute('src') !== illustration.src) {
        image.src = illustration.src;
    }

    image.alt = isVisibleToAssistiveTech ? illustration?.alt || '' : '';
    image.toggleAttribute('aria-hidden', !isVisibleToAssistiveTech);
}

function preloadImage(source) {
    const image = new Image();
    image.src = source;
}

function waitForImage(image) {
    if (image.complete) return Promise.resolve();
    if (typeof image.decode === 'function') {
        return image.decode().catch(() => {});
    }

    return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
    });
}

function syncCityFormAccessibility() {
    cityNameGroups.forEach((cityContainer, index) => {
        const cityId = cityContainer.id || `city-${index + 1}`;
        const cityName = sanitizeInput(cityNameButtons[index]?.textContent || '');
        const button = cityNameButtons[index];
        const details = cityNameDetails[index];

        if (!button || !details || !cityName) return;

        button.id = button.id || `${cityId}-button`;
        details.id = details.id || `${cityId}-form`;
        button.setAttribute('aria-controls', details.id);
        button.setAttribute('aria-label', `Åpne nominasjonsskjema for ${cityName}`);
        details.setAttribute('role', 'region');
        details.setAttribute('aria-labelledby', button.id);
        details.setAttribute('aria-hidden', String(!details.classList.contains('open')));

        const conceptLabel = details.querySelector('.city-concept-label');
        const conceptInput = details.querySelector('.city-concept-input');
        setInputLabel(conceptInput, conceptLabel, `${cityId}-concept`, {
            required: true,
            autocomplete: 'off'
        });

        const reasonInput = details.querySelector('.city-concept-reason-input');
        const reasonLabel = reasonInput?.previousElementSibling?.querySelector('p');
        setInputLabel(reasonInput, reasonLabel, `${cityId}-reason`, {
            autocomplete: 'off'
        });

        const giveawayContainer = details.querySelector('.giveaway-container');
        const giveawayTitle = giveawayContainer?.querySelector('h3');
        const giveawayHelp = giveawayContainer?.querySelector('p');
        const giveawayDetails = details.querySelector('.giveaway-details');
        const giveawayCheckbox = details.querySelector('.giveaway-checkbox');

        if (giveawayTitle) {
            giveawayTitle.id = giveawayTitle.id || `${cityId}-giveaway-title`;
        }

        if (giveawayHelp) {
            giveawayHelp.id = giveawayHelp.id || `${cityId}-giveaway-help`;
        }

        if (giveawayDetails) {
            giveawayDetails.id = giveawayDetails.id || `${cityId}-giveaway-details`;
            giveawayDetails.setAttribute('role', 'group');
            giveawayDetails.setAttribute('aria-label', `Kontaktinformasjon for gavekorttrekning i ${cityName}`);
            giveawayDetails.setAttribute('aria-hidden', String(!giveawayDetails.classList.contains('open')));
        }

        if (giveawayCheckbox) {
            giveawayCheckbox.setAttribute('aria-controls', giveawayDetails?.id || '');
            giveawayCheckbox.setAttribute('aria-expanded', String(Boolean(giveawayCheckbox.checked)));
            if (giveawayHelp?.id) {
                addDescribedBy(giveawayCheckbox, giveawayHelp.id);
            }
        }

        const nameInput = details.querySelector('.giveaway-name-input');
        const nameLabel = nameInput?.previousElementSibling?.querySelector('p');
        setInputLabel(nameInput, nameLabel, `${cityId}-name`, {
            required: true,
            autocomplete: 'name'
        });

        const emailInput = details.querySelector('.giveaway-email-input');
        const emailLabel = emailInput?.previousElementSibling?.querySelector('p');
        setInputLabel(emailInput, emailLabel, `${cityId}-email`, {
            required: true,
            autocomplete: 'email'
        });

        const giveawayInfo = details.querySelector('.giveaway-info-text p');
        if (giveawayInfo) {
            giveawayInfo.id = giveawayInfo.id || `${cityId}-giveaway-info`;
        }

        const consentCheckbox = details.querySelector('.data-consent-checkbox');
        if (consentCheckbox && giveawayInfo?.id) {
            addDescribedBy(consentCheckbox, giveawayInfo.id);
        }

        const submitButton = details.querySelector('.submit-button');
        submitButton?.setAttribute('aria-label', `Send inn nominert bygrep for ${cityName}`);
    });
}

function setInputLabel(input, labelElement, idBase, options = {}) {
    if (!input || !labelElement) return;

    labelElement.id = labelElement.id || `${idBase}-label`;
    input.id = input.id || idBase;
    input.removeAttribute('aria-label');
    input.setAttribute('aria-labelledby', labelElement.id);

    if (options.required) {
        input.required = true;
        input.setAttribute('aria-required', 'true');
    }

    if (options.autocomplete) {
        input.autocomplete = options.autocomplete;
    }
}

function initializeClosedSubmissionState() {
    if (!submissionsClosed) return;

    cityNameDetails.forEach((details) => {
        const cityName = getSelectedCity(details);
        details.querySelectorAll('input, .submit-button').forEach((element) => {
            element.disabled = true;
            element.setAttribute('aria-disabled', 'true');
        });

        [
            '.city-name-details-text',
            '.city-name-reason-container',
            '.giveaway-container',
            '.giveaway-details',
            '.submit-button-container'
        ].forEach((selector) => {
            details.querySelector(selector)?.classList.add('submission-closed-hidden');
        });

        const existingNotice = details.querySelector('.submission-closed-message');
        const notice = existingNotice || document.createElement('div');
        notice.className = 'submission-closed-message';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.innerHTML = `
            <h3>Innsendingen er stengt${cityName ? ` for ${cityName}` : ''}</h3>
            <p>${submissionsClosedMessage}</p>
        `;

        if (!existingNotice) {
            details.prepend(notice);
        }
    });
}

giveawayCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
        const giveawayDetails = checkbox.closest('.city-name-details')?.querySelector('.giveaway-details');
        if (!giveawayDetails) return;
        const isOpen = checkbox.checked;
        setPanelOpen(giveawayDetails, isOpen);
        checkbox.setAttribute('aria-expanded', String(isOpen));
    });
});

submitButtons.forEach((button) => {
    button.addEventListener('click', handleSubmit);
});

async function handleSubmit(event) {
    event.preventDefault();
    const submitButton = event.currentTarget;
    const detailsContainer = submitButton.closest('.city-name-details');
    if (!detailsContainer) return;

    if (submissionsClosed) {
        showFailure(detailsContainer, submissionsClosedMessage);
        return;
    }

    clearErrors(detailsContainer);
    removeStatusMessage(detailsContainer);

    const cityInput = detailsContainer.querySelector('.city-concept-input');
    const reasonInput = detailsContainer.querySelector('.city-concept-reason-input');
    const giveawayCheckbox = detailsContainer.querySelector('.giveaway-checkbox');
    const nameInput = detailsContainer.querySelector('.giveaway-name-input');
    const emailInput = detailsContainer.querySelector('.giveaway-email-input');
    const consentCheckbox = detailsContainer.querySelector('.data-consent-checkbox');
    const wantsGiveaway = Boolean(giveawayCheckbox && giveawayCheckbox.checked);

    let isValid = true;

    if (!cityInput || !validateText(cityInput.value)) {
        showError(cityInput, 'Skriv inn bygrepet du vil fremheve.');
        isValid = false;
    } else {
        cityInput.value = sanitizeInput(cityInput.value);
    }

    if (reasonInput) {
        reasonInput.value = sanitizeInput(reasonInput.value);
    }

    if (wantsGiveaway) {
        if (!nameInput || !validateText(nameInput.value)) {
            showError(nameInput, 'Skriv inn ditt fulle navn.');
            isValid = false;
        } else {
            nameInput.value = sanitizeInput(nameInput.value);
        }

        if (!emailInput || !validateEmail(emailInput.value)) {
            showError(emailInput, 'Skriv inn en gyldig e-postadresse.');
            isValid = false;
        } else {
            emailInput.value = sanitizeInput(emailInput.value.toLowerCase());
        }

        if (!consentCheckbox || !consentCheckbox.checked) {
            showError(consentCheckbox || giveawayCheckbox, 'Du må godta at opplysningene lagres før du sender inn.');
            isValid = false;
        }
    } else if (consentCheckbox) {
        consentCheckbox.checked = false;
    }

    if (!isValid) {
        showFailure(detailsContainer, 'Fyll ut alle påkrevde felt før du sender inn.');
        focusFirstInvalidField(detailsContainer);
        return;
    }

    const vote = buildVotePayload(detailsContainer, {
        cityConcept: cityInput.value,
        cityConceptReason: reasonInput ? reasonInput.value : '',
        wantsGiveaway,
        fullName: nameInput ? nameInput.value : '',
        email: emailInput ? emailInput.value : '',
        consentGiven: wantsGiveaway
    });

    setSubmitState(submitButton, true);

    try {
        await saveVote(vote);
        trackAnalyticsEvent('submit_nomination', {
            city_name: vote.city,
            wants_giveaway: vote.wantsGiveaway
        });
        resetForm(detailsContainer);
        showSuccess(detailsContainer, 'Takk! Forslaget ditt er sendt inn.');
    } catch (error) {
        if (error.code === 'functions/resource-exhausted') {
            showFailure(detailsContainer, 'Du har sendt inn mange forslag i dag. Prøv igjen i morgen.');
        } else if (error.code === 'functions/already-exists') {
            showFailure(detailsContainer, 'Kontaktinformasjonen er allerede brukt i trekningen.');
        } else if (error.code === 'functions/invalid-argument' || error.code === 'functions/failed-precondition') {
            showFailure(detailsContainer, error.message || 'Fyll ut alle påkrevde felt før du sender inn.');
        } else {
            showFailure(detailsContainer, 'Noe gikk galt ved innsending. Prøv igjen om litt.');
        }
    } finally {
        setSubmitState(submitButton, false);
    }
}

function buildVotePayload(detailsContainer, formValues) {
    return {
        city: getSelectedCity(detailsContainer),
        cityConcept: formValues.cityConcept,
        cityConceptReason: formValues.cityConceptReason,
        wantsGiveaway: formValues.wantsGiveaway,
        fullName: formValues.wantsGiveaway ? formValues.fullName : '',
        email: formValues.wantsGiveaway ? formValues.email : '',
        consentGiven: formValues.consentGiven,
        browserId: getOrCreateSubmissionBrowserId()
    };
}

async function saveVote(vote) {
    await submitVote(vote);
}

function trackCityEvent(index, source, action) {
    const cityContainer = cityNameGroups[index];
    const cityName = sanitizeInput(cityNameButtons[index]?.textContent || '');
    if (!cityContainer || !cityName) return;

    trackAnalyticsEvent('select_city', {
        city_id: cityContainer.id,
        city_name: cityName,
        source,
        action
    });
}

function trackAnalyticsEvent(eventName, eventParams = {}) {
    try {
        window.siteAnalytics?.logEvent(eventName, eventParams)?.catch(() => {});
    } catch {}
}

function getOrCreateSubmissionBrowserId() {
    const storageKey = 'cityRankingSubmissionBrowserId';
    try {
        const existingId = localStorage.getItem(storageKey);
        if (existingId) return existingId;

        const newId = crypto.randomUUID();
        localStorage.setItem(storageKey, newId);
        return newId;
    } catch {}

    const newId = crypto.randomUUID();
    return newId;
}

function getSelectedCity(detailsContainer) {
    const cityContainer = detailsContainer.closest('.city-names');
    const cityButtonText = cityContainer?.querySelector('.city-name-button')?.textContent;
    return sanitizeInput(cityButtonText || '');
}

function validateText(value) {
    return typeof value === 'string' && value.trim().length >= 2;
}

function validateEmail(value) {
    const email = String(value).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeInput(value) {
    return String(value)
        .replace(/<[^>]*>/g, '')
        .replace(/[\u2028\u2029]/g, ' ')
        .trim();
}

function showError(input, message) {
    if (!input) return;
    input.classList.add('invalid');
    input.setAttribute('aria-invalid', 'true');

    const checkboxContainer = input.matches('input[type="checkbox"]')
        ? input.closest('.giveaway-checkbox-container, .consent-container')
        : null;
    const errorTarget = checkboxContainer || input;

    let errorElement = errorTarget.nextElementSibling;
    if (!errorElement || !errorElement.classList.contains('field-error')) {
        errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorTarget.parentNode.insertBefore(errorElement, errorTarget.nextSibling);
    }
    errorElement.id = errorElement.id || `${input.id || 'field'}-error`;
    errorElement.setAttribute('role', 'alert');
    errorElement.classList.toggle('field-error--checkbox', Boolean(checkboxContainer));
    errorElement.textContent = message;
    addDescribedBy(input, errorElement.id);
}

function clearErrors(container) {
    const invalidFields = container.querySelectorAll('.invalid');
    invalidFields.forEach((field) => {
        field.classList.remove('invalid');
        field.removeAttribute('aria-invalid');
    });

    const errorMessages = container.querySelectorAll('.field-error');
    errorMessages.forEach((message) => {
        if (message.id) {
            container.querySelectorAll(`[aria-describedby~="${message.id}"]`).forEach((field) => {
                removeDescribedBy(field, message.id);
            });
        }
        message.remove();
    });
}

function showSuccess(container, message) {
    const existing = container.querySelector('.success-message');
    if (existing) {
        existing.textContent = message;
        return;
    }
    const successElement = document.createElement('div');
    successElement.className = 'success-message';
    successElement.setAttribute('role', 'status');
    successElement.setAttribute('aria-live', 'polite');
    successElement.textContent = message;
    container.appendChild(successElement);
}

function showFailure(container, message) {
    const existing = container.querySelector('.error-message');
    if (existing) {
        existing.textContent = message;
        return;
    }
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.setAttribute('role', 'alert');
    errorElement.textContent = message;
    container.appendChild(errorElement);
}

function focusFirstInvalidField(container) {
    const firstInvalid = container.querySelector('.invalid');
    if (!firstInvalid) return;

    updatePanelHeight(container);
    updateOpenAncestorPanelHeights(container);

    const errorTarget = firstInvalid.matches('input[type="checkbox"]')
        ? firstInvalid.closest('.giveaway-checkbox-container, .consent-container') || firstInvalid
        : firstInvalid;
    const fieldError = errorTarget.nextElementSibling?.classList.contains('field-error')
        ? errorTarget.nextElementSibling
        : null;
    const scrollTarget = fieldError || firstInvalid;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.requestAnimationFrame(() => {
        scrollTarget.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'center'
        });
        firstInvalid.focus({ preventScroll: true });
    });
}

function removeStatusMessage(container) {
    const statusMessages = container.querySelectorAll('.success-message, .error-message');
    statusMessages.forEach((status) => status.remove());
}

function setSubmitState(button, isSubmitting) {
    if (!button) return;
    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? 'Sender...' : 'Send';
}

function resetForm(container) {
    const inputs = container.querySelectorAll('input');
    inputs.forEach((input) => {
        if (input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });

    const giveawayDetails = container.querySelector('.giveaway-details');
    if (giveawayDetails) {
        setPanelOpen(giveawayDetails, false);
    }
}

const allInputs = document.querySelectorAll('input');
allInputs.forEach((input) => {
    input.addEventListener('input', () => {
        if (input.classList.contains('invalid')) {
            input.classList.remove('invalid');
            input.removeAttribute('aria-invalid');
            const checkboxContainer = input.matches('input[type="checkbox"]')
                ? input.closest('.giveaway-checkbox-container, .consent-container')
                : null;
            const next = (checkboxContainer || input).nextElementSibling;
            if (next && next.classList.contains('field-error')) {
                if (next.id) {
                    removeDescribedBy(input, next.id);
                }
                next.remove();
            }
        }
    });
});

function addDescribedBy(element, id) {
    if (!element || !id) return;

    const ids = new Set((element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add(id);
    element.setAttribute('aria-describedby', Array.from(ids).join(' '));
}

function removeDescribedBy(element, id) {
    if (!element || !id) return;

    const ids = (element.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((existingId) => existingId && existingId !== id);

    if (ids.length) {
        element.setAttribute('aria-describedby', ids.join(' '));
    } else {
        element.removeAttribute('aria-describedby');
    }
}

function isRecaptchaSiteKeyConfigured() {
    return recaptchaSiteKey.trim().length > 0
        && !recaptchaSiteKey.startsWith('PASTE_');
}
