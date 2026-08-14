(function () {
    const canonicalHost = 'norgesbestebygrep.no';
    const legacyHosts = [
        'multiconsult-city-ranking.web.app',
        'multiconsult-city-ranking.firebaseapp.com'
    ];

    if (!legacyHosts.includes(window.location.hostname)) return;

    window.location.replace(
        `https://${canonicalHost}${window.location.pathname}${window.location.search}${window.location.hash}`
    );
}());
