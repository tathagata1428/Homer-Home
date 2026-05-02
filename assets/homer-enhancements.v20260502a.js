/* ====================================================================
 * Homer Enhancements  v20260502a  (rev 5)
 *
 *  UI / Navigation
 *   1.  Command Palette        — Ctrl+K
 *   2.  Keyboard Shortcuts     — press ?
 *   3.  Tab Hotkeys            — Alt+1-8
 *   4.  Smooth Tab Transitions — CSS fade
 *   5.  Mobile Bottom Sheet    — swipe-up + drag-to-dismiss
 *   6.  Sidebar Tools          — Capture / Pomodoro / Inbox injected
 *                                into sidebar as action items with badge
 *   7.  Remove Floating Widgets — clock, weather widget, theme toggle
 *
 *  Productivity
 *   8.  Pomodoro Title         — live countdown in browser tab
 *   9.  Pomodoro Session Log   — localStorage + Supabase focus_sessions
 *   10. Links Live Search      — filter by name / URL / category
 *   11. Smart Capture Auto-tag — expense / link / task / thought
 *   12. Habit Morning Reminder — 8-11 AM toast
 *
 *  Widgets
 *   13. Inline Weather Forecast — click existing weather card to expand
 *                                 7-day forecast with geolocation
 *   14. Expense Category Chart  — bar chart inside expense panel
 *
 *  Data
 *   15. Supabase Data Sync     — Bogdan-only: push/pull expenses,
 *                                habits, inbox via field_state table
 *   16. Expense Ledger         — full-page sortable/filterable table
 *   17. Inbox Actions          — Thought->Joey, Task->Kanban,
 *                                Link->Links, Expense->Ledger
 * ==================================================================== */
(function () {
  'use strict';

  /* ── Utilities ─────────────────────────────────────────────────────── */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function toast(msg, type, dur) {
    if (typeof window._homerToast === 'function') { window._homerToast({message:msg,type:type||'info',duration:dur||3500}); return; }
    var el=document.createElement('div');
    el.style.cssText='position:fixed;bottom:80px;right:20px;z-index:99999;background:#1e293b;border:1px solid rgba(255,255,255,.15);color:#e5e7eb;padding:12px 16px;border-radius:12px;font-size:.88rem;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.4);cursor:pointer;max-width:320px;';
    el.textContent=msg;
    el.addEventListener('click',function(){el.parentNode&&el.parentNode.removeChild(el);});
    document.body.appendChild(el);
    setTimeout(function(){el.parentNode&&el.parentNode.removeChild(el);},dur||3500);
  }
  function clickEl(id){var el=document.getElementById(id);if(el)el.click();}
  function waitForEl(id, cb, limit) {
    var el=document.getElementById(id);
    if(el){cb(el);return;}
    var tries=0,max=limit||50,iv=setInterval(function(){
      el=document.getElementById(id);
      if(el||++tries>=max){clearInterval(iv);if(el)cb(el);}
    },300);
  }
  function switchTab(name){
    var btn=document.querySelector('.sb-item[data-tab="'+name+'"]')||document.querySelector('.tab-btn[data-tab="'+name+'"]');
    if(btn)btn.click();
  }
  function safeJson(s,fb){try{return s?JSON.parse(s):fb;}catch(_){return fb;}}
  function isBogdan(){
    var u=localStorage.getItem('homer-auth-user');
    if(u&&u.toLowerCase()==='bogdan')return true;
    var sess=window.__sbSession;
    return !!(sess&&sess.user&&(sess.user.email||'').toLowerCase().includes('bogdan'));
  }

  /* ── CSS ───────────────────────────────────────────────────────────── */
  var CSS=[
    /* Force dark theme always — kill light theme and theme toggle */
    'body.theme-light{--bg:#0f172a!important;--text:#e5e7eb!important;--muted:#94a3b8!important;--card-a:rgba(255,255,255,.04)!important;--card-b:rgba(255,255,255,.02)!important;background:#0f172a!important;color:#e5e7eb!important;}',
    '#homer-theme-btn{display:none!important;}',

    /* Hide original floating FABs on desktop (sidebar has them now) */
    '@media(min-width:901px){',
    '#homer-capture-btn,#homer-pomo-fab,#homer-habits-fab,#homer-expense-fab,#homer-brief-fab,#homer-memory-fab{display:none!important;}',
    '#he-fab-tray{display:none!important;}',
    '}',

    /* Sidebar tool section */
    '#he-sb-tools{border-top:1px solid rgba(255,255,255,.06);margin-top:8px;padding-top:4px;}',
    '.he-sb-action{position:relative;}',
    '.he-sb-capture{color:#60a5fa!important;}',
    '.he-sb-capture:hover{background:rgba(96,165,250,.1)!important;}',
    '.he-sb-pomo{color:#f87171!important;}',
    '.he-sb-pomo:hover{background:rgba(239,68,68,.09)!important;}',
    '.he-sb-inbox{color:#a78bfa!important;}',
    '.he-sb-inbox:hover{background:rgba(167,139,250,.09)!important;}',
    /* Inbox count badge */
    '.he-sb-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:9px;background:#a78bfa;color:#fff;font-size:.6rem;font-weight:800;padding:0 4px;margin-left:auto;line-height:1;flex-shrink:0;}',
    '#desktop-sidebar.collapsed .he-sb-badge{display:none;}',
    /* Running dot on pomo when active */
    '.he-pomo-dot{width:7px;height:7px;border-radius:50%;background:#ef4444;margin-left:auto;flex-shrink:0;animation:he-pomo-pulse 1.2s ease-in-out infinite;}',
    '@keyframes he-pomo-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}',
    '#desktop-sidebar.collapsed .he-pomo-dot{margin:0;}',

    /* Command Palette */
    '#he-cmd-overlay{position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);display:flex;align-items:flex-start;justify-content:center;padding-top:14vh;opacity:0;pointer-events:none;transition:opacity .15s}',
    '#he-cmd-overlay.open{opacity:1;pointer-events:all}',
    '#he-cmd-box{background:#0f172a;border:1px solid rgba(255,255,255,.18);border-radius:18px;width:100%;max-width:560px;margin:0 16px;box-shadow:0 32px 80px rgba(0,0,0,.75);overflow:hidden;transform:translateY(-8px);transition:transform .15s}',
    '#he-cmd-overlay.open #he-cmd-box{transform:translateY(0)}',
    '#he-cmd-input{width:100%;padding:16px 20px;background:none;border:none;outline:none;color:#e5e7eb;font-size:1rem;font-family:inherit;border-bottom:1px solid rgba(255,255,255,.08);box-sizing:border-box}',
    '#he-cmd-input::placeholder{color:#64748b}',
    '#he-cmd-results{max-height:380px;overflow-y:auto;padding:8px 8px 12px;scrollbar-width:thin}',
    '.he-cmd-group{padding:8px 12px 4px;font-size:.68rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.1em}',
    '.he-cmd-item{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:background .08s;color:#e5e7eb;font-size:.9rem;font-weight:600;user-select:none}',
    '.he-cmd-item.active,.he-cmd-item:hover{background:rgba(96,165,250,.15)}',
    '.he-cmd-icon{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0}',
    '.he-cmd-label{flex:1}',
    '.he-cmd-hint{font-size:.7rem;color:#64748b;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:2px 7px;font-family:monospace;white-space:nowrap}',

    /* Keyboard Shortcuts */
    '#he-keys-overlay{position:fixed;inset:0;z-index:999997;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .15s}',
    '#he-keys-overlay.open{opacity:1;pointer-events:all}',
    '#he-keys-box{background:#0f172a;border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:28px 32px;max-width:500px;width:calc(100% - 32px);box-shadow:0 24px 64px rgba(0,0,0,.6);max-height:85vh;overflow-y:auto}',
    '#he-keys-box h2{font-size:.95rem;font-weight:800;color:#e5e7eb;margin:0 0 18px;text-align:center;text-transform:uppercase;letter-spacing:.04em}',
    '.he-key-section{font-size:.68rem;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.he-key-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;gap:16px}',
    '.he-key-desc{font-size:.85rem;color:#cbd5e1;flex:1}',
    '.he-key-combo{display:flex;gap:4px;align-items:center}',
    '.he-kbd{display:inline-block;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#94a3b8;font-size:.72rem;font-weight:700;font-family:monospace;line-height:1.5}',
    '#he-keys-close-btn{display:block;width:100%;margin-top:18px;padding:9px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#94a3b8;font-size:.82rem;font-weight:700;cursor:pointer}',

    /* Smooth tab transitions */
    '.he-tab-enter{animation:he-tab-in .22s ease both}',
    '@keyframes he-tab-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',

    /* Mobile bottom sheet */
    '.he-sheet-handle{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.18);margin:10px auto 6px;cursor:grab;flex-shrink:0}',
    '@media(max-width:640px){.he-bs{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;width:100%!important;max-width:100%!important;max-height:82vh!important;border-radius:20px 20px 0 0!important;border-left:none!important;border-right:none!important;transform:translateY(110%)!important;transition:transform .32s cubic-bezier(.4,0,.2,1)!important;}.he-bs.open{transform:translateY(0)!important;}}',

    /* On mobile keep the capture + pomo FABs visible (no sidebar) */
    '@media(max-width:900px){#homer-capture-btn,#homer-pomo-fab{display:flex!important;}}',

    /* Links live search */
    '#he-links-search-wrap{margin-bottom:16px}',
    '#he-links-search{width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0b1220;color:var(--text);font-size:.9rem;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .2s}',
    '#he-links-search:focus{border-color:rgba(96,165,250,.5)}',
    '#he-links-search-count{font-size:.75rem;color:#64748b;margin-top:6px;min-height:1em}',

    /* Expense chart */
    '#he-exp-chart-wrap{padding:12px 16px 0;border-top:1px solid rgba(255,255,255,.06)}',
    '#he-exp-chart-wrap h4{font-size:.68rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px}',
    '.he-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:7px}',
    '.he-bar-label{width:80px;font-size:.7rem;color:#94a3b8;font-weight:700;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}',
    '.he-bar-track{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden}',
    '.he-bar-fill{height:100%;border-radius:4px;transition:width .4s cubic-bezier(.4,0,.2,1)}',
    '.he-bar-val{width:66px;font-size:.7rem;color:#94a3b8;font-weight:700;text-align:right;white-space:nowrap;flex-shrink:0}',

    /* Supabase sync badge */
    '#he-sync-badge{position:fixed;bottom:16px;right:16px;z-index:9988;font-size:.68rem;font-weight:700;color:#64748b;background:rgba(15,23,42,.85);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:3px 10px;pointer-events:none;opacity:0;transition:opacity .3s;white-space:nowrap}',
    '#he-sync-badge.visible{opacity:1}',
    '#he-sync-badge.syncing{color:#60a5fa}',
    '#he-sync-badge.synced{color:#34d399}',
    '#he-sync-badge.error{color:#f87171}',

    /* Expense Ledger overlay */
    '#he-ledger-ov{position:fixed;inset:0;z-index:99990;background:#060d1a;display:flex;flex-direction:column;overflow:hidden}',
    '#he-ledger-ov.hidden{display:none}',
    '#he-ledger-topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;gap:12px;flex-wrap:wrap}',
    '#he-ledger-topbar h2{margin:0;font-size:1.1rem;font-weight:800;color:#e5e7eb}',
    '#he-ledger-close{padding:7px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:none;color:#94a3b8;font-size:.85rem;font-weight:700;cursor:pointer}',
    '#he-ledger-body{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:20px}',
    '#he-ledger-add{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px}',
    '#he-ledger-add h3{margin:0 0 12px;font-size:.78rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em}',
    '.he-ledger-add-row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}',
    '.he-ledger-input{padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#e5e7eb;font-size:.88rem;font-family:inherit;outline:none}',
    '.he-ledger-input:focus{border-color:rgba(96,165,250,.4)}',
    '.he-ledger-input-desc{flex:2;min-width:140px}',
    '.he-ledger-input-amt{width:110px;flex-shrink:0}',
    '.he-ledger-input-date{width:130px;flex-shrink:0}',
    '.he-ledger-input-cat{flex:1;min-width:110px}',
    '.he-ledger-add-btn{padding:8px 18px;border-radius:9px;border:none;background:#3b82f6;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0}',
    '#he-ledger-summary{display:flex;gap:12px;flex-wrap:wrap}',
    '.he-ledger-stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px 16px;flex:1;min-width:130px}',
    '.he-ledger-stat-val{font-size:1.3rem;font-weight:900;color:#e5e7eb}',
    '.he-ledger-stat-lbl{font-size:.7rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:2px}',
    '#he-ledger-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.he-ledger-filter{padding:7px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#e5e7eb;font-size:.85rem;font-family:inherit;outline:none;cursor:pointer}',
    '#he-ledger-table-wrap{overflow-x:auto;border-radius:12px;border:1px solid rgba(255,255,255,.08)}',
    '#he-ledger-table{width:100%;border-collapse:collapse;font-size:.85rem}',
    '#he-ledger-table th{padding:10px 14px;text-align:left;font-size:.68rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid rgba(255,255,255,.08);cursor:pointer;user-select:none;white-space:nowrap;background:rgba(255,255,255,.03)}',
    '#he-ledger-table th:hover{color:#94a3b8}',
    '.he-th-arrow{margin-left:4px;opacity:.5}',
    '#he-ledger-table td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05);color:#e5e7eb;vertical-align:middle}',
    '#he-ledger-table tr:last-child td{border:none}',
    '#he-ledger-table tr:hover td{background:rgba(255,255,255,.03)}',
    '.he-ledger-cat-pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:.72rem;font-weight:700}',
    '.he-ledger-del{background:none;border:none;color:#475569;cursor:pointer;font-size:.85rem;padding:4px;border-radius:6px;transition:color .15s}',
    '.he-ledger-del:hover{color:#f87171}',
    '.he-ledger-empty{text-align:center;color:#475569;padding:40px;font-size:.9rem}',
    '#he-ledger-inbox{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px}',
    '#he-ledger-inbox h3{margin:0 0 12px;font-size:.78rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em}',
    '.he-inbox-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.84rem;color:#cbd5e1}',
    '.he-inbox-item:last-child{border:none}',
    '.he-inbox-type{padding:2px 8px;border-radius:10px;font-size:.68rem;font-weight:700;flex-shrink:0}',
    '.he-inbox-text{flex:1}',
    '.he-inbox-del{background:none;border:none;color:#475569;cursor:pointer;font-size:.8rem;padding:2px}',
    '.he-inbox-empty{color:#475569;font-size:.84rem;padding:8px 0}',

    /* Session log badge */
    '#he-session-log{position:fixed;bottom:16px;left:16px;z-index:9990;background:rgba(15,23,42,.9);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:6px 12px;font-size:.72rem;color:#94a3b8;font-weight:700;opacity:0;pointer-events:none;transition:opacity .3s;white-space:nowrap}',
    '#he-session-log.visible{opacity:1}',

    /* Inbox action buttons */
    '.he-iab-bar{display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;}',
    '.he-iab-btn{padding:3px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);font-size:.72rem;font-weight:700;cursor:pointer;transition:all .15s;line-height:1.6;}',
    '.he-iab-joey{border-color:rgba(167,139,250,.35);color:#a78bfa;background:rgba(167,139,250,.07);}',
    '.he-iab-joey:hover{background:rgba(167,139,250,.18);}',
    '.he-iab-kanban{border-color:rgba(52,211,153,.35);color:#34d399;background:rgba(52,211,153,.07);}',
    '.he-iab-kanban:hover{background:rgba(52,211,153,.18);}',
    '.he-iab-links{border-color:rgba(96,165,250,.35);color:#60a5fa;background:rgba(96,165,250,.07);}',
    '.he-iab-links:hover{background:rgba(96,165,250,.18);}',
    '.he-iab-expense{border-color:rgba(251,191,36,.35);color:#fbbf24;background:rgba(251,191,36,.07);}',
    '.he-iab-expense:hover{background:rgba(251,191,36,.18);}',
    '.he-iab-btn:disabled{opacity:.4;pointer-events:none;}',

    /* Inline weather forecast */
    '#he-wx-toggle-btn{margin-top:10px;background:none;border:1px solid rgba(96,165,250,.22);color:#60a5fa;font-size:.72rem;font-weight:700;padding:4px 12px;border-radius:20px;cursor:pointer;transition:background .15s;font-family:inherit;}',
    '#he-wx-toggle-btn:hover{background:rgba(96,165,250,.1);}',
    '#he-wx-forecast{display:none;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);}',
    '.he-wx-day-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);}',
    '.he-wx-day-row:last-child{border:none;}',
    '.he-wx-day-name{width:40px;font-size:.72rem;color:#94a3b8;font-weight:700;flex-shrink:0;}',
    '.he-wx-day-icon{width:22px;font-size:.9rem;flex-shrink:0;text-align:center;}',
    '.he-wx-day-desc{flex:1;font-size:.68rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.he-wx-day-temp{font-size:.75rem;font-weight:800;color:#e5e7eb;white-space:nowrap;}',
    '.he-wx-day-lo{font-weight:400;color:#64748b;}',
    '.he-wx-city{font-size:.68rem;color:#60a5fa;font-weight:700;margin-bottom:8px;letter-spacing:.03em;}',

    /* Mobile */
    '@media(max-width:600px){#he-cmd-box{margin:0 10px}#he-keys-box{padding:20px}#he-ledger-topbar{padding:12px 16px}#he-ledger-body{padding:14px 12px}}'
  ].join('');

  var styleEl=document.createElement('style');
  styleEl.id='homer-enhancements-css';
  styleEl.textContent=CSS;
  document.head.appendChild(styleEl);

  /* ── Boot ──────────────────────────────────────────────────────────── */
  ready(function(){
    removeFloatingWidgets();
    initSidebarTools();
    initCommandPalette();
    initKeyboardShortcutsPanel();
    initTabHotkeys();
    initSmoothTabTransitions();
    initMobileBottomSheet();
    initPomodoroTitleCountdown();
    initPomodoroSessionLogger();
    initLinksSearch();
    initSmartCaptureAutoTag();
    initHabitMorningReminder();
    initInlineWeatherForecast();
    initExpenseChart();
    initSupabaseDataSync();
    initExpenseLedger();
    initInboxActions();
  });

  /* ═══════════════════════════════════════════════════════════════════
   * 7. REMOVE FLOATING WIDGETS  (clock, weather widget, theme toggle)
   * ═══════════════════════════════════════════════════════════════════ */
  function removeFloatingWidgets(){
    var IDS=['homer-clock-widget','homer-weather-widget','homer-theme-btn'];
    function tryRemove(){
      IDS.forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});
    }
    tryRemove();
    setTimeout(tryRemove,600);
    setTimeout(tryRemove,1400);
    new MutationObserver(function(){
      IDS.forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});
    }).observe(document.body,{childList:true,subtree:true});
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 6. SIDEBAR TOOLS
   *    Injects Quick Capture, Pomodoro, and Inbox as action items
   *    above the spacer in the desktop sidebar. Shows icon-only when
   *    collapsed, full label + badge when expanded.
   * ═══════════════════════════════════════════════════════════════════ */
  function initSidebarTools(){
    waitForEl('desktop-sidebar',function(sidebar){
      if(sidebar.querySelector('#he-sb-tools'))return;

      var spacer=sidebar.querySelector('.sb-spacer');
      if(!spacer)return;

      var section=document.createElement('div');
      section.id='he-sb-tools';

      // SVG icons
      var svgCapture='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
      var svgPomo='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 3h6"/><path d="M12 3v2"/></svg>';
      var svgInbox='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';

      section.innerHTML=
        '<div class="sb-section-title">Quick Actions</div>'+
        '<button class="sb-item he-sb-action he-sb-capture" id="he-sb-capture-btn" title="Quick Capture (Alt+C)">'+
          svgCapture+'<span class="sb-label">Quick Capture</span>'+
        '</button>'+
        '<button class="sb-item he-sb-action he-sb-pomo" id="he-sb-pomo-btn" title="Pomodoro Timer">'+
          svgPomo+'<span class="sb-label">Pomodoro</span>'+
        '</button>'+
        '<button class="sb-item he-sb-action he-sb-inbox" id="he-sb-inbox-btn" title="Inbox">'+
          svgInbox+'<span class="sb-label">Inbox</span>'+
        '</button>';

      sidebar.insertBefore(section,spacer);

      // Wire up clicks
      document.getElementById('he-sb-capture-btn').addEventListener('click',function(){
        clickEl('homer-capture-btn');
      });
      document.getElementById('he-sb-pomo-btn').addEventListener('click',function(){
        clickEl('homer-pomo-fab');
      });
      document.getElementById('he-sb-inbox-btn').addEventListener('click',function(){
        if(typeof window._homerOpenInbox==='function')window._homerOpenInbox();
      });

      // Inbox badge: show count
      function refreshBadge(){
        var btn=document.getElementById('he-sb-inbox-btn');if(!btn)return;
        var count=safeJson(localStorage.getItem('homer-inbox'),[]).length;
        var badge=btn.querySelector('.he-sb-badge');
        if(count>0){
          if(!badge){badge=document.createElement('span');badge.className='he-sb-badge';btn.appendChild(badge);}
          badge.textContent=count>99?'99+':String(count);
        }else{
          if(badge)badge.remove();
        }
      }
      refreshBadge();
      setInterval(refreshBadge,2000);
      window.addEventListener('storage',refreshBadge);

      // Pomodoro running dot: watch #homer-pomo-fab for .running class
      waitForEl('homer-pomo-fab',function(fab){
        var pomoBtn=document.getElementById('he-sb-pomo-btn');
        new MutationObserver(function(){
          if(!pomoBtn)return;
          var running=fab.classList.contains('running');
          var dot=pomoBtn.querySelector('.he-pomo-dot');
          if(running&&!dot){
            dot=document.createElement('span');dot.className='he-pomo-dot';
            pomoBtn.appendChild(dot);
          }else if(!running&&dot){
            dot.remove();
          }
        }).observe(fab,{attributes:true,attributeFilter:['class']});
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 1. COMMAND PALETTE  (Ctrl+K)
   * ═══════════════════════════════════════════════════════════════════ */
  function initCommandPalette(){
    var overlay=document.createElement('div');overlay.id='he-cmd-overlay';
    overlay.innerHTML='<div id="he-cmd-box"><input id="he-cmd-input" autocomplete="off" spellcheck="false" placeholder="Navigate tabs, open panels, search\u2026"><div id="he-cmd-results"></div></div>';
    document.body.appendChild(overlay);
    var CMDS=[
      {g:'Tabs',icon:'🏠',label:'Home',hint:'Alt+1',fn:function(){switchTab('home');}},
      {g:'Tabs',icon:'🍅',label:'Pomodoro',hint:'Alt+2',fn:function(){switchTab('pomodoro');}},
      {g:'Tabs',icon:'🔬',label:'Focus Lab',hint:'Alt+3',fn:function(){switchTab('focuslab');}},
      {g:'Tabs',icon:'📈',label:'Investing',hint:'Alt+4',fn:function(){switchTab('investing');}},
      {g:'Tabs',icon:'🛠',label:'Tools',hint:'Alt+5',fn:function(){switchTab('tools');}},
      {g:'Tabs',icon:'🔗',label:'Links',hint:'Alt+6',fn:function(){switchTab('links');}},
      {g:'Tabs',icon:'📰',label:'News',hint:'Alt+7',fn:function(){switchTab('news');}},
      {g:'Tabs',icon:'🔒',label:'Vault',hint:'Alt+8',fn:function(){switchTab('vault');}},
      {g:'Actions',icon:'📥',label:'Quick Capture',hint:'Alt+C',fn:function(){clickEl('homer-capture-btn');}},
      {g:'Actions',icon:'📬',label:'Inbox',hint:'',fn:function(){if(typeof window._homerOpenInbox==='function')window._homerOpenInbox();}},
      {g:'Actions',icon:'✅',label:'Habits',hint:'',fn:function(){clickEl('homer-habits-fab');}},
      {g:'Actions',icon:'💰',label:'Expense Ledger',hint:'',fn:function(){openLedger();}},
      {g:'Actions',icon:'📋',label:'Daily Brief',hint:'',fn:function(){clickEl('homer-brief-fab');}},
      {g:'Actions',icon:'🧠',label:'Joey Memories',hint:'',fn:function(){clickEl('homer-memory-fab');}},
      {g:'Help',icon:'⌨',label:'Keyboard Shortcuts',hint:'?',fn:function(){openShortcutsPanel();}},
    ];
    var recent=[],activeIdx=0,filtered=CMDS.slice();
    function render(q){
      var ql=(q||'').toLowerCase().trim();
      filtered=ql?CMDS.filter(function(c){return(c.label+' '+c.g+' '+c.hint).toLowerCase().includes(ql);}):CMDS.slice();
      if(!ql&&recent.length){var rs=new Set(recent);filtered=filtered.filter(function(c){return rs.has(c.label);}).concat(filtered.filter(function(c){return!rs.has(c.label);}));}
      activeIdx=0;var html='',lastGroup='';
      if(!filtered.length){html='<div style="text-align:center;color:#64748b;padding:28px;font-size:.9rem">No results</div>';}
      else{filtered.forEach(function(cmd,i){
        if(cmd.g!==lastGroup&&!ql){html+='<div class="he-cmd-group">'+esc(cmd.g)+'</div>';lastGroup=cmd.g;}
        html+='<div class="he-cmd-item'+(i===0?' active':'')+'" data-idx="'+i+'"><div class="he-cmd-icon">'+cmd.icon+'</div><div class="he-cmd-label">'+esc(cmd.label)+'</div>'+(cmd.hint?'<div class="he-cmd-hint">'+esc(cmd.hint)+'</div>':'')+' </div>';
      });}
      document.getElementById('he-cmd-results').innerHTML=html;
      document.getElementById('he-cmd-results').querySelectorAll('.he-cmd-item').forEach(function(el){
        el.addEventListener('mouseenter',function(){activeIdx=parseInt(el.dataset.idx,10);markActive();});
        el.addEventListener('click',function(){run(parseInt(el.dataset.idx,10));});
      });
    }
    function markActive(){document.getElementById('he-cmd-results').querySelectorAll('.he-cmd-item').forEach(function(el,i){el.classList.toggle('active',i===activeIdx);if(i===activeIdx)el.scrollIntoView({block:'nearest'});});}
    function run(idx){var cmd=filtered[idx];if(!cmd)return;recent=[cmd.label].concat(recent.filter(function(l){return l!==cmd.label;})).slice(0,5);cmd.fn();close();}
    function open(){overlay.classList.add('open');var inp=document.getElementById('he-cmd-input');inp.value='';render('');setTimeout(function(){inp.focus();},40);}
    function close(){overlay.classList.remove('open');}
    document.getElementById('he-cmd-input').addEventListener('input',function(){render(this.value);});
    document.getElementById('he-cmd-input').addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'){e.preventDefault();activeIdx=Math.min(activeIdx+1,filtered.length-1);markActive();}
      else if(e.key==='ArrowUp'){e.preventDefault();activeIdx=Math.max(activeIdx-1,0);markActive();}
      else if(e.key==='Enter'){run(activeIdx);}else if(e.key==='Escape'){close();}
    });
    overlay.addEventListener('click',function(e){if(e.target===overlay)close();});
    document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();overlay.classList.contains('open')?close():open();}});
    window._heOpenCommandPalette=open;
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 2. KEYBOARD SHORTCUTS PANEL  (?)
   * ═══════════════════════════════════════════════════════════════════ */
  function initKeyboardShortcutsPanel(){
    function kRow(d){var k=Array.prototype.slice.call(arguments,1);return'<div class="he-key-row"><span class="he-key-desc">'+esc(d)+'</span><span class="he-key-combo">'+k.map(function(x){return'<span class="he-kbd">'+esc(x)+'</span>';}).join(' + ')+'</span></div>';}
    var ov=document.createElement('div');ov.id='he-keys-overlay';
    ov.innerHTML='<div id="he-keys-box"><h2>Keyboard Shortcuts</h2>'+
      '<div class="he-key-section">Navigation</div>'+kRow('Command palette','Ctrl','K')+kRow('Switch tab 1-8','Alt','1-8')+kRow('Shortcuts panel','?')+
      '<div class="he-key-section">Pomodoro</div>'+kRow('Start / Pause','Space')+
      '<div class="he-key-section">Capture</div>'+kRow('Quick capture','Alt','C')+kRow('Save entry','Ctrl','Enter')+
      '<div class="he-key-section">General</div>'+kRow('Close any panel','Esc')+kRow('Expand 7-day forecast','Click weather')+
      '<button id="he-keys-close-btn">Close</button></div>';
    document.body.appendChild(ov);
    function close(){ov.classList.remove('open');}
    document.getElementById('he-keys-close-btn').addEventListener('click',close);
    ov.addEventListener('click',function(e){if(e.target===ov)close();});
    document.addEventListener('keydown',function(e){
      var tag=(e.target.tagName||'').toUpperCase();
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||e.target.isContentEditable)return;
      if(e.key==='?'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();openShortcutsPanel();}
      if(e.key==='Escape')close();
    });
  }
  function openShortcutsPanel(){var el=document.getElementById('he-keys-overlay');if(el)el.classList.add('open');}

  /* ═══════════════════════════════════════════════════════════════════
   * 3. TAB HOTKEYS  (Alt+1-8)
   * ═══════════════════════════════════════════════════════════════════ */
  function initTabHotkeys(){
    var TABS=['home','pomodoro','focuslab','investing','tools','links','news','vault'];
    document.addEventListener('keydown',function(e){
      if(!e.altKey||e.ctrlKey||e.metaKey)return;
      var tag=(e.target.tagName||'').toUpperCase();
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
      var n=parseInt(e.key,10);if(n>=1&&n<=8){e.preventDefault();switchTab(TABS[n-1]);}
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 4. SMOOTH TAB TRANSITIONS
   * ═══════════════════════════════════════════════════════════════════ */
  function initSmoothTabTransitions(){
    function attach(btn){
      if(btn.dataset.heT)return;btn.dataset.heT='1';
      btn.addEventListener('click',function(){
        var panel=document.getElementById('tab-'+btn.dataset.tab);if(!panel)return;
        setTimeout(function(){panel.classList.remove('he-tab-enter');void panel.offsetWidth;panel.classList.add('he-tab-enter');panel.addEventListener('animationend',function(){panel.classList.remove('he-tab-enter');},{once:true});},10);
      });
    }
    document.querySelectorAll('.tab-btn[data-tab],.sb-item[data-tab]').forEach(attach);
    new MutationObserver(function(){document.querySelectorAll('.tab-btn[data-tab],.sb-item[data-tab]').forEach(attach);}).observe(document.body,{childList:true,subtree:true});
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 5. MOBILE BOTTOM SHEET
   * ═══════════════════════════════════════════════════════════════════ */
  function initMobileBottomSheet(){
    ['homer-expense-panel','homer-memory-panel','homer-inbox-panel'].forEach(function(id){
      waitForEl(id,function(el){if(window.innerWidth<=640)makeSheet(el);});
    });
    window.addEventListener('resize',function(){
      if(window.innerWidth>640)return;
      ['homer-expense-panel','homer-memory-panel','homer-inbox-panel'].forEach(function(id){var el=document.getElementById(id);if(el)makeSheet(el);});
    });
    function makeSheet(panel){
      if(panel.dataset.heSheet)return;panel.dataset.heSheet='1';panel.classList.add('he-bs');
      var handle=document.createElement('div');handle.className='he-sheet-handle';panel.insertBefore(handle,panel.firstChild);
      var startY=0,curY=0,drag=false;
      handle.addEventListener('touchstart',function(e){startY=e.touches[0].clientY;curY=startY;drag=true;},{passive:true});
      document.addEventListener('touchmove',function(e){if(!drag)return;curY=e.touches[0].clientY;var d=Math.max(0,curY-startY);panel.style.transform='translateY('+d+'px)';},{passive:true});
      document.addEventListener('touchend',function(){if(!drag)return;drag=false;var d=curY-startY;panel.style.transform='';if(d>80){panel.classList.remove('open');var ov=document.getElementById(panel.id.replace('-panel','-overlay'))||document.getElementById(panel.id.replace('-panel','-ov'));if(ov)ov.classList.remove('open');}});
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 8. POMODORO TITLE COUNTDOWN
   * ═══════════════════════════════════════════════════════════════════ */
  function initPomodoroTitleCountdown(){
    var orig=document.title;
    waitForEl('pom-time',function(pomTimeEl){
      var pomModeEl=document.getElementById('pom-mode');
      var prev='',last='';
      new MutationObserver(function(){
        var t=(pomTimeEl.textContent||'').trim(),m=(pomModeEl?pomModeEl.textContent:'').toLowerCase();
        if(t&&t!==last){prev=last;last=t;if(!(/^(25|5|15):00$/.test(t)&&!prev)){document.title=(m.includes('break')?'\uD83D\uDFE2':'\uD83C\uDF45')+' '+t+' \u2014 Homer';return;}}
        document.title=orig;
      }).observe(pomTimeEl,{childList:true,subtree:true,characterData:true});
      var rb=document.getElementById('pom-reset');
      if(rb)rb.addEventListener('click',function(){prev='';last='';document.title=orig;});
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 9. POMODORO SESSION LOGGER
   * ═══════════════════════════════════════════════════════════════════ */
  function initPomodoroSessionLogger(){
    waitForEl('pom-mode',function(pomModeEl){
      var lastMode='',sessionStart=null,STORAGE_KEY='homer-focus-sessions';
      var badge=document.createElement('div');badge.id='he-session-log';document.body.appendChild(badge);
      function showBadge(t){badge.textContent=t;badge.classList.add('visible');setTimeout(function(){badge.classList.remove('visible');},3000);}
      function todayCount(){var today=new Date().toISOString().slice(0,10);return safeJson(localStorage.getItem(STORAGE_KEY),[]).filter(function(s){return(s.ts||'').startsWith(today);}).length;}
      new MutationObserver(function(){
        var mode=(pomModeEl.textContent||'').trim().toLowerCase();
        if(mode===lastMode)return;var prev=lastMode;lastMode=mode;
        if(prev==='focus'&&mode!=='focus'){
          var dur=sessionStart?Math.round((Date.now()-sessionStart)/1000):null;
          if(!dur||dur<60)return;
          var task='';var te=document.getElementById('pom-task')||document.getElementById('task-input');if(te)task=(te.value||'').trim();
          var sess={ts:new Date().toISOString(),duration_secs:dur,task:task||null};
          var sessions=safeJson(localStorage.getItem(STORAGE_KEY),[]);sessions.push(sess);if(sessions.length>500)sessions=sessions.slice(-500);
          try{localStorage.setItem(STORAGE_KEY,JSON.stringify(sessions));}catch(_){}
          if(isBogdan()){
            var client=window.__supabase;
            if(client){var uid=window.__sbSession&&window.__sbSession.user&&window.__sbSession.user.id;client.from('focus_sessions').insert({created_at:sess.ts,duration_secs:dur,task_label:task||null,user_id:uid||null}).then(function(r){if(r.error)console.debug('[homer] focus_sessions:',r.error.message);});}
          }
          toast('\uD83C\uDF45 Session \u2014 '+Math.round(dur/60)+' min logged','success',2500);
          showBadge('\uD83C\uDF45 '+todayCount()+' sessions today');sessionStart=null;
        }
        if(mode==='focus')sessionStart=Date.now();
      }).observe(pomModeEl,{childList:true,subtree:true,characterData:true});
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 10. LINKS LIVE SEARCH
   * ═══════════════════════════════════════════════════════════════════ */
  function initLinksSearch(){
    var sec=document.getElementById('tab-links');if(!sec)return;
    var wrap=document.createElement('div');wrap.id='he-links-search-wrap';
    var inp=document.createElement('input');inp.type='search';inp.id='he-links-search';inp.placeholder='\uD83D\uDD0D Search by name, URL or category\u2026';
    var cnt=document.createElement('div');cnt.id='he-links-search-count';
    wrap.appendChild(inp);wrap.appendChild(cnt);
    var grid=document.getElementById('links-grid');
    if(grid)sec.insertBefore(wrap,grid);else{var h2=sec.querySelector('h2.section');(h2?h2:sec).insertAdjacentElement('afterend',wrap);}
    inp.addEventListener('input',function(){filterLinks(this.value.trim());});
    var g2=document.getElementById('links-grid');
    if(g2)new MutationObserver(function(){if(inp.value.trim())filterLinks(inp.value.trim());else cnt.textContent='';}).observe(g2,{childList:true});
    function filterLinks(q){
      var g=document.getElementById('links-grid');if(!g)return;
      if(!q){Array.from(g.children).forEach(function(el){el.style.display='';});cnt.textContent='';return;}
      var ql=q.toLowerCase(),total=0,shown=0;
      Array.from(g.children).forEach(function(el){total++;var t=(el.textContent||'').toLowerCase(),h='';var a=el.querySelector('a');if(a)h=(a.href||'').toLowerCase();var m=t.includes(ql)||h.includes(ql);el.style.display=m?'':'none';if(m)shown++;});
      cnt.textContent=shown+' of '+total+' match';
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 11. SMART CAPTURE AUTO-TAG
   * ═══════════════════════════════════════════════════════════════════ */
  function initSmartCaptureAutoTag(){
    new MutationObserver(function(){var ta=document.getElementById('homer-capture-text');if(ta&&!ta.dataset.heTagged){ta.dataset.heTagged='1';attachTag(ta);}}).observe(document.body,{childList:true,subtree:true});
    var ta=document.getElementById('homer-capture-text');if(ta){ta.dataset.heTagged='1';attachTag(ta);}
  }
  function attachTag(ta){
    var last='';
    ta.addEventListener('input',function(){
      var v=ta.value.trim();if(!v||v.length<4)return;
      var t=detectType(v);if(t===last)return;last=t;
      var m=document.getElementById('homer-capture-modal');if(!m)return;
      m.querySelectorAll('.homer-capture-tag').forEach(function(tag){if(tag.dataset.type===t&&!tag.classList.contains('active'))tag.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
    });
  }
  function detectType(s){
    if(/^https?:\/\/\S+/.test(s)||/^www\.\S+\.\S{2,}/.test(s))return'link';
    if(/\b\d[\d,.]*\s*(ron|lei|usd|\$|\u20ac|eur|gbp|\u00a3)\b/i.test(s))return'expense';
    if(/^[\d,.]+\s+(lei|ron|usd|eur)\b/i.test(s))return'expense';
    if(/^(todo|task|fix|buy|call|send|check|schedule|write|review|update|build|create|book)\b/i.test(s))return'task';
    return'thought';
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 12. HABIT MORNING REMINDER  (8-11 AM)
   * ═══════════════════════════════════════════════════════════════════ */
  function initHabitMorningReminder(){
    var KEY='he-habit-reminded',today=new Date().toISOString().slice(0,10),h=new Date().getHours();
    if(localStorage.getItem(KEY)===today||h<8||h>11)return;
    setTimeout(function(){
      var habits=safeJson(localStorage.getItem('homer-habits'),null);
      if(!habits||!habits.habits||!habits.habits.length)return;
      var pending=habits.habits.filter(function(hb){return!(habits.completions||{})[hb.id+':'+today];});
      if(!pending.length)return;
      localStorage.setItem(KEY,today);
      var names=pending.slice(0,3).map(function(hb){return hb.name;});
      toast('Habits due today: '+names.join(', ')+(pending.length>3?' +'+(pending.length-3)+' more':''),'info',6000);
    },5000);
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 13. INLINE WEATHER FORECAST
   *     Adds a toggle button below the existing Home tab weather card.
   *     Click -> optional location prompt -> 7-day open-meteo data.
   * ═══════════════════════════════════════════════════════════════════ */
  function initInlineWeatherForecast(){
    var WI={0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌧',61:'🌧',63:'🌧',65:'🌧',71:'🌨',73:'🌨',75:'❄️',80:'🌦',81:'🌧',82:'⛈',95:'⛈',96:'⛈',99:'⛈'};
    var WD={0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Heavy showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
    var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var CACHE_KEY='he-wx-inline-cache';

    var attempts=0;
    (function tryAttach(){
      if(++attempts>30)return;
      var wxEl=document.getElementById('wx-icon');
      if(!wxEl){setTimeout(tryAttach,500);return;}
      var card=wxEl.closest?wxEl.closest('.card'):null;
      if(!card){setTimeout(tryAttach,500);return;}
      if(card.querySelector('#he-wx-forecast')){return;} // already done

      var toggleBtn=document.createElement('button');
      toggleBtn.id='he-wx-toggle-btn';
      toggleBtn.textContent='\u25be 7-day forecast';

      var forecastDiv=document.createElement('div');
      forecastDiv.id='he-wx-forecast';

      var poweredBy=card.querySelector('.muted');
      if(poweredBy){
        card.insertBefore(toggleBtn,poweredBy);
        card.insertBefore(forecastDiv,poweredBy);
      }else{
        card.appendChild(toggleBtn);
        card.appendChild(forecastDiv);
      }

      var expanded=false,loaded=false;
      var lat=44.4268,lon=26.1025,city='Bucharest';
      var locState='unasked';

      function getTimezone(){
        try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Bucharest';}
        catch(_){return'Europe/Bucharest';}
      }

      toggleBtn.addEventListener('click',function(){
        expanded=!expanded;
        forecastDiv.style.display=expanded?'block':'none';
        toggleBtn.textContent=(expanded?'\u25b4':'\u25be')+' 7-day forecast';
        if(expanded&&!loaded){
          if(locState==='unasked')showLocPrompt();
          else fetchForecast();
        }
      });

      function showLocPrompt(){
        locState='asking';
        forecastDiv.innerHTML=
          '<div style="text-align:center;padding:10px 0;">'+
            '<p style="font-size:.78rem;color:#94a3b8;margin:0 0 10px;line-height:1.4">Use your location for accurate weather?</p>'+
            '<button id="he-wx-allow" style="padding:5px 14px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-size:.75rem;font-weight:700;cursor:pointer;margin-right:6px">&#x1F4CD; My Location</button>'+
            '<button id="he-wx-skip" style="padding:5px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:none;color:#94a3b8;font-size:.75rem;cursor:pointer">Bucharest</button>'+
          '</div>';
        document.getElementById('he-wx-allow').addEventListener('click',requestLoc);
        document.getElementById('he-wx-skip').addEventListener('click',function(){locState='denied';fetchForecast();});
      }

      function requestLoc(){
        locState='requesting';
        forecastDiv.innerHTML='<div style="text-align:center;padding:12px;color:#64748b;font-size:.75rem">Requesting location\u2026</div>';
        if(!navigator.geolocation){locState='denied';fetchForecast();return;}
        navigator.geolocation.getCurrentPosition(
          function(pos){
            lat=pos.coords.latitude;lon=pos.coords.longitude;locState='granted';
            fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lon,
              {headers:{'User-Agent':'HomerHome/1.0','Accept-Language':'en'}})
              .then(function(r){return r.json();})
              .then(function(d){
                var a=d.address||{};
                city=a.city||a.town||a.village||a.county||'Your Location';
                fetchForecast();
              })
              .catch(function(){fetchForecast();});
          },
          function(){locState='denied';fetchForecast();}
        );
      }

      function fetchForecast(){
        forecastDiv.innerHTML='<div style="text-align:center;padding:8px;color:#64748b;font-size:.75rem">Loading forecast\u2026</div>';

        // Check cache
        var cached=safeJson(localStorage.getItem(CACHE_KEY),null);
        if(cached&&
           Math.abs(cached.lat-lat)<0.05&&
           Math.abs(cached.lon-lon)<0.05&&
           Date.now()-cached.ts<3600000){
          renderForecast(cached.data);return;
        }

        var tz=getTimezone();
        var url='https://api.open-meteo.com/v1/forecast'+
          '?latitude='+lat.toFixed(4)+
          '&longitude='+lon.toFixed(4)+
          '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max'+
          '&timezone='+encodeURIComponent(tz)+
          '&forecast_days=7';

        fetch(url)
          .then(function(r){
            if(!r.ok)throw new Error('HTTP '+r.status);
            return r.json();
          })
          .then(function(d){
            try{localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),lat:lat,lon:lon,data:d}));}catch(_){}
            renderForecast(d);
          })
          .catch(function(err){
            forecastDiv.innerHTML='<div style="color:#f87171;font-size:.75rem;text-align:center;padding:10px">Could not load forecast. Try again later.</div>';
            console.debug('[homer] weather fetch error:',err);
          });
      }

      function renderForecast(d){
        loaded=true;
        var daily=d.daily;
        if(!daily||!daily.time||!daily.time.length){
          forecastDiv.innerHTML='<div style="color:#64748b;font-size:.75rem;text-align:center;padding:8px">No forecast data</div>';
          return;
        }

        var todayStr=new Date().toISOString().slice(0,10);
        var html='<div class="he-wx-city">&#x1F4CD; '+esc(city)+'</div>';

        daily.time.forEach(function(dateStr,i){
          var dt=new Date(dateStr+'T12:00:00');
          var dayName=dateStr===todayStr?'Today':DAYS[dt.getDay()];
          var code=daily.weathercode[i]||0;
          var hi=daily.temperature_2m_max[i]!=null?Math.round(daily.temperature_2m_max[i]):null;
          var lo=daily.temperature_2m_min[i]!=null?Math.round(daily.temperature_2m_min[i]):null;
          var precip=daily.precipitation_sum?daily.precipitation_sum[i]:null;
          var wind=daily.windspeed_10m_max?daily.windspeed_10m_max[i]:null;

          var tempStr='';
          if(hi!=null)tempStr+='<strong>'+hi+'&deg;</strong>';
          if(lo!=null)tempStr+=' <span class="he-wx-day-lo">/ '+lo+'&deg;</span>';

          var extras='';
          if(precip&&precip>0.5)extras+=' <span style="font-size:.65rem;color:#60a5fa">\uD83D\uDCA7 '+precip.toFixed(1)+'mm</span>';
          if(wind&&wind>20)extras+=' <span style="font-size:.65rem;color:#94a3b8">\uD83D\uDCA8 '+Math.round(wind)+'km/h</span>';

          html+=
            '<div class="he-wx-day-row">'+
              '<span class="he-wx-day-name">'+esc(dayName)+'</span>'+
              '<span class="he-wx-day-icon">'+(WI[code]||'🌡')+'</span>'+
              '<span class="he-wx-day-desc">'+esc(WD[code]||'')+extras+'</span>'+
              '<span class="he-wx-day-temp">'+tempStr+'</span>'+
            '</div>';
        });

        forecastDiv.innerHTML=html;
      }
    })();
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 14. EXPENSE CATEGORY CHART
   * ═══════════════════════════════════════════════════════════════════ */
  function initExpenseChart(){
    var CC={food:'#fb7185',transport:'#fbbf24',work:'#60a5fa',health:'#34d399',entertainment:'#a78bfa',other:'#94a3b8'};
    var CL={food:'\uD83C\uDF54 Food',transport:'\uD83D\uDE97 Transit',work:'\uD83D\uDCBC Work',health:'\uD83C\uDFE5 Health',entertainment:'\uD83C\uDFAC Fun',other:'\uD83D\uDCE6 Other'};
    (function inject(){
      var ep=document.getElementById('homer-expense-panel');if(!ep){setTimeout(inject,700);return;}
      if(document.getElementById('he-exp-chart-wrap'))return;
      var cw=document.createElement('div');cw.id='he-exp-chart-wrap';cw.innerHTML='<h4>This Month by Category</h4><div id="he-exp-chart"></div>';
      var list=document.getElementById('homer-exp-list');if(list)list.before(cw);else ep.appendChild(cw);
      new MutationObserver(function(){if(ep.classList.contains('open'))renderChart();}).observe(ep,{attributes:true,attributeFilter:['class']});
      if(list)new MutationObserver(function(){if(ep.classList.contains('open'))renderChart();}).observe(list,{childList:true});
    })();
    function renderChart(){
      var el=document.getElementById('he-exp-chart');if(!el)return;
      var all=safeJson(localStorage.getItem('homer-expenses'),[]),mo=new Date().toISOString().slice(0,7),totals={};
      all.filter(function(e){return(e.date||'').startsWith(mo);}).forEach(function(e){var c=e.cat||'other';totals[c]=(totals[c]||0)+(parseFloat(e.amount)||0);});
      var cats=Object.keys(totals).sort(function(a,b){return totals[b]-totals[a];});
      if(!cats.length){el.innerHTML='<div style="font-size:.72rem;color:#64748b;text-align:center;padding:8px 0">No expenses this month</div>';return;}
      var max=Math.max.apply(null,cats.map(function(k){return totals[k];}));
      el.innerHTML=cats.map(function(c){var p=max>0?(totals[c]/max*100).toFixed(1):0;return'<div class="he-bar-row"><div class="he-bar-label">'+esc(CL[c]||c)+'</div><div class="he-bar-track"><div class="he-bar-fill" style="width:'+p+'%;background:'+(CC[c]||'#94a3b8')+'"></div></div><div class="he-bar-val">'+totals[c].toFixed(0)+' RON</div></div>';}).join('');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 15. SUPABASE DATA SYNC  (Bogdan-only)
   * ═══════════════════════════════════════════════════════════════════ */
  var _syncDirty={};

  function initSupabaseDataSync(){
    if(!isBogdan())return;

    var badge=document.createElement('div');badge.id='he-sync-badge';document.body.appendChild(badge);
    function showBadge(txt,cls){badge.className=cls;badge.textContent=txt;badge.classList.add('visible');if(cls==='synced')setTimeout(function(){badge.classList.remove('visible');},3000);}

    function getClient(){return window.__supabase||null;}
    function getUid(){return window.__sbSession&&window.__sbSession.user&&window.__sbSession.user.id||null;}
    function isLoggedIn(){return!!getUid();}

    function pushKey(key){
      var client=getClient(),uid=getUid();if(!client||!uid)return;
      var val=localStorage.getItem(key);if(val===null)return;
      showBadge('Syncing\u2026','syncing');
      client.from('field_state').upsert({key:'he_'+key,value:val,user_id:uid},{onConflict:'key,user_id'})
        .then(function(r){
          if(r.error)showBadge('Sync error','error');
          else{delete _syncDirty[key];showBadge('Synced \u2713','synced');}
        }).catch(function(){showBadge('Sync error','error');});
    }

    function pullKey(key){
      var client=getClient(),uid=getUid();if(!client||!uid)return;
      client.from('field_state').select('value').eq('key','he_'+key).eq('user_id',uid).maybeSingle()
        .then(function(r){if(r.data&&r.data.value)localStorage.setItem(key,r.data.value);})
        .catch(function(){});
    }

    var SYNC_KEYS=['homer-expenses','homer-habits','homer-inbox'];

    function pullAll(){if(!isLoggedIn())return;SYNC_KEYS.forEach(pullKey);}
    function markDirty(key){_syncDirty[key]=true;}
    function pushDirty(){if(!isLoggedIn())return;Object.keys(_syncDirty).forEach(pushKey);}

    function waitForSession(){
      if(isLoggedIn()){pullAll();return;}
      window.addEventListener('supabase:session',function(){pullAll();},{once:true});
      setTimeout(function(){if(isLoggedIn())pullAll();},2000);
    }
    waitForSession();

    var origSetItem=localStorage.setItem.bind(localStorage);
    localStorage.setItem=function(key,val){
      origSetItem(key,val);
      if(SYNC_KEYS.indexOf(key)!==-1)markDirty(key);
    };

    setInterval(pushDirty,30000);
    window.addEventListener('beforeunload',pushDirty);

    ['homer-expense-panel','homer-habits-panel','homer-inbox-panel'].forEach(function(id){
      waitForEl(id,function(el){
        new MutationObserver(function(){if(!el.classList.contains('open'))pushDirty();}).observe(el,{attributes:true,attributeFilter:['class']});
      });
    });

    window._heSyncPush=pushKey;
    window._heSyncPullAll=pullAll;
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 16. EXPENSE LEDGER
   * ═══════════════════════════════════════════════════════════════════ */
  var _ledgerOpen=false;
  var CAT_COLOR={food:'#fb7185',transport:'#fbbf24',work:'#60a5fa',health:'#34d399',entertainment:'#a78bfa',other:'#94a3b8'};
  var CAT_LABEL={food:'Food',transport:'Transport',work:'Work',health:'Health',entertainment:'Entertainment',other:'Other'};

  function openLedger(){
    var ov=document.getElementById('he-ledger-ov');
    if(ov){ov.classList.remove('hidden');_ledgerOpen=true;renderLedger();return;}
    buildLedger();
  }

  function buildLedger(){
    var ov=document.createElement('div');ov.id='he-ledger-ov';ov.classList.add('hidden');
    var CAT_OPTS=['food','transport','work','health','entertainment','other'].map(function(c){return'<option value="'+c+'">'+CAT_LABEL[c]+'</option>';}).join('');
    ov.innerHTML=
      '<div id="he-ledger-topbar">'+
        '<h2>&#x1F4CA; Expense Ledger</h2>'+
        '<button id="he-ledger-close">Close</button>'+
      '</div>'+
      '<div id="he-ledger-body">'+
        '<div id="he-ledger-add"><h3>Add Expense</h3>'+
          '<div class="he-ledger-add-row">'+
            '<input type="text" id="he-l-desc" class="he-ledger-input he-ledger-input-desc" placeholder="Description *">'+
            '<input type="number" id="he-l-amt" class="he-ledger-input he-ledger-input-amt" placeholder="Amount (RON) *" min="0" step="0.01">'+
            '<select id="he-l-cat" class="he-ledger-input he-ledger-input-cat">'+CAT_OPTS+'</select>'+
            '<input type="date" id="he-l-date" class="he-ledger-input he-ledger-input-date">'+
            '<button id="he-l-add-btn" class="he-ledger-add-btn">+ Add</button>'+
          '</div>'+
        '</div>'+
        '<div id="he-ledger-summary"></div>'+
        '<div id="he-ledger-filters">'+
          '<select id="he-l-fmo" class="he-ledger-filter"></select>'+
          '<select id="he-l-fcat" class="he-ledger-filter"><option value="">All categories</option>'+CAT_OPTS+'</select>'+
          '<input type="search" id="he-l-fsearch" class="he-ledger-input" placeholder="&#x1F50D; Search\u2026" style="flex:1;min-width:150px">'+
        '</div>'+
        '<div id="he-ledger-table-wrap">'+
          '<table id="he-ledger-table"><thead><tr>'+
            '<th data-col="date">Date<span class="he-th-arrow"></span></th>'+
            '<th data-col="cat">Category<span class="he-th-arrow"></span></th>'+
            '<th data-col="desc">Description<span class="he-th-arrow"></span></th>'+
            '<th data-col="amount" style="text-align:right">Amount<span class="he-th-arrow"></span></th>'+
            '<th style="width:32px"></th>'+
          '</tr></thead><tbody id="he-ledger-body-rows"></tbody></table>'+
        '</div>'+
        '<div id="he-ledger-inbox">'+
          '<h3>&#x1F4E5; Inbox <span style="font-weight:400;font-size:.75rem;color:#475569">(unprocessed captures)</span></h3>'+
          '<div id="he-ledger-inbox-items"></div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);

    document.getElementById('he-l-date').value=new Date().toISOString().slice(0,10);
    document.getElementById('he-ledger-close').addEventListener('click',function(){ov.classList.add('hidden');_ledgerOpen=false;});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&_ledgerOpen){ov.classList.add('hidden');_ledgerOpen=false;}});

    buildMonthFilter();
    document.getElementById('he-l-add-btn').addEventListener('click',addExpense);
    ['he-l-desc','he-l-amt'].forEach(function(id){document.getElementById(id).addEventListener('keydown',function(e){if(e.key==='Enter')addExpense();});});

    var sortCol='date',sortDir=-1;
    document.getElementById('he-ledger-table').querySelectorAll('th[data-col]').forEach(function(th){
      th.addEventListener('click',function(){
        if(sortCol===th.dataset.col)sortDir*=-1;else{sortCol=th.dataset.col;sortDir=-1;}
        renderLedger();
      });
    });
    ov._sort=function(){return{col:sortCol,dir:sortDir};};

    ['he-l-fmo','he-l-fcat','he-l-fsearch'].forEach(function(id){document.getElementById(id).addEventListener('input',renderLedger);});
    ov.classList.remove('hidden');_ledgerOpen=true;
    renderLedger();

    function addExpense(){
      var desc=document.getElementById('he-l-desc').value.trim();
      var amt=parseFloat(document.getElementById('he-l-amt').value);
      if(!desc||isNaN(amt)||amt<=0){toast('Enter description and a positive amount','warn');return;}
      var expenses=safeJson(localStorage.getItem('homer-expenses'),[]);
      expenses.push({id:Date.now(),desc:desc,amount:amt,cat:document.getElementById('he-l-cat').value,date:document.getElementById('he-l-date').value||new Date().toISOString().slice(0,10)});
      localStorage.setItem('homer-expenses',JSON.stringify(expenses));
      document.getElementById('he-l-desc').value='';document.getElementById('he-l-amt').value='';
      buildMonthFilter();renderLedger();
      toast('Expense added','success',1800);
    }

    function buildMonthFilter(){
      var expenses=safeJson(localStorage.getItem('homer-expenses'),[]);
      var months=Array.from(new Set(expenses.map(function(e){return(e.date||'').slice(0,7);}).filter(Boolean))).sort().reverse();
      var sel=document.getElementById('he-l-fmo');if(!sel)return;
      var cur=sel.value;
      sel.innerHTML='<option value="">All months</option>'+months.map(function(m){var d=new Date(m+'-01');var label=d.toLocaleDateString('en-GB',{month:'long',year:'numeric'});return'<option value="'+m+'">'+label+'</option>';}).join('');
      if(cur)sel.value=cur;
    }
  }

  function renderLedger(){
    var tbody=document.getElementById('he-ledger-body-rows');if(!tbody)return;
    var ov=document.getElementById('he-ledger-ov');
    var sort=ov&&ov._sort?ov._sort():{col:'date',dir:-1};

    var expenses=safeJson(localStorage.getItem('homer-expenses'),[]);
    var fmo=(document.getElementById('he-l-fmo')||{}).value||'';
    var fcat=(document.getElementById('he-l-fcat')||{}).value||'';
    var fsearch=((document.getElementById('he-l-fsearch')||{}).value||'').toLowerCase();

    var filtered=expenses.filter(function(e){
      if(fmo&&!(e.date||'').startsWith(fmo))return false;
      if(fcat&&(e.cat||'other')!==fcat)return false;
      if(fsearch&&!(e.desc||'').toLowerCase().includes(fsearch))return false;
      return true;
    });

    filtered.sort(function(a,b){
      var av=sort.col==='amount'?parseFloat(a.amount||0):String(a[sort.col]||'');
      var bv=sort.col==='amount'?parseFloat(b.amount||0):String(b[sort.col]||'');
      return av<bv?-sort.dir:av>bv?sort.dir:0;
    });

    var total=filtered.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    var bycat={};filtered.forEach(function(e){var c=e.cat||'other';bycat[c]=(bycat[c]||0)+(parseFloat(e.amount)||0);});
    var summaryEl=document.getElementById('he-ledger-summary');
    if(summaryEl){
      var statsHtml='<div class="he-ledger-stat"><div class="he-ledger-stat-val">'+total.toFixed(2)+' RON</div><div class="he-ledger-stat-lbl">Total</div></div>'+
        '<div class="he-ledger-stat"><div class="he-ledger-stat-val">'+filtered.length+'</div><div class="he-ledger-stat-lbl">Transactions</div></div>';
      var topCat=Object.keys(bycat).sort(function(a,b){return bycat[b]-bycat[a];})[0];
      if(topCat)statsHtml+='<div class="he-ledger-stat"><div class="he-ledger-stat-val">'+bycat[topCat].toFixed(0)+' RON</div><div class="he-ledger-stat-lbl">Top: '+(CAT_LABEL[topCat]||topCat)+'</div></div>';
      summaryEl.innerHTML=statsHtml;
    }

    if(!filtered.length){tbody.innerHTML='<tr><td colspan="5" class="he-ledger-empty">No expenses match the filters.</td></tr>';}
    else{
      tbody.innerHTML=filtered.map(function(e){
        var cat=e.cat||'other',col=CAT_COLOR[cat]||'#94a3b8';
        return'<tr data-id="'+e.id+'">'+
          '<td>'+esc(e.date||'')+'</td>'+
          '<td><span class="he-ledger-cat-pill" style="background:'+col+'22;color:'+col+'">'+esc(CAT_LABEL[cat]||cat)+'</span></td>'+
          '<td>'+esc(e.desc||'')+'</td>'+
          '<td style="text-align:right;font-weight:700">'+parseFloat(e.amount||0).toFixed(2)+'</td>'+
          '<td><button class="he-ledger-del" title="Delete">\u00d7</button></td>'+
        '</tr>';
      }).join('');
      tbody.querySelectorAll('.he-ledger-del').forEach(function(btn){
        btn.addEventListener('click',function(){
          var id=parseInt(btn.closest('tr').dataset.id,10);
          var all=safeJson(localStorage.getItem('homer-expenses'),[]).filter(function(e){return e.id!==id;});
          localStorage.setItem('homer-expenses',JSON.stringify(all));
          renderLedger();toast('Expense deleted','info',1500);
        });
      });
    }
    renderLedgerInbox();
  }

  function renderLedgerInbox(){
    var el=document.getElementById('he-ledger-inbox-items');if(!el)return;
    var inbox=safeJson(localStorage.getItem('homer-inbox'),[]);
    if(!inbox.length){el.innerHTML='<div class="he-inbox-empty">No items in inbox.</div>';return;}
    var TCOLOR={thought:'#a78bfa',task:'#34d399',link:'#60a5fa',expense:'#fbbf24'};
    el.innerHTML=inbox.map(function(item,i){
      var tc=TCOLOR[item.type||'thought']||'#94a3b8';
      return'<div class="he-inbox-item" data-idx="'+i+'">'+
        '<span class="he-inbox-type" style="background:'+tc+'22;color:'+tc+'">'+esc(item.type||'thought')+'</span>'+
        '<span class="he-inbox-text">'+esc((item.text||'').slice(0,120))+'</span>'+
        '<button class="he-inbox-del">\u00d7</button>'+
      '</div>';
    }).join('');
    el.querySelectorAll('.he-inbox-del').forEach(function(btn){
      btn.addEventListener('click',function(){
        var idx=parseInt(btn.closest('[data-idx]').dataset.idx,10);
        var all=safeJson(localStorage.getItem('homer-inbox'),[]);
        all.splice(idx,1);
        localStorage.setItem('homer-inbox',JSON.stringify(all));
        renderLedgerInbox();
      });
    });
  }

  function initExpenseLedger(){
    // Override expense FAB to open ledger
    var tries=0,iv=setInterval(function(){
      var fab=document.getElementById('homer-expense-fab');
      if(fab||++tries>20){clearInterval(iv);
        if(fab&&!fab.dataset.heLedger){fab.dataset.heLedger='1';fab.addEventListener('click',function(e){e.stopImmediatePropagation();openLedger();});}
      }
    },400);
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 17. INBOX ACTIONS
   * ═══════════════════════════════════════════════════════════════════ */
  function initInboxActions(){
    waitForEl('homer-inbox-list',function(list){
      new MutationObserver(function(){addActionBtns(list);}).observe(list,{childList:true});
      addActionBtns(list);
    });
  }

  function addActionBtns(list){
    list.querySelectorAll('.homer-inbox-item:not([data-he-actions])').forEach(function(item){
      item.dataset.heActions='1';
      var id=parseInt(item.dataset.id,10);
      var inbox=safeJson(localStorage.getItem('homer-inbox'),[]);
      var entry=inbox.find(function(x){return x.id===id;});
      if(!entry)return;
      var type=entry.type||'thought';
      var map={thought:{label:'🧠 Save to Joey',cls:'he-iab-joey'},task:{label:'📋 Add to Kanban',cls:'he-iab-kanban'},link:{label:'🔗 Save to Links',cls:'he-iab-links'},expense:{label:'💰 Open in Ledger',cls:'he-iab-expense'}};
      var cfg=map[type];if(!cfg)return;
      var bar=document.createElement('div');bar.className='he-iab-bar';
      var btn=document.createElement('button');btn.className='he-iab-btn '+cfg.cls;btn.innerHTML=cfg.label;
      bar.appendChild(btn);
      var meta=item.querySelector('.homer-inbox-item-meta');
      if(meta)meta.insertAdjacentElement('afterend',bar);else item.appendChild(bar);
      btn.addEventListener('click',function(e){e.stopPropagation();btn.disabled=true;dispatchInboxAction(type,entry.text||'',entry.id,btn,item);});
    });
  }

  function dispatchInboxAction(type,text,entryId,btn,item){
    if(type==='thought'){
      saveToJoey(text,function(ok){
        if(ok){removeInboxEntry(entryId);fadeItem(item);toast('Thought saved to Joey memories','success');}
        else{btn.disabled=false;toast('Could not reach Joey \u2014 check your connection','error');}
      });
    }else if(type==='task'){
      addToKanban(text,function(ok){
        if(ok){removeInboxEntry(entryId);fadeItem(item);toast('Task added to Organize Life','success');}
        else{btn.disabled=false;toast('Vault must be unlocked to add tasks','warn',5000);}
      });
    }else if(type==='link'){
      var url=text.trim();
      if(!/^https?:\/\//i.test(url))url='https://'+url;
      var defaultName='';
      try{defaultName=new URL(url).hostname.replace(/^www\./,'');}catch(_){defaultName=url.slice(0,40);}
      var name=window.prompt('Name for this link:',defaultName);
      if(!name){btn.disabled=false;return;}
      if(window._homerAddSavedLink){
        var res=window._homerAddSavedLink({name:name,url:url});
        if(res&&res.ok){removeInboxEntry(entryId);fadeItem(item);switchTab('links');toast('Link "'+name+'" saved','success');}
        else{btn.disabled=false;toast((res&&res.error)||'Could not add link','error');}
      }else{btn.disabled=false;toast('Links not ready yet','warn');}
    }else if(type==='expense'){
      openLedger();
      setTimeout(function(){
        var descEl=document.getElementById('he-l-desc');
        if(descEl)descEl.value=text;
        var amtMatch=text.match(/\b(\d[\d.,]*)\s*(?:ron|lei|usd|\$|\u20ac|eur|gbp)?\b/i);
        if(amtMatch){var amtEl=document.getElementById('he-l-amt');if(amtEl)amtEl.value=parseFloat(amtMatch[1].replace(',','.')).toFixed(2);}
        if(descEl)descEl.focus();
      },350);
      removeInboxEntry(entryId);fadeItem(item);
      toast('Expense pre-filled in Ledger','info');
    }
  }

  function fadeItem(item){
    item.style.transition='opacity .4s';item.style.opacity='0';
    setTimeout(function(){if(item.parentNode)item.parentNode.removeChild(item);},450);
  }
  function removeInboxEntry(id){
    var inbox=safeJson(localStorage.getItem('homer-inbox'),[]);
    localStorage.setItem('homer-inbox',JSON.stringify(inbox.filter(function(x){return x.id!==id;})));
  }

  function saveToJoey(text,cb){
    var headers={'Content-Type':'application/json'};
    var authH=typeof window.supabaseAuthHeader==='function'?window.supabaseAuthHeader():null;
    if(authH)headers['Authorization']=authH;
    fetch('/api/joey',{method:'POST',headers:headers,body:JSON.stringify({action:'memory',memory:text,source:'inbox',category:'thought'})})
      .then(function(r){return r.json();}).then(function(d){cb(!d.error);}).catch(function(){cb(false);});
  }

  function addToKanban(text,cb){
    if(!window._homerLoadVault||!window._homerVaultUnlocked){cb(false);return;}
    window._homerLoadVault().then(function(data){
      if(!data){cb(false);return;}
      var projs=data.projects||[];
      var proj=projs.find(function(p){return p.id==='organize-life'||(p.name||'').toLowerCase().replace(/\s/g,'').includes('organizelife');});
      var projId=proj?proj.id:(projs[0]?projs[0].id:'organize-life');
      if(!data.goals)data.goals=[];
      data.goals.push({id:Date.now(),summary:text,desc:'',projectId:projId,col:'todo',priority:'medium',labels:['inbox'],subtasks:[],attachments:[],comments:[],customFields:{},log:[{action:'Added from Quick Capture inbox',ts:Date.now()}]});
      window._homerSaveVault(data).then(function(){cb(true);}).catch(function(){cb(false);});
    }).catch(function(){cb(false);});
  }

})();
