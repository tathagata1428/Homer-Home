/* ====================================================================
 * Homer Journal  v20260608a
 * Changes from v20260515a:
 *  - Past-date entry: editable date picker in editor header
 *  - Import wizard: plain text / markdown, Day One JSON, generic JSON, CSV
 *  - Joey JOURNAL action handled: dispatch creates an entry from agent response
 * ==================================================================== */
(function () {
  'use strict';

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function safeJson(s, fb) { try { return s ? JSON.parse(s) : fb; } catch (_) { return fb; } }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  /* ── CSS ──────────────────────────────────────────────────────────── */
  var CSS = `
    /* Journal tab */
    #tab-journal { padding: 16px; }

    /* Header */
    .jn-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; gap:12px; }
    .jn-header-title { }
    .jn-title-main { font-size:1.7rem; font-weight:900; letter-spacing:.12em; color:#f0f0ff; line-height:1.1; text-transform:uppercase; }
    .jn-title-sub  { font-size:1.7rem; font-weight:900; letter-spacing:.12em; color:#CC00FF; line-height:1.1; text-transform:uppercase; }
    .jn-title-bar  { width:56px; height:2px; background:linear-gradient(90deg,#CC00FF,#FF0066); margin-top:6px; border-radius:1px; }
    .jn-header-btns { display:flex; gap:8px; flex-shrink:0; align-items:center; }
    .jn-new-btn { display:flex; align-items:center; gap:6px; padding:10px 16px; border-radius:14px; border:none; background:linear-gradient(135deg,#CC00FF,#FF0066); color:#fff; font-size:.82rem; font-weight:900; letter-spacing:.06em; cursor:pointer; }
    .jn-new-btn:hover { filter:brightness(1.15); }
    .jn-import-btn { display:flex; align-items:center; gap:5px; padding:9px 13px; border-radius:14px; border:1px solid rgba(204,0,255,.4); background:rgba(204,0,255,.08); color:rgba(204,0,255,.85); font-size:.78rem; font-weight:800; letter-spacing:.04em; cursor:pointer; }
    .jn-import-btn:hover { background:rgba(204,0,255,.15); color:#CC00FF; }

    /* Stats card */
    .jn-stats-card { background:linear-gradient(135deg,rgba(204,0,255,.04),rgba(255,0,102,.025)); border:1px solid; border-image:linear-gradient(135deg,rgba(204,0,255,.5),rgba(255,0,102,.3)) 1; border-radius:18px; padding:16px; margin-bottom:16px; }
    .jn-stats-row { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
    .jn-streak-block { flex:1; }
    .jn-streak-label { font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:rgba(204,0,255,.7); }
    .jn-streak-num { font-size:1.9rem; font-weight:900; color:#CC00FF; line-height:1.1; }
    .jn-streak-unit { font-size:.85rem; color:#64748b; margin-left:4px; }
    .jn-total-block { text-align:right; }
    .jn-total-num  { font-size:1.4rem; font-weight:900; color:#FF0066; }
    .jn-total-label { font-size:.72rem; color:#64748b; }
    .jn-divider { width:100%; height:1px; background:linear-gradient(90deg,rgba(204,0,255,.2),transparent); margin-bottom:12px; }

    /* 7-day mood strip */
    .jn-mood-strip { display:flex; justify-content:space-between; }
    .jn-mood-day { display:flex; flex-direction:column; align-items:center; gap:4px; }
    .jn-mood-day-label { font-size:.68rem; letter-spacing:.05em; color:#64748b; }
    .jn-mood-day-label.today { color:#CC00FF; font-weight:900; }
    .jn-mood-circle { width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,.05); display:flex; align-items:center; justify-content:center; font-size:.85rem; }
    .jn-mood-circle.has-entry { background:rgba(204,0,255,.18); }
    .jn-mood-circle.is-today  { outline:1px solid rgba(204,0,255,.6); }
    .jn-mood-dot { width:6px; height:6px; border-radius:50%; background:rgba(204,0,255,.5); }

    /* AI Prompt card */
    .jn-prompt-card { background:linear-gradient(135deg,rgba(0,255,255,.03),rgba(204,0,255,.025)); border:1px solid; border-image:linear-gradient(135deg,rgba(0,255,255,.5),rgba(204,0,255,.3)) 1; border-radius:18px; padding:16px; margin-bottom:16px; }
    .jn-prompt-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
    .jn-prompt-badge { font-size:.68rem; font-weight:900; text-transform:uppercase; letter-spacing:.12em; color:#00FFFF; flex:1; }
    .jn-prompt-refresh { background:none; border:none; color:rgba(0,255,255,.6); cursor:pointer; font-size:1.1rem; padding:0; line-height:1; width:24px; height:24px; display:flex; align-items:center; justify-content:center; }
    .jn-prompt-refresh:hover { color:#00FFFF; }
    .jn-prompt-divider { width:100%; height:1px; background:linear-gradient(90deg,rgba(0,255,255,.3),transparent); margin-bottom:10px; }
    .jn-prompt-text { font-size:.92rem; color:#f0f0ff; line-height:1.6; font-style:italic; margin-bottom:12px; }
    .jn-prompt-write { display:inline-block; padding:8px 16px; border-radius:10px; background:linear-gradient(135deg,#CC00FF,#FF0066); border:none; color:#fff; font-size:.8rem; font-weight:900; letter-spacing:.06em; cursor:pointer; }
    .jn-prompt-write:hover { filter:brightness(1.15); }
    .jn-prompt-loading { font-size:.82rem; color:#64748b; font-style:italic; }

    /* Entry list */
    .jn-month-label { font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:rgba(204,0,255,.6); margin:12px 0 6px; }
    .jn-entry-card { display:flex; border-radius:14px; background:rgba(255,255,255,.03); border:1px solid; border-image:linear-gradient(135deg,rgba(204,0,255,.3),rgba(255,0,102,.15)) 1; margin-bottom:8px; cursor:pointer; overflow:hidden; transition:background .15s; }
    .jn-entry-card:hover { background:rgba(204,0,255,.06); }
    .jn-entry-stripe { width:3px; flex-shrink:0; background:linear-gradient(180deg,#CC00FF,rgba(255,0,102,.4)); }
    .jn-entry-body { flex:1; padding:11px 12px; min-width:0; }
    .jn-entry-top { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
    .jn-entry-mood { font-size:1.1rem; flex-shrink:0; }
    .jn-entry-meta { flex:1; min-width:0; }
    .jn-entry-date { font-size:.82rem; font-weight:700; color:#f0f0ff; }
    .jn-entry-mood-label { font-size:.7rem; color:rgba(204,0,255,.7); font-weight:600; }
    .jn-entry-wc { font-size:.7rem; font-weight:800; color:rgba(204,0,255,.8); background:rgba(204,0,255,.08); border:1px solid rgba(204,0,255,.25); border-radius:6px; padding:2px 7px; white-space:nowrap; }
    .jn-entry-preview { font-size:.8rem; color:#64748b; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .jn-entry-ai-badge { font-size:.7rem; color:rgba(0,255,255,.6); margin-top:4px; }

    /* Empty state */
    .jn-empty { text-align:center; padding:48px 20px; }
    .jn-empty-icon { font-size:2.5rem; margin-bottom:10px; }
    .jn-empty-title { font-size:.78rem; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:rgba(204,0,255,.5); margin-bottom:6px; }
    .jn-empty-sub { font-size:.82rem; color:#64748b; }

    /* Editor overlay */
    #jn-editor-overlay { position:fixed; inset:0; z-index:11000; background:rgba(2,0,24,.9); backdrop-filter:blur(8px); display:none; flex-direction:column; overflow-y:auto; }
    #jn-editor-overlay.open { display:flex; }
    #jn-editor-box { background:linear-gradient(160deg,#110025,#0B0018); border-bottom:1px solid rgba(204,0,255,.15); min-height:100%; padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0); display:flex; flex-direction:column; width:100%; max-width:640px; margin:0 auto; }

    /* Editor top bar */
    .jn-ed-bar { display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid; border-image:linear-gradient(90deg,rgba(204,0,255,.4),rgba(255,0,102,.2),transparent) 1; }
    .jn-ed-back { background:none; border:none; color:#CC00FF; font-size:1.3rem; cursor:pointer; padding:4px 8px; line-height:1; }
    .jn-ed-date-block { flex:1; }
    .jn-ed-date-input { background:none; border:none; color:#f0f0ff; font-size:.8rem; font-weight:700; cursor:pointer; padding:0; outline:none; font-family:inherit; max-width:160px; }
    .jn-ed-date-input::-webkit-calendar-picker-indicator { filter:invert(.7) sepia(1) saturate(3) hue-rotate(245deg); opacity:.7; width:13px; height:13px; cursor:pointer; margin-left:4px; }
    .jn-ed-date-hint { font-size:.62rem; color:rgba(204,0,255,.5); margin-top:2px; }
    .jn-ed-wc { font-size:.68rem; color:rgba(204,0,255,.6); }
    .jn-ed-del-btn { background:none; border:none; color:rgba(239,68,68,.5); cursor:pointer; font-size:1rem; padding:4px 6px; line-height:1; }
    .jn-ed-del-btn:hover { color:rgba(239,68,68,.9); }
    .jn-ed-save-btn { padding:8px 18px; border-radius:10px; border:none; background:linear-gradient(135deg,#CC00FF,#FF0066); color:#fff; font-size:.72rem; font-weight:900; letter-spacing:.15em; cursor:pointer; }
    .jn-ed-save-btn:hover { filter:brightness(1.15); }

    /* Editor body */
    .jn-ed-body { flex:1; padding:16px; display:flex; flex-direction:column; gap:16px; }

    /* Mood picker */
    .jn-mood-section-label { font-size:.62rem; font-weight:900; text-transform:uppercase; letter-spacing:.2em; color:rgba(204,0,255,.65); margin-bottom:8px; }
    .jn-mood-row { display:flex; justify-content:space-between; }
    .jn-mood-btn { display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; }
    .jn-mood-btn-circle { width:44px; height:44px; border-radius:50%; background:rgba(17,0,37,1); border:1px solid rgba(255,255,255,.12); display:flex; align-items:center; justify-content:center; font-size:1.25rem; transition:all .15s; }
    .jn-mood-btn.selected .jn-mood-btn-circle { background:rgba(204,0,255,.2); border:2px solid #CC00FF; }
    .jn-mood-btn-label { font-size:.62rem; letter-spacing:.03em; color:#64748b; }
    .jn-mood-btn.selected .jn-mood-btn-label { color:#CC00FF; font-weight:900; }

    /* Writing area */
    #jn-ed-content { width:100%; min-height:220px; padding:13px; border-radius:11px; border:1px solid rgba(204,0,255,.25); background:rgba(255,255,255,.03); color:#f0f0ff; font-size:.95rem; font-family:inherit; resize:vertical; line-height:1.7; outline:none; }
    #jn-ed-content:focus { border-color:#CC00FF; }
    #jn-ed-content::placeholder { color:rgba(100,116,139,.5); }

    /* AI Reflection button */
    .jn-reflect-btn { width:100%; padding:14px; border-radius:12px; border:1px solid; border-image:linear-gradient(135deg,rgba(204,0,255,.6),rgba(255,0,102,.3)) 1; background:linear-gradient(135deg,rgba(204,0,255,.12),rgba(255,0,102,.06)); cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; color:#CC00FF; font-size:.82rem; font-weight:700; font-family:inherit; transition:filter .15s; }
    .jn-reflect-btn:hover:not(:disabled) { filter:brightness(1.2); }
    .jn-reflect-btn:disabled { opacity:.5; cursor:default; }
    .jn-reflect-btn.loading { background:linear-gradient(135deg,rgba(204,0,255,.06),rgba(204,0,255,.06)); }

    /* Reflection card */
    .jn-reflection-card { border-radius:16px; background:rgba(17,0,37,.8); border:1px solid; border-image:linear-gradient(135deg,rgba(204,0,255,.5),rgba(0,255,255,.3)) 1; padding:16px; display:flex; flex-direction:column; gap:12px; }
    .jn-ref-head { display:flex; align-items:center; gap:6px; }
    .jn-ref-badge { font-size:.68rem; font-weight:900; text-transform:uppercase; letter-spacing:.15em; color:#CC00FF; flex:1; }
    .jn-ref-mood-pill { padding:3px 10px; border-radius:20px; background:rgba(204,0,255,.12); border:1px solid rgba(204,0,255,.4); font-size:.72rem; color:#CC00FF; font-weight:700; }
    .jn-ref-divider { height:1px; background:linear-gradient(90deg,rgba(204,0,255,.3),transparent); }
    .jn-ref-themes { display:flex; align-items:center; gap:6px; flex-wrap:wrap; overflow:hidden; }
    .jn-ref-themes-label { font-size:.6rem; font-weight:900; text-transform:uppercase; letter-spacing:.12em; color:#64748b; white-space:nowrap; }
    .jn-ref-theme-chip { padding:2px 8px; border-radius:20px; background:rgba(0,255,255,.08); border:1px solid rgba(0,255,255,.3); font-size:.72rem; color:rgba(0,255,255,.8); white-space:nowrap; }
    .jn-ref-insight { }
    .jn-ref-insight-label { font-size:.6rem; font-weight:900; text-transform:uppercase; letter-spacing:.12em; color:#64748b; margin-bottom:4px; }
    .jn-ref-insight-text { font-size:.85rem; color:#f0f0ff; line-height:1.6; }
    .jn-ref-affirmation { padding:12px; border-radius:10px; background:rgba(255,0,102,.06); border:1px solid rgba(255,0,102,.2); display:flex; gap:8px; align-items:flex-start; }
    .jn-ref-aff-icon { color:#FF0066; font-size:.9rem; flex-shrink:0; margin-top:1px; }
    .jn-ref-aff-text { font-size:.85rem; color:rgba(255,0,102,.9); line-height:1.6; font-weight:600; }

    /* Spinner */
    @keyframes jn-spin { to { transform:rotate(360deg); } }
    .jn-spinner { width:14px; height:14px; border:2px solid rgba(204,0,255,.3); border-top-color:#CC00FF; border-radius:50%; animation:jn-spin .7s linear infinite; flex-shrink:0; }

    /* List delete button */
    .jn-entry-card { position:relative; }
    .jn-list-del { position:absolute; top:8px; right:8px; background:none; border:none; color:rgba(239,68,68,.3); cursor:pointer; font-size:.95rem; padding:3px 7px; border-radius:6px; opacity:0; transition:opacity .15s,color .15s,background .15s; line-height:1; }
    .jn-entry-card:hover .jn-list-del { opacity:1; }
    .jn-list-del:hover { color:#ef4444; background:rgba(239,68,68,.1); }

    /* Delete confirm */
    .jn-confirm-overlay { position:fixed; inset:0; z-index:12000; background:rgba(0,0,0,.7); display:flex; align-items:center; justify-content:center; padding:20px; }
    .jn-confirm-box { background:#110025; border:1px solid rgba(204,0,255,.3); border-radius:18px; padding:24px; width:100%; max-width:340px; }
    .jn-confirm-title { font-size:1rem; font-weight:800; color:#f0f0ff; margin-bottom:8px; }
    .jn-confirm-text  { font-size:.82rem; color:#64748b; line-height:1.5; margin-bottom:20px; }
    .jn-confirm-btns  { display:flex; gap:10px; justify-content:flex-end; }
    .jn-confirm-cancel { padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:none; color:#94a3b8; cursor:pointer; font-size:.82rem; font-family:inherit; }
    .jn-confirm-delete { padding:8px 16px; border-radius:8px; border:1px solid rgba(239,68,68,.5); background:rgba(239,68,68,.15); color:#ef4444; cursor:pointer; font-size:.82rem; font-weight:800; font-family:inherit; letter-spacing:.05em; }

    /* ── Import overlay ─────────────────────────────────────────────── */
    #jn-import-overlay { position:fixed; inset:0; z-index:11000; background:rgba(2,0,24,.92); backdrop-filter:blur(8px); display:none; flex-direction:column; overflow-y:auto; }
    #jn-import-overlay.open { display:flex; }
    #jn-import-box { background:linear-gradient(160deg,#110025,#0B0018); min-height:100%; padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0); display:flex; flex-direction:column; width:100%; max-width:640px; margin:0 auto; }
    .jn-imp-bar { display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid; border-image:linear-gradient(90deg,rgba(204,0,255,.4),rgba(255,0,102,.2),transparent) 1; }
    .jn-imp-title { flex:1; font-size:.82rem; font-weight:900; letter-spacing:.1em; color:#f0f0ff; text-transform:uppercase; }
    .jn-imp-close { background:none; border:none; color:rgba(204,0,255,.7); font-size:1.3rem; cursor:pointer; padding:4px 8px; line-height:1; }
    .jn-imp-body { flex:1; padding:16px; display:flex; flex-direction:column; gap:14px; }
    .jn-imp-hint { font-size:.78rem; color:#64748b; line-height:1.6; }
    .jn-imp-hint strong { color:rgba(204,0,255,.8); }
    .jn-imp-format-row { display:flex; gap:6px; flex-wrap:wrap; }
    .jn-imp-fmt-btn { padding:6px 12px; border-radius:8px; border:1px solid rgba(204,0,255,.3); background:none; color:#64748b; font-size:.72rem; font-weight:700; letter-spacing:.05em; cursor:pointer; font-family:inherit; transition:all .15s; }
    .jn-imp-fmt-btn.active { background:rgba(204,0,255,.15); border-color:#CC00FF; color:#CC00FF; }
    .jn-imp-upload-row { display:flex; align-items:center; gap:10px; }
    .jn-imp-file-label { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; border:1px solid rgba(204,0,255,.3); background:rgba(204,0,255,.06); color:rgba(204,0,255,.8); font-size:.75rem; font-weight:700; cursor:pointer; white-space:nowrap; }
    .jn-imp-file-label:hover { background:rgba(204,0,255,.12); }
    #jn-imp-file { display:none; }
    .jn-imp-file-name { font-size:.75rem; color:#64748b; }
    .jn-imp-sep { display:flex; align-items:center; gap:8px; color:#64748b; font-size:.72rem; }
    .jn-imp-sep::before, .jn-imp-sep::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.08); }
    #jn-imp-text { width:100%; min-height:160px; padding:12px; border-radius:11px; border:1px solid rgba(204,0,255,.2); background:rgba(255,255,255,.03); color:#f0f0ff; font-size:.85rem; font-family:inherit; resize:vertical; line-height:1.6; outline:none; box-sizing:border-box; }
    #jn-imp-text:focus { border-color:rgba(204,0,255,.5); }
    #jn-imp-text::placeholder { color:rgba(100,116,139,.4); }
    .jn-imp-parse-btn { width:100%; padding:13px; border-radius:12px; border:none; background:linear-gradient(135deg,rgba(204,0,255,.2),rgba(255,0,102,.1)); color:#CC00FF; font-size:.82rem; font-weight:900; letter-spacing:.08em; cursor:pointer; font-family:inherit; border:1px solid rgba(204,0,255,.4); }
    .jn-imp-parse-btn:hover { filter:brightness(1.15); }
    #jn-imp-preview { display:none; }
    .jn-imp-preview-head { font-size:.72rem; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:rgba(204,0,255,.7); margin-bottom:10px; }
    .jn-imp-preview-list { display:flex; flex-direction:column; gap:6px; max-height:260px; overflow-y:auto; margin-bottom:12px; }
    .jn-imp-prev-item { padding:8px 12px; border-radius:10px; background:rgba(255,255,255,.03); border:1px solid rgba(204,0,255,.15); }
    .jn-imp-prev-date { font-size:.72rem; font-weight:800; color:#CC00FF; margin-bottom:3px; }
    .jn-imp-prev-text { font-size:.78rem; color:#94a3b8; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .jn-imp-prev-more { font-size:.72rem; color:#64748b; text-align:center; padding:4px; }
    .jn-imp-confirm-btn { width:100%; padding:14px; border-radius:12px; border:none; background:linear-gradient(135deg,#CC00FF,#FF0066); color:#fff; font-size:.85rem; font-weight:900; letter-spacing:.08em; cursor:pointer; font-family:inherit; }
    .jn-imp-confirm-btn:hover { filter:brightness(1.1); }
    .jn-imp-err { font-size:.78rem; color:#f87171; background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.2); border-radius:8px; padding:10px 12px; }
    .jn-imp-success { font-size:.78rem; color:#34d399; background:rgba(52,211,153,.08); border:1px solid rgba(52,211,153,.2); border-radius:8px; padding:10px 12px; }
  `;
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ── Data ──────────────────────────────────────────────────────────── */
  var JKEY = 'homer-journal';
  var SB_FIELD_ID = 'ls:homer-journal';
  var syncTimer = null;

  function getEntries() { return safeJson(localStorage.getItem(JKEY), []); }
  function getActiveEntries() { return getEntries().filter(function (e) { return !e.deleted; }); }
  function saveEntries(arr) {
    try { localStorage.setItem(JKEY, JSON.stringify(arr)); } catch (_) {}
    scheduleSync(arr);
  }

  /* ── Supabase sync ──────────────────────────────────────────────────── */
  function isBogdan() {
    var u = localStorage.getItem('homer-auth-user');
    if (u && u.toLowerCase() === 'bogdan') return true;
    var sess = window.__sbSession;
    return !!(sess && sess.user && (sess.user.email || '').toLowerCase().includes('bogdan'));
  }
  function getSbClient() { return window.__supabase || null; }
  function getSbUid() {
    var sess = window.__sbSession;
    return (sess && sess.user && sess.user.id) || null;
  }

  function scheduleSync(entries) {
    if (!isBogdan()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { pushToSupabase(entries || getEntries()); }, 800);
  }

  function pushToSupabase(entries) {
    var client = getSbClient(), uid2 = getSbUid();
    if (!client || !uid2) return;
    var ts  = Date.now();
    client.from('field_state').upsert({
      user_id:    uid2,
      field_id:   SB_FIELD_ID,
      kind:       'json',
      value:      JSON.stringify(entries),
      client_ts:  ts,
      client_seq: 0,
      device_id:  'web',
      updated_at: new Date(ts).toISOString(),
    }, { onConflict: 'user_id,field_id' }).then(function (r) {
      if (r.error) console.debug('[journal] push error:', r.error.message);
    });
  }

  function pullFromSupabase(callback) {
    var client = getSbClient(), uid2 = getSbUid();
    if (!client || !uid2 || !isBogdan()) return;
    client.from('field_state')
      .select('value,server_ts')
      .eq('user_id', uid2)
      .eq('field_id', SB_FIELD_ID)
      .maybeSingle()
      .then(function (r) {
        if (!r.data || !r.data.value) return;
        var remote = safeJson(r.data.value, null);
        if (!Array.isArray(remote) || !remote.length) return;
        var local = getEntries();
        var byId = {};
        local.forEach(function (e) { byId[e.id] = e; });
        remote.forEach(function (e) {
          if (!e || !e.id) return;
          var existing = byId[e.id];
          if (!existing || (e.updatedAt || 0) > (existing.updatedAt || 0)) byId[e.id] = e;
        });
        var merged = Object.values(byId).sort(function (a, b) {
          return (b.date || '').localeCompare(a.date || '');
        });
        try { localStorage.setItem(JKEY, JSON.stringify(merged)); } catch (_) {}
        if (callback) callback();
      }).catch(function () {});
  }

  /* ── Helpers ──────────────────────────────────────────────────────── */
  var MOODS = [
    { emoji: '😊', label: 'Happy'      },
    { emoji: '🤩', label: 'Excited'    },
    { emoji: '🤔', label: 'Reflective' },
    { emoji: '😔', label: 'Sad'        },
    { emoji: '😰', label: 'Anxious'    },
    { emoji: '😤', label: 'Frustrated' },
  ];

  var DAY_ABBR  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function fmtDayLabel(dateStr) {
    try {
      var d = new Date(dateStr + 'T00:00:00');
      return DAY_ABBR[d.getDay()] + ', ' + d.getDate() + ' ' + MONTH_NAMES[d.getMonth()];
    } catch (_) { return dateStr; }
  }

  function fmtMonthLabel(dateStr) {
    try {
      var d = new Date(dateStr + 'T00:00:00');
      return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
    } catch (_) { return dateStr; }
  }

  function wordCount(text) {
    return (text || '').trim().split(/\s+/).filter(function (w) { return w.length > 0; }).length;
  }

  function calcStreak(entries) {
    var today = todayStr();
    var dates = {};
    entries.forEach(function (e) { if (e.date && e.content) dates[e.date] = true; });
    var streak = 0;
    var d = new Date(today + 'T00:00:00');
    if (!dates[today]) d.setDate(d.getDate() - 1);
    for (var i = 0; i < 365; i++) {
      var ds = d.toISOString().slice(0, 10);
      if (dates[ds]) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }

  function getWeekMoods(entries) {
    var today = todayStr();
    var byDate = {};
    entries.forEach(function (e) { byDate[e.date] = e.mood || ''; });
    var result = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(today + 'T00:00:00');
      d.setDate(d.getDate() - i);
      var ds = d.toISOString().slice(0, 10);
      result.push({ date: ds, day: DAY_ABBR[d.getDay()], mood: byDate[ds] || '', isToday: ds === today });
    }
    return result;
  }

  /* ── Import: parsers ──────────────────────────────────────────────── */
  var MONTH_MAP = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
  };

  function parseIsoDate(s) {
    if (!s) return null;
    s = s.trim().replace(/^#+\s*/, '').replace(/^\w+day,?\s+/i, '').replace(/[:\-–.]+$/, '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // "January 15, 2024" or "Jan 15, 2024" or "Jan 15 2024"
    var m1 = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (m1) {
      var mo = MONTH_MAP[m1[1].toLowerCase()];
      if (mo) return m1[3] + '-' + String(mo).padStart(2,'0') + '-' + String(m1[2]).padStart(2,'0');
    }
    // "15 January 2024" or "15 Jan 2024"
    var m2 = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
    if (m2) {
      var mo2 = MONTH_MAP[m2[2].toLowerCase()];
      if (mo2) return m2[3] + '-' + String(mo2).padStart(2,'0') + '-' + String(m2[1]).padStart(2,'0');
    }
    return null;
  }

  function parsePlainText(text) {
    var lines = text.replace(/\r\n/g, '\n').split('\n');
    var entries = [];
    var currentDate = null;
    var currentLines = [];

    function flush() {
      if (!currentDate) return;
      var content = currentLines.join('\n').replace(/^\s+|\s+$/g, '');
      if (content) entries.push({ date: currentDate, content: content });
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();
      // Skip pure separators
      if (/^[-*=─]{3,}$/.test(trimmed)) return;
      var date = parseIsoDate(trimmed);
      if (date) {
        flush();
        currentDate = date;
        currentLines = [];
      } else if (currentDate) {
        // Skip "Date:" prefix lines
        if (/^date:\s*/i.test(trimmed)) {
          var d2 = parseIsoDate(trimmed.replace(/^date:\s*/i, ''));
          if (d2) { flush(); currentDate = d2; currentLines = []; return; }
        }
        currentLines.push(line);
      }
    });
    flush();
    return entries;
  }

  function parseJsonEntries(text) {
    var parsed = JSON.parse(text);
    var raw = [];
    // Day One: {entries:[...]} or {metadata:{},entries:[...]}
    if (parsed && Array.isArray(parsed.entries)) {
      raw = parsed.entries.map(function (e) {
        var date = (e.creationDate || e.userLocalTime || e.date || '').slice(0, 10);
        return { date: date, content: (e.text || e.body || e.content || '').trim(), mood: '' };
      });
    // Array of entries
    } else if (Array.isArray(parsed)) {
      raw = parsed.map(function (e) {
        var date = e.date || (e.creationDate || e.created || e.time || '').slice(0, 10);
        return {
          date: date,
          content: (e.content || e.text || e.body || '').trim(),
          mood: e.mood || '',
          moodLabel: e.moodLabel || ''
        };
      });
    // Single entry
    } else if (parsed && (parsed.date || parsed.creationDate)) {
      raw = [{
        date: (parsed.date || (parsed.creationDate || '').slice(0, 10)),
        content: (parsed.content || parsed.text || '').trim(),
        mood: parsed.mood || ''
      }];
    }
    return raw.filter(function (e) {
      return e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.content;
    });
  }

  function splitCsvRow(line) {
    var cols = []; var field = ''; var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { field += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        cols.push(field); field = '';
      } else {
        field += c;
      }
    }
    cols.push(field);
    return cols;
  }

  function parseCsv(text) {
    var lines = text.replace(/\r\n/g, '\n').split('\n').filter(function (l) { return l.trim(); });
    if (lines.length < 2) return [];
    var headers = splitCsvRow(lines[0]).map(function (h) { return h.replace(/"/g, '').toLowerCase().trim(); });
    var dateCol = -1, contentCol = -1, moodCol = -1;
    headers.forEach(function (h, i) {
      if (dateCol < 0 && /date|created|day|time/.test(h)) dateCol = i;
      if (contentCol < 0 && /content|text|entry|body|journal|note/.test(h)) contentCol = i;
      if (moodCol < 0 && /mood|feeling|emotion/.test(h)) moodCol = i;
    });
    if (dateCol < 0 || contentCol < 0) return [];
    return lines.slice(1).map(function (line) {
      var cols = splitCsvRow(line);
      var rawDate = (cols[dateCol] || '').replace(/"/g, '').trim();
      var date = parseIsoDate(rawDate) || rawDate.slice(0, 10);
      var content = (cols[contentCol] || '').replace(/"/g, '').trim();
      var mood = moodCol >= 0 ? (cols[moodCol] || '').replace(/"/g, '').trim() : '';
      return { date: date, content: content, mood: mood };
    }).filter(function (e) { return e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.content; });
  }

  function autoDetect(text) {
    var trimmed = text.trim();
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
      try { return { format: 'json', entries: parseJsonEntries(trimmed) }; } catch (_) {}
    }
    var firstLine = trimmed.split('\n')[0].toLowerCase();
    if (/date|created|day/.test(firstLine) && /content|text|entry|body|note/.test(firstLine)) {
      var csvResult = parseCsv(trimmed);
      if (csvResult.length > 0) return { format: 'csv', entries: csvResult };
    }
    return { format: 'text', entries: parsePlainText(trimmed) };
  }

  /* Merge parsed entries into existing journal — adds new dates only, skips existing */
  function importEntries(parsed) {
    var existing = getEntries();
    var byDate = {};
    existing.forEach(function (e) { if (!e.deleted && e.date) byDate[e.date] = true; });
    var added = 0, skipped = 0;
    parsed.forEach(function (imp) {
      if (!imp.date || !imp.content) { skipped++; return; }
      var date = imp.date.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; return; }
      if (byDate[date]) { skipped++; return; } // already have an entry for this date
      var newEntry = {
        id: uid(),
        date: date,
        content: imp.content.trim(),
        mood: imp.mood || '',
        moodLabel: imp.moodLabel || '',
        aiReflection: '',
        wordCount: wordCount(imp.content),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        importedAt: Date.now()
      };
      existing.push(newEntry);
      byDate[date] = true;
      added++;
    });
    existing.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    saveEntries(existing);
    return { added: added, skipped: skipped };
  }

  /* ── Import overlay ───────────────────────────────────────────────── */
  var importParsed = [];
  var importFormat = 'auto';

  function buildImportOverlay() {
    var ov = document.createElement('div');
    ov.id = 'jn-import-overlay';
    ov.innerHTML = '<div id="jn-import-box">'
      + '<div class="jn-imp-bar">'
      + '<button class="jn-imp-close" id="jn-imp-close">&#8249;</button>'
      + '<div class="jn-imp-title">Import Journal</div>'
      + '</div>'
      + '<div class="jn-imp-body">'
      + '<div class="jn-imp-hint">Import entries from <strong>plain text / markdown</strong>, <strong>Day One JSON</strong>, <strong>generic JSON</strong>, or <strong>CSV</strong>. Existing dates are never overwritten.</div>'
      + '<div><div style="font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:rgba(204,0,255,.6);margin-bottom:6px">FORMAT</div>'
      + '<div class="jn-imp-format-row">'
      + '<button class="jn-imp-fmt-btn active" data-fmt="auto">Auto-detect</button>'
      + '<button class="jn-imp-fmt-btn" data-fmt="text">Plain text / MD</button>'
      + '<button class="jn-imp-fmt-btn" data-fmt="json">JSON / Day One</button>'
      + '<button class="jn-imp-fmt-btn" data-fmt="csv">CSV</button>'
      + '</div></div>'
      + '<div class="jn-imp-upload-row">'
      + '<label class="jn-imp-file-label" for="jn-imp-file">&#128193; Choose file</label>'
      + '<input type="file" id="jn-imp-file" accept=".txt,.md,.json,.csv,.markdown">'
      + '<span class="jn-imp-file-name" id="jn-imp-file-name">or paste text below</span>'
      + '</div>'
      + '<textarea id="jn-imp-text" placeholder="Paste your journal entries here...\n\nPlain text example:\n2024-01-15\nToday was a great day...\n\n2024-01-16\nFeeling reflective..."></textarea>'
      + '<button class="jn-imp-parse-btn" id="jn-imp-parse">Parse Entries</button>'
      + '<div id="jn-imp-feedback"></div>'
      + '<div id="jn-imp-preview">'
      + '<div class="jn-imp-preview-head" id="jn-imp-preview-count"></div>'
      + '<div class="jn-imp-preview-list" id="jn-imp-preview-list"></div>'
      + '<button class="jn-imp-confirm-btn" id="jn-imp-do-import">Import</button>'
      + '</div>'
      + '</div></div>';
    document.body.appendChild(ov);

    document.getElementById('jn-imp-close').addEventListener('click', closeImport);
    document.getElementById('jn-imp-parse').addEventListener('click', runParse);
    document.getElementById('jn-imp-do-import').addEventListener('click', runImport);

    // Format buttons
    ov.querySelectorAll('.jn-imp-fmt-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ov.querySelectorAll('.jn-imp-fmt-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        importFormat = btn.dataset.fmt;
      });
    });

    // File input
    document.getElementById('jn-imp-file').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      document.getElementById('jn-imp-file-name').textContent = file.name;
      var reader = new FileReader();
      reader.onload = function (e) {
        document.getElementById('jn-imp-text').value = e.target.result;
        document.getElementById('jn-imp-feedback').innerHTML = '';
        document.getElementById('jn-imp-preview').style.display = 'none';
      };
      reader.readAsText(file);
    });

    return ov;
  }

  function openImport() {
    var ov = document.getElementById('jn-import-overlay');
    if (!ov) ov = buildImportOverlay();
    // Reset state
    document.getElementById('jn-imp-text').value = '';
    document.getElementById('jn-imp-file-name').textContent = 'or paste text below';
    document.getElementById('jn-imp-feedback').innerHTML = '';
    document.getElementById('jn-imp-preview').style.display = 'none';
    importParsed = [];
    ov.classList.add('open');
  }

  function closeImport() {
    var ov = document.getElementById('jn-import-overlay');
    if (ov) ov.classList.remove('open');
  }

  function runParse() {
    var text = (document.getElementById('jn-imp-text') || {}).value || '';
    var fb = document.getElementById('jn-imp-feedback');
    var preview = document.getElementById('jn-imp-preview');
    if (!text.trim()) {
      fb.innerHTML = '<div class="jn-imp-err">Paste some text or choose a file first.</div>';
      preview.style.display = 'none';
      return;
    }
    fb.innerHTML = '';
    preview.style.display = 'none';
    var result;
    try {
      if (importFormat === 'text') result = { format: 'text', entries: parsePlainText(text) };
      else if (importFormat === 'json') result = { format: 'json', entries: parseJsonEntries(text) };
      else if (importFormat === 'csv') result = { format: 'csv', entries: parseCsv(text) };
      else result = autoDetect(text);
    } catch (e) {
      fb.innerHTML = '<div class="jn-imp-err">Could not parse: ' + esc(e.message || 'Unknown error') + '</div>';
      return;
    }
    importParsed = result.entries || [];
    if (!importParsed.length) {
      fb.innerHTML = '<div class="jn-imp-err">No entries found. Check the format or try a different format option.</div>';
      return;
    }

    // Show preview
    var previewList = document.getElementById('jn-imp-preview-list');
    var SHOW = Math.min(importParsed.length, 8);
    var listHtml = importParsed.slice(0, SHOW).map(function (e) {
      return '<div class="jn-imp-prev-item">'
        + '<div class="jn-imp-prev-date">' + esc(e.date) + (e.mood ? '  ' + esc(e.mood) : '') + '</div>'
        + '<div class="jn-imp-prev-text">' + esc((e.content || '').slice(0, 120)) + '</div>'
        + '</div>';
    }).join('');
    if (importParsed.length > SHOW) {
      listHtml += '<div class="jn-imp-prev-more">... and ' + (importParsed.length - SHOW) + ' more entries</div>';
    }
    previewList.innerHTML = listHtml;

    var existingDates = {};
    getActiveEntries().forEach(function (e) { if (e.date) existingDates[e.date] = true; });
    var newCount = importParsed.filter(function (e) { return e.date && !existingDates[e.date]; }).length;
    var skipCount = importParsed.length - newCount;
    var countHtml = 'Found <strong>' + importParsed.length + ' entries</strong>'
      + (importParsed.length !== newCount ? ' — <strong>' + newCount + ' new</strong>, ' + skipCount + ' already exist (will be skipped)' : '')
      + ' — detected as <strong>' + esc(result.format) + '</strong>';
    document.getElementById('jn-imp-preview-count').innerHTML = countHtml;
    document.getElementById('jn-imp-do-import').textContent = 'Import ' + newCount + ' new entr' + (newCount === 1 ? 'y' : 'ies');

    preview.style.display = '';
  }

  function runImport() {
    if (!importParsed.length) return;
    var result = importEntries(importParsed);
    var fb = document.getElementById('jn-imp-feedback');
    fb.innerHTML = '<div class="jn-imp-success">Done! Added <strong>' + result.added + '</strong> entries' + (result.skipped ? ', skipped ' + result.skipped + ' (already existed)' : '') + '.</div>';
    document.getElementById('jn-imp-preview').style.display = 'none';
    importParsed = [];
    try { window.dispatchEvent(new CustomEvent('homer-data-synced', { detail: { key: JKEY } })); } catch (_) {}
    setTimeout(function () {
      closeImport();
      renderTab();
    }, 1800);
  }

  /* ── Editor state ─────────────────────────────────────────────────── */
  var editorEntry  = null;
  var editorMood   = '';
  var editorMoodLabel = '';
  var editorReflection = null;
  var reflectLoading = false;

  /* ── Render tab ───────────────────────────────────────────────────── */
  function renderTab() {
    var tab = document.getElementById('tab-journal');
    if (!tab) return;
    var entries = getActiveEntries();
    var streak  = calcStreak(entries);
    var weekMoods = getWeekMoods(entries);
    var today   = todayStr();

    var moodStripHtml = weekMoods.map(function (m) {
      var circleClass = 'jn-mood-circle' + (m.mood ? ' has-entry' : '') + (m.isToday ? ' is-today' : '');
      var inner = m.mood
        ? m.mood
        : (m.isToday ? '<div class="jn-mood-dot"></div>' : '');
      return '<div class="jn-mood-day">'
        + '<div class="jn-mood-day-label' + (m.isToday ? ' today' : '') + '">' + esc(m.day) + '</div>'
        + '<div class="' + circleClass + '">' + inner + '</div>'
        + '</div>';
    }).join('');

    var grouped = {};
    var groupOrder = [];
    entries.forEach(function (e) {
      var mo = (e.date || '').slice(0, 7);
      if (!grouped[mo]) { grouped[mo] = []; groupOrder.push(mo); }
      grouped[mo].push(e);
    });

    var listHtml = '';
    if (!entries.length) {
      listHtml = '<div class="jn-empty"><div class="jn-empty-icon">📔</div><div class="jn-empty-title">No entries yet</div><div class="jn-empty-sub">Start with today\'s prompt or import past entries</div></div>';
    } else {
      groupOrder.forEach(function (mo) {
        listHtml += '<div class="jn-month-label">' + esc(fmtMonthLabel(mo + '-01').toUpperCase()) + '</div>';
        grouped[mo].forEach(function (e) {
          var reflObj = e.aiReflection ? safeJson(e.aiReflection, null) : null;
          listHtml += '<div class="jn-entry-card" data-id="' + esc(e.id) + '">'
            + '<div class="jn-entry-stripe"></div>'
            + '<div class="jn-entry-body">'
            + '<div class="jn-entry-top">'
            + (e.mood ? '<div class="jn-entry-mood">' + e.mood + '</div>' : '')
            + '<div class="jn-entry-meta">'
            + '<div class="jn-entry-date">' + esc(fmtDayLabel(e.date)) + '</div>'
            + (e.moodLabel ? '<div class="jn-entry-mood-label">' + esc(e.moodLabel) + '</div>' : '')
            + '</div>'
            + '<div class="jn-entry-wc">' + (e.wordCount || 0) + 'w</div>'
            + '</div>'
            + (e.content ? '<div class="jn-entry-preview">' + esc((e.content || '').slice(0, 140)) + '</div>' : '')
            + (reflObj ? '<div class="jn-entry-ai-badge">✨ AI reflection saved</div>' : '')
            + '</div>'
            + '<button class="jn-list-del" data-id="' + esc(e.id) + '" title="Delete entry">&#x2715;</button>'
            + '</div>';
        });
      });
    }

    tab.innerHTML = '<div class="jn-header">'
      + '<div class="jn-header-title">'
      + '<div class="jn-title-main">JOURNAL</div>'
      + '<div class="jn-title-sub">AI-POWERED</div>'
      + '<div class="jn-title-bar"></div>'
      + '</div>'
      + '<div class="jn-header-btns">'
      + '<button class="jn-import-btn" id="jn-import-btn">&#8645; Import</button>'
      + '<button class="jn-new-btn" id="jn-new-btn">'
      + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
      + (entries.some(function (e) { return e.date === today; }) ? 'TODAY' : 'NEW')
      + '</button>'
      + '</div>'
      + '</div>'

      + '<div class="jn-stats-card">'
      + '<div class="jn-stats-row">'
      + '<div class="jn-streak-block"><div class="jn-streak-label">Writing Streak</div><div><span class="jn-streak-num">🔥 ' + streak + '</span><span class="jn-streak-unit">' + (streak === 1 ? 'day' : 'days') + '</span></div></div>'
      + '<div class="jn-total-block"><div class="jn-total-num">' + entries.length + '</div><div class="jn-total-label">total entries</div></div>'
      + '</div>'
      + (weekMoods.length ? '<div class="jn-divider"></div><div class="jn-mood-strip">' + moodStripHtml + '</div>' : '')
      + '</div>'

      + '<div class="jn-prompt-card" id="jn-prompt-card">'
      + '<div class="jn-prompt-head">'
      + '<span>✨</span><span class="jn-prompt-badge">TODAY\'S PROMPT</span>'
      + '<button class="jn-prompt-refresh" id="jn-prompt-refresh" title="Refresh prompt">↺</button>'
      + '</div>'
      + '<div class="jn-prompt-divider"></div>'
      + '<div id="jn-prompt-body"><div class="jn-prompt-loading">Loading prompt…</div></div>'
      + '</div>'

      + listHtml;

    document.getElementById('jn-new-btn').addEventListener('click', function () { openEditor(null); });
    document.getElementById('jn-import-btn').addEventListener('click', openImport);
    document.getElementById('jn-prompt-refresh').addEventListener('click', loadPrompt);
    tab.querySelectorAll('.jn-list-del').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var id = btn.dataset.id;
        var entry = getEntries().find(function (e) { return e.id === id; });
        if (!entry) return;
        var conf = document.createElement('div');
        conf.className = 'jn-confirm-overlay';
        conf.innerHTML = '<div class="jn-confirm-box">'
          + '<div class="jn-confirm-msg">Delete this entry?<br><small style="opacity:.6">' + esc(fmtDayLabel(entry.date)) + '</small></div>'
          + '<div class="jn-confirm-btns">'
          + '<button class="jn-confirm-cancel">Cancel</button>'
          + '<button class="jn-confirm-delete">Delete</button>'
          + '</div></div>';
        document.body.appendChild(conf);
        conf.querySelector('.jn-confirm-cancel').addEventListener('click', function () { conf.remove(); });
        conf.querySelector('.jn-confirm-delete').addEventListener('click', function () {
          conf.remove();
          var all = getEntries();
          var idx = all.findIndex(function (e) { return e.id === id; });
          if (idx >= 0) all[idx] = Object.assign({}, all[idx], { deleted: true, updatedAt: Date.now() });
          saveEntries(all);
          renderTab();
        });
      });
    });
    tab.querySelectorAll('.jn-entry-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.dataset.id;
        var entry = getActiveEntries().find(function (e) { return e.id === id; });
        if (entry) openEditor(entry);
      });
    });

    loadPrompt();
  }

  /* ── Prompt loading ──────────────────────────────────────────────── */
  var promptLoading = false;
  function loadPrompt() {
    if (promptLoading) return;
    promptLoading = true;
    var body = document.getElementById('jn-prompt-body');
    if (body) body.innerHTML = '<div class="jn-prompt-loading">Generating prompt…</div>';
    fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prompt' }),
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      promptLoading = false;
      var b = document.getElementById('jn-prompt-body');
      if (!b) return;
      var prompt = (d && d.prompt) ? d.prompt : 'What made today meaningful?';
      b.innerHTML = '<div class="jn-prompt-text">&ldquo;' + esc(prompt) + '&rdquo;</div>'
        + '<button class="jn-prompt-write" id="jn-prompt-write">Write Now &rarr;</button>';
      document.getElementById('jn-prompt-write').addEventListener('click', function () { openEditor(null); });
    })
    .catch(function () {
      promptLoading = false;
      var b = document.getElementById('jn-prompt-body');
      if (b) b.innerHTML = '<div class="jn-prompt-text">&ldquo;What made today meaningful?&rdquo;</div>'
        + '<button class="jn-prompt-write" id="jn-prompt-write">Write Now &rarr;</button>';
      var pw = document.getElementById('jn-prompt-write');
      if (pw) pw.addEventListener('click', function () { openEditor(null); });
    });
  }

  /* ── Editor ───────────────────────────────────────────────────────── */
  function getOrCreateOverlay() {
    var ov = document.getElementById('jn-editor-overlay');
    if (ov) return ov;

    ov = document.createElement('div');
    ov.id = 'jn-editor-overlay';
    ov.innerHTML = '<div id="jn-editor-box">'
      + '<div class="jn-ed-bar">'
      + '<button class="jn-ed-back" id="jn-ed-back">&#8249;</button>'
      + '<div class="jn-ed-date-block">'
      + '<input type="date" id="jn-ed-date-input" class="jn-ed-date-input" title="Change entry date">'
      + '<div class="jn-ed-hint" id="jn-ed-date-hint" style="font-size:.62rem;color:rgba(204,0,255,.45);margin-top:1px"></div>'
      + '<div class="jn-ed-wc" id="jn-ed-wc-label"></div>'
      + '</div>'
      + '<button class="jn-ed-del-btn" id="jn-ed-del-btn" style="display:none" title="Delete">&#128465;</button>'
      + '<button class="jn-ed-save-btn" id="jn-ed-save-btn">SAVE</button>'
      + '</div>'
      + '<div class="jn-ed-body">'
      + '<div><div class="jn-mood-section-label">HOW ARE YOU FEELING?</div><div class="jn-mood-row" id="jn-mood-row"></div></div>'
      + '<textarea id="jn-ed-content" placeholder="What\'s on your mind?\n\nWrite freely — this is your private space…"></textarea>'
      + '<button class="jn-reflect-btn" id="jn-reflect-btn">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
      + '<span id="jn-reflect-label">Get AI Reflection</span>'
      + '</button>'
      + '<div id="jn-reflection-wrap" style="display:none"></div>'
      + '<div style="height:60px"></div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(ov);

    document.getElementById('jn-ed-back').addEventListener('click', closeEditor);
    document.getElementById('jn-ed-save-btn').addEventListener('click', saveEntry);
    document.getElementById('jn-ed-del-btn').addEventListener('click', confirmDelete);
    document.getElementById('jn-ed-content').addEventListener('input', updateWordCount);
    document.getElementById('jn-reflect-btn').addEventListener('click', getReflection);
    document.getElementById('jn-ed-date-input').addEventListener('change', onEditorDateChange);

    // Build mood buttons
    var moodRow = document.getElementById('jn-mood-row');
    MOODS.forEach(function (m) {
      var btn = document.createElement('div');
      btn.className = 'jn-mood-btn';
      btn.dataset.emoji = m.emoji;
      btn.dataset.label = m.label;
      btn.innerHTML = '<div class="jn-mood-btn-circle">' + m.emoji + '</div><div class="jn-mood-btn-label">' + esc(m.label) + '</div>';
      btn.addEventListener('click', function () {
        editorMood      = m.emoji;
        editorMoodLabel = m.label;
        renderMoodSelection();
      });
      moodRow.appendChild(btn);
    });

    return ov;
  }

  function renderMoodSelection() {
    document.querySelectorAll('.jn-mood-btn').forEach(function (btn) {
      btn.classList.toggle('selected', btn.dataset.emoji === editorMood);
    });
  }

  function updateWordCount() {
    var content = (document.getElementById('jn-ed-content') || {}).value || '';
    var wc = wordCount(content);
    var el = document.getElementById('jn-ed-wc-label');
    if (el) el.textContent = wc > 0 ? wc + ' words' : '';
    var btn = document.getElementById('jn-reflect-btn');
    if (btn) {
      var enough = content.trim().length >= 20;
      btn.disabled = !enough || reflectLoading;
      var lbl = document.getElementById('jn-reflect-label');
      if (lbl) lbl.textContent = (editorReflection ? 'Refresh AI Reflection' : 'Get AI Reflection') + (enough ? '' : ' (write more first)');
    }
  }

  /* Called when user picks a different date in the editor */
  function onEditorDateChange() {
    var input = document.getElementById('jn-ed-date-input');
    var newDate = input ? input.value : '';
    if (!newDate || !editorEntry) return;

    var existing = getEntries().find(function (e) { return e.date === newDate && !e.deleted && e.id !== editorEntry.id; });
    var hint = document.getElementById('jn-ed-date-hint');
    if (existing) {
      // Load the existing entry for the new date
      editorEntry     = existing;
      editorMood      = existing.mood || '';
      editorMoodLabel = existing.moodLabel || '';
      editorReflection = existing.aiReflection ? safeJson(existing.aiReflection, null) : null;
      document.getElementById('jn-ed-content').value = existing.content || '';
      var delBtn = document.getElementById('jn-ed-del-btn');
      if (delBtn) delBtn.style.display = existing.content ? '' : 'none';
      if (hint) hint.textContent = 'Editing existing entry';
    } else {
      // New blank entry for the chosen date
      editorEntry     = { id: uid(), date: newDate, content: '', mood: '', moodLabel: '', aiReflection: '', wordCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
      editorMood      = '';
      editorMoodLabel = '';
      editorReflection = null;
      document.getElementById('jn-ed-content').value = '';
      var delBtn2 = document.getElementById('jn-ed-del-btn');
      if (delBtn2) delBtn2.style.display = 'none';
      if (hint) hint.textContent = newDate === todayStr() ? '' : 'Adding past entry';
    }
    renderMoodSelection();
    updateWordCount();
    renderReflectionCard();
  }

  function openEditor(entry) {
    var ov = getOrCreateOverlay();
    var today = todayStr();

    if (entry) {
      editorEntry     = entry;
      editorMood      = entry.mood || '';
      editorMoodLabel = entry.moodLabel || '';
      editorReflection = entry.aiReflection ? safeJson(entry.aiReflection, null) : null;
    } else {
      var existing = getEntries().find(function (e) { return e.date === today && !e.deleted; });
      if (existing) {
        editorEntry     = existing;
        editorMood      = existing.mood || '';
        editorMoodLabel = existing.moodLabel || '';
        editorReflection = existing.aiReflection ? safeJson(existing.aiReflection, null) : null;
      } else {
        editorEntry     = { id: uid(), date: today, content: '', mood: '', moodLabel: '', aiReflection: '', wordCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
        editorMood      = '';
        editorMoodLabel = '';
        editorReflection = null;
      }
    }
    reflectLoading = false;

    // Populate date input
    var dateInput = document.getElementById('jn-ed-date-input');
    if (dateInput) {
      dateInput.value = editorEntry.date || today;
      dateInput.max = today; // Can't write future entries
    }
    var hint = document.getElementById('jn-ed-date-hint');
    if (hint) hint.textContent = (editorEntry.date && editorEntry.date !== today) ? 'Editing past entry' : '';

    var content = document.getElementById('jn-ed-content');
    content.value = editorEntry.content || '';

    var delBtn = document.getElementById('jn-ed-del-btn');
    if (delBtn) delBtn.style.display = (editorEntry.content && editorEntry.content.trim()) ? '' : 'none';

    renderMoodSelection();
    updateWordCount();
    renderReflectionCard();
    ov.classList.add('open');
    setTimeout(function () { content.focus(); }, 100);
  }

  function closeEditor() {
    var ov = document.getElementById('jn-editor-overlay');
    if (ov) ov.classList.remove('open');
    editorEntry = null;
    renderTab();
  }

  function saveEntry() {
    if (!editorEntry) return;
    var dateInput = document.getElementById('jn-ed-date-input');
    var selectedDate = (dateInput && dateInput.value) ? dateInput.value : editorEntry.date;
    if (!selectedDate) return;

    var content = (document.getElementById('jn-ed-content') || {}).value || '';
    var wc = wordCount(content);
    var updated = Object.assign({}, editorEntry, {
      date:         selectedDate,
      content:      content.trim(),
      mood:         editorMood,
      moodLabel:    editorMoodLabel,
      aiReflection: editorReflection ? JSON.stringify(editorReflection) : (editorEntry.aiReflection || ''),
      wordCount:    wc,
      updatedAt:    Date.now(),
    });
    var entries = getEntries();
    var idx = entries.findIndex(function (e) { return e.id === updated.id; });
    if (idx >= 0) entries[idx] = updated;
    else entries.unshift(updated);
    entries.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    saveEntries(entries);
    closeEditor();
  }

  function confirmDelete() {
    var conf = document.createElement('div');
    conf.className = 'jn-confirm-overlay';
    conf.innerHTML = '<div class="jn-confirm-box">'
      + '<div class="jn-confirm-title">Delete this entry?</div>'
      + '<div class="jn-confirm-text">This journal entry will be permanently deleted. Your words cannot be recovered.</div>'
      + '<div class="jn-confirm-btns">'
      + '<button class="jn-confirm-cancel">CANCEL</button>'
      + '<button class="jn-confirm-delete">DELETE</button>'
      + '</div></div>';
    document.body.appendChild(conf);
    conf.querySelector('.jn-confirm-cancel').addEventListener('click', function () { conf.remove(); });
    conf.querySelector('.jn-confirm-delete').addEventListener('click', function () {
      conf.remove();
      if (!editorEntry) return;
      var all = getEntries();
      var idx = all.findIndex(function (e) { return e.id === editorEntry.id; });
      if (idx >= 0) all[idx] = Object.assign({}, all[idx], { deleted: true, updatedAt: Date.now() });
      saveEntries(all);
      closeEditor();
    });
  }

  /* ── AI Reflection ─────────────────────────────────────────────────── */
  function renderReflectionCard() {
    var wrap = document.getElementById('jn-reflection-wrap');
    if (!wrap) return;
    if (!editorReflection) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    var r = editorReflection;
    var moodEmoji = '';
    if (r.mood) {
      var moodObj = MOODS.find(function (m) { return m.label === r.mood; });
      if (moodObj) moodEmoji = moodObj.emoji + '  ';
    }
    wrap.style.display = '';
    wrap.innerHTML = '<div class="jn-reflection-card">'
      + '<div class="jn-ref-head"><span>✨</span><span class="jn-ref-badge">AI REFLECTION</span>'
      + (r.mood ? '<span class="jn-ref-mood-pill">' + esc(moodEmoji + r.mood) + '</span>' : '')
      + '</div>'
      + '<div class="jn-ref-divider"></div>'
      + (r.themes ? '<div class="jn-ref-themes"><span class="jn-ref-themes-label">THEMES</span>'
        + r.themes.split(',').map(function (t) { return '<span class="jn-ref-theme-chip">' + esc(t.trim()) + '</span>'; }).join('')
        + '</div>' : '')
      + (r.insight ? '<div class="jn-ref-insight"><div class="jn-ref-insight-label">INSIGHT</div><div class="jn-ref-insight-text">' + esc(r.insight) + '</div></div>' : '')
      + (r.affirmation ? '<div class="jn-ref-affirmation"><div class="jn-ref-aff-icon">✦</div><div class="jn-ref-aff-text">' + esc(r.affirmation) + '</div></div>' : '')
      + '</div>';
  }

  function getReflection() {
    var content = (document.getElementById('jn-ed-content') || {}).value || '';
    if (content.trim().length < 20 || reflectLoading) return;
    reflectLoading = true;
    var btn = document.getElementById('jn-reflect-btn');
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
      btn.innerHTML = '<div class="jn-spinner"></div><span>Analyzing your entry…</span>';
    }
    fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reflect', entry: content }),
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      reflectLoading = false;
      if (d && d.reflection) {
        editorReflection = d.reflection;
        if (!editorMood && d.reflection.mood) {
          var moodObj = MOODS.find(function (m) { return m.label === d.reflection.mood; });
          if (moodObj) { editorMood = moodObj.emoji; editorMoodLabel = moodObj.label; renderMoodSelection(); }
        }
      } else {
        editorReflection = { insight: 'Unable to generate reflection right now.', affirmation: 'Keep writing — every word matters.', mood: '', themes: '' };
      }
      renderReflectionCard();
      var b2 = document.getElementById('jn-reflect-btn');
      if (b2) {
        b2.classList.remove('loading');
        b2.disabled = false;
        b2.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span id="jn-reflect-label">Refresh AI Reflection</span>';
      }
    })
    .catch(function () {
      reflectLoading = false;
      editorReflection = { insight: 'Unable to generate reflection right now.', affirmation: 'Keep writing — every word matters.', mood: '', themes: '' };
      renderReflectionCard();
      var b2 = document.getElementById('jn-reflect-btn');
      if (b2) { b2.classList.remove('loading'); b2.disabled = false; b2.innerHTML = '<span>Get AI Reflection</span>'; }
    });
  }

  /* ── Joey JOURNAL action handler ──────────────────────────────────── */
  /* The app-shell executeActions() picks up [ACTION:JOURNAL]{...}[/ACTION] and
     dispatches 'homer-journal-action' with the parsed data. */
  window.addEventListener('homer-journal-action', function (ev) {
    var d = ev && ev.detail;
    if (!d) return;
    var date    = String(d.date || todayStr()).slice(0, 10);
    var content = String(d.content || '').trim();
    if (!content) return;
    var MOOD_BY_LABEL = {};
    MOODS.forEach(function (m) { MOOD_BY_LABEL[m.label.toLowerCase()] = m; });
    var moodObj = MOOD_BY_LABEL[(d.moodLabel || '').toLowerCase()];
    var entries = getEntries();
    var idx = entries.findIndex(function (e) { return e.date === date && !e.deleted; });
    if (idx >= 0) {
      // Append to existing entry
      var ex = entries[idx];
      var merged = (ex.content ? ex.content + '\n\n' : '') + content;
      entries[idx] = Object.assign({}, ex, {
        content: merged,
        mood: moodObj ? moodObj.emoji : ex.mood,
        moodLabel: moodObj ? moodObj.label : ex.moodLabel,
        wordCount: wordCount(merged),
        updatedAt: Date.now()
      });
    } else {
      entries.unshift({
        id: uid(), date: date, content: content,
        mood: moodObj ? moodObj.emoji : (d.mood || ''),
        moodLabel: moodObj ? moodObj.label : '',
        aiReflection: '', wordCount: wordCount(content),
        createdAt: Date.now(), updatedAt: Date.now()
      });
    }
    entries.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    saveEntries(entries);
    var tab = document.getElementById('tab-journal');
    if (tab && tab.style.display !== 'none') renderTab();
  });

  /* ── Tab registration ─────────────────────────────────────────────── */
  var MY_TAB = 'journal';

  function patchTabSystem() {
    var orig = window._homerShowTab;
    if (!orig || orig._hjJournal) return;
    function patched(name) {
      var jt = document.getElementById('tab-journal');
      if (jt) jt.style.display = 'none';
      orig(name);
      if (name === MY_TAB) {
        if (jt) {
          jt.style.display = 'block';
          renderTab();
        }
        document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === MY_TAB); });
        var shown = jt;
        if (shown) { shown.classList.remove('tab-anim','tab-anim-right','tab-anim-left'); void shown.offsetWidth; shown.classList.add('tab-anim'); }
      }
    }
    patched._hjJournal = true;
    window._homerShowTab = patched;

    if (!window._hjTabHideBound) {
      window._hjTabHideBound = true;
      window.addEventListener('homer-tab-change', function (e) {
        var name = e && e.detail && e.detail.tab;
        if (!name || name === MY_TAB) return;
        var jt = document.getElementById('tab-journal');
        if (jt && jt.style.display !== 'none') jt.style.display = 'none';
      });
    }

    document.querySelectorAll('[data-tab="' + MY_TAB + '"]').forEach(function (btn) {
      if (!btn._hjWired) { btn._hjWired = true; btn.addEventListener('click', function () { patched(MY_TAB); }); }
    });
  }

  function addTabSection() {
    if (document.getElementById('tab-journal')) return;
    var shell = document.querySelector('.shell');
    if (!shell) return;
    var s = document.createElement('section');
    s.id = 'tab-journal'; s.className = 'tab card'; s.style.display = 'none';
    shell.appendChild(s);
  }

  function addNavButtons() {
    var sidebar   = document.getElementById('desktop-sidebar');
    var spacer    = sidebar && sidebar.querySelector('.sb-spacer');
    if (sidebar && spacer && !sidebar.querySelector('[data-tab="journal"]')) {
      var sb = document.createElement('button');
      sb.className = 'sb-item'; sb.dataset.tab = 'journal';
      sb.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg><span class="sb-label">Journal</span>';
      sidebar.insertBefore(sb, spacer);
    }

    var tabsBar = document.querySelector('.tabs');
    if (tabsBar && !tabsBar.querySelector('[data-tab="journal"]')) {
      var tb = document.createElement('button');
      tb.className = 'tab-btn'; tb.dataset.tab = 'journal'; tb.textContent = '📔 Journal';
      tabsBar.appendChild(tb);
    }

    var msheet = document.querySelector('.msheet-grid');
    if (msheet && !msheet.querySelector('[data-tab="journal"]')) {
      var ms = document.createElement('div');
      ms.className = 'msheet-item'; ms.dataset.tab = 'journal';
      ms.innerHTML = '<div class="msheet-icon">📔</div><span>Journal</span>';
      var sep = msheet.querySelector('.msheet-sep-row');
      if (sep) msheet.insertBefore(ms, sep); else msheet.appendChild(ms);
    }
  }

  /* ── Init ──────────────────────────────────────────────────────────── */
  ready(function () {
    addTabSection();
    addNavButtons();

    function tryPatch() {
      if (typeof window._homerShowTab === 'function') {
        patchTabSystem();
      } else {
        setTimeout(tryPatch, 200);
      }
    }
    tryPatch();

    window.addEventListener('supabase:session', function (e) {
      if (e.detail && isBogdan()) {
        pullFromSupabase(function () {
          var tab = document.getElementById('tab-journal');
          if (tab && tab.style.display !== 'none') renderTab();
        });
      }
    });
    if (isBogdan()) {
      setTimeout(function () {
        pullFromSupabase(function () {
          var tab = document.getElementById('tab-journal');
          if (tab && tab.style.display !== 'none') renderTab();
        });
      }, 2000);
    }
    window.addEventListener('homer-data-synced', function (e) {
      if (e && e.detail && e.detail.key === 'homer-journal') {
        var tab = document.getElementById('tab-journal');
        if (tab && tab.style.display !== 'none') renderTab();
      }
    });
  });

})();
