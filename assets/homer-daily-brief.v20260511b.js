/* ====================================================================
 * Homer Daily Brief  v20260511c
 * Bogdan-only tab: in-progress tasks, weather, habits, life goals.
 * Morning-only: auto-opens on login before 14:00, requires daily ack.
 *
 * SYNC POLICY (Bogdan only):
 *   - Vault encrypted blob  → joey_meta  every 8s (hash-dedup)
 *   - Habits                → joey_meta  every 8s (hash-dedup)
 *   - zen-goal / brain-dump → joey_meta  every 8s (hash-dedup)
 *   - links, pom, cal, etc  → field_state via app-shell (already handled)
 *
 * For any other user or no user all data stays in browser cache only.
 * ==================================================================== */
(function () {
  'use strict';

  var BOGDAN_USER   = 'bogdan';
  var ACK_KEY = 'homer-daily-brief-ack';
  var MORNING_CUTOFF_HOUR = 14; // show sidebar button + auto-open until 14:00
  var VAULT_IDB_NAME  = 'homer-vault-idb';
  var VAULT_IDB_STORE = 'kv';
  var VAULT_SALT_KEY  = 'homer-vault-salt';
  var VAULT_DATA_KEY  = 'homer-vault-data';
  var VAULT_SUPA_TS_KEY   = 'homer-vault-supa-ts';
  var VAULT_SUPA_META_KEY = 'vault_encrypted_blob';
  var HABITS_KEY      = 'homer-habits';
  var HABITS_SYNC_KEY = 'homer-habits-supa-ts';
  var ZEN_KEY   = 'homer-zen-goal';
  var BRAIN_KEY = 'homer-brain-dump';
  var EXTRAS_SYNC_TS  = 'homer-extras-supa-ts';

  /* ── Helpers ──────────────────────────────────────────────────────── */
  function isBogdan() {
    if (String(localStorage.getItem('homer-auth-user') || '').trim().toLowerCase() === BOGDAN_USER) return true;
    // Fallback: Supabase session may be restored before Homer auth fires
    try {
      var s = window.__sbSession;
      if (s && s.user && s.user.email && s.user.email.toLowerCase() === 'bogdan.radu@b4it.ro') return true;
    } catch (_) {}
    return false;
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function safeJson(s, fb) { try { return s ? JSON.parse(s) : fb; } catch (_) { return fb; } }

  function hasAckedToday() { return localStorage.getItem(ACK_KEY) === todayStr(); }
  function isInMorningWindow() { return new Date().getHours() < MORNING_CUTOFF_HOUR; }

  function ackToday() {
    try { localStorage.setItem(ACK_KEY, todayStr()); } catch (_) {}
    var banner = document.getElementById('db-ack-banner');
    if (banner) banner.remove();
    var sbBtn = document.getElementById('db-sb-btn');
    if (sbBtn) sbBtn.style.display = 'none';
    var orig = window._homerShowTab;
    if (orig) orig('home');
  }

  /* simple non-crypto hash for change detection */
  function quickHash(str) {
    var h = 0, s = String(str || '');
    for (var i = 0; i < Math.min(s.length, 8000); i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h.toString(36);
  }

  /* deterministic project color from key/id string */
  var PROJECT_COLORS = ['#60a5fa','#a78bfa','#34d399','#fb923c','#f472b6','#38bdf8','#facc15','#4ade80'];
  function projectColor(str) {
    var h = 0, s = String(str || '');
    for (var i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return PROJECT_COLORS[Math.abs(h) % PROJECT_COLORS.length];
  }

  var IN_PROGRESS_COL = 'progress'; // kanban column field (g.col)
  var IN_PROGRESS_STATUSES = new Set(['progress','doing','active','in_progress','in-progress','inprogress','wip','started','ongoing']); // legacy g.status field

  /* ── CSS ──────────────────────────────────────────────────────────── */
  var CSS = `
    #tab-daily-brief { display:none; }
    #db-tab-btn { display:inline-block !important; }

    .db-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
    .db-header-left h2 { font-size:1.35rem; font-weight:900; color:var(--text); margin:0 0 4px; }
    .db-header-left p  { font-size:.85rem; color:var(--muted); margin:0; }

    .db-refresh-btn { padding:8px 16px; border-radius:10px; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.05); color:var(--muted); font-size:.82rem; font-weight:700; cursor:pointer; font-family:inherit; transition:all .15s; }
    .db-refresh-btn:hover { background:rgba(255,255,255,.1); color:var(--text); }

    .db-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:16px; margin-top:16px; }
    .db-grid.full-width { grid-template-columns:1fr; }

    .db-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:20px; }
    .db-card-title { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#64748b; margin-bottom:14px; }

    /* Weather */
    .db-weather { display:flex; align-items:center; gap:16px; }
    .db-wx-icon { font-size:2.6rem; line-height:1; }
    .db-wx-info { flex:1; }
    .db-wx-temp { font-size:2rem; font-weight:900; color:var(--text); line-height:1; }
    .db-wx-desc { font-size:.85rem; color:var(--muted); margin-top:4px; }
    .db-wx-place { font-size:.78rem; color:#64748b; margin-top:2px; }

    /* ── Creative task cards ── */
    .db-tasks-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; margin-top:4px; }
    .db-tcard { position:relative; border-radius:12px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); padding:14px 14px 12px 18px; overflow:hidden; transition:border-color .15s; }
    .db-tcard:hover { border-color:rgba(255,255,255,.18); }
    .db-tcard-stripe { position:absolute; left:0; top:0; bottom:0; width:4px; border-radius:12px 0 0 12px; }
    .db-tcard-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px; }
    .db-tcard-title { font-size:.9rem; font-weight:700; color:var(--text); line-height:1.35; flex:1; min-width:0; }
    .db-tcard-proj { font-size:.63rem; font-weight:800; padding:2px 7px; border-radius:6px; white-space:nowrap; flex-shrink:0; margin-top:2px; }
    .db-tcard-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:6px; }
    .db-tcard-id   { font-size:.7rem; color:#475569; font-family:monospace; }
    .db-tcard-pri  { font-size:.67rem; font-weight:700; padding:1px 6px; border-radius:5px; }
    .db-tcard-pri.high   { background:rgba(248,113,113,.15); color:#f87171; }
    .db-tcard-pri.medium { background:rgba(251,191,36,.12);  color:#fbbf24; }
    .db-tcard-pri.low    { background:rgba(52,211,153,.12);  color:#34d399; }
    .db-tcard-subs { font-size:.7rem; color:#64748b; }
    .db-tcard-due  { font-size:.7rem; color:#94a3b8; }

    /* Expand / collapse */
    .db-tcard { cursor:pointer; }
    .db-tcard-chevron { font-size:.7rem; color:#475569; margin-left:auto; flex-shrink:0; transition:transform .2s; }
    .db-tcard.expanded .db-tcard-chevron { transform:rotate(180deg); }
    .db-tcard-body { display:none; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,.07); }
    .db-tcard.expanded .db-tcard-body { display:block; }
    .db-tcard-desc { font-size:.8rem; color:#94a3b8; line-height:1.5; margin-bottom:10px; white-space:pre-wrap; }
    .db-tcard-subs-list { display:flex; flex-direction:column; gap:5px; }
    .db-tcard-sub-item { display:flex; align-items:flex-start; gap:7px; font-size:.8rem; }
    .db-tcard-sub-check { flex-shrink:0; margin-top:1px; color:#34d399; }
    .db-tcard-sub-check.pending { color:#475569; }
    .db-tcard-sub-text { color:#cbd5e1; line-height:1.4; }
    .db-tcard-sub-text.done-text { text-decoration:line-through; color:#475569; }

    /* Projects / life goals / habits (unchanged from v a) */
    .db-task-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
    .db-task { display:flex; align-items:flex-start; gap:10px; padding:9px 12px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:10px; }
    .db-task-badge { font-size:.64rem; font-weight:700; padding:2px 7px; border-radius:6px; background:rgba(96,165,250,.15); color:#60a5fa; white-space:nowrap; flex-shrink:0; margin-top:2px; }
    .db-task-badge.proj { background:rgba(167,139,250,.15); color:#a78bfa; }
    .db-task-title { font-size:.87rem; color:var(--text); font-weight:600; line-height:1.3; }
    .db-task-sub   { font-size:.75rem; color:#64748b; margin-top:3px; }

    .db-life-goal { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); margin-bottom:8px; }
    .db-life-goal:last-child { margin-bottom:0; }
    .db-lg-icon   { font-size:1.4rem; flex-shrink:0; }
    .db-lg-body   { flex:1; min-width:0; }
    .db-lg-title  { font-size:.87rem; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .db-lg-bar-wrap { height:4px; background:rgba(255,255,255,.08); border-radius:2px; margin-top:6px; }
    .db-lg-bar    { height:100%; border-radius:2px; background:linear-gradient(90deg,#60a5fa,#a78bfa); transition:width .4s; }
    .db-lg-pct    { font-size:.7rem; color:#64748b; margin-top:4px; }

    .db-habit-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.05); }
    .db-habit-row:last-child { border-bottom:none; }
    .db-habit-icon { font-size:1.15rem; width:26px; text-align:center; flex-shrink:0; }
    .db-habit-name { flex:1; font-size:.87rem; color:var(--text); }
    .db-habit-chip { font-size:.7rem; font-weight:700; padding:2px 9px; border-radius:20px; flex-shrink:0; }
    .db-habit-chip.done    { background:rgba(52,211,153,.15); color:#34d399; }
    .db-habit-chip.pending { background:rgba(239,68,68,.1);   color:#f87171; }

    .db-sync-rows { display:flex; flex-direction:column; gap:8px; }
    .db-sync-row  { display:flex; justify-content:space-between; align-items:center; }
    .db-sync-label { font-size:.82rem; color:var(--muted); }
    .db-sync-val   { font-size:.82rem; font-weight:700; }
    .db-sync-good  { color:#34d399; }
    .db-sync-warn  { color:#fbbf24; }
    .db-sync-bad   { color:#f87171; }
    .db-sync-muted { color:#64748b; }

    /* Car alerts */
    .db-car-alert-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.05); }
    .db-car-alert-row:last-child { border-bottom:none; }
    .db-car-alert-stripe { width:4px; height:32px; border-radius:2px; flex-shrink:0; }
    .db-car-alert-info { flex:1; min-width:0; }
    .db-car-alert-label { display:block; font-size:.87rem; font-weight:700; color:var(--text); }
    .db-car-alert-date { display:block; font-size:.72rem; color:#64748b; margin-top:2px; }
    .db-car-alert-badge { font-size:.72rem; font-weight:800; flex-shrink:0; }

    .db-empty { color:#475569; font-size:.87rem; font-style:italic; padding:4px 0; }
    .db-vault-notice { display:flex; align-items:center; gap:12px; padding:16px; background:rgba(96,165,250,.06); border:1px solid rgba(96,165,250,.15); border-radius:12px; color:var(--muted); font-size:.88rem; }
    .db-vault-notice-icon { font-size:1.4rem; flex-shrink:0; }

    /* Acknowledge banner */
    .db-ack-banner { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; background:rgba(96,165,250,.07); border:1px solid rgba(96,165,250,.22); border-radius:13px; margin-bottom:18px; flex-wrap:wrap; }
    .db-ack-msg { font-size:.88rem; color:var(--muted); line-height:1.5; }
    .db-ack-btn { padding:9px 20px; border-radius:10px; border:none; background:linear-gradient(135deg,#60a5fa,#a78bfa); color:#fff; font-size:.84rem; font-weight:800; cursor:pointer; font-family:inherit; transition:opacity .15s; white-space:nowrap; flex-shrink:0; }
    .db-ack-btn:hover { opacity:.82; }
  `;

  function injectCSS() {
    if (document.getElementById('homer-daily-brief-css')) return;
    var el = document.createElement('style');
    el.id = 'homer-daily-brief-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  /* ── Sidebar button ───────────────────────────────────────────────── */
  function injectSidebarBtn() {
    var existing = document.getElementById('db-sb-btn');
    if (existing) {
      // Button already in HTML — just wire the click
      existing.addEventListener('click', function () { showDailyBrief(); });
      return;
    }
    var sidebar = document.getElementById('desktop-sidebar');
    if (!sidebar) return;
    var spacer = sidebar.querySelector('.sb-spacer');
    var btn = document.createElement('button');
    btn.className = 'sb-item';
    btn.id = 'db-sb-btn';
    btn.dataset.tab = 'daily-brief';
    btn.style.display = 'none';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="18" rx="2"/>' +
        '<line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>' +
        '<line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/>' +
        '<line x1="8" y1="18" x2="11" y2="18"/>' +
      '</svg><span class="sb-label">Daily Brief</span>';
    btn.addEventListener('click', function () { showDailyBrief(); });
    if (spacer) sidebar.insertBefore(btn, spacer);
    else sidebar.appendChild(btn);
  }

  /* ── Tab show/hide ────────────────────────────────────────────────── */
  function showDailyBrief() {
    var orig = window._homerShowTab;
    if (orig) {
      orig('daily-brief');
    } else {
      ['home','pomodoro','focuslab','investing','tools','links','news','vault'].forEach(function (t) {
        var el = document.getElementById('tab-' + t);
        if (el) el.style.display = 'none';
      });
      activateDailyBrief();
    }
  }

  function activateDailyBrief() {
    var section = document.getElementById('tab-daily-brief');
    if (section) section.style.display = 'block';
    var sbBtn = document.getElementById('db-sb-btn');
    if (sbBtn) sbBtn.classList.add('active');
    document.querySelectorAll('.sb-item[data-tab]:not(#db-sb-btn)').forEach(function (i) { i.classList.remove('active'); });
    document.body.dataset.activeTab = 'daily-brief';
    injectAckBanner();
    refreshDailyBrief();
  }

  function injectAckBanner() {
    var existing = document.getElementById('db-ack-banner');
    // Only show if Bogdan, in morning window, and not yet acked
    if (!isBogdan() || !isInMorningWindow() || hasAckedToday()) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return; // already injected
    var section = document.getElementById('tab-daily-brief');
    if (!section) return;
    var banner = document.createElement('div');
    banner.id = 'db-ack-banner';
    banner.className = 'db-ack-banner';
    banner.innerHTML =
      '<span class="db-ack-msg">Review your brief, then confirm you\'ve seen it to start your day.</span>' +
      '<button class="db-ack-btn" id="db-ack-btn">Got it \u2014 Start my day</button>';
    // Insert after the header div
    var header = section.querySelector('.db-header');
    if (header && header.nextSibling) section.insertBefore(banner, header.nextSibling);
    else section.insertBefore(banner, section.firstChild);
    document.getElementById('db-ack-btn').addEventListener('click', ackToday);
  }

  function deactivateDailyBrief() {
    var section = document.getElementById('tab-daily-brief');
    if (section) section.style.display = 'none';
    var sbBtn = document.getElementById('db-sb-btn');
    if (sbBtn) sbBtn.classList.remove('active');
  }

  /* ── Bogdan visibility ────────────────────────────────────────────── */
  function updateBogdanVisibility() {
    // Sidebar button (#db-sb-btn) is always visible — it's in HTML and this is
    // a personal dashboard. Supabase sync ops are separately gated by canSync().
  }

  /* ── Weather ──────────────────────────────────────────────────────── */
  function syncWeather() {
    var map = { 'wx-icon':'db-wx-icon','wx-temp':'db-wx-temp','wx-desc':'db-wx-desc','wx-place':'db-wx-place' };
    Object.keys(map).forEach(function (srcId) {
      var src = document.getElementById(srcId);
      var dst = document.getElementById(map[srcId]);
      if (!src || !dst) return;
      if (srcId === 'wx-temp') dst.innerHTML = src.innerHTML;
      else dst.textContent = src.textContent;
    });
  }

  /* ── In-progress task cards (creative) ───────────────────────────── */
  function renderInProgress(goals, projects) {
    var wrap = document.getElementById('db-inprogress-list');
    if (!wrap) return;

    var projMap = {};
    (projects || []).forEach(function (p) { projMap[p.id] = p; });

    var items = (goals || []).filter(function (g) {
      if (g.archived || g.deleted) return false;
      if (g.col === IN_PROGRESS_COL) return true;               // kanban column (primary)
      return IN_PROGRESS_STATUSES.has(String(g.status || '').toLowerCase()); // legacy
    });

    if (!items.length) {
      wrap.innerHTML = '<p class="db-empty">No tasks in progress right now</p>';
      return;
    }

    /* sort: high priority first, then by id */
    var priOrder = { high: 0, medium: 1, low: 2 };
    items.sort(function (a, b) {
      var pa = priOrder[a.priority] !== undefined ? priOrder[a.priority] : 3;
      var pb = priOrder[b.priority] !== undefined ? priOrder[b.priority] : 3;
      return pa !== pb ? pa - pb : String(a.id || '').localeCompare(String(b.id || ''));
    });

    var html = '<div class="db-tasks-grid">';
    items.forEach(function (g) {
      var proj    = projMap[g.projectId];
      var projKey = proj ? (proj.key || proj.id) : null;
      var color   = projectColor(g.projectId || projKey || 'task');
      var priCls  = g.priority ? ' ' + g.priority : '';
      var priLbl  = g.priority ? g.priority.charAt(0).toUpperCase() + g.priority.slice(1) : '';
      var subtasks = Array.isArray(g.subtasks) ? g.subtasks : [];
      var doneSubs = subtasks.filter(function (s) { return s.done || s.status === 'done'; }).length;
      var due     = g.dueDate || g.due_date || g.due || '';
      var desc    = String(g.notes || g.description || '').trim();
      var hasBody = !!(desc || subtasks.length);

      var bodyHtml = '';
      if (hasBody) {
        bodyHtml = '<div class="db-tcard-body">';
        if (desc) bodyHtml += '<div class="db-tcard-desc">' + esc(desc.length > 300 ? desc.slice(0, 300) + '\u2026' : desc) + '</div>';
        if (subtasks.length) {
          bodyHtml += '<div class="db-tcard-subs-list">' +
            subtasks.map(function (s) {
              var done = s.done || s.status === 'done';
              var txt  = s.text || s.summary || s.title || '';
              return '<div class="db-tcard-sub-item">' +
                '<span class="db-tcard-sub-check' + (done ? '' : ' pending') + '">' + (done ? '\u2714' : '\u25cb') + '</span>' +
                '<span class="db-tcard-sub-text' + (done ? ' done-text' : '') + '">' + esc(txt) + '</span>' +
              '</div>';
            }).join('') +
          '</div>';
        }
        bodyHtml += '</div>';
      }

      html += '<div class="db-tcard">' +
        '<div class="db-tcard-stripe" style="background:' + color + '"></div>' +
        '<div class="db-tcard-top">' +
          '<div class="db-tcard-title">' + esc(g.summary || g.title || 'Untitled') + '</div>' +
          (projKey ? '<span class="db-tcard-proj" style="background:' + color + '22;color:' + color + '">' + esc(projKey) + '</span>' : '') +
          (hasBody ? '<span class="db-tcard-chevron">\u25bc</span>' : '') +
        '</div>' +
        '<div class="db-tcard-meta">' +
          (g.id != null ? '<span class="db-tcard-id">#' + esc(g.id) + '</span>' : '') +
          (priLbl ? '<span class="db-tcard-pri' + priCls + '">' + priLbl + '</span>' : '') +
          (subtasks.length ? '<span class="db-tcard-subs">' + doneSubs + '/' + subtasks.length + ' subtasks</span>' : '') +
          (due ? '<span class="db-tcard-due">Due ' + esc(due) + '</span>' : '') +
        '</div>' +
        bodyHtml +
      '</div>';
    });
    html += '</div>';
    wrap.innerHTML = html;

    /* event delegation — toggle expanded class on click (assigned, not added, to avoid stacking on re-render) */
    wrap.onclick = function (e) {
      var card = e.target.closest('.db-tcard');
      if (card && card.querySelector('.db-tcard-body')) {
        card.classList.toggle('expanded');
      }
    };
  }

  function renderProjects(projects) {
    var list = document.getElementById('db-projects-list');
    if (!list) return;
    var active = (projects || []).filter(function (p) { return !p.archived && !p.deleted; });
    if (!active.length) { list.innerHTML = '<li class="db-empty">No active projects</li>'; return; }
    list.innerHTML = active.slice(0, 8).map(function (p) {
      var desc = p.description ? p.description.slice(0, 55) + (p.description.length > 55 ? '\u2026' : '') : '';
      return '<li class="db-task">' +
        '<span class="db-task-badge proj">' + esc(p.key || p.id) + '</span>' +
        '<div><div class="db-task-title">' + esc(p.name || p.key) + '</div>' +
        (desc ? '<div class="db-task-sub">' + esc(desc) + '</div>' : '') +
        '</div></li>';
    }).join('');
  }

  function renderLifeGoals(lifeGoals) {
    var wrap = document.getElementById('db-lifegoals-wrap');
    if (!wrap) return;
    var active = (lifeGoals || []).filter(function (g) { return !g.archived && !g.deleted && (g.progress || 0) < 100; });
    if (!active.length) { wrap.innerHTML = '<p class="db-empty">All life goals complete \u2b50</p>'; return; }
    wrap.innerHTML = active.slice(0, 6).map(function (g) {
      var pct = Math.min(100, Math.max(0, g.progress || 0));
      return '<div class="db-life-goal">' +
        '<div class="db-lg-icon">' + esc(g.icon || '\ud83c\udfaf') + '</div>' +
        '<div class="db-lg-body">' +
          '<div class="db-lg-title">' + esc(g.title || 'Goal') + '</div>' +
          '<div class="db-lg-bar-wrap"><div class="db-lg-bar" style="width:' + pct + '%"></div></div>' +
          '<div class="db-lg-pct">' + pct + '% complete' + (g.targetDate ? ' \u2022 Target: ' + esc(g.targetDate) : '') + '</div>' +
        '</div></div>';
    }).join('');
  }

  function populateFromVault() {
    var notice   = document.getElementById('db-vault-notice');
    var vaultGrid = document.getElementById('db-vault-grid');
    var unlocked = !!window._homerVaultUnlocked;
    if (notice)    notice.style.display    = unlocked ? 'none' : 'flex';
    if (vaultGrid) vaultGrid.style.display = unlocked ? '' : 'none';
    if (!unlocked) return;

    var loadForMode = window._homerLoadVaultForMode || window._homerLoadVault;
    if (typeof loadForMode !== 'function') return;

    // Load both personal and work vault modes and merge in-progress tasks
    var modes = ['personal', 'work'];
    Promise.all(modes.map(function (m) {
      return (typeof window._homerLoadVaultForMode === 'function'
        ? window._homerLoadVaultForMode(m)
        : window._homerLoadVault()
      ).catch(function () { return null; });
    })).then(function (results) {
      var allGoals = [], allProjects = [], allLifeGoals = [];
      results.forEach(function (data, idx) {
        if (!data) return;
        var modeTag = modes[idx];
        // Tag each goal/lifeGoal with its source mode so we can build a unique key
        (data.goals || []).forEach(function (g) {
          allGoals.push(Object.assign({}, g, { _mode: modeTag }));
        });
        (data.projects   || []).forEach(function (p) { allProjects.push(p); });
        (data.lifeGoals  || []).forEach(function (g) {
          allLifeGoals.push(Object.assign({}, g, { _mode: modeTag }));
        });
      });
      // Goals and lifeGoals use per-mode sequential numeric IDs — deduplicate
      // using mode+id composite key so work goals are not dropped by personal IDs.
      // Projects may share default IDs across modes — dedup by id only.
      var seenG = {}, seenP = {}, seenL = {};
      allGoals     = allGoals.filter(function (g) {
        var k = (g._mode || '') + ':' + g.id;
        return g.id != null && !seenG[k] && (seenG[k] = 1);
      });
      allProjects  = allProjects.filter(function (p) { return p.id && !seenP[p.id] && (seenP[p.id] = 1); });
      allLifeGoals = allLifeGoals.filter(function (g) {
        var k = (g._mode || '') + ':' + g.id;
        return g.id != null && !seenL[k] && (seenL[k] = 1);
      });
      renderInProgress(allGoals, allProjects);
      renderProjects(allProjects);
      renderLifeGoals(allLifeGoals);
    });
  }

  /* ── Habits ───────────────────────────────────────────────────────── */
  function renderHabits() {
    var wrap = document.getElementById('db-habits-wrap');
    if (!wrap) return;
    var raw = safeJson(localStorage.getItem(HABITS_KEY), { habits: [], completions: {} });
    var habits = (raw.habits || []).filter(function (h) { return !h.archived; });
    var completions = raw.completions || {};
    var today = todayStr();
    if (!habits.length) { wrap.innerHTML = '<p class="db-empty">No habits configured yet</p>'; return; }
    wrap.innerHTML = habits.slice(0, 10).map(function (h) {
      var key  = h.id + ':' + today;
      var done = (completions[key] || 0) >= (h.target || 1);
      var icon = h.icon ? esc(h.icon) : '\u2714\ufe0f';   // real unicode, not HTML entity
      return '<div class="db-habit-row">' +
        '<div class="db-habit-icon">' + icon + '</div>' +
        '<div class="db-habit-name">' + esc(h.name || 'Habit') + '</div>' +
        '<span class="db-habit-chip ' + (done ? 'done' : 'pending') + '">' + (done ? 'Done' : 'Pending') + '</span>' +
        '</div>';
    }).join('');
  }

  /* ── Car alerts ───────────────────────────────────────────────────── */
  function renderCarAlerts() {
    var wrap = document.getElementById('db-car-alerts-wrap');
    var card = document.getElementById('db-car-alerts-card');
    if (!wrap || !card) return;
    // Prefer in-memory state exposed by car module (always fresh, bypasses stale LS from CF poll)
    var raw = window.__homerCarData || safeJson(localStorage.getItem('homer-car'), null);
    if (!raw) { card.style.display = 'none'; return; }

    var todayMs = new Date(todayStr()).getTime();
    var alerts = [];

    // Deduplicate by (vehicleId, type): keep the latest expiryDate per type per vehicle.
    // Prevents a renewed document's old expired entry from still showing as an alert.
    var docMap = {};
    (raw.documents || []).forEach(function (doc) {
      if (!doc.expiryDate || doc.deleted) return;
      var k = (doc.vehicleId || '') + ':' + (doc.type || '');
      if (!docMap[k] || doc.expiryDate > docMap[k].expiryDate) docMap[k] = doc;
    });
    Object.keys(docMap).forEach(function (k) {
      var doc = docMap[k];
      var days = Math.round((new Date(doc.expiryDate).getTime() - todayMs) / 86400000);
      if (days <= 7) alerts.push({ label: doc.label || doc.type, date: doc.expiryDate, days: days });
    });

    // Deduplicate maintenance by (vehicleId, type): keep the latest nextDateDue.
    var maintMap = {};
    (raw.maintenance || []).forEach(function (m) {
      if (!m.nextDateDue) return;
      var k = (m.vehicleId || '') + ':' + (m.type || '');
      if (!maintMap[k] || m.nextDateDue > maintMap[k].nextDateDue) maintMap[k] = m;
    });
    Object.keys(maintMap).forEach(function (k) {
      var m = maintMap[k];
      var days = Math.round((new Date(m.nextDateDue).getTime() - todayMs) / 86400000);
      if (days <= 7) alerts.push({ label: m.label || m.type, date: m.nextDateDue, days: days });
    });

    if (!alerts.length) { card.style.display = 'none'; return; }
    alerts.sort(function (a, b) { return a.days - b.days; });
    card.style.display = '';

    wrap.innerHTML = alerts.map(function (a) {
      var isExpired = a.days < 0;
      var color = isExpired ? '#ef4444' : '#f59e0b';
      var badge = isExpired ? 'EXPIRED' : (a.days === 0 ? 'Today!' : a.days + 'd left');
      return '<div class="db-car-alert-row">' +
        '<div class="db-car-alert-stripe" style="background:' + color + '"></div>' +
        '<div class="db-car-alert-info">' +
          '<span class="db-car-alert-label">🚗 ' + esc(a.label) + '</span>' +
          '<span class="db-car-alert-date">' + esc(a.date) + '</span>' +
        '</div>' +
        '<span class="db-car-alert-badge" style="color:' + color + '">' + esc(badge) + '</span>' +
        '</div>';
    }).join('');
  }

  /* ── Recurring Tasks ──────────────────────────────────────────────── */
  function daysBetweenDates(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  // Returns numeric days until next occurrence (0=today, 1=tomorrow, negative=overdue)
  function rtDaysUntil(task) {
    var t = todayStr();
    if (!task.enabled || task.paused) return null;
    if (task.freq === 'daily') {
      if (!task.lastFired || task.lastFired !== t) return 0;
      return 1;
    }
    if (task.freq === 'weekly') {
      if (!task.lastFired) return 0;
      var days = (task.days && task.days.length) ? task.days : [1];
      var nowDay = new Date().getDay();
      var daysUntil = days.map(function(d) { var diff = (d - nowDay + 7) % 7; return diff === 0 ? 7 : diff; });
      var min = Math.min.apply(null, daysUntil);
      var elapsed = daysBetweenDates(task.lastFired, t);
      if (elapsed >= 7) return 0;
      return min;
    }
    if (task.freq === 'monthly') {
      if (!task.lastFired) return 0;
      var lf = new Date(task.lastFired), now = new Date(t);
      if (now.getMonth() !== lf.getMonth() || now.getFullYear() !== lf.getFullYear()) return 0;
      var nextMonth = new Date(lf.getFullYear(), lf.getMonth() + 1, task.dayOfMonth || 1);
      return daysBetweenDates(t, nextMonth.toISOString().slice(0, 10));
    }
    if (task.freq === 'interval') {
      if (!task.lastFired) return 0;
      var remaining = (task.intervalDays || 7) - daysBetweenDates(task.lastFired, t);
      return remaining <= 0 ? 0 : remaining;
    }
    return null;
  }

  function renderRecurringTasks() {
    var wrap = document.getElementById('db-recurring-wrap');
    var card = document.getElementById('db-recurring-card');
    if (!wrap || !card) return;

    var tasks = safeJson(localStorage.getItem('homer-recurring'), null) || [];
    var due = [];  // due today or overdue (days <= 0)
    var tomorrow = [];  // due tomorrow

    tasks.forEach(function(task) {
      var d = rtDaysUntil(task);
      if (d === null) return;
      if (d <= 0) due.push(task);
      else if (d === 1) tomorrow.push(task);
    });

    // Browser notification for tasks due tomorrow — once per day
    var notifyKey = 'homer-recurring-notified-' + todayStr();
    if (tomorrow.length && !localStorage.getItem(notifyKey) && 'Notification' in window) {
      localStorage.setItem(notifyKey, '1');
      if (Notification.permission === 'granted') {
        tomorrow.forEach(function(task) {
          var n = new Notification('📅 Tomorrow: ' + task.title, { body: 'Recurring task due tomorrow' });
          setTimeout(function() { n.close(); }, 8000);
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(function(p) {
          if (p === 'granted') {
            tomorrow.forEach(function(task) {
              var n = new Notification('📅 Tomorrow: ' + task.title, { body: 'Recurring task due tomorrow' });
              setTimeout(function() { n.close(); }, 8000);
            });
          }
        });
      }
    }

    if (!due.length && !tomorrow.length) { card.style.display = 'none'; return; }
    card.style.display = '';

    var rows = '';
    due.forEach(function(task) {
      var overdue = rtDaysUntil(task) < 0;
      var color = overdue ? '#ef4444' : '#34d399';
      var badge = overdue ? 'Overdue' : 'Due today';
      rows += '<div class="db-car-alert-row">' +
        '<div class="db-car-alert-stripe" style="background:' + color + '"></div>' +
        '<div class="db-car-alert-info">' +
          '<span class="db-car-alert-label">🔁 ' + esc(task.title) + '</span>' +
          '<span class="db-car-alert-date">' + esc(task.freq) + (task.category ? ' · ' + task.category : '') + '</span>' +
        '</div>' +
        '<span class="db-car-alert-badge" style="color:' + color + '">' + badge + '</span>' +
        '</div>';
    });
    tomorrow.forEach(function(task) {
      rows += '<div class="db-car-alert-row">' +
        '<div class="db-car-alert-stripe" style="background:#f59e0b"></div>' +
        '<div class="db-car-alert-info">' +
          '<span class="db-car-alert-label">🔁 ' + esc(task.title) + '</span>' +
          '<span class="db-car-alert-date">' + esc(task.freq) + (task.category ? ' · ' + task.category : '') + '</span>' +
        '</div>' +
        '<span class="db-car-alert-badge" style="color:#f59e0b">Tomorrow</span>' +
        '</div>';
    });
    wrap.innerHTML = rows;
  }

  /* ── Sync status ──────────────────────────────────────────────────── */
  function stampAge(ts) {
    if (!ts) return { text: 'Never', cls: 'db-sync-warn' };
    var diff = Date.now() - ts;
    var s = Math.round(diff / 1000);
    if (s < 15)  return { text: 'Just now', cls: 'db-sync-good' };
    if (s < 120) return { text: s + 's ago', cls: 'db-sync-good' };
    var m = Math.round(diff / 60000);
    if (m < 10)  return { text: m + 'm ago', cls: 'db-sync-good' };
    if (m < 60)  return { text: m + 'm ago', cls: 'db-sync-warn' };
    return { text: Math.round(m / 60) + 'h ago', cls: 'db-sync-bad' };
  }

  function updateSyncStatus() {
    function setRow(id, text, cls) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className = 'db-sync-val ' + (cls || 'db-sync-muted');
    }
    var localTs = parseInt(localStorage.getItem('homer-local-save-ts') || localStorage.getItem('homer-backup-ts') || '0', 10) || 0;
    setRow('db-sync-local', stampAge(localTs).text, stampAge(localTs).cls);

    if (!isBogdan()) {
      setRow('db-sync-supa', 'N/A (browser only)', 'db-sync-muted');
    } else {
      var supaTs = parseInt(localStorage.getItem(VAULT_SUPA_TS_KEY) || '0', 10) || 0;
      if (supaTs) {
        var s = stampAge(supaTs);
        setRow('db-sync-supa', s.text, s.cls);
      } else if (_vaultSyncStatus === 'no-pass') {
        setRow('db-sync-supa', 'Sync key not set — log in as Bogdan', 'db-sync-warn');
      } else if (_vaultSyncStatus === 'no-data') {
        setRow('db-sync-supa', 'No vault data in IDB', 'db-sync-warn');
      } else if (_vaultSyncStatus && _vaultSyncStatus.startsWith('error:')) {
        setRow('db-sync-supa', _vaultSyncStatus, 'db-sync-bad');
      } else {
        setRow('db-sync-supa', 'Never', 'db-sync-warn');
      }
    }

    var fieldVer = parseInt(localStorage.getItem('homer-field-sync-version') || '0', 10) || 0;
    setRow('db-sync-fields', fieldVer ? 'v' + fieldVer : 'Not started', fieldVer ? 'db-sync-good' : 'db-sync-muted');
  }

  /* ── Subtitle ─────────────────────────────────────────────────────── */
  function updateSubtitle() {
    var el = document.getElementById('db-subtitle');
    if (!el) return;
    var now = new Date();
    var h = now.getHours();
    var greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    var authUser = localStorage.getItem('homer-auth-user');
    var displayName = authUser ? (authUser.charAt(0).toUpperCase() + authUser.slice(1)) : '';
    el.textContent = greet + (displayName ? ', ' + displayName : '') + ' \u2014 ' + now.toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  /* ── Main refresh ─────────────────────────────────────────────────── */
  function refreshDailyBrief() {
    updateSubtitle();
    syncWeather();
    populateFromVault();
    renderHabits();
    renderCarAlerts();
    renderRecurringTasks();
    updateSyncStatus();
  }

  /* ==================================================================
   * SUPABASE SYNC — vault blob (8s interval, hash-dedup)
   * ================================================================== */
  var _lastVaultHash = '';
  var _vaultSyncBusy = false;

  var _vaultSyncStatus = 'idle'; // 'idle'|'no-pass'|'no-data'|'busy'|'error:...'|'ok'

  /* Read both vault keys from IDB and return {salt, data} or null */
  function readVaultFromIdb(cb) {
    var openReq = indexedDB.open(VAULT_IDB_NAME, 1);
    openReq.onerror = function () { cb(null); };
    openReq.onsuccess = function (ev) {
      var db = ev.target.result;
      var tx;
      try { tx = db.transaction(VAULT_IDB_STORE, 'readonly'); } catch (_) { cb(null); return; }
      var saltReq = tx.objectStore(VAULT_IDB_STORE).get(VAULT_SALT_KEY);
      var dataReq = tx.objectStore(VAULT_IDB_STORE).get(VAULT_DATA_KEY);
      tx.oncomplete = function () {
        var salt = saltReq.result || null;
        var data = dataReq.result || null;
        cb(data ? { salt: salt, data: data } : null);
      };
    };
  }

  function pushVaultToSupabase(force) {
    if (!isBogdan()) return;
    if (_vaultSyncBusy) return;
    var pass = String(localStorage.getItem('homer-sync-pass') || '').trim();
    if (!pass) {
      _vaultSyncStatus = 'no-pass';
      if (document.body.dataset.activeTab === 'daily-brief') updateSyncStatus();
      return;
    }

    readVaultFromIdb(function (vault) {
      if (!vault) {
        _vaultSyncStatus = 'no-data';
        if (document.body.dataset.activeTab === 'daily-brief') updateSyncStatus();
        return;
      }
      var hash = quickHash(String(vault.data));
      if (!force && hash === _lastVaultHash) return; // nothing changed
      _lastVaultHash = hash;
      _vaultSyncBusy = true;
      _vaultSyncStatus = 'busy';

      /* Gather habits + extras while we have the data */
      var habitsRaw = localStorage.getItem(HABITS_KEY);
      var habitsData = null;
      try { habitsData = habitsRaw ? JSON.parse(habitsRaw) : null; } catch (_) {}
      var extras = {
        zen_goal:   localStorage.getItem(ZEN_KEY)   || '',
        brain_dump: localStorage.getItem(BRAIN_KEY) || ''
      };

      fetch('/api/joey?action=vault-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passphrase: pass,
          vaultSalt:  vault.salt,
          vaultData:  vault.data,
          habitsData: habitsData,
          extras:     extras
        })
      }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad JSON' }; }); })
        .then(function (d) {
          _vaultSyncBusy = false;
          if (!d || !d.ok) {
            _vaultSyncStatus = 'error: ' + (d && d.error ? String(d.error).slice(0, 80) : 'unknown');
            console.warn('[DailyBrief] vault-backup failed:', d && d.error);
          } else {
            _vaultSyncStatus = 'ok';
            var now = Date.now();
            try { localStorage.setItem(VAULT_SUPA_TS_KEY,  String(now)); } catch (_) {}
            try { localStorage.setItem(HABITS_SYNC_KEY,    String(now)); } catch (_) {}
            try { localStorage.setItem(EXTRAS_SYNC_TS,     String(now)); } catch (_) {}
          }
          if (document.body.dataset.activeTab === 'daily-brief') updateSyncStatus();
        })
        .catch(function (err) {
          _vaultSyncBusy = false;
          _vaultSyncStatus = 'error: ' + (err && err.message ? err.message : 'network');
          if (document.body.dataset.activeTab === 'daily-brief') updateSyncStatus();
        });
    });
  }

  /* ==================================================================
   * SUPABASE SYNC — habits (8s interval, hash-dedup)
   * ================================================================== */
  var _lastHabitsHash = '';

  function pushHabitsToSupabase(force) {
    if (!isBogdan()) return;
    var supabase = window.__supabase;
    var session  = window.__sbSession;
    if (!supabase || !session || !session.user) return;
    var raw = localStorage.getItem(HABITS_KEY);
    if (!raw) return;
    // Don't push empty habits before the enhancements pull completes —
    // would corrupt joey_meta with a stale empty state from a fresh device.
    var parsed; try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
    if (parsed && (!parsed.habits || !parsed.habits.length)) {
      if (typeof window._heHabitsPullDone === 'function' && !window._heHabitsPullDone()) return;
    }
    var hash = quickHash(raw);
    if (!force && hash === _lastHabitsHash) return;
    _lastHabitsHash = hash;
    var value; try { value = JSON.parse(raw); } catch (_) { return; }
    supabase.from('joey_meta').upsert(
      { user_id: session.user.id, mode: 'personal', key: 'habits_data',
        value: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,mode,key' }
    ).then(function (res) {
      if (res && res.error) { console.warn('[DailyBrief] habits sync:', res.error.message); return; }
      try { localStorage.setItem(HABITS_SYNC_KEY, String(Date.now())); } catch (_) {}
    });
  }

  /* ==================================================================
   * SUPABASE SYNC — extra localStorage keys (zen-goal, brain-dump)
   * ================================================================== */
  var _lastExtrasHash = '';

  function pushExtrasToSupabase(force) {
    if (!isBogdan()) return;
    var supabase = window.__supabase;
    var session  = window.__sbSession;
    if (!supabase || !session || !session.user) return;
    var zen   = localStorage.getItem(ZEN_KEY)   || '';
    var brain = localStorage.getItem(BRAIN_KEY) || '';
    var hash  = quickHash(zen + '||' + brain);
    if (!force && hash === _lastExtrasHash) return;
    _lastExtrasHash = hash;
    supabase.from('joey_meta').upsert(
      { user_id: session.user.id, mode: 'personal', key: 'ls_extras',
        value: { zen_goal: zen, brain_dump: brain, synced_at: Date.now() },
        updated_at: new Date().toISOString() },
      { onConflict: 'user_id,mode,key' }
    ).then(function (res) {
      if (res && res.error) { console.warn('[DailyBrief] extras sync:', res.error.message); return; }
      try { localStorage.setItem(EXTRAS_SYNC_TS, String(Date.now())); } catch (_) {}
    });
  }

  /* ── Master 8-second tick ─────────────────────────────────────────── */
  function startPeriodicSync() {
    setInterval(function () {
      if (!isBogdan()) return;
      pushVaultToSupabase(false); // includes habits + extras in single request
    }, 8000);
  }

  /* ── Hook data saves ──────────────────────────────────────────────── */
  function hookDataSaves() {
    // Vault save → immediate backup (also picks up habits + extras in same request)
    window.addEventListener('vault-goals-changed', function () {
      if (isBogdan()) setTimeout(function () { pushVaultToSupabase(true); }, 800);
      if (document.body.dataset.activeTab === 'daily-brief') populateFromVault();
    });

    // Car data synced (Realtime or local save) → refresh car alerts immediately
    window.addEventListener('homer-data-synced', function (e) {
      if (e && e.detail && e.detail.key === 'homer-car') renderCarAlerts();
      if (e && e.detail && e.detail.key === 'homer-recurring') renderRecurringTasks();
    });

    // Habits / extras changed → force a full backup (vault-backup sends everything)
    window.addEventListener('storage', function (e) {
      if (!isBogdan()) return;
      if (e.key === HABITS_KEY)  { _lastVaultHash = ''; pushVaultToSupabase(true); if (document.body.dataset.activeTab === 'daily-brief') renderHabits(); }
      if (e.key === ZEN_KEY || e.key === BRAIN_KEY) { _lastVaultHash = ''; pushVaultToSupabase(true); }
    });

    // Supabase session or Homer auth → force full backup
    window.addEventListener('supabase:session', function () {
      if (isBogdan()) setTimeout(function () { pushVaultToSupabase(true); }, 2000);
    });

    // Auth / vault unlock → refresh visibility + backup + auto-open brief if morning
    window.addEventListener('homer-auth', function () {
      updateBogdanVisibility();
      if (isBogdan()) {
        setTimeout(function () { pushVaultToSupabase(true); }, 1500);
        // Auto-open daily brief on first login of the morning (before ack)
        if (isInMorningWindow() && !hasAckedToday()) {
          setTimeout(function () { showDailyBrief(); }, 600);
        }
      }
    });
  }

  /* ── Event wiring ─────────────────────────────────────────────────── */
  function wireEvents() {
    window.addEventListener('homer-tab-change', function (e) {
      var tab = e && e.detail && e.detail.tab;
      if (tab === 'daily-brief') activateDailyBrief();
      else deactivateDailyBrief();
    });

    window.addEventListener('homer-auth', updateBogdanVisibility);
    window.addEventListener('supabase:authchange', updateBogdanVisibility);
    window.addEventListener('supabase:session', updateBogdanVisibility);

    var btn = document.getElementById('db-refresh-btn');
    if (btn) btn.addEventListener('click', function () {
      refreshDailyBrief();
      if (isBogdan()) {
        pushVaultToSupabase(true);
        pushHabitsToSupabase(true);
        pushExtrasToSupabase(true);
      }
    });

    window.addEventListener('vault-goals-changed', function () {
      if (document.body.dataset.activeTab === 'daily-brief') refreshDailyBrief();
    });

    var wxTemp = document.getElementById('wx-temp');
    if (wxTemp) {
      new MutationObserver(function () {
        if (document.body.dataset.activeTab === 'daily-brief') syncWeather();
      }).observe(wxTemp, { childList: true, subtree: true, characterData: true });
    }
  }

  /* ── Init ─────────────────────────────────────────────────────────── */
  ready(function () {
    injectCSS();
    injectSidebarBtn();
    updateBogdanVisibility();
    hookDataSaves();
    wireEvents();
    startPeriodicSync();

    // If session already exists on load, kick off first sync immediately
    setTimeout(function () {
      if (isBogdan() && window.__sbSession && window.__sbSession.user) {
        pushVaultToSupabase(true);
        pushHabitsToSupabase(true);
        pushExtrasToSupabase(true);
      }
    }, 2500);
  });

})();
