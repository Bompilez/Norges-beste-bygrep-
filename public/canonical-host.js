(function () {
    var canonicalHost = 'norgesbestebygrep.no';
    var legacyHosts = [
        'multiconsult-city-ranking.web.app',
        'multiconsult-city-ranking.firebaseapp.com'
    ];

    if (legacyHosts.indexOf(window.location.hostname) === -1) return;

    window.location.replace(
        'https://' + canonicalHost + window.location.pathname + window.location.search + window.location.hash
    );
}());
