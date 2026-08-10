/* Cookie-Consent (DSGVO / TTDSG) — zentrale Logik für alle Seiten von laura-schunke.de.
   Voraussetzung im <head> jeder Seite (bleibt dort inline, siehe CLAUDE.md):
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('consent','default',{...alles denied...});
   und im <body>: <div id="cookie-consent-root"></div>
*/
(function () {
  'use strict';

  var GA_MEASUREMENT_ID = 'G-N5QS7J486N';
  // TODO: sobald Ibnu die Google-Ads-Werte liefert, hier eintragen und im
  // Marketing-Zweig von applyConsent() per gtag('config', AW_CONVERSION_ID) einhängen.
  var AW_CONVERSION_ID = null;

  var STORAGE_KEY = 'cookieConsentV2';
  var STATISTICS_COOKIE_PREFIXES = ['_ga'];
  var MARKETING_COOKIE_PREFIXES = ['_gcl', 'IDE', 'test_cookie'];

  var gaScriptLoaded = false;

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (typeof parsed.statistics !== 'boolean' || typeof parsed.marketing !== 'boolean') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveState(statistics, marketing) {
    var state = { necessary: true, statistics: statistics, marketing: marketing, timestamp: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    return state;
  }

  function eraseCookiesByPrefixes(prefixes) {
    var pairs = document.cookie.split(';');
    for (var i = 0; i < pairs.length; i++) {
      var name = pairs[i].split('=')[0].trim();
      if (!name) continue;
      for (var j = 0; j < prefixes.length; j++) {
        if (name.indexOf(prefixes[j]) === 0) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + location.hostname + ';';
        }
      }
    }
  }

  function loadGaScript() {
    if (gaScriptLoaded) return;
    gaScriptLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
    if (AW_CONVERSION_ID) gtag('config', AW_CONVERSION_ID);
  }

  function applyConsent(state) {
    gtag('consent', 'update', {
      analytics_storage: state.statistics ? 'granted' : 'denied',
      ad_storage: state.marketing ? 'granted' : 'denied',
      ad_user_data: state.marketing ? 'granted' : 'denied',
      ad_personalization: state.marketing ? 'granted' : 'denied'
    });

    if (state.statistics || state.marketing) {
      loadGaScript();
    }
    if (!state.statistics) eraseCookiesByPrefixes(STATISTICS_COOKIE_PREFIXES);
    if (!state.marketing) eraseCookiesByPrefixes(MARKETING_COOKIE_PREFIXES);
  }

  var TEMPLATE =
    '<div class="cc-banner" id="ccBanner" role="dialog" aria-live="polite" aria-label="Cookie-Hinweis">' +
      '<p class="cc-banner-text">Ich verwende auf dieser Seite einige Cookies – die notwendigen immer, alle anderen nur mit deiner Zustimmung. Du kannst deine Auswahl jederzeit anpassen. Mehr in der <a href="/datenschutz.html">Datenschutzerklärung</a>.</p>' +
      '<div class="cc-banner-actions">' +
        '<button type="button" class="cc-btn cc-btn-ghost" data-cc-action="settings">Einstellungen</button>' +
        '<button type="button" class="cc-btn cc-btn-outline" data-cc-action="reject-all">Alle ablehnen</button>' +
        '<button type="button" class="cc-btn cc-btn-primary" data-cc-action="accept-all">Alle akzeptieren</button>' +
      '</div>' +
    '</div>' +
    '<div class="cc-overlay" id="ccOverlay" hidden></div>' +
    '<div class="cc-panel" id="ccPanel" role="dialog" aria-modal="true" aria-label="Cookie-Einstellungen verwalten" hidden>' +
      '<div class="cc-panel-inner">' +
        '<h2 class="cc-panel-title">Cookie-Einstellungen</h2>' +
        '<p class="cc-panel-intro">Wähle aus, welche Kategorien du zulassen möchtest. Notwendige Cookies lassen sich nicht deaktivieren.</p>' +
        '<div class="cc-category">' +
          '<div class="cc-category-head">' +
            '<span class="cc-category-title">Notwendig</span>' +
            '<span class="cc-toggle cc-toggle-locked" aria-hidden="true"><span class="cc-toggle-knob"></span></span>' +
          '</div>' +
          '<p class="cc-category-desc">Erforderlich, damit die Seite funktioniert, z. B. um deine Cookie-Auswahl zu speichern. Immer aktiv.</p>' +
        '</div>' +
        '<div class="cc-category">' +
          '<div class="cc-category-head">' +
            '<label class="cc-category-title" for="ccStatistics">Statistik</label>' +
            '<label class="cc-toggle"><input type="checkbox" id="ccStatistics" data-cc-toggle="statistics"><span class="cc-toggle-knob"></span></label>' +
          '</div>' +
          '<p class="cc-category-desc">Hilft mir zu verstehen, wie die Website genutzt wird (Google Analytics), anonymisiert ausgewertet.</p>' +
        '</div>' +
        '<div class="cc-category">' +
          '<div class="cc-category-head">' +
            '<label class="cc-category-title" for="ccMarketing">Marketing</label>' +
            '<label class="cc-toggle"><input type="checkbox" id="ccMarketing" data-cc-toggle="marketing"><span class="cc-toggle-knob"></span></label>' +
          '</div>' +
          '<p class="cc-category-desc">Ermöglicht die Erfolgsmessung von Google-Anzeigen. Ohne Zustimmung wird nichts an Google Ads übermittelt.</p>' +
        '</div>' +
        '<div class="cc-panel-actions">' +
          '<button type="button" class="cc-btn cc-btn-outline" data-cc-action="reject-all">Alle ablehnen</button>' +
          '<button type="button" class="cc-btn cc-btn-ghost" data-cc-action="save">Auswahl speichern</button>' +
          '<button type="button" class="cc-btn cc-btn-primary" data-cc-action="accept-all">Alle akzeptieren</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  function showBanner() {
    var el = document.getElementById('ccBanner');
    if (el) el.classList.add('cc-visible');
  }
  function hideBanner() {
    var el = document.getElementById('ccBanner');
    if (el) el.classList.remove('cc-visible');
  }
  function openPanel(prefill) {
    var panel = document.getElementById('ccPanel');
    var overlay = document.getElementById('ccOverlay');
    if (!panel || !overlay) return;
    document.getElementById('ccStatistics').checked = !!(prefill && prefill.statistics);
    document.getElementById('ccMarketing').checked = !!(prefill && prefill.marketing);
    panel.hidden = false;
    overlay.hidden = false;
  }
  function closePanel() {
    var panel = document.getElementById('ccPanel');
    var overlay = document.getElementById('ccOverlay');
    if (panel) panel.hidden = true;
    if (overlay) overlay.hidden = true;
  }

  function decide(statistics, marketing) {
    var state = saveState(statistics, marketing);
    applyConsent(state);
    hideBanner();
    closePanel();
  }

  window.openCookieSettings = function () {
    var state = loadState();
    showBanner();
    openPanel(state);
  };

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-cc-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-cc-action');
    if (action === 'accept-all') decide(true, true);
    else if (action === 'reject-all') decide(false, false);
    else if (action === 'settings') openPanel(loadState());
    else if (action === 'save') {
      decide(
        document.getElementById('ccStatistics').checked,
        document.getElementById('ccMarketing').checked
      );
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('cookie-consent-root');
    if (!root) return;
    root.innerHTML = TEMPLATE;

    var existing = loadState();
    if (existing) {
      applyConsent(existing);
    } else {
      showBanner();
    }
  });
})();
