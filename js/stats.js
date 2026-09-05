/* global CONFIG, Fluid */
(function(window, document) {
  'use strict';
  if (window.__blogStatsLoaded) return;
  window.__blogStatsLoaded = true;
  var config = CONFIG.web_analytics.stats || {server_url: 'https://comment.pangao.vip', ignore_local: true};
  // Cached pre-migration HTML can use this client without contacting the retired provider.
  var prefix = (document.querySelector('#stats-site-pv-container') || document.querySelector('#stats-site-uv-container') || document.querySelector('#stats-page-views-container')) ? 'stats' : 'leancloud';
  var pv = document.querySelector('#' + prefix + '-site-pv-container');
  var uv = document.querySelector('#' + prefix + '-site-uv-container');
  var page = document.querySelector('#' + prefix + '-page-views-container');
  if (!config.server_url || !(pv || uv || page)) return;
  var path = page ? window.location.pathname : null;
  var endpoint = config.server_url.replace(/\/$/, '') + '/api/stats';
  var local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  var increment = CONFIG.web_analytics.enable && !Fluid.ctx.dnt && !(config.ignore_local && local);
  var now = Date.now();
  var lastUV = 0;
  try {
    // Preserve the existing 24-hour browser UV window during migration.
    lastUV = Number(localStorage.getItem('Blog_UV_Flag') || localStorage.getItem('LeanCloud_UV_Flag')) || 0;
  } catch (_) { /* Storage may be disabled by browser privacy settings. */ }
  var countUV = Boolean(uv && now - lastUV > 86400000);
  var eventId = window.crypto.randomUUID();
  var body = JSON.stringify({path: path, uv: countUV, eventId: eventId});
  function display(data) {
    [[pv, 'pv', '#' + prefix + '-site-pv'], [uv, 'uv', '#' + prefix + '-site-uv'], [page, 'views', '#' + prefix + '-page-views']].forEach(function(item) {
      var element = document.querySelector(item[2]);
      if (item[0] && element && Number.isFinite(data[item[1]])) {
        element.textContent = data[item[1]];
        item[0].style.display = 'inline';
      }
    });
  }
  async function request(write) {
    var response = await fetch(endpoint + (!write && path ? '?path=' + encodeURIComponent(path) : ''), {
      method: write ? 'POST' : 'GET',
      ...(write ? {headers: {'Content-Type': 'application/json'}, body: body} : {}),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error('Statistics HTTP ' + response.status);
    return response.json();
  }
  async function run() {
    try {
      var data;
      try { data = await request(increment); }
      catch (error) {
        // Reuse the same receipt ID so a lost response cannot double-count a visit.
        if (!increment) throw error;
        data = await request(true);
      }
      display(data);
      if (increment && countUV) {
        try { localStorage.setItem('Blog_UV_Flag', String(now)); } catch (_) {}
      }
    } catch (error) {
      console.warn('Statistics unavailable:', error.message);
      // A read-only fallback can still show history if the write was rejected.
      if (increment) try { display(await request(false)); } catch (_) {}
    }
  }
  run();
})(window, document);
