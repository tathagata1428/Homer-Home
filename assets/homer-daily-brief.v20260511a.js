/* ====================================================================
 * Homer Daily Brief  v20260511a
 * Bogdan-only tab: collects everything in-progress, weather, and more.
 * Also syncs vault encrypted blob to Supabase (joey_meta) after each save.
 * For any other user or no user, all data stays in browser cache only.
 * ==================================================================== */
(function () {
  'use strict';

  var BOGDAN_USER = 'bogdan';
  var VAULT_IDB_NAME = 'homer-vault-idb';
  var VAULT_IDB_STORE = 'kv';
  var VAULT_SALT_KEY = 'homer-vault-salt';
  var VAULT_DATA_KEY = 'homer-vault-data';
  var VAULT_SUPA_TS_KEY = 'homer-vault-supa-ts';
  var VAULT_SUPA_META_KEY = 'vault_encrypted_blob';
  var HABITS_KEY = 'homer-habits';
  var HABITS_SYNC_KEY = 'homer-habits-supa-ts';

  function isBogdan() {
    return String(localStorage.getItem('homer-auth-user') || '').trim().toLowerCase() === BOGDAN_USER;
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function safeJson(s, fb) {
    try { return s ? JSON.parse(s) : fb; } catch (_) { return fb; }
  }

  /* ── CSS ──────────────────────────────────────────────────────────── */
  var CSS = `
    #tab-daily-brief { display: none; }
    #db-tab-btn { display: none; }

    .db-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .db-header-left h2 { font-size: 1.35rem; font-weight: 900; color: var(--text); margin: 0 0 4px; }
    .db-header-left p { font-size: .85rem; color: var(--muted); margin: 0; }

    .db-refresh-btn { padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.05); color: var(--muted); font-size: .82rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s; }
    .db-refresh-btn:hover { background: rgba(255,255,255,.1); color: var(--text); }

    .db-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 16px; margin-top: 16px; }
    .db-grid.full-width { grid-template-columns: 1fr; }

    .db-card { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 20px; }
    .db-card-title { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 14px; }

    /* Weather */
    .db-weather { display: flex; align-items: center; gap: 16px; }
    .db-wx-icon { font-size: 2.6rem; line-height: 1; }
    .db-wx-info { flex: 1; }
    .db-wx-temp { font-size: 2rem; font-weight: 900; color: var(--text); line-height: 1; }
    .db-wx-desc { font-size: .85rem; color: var(--muted); margin-top: 4px; }
    .db-wx-place { font-size: .78rem; color: #64748b; margin-top: 2px; }

    /* Tasks / projects */
    .db-task-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .db-task { display: flex; align-items: flex-start; gap: 10px; padding: 9px 12px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-radius: 10px; }
    .db-task-badge { font-size: .64rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; background: rgba(96,165,250,.15); color: #60a5fa; white-space: nowrap; flex-shrink: 0; margin-top: 2px; }
    .db-task-badge.proj { background: rgba(167,139,250,.15); color: #a78bfa; }
    .db-task-title { font-size: .87rem; color: var(--text); font-weight: 600; line-height: 1.3; }
    .db-task-sub { font-size: .75rem; color: #64748b; margin-top: 3px; }

    /* Life goals */
    .db-life-goal { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); margin-bottom: 8px; }
    .db-life-goal:last-child { margin-bottom: 0; }
    .db-lg-icon { font-size: 1.4rem; flex-shrink: 0; }
    .db-lg-body { flex: 1; min-width: 0; }
    .db-lg-title { font-size: .87rem; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .db-lg-bar-wrap { height: 4px; background: rgba(255,255,255,.08); border-radius: 2px; margin-top: 6px; }
    .db-lg-bar { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #60a5fa, #a78bfa); transition: width .4s; }
    .db-lg-pct { font-size: .7rem; color: #64748b; margin-top: 4px; }

    /* Habits */
    .db-habit-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
    .db-habit-row:last-child { border-bottom: none; }
    .db-habit-icon { font-size: 1.15rem; width: 26px; text-align: center; flex-shrink: 0; }
    .db-habit-name { flex: 1; font-size: .87rem; color: var(--text); }
    .db-habit-chip { font-size: .7rem; font-weight: 700; padding: 2px 9px; border-radius: 20px; flex-shrink: 0; }
    .db-habit-chip.done { background: rgba(52,211,153,.15); color: #34d399; }
    .db-habit-chip.pending { background: rgba(239,68,68,.1); color: #f87171; }

    /* Sync status */
    .db-sync-rows { display: flex; flex-direction: column; gap: 8px; }
    .db-sync-row { display: flex; justify-content: space-between; align-items: center; }
    .db-sync-label { font-size: .82rem; color: var(--muted); }
    .db-sync-val { font-size: .82rem; font-weight: 700; }
    .db-sync-good { color: #34d399; }
    .db-sync-warn { color: #fbbf24; }
    .db-sync-bad  { color: #f87171; }
    .db-sync-muted { color: #64748b; }

    .db-empty { color: #475569; font-size: .87rem; font-style: italic; padding: 4px 0; }

    .db-vault-notice { display: flex; align-items: center; gap: 12px; padding: 16px; background: rgba(96,165,250,.06); border: 1px solid rgba(96,165,250,.15); border-radius: 12px; color: var(--muted); font-size: .88rem; }
    .db-vault-notice-icon { font-size: 1.4rem; flex-shrink: 0; }
  `;

  function injectCSS() {
    if (document.getElementById('homer-daily-brief-css')) return;
    var el = document.createElement('style');
    el.id = 'homer-daily-brief-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  /* ── Sidebar button injection ─────────────────────────────────────── */
  function injectSidebarBtn() {
    if (document.getElementById('db-sb-btn')) return;
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
        '<line x1="16" y1="2" x2="16" y2="6"/>' +
        '<line x1="8" y1="2" x2="8" y2="6"/>' +
        '<line x1="3" y1="10" x2="21" y2="10"/>' +
        '<line x1="8" y1="14" x2="13" y2="14"/>' +
        '<line x1="8" y1="18" x2="11" y2="18"/>' +
      '</svg>' +
      '<span class="sb-label">Daily Brief</span>';
    btn.addEventListener('click', function () { showDailyBrief(); });
    if (spacer) sidebar.insertBefore(btn, spacer);
    else sidebar.appendChild(btn);
  }

  /* ── Tab show/hide ────────────────────────────────────────────────── */
  function showDailyBrief() {
    // Deactivate all standard tab sections via the app's own mechanism
    // We call _homerShowTab with a no-op tab name to hide all sections
    // then immediately show ours.
    var orig = window._homerShowTab;
    if (orig) {
      // Temporarily suppress the event so we don't get a feedback loop
      orig('daily-brief'); // fires homer-tab-change which our listener handles
    } else {
      // Fallback: manually hide all standard tab sections
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
    // Tab bar button active state (the .tab-btn with data-tab="daily-brief" is handled
    // by the app-shell's tabBtns.forEach loop in showTab, but our sidebar btn is not)
    var sbBtn = document.getElementById('db-sb-btn');
    if (sbBtn) sbBtn.classList.add('active');
    document.querySelectorAll('.sb-item[data-tab]:not(#db-sb-btn)').forEach(function (i) {
      i.classList.remove('active');
    });
    document.body.dataset.activeTab = 'daily-brief';
    refreshDailyBrief();
  }

  function deactivateDailyBrief() {
    var section = document.getElementById('tab-daily-brief');
    if (section) section.style.display = 'none';
    var sbBtn = document.getElementById('db-sb-btn');
    if (sbBtn) sbBtn.classList.remove('active');
  }

  /* ── Visibility gating (Bogdan only) ─────────────────────────────── */
  function updateBogdanVisibility() {
    var show = isBogdan();
    var tabBtn = document.getElementById('db-tab-btn');
    var sbBtn  = document.getElementById('db-sb-btn');
    if (tabBtn) tabBtn.style.display = show ? '' : 'none';
    if (sbBtn)  sbBtn.style.display  = show ? '' : 'none';
    // If daily-brief is active but user is no longer Bogdan, switch away
    if (!show && document.body.dataset.activeTab === 'daily-brief') {
      var orig = window._homerShowTab;
      if (orig) orig('home');
    }
  }

  /* ── Weather sync ─────────────────────────────────────────────────── */
  function syncWeather() {
    var map = { 'wx-icon': 'db-wx-icon', 'wx-temp': 'db-wx-temp', 'wx-desc': 'db-wx-desc', 'wx-place': 'db-wx-place' };
    Object.keys(map).forEach(function (srcId) {
      var src = document.getElementById(srcId);
      var dst = document.getElementById(map[srcId]);
      if (!src || !dst) return;
      if (srcId === 'wx-temp') dst.innerHTML = src.innerHTML;
      else dst.textContent = src.textContent;
    });
  }

  /* ── Vault data ───────────────────────────────────────────────────── */
  function renderInProgress(goals, projects) {
    var list = document.getElementById('db-inprogress-list');
    if (!list) return;
    var projMap = {};
    (projects || []).forEach(function (p) { projMap[p.id] = p; });
    var items = (goals || []).filter(function (g) {
      return !g.archived && !g.deleted &&
        (g.status === 'progress' || g.status === 'doing' || g.status === 'active');
    });
    if (!items.length) {
      list.innerHTML = '<li class="db-empty">No tasks in progress right now</li>';
      return;
    }
    list.innerHTML = items.slice(0, 15).map(function (g) {
      var proj = projMap[g.projectId];
      var badge = proj ? proj.key : 'TASK';
      var projName = proj ? (' &bull; ' + esc(proj.name)) : '';
      return '<li class="db-task">' +
        '<span class="db-task-badge">' + esc(badge) + '</span>' +
        '<div><div class="db-task-title">' + esc(g.title || 'Untitled') + '</div>' +
        '<div class="db-task-sub">' + esc(g.id || '') + projName + '</div></div>' +
        '</li>';
    }).join('');
  }

  function renderProjects(projects) {
    var list = document.getElementById('db-projects-list');
    if (!list) return;
    var active = (projects || []).filter(function (p) { return !p.archived && !p.deleted; });
    if (!active.length) {
      list.innerHTML = '<li class="db-empty">No active projects</li>';
      return;
    }
    list.innerHTML = active.slice(0, 8).map(function (p) {
      var desc = p.description ? p.description.slice(0, 55) + (p.description.length > 55 ? '…' : '') : '';
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
    var active = (lifeGoals || []).filter(function (g) {
      return !g.archived && !g.deleted && (g.progress || 0) < 100;
    });
    if (!active.length) {
      wrap.innerHTML = '<p class="db-empty">All life goals complete &#x1F31F;</p>';
      return;
    }
    wrap.innerHTML = active.slice(0, 6).map(function (g) {
      var pct = Math.min(100, Math.max(0, g.progress || 0));
      return '<div class="db-life-goal">' +
        '<div class="db-lg-icon">' + esc(g.icon || '&#x1F3AF;') + '</div>' +
        '<div class="db-lg-body">' +
          '<div class="db-lg-title">' + esc(g.title || 'Goal') + '</div>' +
          '<div class="db-lg-bar-wrap"><div class="db-lg-bar" style="width:' + pct + '%"></div></div>' +
          '<div class="db-lg-pct">' + pct + '% complete' + (g.targetDate ? ' &bull; Target: ' + esc(g.targetDate) : '') + '</div>' +
        '</div></div>';
    }).join('');
  }

  function populateFromVault() {
    var notice = document.getElementById('db-vault-notice');
    var vaultGrid = document.getElementById('db-vault-grid');
    var unlocked = !!window._homerVaultUnlocked;
    if (notice) notice.style.display = unlocked ? 'none' : 'flex';
    if (vaultGrid) vaultGrid.style.display = unlocked ? '' : 'none';
    if (!unlocked || typeof window._homerLoadVault !== 'function') return;
    window._homerLoadVault().then(function (data) {
      renderInProgress(data.goals || [], data.projects || []);
      renderProjects(data.projects || []);
      renderLifeGoals(data.lifeGoals || []);
    }).catch(function () {});
  }

  /* ── Habits ───────────────────────────────────────────────────────── */
  function renderHabits() {
    var wrap = document.getElementById('db-habits-wrap');
    if (!wrap) return;
    var raw = safeJson(localStorage.getItem(HABITS_KEY), { habits: [], completions: {} });
    var habits = (raw.habits || []).filter(function (h) { return !h.archived; });
    var completions = raw.completions || {};
    var today = todayStr();
    if (!habits.length) {
      wrap.innerHTML = '<p class="db-empty">No habits configured yet</p>';
      return;
    }
    wrap.innerHTML = habits.slice(0, 10).map(function (h) {
      var key = h.id + ':' + today;
      var done = (completions[key] || 0) >= (h.target || 1);
      return '<div class="db-habit-row">' +
        '<div class="db-habit-icon">' + esc(h.icon || '&#x2714;') + '</div>' +
        '<div class="db-habit-name">' + esc(h.name || 'Habit') + '</div>' +
        '<span class="db-habit-chip ' + (done ? 'done' : 'pending') + '">' + (done ? 'Done' : 'Pending') + '</span>' +
        '</div>';
    }).join('');
  }

  /* ── Sync status ──────────────────────────────────────────────────── */
  function stampAge(ts) {
    if (!ts) return { text: 'Never', cls: 'db-sync-warn' };
    var diff = Date.now() - ts;
    var m = Math.round(diff / 60000);
    if (m <= 1) return { text: 'Just now', cls: 'db-sync-good' };
    if (m < 10) return { text: m + 'm ago', cls: 'db-sync-good' };
    if (m < 60) return { text: m + 'm ago', cls: 'db-sync-warn' };
    var h = Math.round(m / 60);
    return { text: h + 'h ago', cls: 'db-sync-bad' };
  }

  function updateSyncStatus() {
    function setRow(id, text, cls) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className = 'db-sync-val ' + (cls || 'db-sync-muted');
    }
    var localTs = parseInt(localStorage.getItem('homer-local-save-ts') || localStorage.getItem('homer-backup-ts') || '0', 10) || 0;
    var local = stampAge(localTs || 0);
    setRow('db-sync-local', local.text, local.cls);

    var supaTs = parseInt(localStorage.getItem(VAULT_SUPA_TS_KEY) || '0', 10) || 0;
    if (!isBogdan()) {
      setRow('db-sync-supa', 'N/A (browser only)', 'db-sync-muted');
    } else {
      var supa = stampAge(supaTs);
      setRow('db-sync-supa', supa.text, supa.cls);
    }

    var fieldVer = parseInt(localStorage.getItem('homer-field-sync-version') || '0', 10) || 0;
    setRow('db-sync-fields', fieldVer ? 'v' + fieldVer : 'Not started', fieldVer ? 'db-sync-good' : 'db-sync-muted');
  }

  /* ── Date/greeting subtitle ───────────────────────────────────────── */
  function updateSubtitle() {
    var el = document.getElementById('db-subtitle');
    if (!el) return;
    var now = new Date();
    var h = now.getHours();
    var greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    var date = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    el.textContent = greet + ', Bogdan \u2014 ' + date;
  }

  /* ── Main refresh ─────────────────────────────────────────────────── */
  function refreshDailyBrief() {
    updateSubtitle();
    syncWeather();
    populateFromVault();
    renderHabits();
    updateSyncStatus();
  }

  /* ================================================================== */
  /* VAULT SUPABASE SYNC                                                 */
  /* Bogdan only: after every vault save, push encrypted blob to         */
  /* joey_meta (key: vault_encrypted_blob).                              */
  /* Non-Bogdan users: all data stays in IndexedDB / localStorage only.  */
  /* ================================================================== */

  var vaultSyncTimer = null;

  function scheduleVaultSupabaseSync(delayMs) {
    clearTimeout(vaultSyncTimer);
    vaultSyncTimer = setTimeout(pushVaultToSupabase, delayMs || 3000);
  }

  function pushVaultToSupabase() {
    if (!isBogdan()) return;
    var supabase = window.__supabase;
    var session = window.__sbSession;
    if (!supabase || !session || !session.user) return;
    var userId = session.user.id;

    var openReq = indexedDB.open(VAULT_IDB_NAME, 1);
    openReq.onerror = function () {};
    openReq.onsuccess = function (ev) {
      var db = ev.target.result;
      var tx;
      try { tx = db.transaction(VAULT_IDB_STORE, 'readonly'); } catch (_) { return; }
      var saltReq = tx.objectStore(VAULT_IDB_STORE).get(VAULT_SALT_KEY);
      var dataReq = tx.objectStore(VAULT_IDB_STORE).get(VAULT_DATA_KEY);
      tx.oncomplete = function () {
        var salt = saltReq.result || null;
        var data = dataReq.result || null;
        if (!data) return; // nothing to sync yet
        supabase.from('joey_meta').upsert(
          {
            user_id: userId,
            mode: 'personal',
            key: VAULT_SUPA_META_KEY,
            value: { vault_salt: salt, vault_data: data, synced_at: Date.now() },
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,mode,key' }
        ).then(function (res) {
          if (res && res.error) {
            console.warn('[DailyBrief] vault_blob sync error:', res.error.message);
            return;
          }
          var now = Date.now();
          try { localStorage.setItem(VAULT_SUPA_TS_KEY, String(now)); } catch (_) {}
          // Update sync display if daily-brief is active
          if (document.body.dataset.activeTab === 'daily-brief') updateSyncStatus();
        });
      };
    };
  }

  /* ================================================================== */
  /* HABITS SUPABASE SYNC                                               */
  /* Bogdan only: push habits data to joey_meta after any change.        */
  /* ================================================================== */

  var habitsSyncTimer = null;

  function scheduleHabitsSupabaseSync(delayMs) {
    if (!isBogdan()) return;
    clearTimeout(habitsSyncTimer);
    habitsSyncTimer = setTimeout(pushHabitsToSupabase, delayMs || 2000);
  }

  function pushHabitsToSupabase() {
    if (!isBogdan()) return;
    var supabase = window.__supabase;
    var session = window.__sbSession;
    if (!supabase || !session || !session.user) return;
    var userId = session.user.id;
    var raw = localStorage.getItem(HABITS_KEY);
    if (!raw) return;
    var value;
    try { value = JSON.parse(raw); } catch (_) { return; }
    supabase.from('joey_meta').upsert(
      {
        user_id: userId,
        mode: 'personal',
        key: 'habits_data',
        value: value,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,mode,key' }
    ).then(function (res) {
      if (res && res.error) {
        console.warn('[DailyBrief] habits sync error:', res.error.message);
        return;
      }
      try { localStorage.setItem(HABITS_SYNC_KEY, String(Date.now())); } catch (_) {}
    });
  }

  /* ── Hook vault saves ─────────────────────────────────────────────── */
  function hookDataSaves() {
    // Vault save event → Supabase backup for Bogdan
    window.addEventListener('vault-goals-changed', function () {
      if (isBogdan()) scheduleVaultSupabaseSync(2000);
      if (document.body.dataset.activeTab === 'daily-brief') populateFromVault();
    });

    // Watch for habits changes: poll every 30s for changes and sync cross-tab via storage event
    var _lastHabitsJson = localStorage.getItem(HABITS_KEY) || '';
    setInterval(function () {
      var current = localStorage.getItem(HABITS_KEY) || '';
      if (current !== _lastHabitsJson) {
        _lastHabitsJson = current;
        if (isBogdan()) scheduleHabitsSupabaseSync(2000);
        if (document.body.dataset.activeTab === 'daily-brief') renderHabits();
      }
    }, 30000);
    // Also catch cross-tab writes
    window.addEventListener('storage', function (e) {
      if (e.key !== HABITS_KEY) return;
      _lastHabitsJson = e.newValue || '';
      if (isBogdan()) scheduleHabitsSupabaseSync(2000);
      if (document.body.dataset.activeTab === 'daily-brief') renderHabits();
    });

    // When Supabase session arrives, do initial backup
    window.addEventListener('supabase:session', function (e) {
      var session = e && e.detail;
      if (session && session.user && isBogdan()) {
        scheduleVaultSupabaseSync(5000);
        scheduleHabitsSupabaseSync(6000);
      }
    });

    // Periodic backup every 10 minutes for Bogdan
    setInterval(function () {
      if (isBogdan()) {
        pushVaultToSupabase();
        pushHabitsToSupabase();
      }
    }, 10 * 60 * 1000);

    // Vault unlock → populate brief and trigger backup
    window.addEventListener('homer-auth', function () {
      updateBogdanVisibility();
      if (isBogdan()) {
        setTimeout(function () {
          scheduleVaultSupabaseSync(3000);
          scheduleHabitsSupabaseSync(4000);
        }, 1000);
      }
    });
  }

  /* ── Event wiring ─────────────────────────────────────────────────── */
  function wireEvents() {
    // Show/hide daily-brief based on tab changes
    window.addEventListener('homer-tab-change', function (e) {
      var tab = e && e.detail && e.detail.tab;
      if (tab === 'daily-brief') {
        activateDailyBrief();
      } else {
        deactivateDailyBrief();
      }
    });

    // Auth changes
    window.addEventListener('homer-auth', updateBogdanVisibility);
    window.addEventListener('supabase:authchange', updateBogdanVisibility);

    // Refresh button
    var btn = document.getElementById('db-refresh-btn');
    if (btn) btn.addEventListener('click', function () {
      refreshDailyBrief();
      if (isBogdan()) {
        pushVaultToSupabase();
        pushHabitsToSupabase();
      }
    });

    // Vault unlock → refresh brief if on that tab
    window.addEventListener('vault-goals-changed', function () {
      if (document.body.dataset.activeTab === 'daily-brief') refreshDailyBrief();
    });

    // Weather: watch for content to appear and sync
    var wxTemp = document.getElementById('wx-temp');
    if (wxTemp) {
      var obs = new MutationObserver(function () {
        if (document.body.dataset.activeTab === 'daily-brief') syncWeather();
      });
      obs.observe(wxTemp, { childList: true, subtree: true, characterData: true });
    }
  }

  /* ── Init ─────────────────────────────────────────────────────────── */
  ready(function () {
    injectCSS();
    injectSidebarBtn();
    updateBogdanVisibility();
    hookDataSaves();
    wireEvents();

    // If Bogdan already has a session on load, trigger initial sync
    setTimeout(function () {
      if (isBogdan() && window.__sbSession) {
        scheduleVaultSupabaseSync(4000);
        scheduleHabitsSupabaseSync(5000);
      }
    }, 3000);
  });

})();
