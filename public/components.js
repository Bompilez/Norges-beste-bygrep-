(function () {
    const includeElements = document.querySelectorAll('[data-include]');

    window.siteComponentsReady = Promise.all(Array.from(includeElements, loadInclude))
        .then(() => {
            initializeSiteHeader();
        })
        .catch(() => {});

    async function loadInclude(element) {
        const response = await fetch(element.dataset.include);

        if (!response.ok) {
            throw new Error(`Kunne ikke laste ${element.dataset.include}`);
        }

        const template = document.createElement('template');
        template.innerHTML = (await response.text()).trim();

        const header = template.content.querySelector('.site-header');
        if (header && element.dataset.headerMode === 'static') {
            header.classList.add('site-header--static');
        }

        element.replaceWith(template.content);
    }

    function initializeSiteHeader() {
        const siteHeader = document.querySelector('.site-header');
        const cityNav = document.querySelector('.city-nav');
        const cityNavTrigger = document.querySelector('.city-nav-trigger');
        const cityNavMenu = document.querySelector('.city-nav-menu');
        const cityNavClose = document.querySelector('.city-nav-close');

        window.closeCityNav = closeCityNav;

        updateHeaderBackground();

        cityNavTrigger?.addEventListener('click', () => {
            const isOpen = cityNav?.classList.toggle('is-open');
            cityNavTrigger.setAttribute('aria-expanded', String(Boolean(isOpen)));
            cityNavMenu?.setAttribute('aria-hidden', String(!isOpen));
            document.body.classList.toggle('city-nav-open', Boolean(isOpen));

            if (!isOpen) {
                cityNavTrigger.blur();
            }
        });

        cityNavClose?.addEventListener('click', closeCityNav);

        document.addEventListener('click', (event) => {
            if (!cityNav?.contains(event.target)) {
                closeCityNav();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeCityNav();
            }
        });

        window.addEventListener('scroll', updateHeaderBackground, { passive: true });

        function updateHeaderBackground() {
            siteHeader?.classList.toggle('is-scrolled', window.scrollY > 8);
        }

        function closeCityNav() {
            cityNav?.classList.remove('is-open');
            cityNavTrigger?.setAttribute('aria-expanded', 'false');
            cityNavMenu?.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('city-nav-open');

            if (cityNav?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        }
    }
}());
