/* Reelwright motion runtime — Apache-2.0.
 * A tiny deterministic animation engine for HyperFrames: every visible value
 * is a pure function of the timeline time HyperFrames sends with `hf-seek`.
 * No timers, no requestAnimationFrame, no randomness, no third-party library.
 *
 * Markup contract (written by src/compose/index.mjs):
 *   [data-scene]             a scene clip; data-start / data-duration in seconds
 *   [data-anim]              rise | fade | pop | wipe | grow | bar | count | drift
 *     data-at                seconds after the scene starts
 *     data-len               animation length in seconds (default 0.7)
 *     data-frac              bar: final fill 0..1
 *     data-value/-decimals/-prefix/-suffix   count: number to count up to
 *   [data-ws][data-we]       caption word: active while ws <= t < we
 *   #progress                width follows t / total
 */
(function () {
  'use strict';
  var root = document.getElementById('root');
  var total = parseFloat(root.getAttribute('data-duration')) || 1;
  var lang = (document.documentElement.lang || 'en').slice(0, 2);
  var EXIT = 0.35;

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeOutBack(x) { var c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function num(el, name, d) { var v = parseFloat(el.getAttribute(name)); return isFinite(v) ? v : d; }

  // Locale-independent number formatting (headless Chrome may lack full ICU).
  var SEP = { en: [',', '.'], es: ['.', ','], fr: [' ', ','], de: ['.', ','], it: ['.', ','], pt: ['.', ','], ja: [',', '.'], zh: [',', '.'] };
  function fmt(n, decimals) {
    var s = SEP[lang] || SEP.en;
    var fixed = Math.abs(n).toFixed(decimals);
    var parts = fixed.split('.');
    var int = parts[0];
    // Spanish style: no separator for 4-digit numbers.
    var group = !(lang === 'es' && int.length <= 4);
    if (group) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, s[0]);
    return (n < 0 ? '-' : '') + int + (parts[1] ? s[1] + parts[1] : '');
  }

  var scenes = Array.prototype.map.call(document.querySelectorAll('[data-scene]'), function (el) {
    return { el: el, inner: el.firstElementChild, start: num(el, 'data-start', 0), dur: num(el, 'data-duration', 1) };
  });
  var anims = Array.prototype.map.call(document.querySelectorAll('[data-anim]'), function (el) {
    var host = el.closest('[data-scene]');
    return {
      el: el,
      kind: el.getAttribute('data-anim'),
      start: host ? num(host, 'data-start', 0) : 0,
      at: num(el, 'data-at', 0),
      len: num(el, 'data-len', 0.7),
      frac: num(el, 'data-frac', 1),
      value: num(el, 'data-value', 0),
      decimals: num(el, 'data-decimals', 0),
      prefix: el.getAttribute('data-prefix') || '',
      suffix: el.getAttribute('data-suffix') || '',
    };
  });
  var words = Array.prototype.map.call(document.querySelectorAll('[data-ws]'), function (el) {
    return { el: el, ws: num(el, 'data-ws', 0), we: num(el, 'data-we', 0) };
  });
  var progress = document.getElementById('progress');
  // Studio preview only (plain browser, no HyperFrames): show/hide clips ourselves.
  // During a real render HyperFrames owns clip visibility and this stays off.
  var preview = window.__reelwrightPreview === true;
  var clips = preview ? Array.prototype.map.call(document.querySelectorAll('.clip'), function (el) {
    return { el: el, start: num(el, 'data-start', 0), end: num(el, 'data-start', 0) + num(el, 'data-duration', 1e9) };
  }) : [];

  function renderAt(t) {
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      if (!s.inner) continue;
      var left = s.start + s.dur - t;
      var isLast = i === scenes.length - 1;
      s.inner.style.opacity = isLast ? 1 : clamp(left / EXIT);
    }
    for (var j = 0; j < anims.length; j++) {
      var a = anims[j];
      var local = t - a.start;
      var raw = clamp((local - a.at) / a.len);
      var p = easeOut(raw);
      var st = a.el.style;
      switch (a.kind) {
        case 'rise': st.opacity = p; st.transform = 'translateY(' + (1 - p) * 0.6 + 'em)'; break;
        case 'fade': st.opacity = p; break;
        case 'pop': st.opacity = p; st.transform = 'scale(' + (0.86 + 0.14 * easeOutBack(raw)) + ')'; break;
        case 'wipe': st.clipPath = 'inset(0 ' + (100 - p * 100) + '% 0 0)'; break;
        case 'grow': st.transform = 'scaleX(' + p + ')'; break;
        case 'bar': st.transform = 'scaleX(' + p * a.frac + ')'; break;
        case 'count': a.el.textContent = a.prefix + fmt(a.value * p, a.decimals) + a.suffix; break;
        case 'drift': st.transform = 'translate(' + Math.sin(t * 0.21) * 3 + '%,' + Math.cos(t * 0.17) * 3 + '%) scale(' + (1.08 + Math.sin(t * 0.11) * 0.04) + ')'; break;
      }
    }
    for (var k = 0; k < words.length; k++) {
      var w = words[k];
      var cls = t >= w.we ? 'w spoken' : t >= w.ws ? 'w active' : 'w';
      if (w.el.className !== cls) w.el.className = cls;
    }
    for (var c = 0; c < clips.length; c++) {
      var on = t >= clips[c].start && t < clips[c].end;
      clips[c].el.style.visibility = on ? 'visible' : 'hidden';
    }
    if (progress) progress.style.transform = 'scaleX(' + clamp(t / total) + ')';
  }

  window.addEventListener('hf-seek', function (e) { renderAt(e.detail.time); });
  if (preview) {
    // The studio scrubber talks to this sandboxed frame with postMessage.
    window.addEventListener('message', function (e) {
      if (e.data && typeof e.data.t === 'number') renderAt(e.data.t);
    });
  }
  renderAt(0);
})();
