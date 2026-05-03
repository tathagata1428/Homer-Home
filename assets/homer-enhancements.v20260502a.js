/* ====================================================================
 * Homer Enhancements  v20260502a  (rev 7)
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

    /* Quick Actions FAB tray — shared button styles (tray itself is mobile-only via CSS below) */
    '.he-fab{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.95rem;cursor:pointer;border:1px solid rgba(255,255,255,.1);transition:background .2s,transform .2s;-webkit-tap-highlight-color:transparent;background:rgba(255,255,255,.06);}',
    '.he-fab:hover{transform:scale(1.12);background:rgba(255,255,255,.13);}',
    '#he-fab-more{background:rgba(255,255,255,.04)!important;color:#64748b!important;font-size:1.1rem!important;letter-spacing:.05em!important;}',
    '#he-fab-more:hover{background:rgba(255,255,255,.1)!important;color:#94a3b8!important;}',
    '#he-fab-tray-sep{width:1px;height:22px;background:rgba(255,255,255,.1);flex-shrink:0;margin:0 2px;}',
    '#he-fab-extras{display:flex;gap:6px;align-items:center;overflow:hidden;max-width:0;transition:max-width .3s cubic-bezier(.4,0,.2,1),opacity .25s;opacity:0;pointer-events:none;}',
    '#he-fab-extras.open{max-width:260px;opacity:1;pointer-events:all;}',
    /* Strip fixed/absolute positioning from FABs reparented into the tray */
    '#he-fab-tray button{position:static!important;bottom:auto!important;left:auto!important;right:auto!important;top:auto!important;display:flex!important;width:36px!important;height:36px!important;min-width:0!important;flex-shrink:0!important;}',

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

    /* On mobile: all floating FABs hidden — actions accessed via system tray or More sheet */
    '@media(max-width:900px){'+
    '#homer-capture-btn,#homer-pomo-fab,#homer-habits-fab,#homer-expense-fab,#homer-brief-fab,#homer-memory-fab{display:none!important;}'+
    '}',

    /* On touch devices: sheet sits above nav bar so nav remains visible + tap-able */
    '@media (hover:none) and (pointer:coarse){'+
    '#mobile-sheet{bottom:max(calc(var(--sab,env(safe-area-inset-bottom,0px)) + 68px),80px)!important;}'+
    '#mobile-sheet-content{border-radius:26px!important;}'+
    '}',

    /* Mobile system tray — shown & positioned on touch devices ≤ 900 px (above the bottom nav) */
    '@media(hover:none) and (pointer:coarse) and (max-width:900px){'+
    '#he-fab-tray{'+
    'position:fixed!important;left:50%!important;transform:translateX(-50%)!important;'+
    'bottom:80px;z-index:910!important;display:flex!important;flex-direction:row!important;'+
    'align-items:center!important;gap:8px!important;'+
    'background:rgba(7,17,31,.88)!important;border:1px solid rgba(148,163,184,.18)!important;'+
    'border-radius:999px!important;padding:6px 10px!important;'+
    '-webkit-backdrop-filter:blur(16px) saturate(145%)!important;'+
    'backdrop-filter:blur(16px) saturate(145%)!important;'+
    'box-shadow:0 8px 24px rgba(2,6,23,.4)!important;}'+
    '}',

    /* Desktop: stretch body to full viewport so no gray gap below footer */
    '@media(min-width:901px){html,body{min-height:100vh!important;}body{background-attachment:fixed!important;}}',

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

    /* Vault ledger tile accent */
    '#vd-open-ledger .vd-icon{background:rgba(251,191,36,.1);}',
    '#vd-open-ledger:hover{border-color:rgba(251,191,36,.25)!important;}',
    '#vd-open-ledger .vd-badge{background:rgba(251,191,36,.12);color:#fbbf24;}',

    /* Smart insight cards */
    '#he-ledger-insights{display:flex;gap:10px;flex-wrap:wrap;}',
    '.he-insight-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px 16px;flex:1;min-width:110px;display:flex;flex-direction:column;gap:3px;}',
    '.he-insight-icon{font-size:1.05rem;line-height:1;}',
    '.he-insight-val{font-size:1.1rem;font-weight:900;color:#e5e7eb;line-height:1.2;}',
    '.he-insight-lbl{font-size:.65rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.05em;}',
    '.he-insight-warn{color:#fbbf24!important;}',
    '.he-insight-ok{color:#34d399!important;}',
    '.he-insight-bad{color:#f87171!important;}',

    /* Budget envelopes */
    '#he-ledger-budgets{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;}',
    '#he-ledger-budgets h3{margin:0 0 14px;font-size:.78rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;justify-content:space-between;}',
    '.he-budget-row{display:flex;align-items:center;gap:10px;margin-bottom:9px;}',
    '.he-budget-row:last-child{margin-bottom:0;}',
    '.he-budget-label{width:90px;font-size:.72rem;font-weight:700;color:#94a3b8;flex-shrink:0;display:flex;align-items:center;gap:4px;}',
    '.he-budget-track{flex:1;height:9px;border-radius:5px;background:rgba(255,255,255,.07);overflow:hidden;}',
    '.he-budget-fill{height:100%;border-radius:5px;transition:width .5s cubic-bezier(.4,0,.2,1);}',
    '.he-budget-fill.over{background:#f87171!important;}',
    '.he-budget-info{width:96px;font-size:.7rem;color:#64748b;font-weight:600;text-align:right;white-space:nowrap;flex-shrink:0;}',
    '.he-budget-info.warn{color:#fbbf24;}',
    '.he-budget-info.bad{color:#f87171;}',
    '.he-budget-edit-btn{background:none;border:none;color:#475569;cursor:pointer;font-size:.7rem;padding:1px 5px;border-radius:5px;transition:color .15s;}',
    '.he-budget-edit-btn:hover{color:#94a3b8;background:rgba(255,255,255,.06);}',

    /* Export button + notes */
    '#he-ledger-export{padding:7px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#94a3b8;font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap;}',
    '#he-ledger-export:hover{border-color:rgba(52,211,153,.35);color:#34d399;}',
    '.he-ledger-input-note{flex:2;min-width:120px;}',
    '.he-ledger-note-cell{font-size:.75rem;color:#64748b;font-style:italic;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',

    /* Ledger nav tabs */
    '#he-ledger-nav{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;padding:0 8px;overflow-x:auto;scrollbar-width:none;}',
    '#he-ledger-nav::-webkit-scrollbar{display:none;}',
    '.he-lnav-btn{padding:10px 16px;border:none;background:none;color:#64748b;font-size:.82rem;font-weight:700;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s,border-color .15s;font-family:inherit;white-space:nowrap;flex-shrink:0;}',
    '.he-lnav-btn.active{color:#e5e7eb;border-bottom-color:#3b82f6;}',
    '.he-lnav-btn:hover:not(.active){color:#94a3b8;}',
    '#he-ledger-view{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:20px;}',

    /* Monthly balance */
    '#he-ledger-balance{border-radius:16px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}',
    '.he-balance-surplus{background:linear-gradient(135deg,rgba(52,211,153,.12),rgba(52,211,153,.04));border:1px solid rgba(52,211,153,.2);}',
    '.he-balance-deficit{background:linear-gradient(135deg,rgba(248,113,113,.12),rgba(248,113,113,.04));border:1px solid rgba(248,113,113,.2);}',
    '.he-balance-amount{font-size:2rem;font-weight:900;line-height:1.1;}',
    '.he-balance-surplus .he-balance-amount{color:#34d399;}',
    '.he-balance-deficit .he-balance-amount{color:#f87171;}',
    '.he-balance-breakdown{display:flex;gap:20px;flex-wrap:wrap;}',
    '.he-balance-item-val{font-size:.92rem;font-weight:800;}',
    '.he-balance-item-lbl{font-size:.68rem;color:#64748b;text-transform:uppercase;font-weight:700;}',

    /* Type toggle */
    '.he-type-toggle{display:flex;gap:3px;padding:3px;background:rgba(255,255,255,.06);border-radius:10px;flex-shrink:0;}',
    '.he-type-btn{padding:5px 12px;border:none;border-radius:7px;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .15s;background:none;color:#64748b;font-family:inherit;}',
    '.he-type-btn.active-exp{background:#f87171;color:#fff;}',
    '.he-type-btn.active-inc{background:#34d399;color:#0f2820;}',

    /* Templates */
    '#he-l-templates{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px;min-height:22px;}',
    '.he-tpl-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);font-size:.72rem;font-weight:700;color:#94a3b8;cursor:pointer;transition:all .15s;user-select:none;}',
    '.he-tpl-chip:hover{border-color:rgba(96,165,250,.4);color:#60a5fa;background:rgba(96,165,250,.07);}',
    '.he-tpl-chip-del{color:#475569;margin-left:2px;padding:0 2px;}',
    '.he-tpl-chip-del:hover{color:#f87171;}',
    '.he-tpl-save{padding:4px 10px;border-radius:20px;border:1px dashed rgba(255,255,255,.1);background:none;font-size:.72rem;font-weight:700;color:#475569;cursor:pointer;font-family:inherit;transition:all .15s;}',
    '.he-tpl-save:hover{border-color:rgba(255,255,255,.2);color:#94a3b8;}',
    '.he-sub-badge{display:inline-block;padding:1px 7px;border-radius:8px;background:rgba(251,191,36,.12);color:#fbbf24;font-size:.62rem;font-weight:700;margin-left:4px;}',

    /* Payday */
    '#he-ledger-payday{display:flex;align-items:center;gap:16px;padding:14px 18px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);}',
    '.he-payday-days{font-size:2.2rem;font-weight:900;color:#e5e7eb;line-height:1;min-width:50px;}',
    '.he-payday-meta{font-size:.78rem;color:#64748b;line-height:1.6;}',
    '.he-payday-meta strong{color:#e5e7eb;}',

    /* Goals */
    '#he-goals-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}',
    '.he-goal-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;}',
    '.he-goal-card:hover{border-color:rgba(255,255,255,.15);}',
    '.he-goal-header{display:flex;align-items:center;gap:10px;}',
    '.he-goal-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;}',
    '.he-goal-name{font-weight:800;color:#e5e7eb;font-size:.9rem;flex:1;}',
    '.he-goal-del{background:none;border:none;color:#475569;cursor:pointer;font-size:.85rem;padding:2px 5px;border-radius:4px;}',
    '.he-goal-del:hover{color:#f87171;}',
    '.he-goal-bar-track{height:8px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden;}',
    '.he-goal-bar-fill{height:100%;border-radius:4px;transition:width .5s cubic-bezier(.4,0,.2,1);}',
    '.he-goal-meta{display:flex;justify-content:space-between;font-size:.73rem;color:#64748b;}',
    '.he-goal-meta-pct{font-weight:800;color:#e5e7eb;}',

    /* 6-month chart */
    '#he-6mo-chart{display:flex;align-items:flex-end;gap:8px;height:130px;padding-bottom:4px;}',
    '.he-mo-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;height:100%;}',
    '.he-mo-bar{width:100%;border-radius:4px 4px 0 0;min-height:2px;transition:height .4s cubic-bezier(.4,0,.2,1);}',
    '.he-mo-bar-lbl{font-size:.6rem;color:#64748b;font-weight:700;}',
    '.he-mo-bar-val{font-size:.58rem;color:#94a3b8;white-space:nowrap;}',

    /* Calendar heatmap */
    '#he-cal-heatmap{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}',
    '.he-cal-dh{font-size:.58rem;font-weight:800;color:#475569;text-align:center;padding:3px 0;}',
    '.he-cal-dc{aspect-ratio:1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:600;}',
    '.he-cal-dc.he-cx0{background:rgba(255,255,255,.04);color:#475569;}',
    '.he-cal-dc.he-cx1{background:rgba(251,191,36,.15);color:#fbbf24;}',
    '.he-cal-dc.he-cx2{background:rgba(251,191,36,.3);color:#f59e0b;}',
    '.he-cal-dc.he-cx3{background:rgba(248,113,113,.25);color:#ef4444;}',
    '.he-cal-dc.he-cx4{background:rgba(248,113,113,.55);color:#fff;}',
    '.he-cal-dc.empty{background:none;}',

    /* Mobile */
    '@media(max-width:600px){'+
    /* Command palette / keyboard shortcuts */
    '#he-cmd-box{margin:0 10px}#he-keys-box{padding:20px}'+
    /* Ledger overlay: safe-area-aware top padding for notch/Dynamic Island */
    '#he-ledger-topbar{padding:calc(env(safe-area-inset-top,0px) + 12px) 16px 12px}'+
    '#he-ledger-topbar h2{font-size:.95rem}'+
    '#he-ledger-view{padding:12px 10px}'+
    /* Add entry form: stack inputs vertically */
    '.he-ledger-add-row{flex-direction:column;gap:6px}'+
    '.he-ledger-input{width:100%!important;box-sizing:border-box!important;min-width:unset!important}'+
    '.he-ledger-input-note{min-width:unset!important}'+
    '.he-ledger-add-btn{width:100%;padding:10px 0;text-align:center}'+
    /* Filters row */
    '#he-ledger-filters{gap:6px}'+
    '.he-ledger-filter{flex:1;min-width:0}'+
    /* Nav tabs: tighter */
    '.he-lnav-btn{padding:8px 8px;font-size:.75rem}'+
    /* Table: tighter cells */
    '#he-ledger-table td,#he-ledger-table th{padding:8px 8px;font-size:.78rem}'+
    /* Overview sections */
    '#he-ledger-insights{flex-direction:column}'+
    '#he-6mo-chart{height:90px}'+
    '#he-goals-grid{grid-template-columns:1fr}'+
    '#he-ledger-balance{flex-direction:column;align-items:flex-start}'+
    '.he-balance-amount{font-size:1.6rem}'+
    /* Sync badge: keep above chin bar */
    '#he-sync-badge{bottom:calc(var(--tb,64px) + env(safe-area-inset-bottom,0px) + 8px)!important}'+
    /* Toasts: above FABs and chin bar */
    '#homer-toasts{bottom:calc(var(--tb,64px) + env(safe-area-inset-bottom,0px) + 72px)!important;right:12px!important;max-width:calc(100vw - 24px)!important}'+
    '}'
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
    initMobileSheetActions();
    initWideMobileNav();
    initFabTray();
    initMobileFabFix();
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
    initJoeyCommandBridge();
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
        '<button class="sb-item he-sb-action he-sb-inbox" id="he-sb-inbox-btn" title="Inbox">'+
          svgInbox+'<span class="sb-label">Inbox</span>'+
        '</button>';

      sidebar.insertBefore(section,spacer);

      // Wire up clicks
      document.getElementById('he-sb-capture-btn').addEventListener('click',function(){
        clickEl('homer-capture-btn');
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
    // Do NOT gate on isBogdan() here — session is async on mobile.
    // All sync operations use canSync() which is evaluated lazily.

    var badge=document.createElement('div');badge.id='he-sync-badge';document.body.appendChild(badge);
    function showBadge(txt,cls){badge.className=cls;badge.textContent=txt;badge.classList.add('visible');if(cls==='synced')setTimeout(function(){badge.classList.remove('visible');},3000);}

    // nativeSetItem = Storage prototype directly — bypasses ALL patches (ours + app-shell's).
    // Used for internal writes (pulls, timestamps) so they don't trigger R2 dirty-marking.
    // origSetItem = app-shell's patched version — used for user-write forwarding so the
    // app-shell's LS_FIELD_MAP sync and R2 dirty-marking still fire for actual user changes.
    var nativeSetItem=Storage.prototype.setItem.bind(localStorage);
    var origSetItem=localStorage.setItem.bind(localStorage);

    function getClient(){return window.__supabase||null;}
    function getUid(){return window.__sbSession&&window.__sbSession.user&&window.__sbSession.user.id||null;}
    function canSync(){return isBogdan()&&!!getUid();}
    function getLocalTs(key){return parseInt(localStorage.getItem('_he_ts_'+key)||'0',10);}
    function setLocalTs(key,ts){nativeSetItem('_he_ts_'+key,String(ts));}

    function pushKey(key){
      if(!canSync())return;
      var client=getClient(),uid=getUid();if(!client||!uid)return;
      var val=localStorage.getItem(key);if(val===null)return;
      // Embed timestamp inside the stored value so any device can compare freshness
      var ts=getLocalTs(key)||Date.now();
      showBadge('Syncing\u2026','syncing');
      client.from('field_state').upsert({key:'he_'+key,value:JSON.stringify({_ts:ts,_data:val}),user_id:uid},{onConflict:'key,user_id'})
        .then(function(r){
          if(r.error)showBadge('Sync error','error');
          else{delete _syncDirty[key];showBadge('Synced \u2713','synced');}
        }).catch(function(){showBadge('Sync error','error');});
    }

    function pullKey(key){
      if(!canSync())return;
      var client=getClient(),uid=getUid();if(!client||!uid)return;
      client.from('field_state').select('value').eq('key','he_'+key).eq('user_id',uid).maybeSingle()
        .then(function(r){
          if(!r.data||!r.data.value)return;
          var parsed=safeJson(r.data.value,null);
          // Support new {_ts,_data} format AND legacy plain-JSON values
          var remoteTs=parsed&&typeof parsed._ts==='number'?parsed._ts:0;
          var remoteData=parsed&&typeof parsed._ts==='number'?parsed._data:r.data.value;
          var localTs=getLocalTs(key);
          if(remoteTs>localTs||(localTs===0&&remoteData)){
            // Remote is newer (or no local timestamp yet — trust remote on first sync)
            nativeSetItem(key,remoteData);     // native write: bypasses all patches
            setLocalTs(key,remoteTs||Date.now());
          }else if(localTs>remoteTs){
            // Local is newer — push it next cycle
            markDirty(key);
          }
        })
        .catch(function(){});
    }

    var SYNC_KEYS=['homer-expenses','homer-income','homer-expense-goals','homer-expense-templates','homer-expense-budgets','homer-habits','homer-inbox','homer-payday-day'];

    var _pullDone=false;
    function pullAll(){
      if(!canSync())return;
      var firstPull=!_pullDone;
      _pullDone=true;
      SYNC_KEYS.forEach(pullKey);
      if(firstPull){
        // After first pull, signal vault components to re-read IDB.
        // This catches the case where the vault was loaded before a restore
        // and still shows stale cached data in memory.
        setTimeout(function(){window.dispatchEvent(new Event('vault-goals-changed'));},700);
      }
    }
    function markDirty(key){_syncDirty[key]=true;}
    function pushDirty(){if(!canSync())return;Object.keys(_syncDirty).forEach(pushKey);}

    // Primary trigger: fires when persisted session restores (async on mobile)
    window.addEventListener('supabase:session',function(e){
      if(e.detail&&!_pullDone&&isBogdan())pullAll();
    });
    if(canSync())pullAll();
    setTimeout(function(){if(!_pullDone&&canSync())pullAll();},1500);
    setTimeout(function(){if(!_pullDone&&canSync())pullAll();},5000);

    // Patch setItem: record write timestamp + mark dirty for our SYNC_KEYS.
    // Forwards through origSetItem (app-shell's patch) so LS_FIELD_MAP ops and
    // R2 dirty-marking still fire for the app-shell's own tracked keys.
    localStorage.setItem=function(key,val){
      origSetItem(key,val);
      if(SYNC_KEYS.indexOf(key)!==-1){
        setLocalTs(key,Date.now());  // anchor this write in time (native, no side-effects)
        markDirty(key);
      }
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

  /* ── Mobile FAB positioning ─────────────────────────────────────────── */
  /* The app-shell mobile nav uses (hover:none)and(pointer:coarse) media   */
  /* query which is independent of our max-width breakpoints. Use JS to    */
  /* measure the actual #mobile-nav rect and position FABs above it.       */
  function initMobileFabFix(){
    function reposition(){
      var nav=document.getElementById('mobile-nav');
      if(!nav)return;
      if(getComputedStyle(nav).display==='none')return;
      var rect=nav.getBoundingClientRect();
      if(rect.height<1){
        // Layout not ready yet — retry next frame
        requestAnimationFrame(reposition);
        return;
      }
      // Measure actual nav top so tray clears the chin bar on all devices
      var clearance=Math.ceil(window.innerHeight-rect.top)+10;
      var tray=document.getElementById('he-fab-tray');
      if(tray)tray.style.setProperty('bottom',clearance+'px','important');
    }
    // #mobile-nav is static HTML — always present. Use RAF to ensure first
    // layout pass is complete before reading getBoundingClientRect.
    requestAnimationFrame(reposition);
    setTimeout(reposition,400);   // belt-and-suspenders for slow paints
    setTimeout(reposition,1500);  // catch late CSS paint on low-end devices
    window.addEventListener('resize',reposition);
    window.addEventListener('orientationchange',function(){setTimeout(reposition,250);});
  }

  /* ── Mobile Sheet Quick Actions ──────────────────────────────────────── */
  /* Wires up the Quick Actions grid added to #mobile-sheet in index.html.  */
  /* Lives inside the More sheet — zero floating elements, no chin-bar risk. */
  function initMobileSheetActions(){
    var sheet=document.getElementById('mobile-sheet');
    var map={
      'msheet-qa-capture': function(){ clickEl('homer-capture-btn'); },
      'msheet-qa-budget':  function(){ openLedger(); },
      'msheet-qa-inbox':   function(){ if(typeof window._homerOpenInbox==='function')window._homerOpenInbox(); },
      'msheet-qa-habits':  function(){ clickEl('homer-habits-fab'); },
    };
    Object.keys(map).forEach(function(id){
      var el=document.getElementById(id);
      if(!el)return;
      el.addEventListener('click',function(){
        if(sheet)sheet.classList.remove('open');
        map[id]();
      });
    });
  }

  /* ── Wide-phone mobile nav binding ─────────────────────────────────────
   * app-shell's IIFE exits early when innerWidth > 480, so phones at
   * 481-600px (e.g. Pixel 10 Pro) never get the More/tab/sheet bindings.
   * This function fills that gap for any body.mobile-shell device.       */
  function initWideMobileNav(){
    if(!document.body.classList.contains('mobile-shell')) return;
    if(window.innerWidth <= 480) return; // already handled by app-shell IIFE
    var nav=document.getElementById('mobile-nav');
    var sheet=document.getElementById('mobile-sheet');
    if(!nav||!sheet) return;

    function closeJoey(){ if(typeof window._homerCloseJoeyPanel==='function') window._homerCloseJoeyPanel(); }
    function toggleJoey(){ if(typeof window._homerToggleJoeyPanel==='function') window._homerToggleJoeyPanel(); }
    function isJoeyOpen(){ return typeof window._homerIsJoeyOpen==='function' && window._homerIsJoeyOpen(); }
    function syncActive(tab,panelOpen){
      nav.querySelectorAll('.mnav-btn').forEach(function(b){
        var active=panelOpen ? b.id==='mnav-joey' : (tab ? b.dataset.tab===tab : false);
        if(b.id==='mnav-more' && sheet.classList.contains('open')) active=true;
        b.classList.toggle('active',active);
      });
    }

    // Tab buttons
    nav.querySelectorAll('.mnav-btn[data-tab]').forEach(function(btn){
      btn.addEventListener('click',function(){
        closeJoey();
        if(typeof showTab==='function') showTab(btn.dataset.tab);
        sheet.classList.remove('open');
        syncActive(btn.dataset.tab,false);
        window.scrollTo(0,0);
      });
    });

    // Joey button
    var joeyBtn=document.getElementById('mnav-joey');
    if(joeyBtn && !joeyBtn.dataset.joeyBound){
      joeyBtn.dataset.joeyBound='wide';
      joeyBtn.addEventListener('click',function(){
        sheet.classList.remove('open');
        toggleJoey();
      });
    }

    // More → toggle sheet
    var moreBtn=document.getElementById('mnav-more');
    if(moreBtn){
      moreBtn.addEventListener('click',function(){
        sheet.classList.toggle('open');
        syncActive(document.body.dataset.activeTab||'home',isJoeyOpen());
      });
    }

    // Sheet tab items
    sheet.querySelectorAll('.msheet-item[data-tab]').forEach(function(item){
      item.addEventListener('click',function(){
        closeJoey();
        if(typeof showTab==='function') showTab(item.dataset.tab);
        sheet.classList.remove('open');
        syncActive(item.dataset.tab,false);
        window.scrollTo(0,0);
      });
    });

    // Backdrop tap closes sheet
    sheet.addEventListener('click',function(e){
      if(e.target===sheet){
        sheet.classList.remove('open');
        syncActive(document.body.dataset.activeTab||'home',isJoeyOpen());
      }
    });
  }

  /* ── Mobile System Tray — reparents floating FABs into a centered pill above the nav bar */
  function initFabTray(){
    // Build tray structure: [extras…] | [sep] | [⋯ more]
    // Primary actions (capture, pomo) are prepended before the separator;
    // secondary actions (habits, expense, brief, memory) go inside #he-fab-extras.
    var tray=document.createElement('div');
    tray.id='he-fab-tray';

    var extrasEl=document.createElement('div');
    extrasEl.id='he-fab-extras';

    var sep=document.createElement('div');
    sep.id='he-fab-tray-sep';

    var moreBtn=document.createElement('button');
    moreBtn.id='he-fab-more';
    moreBtn.className='he-fab';
    moreBtn.title='Quick Actions';
    moreBtn.innerHTML='&#8943;';

    tray.appendChild(extrasEl);
    tray.appendChild(sep);
    tray.appendChild(moreBtn);
    document.body.appendChild(tray);

    // Toggle extras on ⋯ click
    var extrasOpen=false;
    moreBtn.addEventListener('click',function(e){
      e.stopPropagation();
      extrasOpen=!extrasOpen;
      extrasEl.classList.toggle('open',extrasOpen);
      moreBtn.innerHTML=extrasOpen?'&times;':'&#8943;';
    });
    // Close on tap outside tray
    document.addEventListener('click',function(e){
      if(extrasOpen&&!tray.contains(e.target)){
        extrasOpen=false;
        extrasEl.classList.remove('open');
        moreBtn.innerHTML='&#8943;';
      }
    });

    // Reparent FABs from document.body into the tray.
    // Primary (always visible) go before the separator; secondary go in extras.
    var REPARENT=[
      {id:'homer-capture-btn',always:true},
      {id:'homer-expense-fab',always:true},   // budgeting replaces pomo as primary
      {id:'homer-pomo-fab',   always:false},
      {id:'homer-habits-fab', always:false},
      {id:'homer-brief-fab',  always:false},
      {id:'homer-memory-fab', always:false},
    ];
    function tryReparent(){
      REPARENT.forEach(function(cfg){
        var el=document.getElementById(cfg.id);
        if(!el||el.dataset.heParented)return;
        el.dataset.heParented='1';
        el.style.cssText=''; // clear any inline bottom/left/right set by older code
        el.classList.add('he-fab');
        if(cfg.always){
          tray.insertBefore(el,sep); // prepend before separator
        }else{
          extrasEl.appendChild(el);
        }
      });
    }
    tryReparent();
    setTimeout(tryReparent,600);
    setTimeout(tryReparent,1500);
    // Watch for FABs that are created after this script runs
    new MutationObserver(tryReparent).observe(document.body,{childList:true,subtree:false});
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 16. EXPENSE LEDGER  (multi-view: Overview / Transactions / Goals / Reports)
   * ═══════════════════════════════════════════════════════════════════ */
  var _ledgerOpen=false;
  var _ledgerView='overview';
  var _txType='expense';
  var _sortCol='date',_sortDir=-1;

  var CAT_COLOR={food:'#fb7185',transport:'#fbbf24',work:'#60a5fa',health:'#34d399',entertainment:'#a78bfa',other:'#94a3b8'};
  var CAT_LABEL={food:'Food',transport:'Transport',work:'Work',health:'Health',entertainment:'Entertainment',other:'Other'};
  var CAT_ICON ={food:'&#x1F354;',transport:'&#x1F697;',work:'&#x1F4BC;',health:'&#x1F3E5;',entertainment:'&#x1F3AC;',other:'&#x1F4E6;'};
  var GOAL_COLORS=['#3b82f6','#34d399','#f87171','#fbbf24','#a78bfa','#fb7185','#60a5fa'];
  var BUDGET_KEY='homer-expense-budgets';
  var DEFAULT_BUDGETS={food:1500,transport:400,work:500,health:300,entertainment:300,other:200};

  /* Data helpers */
  function getExpenses(){return safeJson(localStorage.getItem('homer-expenses'),[]); }
  function saveExpenses(a){localStorage.setItem('homer-expenses',JSON.stringify(a));}
  function getIncome(){return safeJson(localStorage.getItem('homer-income'),[]);}
  function saveIncome(a){localStorage.setItem('homer-income',JSON.stringify(a));}
  function getBudgets(){return safeJson(localStorage.getItem(BUDGET_KEY),Object.assign({},DEFAULT_BUDGETS));}
  function saveBudgets(b){try{localStorage.setItem(BUDGET_KEY,JSON.stringify(b));}catch(_){}}
  function getGoals(){return safeJson(localStorage.getItem('homer-expense-goals'),[]);}
  function saveGoals(a){localStorage.setItem('homer-expense-goals',JSON.stringify(a));}
  function getTemplates(){return safeJson(localStorage.getItem('homer-expense-templates'),[]);}
  function saveTemplates(a){localStorage.setItem('homer-expense-templates',JSON.stringify(a));}

  /* ── Open / Build ─────────────────────────────────────────────── */
  function openLedger(prefill){
    var ov=document.getElementById('he-ledger-ov');
    if(ov){ov.classList.remove('hidden');_ledgerOpen=true;if(prefill)applyLedgerPrefill(ov,prefill);else refreshLedgerView();return;}
    buildLedger(prefill);
  }

  function buildLedger(prefill){
    var ov=document.createElement('div');ov.id='he-ledger-ov';ov.classList.add('hidden');
    ov.innerHTML=
      '<div id="he-ledger-topbar">'+
        '<h2>&#x1F4CA; Expense Ledger</h2>'+
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'+
          '<button id="he-ledger-export">&#x2B07; CSV</button>'+
          '<button id="he-ledger-close">&#x2715; Close</button>'+
        '</div>'+
      '</div>'+
      '<nav id="he-ledger-nav">'+
        '<button class="he-lnav-btn active" data-view="overview">&#x1F3E0; Overview</button>'+
        '<button class="he-lnav-btn" data-view="transactions">&#x1F4CB; Transactions</button>'+
        '<button class="he-lnav-btn" data-view="goals">&#x1F3AF; Goals</button>'+
        '<button class="he-lnav-btn" data-view="reports">&#x1F4C8; Reports</button>'+
      '</nav>'+
      '<div id="he-ledger-view"></div>';
    document.body.appendChild(ov);

    ov.querySelectorAll('.he-lnav-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        ov.querySelectorAll('.he-lnav-btn').forEach(function(b){b.classList.remove('active');});
        btn.classList.add('active');_ledgerView=btn.dataset.view;refreshLedgerView();
      });
    });
    document.getElementById('he-ledger-close').addEventListener('click',function(){ov.classList.add('hidden');_ledgerOpen=false;});
    document.getElementById('he-ledger-export').addEventListener('click',exportCSV);
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&_ledgerOpen){ov.classList.add('hidden');_ledgerOpen=false;}});

    ov.classList.remove('hidden');_ledgerOpen=true;
    if(prefill){applyLedgerPrefill(ov,prefill);}else{refreshLedgerView();}
  }

  function refreshLedgerView(){
    var view=document.getElementById('he-ledger-view');if(!view)return;
    if(_ledgerView==='overview')renderOverview(view);
    else if(_ledgerView==='transactions')renderTransactions(view);
    else if(_ledgerView==='goals')renderGoalsView(view);
    else if(_ledgerView==='reports')renderReports(view);
  }

  function applyLedgerPrefill(ov,prefill){
    _ledgerView='transactions';
    ov.querySelectorAll('.he-lnav-btn').forEach(function(b){b.classList.toggle('active',b.dataset.view==='transactions');});
    refreshLedgerView();
    setTimeout(function(){
      _txType='expense';
      var d=document.getElementById('he-l-desc');if(d&&prefill.desc)d.value=prefill.desc;
      var a=document.getElementById('he-l-amt');if(a&&prefill.amount)a.value=prefill.amount;
      if(d)d.focus();
    },80);
  }

  /* ── OVERVIEW VIEW ────────────────────────────────────────────── */
  function renderOverview(view){
    var expenses=getExpenses(),income=getIncome();
    var mo=new Date().toISOString().slice(0,7);
    var thisExp=expenses.filter(function(e){return(e.date||'').startsWith(mo);});
    var thisInc=income.filter(function(e){return(e.date||'').startsWith(mo);});
    var totalExp=thisExp.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    var totalInc=thisInc.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    var balance=totalInc-totalExp,surplus=balance>=0;

    var html=
      '<div id="he-ledger-balance" class="'+(surplus?'he-balance-surplus':'he-balance-deficit')+'">'+
        '<div>'+
          '<div style="font-size:.68rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Monthly Balance</div>'+
          '<div class="he-balance-amount">'+(surplus?'+':'')+balance.toFixed(0)+' RON</div>'+
          '<div style="font-size:.78rem;color:#64748b;margin-top:4px;">'+(totalInc>0?(surplus?'&#x2705; Surplus':'&#x26A0;&#xFE0F; Over budget'):'No income tracked — add via Transactions')+'</div>'+
        '</div>'+
        '<div class="he-balance-breakdown">'+
          '<div><div class="he-balance-item-val" style="color:#34d399">&#x2B06; '+totalInc.toFixed(0)+'</div><div class="he-balance-item-lbl">Income RON</div></div>'+
          '<div><div class="he-balance-item-val" style="color:#f87171">&#x2B07; '+totalExp.toFixed(0)+'</div><div class="he-balance-item-lbl">Expenses RON</div></div>'+
        '</div>'+
      '</div>'+
      '<div id="he-ledger-insights"></div>';

    // Payday
    var pd=parseInt(localStorage.getItem('homer-payday-day')||'0',10);
    var now=new Date(),dom=now.getDate();
    if(pd>0){
      var until=pd>=dom?pd-dom:(new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-dom+pd);
      html+='<div id="he-ledger-payday">'+
        '<div class="he-payday-days">'+until+'</div>'+
        '<div><div class="he-payday-meta"><strong>days until payday</strong></div>'+
          '<div class="he-payday-meta">Day '+pd+' each month &nbsp;'+
            '<button id="he-payday-clr" style="background:none;border:none;color:#475569;cursor:pointer;font-size:.72rem;font-family:inherit;">change</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    } else {
      html+='<div style="font-size:.78rem;color:#475569;padding:2px 0;">'+
        '&#x1F4C5; <button id="he-payday-set" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:.78rem;font-family:inherit;font-weight:700;">Set payday date</button> for a countdown</div>';
    }

    html+='<div id="he-ledger-budgets"></div>';

    // Recent
    var recent=expenses.slice(-5).reverse();
    html+='<div><div style="font-size:.72rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Recent Expenses</div>';
    if(!recent.length){
      html+='<div style="color:#475569;font-size:.84rem;">No expenses yet — add them in Transactions.</div>';
    } else {
      html+=recent.map(function(e){
        var c=e.cat||'other',col=CAT_COLOR[c]||'#94a3b8';
        return'<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);">'+
          '<span>'+CAT_ICON[c]+'</span>'+
          '<span style="flex:1;font-size:.84rem;color:#cbd5e1;">'+esc(e.desc||'')+'</span>'+
          '<span style="font-size:.75rem;color:#64748b;margin-right:8px;">'+esc(e.date||'')+'</span>'+
          '<span style="font-weight:800;color:#e5e7eb;font-size:.88rem;">'+parseFloat(e.amount||0).toFixed(2)+' RON</span>'+
        '</div>';
      }).join('');
    }
    html+='</div>';

    view.innerHTML=html;
    renderInsights(expenses);
    renderBudgets(expenses);
    var sb=document.getElementById('he-payday-set'),cb=document.getElementById('he-payday-clr');
    if(sb)sb.addEventListener('click',promptPayday);
    if(cb)cb.addEventListener('click',promptPayday);
  }

  function promptPayday(){
    var v=window.prompt('Payday day of the month (1–31):','25');
    if(!v)return;var n=parseInt(v,10);
    if(isNaN(n)||n<1||n>31){toast('Day must be 1–31','warn');return;}
    localStorage.setItem('homer-payday-day',String(n));
    refreshLedgerView();toast('Payday set to day '+n,'success',2000);
  }

  /* ── TRANSACTIONS VIEW ────────────────────────────────────────── */
  function renderTransactions(view){
    var CAT_OPTS=['food','transport','work','health','entertainment','other'].map(function(c){return'<option value="'+c+'">'+CAT_LABEL[c]+'</option>';}).join('');
    view.innerHTML=
      '<div id="he-ledger-add">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">'+
          '<div style="font-size:.72rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Add Entry</div>'+
          '<div class="he-type-toggle">'+
            '<button class="he-type-btn '+(_txType==='expense'?'active-exp':'')+'" id="he-tx-exp-btn">&#x2B07; Expense</button>'+
            '<button class="he-type-btn '+(_txType==='income'?'active-inc':'')+'" id="he-tx-inc-btn">&#x2B06; Income</button>'+
          '</div>'+
        '</div>'+
        '<div id="he-l-templates"></div>'+
        '<div class="he-ledger-add-row">'+
          '<input type="text" id="he-l-desc" class="he-ledger-input he-ledger-input-desc" placeholder="Description *">'+
          '<input type="number" id="he-l-amt" class="he-ledger-input he-ledger-input-amt" placeholder="Amount (RON) *" min="0" step="0.01">'+
          '<select id="he-l-cat" class="he-ledger-input he-ledger-input-cat" style="'+(_txType==='income'?'display:none':'')+'">'+CAT_OPTS+'</select>'+
          '<input type="date" id="he-l-date" class="he-ledger-input he-ledger-input-date">'+
          '<input type="text" id="he-l-note" class="he-ledger-input he-ledger-input-note" placeholder="Note (optional)">'+
          '<button id="he-l-add-btn" class="he-ledger-add-btn" style="'+(_txType==='income'?'background:#34d399;color:#0f2820':'')+'">+ Add</button>'+
        '</div>'+
      '</div>'+
      '<div id="he-ledger-filters">'+
        '<select id="he-l-fmo" class="he-ledger-filter"></select>'+
        '<select id="he-l-fcat" class="he-ledger-filter" style="'+(_txType==='income'?'display:none':'')+'"><option value="">All categories</option>'+CAT_OPTS+'</select>'+
        '<input type="search" id="he-l-fsearch" class="he-ledger-input" placeholder="&#x1F50D; Search — try: food, over 100, last week, today" style="flex:1;min-width:150px">'+
      '</div>'+
      '<div id="he-ledger-summary"></div>'+
      '<div id="he-ledger-table-wrap">'+
        '<table id="he-ledger-table"><thead><tr>'+
          '<th data-col="date">Date<span class="he-th-arrow"></span></th>'+
          '<th data-col="cat" style="'+(_txType==='income'?'display:none':'')+'">Category<span class="he-th-arrow"></span></th>'+
          '<th data-col="desc">Description<span class="he-th-arrow"></span></th>'+
          '<th>Note</th>'+
          '<th data-col="amount" style="text-align:right">Amount<span class="he-th-arrow"></span></th>'+
          '<th style="width:32px"></th>'+
        '</tr></thead><tbody id="he-ledger-body-rows"></tbody></table>'+
      '</div>'+
      '<div id="he-ledger-inbox">'+
        '<h3>&#x1F4E5; Inbox Captures <span style="font-weight:400;font-size:.75rem;color:#475569">(unprocessed)</span></h3>'+
        '<div id="he-ledger-inbox-items"></div>'+
      '</div>';

    document.getElementById('he-l-date').value=new Date().toISOString().slice(0,10);
    document.getElementById('he-tx-exp-btn').addEventListener('click',function(){_txType='expense';renderTransactions(view);});
    document.getElementById('he-tx-inc-btn').addEventListener('click',function(){_txType='income';renderTransactions(view);});
    document.getElementById('he-l-add-btn').addEventListener('click',function(){addEntry(view);});
    ['he-l-desc','he-l-amt'].forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('keydown',function(e){if(e.key==='Enter')addEntry(view);});});
    document.getElementById('he-ledger-table').querySelectorAll('th[data-col]').forEach(function(th){
      th.addEventListener('click',function(){if(_sortCol===th.dataset.col)_sortDir*=-1;else{_sortCol=th.dataset.col;_sortDir=-1;}renderTxTable();});
    });
    ['he-l-fmo','he-l-fcat'].forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('change',renderTxTable);});
    document.getElementById('he-l-fsearch').addEventListener('input',renderTxTable);
    buildMonthFilter();
    renderTemplates();
    renderTxTable();
    renderLedgerInbox();
  }

  function addEntry(view){
    var desc=(document.getElementById('he-l-desc')||{}).value||'';
    var amt=parseFloat((document.getElementById('he-l-amt')||{}).value);
    var note=((document.getElementById('he-l-note')||{}).value||'').trim();
    var date=(document.getElementById('he-l-date')||{}).value||new Date().toISOString().slice(0,10);
    desc=desc.trim();
    if(!desc||isNaN(amt)||amt<=0){toast('Enter description and a positive amount','warn');return;}
    if(_txType==='income'){
      var inc=getIncome();inc.push({id:Date.now(),desc:desc,amount:amt,date:date,note:note||undefined});
      saveIncome(inc);toast('Income logged &#x2B06; '+amt.toFixed(2)+' RON','success',2000);
    } else {
      var cat=(document.getElementById('he-l-cat')||{}).value||'other';
      var exp=getExpenses();exp.push({id:Date.now(),desc:desc,amount:amt,cat:cat,date:date,note:note||undefined});
      saveExpenses(exp);toast('Expense added','success',1800);
    }
    document.getElementById('he-l-desc').value='';document.getElementById('he-l-amt').value='';
    var ne=document.getElementById('he-l-note');if(ne)ne.value='';
    buildMonthFilter();renderTxTable();
  }

  function buildMonthFilter(){
    var all=getExpenses().concat(getIncome());
    var months=Array.from(new Set(all.map(function(e){return(e.date||'').slice(0,7);}).filter(Boolean))).sort().reverse();
    var sel=document.getElementById('he-l-fmo');if(!sel)return;
    var cur=sel.value;
    sel.innerHTML='<option value="">All months</option>'+months.map(function(m){var d=new Date(m+'-01');return'<option value="'+m+'">'+d.toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</option>';}).join('');
    if(cur)sel.value=cur;
  }

  function renderTxTable(){
    var tbody=document.getElementById('he-ledger-body-rows');if(!tbody)return;
    var fmo=(document.getElementById('he-l-fmo')||{}).value||'';
    var fcat=(document.getElementById('he-l-fcat')||{}).value||'';
    var q=((document.getElementById('he-l-fsearch')||{}).value||'').trim();
    var subs=detectSubscriptions(getExpenses());var subSet={};subs.forEach(function(s){subSet[s.desc.toLowerCase()]=true;});

    var raw=_txType==='income'?getIncome().map(function(e){return Object.assign({_t:'income',cat:'income'},e);}):getExpenses().map(function(e){return Object.assign({_t:'expense'},e);});
    raw=raw.filter(function(e){if(fmo&&!(e.date||'').startsWith(fmo))return false;if(fcat&&_txType!=='income'&&(e.cat||'other')!==fcat)return false;return true;});
    if(q)raw=naturalLanguageFilter(raw,q);
    raw.sort(function(a,b){var av=_sortCol==='amount'?parseFloat(a.amount||0):String(a[_sortCol]||'');var bv=_sortCol==='amount'?parseFloat(b.amount||0):String(b[_sortCol]||'');return av<bv?-_sortDir:av>bv?_sortDir:0;});

    var total=raw.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    var sumEl=document.getElementById('he-ledger-summary');
    if(sumEl){
      var bycat={};raw.forEach(function(e){var c=e.cat||'other';bycat[c]=(bycat[c]||0)+(parseFloat(e.amount)||0);});
      var topCat=Object.keys(bycat).sort(function(a,b){return bycat[b]-bycat[a];})[0];
      var sh='<div class="he-ledger-stat"><div class="he-ledger-stat-val">'+total.toFixed(2)+' RON</div><div class="he-ledger-stat-lbl">Total</div></div>'+
        '<div class="he-ledger-stat"><div class="he-ledger-stat-val">'+raw.length+'</div><div class="he-ledger-stat-lbl">Entries</div></div>';
      if(topCat&&_txType!=='income')sh+='<div class="he-ledger-stat"><div class="he-ledger-stat-val">'+bycat[topCat].toFixed(0)+' RON</div><div class="he-ledger-stat-lbl">Top: '+(CAT_LABEL[topCat]||topCat)+'</div></div>';
      sumEl.innerHTML=sh;
    }

    if(!raw.length){tbody.innerHTML='<tr><td colspan="6" class="he-ledger-empty">No entries match.</td></tr>';return;}
    tbody.innerHTML=raw.map(function(e){
      var isInc=e._t==='income';var cat=e.cat||'other';var col=isInc?'#34d399':(CAT_COLOR[cat]||'#94a3b8');
      var isSub=!isInc&&subSet[(e.desc||'').toLowerCase()];
      return'<tr data-id="'+e.id+'" data-t="'+e._t+'">'+
        '<td>'+esc(e.date||'')+'</td>'+
        (isInc?'<td><span class="he-ledger-cat-pill" style="background:rgba(52,211,153,.15);color:#34d399">Income</span></td>':'<td><span class="he-ledger-cat-pill" style="background:'+col+'22;color:'+col+'">'+esc(CAT_LABEL[cat]||cat)+'</span></td>')+
        '<td>'+esc(e.desc||'')+(isSub?'<span class="he-sub-badge">&#x1F501;</span>':'')+'</td>'+
        '<td class="he-ledger-note-cell">'+esc(e.note||'')+'</td>'+
        '<td style="text-align:right;font-weight:700;color:'+(isInc?'#34d399':'')+';">'+(isInc?'+':'')+parseFloat(e.amount||0).toFixed(2)+'</td>'+
        '<td><button class="he-ledger-del" title="Delete">&#xD7;</button></td>'+
      '</tr>';
    }).join('');
    tbody.querySelectorAll('.he-ledger-del').forEach(function(btn){
      btn.addEventListener('click',function(){
        var tr=btn.closest('tr');var id=parseInt(tr.dataset.id,10);
        if(tr.dataset.t==='income'){saveIncome(getIncome().filter(function(e){return e.id!==id;}));}
        else{saveExpenses(getExpenses().filter(function(e){return e.id!==id;}));}
        renderTxTable();toast('Deleted','info',1500);
      });
    });
  }

  /* ── Templates ──────────────────────────────────────────────────── */
  function renderTemplates(){
    var wrap=document.getElementById('he-l-templates');if(!wrap)return;
    var ts=getTemplates();
    var chips=ts.map(function(t,i){
      return'<span class="he-tpl-chip" data-idx="'+i+'">'+esc(t.desc)+' · <strong>'+parseFloat(t.amount||0).toFixed(0)+' RON</strong>'+
        '<span class="he-tpl-chip-del" data-di="'+i+'"> &#xD7;</span></span>';
    }).join('');
    wrap.innerHTML=chips+'<button class="he-tpl-save" id="he-tpl-save-btn">+ Save template</button>';
    wrap.querySelectorAll('.he-tpl-chip').forEach(function(chip){
      chip.addEventListener('click',function(e){
        if(e.target.dataset.di!==undefined){var di=parseInt(e.target.dataset.di,10);var t2=getTemplates();t2.splice(di,1);saveTemplates(t2);renderTemplates();return;}
        var t=getTemplates()[parseInt(chip.dataset.idx,10)];if(!t)return;
        var d=document.getElementById('he-l-desc');if(d)d.value=t.desc||'';
        var a=document.getElementById('he-l-amt');if(a)a.value=t.amount||'';
        var c=document.getElementById('he-l-cat');if(c&&t.cat)c.value=t.cat;
        var n=document.getElementById('he-l-note');if(n)n.value=t.note||'';
      });
    });
    var sb=document.getElementById('he-tpl-save-btn');
    if(sb)sb.addEventListener('click',function(){
      var desc=(document.getElementById('he-l-desc')||{}).value||'';
      var amt=parseFloat((document.getElementById('he-l-amt')||{}).value);
      if(!desc.trim()||isNaN(amt)||amt<=0){toast('Fill description + amount first','warn');return;}
      var ts2=getTemplates();ts2.push({id:Date.now(),desc:desc.trim(),amount:amt,cat:(document.getElementById('he-l-cat')||{}).value||'other',note:((document.getElementById('he-l-note')||{}).value||'').trim()||undefined});
      saveTemplates(ts2);renderTemplates();toast('Template saved','success',1800);
    });
  }

  /* ── GOALS VIEW ─────────────────────────────────────────────────── */
  function renderGoalsView(view){
    var gs=getGoals();
    var GCOL_OPTS=GOAL_COLORS.map(function(c,i){return'<option value="'+c+'">'+((['Blue','Green','Red','Gold','Purple','Pink','Sky'])[i])+'</option>';}).join('');
    var html=
      '<div class="he-goal-add-form">'+
        '<div style="font-size:.72rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">New Savings Goal</div>'+
        '<div class="he-ledger-add-row">'+
          '<input type="text" id="he-goal-name" class="he-ledger-input" style="flex:2;min-width:130px;" placeholder="Goal name *">'+
          '<input type="number" id="he-goal-target" class="he-ledger-input he-ledger-input-amt" placeholder="Target (RON) *" min="1" step="1">'+
          '<input type="number" id="he-goal-saved" class="he-ledger-input he-ledger-input-amt" placeholder="Already saved">'+
          '<select id="he-goal-color" class="he-ledger-input" style="width:90px;">'+GCOL_OPTS+'</select>'+
          '<button id="he-goal-add-btn" class="he-ledger-add-btn">+ Add</button>'+
        '</div>'+
      '</div>'+
      '<div id="he-goals-grid">';
    if(!gs.length){
      html+='<div style="color:#475569;font-size:.88rem;grid-column:1/-1;padding:16px 0;">No goals yet. Add one above to start saving.</div>';
    } else {
      html+=gs.map(function(g,i){
        var saved=parseFloat(g.saved||0),target=parseFloat(g.target||1);
        var pct=Math.min(saved/target*100,100),left=Math.max(0,target-saved);
        return'<div class="he-goal-card">'+
          '<div class="he-goal-header"><div class="he-goal-dot" style="background:'+esc(g.color||'#3b82f6')+'"></div><div class="he-goal-name">'+esc(g.name||'Goal')+'</div><button class="he-goal-del" data-di="'+i+'">&#xD7;</button></div>'+
          '<div class="he-goal-bar-track"><div class="he-goal-bar-fill" style="width:'+pct.toFixed(1)+'%;background:'+esc(g.color||'#3b82f6')+'"></div></div>'+
          '<div class="he-goal-meta"><span>'+saved.toFixed(0)+' / '+target.toFixed(0)+' RON</span><span class="he-goal-meta-pct">'+pct.toFixed(0)+'%</span></div>'+
          (left>0?'<div style="font-size:.72rem;color:#64748b;">'+left.toFixed(0)+' RON to go</div>':'<div style="font-size:.72rem;color:#34d399;font-weight:700;">&#x2705; Reached!</div>')+
          '<div style="display:flex;gap:6px;align-items:center;">'+
            '<input type="number" class="he-ledger-input he-goal-dep" placeholder="Add RON…" min="0" step="1" style="flex:1;min-width:80px;">'+
            '<button class="he-ledger-add-btn he-goal-dep-btn" data-di="'+i+'" style="white-space:nowrap;">+ Add</button>'+
          '</div>'+
        '</div>';
      }).join('');
    }
    html+='</div>';
    view.innerHTML=html;

    document.getElementById('he-goal-add-btn').addEventListener('click',function(){
      var name=(document.getElementById('he-goal-name')||{}).value||'';
      var target=parseFloat((document.getElementById('he-goal-target')||{}).value);
      var saved=parseFloat((document.getElementById('he-goal-saved')||{}).value)||0;
      var color=(document.getElementById('he-goal-color')||{}).value||'#3b82f6';
      if(!name.trim()||isNaN(target)||target<=0){toast('Name and target amount required','warn');return;}
      var g2=getGoals();g2.push({id:Date.now(),name:name.trim(),target:target,saved:saved,color:color});
      saveGoals(g2);renderGoalsView(view);toast('Goal added!','success',2000);
    });
    view.querySelectorAll('.he-goal-del').forEach(function(btn){
      btn.addEventListener('click',function(){var g2=getGoals();g2.splice(parseInt(btn.dataset.di,10),1);saveGoals(g2);renderGoalsView(view);toast('Goal removed','info',1500);});
    });
    view.querySelectorAll('.he-goal-dep-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        var inp=btn.previousElementSibling;var amt=parseFloat(inp.value);
        if(isNaN(amt)||amt<=0){toast('Enter a positive amount','warn');return;}
        var g2=getGoals();var i=parseInt(btn.dataset.di,10);g2[i].saved=(parseFloat(g2[i].saved||0)+amt);
        saveGoals(g2);renderGoalsView(view);toast('+'+amt.toFixed(0)+' RON saved!','success',2000);
      });
    });
  }

  /* ── REPORTS VIEW ───────────────────────────────────────────────── */
  function renderReports(view){
    var expenses=getExpenses(),income=getIncome();
    var mo=new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    var subs=detectSubscriptions(expenses);
    var subHtml='';
    if(subs.length){
      subHtml='<div>'+
        '<div style="font-size:.72rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">&#x1F501; Detected Subscriptions</div>'+
        subs.map(function(s){return'<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.15);margin-bottom:6px;">'+
          '<span class="he-sub-badge">'+s.count+'x</span>'+
          '<span style="flex:1;font-size:.84rem;color:#cbd5e1;">'+esc(s.desc)+'</span>'+
          '<span style="font-size:.75rem;color:#fbbf24;font-weight:700;">~'+s.avgAmount.toFixed(0)+' RON/mo</span>'+
        '</div>';}).join('')+
      '</div>';
    }
    view.innerHTML=
      '<div>'+
        '<div style="font-size:.72rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;">6-Month Overview</div>'+
        '<div id="he-6mo-chart"></div>'+
        '<div style="display:flex;gap:12px;margin-top:6px;font-size:.66rem;color:#64748b;">'+
          '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f87171;margin-right:4px;"></span>Expenses</span>'+
          '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#34d399;opacity:.7;margin-right:4px;"></span>Income</span>'+
        '</div>'+
      '</div>'+
      '<div>'+
        '<div style="font-size:.72rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;">Spending Calendar — '+esc(mo)+'</div>'+
        '<div id="he-cal-heatmap"></div>'+
        '<div style="display:flex;gap:8px;margin-top:8px;font-size:.65rem;color:#64748b;align-items:center;">'+
          '<span>Low</span>'+
          '<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:rgba(251,191,36,.15);"></span>'+
          '<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:rgba(251,191,36,.3);"></span>'+
          '<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:rgba(248,113,113,.25);"></span>'+
          '<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:rgba(248,113,113,.55);"></span>'+
          '<span>High</span>'+
        '</div>'+
      '</div>'+
      '<div>'+
        '<div style="font-size:.72rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;">Category Breakdown — This Month</div>'+
        '<div id="he-ledger-budgets"></div>'+
      '</div>'+
      subHtml;
    render6MonthChart(expenses,income);
    renderCalendarHeatmap(expenses);
    renderBudgets(expenses);
  }

  /* ── 6-Month Chart ──────────────────────────────────────────────── */
  function render6MonthChart(expenses,income){
    var el=document.getElementById('he-6mo-chart');if(!el)return;
    var today=new Date(),months=[];
    for(var i=5;i>=0;i--){var d=new Date(today.getFullYear(),today.getMonth()-i,1);months.push({key:d.toISOString().slice(0,7),lbl:d.toLocaleDateString('en-GB',{month:'short'})});}
    var maxV=0;
    var data=months.map(function(m){
      var exp=expenses.filter(function(e){return(e.date||'').startsWith(m.key);}).reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
      var inc=income.filter(function(e){return(e.date||'').startsWith(m.key);}).reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
      if(exp>maxV)maxV=exp;if(inc>maxV)maxV=inc;
      return{lbl:m.lbl,exp:exp,inc:inc};
    });
    if(!maxV){el.innerHTML='<div style="color:#475569;font-size:.8rem;text-align:center;padding:24px 0;">No data yet.</div>';return;}
    el.innerHTML=data.map(function(m){
      var eh=Math.max(2,Math.round(m.exp/maxV*100));var ih=Math.max(2,Math.round(m.inc/maxV*100));
      return'<div class="he-mo-bar-wrap">'+
        '<div class="he-mo-bar-val">'+(m.exp>0?m.exp.toFixed(0):'—')+'</div>'+
        '<div style="display:flex;gap:2px;align-items:flex-end;width:100%;justify-content:center;flex:1;">'+
          (m.inc>0?'<div class="he-mo-bar" style="background:#34d399;opacity:.7;height:'+ih+'%;" title="Income: '+m.inc.toFixed(0)+' RON"></div>':'')+
          (m.exp>0?'<div class="he-mo-bar" style="background:#f87171;height:'+eh+'%;" title="Expenses: '+m.exp.toFixed(0)+' RON"></div>':'<div class="he-mo-bar" style="background:rgba(255,255,255,.06);height:4%;"></div>')+
        '</div>'+
        '<div class="he-mo-bar-lbl">'+esc(m.lbl)+'</div>'+
      '</div>';
    }).join('');
  }

  /* ── Calendar Heatmap ───────────────────────────────────────────── */
  function renderCalendarHeatmap(expenses){
    var el=document.getElementById('he-cal-heatmap');if(!el)return;
    var today=new Date(),yr=today.getFullYear(),mo=today.getMonth();
    var moKey=today.toISOString().slice(0,7);
    var dim=new Date(yr,mo+1,0).getDate(),fdow=new Date(yr,mo,1).getDay();
    var byDay={};
    expenses.filter(function(e){return(e.date||'').startsWith(moKey);}).forEach(function(e){var d=parseInt((e.date||'').slice(8,10),10);byDay[d]=(byDay[d]||0)+(parseFloat(e.amount)||0);});
    var maxD=Math.max.apply(null,Object.values(byDay).concat([1]));
    var html=['Su','Mo','Tu','We','Th','Fr','Sa'].map(function(d){return'<div class="he-cal-dh">'+d+'</div>';}).join('');
    for(var i=0;i<fdow;i++)html+='<div class="he-cal-dc empty"></div>';
    for(var d=1;d<=dim;d++){
      var amt=byDay[d]||0,ix=amt>0?Math.ceil(amt/maxD*4):0,isToday=d===today.getDate();
      html+='<div class="he-cal-dc he-cx'+ix+'" title="'+d+': '+amt.toFixed(0)+' RON"'+(isToday?' style="outline:2px solid #3b82f6;outline-offset:1px;"':'')+'>'+d+'</div>';
    }
    el.innerHTML=html;
  }

  /* ── Subscription Detector ──────────────────────────────────────── */
  function detectSubscriptions(expenses){
    var byDesc={};
    expenses.forEach(function(e){var k=(e.desc||'').toLowerCase().trim();if(!k)return;if(!byDesc[k])byDesc[k]=[];byDesc[k].push(e);});
    var subs=[];
    Object.keys(byDesc).forEach(function(k){
      var en=byDesc[k];if(en.length<2)return;
      var mos=Array.from(new Set(en.map(function(e){return(e.date||'').slice(0,7);})));if(mos.length<2)return;
      var amts=en.map(function(e){return parseFloat(e.amount||0);});
      var avg=amts.reduce(function(s,a){return s+a;},0)/amts.length;
      var maxDev=Math.max.apply(null,amts.map(function(a){return Math.abs(a-avg);}));
      if(avg>0&&maxDev/avg>0.2)return;
      subs.push({desc:en[0].desc||k,count:en.length,avgAmount:avg,months:mos.length});
    });
    return subs.sort(function(a,b){return b.months-a.months;});
  }

  /* ── Natural Language Filter ────────────────────────────────────── */
  function naturalLanguageFilter(entries,q){
    var ql=q.toLowerCase().trim();
    var overM=ql.match(/^(over|above|more than)\s+(\d+)/),underM=ql.match(/^(under|below|less than)\s+(\d+)/);
    if(overM){var n=parseFloat(overM[2]);return entries.filter(function(e){return parseFloat(e.amount||0)>n;});}
    if(underM){var n2=parseFloat(underM[2]);return entries.filter(function(e){return parseFloat(e.amount||0)<n2;});}
    if(ql==='today'){var t=new Date().toISOString().slice(0,10);return entries.filter(function(e){return e.date===t;});}
    if(ql==='yesterday'){var y=new Date(Date.now()-86400000).toISOString().slice(0,10);return entries.filter(function(e){return e.date===y;});}
    if(ql==='this week'){var now=new Date(),sw=new Date(now);sw.setDate(now.getDate()-now.getDay());var s=sw.toISOString().slice(0,10),en2=now.toISOString().slice(0,10);return entries.filter(function(e){return e.date>=s&&e.date<=en2;});}
    if(ql==='last week'){var now2=new Date(),slw=new Date(now2);slw.setDate(now2.getDate()-now2.getDay()-7);var elw=new Date(slw);elw.setDate(slw.getDate()+6);return entries.filter(function(e){return e.date>=slw.toISOString().slice(0,10)&&e.date<=elw.toISOString().slice(0,10);});}
    var catM=Object.keys(CAT_LABEL).find(function(c){return CAT_LABEL[c].toLowerCase()===ql||c===ql;});
    if(catM)return entries.filter(function(e){return(e.cat||'other')===catM;});
    return entries.filter(function(e){return(e.desc||'').toLowerCase().includes(ql)||(e.note||'').toLowerCase().includes(ql);});
  }

  /* ── Smart Insights ─────────────────────────────────────────────── */
  function renderInsights(allExpenses){
    var el=document.getElementById('he-ledger-insights');if(!el)return;
    var mo=new Date().toISOString().slice(0,7);
    var thisM=allExpenses.filter(function(e){return(e.date||'').startsWith(mo);});
    var prevMo=new Date(new Date().getFullYear(),new Date().getMonth()-1,1).toISOString().slice(0,7);
    var lastM=allExpenses.filter(function(e){return(e.date||'').startsWith(prevMo);});
    var total=thisM.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    var lastTotal=lastM.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    var today=new Date(),dom=today.getDate(),dim=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
    var daysLeft=dim-dom,burn=dom>0?total/dom:0,proj=burn*dim;
    var vsLast=lastTotal>0?((total-lastTotal)/lastTotal*100):null;
    var bycat={};thisM.forEach(function(e){var c=e.cat||'other';bycat[c]=(bycat[c]||0)+(parseFloat(e.amount)||0);});
    var topCat=Object.keys(bycat).sort(function(a,b){return bycat[b]-bycat[a];})[0];
    var cards=[
      {icon:'&#x1F525;',val:burn.toFixed(0)+' RON/day',lbl:'Burn Rate',cls:burn>200?'he-insight-bad':burn>100?'he-insight-warn':'he-insight-ok'},
      {icon:'&#x1F4C5;',val:daysLeft+' days',lbl:'Left in month',cls:''},
    ];
    if(vsLast!==null){var sign=vsLast>=0?'+':'';cards.push({icon:'&#x2195;',val:sign+Math.round(vsLast)+'%',lbl:'vs Last month',cls:vsLast>15?'he-insight-bad':vsLast<-5?'he-insight-ok':'he-insight-warn'});}
    if(proj>0)cards.push({icon:'&#x1F52E;',val:proj.toFixed(0)+' RON',lbl:'Projected',cls:''});
    if(topCat)cards.push({icon:'&#x1F3C6;',val:CAT_LABEL[topCat]||topCat,lbl:'Top category',cls:''});
    el.innerHTML=cards.map(function(c){return'<div class="he-insight-card"><div class="he-insight-icon">'+c.icon+'</div><div class="he-insight-val '+(c.cls||'')+'">'+esc(c.val)+'</div><div class="he-insight-lbl">'+esc(c.lbl)+'</div></div>';}).join('');
  }

  /* ── Budget Envelopes ───────────────────────────────────────────── */
  function renderBudgets(allExpenses){
    var el=document.getElementById('he-ledger-budgets');if(!el)return;
    var budgets=getBudgets();
    var mo=new Date().toISOString().slice(0,7);var spent={};
    allExpenses.filter(function(e){return(e.date||'').startsWith(mo);}).forEach(function(e){var c=e.cat||'other';spent[c]=(spent[c]||0)+(parseFloat(e.amount)||0);});
    var rows=Object.keys(budgets).map(function(cat){
      var budget=budgets[cat]||0,s=spent[cat]||0,pct=budget>0?Math.min(s/budget*100,100):0,over=s>budget;
      var col=CAT_COLOR[cat]||'#94a3b8',iClass=over?'bad':pct>80?'warn':'';
      return'<div class="he-budget-row">'+
        '<span class="he-budget-label">'+CAT_ICON[cat]+' '+esc(CAT_LABEL[cat]||cat)+'</span>'+
        '<div class="he-budget-track"><div class="he-budget-fill'+(over?' over':'')+'" style="width:'+pct.toFixed(1)+'%;background:'+col+'"></div></div>'+
        '<span class="he-budget-info '+(iClass)+'">'+s.toFixed(0)+' / '+budget+' RON</span>'+
        '<button class="he-budget-edit-btn" data-cat="'+cat+'" title="Edit">&#x270E;</button>'+
      '</div>';
    }).join('');
    el.innerHTML='<h3>Budget Envelopes <small style="font-size:.65rem;font-weight:400;color:#475569;text-transform:none;letter-spacing:0">'+esc(new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'}))+'</small></h3>'+rows;
    el.querySelectorAll('.he-budget-edit-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        var cat=btn.dataset.cat,cur=getBudgets()[cat]||0;
        var v=window.prompt('Budget for '+CAT_LABEL[cat]+' (RON):',cur);
        if(v===null)return;var n=parseFloat(v);
        if(isNaN(n)||n<0){toast('Invalid amount','warn');return;}
        var b=getBudgets();b[cat]=n;saveBudgets(b);renderBudgets(allExpenses);toast(CAT_LABEL[cat]+' budget \u2192 '+n+' RON','success',2000);
      });
    });
  }

  /* ── CSV Export ─────────────────────────────────────────────────── */
  function exportCSV(){
    var fmo=(document.getElementById('he-l-fmo')||{}).value||'';
    var exp=fmo?getExpenses().filter(function(e){return(e.date||'').startsWith(fmo);}):getExpenses();
    var inc=fmo?getIncome().filter(function(e){return(e.date||'').startsWith(fmo);}):getIncome();
    var all=exp.map(function(e){return Object.assign({_T:'Expense'},e);}).concat(inc.map(function(e){return Object.assign({_T:'Income'},e);}));
    if(!all.length){toast('No entries to export','warn');return;}
    function q(s){return'"'+String(s||'').replace(/"/g,'""')+'"';}
    var lines=['Date,Type,Category,Description,Note,Amount (RON)'];
    all.sort(function(a,b){return String(a.date||'').localeCompare(String(b.date||''));}).forEach(function(e){lines.push([q(e.date||''),q(e._T),q(CAT_LABEL[e.cat||'other']||'—'),q(e.desc||''),q(e.note||''),parseFloat(e.amount||0).toFixed(2)].join(','));});
    var blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download='ledger-'+(fmo||new Date().toISOString().slice(0,7))+'.csv';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    toast('CSV exported ('+all.length+' entries)','success',2000);
  }

  /* ── Ledger Inbox (shown in Transactions tab) ───────────────────── */
  function renderLedgerInbox(){
    var el=document.getElementById('he-ledger-inbox-items');if(!el)return;
    var inbox=safeJson(localStorage.getItem('homer-inbox'),[]);
    if(!inbox.length){el.innerHTML='<div class="he-inbox-empty">Inbox is empty.</div>';return;}
    var TC={thought:'#a78bfa',task:'#34d399',link:'#60a5fa',expense:'#fbbf24'};
    el.innerHTML=inbox.map(function(item,i){var tc=TC[item.type||'thought']||'#94a3b8';return'<div class="he-inbox-item" data-idx="'+i+'"><span class="he-inbox-type" style="background:'+tc+'22;color:'+tc+'">'+esc(item.type||'thought')+'</span><span class="he-inbox-text">'+esc((item.text||'').slice(0,120))+'</span><button class="he-inbox-del">&#xD7;</button></div>';}).join('');
    el.querySelectorAll('.he-inbox-del').forEach(function(btn){
      btn.addEventListener('click',function(){var idx=parseInt(btn.closest('[data-idx]').dataset.idx,10);var all=safeJson(localStorage.getItem('homer-inbox'),[]);all.splice(idx,1);localStorage.setItem('homer-inbox',JSON.stringify(all));renderLedgerInbox();});
    });
  }

  /* ── Vault Tile ─────────────────────────────────────────────────── */
  function injectVaultTile(){
    function doInject(){
      if(document.getElementById('vd-open-ledger'))return;
      var anchor=document.getElementById('vd-open-notes');if(!anchor)return;
      var mo=new Date().toISOString().slice(0,7);
      var count=getExpenses().filter(function(e){return(e.date||'').startsWith(mo);}).length;
      var tile=document.createElement('div');tile.className='vd-card';tile.id='vd-open-ledger';
      tile.innerHTML='<div class="vd-icon">&#x1F4CA;</div><div class="vd-info"><h3>Expense Ledger</h3><p>Budgets, goals &amp; reports</p></div><span class="vd-badge" id="vd-ledger-badge">'+count+' this mo.</span>';
      anchor.insertAdjacentElement('afterend',tile);
      tile.addEventListener('click',function(){openLedger();});
      setInterval(function(){var b=document.getElementById('vd-ledger-badge');if(!b)return;var m=new Date().toISOString().slice(0,7);b.textContent=getExpenses().filter(function(e){return(e.date||'').startsWith(m);}).length+' this mo.';},5000);
    }
    doInject();setTimeout(doInject,800);setTimeout(doInject,2500);
    waitForEl('vault-content',function(el){new MutationObserver(function(){if(el.style.display!=='none')doInject();}).observe(el,{attributes:true,attributeFilter:['style']});});
  }

  function initExpenseLedger(){
    injectVaultTile();
    var tries=0,iv=setInterval(function(){
      var fab=document.getElementById('homer-expense-fab');
      if(fab||++tries>20){clearInterval(iv);if(fab&&!fab.dataset.heLedger){fab.dataset.heLedger='1';fab.addEventListener('click',function(e){e.stopImmediatePropagation();openLedger();});}}
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
      var amtM=text.match(/\b(\d[\d.,]*)\s*(?:ron|lei|usd|\$|\u20ac|eur|gbp)?\b/i);
      openLedger({desc:text,amount:amtM?parseFloat(amtM[1].replace(',','.')).toFixed(2):undefined});
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

  /* ═══════════════════════════════════════════════════════════════════
   * JOEY COMMAND BRIDGE
   * Joey embeds [CMD:action:p1:p2] tags in chat responses.
   * This bridge parses them, executes them, and strips the tags.
   *
   * Full command reference (include in Joey's context file):
   *
   *  Navigation
   *    [CMD:navigate:vault]           — switch to any tab
   *    [CMD:openLedger:reports]       — open ledger (overview/transactions/goals/reports)
   *    [CMD:openCapture]              — open quick capture panel
   *    [CMD:openInbox]                — open inbox panel
   *
   *  Ledger
   *    [CMD:addExpense:Coffee:15.5:food]   — add expense (cat: food/transport/work/health/entertainment/other)
   *    [CMD:addIncome:Salary:5000]         — log income
   *    [CMD:addGoal:Holiday:3000]          — create savings goal
   *    [CMD:setPayday:25]                  — set payday to day 25 of month
   *    [CMD:setBudget:food:1500]           — set monthly category budget
   *
   *  Capture & inbox
   *    [CMD:capture:Buy milk:task]    — add to inbox (types: thought/task/link/expense)
   *
   *  Pomodoro
   *    [CMD:startPomodoro]            — start/resume the pomodoro timer
   *    [CMD:navigate:pomodoro]        — switch to pomodoro tab
   *
   *  Memory
   *    [CMD:addMemory:I prefer dark UI] — save to Joey memories via API
   * ═══════════════════════════════════════════════════════════════════ */
  function initJoeyCommandBridge(){
    /* ── Register global API ─────────────────────────────────────── */
    window._joeyAPI={
      navigate:function(tab){
        switchTab(tab);
        toast('&#x1F4CD; Navigating to '+esc(tab),'info',2000);
      },
      openLedger:function(view){
        if(view&&['overview','transactions','goals','reports'].indexOf(view)!==-1)_ledgerView=view;
        openLedger();
      },
      addExpense:function(desc,amount,cat){
        if(!desc||!amount){toast('Joey: missing expense data','warn');return;}
        var exp=getExpenses();
        exp.push({id:Date.now(),desc:String(desc),amount:parseFloat(amount)||0,cat:CAT_LABEL[cat]?cat:'other',date:new Date().toISOString().slice(0,10),note:'Added by Joey'});
        saveExpenses(exp);
        toast('&#x1F4CA; Joey added expense: '+esc(String(desc))+' \u2014 '+parseFloat(amount).toFixed(2)+' RON','success',3500);
      },
      addIncome:function(desc,amount){
        if(!desc||!amount){toast('Joey: missing income data','warn');return;}
        var inc=getIncome();
        inc.push({id:Date.now(),desc:String(desc),amount:parseFloat(amount)||0,date:new Date().toISOString().slice(0,10),note:'Added by Joey'});
        saveIncome(inc);
        toast('&#x2B06; Joey logged income: '+esc(String(desc))+' \u2014 '+parseFloat(amount).toFixed(2)+' RON','success',3500);
      },
      addGoal:function(name,target){
        if(!name||!target){toast('Joey: missing goal data','warn');return;}
        var gs=getGoals();
        gs.push({id:Date.now(),name:String(name),target:parseFloat(target)||0,saved:0,color:GOAL_COLORS[gs.length%GOAL_COLORS.length]});
        saveGoals(gs);
        toast('&#x1F3AF; Joey created goal: '+esc(String(name)),'success',3000);
      },
      setPayday:function(day){
        var n=parseInt(day,10);
        if(isNaN(n)||n<1||n>31){toast('Joey: day must be 1\u201331','warn');return;}
        localStorage.setItem('homer-payday-day',String(n));
        toast('&#x1F4C5; Joey set payday to day '+n,'success',2000);
      },
      setBudget:function(cat,amount){
        if(!CAT_LABEL[cat]){toast('Joey: unknown category '+esc(String(cat)),'warn');return;}
        var b=getBudgets();b[cat]=parseFloat(amount)||0;saveBudgets(b);
        toast('&#x1F4B0; Joey set '+esc(CAT_LABEL[cat])+' budget \u2192 '+parseFloat(amount).toFixed(0)+' RON','success',2500);
      },
      capture:function(text,type){
        if(!text){toast('Joey: no text to capture','warn');return;}
        var validTypes=['thought','task','link','expense'];
        var t=validTypes.indexOf(type)!==-1?type:'thought';
        var inbox=safeJson(localStorage.getItem('homer-inbox'),[]);
        inbox.push({id:Date.now(),text:String(text),type:t,ts:Date.now()});
        localStorage.setItem('homer-inbox',JSON.stringify(inbox));
        toast('&#x1F4E5; Joey captured ('+t+'): '+esc(String(text).slice(0,60)),'success',2500);
      },
      openCapture:function(){clickEl('homer-capture-btn');},
      openInbox:function(){if(typeof window._homerOpenInbox==='function')window._homerOpenInbox();},
      startPomodoro:function(){
        switchTab('pomodoro');
        setTimeout(function(){
          var btn=document.getElementById('pom-start')||document.getElementById('pom-play')||document.querySelector('[id*="pom"][id*="start"],[id*="pom"][id*="play"]');
          if(btn)btn.click();
        },400);
        toast('&#x1F345; Pomodoro started','success',2000);
      },
      addMemory:function(text){
        if(!text)return;
        saveToJoey(text,function(ok){
          toast(ok?'&#x1F9E0; Memory saved to Joey':'&#x26A0; Could not reach Joey',ok?'success':'warn',2500);
        });
      }
    };

    /* ── Command parser ──────────────────────────────────────────── */
    var CMD_RE=/\[CMD:([^\]]{1,200})\]/g;

    function parseCmds(text){
      var cmds=[],m;CMD_RE.lastIndex=0;
      while((m=CMD_RE.exec(text))!==null){
        var parts=m[1].split(':');
        cmds.push({action:parts[0],params:parts.slice(1),raw:m[0]});
      }
      return cmds;
    }

    function execCmds(cmds){
      cmds.forEach(function(cmd){
        var fn=window._joeyAPI&&window._joeyAPI[cmd.action];
        if(!fn){console.debug('[joey-cmd] unknown:',cmd.action);return;}
        try{fn.apply(null,cmd.params);}catch(e){console.debug('[joey-cmd] error:',e.message);}
      });
    }

    function processNode(el){
      if(!el||el._joeyScanned)return;
      el._joeyScanned=true;
      var text=el.textContent||'';
      if(text.indexOf('[CMD:')===-1)return;
      var cmds=parseCmds(text);
      if(!cmds.length)return;
      // Strip tags from rendered HTML
      try{
        cmds.forEach(function(cmd){
          var safe=cmd.raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
          el.innerHTML=el.innerHTML.replace(new RegExp(safe,'g'),'');
        });
      }catch(_){}
      setTimeout(function(){execCmds(cmds);},300);
    }

    /* Watch the whole body for Joey assistant message nodes */
    new MutationObserver(function(mutations){
      mutations.forEach(function(mu){
        mu.addedNodes.forEach(function(node){
          if(node.nodeType!==1)return;
          // Check the node itself and any descendant that looks like an assistant bubble
          var els=[node];
          if(node.querySelectorAll)Array.prototype.push.apply(els,Array.from(node.querySelectorAll('[class*="assistant"],[class*="joey-msg"],[data-role="assistant"],[class*="bubble"],[class*="response"]')));
          els.forEach(function(el){
            if((el.textContent||'').indexOf('[CMD:')!==-1)processNode(el);
          });
        });
      });
    }).observe(document.body,{childList:true,subtree:true});

    /* Expose parseCmds/execCmds for manual use by other scripts */
    window._joeyExecCmd=function(cmdString){
      execCmds(parseCmds('[CMD:'+cmdString+']'));
    };

    /* Teach Joey about commands by injecting a system note into the capture area
       so the user can paste it into Joey's context if needed */
    window._joeyCommandRef=
      'Homer Command Reference (use these tags in your responses):\n'+
      '[CMD:navigate:vault] — go to any tab (home/pomodoro/focuslab/investing/tools/links/news/vault)\n'+
      '[CMD:openLedger:reports] — open ledger to a specific view\n'+
      '[CMD:addExpense:Description:amount:cat] — log expense (cat: food/transport/work/health/entertainment/other)\n'+
      '[CMD:addIncome:Description:amount] — log income\n'+
      '[CMD:addGoal:Name:target] — create savings goal\n'+
      '[CMD:setPayday:25] — set payday day\n'+
      '[CMD:setBudget:food:1500] — set monthly budget for a category\n'+
      '[CMD:capture:text:type] — add to inbox (type: thought/task/link/expense)\n'+
      '[CMD:startPomodoro] — start the pomodoro timer\n'+
      '[CMD:addMemory:text] — save a memory';
  }

})();
