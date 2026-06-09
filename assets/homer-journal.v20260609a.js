/* ====================================================================
 * Homer Journal  v20260609a
 * Changes from v20260608a:
 *  - Complete Notion-style UI redesign (light theme, clean typography)
 *  - Database list view: page rows with icon + title + properties
 *  - Document-style editor with properties panel
 *  - All data / sync / import / AI logic preserved unchanged
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
    /* ── Tab container ───────────────────────────────────────────────*/
    #tab-journal {
      padding: 0 !important;
      background: transparent !important;
      border-radius: 12px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif;
      color: #37352f;
    }
    .jn-page { min-height: 400px; }

    /* ── Database header ─────────────────────────────────────────────*/
    .jn-db-header { display:flex; align-items:flex-start; gap:12px; padding:22px 20px 14px; }
    .jn-db-icon-wrap { font-size:2rem; line-height:1; flex-shrink:0; padding-top:2px; }
    .jn-db-title-col { flex:1; min-width:0; }
    .jn-db-title { font-size:1.35rem; font-weight:700; color:#37352f; margin:0 0 3px; letter-spacing:-.01em; line-height:1.2; }
    .jn-db-meta { font-size:.75rem; color:rgba(55,53,47,.45); display:flex; align-items:center; gap:6px; }
    .jn-db-meta-dot { color:rgba(55,53,47,.10); }
    .jn-db-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; padding-top:2px; }

    /* ── Buttons ─────────────────────────────────────────────────────*/
    .jn-btn-ghost { padding:5px 10px; border-radius:8px; border:1px solid rgba(46,170,220,.3); background:rgba(46,170,220,.07); color:rgba(46,170,220,.75); font-size:.75rem; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:4px; line-height:1.4; }
    .jn-btn-ghost:hover { background:rgba(46,170,220,.14); color:#2eaadc; }
    .jn-btn-primary { padding:5px 14px; border-radius:8px; border:none; background:linear-gradient(135deg,#2eaadc,#9065b0); color:#fff; font-size:.75rem; font-weight:700; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:5px; line-height:1.4; letter-spacing:.04em; }
    .jn-btn-primary:hover { filter:brightness(1.12); }

    /* ── Dividers ────────────────────────────────────────────────────*/
    .jn-section-div { height:1px; background:rgba(55,53,47,.05); }

    /* ── Week mood strip ─────────────────────────────────────────────*/
    .jn-week-row { display:flex; padding:10px 16px; gap:2px; }
    .jn-week-day { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; border-radius:6px; padding:5px 3px; cursor:pointer; transition:background .1s; }
    .jn-week-day:hover { background:rgba(55,53,47,.02); }
    .jn-week-lbl { font-size:.58rem; color:rgba(55,53,47,.35); text-transform:uppercase; letter-spacing:.05em; font-weight:600; }
    .jn-week-lbl.today { color:#2eaadc; }
    .jn-week-dot { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.82rem; }
    .jn-week-dot.has-entry { background:rgba(46,170,220,.18); }
    .jn-week-dot.is-today { outline:2px solid rgba(46,170,220,.5); outline-offset:1px; }
    .jn-week-dot.is-today.has-entry { background:rgba(46,170,220,.15); outline-color:#2eaadc; }
    .jn-week-empty { width:7px; height:7px; border-radius:50%; background:rgba(55,53,47,.08); }

    /* ── Prompt callout ──────────────────────────────────────────────*/
    .jn-callout { margin:10px 16px; border-radius:8px; background:rgba(46,170,220,.07); border-left:3px solid rgba(46,170,220,.6); padding:11px 14px; display:flex; align-items:flex-start; gap:10px; }
    .jn-callout-icon { font-size:1rem; flex-shrink:0; margin-top:2px; }
    .jn-callout-content { flex:1; min-width:0; }
    .jn-callout-lbl { font-size:.6rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:rgba(46,170,220,.7); margin-bottom:3px; }
    .jn-callout-text { font-size:.85rem; color:rgba(55,53,47,.85); line-height:1.5; margin-bottom:8px; font-style:italic; }
    .jn-callout-btn { padding:4px 10px; border-radius:8px; border:none; background:linear-gradient(135deg,#2eaadc,#9065b0); color:#fff; font-size:.72rem; font-weight:700; cursor:pointer; font-family:inherit; letter-spacing:.04em; }
    .jn-callout-btn:hover { filter:brightness(1.12); }
    .jn-callout-refresh { background:none; border:none; color:rgba(46,170,220,.45); font-size:1rem; cursor:pointer; padding:2px 6px; border-radius:4px; flex-shrink:0; align-self:flex-start; line-height:1; }
    .jn-callout-refresh:hover { background:rgba(46,170,220,.1); color:#2eaadc; }
    .jn-callout-loading { font-size:.8rem; color:rgba(55,53,47,.35); font-style:italic; }

    /* ── Database list ───────────────────────────────────────────────*/
    .jn-db-list { padding:6px 0 16px; }
    .jn-group-hd { display:flex; align-items:center; gap:5px; padding:12px 20px 3px; }
    .jn-group-hd svg { color:rgba(46,170,220,.4); flex-shrink:0; }
    .jn-group-hd-text { font-size:.68rem; font-weight:700; color:rgba(46,170,220,.65); text-transform:uppercase; letter-spacing:.1em; }
    .jn-group-count { font-size:.65rem; color:rgba(55,53,47,.3); background:rgba(55,53,47,.03); border-radius:3px; padding:1px 5px; }

    .jn-row { display:flex; align-items:center; gap:8px; padding:3px 14px 3px 16px; cursor:pointer; transition:background .08s; position:relative; min-height:38px; }
    .jn-row:hover { background:rgba(55,53,47,.02); }
    .jn-row-icon { width:22px; text-align:center; font-size:.95rem; flex-shrink:0; line-height:1; }
    .jn-row-main { flex:1; min-width:0; padding:2px 0; }
    .jn-row-title { font-size:.875rem; font-weight:500; color:#37352f; line-height:1.35; display:flex; align-items:center; gap:5px; }
    .jn-row-today-badge { font-size:.58rem; color:#2eaadc; background:rgba(46,170,220,.12); border-radius:3px; padding:1px 5px; font-weight:700; flex-shrink:0; }
    .jn-row-excerpt { font-size:.75rem; color:rgba(55,53,47,.38); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.3; margin-top:1px; }
    .jn-row-props { display:flex; align-items:center; gap:4px; flex-shrink:0; }
    .jn-tag { font-size:.65rem; color:rgba(55,53,47,.4); background:rgba(55,53,47,.04); border-radius:3px; padding:2px 6px; white-space:nowrap; }
    .jn-tag.ai { background:rgba(46,170,220,.1); color:rgba(46,170,220,.85); }
    .jn-row-del { background:none; border:none; color:rgba(55,53,47,.18); cursor:pointer; font-size:.8rem; padding:3px 6px; border-radius:4px; opacity:0; transition:opacity .1s,color .1s,background .1s; line-height:1; flex-shrink:0; }
    .jn-row:hover .jn-row-del { opacity:1; }
    .jn-row-del:hover { color:#9065b0; background:rgba(144,101,176,.12); }

    .jn-new-row { display:flex; align-items:center; gap:8px; padding:4px 14px 4px 16px; color:rgba(55,53,47,.25); font-size:.8rem; cursor:pointer; transition:background .08s; min-height:32px; margin-top:2px; }
    .jn-new-row:hover { background:rgba(55,53,47,.02); color:rgba(46,170,220,.6); }
    .jn-new-row-icon { width:22px; text-align:center; font-size:.85rem; }

    /* ── Empty state ─────────────────────────────────────────────────*/
    .jn-empty { padding:48px 20px; text-align:center; }
    .jn-empty-icon { font-size:2.2rem; margin-bottom:10px; }
    .jn-empty-title { font-size:.85rem; font-weight:600; color:rgba(55,53,47,.38); margin-bottom:5px; }
    .jn-empty-sub { font-size:.75rem; color:rgba(55,53,47,.25); }

    /* ── Editor overlay ──────────────────────────────────────────────*/
    #jn-editor-overlay {
      position:fixed; inset:0; z-index:11000; background:linear-gradient(160deg,#f7f6f3,#ffffff);
      display:none; flex-direction:column; overflow-y:auto;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif;
      color:#37352f;
    }
    #jn-editor-overlay.open { display:flex; }
    #jn-editor-page { display:flex; flex-direction:column; width:100%; max-width:720px; margin:0 auto; min-height:100%; }

    /* Top bar */
    .jn-ed-topbar { display:flex; align-items:center; gap:6px; padding:8px 16px; border-bottom:1px solid rgba(55,53,47,.05); position:sticky; top:0; background:rgba(247,246,243,.96); backdrop-filter:blur(8px); z-index:10; }
    .jn-ed-back { background:none; border:none; color:rgba(55,53,47,.45); font-size:.78rem; cursor:pointer; padding:5px 8px; border-radius:4px; font-family:inherit; display:flex; align-items:center; gap:4px; }
    .jn-ed-back:hover { background:rgba(55,53,47,.04); color:#37352f; }
    .jn-ed-breadcrumb { font-size:.75rem; color:rgba(55,53,47,.3); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .jn-ed-topbar-right { display:flex; align-items:center; gap:6px; flex-shrink:0; }
    .jn-ed-wc-badge { font-size:.7rem; color:rgba(55,53,47,.3); }
    .jn-ed-del-btn { background:none; border:none; color:rgba(55,53,47,.28); cursor:pointer; font-size:.9rem; padding:5px 7px; border-radius:4px; line-height:1; }
    .jn-ed-del-btn:hover { color:#9065b0; background:rgba(144,101,176,.1); }
    .jn-ed-save-btn { padding:5px 14px; border-radius:8px; border:none; background:linear-gradient(135deg,#2eaadc,#9065b0); color:#fff; font-size:.75rem; font-weight:700; cursor:pointer; font-family:inherit; letter-spacing:.04em; }
    .jn-ed-save-btn:hover { filter:brightness(1.12); }

    /* Page body */
    .jn-ed-body { flex:1; padding:28px 28px 80px; }

    /* Title / date area */
    .jn-ed-title-area { margin-bottom:18px; }
    .jn-ed-date-display { font-size:1.75rem; font-weight:700; color:#37352f; line-height:1.2; letter-spacing:-.02em; cursor:pointer; padding:2px 4px; border-radius:4px; display:inline-block; }
    .jn-ed-date-display:hover { background:rgba(55,53,47,.03); }
    #jn-ed-date-input { position:absolute; opacity:0; pointer-events:none; width:0; height:0; }
    .jn-ed-date-hint { font-size:.68rem; color:rgba(55,53,47,.3); margin-top:3px; }

    /* Properties panel */
    .jn-ed-props { border-bottom:1px solid rgba(55,53,47,.05); padding-bottom:14px; margin-bottom:18px; }
    .jn-prop-row { display:flex; align-items:flex-start; padding:3px 0; }
    .jn-prop-key { font-size:.75rem; color:rgba(55,53,47,.35); width:72px; flex-shrink:0; padding-top:6px; font-weight:500; }
    .jn-prop-val { flex:1; }

    /* Mood picker */
    .jn-mood-row { display:flex; gap:2px; flex-wrap:wrap; }
    .jn-mood-btn { display:flex; flex-direction:column; align-items:center; gap:2px; padding:4px 7px; border-radius:6px; cursor:pointer; border:1px solid transparent; transition:background .1s,border-color .1s; background:none; }
    .jn-mood-btn:hover { background:rgba(55,53,47,.04); }
    .jn-mood-btn.selected { background:rgba(46,170,220,.12); border-color:rgba(46,170,220,.4); }
    .jn-mood-btn-circle { font-size:1.1rem; line-height:1; }
    .jn-mood-btn-label { font-size:.55rem; color:rgba(55,53,47,.32); font-weight:500; }
    .jn-mood-btn.selected .jn-mood-btn-label { color:rgba(46,170,220,.8); }

    /* Writing area */
    #jn-ed-content { width:100%; min-height:280px; padding:0; border:none; background:none; color:#37352f; font-size:.95rem; font-family:inherit; resize:none; line-height:1.75; outline:none; caret-color:#2eaadc; box-sizing:border-box; display:block; }
    #jn-ed-content::placeholder { color:rgba(55,53,47,.18); }

    /* AI Reflection button */
    .jn-reflect-btn { display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; border:1px solid rgba(46,170,220,.3); background:rgba(46,170,220,.07); color:rgba(46,170,220,.75); font-size:.78rem; font-weight:500; cursor:pointer; font-family:inherit; margin-top:16px; transition:background .1s,color .1s,border-color .1s; }
    .jn-reflect-btn:hover:not(:disabled) { background:rgba(46,170,220,.14); color:#2eaadc; border-color:rgba(46,170,220,.55); }
    .jn-reflect-btn:disabled { opacity:.35; cursor:default; }
    .jn-reflect-btn.loading { background:rgba(46,170,220,.05); }

    /* Reflection callout */
    .jn-reflection-callout { margin-top:16px; padding:14px 16px; border-radius:8px; background:rgba(46,170,220,.07); border-left:3px solid rgba(46,170,220,.5); }
    .jn-ref-top { display:flex; align-items:center; gap:6px; margin-bottom:10px; }
    .jn-ref-badge { font-size:.62rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:rgba(46,170,220,.7); flex:1; }
    .jn-ref-mood-tag { font-size:.7rem; background:rgba(46,170,220,.1); border:1px solid rgba(46,170,220,.3); border-radius:3px; padding:2px 7px; color:rgba(46,170,220,.9); }
    .jn-ref-divider { height:1px; background:rgba(46,170,220,.18); margin-bottom:10px; }
    .jn-ref-themes-row { display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:8px; }
    .jn-ref-themes-lbl { font-size:.58rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:rgba(55,53,47,.32); white-space:nowrap; }
    .jn-ref-theme-chip { font-size:.7rem; background:rgba(55,53,47,.04); border:1px solid rgba(55,53,47,.07); border-radius:3px; padding:1px 6px; color:rgba(55,53,47,.55); }
    .jn-ref-insight { margin-bottom:8px; }
    .jn-ref-insight-lbl { font-size:.58rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:rgba(55,53,47,.32); margin-bottom:3px; }
    .jn-ref-insight-text { font-size:.85rem; color:#37352f; line-height:1.65; }
    .jn-ref-aff { padding:10px 12px; border-radius:6px; background:rgba(144,101,176,.06); border:1px solid rgba(144,101,176,.2); display:flex; gap:8px; }
    .jn-ref-aff-icon { color:rgba(144,101,176,.6); font-size:.85rem; flex-shrink:0; }
    .jn-ref-aff-text { font-size:.82rem; color:rgba(144,101,176,.85); line-height:1.55; font-style:italic; }

    /* Spinner */
    @keyframes jn-spin { to { transform:rotate(360deg); } }
    .jn-spinner { width:12px; height:12px; border:1.5px solid rgba(46,170,220,.2); border-top-color:#2eaadc; border-radius:50%; animation:jn-spin .7s linear infinite; flex-shrink:0; }

    /* Confirm dialog */
    .jn-confirm-overlay { position:fixed; inset:0; z-index:12000; background:rgba(0,0,0,.72); display:flex; align-items:center; justify-content:center; padding:20px; }
    .jn-confirm-box { background:#ffffff; border:1px solid rgba(46,170,220,.25); border-radius:14px; padding:20px 22px; width:100%; max-width:320px; box-shadow:0 12px 40px rgba(0,0,0,.6); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .jn-confirm-title { font-size:.9rem; font-weight:600; color:#37352f; margin-bottom:5px; }
    .jn-confirm-text { font-size:.78rem; color:rgba(55,53,47,.5); line-height:1.5; margin-bottom:16px; }
    .jn-confirm-btns { display:flex; gap:8px; justify-content:flex-end; }
    .jn-confirm-cancel { padding:6px 14px; border-radius:8px; border:1px solid rgba(55,53,47,.08); background:none; color:rgba(55,53,47,.5); cursor:pointer; font-size:.78rem; font-family:inherit; }
    .jn-confirm-cancel:hover { background:rgba(55,53,47,.04); }
    .jn-confirm-delete { padding:6px 14px; border-radius:8px; border:1px solid rgba(144,101,176,.3); background:rgba(144,101,176,.1); color:#9065b0; cursor:pointer; font-size:.78rem; font-weight:700; font-family:inherit; }
    .jn-confirm-delete:hover { background:rgba(144,101,176,.18); }

    /* ── Import modal ────────────────────────────────────────────────*/
    #jn-import-overlay { position:fixed; inset:0; z-index:11000; background:rgba(0,0,0,.75); backdrop-filter:blur(6px); display:none; align-items:center; justify-content:center; padding:20px; }
    #jn-import-overlay.open { display:flex; }
    #jn-import-box { background:#f7f6f3; border:1px solid rgba(46,170,220,.2); border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,.6); width:100%; max-width:540px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
    .jn-imp-bar { display:flex; align-items:center; gap:8px; padding:13px 16px; border-bottom:1px solid rgba(55,53,47,.05); position:sticky; top:0; background:#f7f6f3; z-index:1; }
    .jn-imp-title { flex:1; font-size:.82rem; font-weight:600; color:#37352f; }
    .jn-imp-close { background:none; border:none; color:rgba(55,53,47,.4); font-size:1.1rem; cursor:pointer; padding:4px 7px; border-radius:4px; line-height:1; }
    .jn-imp-close:hover { background:rgba(55,53,47,.04); color:#37352f; }
    .jn-imp-body { padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
    .jn-imp-hint { font-size:.78rem; color:rgba(55,53,47,.5); line-height:1.6; }
    .jn-imp-hint strong { color:rgba(55,53,47,.75); font-weight:600; }
    .jn-imp-section-lbl { font-size:.62rem; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:rgba(46,170,220,.5); margin-bottom:5px; }
    .jn-imp-format-row { display:flex; gap:5px; flex-wrap:wrap; }
    .jn-imp-fmt-btn { padding:4px 10px; border-radius:6px; border:1px solid rgba(55,53,47,.07); background:none; color:rgba(55,53,47,.5); font-size:.72rem; font-weight:500; cursor:pointer; font-family:inherit; transition:all .1s; }
    .jn-imp-fmt-btn:hover { background:rgba(55,53,47,.03); }
    .jn-imp-fmt-btn.active { background:linear-gradient(135deg,#2eaadc,#9065b0); border-color:transparent; color:#fff; font-weight:700; }
    .jn-imp-upload-row { display:flex; align-items:center; gap:8px; }
    .jn-imp-file-label { display:flex; align-items:center; gap:5px; padding:6px 12px; border-radius:8px; border:1px solid rgba(46,170,220,.3); background:rgba(46,170,220,.07); color:rgba(46,170,220,.75); font-size:.75rem; cursor:pointer; white-space:nowrap; transition:background .1s; }
    .jn-imp-file-label:hover { background:rgba(46,170,220,.14); }
    #jn-imp-file { display:none; }
    .jn-imp-file-name { font-size:.7rem; color:rgba(55,53,47,.3); }
    .jn-imp-sep { display:flex; align-items:center; gap:8px; color:rgba(55,53,47,.11); font-size:.68rem; }
    .jn-imp-sep::before, .jn-imp-sep::after { content:''; flex:1; height:1px; background:rgba(55,53,47,.05); }
    #jn-imp-text { width:100%; min-height:130px; padding:9px 11px; border-radius:6px; border:1px solid rgba(55,53,47,.07); background:rgba(55,53,47,.02); color:#37352f; font-size:.82rem; font-family:inherit; resize:vertical; line-height:1.6; outline:none; box-sizing:border-box; }
    #jn-imp-text:focus { border-color:rgba(46,170,220,.4); }
    #jn-imp-text::placeholder { color:rgba(55,53,47,.2); }
    .jn-imp-parse-btn { width:100%; padding:8px; border-radius:8px; border:1px solid rgba(46,170,220,.3); background:rgba(46,170,220,.08); color:rgba(46,170,220,.8); font-size:.8rem; font-weight:700; cursor:pointer; font-family:inherit; }
    .jn-imp-parse-btn:hover { background:rgba(46,170,220,.14); }
    #jn-imp-preview { display:none; }
    .jn-imp-preview-head { font-size:.75rem; font-weight:600; color:rgba(55,53,47,.55); margin-bottom:8px; }
    .jn-imp-preview-list { display:flex; flex-direction:column; gap:4px; max-height:200px; overflow-y:auto; margin-bottom:10px; }
    .jn-imp-prev-item { padding:7px 10px; border-radius:6px; background:rgba(55,53,47,.02); border:1px solid rgba(55,53,47,.05); }
    .jn-imp-prev-date { font-size:.7rem; font-weight:600; color:#37352f; margin-bottom:2px; }
    .jn-imp-prev-text { font-size:.73rem; color:rgba(55,53,47,.42); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .jn-imp-prev-more { font-size:.7rem; color:rgba(55,53,47,.3); text-align:center; padding:4px; }
    .jn-imp-confirm-btn { width:100%; padding:9px; border-radius:8px; border:none; background:linear-gradient(135deg,#2eaadc,#9065b0); color:#fff; font-size:.82rem; font-weight:700; cursor:pointer; font-family:inherit; letter-spacing:.04em; }
    .jn-imp-confirm-btn:hover { filter:brightness(1.1); }
    .jn-imp-err { font-size:.75rem; color:#f87171; background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.2); border-radius:6px; padding:8px 10px; }
    .jn-imp-success { font-size:.75rem; color:#34d399; background:rgba(52,211,153,.08); border:1px solid rgba(52,211,153,.2); border-radius:6px; padding:8px 10px; }
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
    var ts = Date.now();
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

  var DAY_ABBR   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAY_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function fmtDayLabel(dateStr) {
    try {
      var d = new Date(dateStr + 'T00:00:00');
      return DAY_ABBR[d.getDay()] + ', ' + d.getDate() + ' ' + MONTH_NAMES[d.getMonth()];
    } catch (_) { return dateStr; }
  }

  function fmtDayFull(dateStr) {
    try {
      var d = new Date(dateStr + 'T00:00:00');
      return DAY_FULL[d.getDay()] + ', ' + d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
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

  function utcNoon(dateStr) { return new Date(dateStr + 'T12:00:00Z'); }
  function prevDay(dateStr) {
    var d = utcNoon(dateStr);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function calcStreak(entries) {
    var today = todayStr();
    var dates = {};
    entries.forEach(function (e) { if (e.date && e.content) dates[e.date] = true; });
    var streak = 0;
    var cur = dates[today] ? today : prevDay(today);
    for (var i = 0; i < 365; i++) {
      if (dates[cur]) { streak++; cur = prevDay(cur); }
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
      var d = utcNoon(today);
      d.setUTCDate(d.getUTCDate() - i);
      var ds = d.toISOString().slice(0, 10);
      result.push({ date: ds, day: DAY_ABBR[d.getUTCDay()], mood: byDate[ds] || '', isToday: ds === today });
    }
    return result;
  }

  function updateEditorDateDisplay(dateStr) {
    var el = document.getElementById('jn-ed-date-display');
    if (el) el.textContent = fmtDayFull(dateStr || todayStr());
  }

  /* ── Import: parsers ──────────────────────────────────────────────── */
  var MONTH_MAP = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
  };

  function parseIsoDate(s) {
    if (!s) return null;
    s = s.trim().replace(/^#+\s*/, '').replace(/^\w+day,?\s+/i, '').replace(/[:\-\u2013.]+$/, '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var m1 = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (m1) {
      var mo = MONTH_MAP[m1[1].toLowerCase()];
      if (mo) return m1[3] + '-' + String(mo).padStart(2,'0') + '-' + String(m1[2]).padStart(2,'0');
    }
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
      if (/^[-*=\u2500]{3,}$/.test(trimmed)) return;
      var date = parseIsoDate(trimmed);
      if (date) {
        flush();
        currentDate = date;
        currentLines = [];
      } else if (currentDate) {
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
    if (parsed && Array.isArray(parsed.entries)) {
      raw = parsed.entries.map(function (e) {
        var date = (e.creationDate || e.userLocalTime || e.date || '').slice(0, 10);
        return { date: date, content: (e.text || e.body || e.content || '').trim(), mood: '' };
      });
    } else if (Array.isArray(parsed)) {
      raw = parsed.map(function (e) {
        var date = e.date || (e.creationDate || e.created || e.time || '').slice(0, 10);
        return { date: date, content: (e.content || e.text || e.body || '').trim(), mood: e.mood || '', moodLabel: e.moodLabel || '' };
      });
    } else if (parsed && (parsed.date || parsed.creationDate)) {
      raw = [{ date: (parsed.date || (parsed.creationDate || '').slice(0, 10)), content: (parsed.content || parsed.text || '').trim(), mood: parsed.mood || '' }];
    }
    return raw.filter(function (e) { return e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.content; });
  }

  function splitCsvRow(line) {
    var cols = []; var field = ''; var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { field += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) { cols.push(field); field = ''; }
      else { field += c; }
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

  function importEntries(parsed) {
    var existing = getEntries();
    var byDate = {};
    existing.forEach(function (e) { if (!e.deleted && e.date) byDate[e.date] = true; });
    var added = 0, skipped = 0;
    parsed.forEach(function (imp) {
      if (!imp.date || !imp.content) { skipped++; return; }
      var date = imp.date.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; return; }
      if (byDate[date]) { skipped++; return; }
      var newEntry = {
        id: uid(), date: date, content: imp.content.trim(),
        mood: imp.mood || '', moodLabel: imp.moodLabel || '',
        aiReflection: '', wordCount: wordCount(imp.content),
        createdAt: Date.now(), updatedAt: Date.now(), importedAt: Date.now()
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
      + '<div class="jn-imp-title">Import entries</div>'
      + '<button class="jn-imp-close" id="jn-imp-close">&times;</button>'
      + '</div>'
      + '<div class="jn-imp-body">'
      + '<div class="jn-imp-hint">Supports <strong>plain text / markdown</strong>, <strong>Day One JSON</strong>, <strong>generic JSON</strong>, and <strong>CSV</strong>. Existing dates are never overwritten.</div>'
      + '<div><div class="jn-imp-section-lbl">Format</div>'
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
      + '<textarea id="jn-imp-text" placeholder="Paste your journal entries here...\n\n2024-01-15\nToday was a great day...\n\n2024-01-16\nFeeling reflective..."></textarea>'
      + '<button class="jn-imp-parse-btn" id="jn-imp-parse">Parse entries</button>'
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

    ov.querySelectorAll('.jn-imp-fmt-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ov.querySelectorAll('.jn-imp-fmt-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        importFormat = btn.dataset.fmt;
      });
    });

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

    // Close on backdrop click
    ov.addEventListener('click', function (e) {
      if (e.target === ov) closeImport();
    });

    return ov;
  }

  function openImport() {
    var ov = document.getElementById('jn-import-overlay');
    if (!ov) ov = buildImportOverlay();
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

    var previewList = document.getElementById('jn-imp-preview-list');
    var SHOW = Math.min(importParsed.length, 8);
    var listHtml = importParsed.slice(0, SHOW).map(function (e) {
      return '<div class="jn-imp-prev-item">'
        + '<div class="jn-imp-prev-date">' + esc(e.date) + (e.mood ? '  ' + esc(e.mood) : '') + '</div>'
        + '<div class="jn-imp-prev-text">' + esc((e.content || '').slice(0, 120)) + '</div>'
        + '</div>';
    }).join('');
    if (importParsed.length > SHOW) {
      listHtml += '<div class="jn-imp-prev-more">... and ' + (importParsed.length - SHOW) + ' more</div>';
    }
    previewList.innerHTML = listHtml;

    var existingDates = {};
    getActiveEntries().forEach(function (e) { if (e.date) existingDates[e.date] = true; });
    var newCount = importParsed.filter(function (e) { return e.date && !existingDates[e.date]; }).length;
    var skipCount = importParsed.length - newCount;
    var countHtml = 'Found <strong>' + importParsed.length + ' entries</strong>'
      + (importParsed.length !== newCount ? ' &mdash; <strong>' + newCount + ' new</strong>, ' + skipCount + ' already exist' : '')
      + ' &mdash; detected as <strong>' + esc(result.format) + '</strong>';
    document.getElementById('jn-imp-preview-count').innerHTML = countHtml;
    document.getElementById('jn-imp-do-import').textContent = 'Import ' + newCount + ' new entr' + (newCount === 1 ? 'y' : 'ies');
    preview.style.display = '';
  }

  function runImport() {
    if (!importParsed.length) return;
    var result = importEntries(importParsed);
    var fb = document.getElementById('jn-imp-feedback');
    fb.innerHTML = '<div class="jn-imp-success">Done! Added <strong>' + result.added + '</strong> entr' + (result.added === 1 ? 'y' : 'ies')
      + (result.skipped ? ', skipped ' + result.skipped + ' (already existed)' : '') + '.</div>';
    document.getElementById('jn-imp-preview').style.display = 'none';
    importParsed = [];
    try { window.dispatchEvent(new CustomEvent('homer-data-synced', { detail: { key: JKEY } })); } catch (_) {}
    setTimeout(function () { closeImport(); renderTab(); }, 1800);
  }

  /* ── Editor state ─────────────────────────────────────────────────── */
  var editorEntry      = null;
  var editorMood       = '';
  var editorMoodLabel  = '';
  var editorReflection = null;
  var reflectLoading   = false;

  /* ── Render tab ───────────────────────────────────────────────────── */
  function renderTab() {
    var tab = document.getElementById('tab-journal');
    if (!tab) return;
    var entries  = getActiveEntries();
    var streak   = calcStreak(entries);
    var weekMoods = getWeekMoods(entries);
    var today    = todayStr();
    var hasToday = entries.some(function (e) { return e.date === today; });

    /* Week strip */
    var weekHtml = weekMoods.map(function (m) {
      var dotClass = 'jn-week-dot' + (m.mood ? ' has-entry' : '') + (m.isToday ? ' is-today' : '');
      var inner = m.mood
        ? m.mood
        : (m.isToday ? '<span class="jn-week-empty"></span>' : '');
      return '<div class="jn-week-day">'
        + '<div class="jn-week-lbl' + (m.isToday ? ' today' : '') + '">' + esc(m.day) + '</div>'
        + '<div class="' + dotClass + '">' + inner + '</div>'
        + '</div>';
    }).join('');

    /* Entry groups */
    var grouped = {}, groupOrder = [];
    entries.forEach(function (e) {
      var mo = (e.date || '').slice(0, 7);
      if (!grouped[mo]) { grouped[mo] = []; groupOrder.push(mo); }
      grouped[mo].push(e);
    });

    var listHtml = '';
    if (!entries.length) {
      listHtml = '<div class="jn-empty">'
        + '<div class="jn-empty-icon">&#128468;</div>'
        + '<div class="jn-empty-title">No entries yet</div>'
        + '<div class="jn-empty-sub">Start with today\'s prompt or write your first entry</div>'
        + '</div>';
    } else {
      groupOrder.forEach(function (mo) {
        var grp = grouped[mo];
        listHtml += '<div class="jn-group-hd">'
          + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
          + '<span class="jn-group-hd-text">' + esc(fmtMonthLabel(mo + '-01')) + '</span>'
          + '<span class="jn-group-count">' + grp.length + '</span>'
          + '</div>';
        grp.forEach(function (e) {
          var icon = e.mood || '&#128221;';
          var reflObj = e.aiReflection ? safeJson(e.aiReflection, null) : null;
          var isToday = e.date === today;
          listHtml += '<div class="jn-row" data-id="' + esc(e.id) + '">'
            + '<div class="jn-row-icon">' + icon + '</div>'
            + '<div class="jn-row-main">'
            + '<div class="jn-row-title">'
            + esc(fmtDayLabel(e.date))
            + (isToday ? ' <span class="jn-row-today-badge">Today</span>' : '')
            + '</div>'
            + (e.content ? '<div class="jn-row-excerpt">' + esc((e.content || '').slice(0, 90)) + '</div>' : '')
            + '</div>'
            + '<div class="jn-row-props">'
            + '<span class="jn-tag">' + (e.wordCount || 0) + 'w</span>'
            + (reflObj ? '<span class="jn-tag ai">&#10024; AI</span>' : '')
            + '</div>'
            + '<button class="jn-row-del" data-id="' + esc(e.id) + '" title="Delete">&times;</button>'
            + '</div>';
        });
      });
    }

    tab.innerHTML = '<div class="jn-page">'
      + '<div class="jn-db-header">'
      + '<div class="jn-db-icon-wrap">&#128468;</div>'
      + '<div class="jn-db-title-col">'
      + '<h1 class="jn-db-title">Journal</h1>'
      + '<div class="jn-db-meta">'
      + '<span>&#128293; ' + streak + ' day' + (streak !== 1 ? 's' : '') + '</span>'
      + '<span class="jn-db-meta-dot">&middot;</span>'
      + '<span>' + entries.length + ' entr' + (entries.length !== 1 ? 'ies' : 'y') + '</span>'
      + '</div>'
      + '</div>'
      + '<div class="jn-db-actions">'
      + '<button class="jn-btn-ghost" id="jn-import-btn">&#8645; Import</button>'
      + '<button class="jn-btn-primary" id="jn-new-btn">+ ' + (hasToday ? 'Today' : 'New') + '</button>'
      + '</div>'
      + '</div>'
      + '<div class="jn-section-div"></div>'
      + '<div class="jn-week-row">' + weekHtml + '</div>'
      + '<div class="jn-section-div"></div>'
      + '<div class="jn-callout" id="jn-prompt-card">'
      + '<div class="jn-callout-icon">&#10024;</div>'
      + '<div class="jn-callout-content">'
      + '<div class="jn-callout-lbl">Today\'s Prompt</div>'
      + '<div id="jn-prompt-body"><span class="jn-callout-loading">Loading&hellip;</span></div>'
      + '</div>'
      + '<button class="jn-callout-refresh" id="jn-prompt-refresh" title="New prompt">&#8635;</button>'
      + '</div>'
      + '<div class="jn-section-div"></div>'
      + '<div class="jn-db-list">'
      + listHtml
      + '<div class="jn-new-row" id="jn-new-row-bt"><div class="jn-new-row-icon">+</div><span>New entry</span></div>'
      + '</div>'
      + '</div>';

    document.getElementById('jn-new-btn').addEventListener('click', function () { openEditor(null); });
    document.getElementById('jn-new-row-bt').addEventListener('click', function () { openEditor(null); });
    document.getElementById('jn-import-btn').addEventListener('click', openImport);
    document.getElementById('jn-prompt-refresh').addEventListener('click', loadPrompt);

    tab.querySelectorAll('.jn-row-del').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var id = btn.dataset.id;
        var entry = getEntries().find(function (e) { return e.id === id; });
        if (!entry) return;
        var conf = document.createElement('div');
        conf.className = 'jn-confirm-overlay';
        conf.innerHTML = '<div class="jn-confirm-box">'
          + '<div class="jn-confirm-title">Delete entry?</div>'
          + '<div class="jn-confirm-text">' + esc(fmtDayLabel(entry.date)) + ' will be permanently deleted.</div>'
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

    tab.querySelectorAll('.jn-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var id = row.dataset.id;
        if (!id) return;
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
    if (body) body.innerHTML = '<span class="jn-callout-loading">Generating prompt&hellip;</span>';
    fetch('/api/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prompt' }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        promptLoading = false;
        var b = document.getElementById('jn-prompt-body');
        if (!b) return;
        var prompt = (d && d.prompt) ? d.prompt : 'What made today meaningful?';
        b.innerHTML = '<div class="jn-callout-text">&ldquo;' + esc(prompt) + '&rdquo;</div>'
          + '<button class="jn-callout-btn" id="jn-prompt-write">Write Now &rarr;</button>';
        document.getElementById('jn-prompt-write').addEventListener('click', function () { openEditor(null); });
      })
      .catch(function () {
        promptLoading = false;
        var b = document.getElementById('jn-prompt-body');
        if (b) {
          b.innerHTML = '<div class="jn-callout-text">&ldquo;What made today meaningful?&rdquo;</div>'
            + '<button class="jn-callout-btn" id="jn-prompt-write">Write Now &rarr;</button>';
          var pw = document.getElementById('jn-prompt-write');
          if (pw) pw.addEventListener('click', function () { openEditor(null); });
        }
      });
  }

  /* ── Editor ───────────────────────────────────────────────────────── */
  function getOrCreateOverlay() {
    var ov = document.getElementById('jn-editor-overlay');
    if (ov) return ov;

    ov = document.createElement('div');
    ov.id = 'jn-editor-overlay';
    ov.innerHTML = '<div id="jn-editor-page">'
      + '<div class="jn-ed-topbar">'
      + '<button class="jn-ed-back" id="jn-ed-back">&#8592; Journal</button>'
      + '<div class="jn-ed-breadcrumb" id="jn-ed-breadcrumb"></div>'
      + '<div class="jn-ed-topbar-right">'
      + '<span class="jn-ed-wc-badge" id="jn-ed-wc-label"></span>'
      + '<button class="jn-ed-del-btn" id="jn-ed-del-btn" style="display:none" title="Delete entry">&#128465;</button>'
      + '<button class="jn-ed-save-btn" id="jn-ed-save-btn">Save</button>'
      + '</div>'
      + '</div>'
      + '<div class="jn-ed-body">'
      + '<div class="jn-ed-title-area">'
      + '<div class="jn-ed-date-display" id="jn-ed-date-display" title="Click to change date"></div>'
      + '<input type="date" id="jn-ed-date-input">'
      + '<div class="jn-ed-date-hint" id="jn-ed-date-hint"></div>'
      + '</div>'
      + '<div class="jn-ed-props">'
      + '<div class="jn-prop-row">'
      + '<div class="jn-prop-key">Mood</div>'
      + '<div class="jn-prop-val"><div class="jn-mood-row" id="jn-mood-row"></div></div>'
      + '</div>'
      + '</div>'
      + '<textarea id="jn-ed-content" placeholder="Start writing\u2026 this is your private space."></textarea>'
      + '<button class="jn-reflect-btn" id="jn-reflect-btn">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
      + '<span id="jn-reflect-label">Get AI Reflection</span>'
      + '</button>'
      + '<div id="jn-reflection-wrap" style="display:none"></div>'
      + '<div style="height:40px"></div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(ov);

    /* Click date display to open date picker */
    var dateDisplay = document.getElementById('jn-ed-date-display');
    var dateInput   = document.getElementById('jn-ed-date-input');
    dateDisplay.addEventListener('click', function () {
      try { dateInput.showPicker(); } catch (_) { dateInput.click(); }
    });

    document.getElementById('jn-ed-back').addEventListener('click', closeEditor);
    document.getElementById('jn-ed-save-btn').addEventListener('click', saveEntry);
    document.getElementById('jn-ed-del-btn').addEventListener('click', confirmDelete);
    document.getElementById('jn-ed-content').addEventListener('input', updateWordCount);
    document.getElementById('jn-reflect-btn').addEventListener('click', getReflection);
    document.getElementById('jn-ed-date-input').addEventListener('change', onEditorDateChange);

    /* Build mood buttons */
    var moodRow = document.getElementById('jn-mood-row');
    MOODS.forEach(function (m) {
      var btn = document.createElement('div');
      btn.className = 'jn-mood-btn';
      btn.dataset.emoji = m.emoji;
      btn.dataset.label = m.label;
      btn.innerHTML = '<div class="jn-mood-btn-circle">' + m.emoji + '</div>'
        + '<div class="jn-mood-btn-label">' + esc(m.label) + '</div>';
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

  function onEditorDateChange() {
    var input = document.getElementById('jn-ed-date-input');
    var newDate = input ? input.value : '';
    if (!newDate || !editorEntry) return;

    updateEditorDateDisplay(newDate);
    var bc = document.getElementById('jn-ed-breadcrumb');
    if (bc) bc.textContent = fmtDayLabel(newDate);

    var existing = getEntries().find(function (e) { return e.date === newDate && !e.deleted && e.id !== editorEntry.id; });
    var hint = document.getElementById('jn-ed-date-hint');
    if (existing) {
      editorEntry      = existing;
      editorMood       = existing.mood || '';
      editorMoodLabel  = existing.moodLabel || '';
      editorReflection = existing.aiReflection ? safeJson(existing.aiReflection, null) : null;
      document.getElementById('jn-ed-content').value = existing.content || '';
      var delBtn = document.getElementById('jn-ed-del-btn');
      if (delBtn) delBtn.style.display = existing.content ? '' : 'none';
      if (hint) hint.textContent = 'Editing existing entry';
    } else {
      editorEntry      = { id: uid(), date: newDate, content: '', mood: '', moodLabel: '', aiReflection: '', wordCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
      editorMood       = '';
      editorMoodLabel  = '';
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
      editorEntry      = entry;
      editorMood       = entry.mood || '';
      editorMoodLabel  = entry.moodLabel || '';
      editorReflection = entry.aiReflection ? safeJson(entry.aiReflection, null) : null;
    } else {
      var existing = getEntries().find(function (e) { return e.date === today && !e.deleted; });
      if (existing) {
        editorEntry      = existing;
        editorMood       = existing.mood || '';
        editorMoodLabel  = existing.moodLabel || '';
        editorReflection = existing.aiReflection ? safeJson(existing.aiReflection, null) : null;
      } else {
        editorEntry      = { id: uid(), date: today, content: '', mood: '', moodLabel: '', aiReflection: '', wordCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
        editorMood       = '';
        editorMoodLabel  = '';
        editorReflection = null;
      }
    }
    reflectLoading = false;

    var dateInput = document.getElementById('jn-ed-date-input');
    if (dateInput) {
      dateInput.value = editorEntry.date || today;
      dateInput.max   = today;
    }
    updateEditorDateDisplay(editorEntry.date || today);

    var bc = document.getElementById('jn-ed-breadcrumb');
    if (bc) bc.textContent = fmtDayLabel(editorEntry.date || today);

    var hint = document.getElementById('jn-ed-date-hint');
    if (hint) hint.textContent = (editorEntry.date && editorEntry.date !== today) ? 'Past entry' : '';

    document.getElementById('jn-ed-content').value = editorEntry.content || '';
    var delBtn = document.getElementById('jn-ed-del-btn');
    if (delBtn) delBtn.style.display = (editorEntry.content && editorEntry.content.trim()) ? '' : 'none';

    renderMoodSelection();
    updateWordCount();
    renderReflectionCard();
    ov.classList.add('open');
    setTimeout(function () { document.getElementById('jn-ed-content').focus(); }, 100);
  }

  function closeEditor() {
    var ov = document.getElementById('jn-editor-overlay');
    if (ov) ov.classList.remove('open');
    editorEntry = null;
    renderTab();
  }

  function saveEntry() {
    if (!editorEntry) return;
    var dateInput    = document.getElementById('jn-ed-date-input');
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
      + '<div class="jn-confirm-text">This journal entry will be permanently deleted and cannot be recovered.</div>'
      + '<div class="jn-confirm-btns">'
      + '<button class="jn-confirm-cancel">Cancel</button>'
      + '<button class="jn-confirm-delete">Delete</button>'
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
    wrap.innerHTML = '<div class="jn-reflection-callout">'
      + '<div class="jn-ref-top">'
      + '<span>&#10024;</span>'
      + '<span class="jn-ref-badge">AI Reflection</span>'
      + (r.mood ? '<span class="jn-ref-mood-tag">' + esc(moodEmoji + r.mood) + '</span>' : '')
      + '</div>'
      + '<div class="jn-ref-divider"></div>'
      + (r.themes ? '<div class="jn-ref-themes-row"><span class="jn-ref-themes-lbl">Themes</span>'
        + r.themes.split(',').map(function (t) { return '<span class="jn-ref-theme-chip">' + esc(t.trim()) + '</span>'; }).join('')
        + '</div>' : '')
      + (r.insight ? '<div class="jn-ref-insight"><div class="jn-ref-insight-lbl">Insight</div><div class="jn-ref-insight-text">' + esc(r.insight) + '</div></div>' : '')
      + (r.affirmation ? '<div class="jn-ref-aff"><span class="jn-ref-aff-icon">&#10022;</span><div class="jn-ref-aff-text">' + esc(r.affirmation) + '</div></div>' : '')
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
      btn.innerHTML = '<div class="jn-spinner"></div><span>Analyzing your entry&hellip;</span>';
    }
    fetch('/api/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reflect', entry: content }) })
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
          editorReflection = { insight: 'Unable to generate reflection right now.', affirmation: 'Keep writing \u2014 every word matters.', mood: '', themes: '' };
        }
        renderReflectionCard();
        var b2 = document.getElementById('jn-reflect-btn');
        if (b2) {
          b2.classList.remove('loading');
          b2.disabled = false;
          b2.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span id="jn-reflect-label">Refresh AI Reflection</span>';
        }
      })
      .catch(function () {
        reflectLoading = false;
        editorReflection = { insight: 'Unable to generate reflection right now.', affirmation: 'Keep writing \u2014 every word matters.', mood: '', themes: '' };
        renderReflectionCard();
        var b2 = document.getElementById('jn-reflect-btn');
        if (b2) {
          b2.classList.remove('loading');
          b2.disabled = false;
          b2.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span id="jn-reflect-label">Get AI Reflection</span>';
        }
      });
  }

  /* ── Joey JOURNAL action handler ──────────────────────────────────── */
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
    var sidebar = document.getElementById('desktop-sidebar');
    var spacer  = sidebar && sidebar.querySelector('.sb-spacer');
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
      if (typeof window._homerShowTab === 'function') { patchTabSystem(); }
      else { setTimeout(tryPatch, 200); }
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
