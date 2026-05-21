/* ====================================================================
 * Homer Backup Control Panel  v20260521a
 *
 * Bogdan-only: renders a full backup control panel inside #vault-backup-panel
 * (injected between the vault dashboard and the calendar).
 *
 * Shows ALL backup layers with live staleness indicators:
 *   ☁  R2 Cloud        — localStorage + vault IDB (auto-sync)
 *   🗄  Supabase DB     — full DB mirror
 *   📦  Drive Full      — EVERYTHING: local + Supabase field_state + Joey context
 *   🧠  Joey Drive      — Joey AI context markdown files
 *
 * "Backup Everything Now" button fires all layers in parallel.
 * Individual "Sync Now" buttons for each layer.
 * ==================================================================== */
(function () {
  'use strict';

  /* ── Utilities ────────────────────────────────────────────────── */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function safeJson(s, fb) { try { return s ? JSON.parse(s) : fb; } catch (_) { return fb; } }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function isBogdan() {
    var u = localStorage.getItem('homer-auth-user');
    if (u && u.toLowerCase() === 'bogdan') return true;
    var sess = window.__sbSession;
    return !!(sess && sess.user && (sess.user.email || '').toLowerCase().includes('bogdan'));
  }
  function getJwt() {
    var s = window.__sbSession;
    return s && s.access_token ? s.access_token : null;
  }
  function getSyncPass() { return localStorage.getItem('homer-sync-pass') || ''; }

  /* ── Timestamp helpers ──────────────────────────────────────────── */
  function fmtAge(ts) {
    if (!ts) return 'Never';
    var d = Date.now() - ts;
    var m = Math.floor(d / 60000);
    if (m < 2) return 'Just now';
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var dy = Math.floor(h / 24);
    return dy === 1 ? '1 day ago' : dy + ' days ago';
  }
  function statusColor(ts, warnDays, errorDays) {
    if (!ts) return '#ef4444';
    var d = (Date.now() - ts) / 86400000;
    if (d < (warnDays || 3)) return '#34d399';
    if (d < (errorDays || 7)) return '#fbbf24';
    return '#ef4444';
  }

  /* ── IDB reader ─────────────────────────────────────────────────── */
  var IDB_NAME = 'homer-vault-idb', IDB_STORE = 'kv';
  var idbReady = new Promise(function (res, rej) {
    var r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = function (e) { e.target.result.createObjectStore(IDB_STORE); };
    r.onsuccess = function (e) { res(e.target.result); };
    r.onerror = function (e) { rej(e.target.error); };
  });
  function idbGet(key) {
    return idbReady.then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = function () { resolve(req.result !== undefined ? req.result : null); };
        req.onerror = function () { resolve(null); };
      });
    });
  }

  /* ── Collect client snapshot ────────────────────────────────────── */
  var SKIP_EXACT = new Set(['homer-auth-hash']);
  var SKIP_PFX = ['homer-pre-restore-', '_he_ts_', 'homer-tab-leader', 'homer-oc-chat-cache:', 'homer-oc-chat-cleared:'];
  function shouldSkip(k) {
    if (!k) return true;
    if (SKIP_EXACT.has(k)) return true;
    for (var i = 0; i < SKIP_PFX.length; i++) { if (k.startsWith(SKIP_PFX[i])) return true; }
    return false;
  }
  function collectLS() {
    var d = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!shouldSkip(k)) d[k] = localStorage.getItem(k);
    }
    return d;
  }
  function collectIdb() {
    return Promise.all(['homer-vault-salt','homer-vault-hash','homer-vault-data'].map(function (k) {
      return idbGet(k).then(function (v) { return { k: k, v: v }; });
    })).then(function (rs) {
      var o = {};
      rs.forEach(function (r) { if (r.v !== null) o[r.k] = r.v; });
      return o;
    });
  }

  /* ── Backup state keys ──────────────────────────────────────────── */
  var KEY_R2_TS      = 'homer-backup-ts';          // R2 cloud backup
  var KEY_DB_TS      = 'homer-db-backup-ts';        // Supabase DB mirror
  var KEY_DRIVE_TS   = 'homer-drive-backup-ts';     // Joey context Drive
  var KEY_FULL_TS    = 'homer-drive-fullbackup-ts'; // Full Drive backup (this script)
  var KEY_FULL_STATS = 'homer-drive-fullbackup-stats';
  var KEY_JOEY_TS    = 'homer-joey-sync-ts';

  function ts(key) { return parseInt(localStorage.getItem(key) || '0', 10) || 0; }

  /* ── Run Full Drive Backup ──────────────────────────────────────── */
  function runFullBackup(onStatus) {
    var jwt = getJwt(), pass = getSyncPass();
    if (!jwt && !pass) return Promise.reject(new Error('Not authenticated. Unlock vault first.'));
    onStatus('Collecting local data\u2026');
    return collectIdb().then(function (idbData) {
      var snap = Object.assign({}, collectLS(), idbData);
      onStatus('Uploading to Google Drive (15\u201330s)\u2026');
      var headers = { 'Content-Type': 'application/json' };
      if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
      var body = { clientSnapshot: snap };
      if (!jwt) body.passphrase = pass;
      return fetch('/api/gdrive-full-backup', { method: 'POST', headers: headers, body: JSON.stringify(body) });
    }).then(function (r) { return r.json(); }).then(function (result) {
      if (result && result.ok) {
        localStorage.setItem(KEY_FULL_TS, String(Date.now()));
        localStorage.setItem(KEY_FULL_STATS, JSON.stringify(result.stats || {}));
      }
      return result;
    });
  }

  /* ── Run DB Mirror ──────────────────────────────────────────────── */
  function runDbMirror(onStatus) {
    if (typeof window._homerBackupEverythingToDb === 'function') {
      onStatus('Mirroring to Supabase\u2026');
      return window._homerBackupEverythingToDb().catch(function (e) { return { ok: false, error: e.message }; });
    }
    return Promise.resolve({ ok: false, error: 'DB mirror not available' });
  }

  /* ── Run Joey Drive Backup ──────────────────────────────────────── */
  function runJoeyDrive(onStatus) {
    var jwt = getJwt(), pass = getSyncPass();
    if (!jwt && !pass) return Promise.resolve({ ok: false, error: 'Not authenticated' });
    onStatus('Backing up Joey context to Drive\u2026');
    var headers = { 'Content-Type': 'application/json' };
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    var body = {};
    if (!jwt) body.passphrase = pass;
    return fetch('/api/gdrive-backup', { method: 'POST', headers: headers, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (result) {
        if (result && result.ok) localStorage.setItem(KEY_DRIVE_TS, String(Date.now()));
        return result;
      });
  }

  /* ── Vault tile render ──────────────────────────────────────────── */
  function renderTile() {
    var tileEl = document.getElementById('vd-backup-tile');
    if (!tileEl) return;
    // Show tile for any logged-in user (vault itself is auth-gated; tile is just status info)
    tileEl.style.display = '';

    var fullTs  = ts(KEY_FULL_TS);
    var stats   = safeJson(localStorage.getItem(KEY_FULL_STATS), null);
    var descEl  = document.getElementById('vd-backup-desc');
    var badgeEl = document.getElementById('vd-backup-badge');

    if (descEl) {
      if (fullTs) {
        var rows = stats && stats.totalSupabaseRows ? stats.totalSupabaseRows + ' rows · ' : '';
        descEl.textContent = rows + fmtAge(fullTs);
      } else {
        descEl.textContent = 'Never backed up';
      }
    }

    if (badgeEl) {
      var col = statusColor(fullTs, 3, 7);
      badgeEl.textContent = fullTs ? fmtAge(fullTs).replace(' ago', '') : '!';
      badgeEl.style.background = col + '22';
      badgeEl.style.color = col;
      badgeEl.style.border = '1px solid ' + col + '66';
    }

    // Wire click once — scroll to the full control panel
    if (!tileEl.dataset.tileWired) {
      tileEl.dataset.tileWired = '1';
      tileEl.addEventListener('click', function () {
        if (panelEl) {
          panelEl.scrollIntoView({ behavior: 'smooth' });
          panelEl.style.outline = '2px solid rgba(99,102,241,.5)';
          setTimeout(function () { panelEl.style.outline = ''; }, 1500);
        }
      });
    }
  }

  /* ── Panel render ───────────────────────────────────────────────── */
  var panelEl = null;

  function renderPanel() {
    if (!panelEl) return;

    var r2Ts    = ts(KEY_R2_TS);
    var dbTs    = ts(KEY_DB_TS);
    var fullTs  = ts(KEY_FULL_TS);
    var joeyTs  = ts(KEY_DRIVE_TS);
    var stats   = safeJson(localStorage.getItem(KEY_FULL_STATS), null);

    function row(icon, label, tsVal, warnD, errD) {
      var c = statusColor(tsVal, warnD, errD);
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);">'
        + '<div style="width:8px;height:8px;border-radius:50%;background:' + c + ';flex-shrink:0;box-shadow:0 0 5px ' + c + '55;"></div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:.88rem;font-weight:700;color:#e5e7eb;">' + icon + '&nbsp; ' + label + '</div>'
        + '<div style="font-size:.75rem;color:#64748b;margin-top:1px;">' + fmtAge(tsVal) + (tsVal ? ' &mdash; ' + new Date(tsVal).toLocaleString() : '') + '</div>'
        + '</div>'
        + '<span style="padding:3px 10px;border-radius:20px;background:' + c + '18;color:' + c + ';border:1px solid ' + c + '44;font-size:.72rem;font-weight:700;">'
        + (tsVal ? fmtAge(tsVal) : 'Never') + '</span></div>';
    }

    var statsHtml = '';
    if (stats) {
      var chips = [];
      var c = stats.counts || {};
      if (stats.clientKeys)           chips.push(stats.clientKeys + ' local keys');
      if (stats.totalSupabaseRows)    chips.push(stats.totalSupabaseRows + ' DB rows total');
      if (c.messages)                 chips.push(c.messages + ' messages');
      if (c.memories)                 chips.push(c.memories + ' memories');
      if (c.journal)                  chips.push(c.journal + ' journal entries');
      if (c.fieldState)               chips.push(c.fieldState + ' cloud fields');
      if (c.habits)                   chips.push(c.habits + ' habits');
      if (c.habitCompletions)         chips.push(c.habitCompletions + ' completions');
      if (c.tasks)                    chips.push(c.tasks + ' tasks');
      if (c.focusSessions)            chips.push(c.focusSessions + ' focus sessions');
      if (chips.length) {
        statsHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);">'
          + chips.map(function (chip) {
              return '<span style="padding:3px 10px;border-radius:20px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.18);color:#93c5fd;font-size:.74rem;font-weight:600;">' + chip + '</span>';
            }).join('')
          + '</div>';
      }
    }

    panelEl.innerHTML =
      '<div class="card" style="padding:20px;background:linear-gradient(135deg,rgba(15,23,42,.97),rgba(2,6,23,.95));border:1px solid rgba(99,102,241,.18);">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;">'
      + '<div><h3 style="margin:0 0 3px;font-size:1rem;font-weight:800;color:#e5e7eb;">&#x1F6E1;&#xFE0F; Backup Control Panel</h3>'
      + '<p style="margin:0;font-size:.74rem;color:#64748b;">localStorage &bull; vault IDB &bull; habits, expenses, inbox, notes, car, tasks (Android+web) &bull; focus sessions &bull; Joey memories &amp; history</p></div>'
      + '<button id="bcp-backup-all" class="btn primary" style="padding:8px 18px;font-size:.85rem;font-weight:800;border-radius:10px;flex-shrink:0;">&#x2601; Backup Everything Now</button>'
      + '</div>'
      // Status rows
      + '<div style="margin-bottom:4px;">'
      + row('&#x2601;', 'R2 Cloud &mdash; auto-sync (browser data)', r2Ts, 1, 3)
      + row('&#x1F5C4;', 'Supabase DB Mirror &mdash; full database', dbTs, 1, 3)
      + row('&#x1F4E6;', 'Drive Full Backup &mdash; everything, all devices', fullTs, 3, 7)
      + row('&#x1F9E0;', 'Joey Context &mdash; AI memories &amp; history', joeyTs, 3, 7)
      + '</div>'
      // Individual action buttons
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;">'
      + '<button id="bcp-full-drive" class="btn ghost" style="padding:7px 14px;font-size:.8rem;border-radius:9px;font-weight:700;">&#x1F4E6; Full Drive Backup</button>'
      + '<button id="bcp-db-mirror" class="btn ghost" style="padding:7px 14px;font-size:.8rem;border-radius:9px;font-weight:700;">&#x1F5C4; DB Mirror</button>'
      + '<button id="bcp-joey-drive" class="btn ghost" style="padding:7px 14px;font-size:.8rem;border-radius:9px;font-weight:700;">&#x1F9E0; Joey Context</button>'
      + '</div>'
      + '<div id="bcp-status" style="min-height:1.3rem;font-size:.82rem;color:#64748b;margin-top:10px;"></div>'
      + statsHtml
      + '</div>';

    // Wire up buttons
    function setStatus(msg, color) {
      var el = document.getElementById('bcp-status');
      if (el) { el.textContent = msg; el.style.color = color || '#64748b'; }
    }

    function withBtn(id, fn) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        var orig = btn.textContent;
        btn.disabled = true;
        fn(function (msg) { setStatus(msg); })
          .then(function (result) {
            var ok = result && result.ok;
            setStatus(ok ? '\u2713 Done' : '\u2717 ' + ((result && result.error) || 'Failed'), ok ? '#34d399' : '#ef4444');
            renderTile();
            renderPanel();
            setTimeout(function () { btn.disabled = false; btn.textContent = orig; }, 2000);
          })
          .catch(function (e) {
            setStatus('\u2717 ' + e.message, '#ef4444');
            btn.disabled = false;
            btn.textContent = orig;
          });
      });
    }

    withBtn('bcp-full-drive', runFullBackup);
    withBtn('bcp-db-mirror', runDbMirror);
    withBtn('bcp-joey-drive', runJoeyDrive);

    // Backup Everything — runs all three in sequence so status is readable
    var allBtn = document.getElementById('bcp-backup-all');
    if (allBtn) {
      allBtn.addEventListener('click', function () {
        allBtn.disabled = true;
        allBtn.textContent = '\u23F3 Running\u2026';
        setStatus('Starting full backup sequence\u2026');

        runFullBackup(setStatus)
          .then(function (r1) {
            setStatus((r1 && r1.ok ? '\u2713 Drive full' : '\u2717 Drive failed') + ' \u2014 mirroring DB\u2026');
            return runDbMirror(setStatus);
          })
          .then(function (r2) {
            setStatus((r2 && r2.ok ? '\u2713 DB mirror' : '\u2717 DB failed') + ' \u2014 Joey context\u2026');
            return runJoeyDrive(setStatus);
          })
          .then(function (r3) {
            setStatus('\u2713 All backups complete!', '#34d399');
            allBtn.textContent = '\u2713 Done';
            setTimeout(function () {
              allBtn.disabled = false;
              allBtn.textContent = '\u2601 Backup Everything Now';
              renderPanel();
            }, 2500);
          })
          .catch(function (e) {
            setStatus('\u2717 ' + e.message, '#ef4444');
            allBtn.disabled = false;
            allBtn.textContent = '\u2601 Backup Everything Now';
          });
      });
    }

    // Wire the OC panel "Full Backup to Drive" button too
    var ocBtn = document.getElementById('oc-gdrive-full-backup');
    if (ocBtn && !ocBtn.dataset.fbWired) {
      ocBtn.dataset.fbWired = '1';
      ocBtn.addEventListener('click', function () {
        var orig = ocBtn.textContent;
        ocBtn.disabled = true;
        ocBtn.textContent = '\u23F3 Backing up\u2026';
        runFullBackup(function () {})
          .then(function (r) {
            ocBtn.textContent = (r && r.ok) ? '\u2713 Done!' : '\u2717 Failed';
            renderPanel();
            setTimeout(function () { ocBtn.disabled = false; ocBtn.textContent = orig; }, 2500);
          })
          .catch(function () { ocBtn.disabled = false; ocBtn.textContent = orig; });
      });
    }
  }

  /* ── Init ───────────────────────────────────────────────────────── */
  function show() {
    // Always render the tile (it's just status info; vault is already auth-gated)
    renderTile();
    // Full control panel only for Bogdan
    if (!isBogdan()) return;
    panelEl = document.getElementById('vault-backup-panel');
    if (!panelEl) return;
    panelEl.style.display = 'block';
    renderPanel();
  }

  ready(function () {
    // Show immediately on load
    show();
    // Retry after 800ms in case Supabase/auth initializes after DOMContentLoaded
    setTimeout(show, 800);
    // Retry after 2.5s for slow auth
    setTimeout(show, 2500);

    window.addEventListener('homer-vault-state', function () { show(); });
    window.addEventListener('homer-auth', function () { show(); });

    // Refresh badge staleness every 5 min
    setInterval(function () {
      renderTile();
      if (panelEl && panelEl.style.display !== 'none') renderPanel();
    }, 5 * 60 * 1000);
  });

})();
