/* ====================================================================
 * Homer Countdown  v20260520a
 * Neon countdown-to-event gadget with Joey-powered commentary.
 * Modes: Sarcastic · Motivational · Drama Queen · Stoic Sage · Chaotic
 * ==================================================================== */
(function () {
  'use strict';

  var LS_KEY = 'homer-countdown';

  var QUOTE_FALLBACK = [
    { text: 'The secret of getting ahead is getting started.',                author: 'Mark Twain' },
    { text: 'It always seems impossible until it\'s done.',                   author: 'Nelson Mandela' },
    { text: 'The only way to do great work is to love what you do.',          author: 'Steve Jobs' },
    { text: 'Do what you can, with what you have, where you are.',            author: 'Theodore Roosevelt' },
    { text: 'It does not matter how slowly you go as long as you don\'t stop.', author: 'Confucius' },
    { text: 'In the middle of every difficulty lies opportunity.',            author: 'Albert Einstein' },
    { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
    { text: 'You miss 100% of the shots you don\'t take.',                   author: 'Wayne Gretzky' },
    { text: 'Whether you think you can or you think you can\'t, you\'re right.', author: 'Henry Ford' },
    { text: 'Success is not final, failure is not fatal: it is the courage to continue.', author: 'Winston Churchill' },
  ];

  var state = { name: '', date: '', collapsed: false };
  var allQuotes = [];
  var seenQuoteIdx = new Set();
  var tickTimer   = null;

  /* ── Helpers ──────────────────────────────────────────────────── */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function safeJson(s, fb) { try { return s ? JSON.parse(s) : fb; } catch (_) { return fb; } }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pad(n, w) { return String(Math.max(0, Math.floor(n))).padStart(w || 2, '0'); }

  function loadState() {
    var saved = safeJson(localStorage.getItem(LS_KEY), null);
    if (saved) {
      state.name      = saved.name      || '';
      state.date      = saved.date      || '';
      state.collapsed = saved.collapsed === true;
    }
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function getTargetMs() {
    if (!state.date) return 0;
    var t = new Date(state.date).getTime();
    return isNaN(t) ? 0 : t;
  }

  function computeCountdown() {
    var target = getTargetMs();
    if (!target) return null;
    var diff = target - Date.now();
    if (diff <= 0) return { past: true };
    return {
      past:  false,
      days:  Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      mins:  Math.floor((diff % 3600000)  / 60000),
      secs:  Math.floor((diff % 60000)    / 1000),
    };
  }

  /* ── CSS ──────────────────────────────────────────────────────── */
  var CSS = [
    /* Card shell */
    '#cd-card{position:relative;overflow:hidden}',

    /* Header */
    '.cd-hdr{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}',
    '.cd-hdr-label{font-size:.67rem;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(240,240,255,.28)}',
    '.cd-hdr-event{font-size:.76rem;color:rgba(240,240,255,.45);max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-style:italic}',

    /* Config row */
    '.cd-config{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center}',
    '.cd-config input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:7px 11px;color:#F0F0FF;font-size:.79rem;outline:none;transition:border-color .15s}',
    '.cd-config input[type=text]{flex:1;min-width:130px}',
    '.cd-config input[type=datetime-local]{min-width:165px;color-scheme:dark}',
    '.cd-config input:focus{border-color:rgba(255,0,102,.45)}',
    '.cd-set-btn{background:rgba(255,0,102,.1);border:1px solid rgba(255,0,102,.22);border-radius:8px;padding:7px 16px;color:rgba(255,0,102,.9);font-weight:600;font-size:.78rem;cursor:pointer;transition:background .15s;white-space:nowrap}',
    '.cd-set-btn:hover{background:rgba(255,0,102,.18)}',

    /* Countdown display */
    '.cd-display{display:flex;align-items:flex-end;justify-content:center;gap:0;margin:18px 0 6px;flex-wrap:wrap}',
    '.cd-unit{display:flex;flex-direction:column;align-items:center;padding:8px 14px}',
    '.cd-num{font-family:"SF Mono","Fira Code","Courier New",monospace;font-size:2.6rem;font-weight:900;line-height:1;letter-spacing:-1.5px}',
    '.cd-num.cd-days {color:#FF0066}',
    '.cd-num.cd-hours{color:#00E5FF}',
    '.cd-num.cd-mins {color:#C44DFF}',
    '.cd-num.cd-secs {color:rgba(255,215,0,.65)}',
    '.cd-unit-label{font-size:.5rem;font-weight:600;letter-spacing:2px;color:rgba(240,240,255,.22);margin-top:5px;text-transform:uppercase}',
    '.cd-sep{font-size:1.8rem;font-weight:300;color:rgba(255,255,255,.12);align-self:flex-end;margin-bottom:13px;line-height:1;padding:0 1px}',

    '.cd-event-label{text-align:center;font-size:.74rem;color:rgba(240,240,255,.3);margin-bottom:14px}',
    '.cd-event-label strong{color:rgba(240,240,255,.55);font-weight:500}',
    '.cd-past-msg{text-align:center;font-size:.95rem;font-weight:600;color:#FF0066;margin:16px 0 6px}',
    '.cd-no-event{text-align:center;color:rgba(240,240,255,.18);font-size:.8rem;padding:26px 0;line-height:1.7}',

    /* Divider */
    '.cd-divider{height:1px;background:rgba(255,255,255,.06);margin:4px 0 12px}',

    /* Quote section header */
    '.cd-quote-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}',
    '.cd-quote-label{font-size:.6rem;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:rgba(240,240,255,.28)}',

    /* Commentary */
    '.cd-commentary-row{display:flex;align-items:flex-start;gap:10px}',
    '.cd-comment-text{flex:1;color:rgba(200,200,230,.78);font-size:.86rem;line-height:1.65;font-style:italic;min-height:34px;white-space:pre-wrap}',
    '.cd-comment-text.cd-streaming::after{content:"\u25ae";animation:cd-blink .75s step-end infinite;display:inline;color:#C44DFF}',
    '.cd-comment-text.cd-empty{color:rgba(240,240,255,.18);font-style:normal;font-size:.78rem}',
    '@keyframes cd-blink{0%,100%{opacity:1}50%{opacity:0}}',
    '.cd-gen-btn{flex-shrink:0;background:transparent;border:1px solid rgba(255,255,255,.09);border-radius:7px;padding:5px 11px;color:rgba(240,240,255,.35);font-size:.7rem;cursor:pointer;transition:all .15s;margin-top:1px}',
    '.cd-gen-btn:hover{border-color:rgba(196,77,255,.35);color:rgba(196,77,255,.85)}',
    '.cd-gen-btn:disabled{opacity:.2;cursor:not-allowed}',

    /* Collapsible body */
    '.cd-body{overflow:hidden;transition:max-height .35s ease,opacity .25s ease}',
    '.cd-body.cd-open{max-height:1000px;opacity:1}',
    '.cd-body.cd-shut{max-height:0;opacity:0;pointer-events:none}',
    '.cd-toggle{background:transparent;border:none;padding:0 4px;cursor:pointer;color:rgba(240,240,255,.3);font-size:.75rem;line-height:1;transition:color .15s;margin-left:8px;flex-shrink:0}',
    '.cd-toggle:hover{color:rgba(240,240,255,.65)}',

    /* Responsive */
    '@media(max-width:520px){',
      '.cd-num{font-size:2rem}',
      '.cd-unit{padding:6px 10px}',
      '.cd-sep{font-size:1.5rem;margin-bottom:10px}',
    '}',
  ].join('');

  /* ── HTML template ────────────────────────────────────────────── */
  function buildCardHTML() {
    var savedDate = '';
    if (state.date) {
      try { savedDate = new Date(state.date).toISOString().slice(0, 16); } catch (_) {}
    }
    var hdrEvent = state.name ? esc(state.name) : (state.date ? 'Event set' : '');
    var bodyClass = state.collapsed ? 'cd-shut' : 'cd-open';
    var toggleIcon = state.collapsed ? '\u25be' : '\u25b4';
    return '<div id="cd-card" class="span-12 card">' +
      '<div class="cd-hdr">' +
        '<span class="cd-hdr-label">Countdown</span>' +
        '<span class="cd-hdr-event" id="cd-hdr-event">' + hdrEvent + '</span>' +
        '<button class="cd-toggle" id="cd-toggle" title="Toggle">' + toggleIcon + '</button>' +
      '</div>' +
      '<div class="cd-body ' + bodyClass + '" id="cd-body">' +
        '<div class="cd-config">' +
          '<input type="text" id="cd-name-in" placeholder="Event name\u2026" maxlength="80" value="' + esc(state.name) + '">' +
          '<input type="datetime-local" id="cd-date-in" value="' + esc(savedDate) + '">' +
          '<button class="cd-set-btn" id="cd-set-btn">Set</button>' +
        '</div>' +
        '<div id="cd-display-area"></div>' +
        '<div id="cd-commentary-section" style="display:none">' +
          '<div class="cd-divider"></div>' +
          '<div class="cd-quote-hdr">' +
            '<span class="cd-quote-label">Quote</span>' +
            '<button class="cd-gen-btn" id="cd-gen-btn">\u21bb</button>' +
          '</div>' +
          '<div class="cd-comment-text cd-empty" id="cd-comment-text">Tap \u21bb for a quote.</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Rendering ────────────────────────────────────────────────── */
  function renderDisplay() {
    var area = document.getElementById('cd-display-area');
    var section = document.getElementById('cd-commentary-section');
    if (!area) return;

    var cd = computeCountdown();
    if (!cd) {
      area.innerHTML = '<div class="cd-no-event">Set an event above to start the countdown ↑</div>';
      if (section) section.style.display = 'none';
      return;
    }
    if (section) section.style.display = '';

    if (cd.past) {
      area.innerHTML =
        '<div class="cd-past-msg">&#127881; This event has already happened!</div>' +
        '<div class="cd-event-label">&mdash; <strong>' + esc(state.name || 'Event') + '</strong> &mdash;</div>';
      return;
    }

    var dWidth = cd.days >= 100 ? 3 : 2;
    area.innerHTML =
      '<div class="cd-display">' +
        unit('cd-d', pad(cd.days, dWidth), 'cd-days',  'Days')  +
        '<div class="cd-sep">:</div>' +
        unit('cd-h', pad(cd.hours), 'cd-hours', 'Hours') +
        '<div class="cd-sep">:</div>' +
        unit('cd-m', pad(cd.mins),  'cd-mins',  'Min')   +
        '<div class="cd-sep">:</div>' +
        unit('cd-s', pad(cd.secs),  'cd-secs',  'Sec')   +
      '</div>' +
      '<div class="cd-event-label">until <strong>' + esc(state.name || 'Event') + '</strong></div>';
  }

  function unit(id, val, cls, label) {
    return '<div class="cd-unit">' +
      '<span class="cd-num ' + cls + '" id="' + id + '">' + val + '</span>' +
      '<span class="cd-unit-label">' + label + '</span>' +
    '</div>';
  }

  function tickInPlace() {
    var cd = computeCountdown();
    if (!cd || cd.past) { renderDisplay(); return; }
    var d = document.getElementById('cd-d');
    var h = document.getElementById('cd-h');
    var m = document.getElementById('cd-m');
    var s = document.getElementById('cd-s');
    if (d) d.textContent = pad(cd.days, cd.days >= 100 ? 3 : 2);
    if (h) h.textContent = pad(cd.hours);
    if (m) m.textContent = pad(cd.mins);
    if (s) s.textContent = pad(cd.secs);
  }

  /* ── Free quotes via type.fit ────────────────────────────────── */
  function fetchQuotes(cb) {
    if (allQuotes.length > 0) { cb(); return; }
    fetch('https://type.fit/api/quotes')
      .then(function (r) { return r.json(); })
      .then(function (arr) {
        allQuotes = arr.filter(function (q) {
          var t = q.text || q.t || '';
          return t.length > 10;
        });
        if (allQuotes.length < 10) allQuotes = QUOTE_FALLBACK;
        cb();
      })
      .catch(function () { allQuotes = QUOTE_FALLBACK; cb(); });
  }

  function refreshQuote() {
    if (!state.date) return;
    var textEl = document.getElementById('cd-comment-text');
    var genBtn  = document.getElementById('cd-gen-btn');
    if (!textEl) return;
    if (genBtn) genBtn.disabled = true;
    textEl.classList.remove('cd-empty');
    textEl.textContent = '\u2026';

    fetchQuotes(function () {
      var pool = allQuotes.length > 0 ? allQuotes : QUOTE_FALLBACK;
      if (seenQuoteIdx.size >= pool.length) seenQuoteIdx.clear();
      var idx;
      do { idx = Math.floor(Math.random() * pool.length); } while (seenQuoteIdx.has(idx) && seenQuoteIdx.size < pool.length);
      seenQuoteIdx.add(idx);
      var q   = pool[idx];
      var txt = q.text || q.t || '';
      var auth = q.author || q.a || '';
      textEl.textContent = '\u201c' + txt + '\u201d' + (auth ? '  \u2014 ' + auth : '');
      if (genBtn) genBtn.disabled = false;
    });
  }

  /* ── Collapse toggle ─────────────────────────────────────────── */
  function toggleCollapse() {
    state.collapsed = !state.collapsed;
    saveState();
    var body = document.getElementById('cd-body');
    var btn  = document.getElementById('cd-toggle');
    if (body) {
      body.classList.toggle('cd-open',  !state.collapsed);
      body.classList.toggle('cd-shut',   state.collapsed);
    }
    if (btn) btn.textContent = state.collapsed ? '\u25be' : '\u25b4';
  }

  /* ── Sidebar button ───────────────────────────────────────────── */
  function injectSidebarButton() {
    if (document.getElementById('cd-sb-btn')) return;
    var sidebar = document.getElementById('desktop-sidebar');
    if (!sidebar) return;
    var spacer = sidebar.querySelector('.sb-spacer');
    var btn = document.createElement('button');
    btn.className   = 'sb-item';
    btn.id          = 'cd-sb-btn';
    btn.dataset.tab = 'home';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' +
      '</svg>' +
      '<span class="sb-label">Countdown</span>';
    btn.addEventListener('click', function () {
      if (window._homerShowTab) window._homerShowTab('home');
      setTimeout(function () {
        var card = document.getElementById('cd-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    });
    if (spacer) sidebar.insertBefore(btn, spacer);
    else sidebar.appendChild(btn);
  }

  /* ── Bootstrap ────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('homer-countdown-css')) return;
    var s = document.createElement('style');
    s.id = 'homer-countdown-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function injectCard() {
    if (document.getElementById('cd-card')) return;
    var grid = document.querySelector('#tab-home .grid');
    if (!grid) return;

    var tmp = document.createElement('div');
    tmp.innerHTML = buildCardHTML();
    grid.appendChild(tmp.firstElementChild);

    document.getElementById('cd-toggle').addEventListener('click', toggleCollapse);

    document.getElementById('cd-gen-btn').addEventListener('click', refreshQuote);

    document.getElementById('cd-set-btn').addEventListener('click', function () {
      var nameVal = (document.getElementById('cd-name-in').value || '').trim();
      var dateVal = (document.getElementById('cd-date-in').value || '').trim();
      if (!dateVal) { alert('Please pick a date and time.'); return; }
      state.name = nameVal;
      state.date = new Date(dateVal).toISOString();
      saveState();
      var hdrEl = document.getElementById('cd-hdr-event');
      if (hdrEl) hdrEl.textContent = state.name || 'Event set';
      renderDisplay();
      refreshQuote();
    });

    renderDisplay();
    // Auto-load a quote if event is already set
    if (state.date) refreshQuote();

    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tickInPlace, 1000);
  }

  ready(function () {
    loadState();
    injectStyles();
    injectCard();
    injectSidebarButton();
  });
})();
