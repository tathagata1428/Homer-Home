/* ====================================================================
 * Homer Habit Tracker  v20260508a
 * Full-featured vault habit tracking app with Supabase sync.
 * Data key: 'homer-habits' (already in SYNC_KEYS in enhancements)
 * ==================================================================== */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function safeJson(s, fb) { try { return s ? JSON.parse(s) : fb; } catch (_) { return fb; } }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── CSS ──────────────────────────────────────────────────────────── */
  var CSS = `
    #habits-overlay .vault-ov-page { padding-bottom: max(60px, env(safe-area-inset-bottom, 20px) + 60px); }

    .vh-wrap { }
    .vh-tabs { display:flex; gap:4px; padding-bottom:16px; border-bottom:1px solid rgba(255,255,255,.08); margin-bottom:20px; }
    .vh-tab { padding:8px 22px; border-radius:10px; border:1px solid transparent; background:none; color:#64748b; font-size:.88rem; font-weight:700; cursor:pointer; transition:all .15s; font-family:inherit; }
    .vh-tab.active { background:rgba(59,130,246,.15); border-color:rgba(59,130,246,.3); color:#60a5fa; }
    .vh-tab:hover:not(.active) { background:rgba(255,255,255,.05); color:#cbd5e1; }

    /* Today */
    .vh-today-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; gap:16px; flex-wrap:wrap; padding:20px 24px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:18px; }
    .vh-date { font-size:.72rem; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
    .vh-greeting-text { font-size:1.5rem; font-weight:900; color:#e5e7eb; line-height:1.2; }
    .vh-motiv { font-size:.88rem; color:#94a3b8; margin-top:8px; }
    .vh-ring-wrap { text-align:center; flex-shrink:0; }
    .vh-pct-label { font-size:.72rem; color:#64748b; margin-top:4px; font-weight:700; }

    /* Habit cards */
    .vh-habits-list { display:flex; flex-direction:column; gap:10px; }
    .vh-card { display:flex; align-items:center; gap:12px; padding:14px 16px 14px 20px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:14px; transition:background .2s, border-color .2s; position:relative; overflow:hidden; }
    .vh-card:hover { background:rgba(255,255,255,.06); }
    .vh-card-done { background:rgba(52,211,153,.05); border-color:rgba(52,211,153,.18); }
    .vh-card-done:hover { background:rgba(52,211,153,.08); }
    .vh-card-color-strip { position:absolute; left:0; top:0; bottom:0; width:4px; }
    .vh-card-icon { font-size:1.6rem; flex-shrink:0; }
    .vh-card-body { flex:1; min-width:0; }
    .vh-card-name { font-size:.92rem; font-weight:700; color:#e5e7eb; margin-bottom:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .vh-card-done .vh-card-name { color:#94a3b8; text-decoration:line-through; text-decoration-color:rgba(52,211,153,.5); }
    .vh-card-meta { display:flex; align-items:center; gap:6px; margin-bottom:7px; flex-wrap:wrap; }
    .vh-cat-pill { font-size:.68rem; padding:2px 8px; border-radius:20px; background:rgba(255,255,255,.08); color:#94a3b8; font-weight:600; }
    .vh-streak-pill { font-size:.68rem; padding:2px 8px; border-radius:20px; background:rgba(251,191,36,.12); color:#fbbf24; font-weight:700; }
    .vh-dots { display:flex; gap:3px; }
    .vh-dot { width:9px; height:9px; border-radius:3px; background:rgba(255,255,255,.08); flex-shrink:0; }
    .vh-dot.done { background:#34d399; }
    .vh-dot.today { outline:2px solid #60a5fa; outline-offset:1px; }
    .vh-dot.skip { background:rgba(255,255,255,.03); }
    .vh-card-action { flex-shrink:0; margin-left:4px; }
    .vh-check { width:38px; height:38px; border-radius:11px; border:2px solid rgba(255,255,255,.2); background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:900; color:#fff; transition:all .2s; font-family:inherit; }
    .vh-check:hover { border-color:rgba(255,255,255,.4); background:rgba(255,255,255,.07); transform:scale(1.06); }
    .vh-check.done { animation:vh-pop .3s cubic-bezier(.34,1.56,.64,1); }
    @keyframes vh-pop { 0%{transform:scale(.75)} 60%{transform:scale(1.18)} 100%{transform:scale(1)} }

    /* Counter */
    .vh-counter { display:flex; align-items:center; gap:8px; }
    .vh-cnt-btn { width:30px; height:30px; border-radius:9px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:#e5e7eb; font-size:1.1rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s; line-height:1; font-family:inherit; }
    .vh-cnt-btn:hover { background:rgba(255,255,255,.13); }
    .vh-cnt-val { font-size:.85rem; font-weight:800; min-width:38px; text-align:center; }

    /* Not scheduled */
    .vh-not-today { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
    .vh-skip-chip { padding:5px 12px; border-radius:20px; font-size:.75rem; color:#64748b; background:rgba(255,255,255,.04); border:1px solid; }

    /* Section label */
    .vh-section-label { font-size:.72rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; margin-top:4px; }

    /* Empty */
    .vh-empty { text-align:center; padding:60px 20px; }
    .vh-empty-today { text-align:center; padding:30px; color:#64748b; font-size:.88rem; background:rgba(255,255,255,.03); border-radius:12px; border:1px dashed rgba(255,255,255,.1); }
    .vh-all-done { text-align:center; padding:32px 20px; background:linear-gradient(135deg,rgba(52,211,153,.08),rgba(96,165,250,.08)); border:1px solid rgba(52,211,153,.2); border-radius:18px; margin-top:16px; }
    .vh-all-done-icon { font-size:3rem; margin-bottom:10px; }
    .vh-all-done-title { font-size:1.1rem; font-weight:800; color:#34d399; margin-bottom:6px; }
    .vh-all-done-sub { font-size:.85rem; color:#64748b; }

    /* Buttons */
    .vh-btn-primary { padding:10px 24px; border-radius:12px; border:none; background:#3b82f6; color:#fff; font-size:.88rem; font-weight:700; cursor:pointer; transition:background .2s; font-family:inherit; }
    .vh-btn-primary:hover { background:#2563eb; }
    .vh-btn-ghost { padding:10px 20px; border-radius:12px; border:1px solid rgba(255,255,255,.15); background:none; color:#94a3b8; font-size:.88rem; font-weight:600; cursor:pointer; transition:all .15s; font-family:inherit; }
    .vh-btn-ghost:hover { background:rgba(255,255,255,.06); color:#e5e7eb; }

    /* Stats */
    .vh-stats-top { display:flex; align-items:center; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
    .vh-select { padding:9px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.15); background:#0b1220; color:#e5e7eb; font-size:.88rem; outline:none; font-family:inherit; min-width:200px; cursor:pointer; }
    .vh-stat-cards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:4px; }
    .vh-stat-card { padding:18px 12px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:16px; text-align:center; }
    .vh-stat-val { font-size:1.6rem; font-weight:900; margin-bottom:4px; line-height:1; }
    .vh-stat-lbl { font-size:.68rem; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }

    /* Heatmap */
    .vh-heatmap-scroll { overflow-x:auto; padding-bottom:4px; }
    .vh-heatmap-inner { display:flex; gap:2px; align-items:flex-start; min-width:max-content; }
    .vh-hm-row-labels { display:flex; flex-direction:column; gap:2px; margin-right:4px; padding-top:0; }
    .vh-hm-lbl { height:13px; font-size:.6rem; color:#64748b; line-height:13px; width:16px; text-align:right; }
    .vh-hm-weeks { display:flex; gap:2px; }
    .vh-hm-week { display:flex; flex-direction:column; gap:2px; }
    .vh-hm-cell { width:13px; height:13px; border-radius:2px; background:rgba(255,255,255,.06); cursor:default; display:block; flex-shrink:0; transition:transform .1s; }
    .vh-hm-cell:hover { transform:scale(1.4); z-index:1; position:relative; }
    .vh-hm-cell.today { outline:1.5px solid #60a5fa; outline-offset:1px; }
    .vh-hm-cell.skip { background:rgba(255,255,255,.02); }
    .vh-hm-cell.future { background:rgba(255,255,255,.02); cursor:default; }
    .vh-hm-legend { display:flex; align-items:center; gap:4px; margin-top:10px; }

    /* Weekly pattern */
    .vh-weekly-pattern { display:flex; gap:10px; justify-content:center; margin-top:14px; }
    .vh-wp-col { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; max-width:48px; }
    .vh-wp-bar-wrap { height:56px; display:flex; align-items:flex-end; width:100%; }
    .vh-wp-bar { width:100%; border-radius:4px 4px 0 0; min-height:3px; transition:height .5s ease; }
    .vh-wp-label { font-size:.65rem; color:#64748b; font-weight:700; }
    .vh-wp-pct { font-size:.6rem; color:#94a3b8; }

    /* Manage */
    .vh-manage-head { margin-bottom:20px; }
    .vh-manage-list { display:flex; flex-direction:column; gap:6px; }
    .vh-manage-row { display:flex; align-items:center; gap:10px; padding:12px 14px 12px 18px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:12px; position:relative; overflow:hidden; transition:opacity .2s; }
    .vh-manage-row.archived { opacity:.45; }
    .vh-mr-strip { position:absolute; left:0; top:0; bottom:0; width:4px; }
    .vh-mr-icon { font-size:1.2rem; }
    .vh-mr-info { flex:1; min-width:0; }
    .vh-mr-name { font-size:.88rem; font-weight:700; color:#e5e7eb; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .vh-mr-meta { font-size:.72rem; color:#64748b; margin-top:2px; }
    .vh-mr-actions { display:flex; gap:4px; flex-shrink:0; }
    .vh-mr-btn { width:32px; height:32px; border-radius:9px; border:1px solid rgba(255,255,255,.1); background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:.9rem; transition:background .15s; font-family:inherit; }
    .vh-mr-btn:hover { background:rgba(255,255,255,.09); }
    .vh-mr-btn.del:hover { background:rgba(248,113,113,.15); border-color:rgba(248,113,113,.3); }
    .vh-archived-toggle { padding:13px 0; cursor:pointer; color:#64748b; font-size:.82rem; font-weight:700; display:flex; align-items:center; gap:8px; border-top:1px solid rgba(255,255,255,.06); margin-top:18px; user-select:none; }
    .vh-archived-toggle:hover { color:#94a3b8; }
    .vh-archived-list { display:flex; flex-direction:column; gap:6px; margin-top:10px; }

    /* Form */
    .vh-form { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:18px; padding:22px; margin-bottom:22px; }
    .vh-form-title { font-size:1rem; font-weight:800; color:#e5e7eb; margin-bottom:20px; }
    .vh-form-row { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
    .vh-form-group { display:flex; flex-direction:column; gap:7px; flex:1; min-width:140px; }
    .vh-form-label { font-size:.72rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; }
    .vh-form-hint { text-transform:none; font-weight:400; color:#64748b; letter-spacing:0; }
    .vh-input { padding:10px 14px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:#0b1220; color:#e5e7eb; font-size:.88rem; outline:none; font-family:inherit; transition:border-color .2s; box-sizing:border-box; width:100%; }
    .vh-input:focus { border-color:#3b82f6; }
    .vh-emoji-grid { display:flex; flex-wrap:wrap; gap:5px; }
    .vh-emoji-btn { width:34px; height:34px; border-radius:9px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; transition:all .15s; font-family:inherit; }
    .vh-emoji-btn:hover { background:rgba(255,255,255,.1); transform:scale(1.12); }
    .vh-emoji-btn.active { border-color:#3b82f6; background:rgba(59,130,246,.18); }
    .vh-emoji-input { margin-top:6px; }
    .vh-color-row { display:flex; gap:9px; flex-wrap:wrap; }
    .vh-color-btn { width:30px; height:30px; border-radius:50%; border:2px solid transparent; cursor:pointer; transition:all .15s; flex-shrink:0; }
    .vh-color-btn:hover { transform:scale(1.15); }
    .vh-color-btn.active { border-color:#fff; box-shadow:0 0 0 3px rgba(255,255,255,.25); }
    .vh-freq-row { display:flex; gap:20px; }
    .vh-freq-opt { display:flex; align-items:center; gap:7px; cursor:pointer; font-size:.85rem; color:#e5e7eb; font-family:inherit; }
    .vh-freq-days { display:flex; gap:7px; flex-wrap:wrap; margin-top:2px; }
    .vh-freq-days.hidden { display:none; }
    .vh-day-btn { cursor:pointer; }
    .vh-day-btn input { display:none; }
    .vh-day-btn span { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:9px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.04); font-size:.78rem; font-weight:700; color:#94a3b8; cursor:pointer; transition:all .15s; }
    .vh-day-btn.active span { background:rgba(59,130,246,.2); border-color:#3b82f6; color:#60a5fa; }
    .vh-target-row { display:flex; align-items:center; gap:12px; }
    .vh-target-val { font-size:1.1rem; font-weight:800; color:#e5e7eb; min-width:28px; text-align:center; }
    .vh-form-actions { display:flex; gap:10px; justify-content:flex-end; padding-top:4px; }

    @media(max-width:600px) {
      .vh-today-header { padding:14px 16px; }
      .vh-greeting-text { font-size:1.15rem; }
      .vh-stat-cards { grid-template-columns:repeat(2,1fr); }
      .vh-tabs { gap:2px; }
      .vh-tab { padding:8px 14px; font-size:.8rem; }
      .vh-form-row { flex-direction:column; gap:12px; }
      .vh-weekly-pattern { gap:6px; }
    }
    @media(max-width:400px) {
      .vh-tab { padding:7px 10px; font-size:.75rem; }
    }
  `;

  var styleEl = document.createElement('style');
  styleEl.id = 'homer-habits-css';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ── Constants ──────────────────────────────────────────────────────── */
  var KEY = 'homer-habits';
  var COLORS = ['#34d399','#60a5fa','#f87171','#fbbf24','#a78bfa','#fb7185','#38bdf8','#4ade80'];
  var CATS = ['health','fitness','learning','mindfulness','work','social','creative','other'];
  var CAT_EMOJI = { health:'❤️', fitness:'💪', learning:'📚', mindfulness:'🧘', work:'💼', social:'👥', creative:'🎨', other:'⭐' };
  var DEFAULT_EMOJIS = ['🏃','💧','📚','🧘','💪','🥗','😴','☀️','🎯','✍️','🎵','🌿','💊','🧠','🚶','🏋️','🥤','🍎','🧹','💻','📖','🎸','🌞','🛌','🧘'];
  var DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  /* ── State ──────────────────────────────────────────────────────────── */
  var _view = 'today';
  var _statsId = null;
  var _editId = null;
  var _showAdd = false;
  var _showArchived = false;

  /* ── Data ───────────────────────────────────────────────────────────── */
  function getData() {
    var d = safeJson(localStorage.getItem(KEY), { habits: [], completions: {} });
    if (!d.habits) d.habits = [];
    if (!d.completions) d.completions = {};
    return d;
  }
  function saveData(d) {
    localStorage.setItem(KEY, JSON.stringify(d));
    updateBadge();
  }

  /* ── Date helpers ───────────────────────────────────────────────────── */
  function toDateStr(d) { return d.toISOString().slice(0, 10); }
  function todayStr() { return toDateStr(new Date()); }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d; }

  /* ── Habit helpers ──────────────────────────────────────────────────── */
  function getTarget(h) { return (h.target && h.target > 1) ? h.target : 1; }

  function isScheduled(h, date) {
    if (!h.freq || h.freq === 'daily') return true;
    if (Array.isArray(h.freq)) return h.freq.indexOf(date.getDay()) !== -1;
    return true;
  }
  function isScheduledToday(h) { return isScheduled(h, new Date()); }

  function getDone(completions, id, dk) {
    var v = completions[id + ':' + dk];
    if (v === undefined || v === null || v === false) return 0;
    if (v === true) return 1;
    return Number(v) || 0;
  }

  function isDoneToday(completions, h) {
    return getDone(completions, h.id, todayStr()) >= getTarget(h);
  }

  function calcStreak(completions, h) {
    var target = getTarget(h);
    var d = new Date(); d.setHours(0,0,0,0);
    var today = todayStr();
    // If today is scheduled but not done, start counting from yesterday
    if (isScheduledToday(h) && getDone(completions, h.id, today) < target) {
      d.setDate(d.getDate() - 1);
    }
    var s = 0;
    for (var i = 0; i < 730; i++) {
      var dk = toDateStr(d);
      if (isScheduled(h, d)) {
        if (getDone(completions, h.id, dk) >= target) s++;
        else break;
      }
      d.setDate(d.getDate() - 1);
    }
    return s;
  }

  function calcBestStreak(completions, h) {
    var target = getTarget(h);
    var best = 0, cur = 0;
    for (var i = 364; i >= 0; i--) {
      var d = daysAgo(i);
      if (isScheduled(h, d)) {
        if (getDone(completions, h.id, toDateStr(d)) >= target) { cur++; if (cur > best) best = cur; }
        else cur = 0;
      }
    }
    return best;
  }

  function calcRate(completions, h, days) {
    var target = getTarget(h);
    var done = 0, sched = 0;
    for (var i = 0; i < days; i++) {
      var d = daysAgo(i);
      if (isScheduled(h, d)) {
        sched++;
        if (getDone(completions, h.id, toDateStr(d)) >= target) done++;
      }
    }
    return sched > 0 ? Math.round((done / sched) * 100) : 0;
  }

  function calcTotal(completions, id) {
    return Object.keys(completions).filter(function(k) {
      return k.indexOf(id + ':') === 0 && completions[k];
    }).length;
  }

  function formatFreq(freq) {
    if (!freq || freq === 'daily') return 'Daily';
    if (!Array.isArray(freq)) return 'Daily';
    if (freq.length === 7) return 'Daily';
    if (freq.length === 5 && freq.indexOf(0) === -1 && freq.indexOf(6) === -1) return 'Weekdays';
    if (freq.length === 2 && freq.indexOf(0) !== -1 && freq.indexOf(6) !== -1) return 'Weekends';
    return freq.slice().sort(function(a,b){return a-b;}).map(function(d){ return DAY_SHORT[d]; }).join(', ');
  }

  /* ── Toast helper ───────────────────────────────────────────────────── */
  function toast(msg, type, dur) {
    if (typeof window._homerToast === 'function') {
      window._homerToast({ message: msg, type: type || 'info', duration: dur || 3000 });
    }
  }

  /* ── Open / Close ───────────────────────────────────────────────────── */
  function openOverlay() {
    var ov = document.getElementById('habits-overlay');
    if (!ov) return;
    _view = 'today';
    _editId = null;
    _showAdd = false;
    ov.style.display = 'block';
    document.body.style.overflow = 'hidden';
    if (typeof window._homerSyncPageScrollLock === 'function') window._homerSyncPageScrollLock();
    render();
  }

  function closeOverlay() {
    var ov = document.getElementById('habits-overlay');
    if (ov) ov.style.display = 'none';
    if (typeof window._homerSyncPageScrollLock === 'function') window._homerSyncPageScrollLock();
    else document.body.style.overflow = '';
    updateBadge();
  }

  /* ── Badge ──────────────────────────────────────────────────────────── */
  function updateBadge() {
    var countEl = document.getElementById('vd-habits-count');
    var descEl = document.getElementById('vd-habits-desc');
    if (!countEl && !descEl) return;
    var d = getData();
    var active = d.habits.filter(function(h) { return !h.archived; });
    var sched = active.filter(isScheduledToday);
    var done = sched.filter(function(h) { return isDoneToday(d.completions, h); });
    if (countEl) {
      countEl.textContent = sched.length > 0 ? done.length + '/' + sched.length : String(active.length);
    }
    if (descEl) {
      if (sched.length === 0 && active.length === 0) {
        descEl.textContent = 'Build powerful daily habits';
      } else if (sched.length > 0) {
        if (done.length === sched.length) {
          descEl.textContent = 'All done today! Great work';
        } else {
          descEl.textContent = done.length + ' of ' + sched.length + ' done today';
        }
      } else {
        descEl.textContent = active.length + ' habit' + (active.length !== 1 ? 's' : '') + ' tracked';
      }
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  function render() {
    var root = document.getElementById('habits-app-root');
    if (!root) return;
    var d = getData();
    root.innerHTML = buildLayout(d);
    wireLayout(d);
  }

  /* ── Layout ─────────────────────────────────────────────────────────── */
  function buildLayout(d) {
    return '<div class="vh-wrap">' +
      '<div class="vh-tabs">' +
        '<button class="vh-tab' + (_view==='today'?' active':'') + '" data-view="today">Today</button>' +
        '<button class="vh-tab' + (_view==='stats'?' active':'') + '" data-view="stats">Stats</button>' +
        '<button class="vh-tab' + (_view==='manage'?' active':'') + '" data-view="manage">Manage Habits</button>' +
      '</div>' +
      '<div class="vh-body">' +
        (_view === 'today' ? buildToday(d) : '') +
        (_view === 'stats' ? buildStats(d) : '') +
        (_view === 'manage' ? buildManage(d) : '') +
      '</div>' +
    '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════════
   * TODAY VIEW
   * ═══════════════════════════════════════════════════════════════════ */
  function buildToday(d) {
    var active = d.habits.filter(function(h) { return !h.archived; });
    if (!active.length) {
      return '<div class="vh-empty">' +
        '<div style="font-size:3rem;margin-bottom:16px">🌱</div>' +
        '<h3 style="color:#e5e7eb;margin:0 0 8px;font-weight:900">No habits yet</h3>' +
        '<p style="color:#64748b;margin:0 0 22px;font-size:.9rem">Add your first habit to get started</p>' +
        '<button class="vh-btn-primary" id="vh-goto-manage">+ Add First Habit</button>' +
      '</div>';
    }

    var now = new Date();
    var hr = now.getHours();
    var greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    var dayName = DAY_NAMES[now.getDay()];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var dateLabel = dayName + ', ' + months[now.getMonth()] + ' ' + now.getDate();

    var sched = active.filter(isScheduledToday);
    var doneCount = sched.filter(function(h) { return isDoneToday(d.completions, h); }).length;
    var total = sched.length;
    var pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    var allDone = total > 0 && doneCount === total;

    var motivMsg = doneCount === 0 ? "Let's make today count!" :
                   allDone ? "You crushed it today!" :
                   pct >= 75 ? "Almost there, keep going!" :
                   pct >= 40 ? "Great progress, keep it up!" :
                   "Good start, stay on it!";

    var r = 36, circ = 2 * Math.PI * r;
    var dash = (pct / 100) * circ;
    var ringColor = allDone ? '#34d399' : '#3b82f6';

    var ringHtml = '<svg width="90" height="90" viewBox="0 0 100 100">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + ringColor + '" stroke-width="8"' +
      ' stroke-linecap="round"' +
      ' stroke-dasharray="' + circ.toFixed(1) + '"' +
      ' stroke-dashoffset="' + (circ - dash).toFixed(1) + '"' +
      ' transform="rotate(-90 50 50)" style="transition:stroke-dashoffset .6s ease"/>' +
      '<text x="50" y="46" text-anchor="middle" fill="#e5e7eb" font-size="20" font-weight="900" font-family="inherit">' + doneCount + '</text>' +
      '<text x="50" y="62" text-anchor="middle" fill="#64748b" font-size="10" font-family="inherit">of ' + total + '</text>' +
    '</svg>';

    var header = '<div class="vh-today-header">' +
      '<div>' +
        '<div class="vh-date">' + dateLabel + '</div>' +
        '<div class="vh-greeting-text">' + greeting + '!</div>' +
        '<div class="vh-motiv">' + motivMsg + '</div>' +
      '</div>' +
      '<div class="vh-ring-wrap">' + ringHtml + '<div class="vh-pct-label">' + pct + '% done</div></div>' +
    '</div>';

    var today = todayStr();
    var cardHtml = sched.map(function(h) { return buildHabitCard(h, d.completions, today); }).join('');
    if (!cardHtml) cardHtml = '<div class="vh-empty-today"><p style="margin:0">No habits scheduled for today.</p></div>';

    var allDoneHtml = allDone && total > 0 ? '<div class="vh-all-done">' +
      '<div class="vh-all-done-icon">🎉</div>' +
      '<div class="vh-all-done-title">All habits complete!</div>' +
      '<div class="vh-all-done-sub">Amazing work — you\'re building serious momentum.</div>' +
    '</div>' : '';

    // Non-scheduled habits for today
    var notToday = active.filter(function(h) { return !isScheduledToday(h); });
    var notTodayHtml = '';
    if (notToday.length) {
      notTodayHtml = '<div class="vh-section-label" style="margin-top:22px">Not scheduled today</div>' +
        '<div class="vh-not-today">' +
        notToday.map(function(h) {
          return '<span class="vh-skip-chip" style="border-color:' + (h.color || '#334155') + '">' +
            (h.emoji || '⭐') + ' ' + esc(h.name) + '</span>';
        }).join('') +
        '</div>';
    }

    return header +
      '<div class="vh-section-label">Today\'s habits</div>' +
      '<div class="vh-habits-list">' + cardHtml + '</div>' +
      allDoneHtml +
      notTodayHtml;
  }

  function buildHabitCard(h, completions, today) {
    var done = isDoneToday(completions, h);
    var cnt = getDone(completions, h.id, today);
    var target = getTarget(h);
    var s = calcStreak(completions, h);
    var color = h.color || '#3b82f6';

    // 7-day dots
    var dots = '';
    for (var i = 6; i >= 0; i--) {
      var d2 = daysAgo(i);
      var dk = toDateStr(d2);
      var isDot = getDone(completions, h.id, dk) >= target;
      var isSched = isScheduled(h, d2);
      dots += '<span class="vh-dot' + (isDot ? ' done' : '') + (i === 0 ? ' today' : '') + (!isSched ? ' skip' : '') + '"' +
        (isDot ? ' style="background:' + color + '"' : '') + ' title="' + dk + '"></span>';
    }

    var actionHtml = '';
    if (target > 1) {
      actionHtml = '<div class="vh-counter">' +
        '<button class="vh-cnt-btn" data-action="dec" data-id="' + h.id + '">&#8722;</button>' +
        '<span class="vh-cnt-val" style="color:' + (done ? color : '#94a3b8') + '">' + cnt + '/' + target + '</span>' +
        '<button class="vh-cnt-btn" data-action="inc" data-id="' + h.id + '">+</button>' +
      '</div>';
    } else {
      actionHtml = '<button class="vh-check' + (done ? ' done' : '') + '" data-id="' + h.id + '"' +
        (done ? ' style="background:' + color + ';border-color:' + color + '"' : '') + '>' +
        (done ? '&#10003;' : '') +
      '</button>';
    }

    return '<div class="vh-card' + (done ? ' vh-card-done' : '') + '" data-id="' + h.id + '">' +
      '<div class="vh-card-color-strip" style="background:' + color + '"></div>' +
      '<div class="vh-card-icon">' + (h.emoji || '⭐') + '</div>' +
      '<div class="vh-card-body">' +
        '<div class="vh-card-name">' + esc(h.name) + '</div>' +
        '<div class="vh-card-meta">' +
          '<span class="vh-cat-pill">' + (CAT_EMOJI[h.category] || '⭐') + ' ' + esc(h.category || 'other') + '</span>' +
          (s > 0 ? '<span class="vh-streak-pill">&#x1F525; ' + s + ' day' + (s !== 1 ? 's' : '') + '</span>' : '') +
        '</div>' +
        '<div class="vh-dots">' + dots + '</div>' +
      '</div>' +
      '<div class="vh-card-action">' + actionHtml + '</div>' +
    '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════════
   * STATS VIEW
   * ═══════════════════════════════════════════════════════════════════ */
  function buildStats(d) {
    var active = d.habits.filter(function(h) { return !h.archived; });
    if (!active.length) {
      return '<div class="vh-empty"><div style="font-size:3rem;margin-bottom:16px">&#128202;</div>' +
        '<p style="color:#64748b">Add habits first to see your stats.</p></div>';
    }
    if (!_statsId || !active.find(function(h){ return h.id === _statsId; })) {
      _statsId = active[0].id;
    }
    var h = active.find(function(h) { return h.id === _statsId; });
    var color = h.color || '#3b82f6';
    var target = getTarget(h);

    var s = calcStreak(d.completions, h);
    var bs = calcBestStreak(d.completions, h);
    var rate30 = calcRate(d.completions, h, 30);
    var total = calcTotal(d.completions, h.id);

    var selector = '<select id="vh-stats-sel" class="vh-select">' +
      active.map(function(opt) {
        return '<option value="' + opt.id + '"' + (opt.id === h.id ? ' selected' : '') + '>' +
          (opt.emoji || '⭐') + ' ' + esc(opt.name) + '</option>';
      }).join('') +
    '</select>';

    var statCards = '<div class="vh-stat-cards">' +
      '<div class="vh-stat-card"><div class="vh-stat-val" style="color:' + color + '">&#x1F525; ' + s + '</div><div class="vh-stat-lbl">Current streak</div></div>' +
      '<div class="vh-stat-card"><div class="vh-stat-val" style="color:#fbbf24">&#11088; ' + bs + '</div><div class="vh-stat-lbl">Best streak</div></div>' +
      '<div class="vh-stat-card"><div class="vh-stat-val" style="color:#34d399">' + rate30 + '%</div><div class="vh-stat-lbl">Last 30 days</div></div>' +
      '<div class="vh-stat-card"><div class="vh-stat-val" style="color:#60a5fa">' + total + '</div><div class="vh-stat-lbl">Total done</div></div>' +
    '</div>';

    var heatmap = buildHeatmap(d.completions, h, color, target);
    var weekly = buildWeeklyPattern(d.completions, h, color, target);

    return '<div class="vh-stats-top">' +
      '<div><div style="font-size:.72rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Habit</div>' +
      selector + '</div>' +
    '</div>' +
    statCards +
    '<div class="vh-section-label" style="margin-top:26px">52-Week Heatmap</div>' +
    heatmap +
    '<div class="vh-section-label" style="margin-top:24px">Weekly Pattern <span style="font-size:.65rem;color:#64748b;text-transform:none;letter-spacing:0;font-weight:400">(last 90 days)</span></div>' +
    weekly;
  }

  function buildHeatmap(completions, h, color, target) {
    var today = todayStr();
    var todayDate = new Date(); todayDate.setHours(0,0,0,0);

    // Align start to Sunday, ~52 weeks ago
    var startDate = daysAgo(363);
    var startDay = startDate.getDay();
    var alignedStart = new Date(startDate);
    alignedStart.setDate(alignedStart.getDate() - startDay);

    var weeks = [], week = [], cur = new Date(alignedStart);
    while (weeks.length < 53) {
      var dk = toDateStr(cur);
      var isFuture = cur > todayDate;
      var isSched = isScheduled(h, cur);
      var cnt = isFuture ? 0 : getDone(completions, h.id, dk);
      var isDone2 = !isFuture && cnt >= target;
      var isPartial = !isFuture && cnt > 0 && cnt < target;

      week.push({
        dk: dk, future: isFuture, done: isDone2, partial: isPartial,
        scheduled: isSched, isToday: dk === today
      });
      if (week.length === 7) { weeks.push(week); week = []; if (weeks.length >= 53) break; }
      cur.setDate(cur.getDate() + 1);
    }
    // Keep last 52 weeks
    if (weeks.length > 52) weeks = weeks.slice(weeks.length - 52);

    var rowLabels = '<div class="vh-hm-row-labels">' +
      ['','Mo','','We','','Fr',''].map(function(l) {
        return '<div class="vh-hm-lbl">' + l + '</div>';
      }).join('') +
    '</div>';

    var weeksHtml = '<div class="vh-hm-weeks">' +
      weeks.map(function(wk) {
        return '<div class="vh-hm-week">' +
          wk.map(function(cell) {
            var bg = '';
            if (cell.future) bg = 'rgba(255,255,255,.02)';
            else if (cell.done) bg = color;
            else if (cell.partial) bg = color.replace('#','') + '50';
            else if (cell.scheduled) bg = 'rgba(255,255,255,.06)';
            else bg = 'rgba(255,255,255,.02)';
            var style = 'background:' + (cell.done && color.startsWith('#') ? color : bg) + ';';
            if (cell.partial && color.startsWith('#')) {
              // semi-transparent partial
              style = 'background:' + color + ';opacity:.35;';
            }
            if (cell.isToday) style += 'outline:1.5px solid #60a5fa;outline-offset:1px;';
            return '<span class="vh-hm-cell' +
              (cell.isToday ? ' today' : '') +
              (!cell.scheduled ? ' skip' : '') +
              (cell.future ? ' future' : '') + '"' +
              ' style="' + style + '" title="' + cell.dk + (cell.done ? ' ✓' : '') + '"></span>';
          }).join('') +
        '</div>';
      }).join('') +
    '</div>';

    var legend = '<div class="vh-hm-legend">' +
      '<span style="color:#64748b;font-size:.72rem">Less</span>' +
      ['rgba(255,255,255,.06)', color + '55', color + 'aa', color].map(function(bg, i) {
        var st = bg.startsWith('#') ? 'background:' + bg + ';opacity:' + [0.3,0.6,0.85,1][i] : 'background:' + bg;
        return '<span class="vh-hm-cell" style="' + st + '"></span>';
      }).join('') +
      '<span style="color:#64748b;font-size:.72rem">More</span>' +
    '</div>';

    return '<div class="vh-heatmap-scroll">' +
      '<div class="vh-heatmap-inner">' + rowLabels + weeksHtml + '</div>' +
      legend +
    '</div>';
  }

  function buildWeeklyPattern(completions, h, color, target) {
    var totals = [0,0,0,0,0,0,0];
    var counts = [0,0,0,0,0,0,0];
    for (var i = 0; i < 90; i++) {
      var d2 = daysAgo(i);
      var day = d2.getDay();
      if (isScheduled(h, d2)) {
        counts[day]++;
        if (getDone(completions, h.id, toDateStr(d2)) >= target) totals[day]++;
      }
    }
    var maxRate = 0;
    for (var j = 0; j < 7; j++) {
      if (counts[j] > 0) { var r = totals[j] / counts[j]; if (r > maxRate) maxRate = r; }
    }

    return '<div class="vh-weekly-pattern">' +
      DAY_NAMES.map(function(name, i) {
        var rate = counts[i] > 0 ? totals[i] / counts[i] : 0;
        var barH = maxRate > 0 ? Math.max(3, Math.round((rate / maxRate) * 52)) : 3;
        var pctTxt = counts[i] > 0 ? Math.round(rate * 100) + '%' : '—';
        return '<div class="vh-wp-col">' +
          '<div class="vh-wp-bar-wrap">' +
            '<div class="vh-wp-bar" style="height:' + barH + 'px;background:' + color + '" title="' + name + ': ' + pctTxt + '"></div>' +
          '</div>' +
          '<div class="vh-wp-label">' + name.slice(0,3) + '</div>' +
          '<div class="vh-wp-pct">' + pctTxt + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════════
   * MANAGE VIEW
   * ═══════════════════════════════════════════════════════════════════ */
  function buildManage(d) {
    var active = d.habits.filter(function(h) { return !h.archived; });
    var archived = d.habits.filter(function(h) { return h.archived; });

    var formHtml = (_showAdd || _editId) ? buildForm(d) : '';
    var addBtnHtml = (!_showAdd && !_editId) ?
      '<button class="vh-btn-primary" id="vh-add-btn">+ Add New Habit</button>' : '';

    var listHtml = active.length > 0 ?
      active.map(function(h) { return buildManageRow(h, false); }).join('') :
      '<div class="vh-empty-today" style="margin-top:0"><p style="margin:0;color:#64748b">No active habits yet. Add one above!</p></div>';

    var archivedHtml = archived.length ? (
      '<div class="vh-archived-toggle" id="vh-arch-toggle">' +
        '<span>' + (_showArchived ? '&#9660;' : '&#9658;') + ' Archived (' + archived.length + ')</span>' +
      '</div>' +
      (_showArchived ? '<div class="vh-archived-list">' + archived.map(function(h) { return buildManageRow(h, true); }).join('') + '</div>' : '')
    ) : '';

    return '<div class="vh-manage-head">' + addBtnHtml + formHtml + '</div>' +
      '<div class="vh-manage-list">' + listHtml + '</div>' +
      archivedHtml;
  }

  function buildManageRow(h, isArch) {
    var color = h.color || '#3b82f6';
    return '<div class="vh-manage-row' + (isArch ? ' archived' : '') + '">' +
      '<div class="vh-mr-strip" style="background:' + color + '"></div>' +
      '<div class="vh-mr-icon">' + (h.emoji || '⭐') + '</div>' +
      '<div class="vh-mr-info">' +
        '<div class="vh-mr-name">' + esc(h.name) + '</div>' +
        '<div class="vh-mr-meta">' + esc(h.category || 'other') + ' &middot; ' + formatFreq(h.freq) +
          (h.target > 1 ? ' &middot; ' + h.target + '&times; per day' : '') +
        '</div>' +
      '</div>' +
      '<div class="vh-mr-actions">' +
        (!isArch ? '<button class="vh-mr-btn" data-action="edit" data-id="' + h.id + '" title="Edit">&#9998;</button>' : '') +
        '<button class="vh-mr-btn" data-action="' + (isArch ? 'unarchive' : 'archive') + '" data-id="' + h.id + '" title="' + (isArch ? 'Restore' : 'Archive') + '">' +
          (isArch ? '&#9851;' : '&#128230;') +
        '</button>' +
        '<button class="vh-mr-btn del" data-action="delete" data-id="' + h.id + '" title="Delete">&#128465;</button>' +
      '</div>' +
    '</div>';
  }

  /* ── Habit Form ──────────────────────────────────────────────────────── */
  function buildForm(d) {
    var isEdit = !!_editId;
    var h = {};
    if (isEdit) h = d.habits.find(function(x) { return x.id === _editId; }) || {};

    var selColor = h.color || COLORS[0];
    var selEmoji = h.emoji || '🏃';
    var selCat = h.category || 'health';
    var selFreq = h.freq || 'daily';
    var selTarget = h.target || 1;
    var isCustomFreq = Array.isArray(selFreq);
    var freqDays = isCustomFreq ? selFreq : [];

    var colorBtns = COLORS.map(function(c) {
      return '<button class="vh-color-btn' + (selColor === c ? ' active' : '') + '" data-color="' + c + '" type="button" style="background:' + c + '"></button>';
    }).join('');

    var emojiBtns = DEFAULT_EMOJIS.map(function(em) {
      return '<button class="vh-emoji-btn' + (selEmoji === em ? ' active' : '') + '" data-emoji="' + em + '" type="button">' + em + '</button>';
    }).join('');

    var catOptions = CATS.map(function(c) {
      return '<option value="' + c + '"' + (selCat === c ? ' selected' : '') + '>' + (CAT_EMOJI[c] || '⭐') + ' ' + c + '</option>';
    }).join('');

    var dayBtns = DAY_SHORT.map(function(dn, i) {
      return '<label class="vh-day-btn' + (freqDays.indexOf(i) !== -1 ? ' active' : '') + '">' +
        '<input type="checkbox" name="vh-day" value="' + i + '"' + (freqDays.indexOf(i) !== -1 ? ' checked' : '') + '>' +
        '<span>' + dn + '</span>' +
      '</label>';
    }).join('');

    return '<div class="vh-form" id="vh-form">' +
      '<div class="vh-form-title">' + (isEdit ? '&#9998; Edit Habit' : '+ New Habit') + '</div>' +
      '<div class="vh-form-row">' +
        '<div class="vh-form-group" style="flex:1">' +
          '<label class="vh-form-label">Name</label>' +
          '<input class="vh-input" id="vh-f-name" type="text" placeholder="e.g. Morning Run" value="' + esc(h.name || '') + '" maxlength="50" autocomplete="off">' +
        '</div>' +
      '</div>' +
      '<div class="vh-form-row">' +
        '<div class="vh-form-group">' +
          '<label class="vh-form-label">Icon</label>' +
          '<div class="vh-emoji-grid">' + emojiBtns + '</div>' +
          '<input class="vh-input vh-emoji-input" id="vh-f-emoji-custom" type="text" placeholder="Or type any emoji" maxlength="4" value="" style="margin-top:6px">' +
        '</div>' +
      '</div>' +
      '<div class="vh-form-row">' +
        '<div class="vh-form-group">' +
          '<label class="vh-form-label">Color</label>' +
          '<div class="vh-color-row">' + colorBtns + '</div>' +
        '</div>' +
        '<div class="vh-form-group">' +
          '<label class="vh-form-label">Category</label>' +
          '<select class="vh-select" id="vh-f-cat">' + catOptions + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="vh-form-row">' +
        '<div class="vh-form-group">' +
          '<label class="vh-form-label">Schedule</label>' +
          '<div class="vh-freq-row">' +
            '<label class="vh-freq-opt"><input type="radio" name="vh-freq" value="daily"' + (!isCustomFreq ? ' checked' : '') + '> Daily</label>' +
            '<label class="vh-freq-opt"><input type="radio" name="vh-freq" value="custom"' + (isCustomFreq ? ' checked' : '') + '> Custom</label>' +
          '</div>' +
          '<div class="vh-freq-days' + (!isCustomFreq ? ' hidden' : '') + '" id="vh-freq-days">' + dayBtns + '</div>' +
        '</div>' +
        '<div class="vh-form-group">' +
          '<label class="vh-form-label">Daily target <span class="vh-form-hint">(reps)</span></label>' +
          '<div class="vh-target-row">' +
            '<button type="button" class="vh-cnt-btn" id="vh-t-dec">&#8722;</button>' +
            '<span class="vh-target-val" id="vh-t-val">' + selTarget + '</span>' +
            '<button type="button" class="vh-cnt-btn" id="vh-t-inc">+</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="vh-form-row">' +
        '<div class="vh-form-group" style="flex:1">' +
          '<label class="vh-form-label">Motivation <span class="vh-form-hint">(optional)</span></label>' +
          '<input class="vh-input" id="vh-f-note" type="text" placeholder="Why does this habit matter?" value="' + esc(h.note || '') + '" maxlength="120">' +
        '</div>' +
      '</div>' +
      '<div class="vh-form-actions">' +
        '<button class="vh-btn-ghost" id="vh-f-cancel" type="button">Cancel</button>' +
        '<button class="vh-btn-primary" id="vh-f-save" type="button">' + (isEdit ? 'Save Changes' : 'Add Habit') + '</button>' +
      '</div>' +
    '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════════
   * WIRE EVENTS
   * ═══════════════════════════════════════════════════════════════════ */
  function wireLayout(d) {
    var root = document.getElementById('habits-app-root');
    if (!root) return;

    root.querySelectorAll('.vh-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _view = this.dataset.view;
        _editId = null; _showAdd = false;
        render();
      });
    });

    if (_view === 'today') wireToday(d);
    if (_view === 'stats') wireStats();
    if (_view === 'manage') wireManage(d);
  }

  function wireToday(d) {
    var gotoManage = document.getElementById('vh-goto-manage');
    if (gotoManage) gotoManage.addEventListener('click', function() { _view = 'manage'; render(); });

    var root = document.getElementById('habits-app-root');

    root.querySelectorAll('.vh-check').forEach(function(btn) {
      btn.addEventListener('click', function() {
        toggleHabit(parseInt(this.dataset.id));
      });
    });

    root.querySelectorAll('.vh-cnt-btn[data-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = parseInt(this.dataset.id);
        var action = this.dataset.action;
        if (!id) return;
        adjustCount(id, action === 'inc' ? 1 : -1);
      });
    });
  }

  function toggleHabit(id) {
    var d = getData();
    var h = d.habits.find(function(x) { return x.id === id; });
    if (!h) return;
    var key = id + ':' + todayStr();
    var wasDone = !!d.completions[key];
    if (wasDone) {
      delete d.completions[key];
    } else {
      d.completions[key] = true;
      var s = calcStreak(d.completions, h);
      checkMilestone(h, s);
      toast((h.emoji || '✅') + ' ' + h.name + ' — done!', 'success', 1800);
    }
    saveData(d);
    render();
  }

  function adjustCount(id, delta) {
    var d = getData();
    var h = d.habits.find(function(x) { return x.id === id; });
    if (!h) return;
    var key = id + ':' + todayStr();
    var cur = getDone(d.completions, id, todayStr());
    var next = Math.max(0, cur + delta);
    var target = getTarget(h);
    if (next === 0) delete d.completions[key];
    else d.completions[key] = next;
    if (next >= target && cur < target) {
      var s = calcStreak(d.completions, h);
      checkMilestone(h, s);
      toast((h.emoji || '✅') + ' ' + h.name + ' target met!', 'success', 1800);
    }
    saveData(d);
    render();
  }

  function checkMilestone(h, s) {
    if ([3,7,14,21,30,60,90,100,180,365].indexOf(s) !== -1) {
      setTimeout(function() {
        toast('&#x1F3C6; ' + s + '-day streak: "' + h.name + '"!', 'success', 5000);
      }, 900);
    }
  }

  function wireStats() {
    var sel = document.getElementById('vh-stats-sel');
    if (sel) sel.addEventListener('change', function() { _statsId = parseInt(this.value); render(); });
  }

  function wireManage(d) {
    var addBtn = document.getElementById('vh-add-btn');
    if (addBtn) addBtn.addEventListener('click', function() { _showAdd = true; _editId = null; render(); });

    var archToggle = document.getElementById('vh-arch-toggle');
    if (archToggle) archToggle.addEventListener('click', function() { _showArchived = !_showArchived; render(); });

    document.getElementById('habits-app-root').querySelectorAll('.vh-mr-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = this.dataset.action;
        var id = parseInt(this.dataset.id);
        var d2 = getData();
        if (action === 'delete') {
          if (!confirm('Delete "' + (d2.habits.find(function(x){return x.id===id;})||{name:''}).name + '" and all its history?')) return;
          d2.habits = d2.habits.filter(function(x) { return x.id !== id; });
          Object.keys(d2.completions).forEach(function(k) {
            if (k.indexOf(id + ':') === 0) delete d2.completions[k];
          });
          saveData(d2); render();
        } else if (action === 'archive' || action === 'unarchive') {
          var h = d2.habits.find(function(x) { return x.id === id; });
          if (h) h.archived = (action === 'archive');
          saveData(d2); render();
        } else if (action === 'edit') {
          _editId = id; _showAdd = false; render();
        }
      });
    });

    if (_showAdd || _editId) wireForm();
  }

  function wireForm() {
    var form = document.getElementById('vh-form');
    if (!form) return;

    // Cancel
    var cancelBtn = document.getElementById('vh-f-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function() { _showAdd = false; _editId = null; render(); });

    // Emoji grid
    form.querySelectorAll('.vh-emoji-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        form.querySelectorAll('.vh-emoji-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
      });
    });

    // Custom emoji input
    var customEmojiInp = document.getElementById('vh-f-emoji-custom');
    if (customEmojiInp) {
      customEmojiInp.addEventListener('input', function() {
        var val = this.value.trim();
        if (val) {
          form.querySelectorAll('.vh-emoji-btn').forEach(function(b) { b.classList.remove('active'); });
        }
      });
    }

    // Color
    form.querySelectorAll('.vh-color-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        form.querySelectorAll('.vh-color-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
      });
    });

    // Frequency toggle
    form.querySelectorAll('[name="vh-freq"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var daysEl = document.getElementById('vh-freq-days');
        if (daysEl) daysEl.classList.toggle('hidden', this.value === 'daily');
      });
    });

    // Day checkboxes
    form.querySelectorAll('.vh-day-btn').forEach(function(label) {
      label.querySelector('input').addEventListener('change', function() {
        label.classList.toggle('active', this.checked);
      });
    });

    // Target stepper
    var tVal = document.getElementById('vh-t-val');
    document.getElementById('vh-t-dec').addEventListener('click', function() {
      var v = parseInt(tVal.textContent); if (v > 1) tVal.textContent = v - 1;
    });
    document.getElementById('vh-t-inc').addEventListener('click', function() {
      var v = parseInt(tVal.textContent); if (v < 20) tVal.textContent = v + 1;
    });

    // Save
    document.getElementById('vh-f-save').addEventListener('click', function() {
      var name = (document.getElementById('vh-f-name').value || '').trim();
      if (!name) { document.getElementById('vh-f-name').focus(); toast('Please enter a habit name', 'warn'); return; }

      // Emoji: prefer grid selection, fall back to custom input
      var activeEmojiBtn = form.querySelector('.vh-emoji-btn.active');
      var customEmoji = (document.getElementById('vh-f-emoji-custom').value || '').trim();
      var emoji = (customEmoji ? customEmoji.slice(0,2) : null) || (activeEmojiBtn && activeEmojiBtn.dataset.emoji) || '⭐';

      var colorBtn = form.querySelector('.vh-color-btn.active');
      var color = colorBtn ? colorBtn.dataset.color : COLORS[0];
      var category = document.getElementById('vh-f-cat').value;
      var note = (document.getElementById('vh-f-note').value || '').trim();
      var target2 = parseInt(document.getElementById('vh-t-val').textContent) || 1;

      var freqRadio = form.querySelector('[name="vh-freq"]:checked');
      var freq = 'daily';
      if (freqRadio && freqRadio.value === 'custom') {
        var checked = Array.from(form.querySelectorAll('[name="vh-day"]:checked')).map(function(inp) { return parseInt(inp.value); });
        freq = checked.length ? checked : 'daily';
      }

      var d2 = getData();
      if (_editId) {
        var h = d2.habits.find(function(x) { return x.id === _editId; });
        if (h) { h.name = name; h.emoji = emoji; h.color = color; h.category = category; h.note = note; h.target = target2; h.freq = freq; }
      } else {
        d2.habits.push({ id: Date.now(), name: name, emoji: emoji, color: color, category: category, note: note, target: target2, freq: freq, archived: false, created: Date.now() });
      }
      saveData(d2);
      toast(_editId ? '&#10003; Habit updated' : '&#10003; Habit added', 'success', 2000);
      _showAdd = false; _editId = null;
      render();
    });
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  ready(function() {
    // Wire vault tile
    var tile = document.getElementById('vd-open-habits');
    if (tile) tile.addEventListener('click', openOverlay);

    // Wire close button
    var closeBtn = document.querySelector('#habits-overlay .vault-ov-close');
    if (closeBtn) closeBtn.addEventListener('click', closeOverlay);

    // Esc to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var ov = document.getElementById('habits-overlay');
        if (ov && ov.style.display !== 'none') closeOverlay();
      }
    });

    // Initial badge
    updateBadge();
    setInterval(updateBadge, 60000); // refresh on minute (midnight rollover)

    // Re-badge after Supabase sync pulls new data
    window.addEventListener('storage', function(e) {
      if (e && e.key === KEY) updateBadge();
    });
  });

})();
