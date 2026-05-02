/* ====================================================================
 * Homer Enhancements  v20260502a  (rev 3)
 *
 *  UI / Navigation
 *   1.  Command Palette        — Ctrl+K
 *   2.  Keyboard Shortcuts     — press ?
 *   3.  Tab Hotkeys            — Alt+1–8
 *   4.  Smooth Tab Transitions — CSS fade between panels
 *   5.  Mobile Bottom Sheet    — swipe-up + drag-to-dismiss
 *   6.  FAB Tray               — Quick Capture + Focus always visible;
 *                                others collapse behind a ⋯ button
 *   7.  Remove Floating Clock  — keep only the inline Home-tab clock
 *
 *  Productivity
 *   8.  Pomodoro Title         — live countdown in browser tab
 *   9.  Pomodoro Session Log   — localStorage + Supabase focus_sessions
 *   10. Links Live Search      — filter by name / URL / category
 *   11. Smart Capture Auto-tag — expense / link / task / thought
 *   12. Habit Morning Reminder — 8–11 AM toast
 *
 *  Widgets
 *   13. Weather Panel          — click → location prompt → city + local
 *                                time + current conditions + 7-day
 *   14. Expense Category Chart — bar chart inside expense panel
 *
 *  Data
 *   15. Supabase Data Sync     — push/pull expenses, habits, inbox
 *                                for authenticated users; sync badge
 *   16. Expense Ledger         — full-page table overlay (sortable,
 *                                filterable, with inbox section)
 * ==================================================================== */
(function () {
  'use strict';

  /* ── Utilities ─────────────────────────────────────────────────────── */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function toast(msg, type, dur) {
    if (typeof window._homerToast === 'function') { window._homerToast({ message:msg, type:type||'info', duration:dur||3500 }); return; }
    var el=document.createElement('div');
    el.style.cssText='position:fixed;bottom:80px;right:20px;z-index:99999;background:#1e293b;border:1px solid rgba(255,255,255,.15);color:#e5e7eb;padding:12px 16px;border-radius:12px;font-size:.88rem;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.4);cursor:pointer;max-width:320px;';
    el.textContent=msg;
    el.addEventListener('click',function(){el.parentNode&&el.parentNode.removeChild(el);});
    document.body.appendChild(el);
    setTimeout(function(){el.parentNode&&el.parentNode.removeChild(el);},dur||3500);
  }
  function clickEl(id){ var el=document.getElementById(id); if(el) el.click(); }
  function waitForEl(id,cb,limit){
    var el=document.getElementById(id); if(el){cb(el);return;}
    var tries=0,max=limit||30,iv=setInterval(function(){
      el=document.getElementById(id);
      if(el||++tries>=max){clearInterval(iv);if(el)cb(el);}
    },500);
  }
  function switchTab(name){
    var btn=document.querySelector('.sb-item[data-tab="'+name+'"]')||document.querySelector('.tab-btn[data-tab="'+name+'"]');
    if(btn) btn.click();
  }
  function safeJson(s,fb){ try{return s?JSON.parse(s):fb;}catch(_){return fb;} }

  /* ── CSS ───────────────────────────────────────────────────────────── */
  var CSS=[
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

    /* Links live search */
    '#he-links-search-wrap{margin-bottom:16px}',
    '#he-links-search{width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0b1220;color:var(--text);font-size:.9rem;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .2s}',
    '#he-links-search:focus{border-color:rgba(96,165,250,.5)}',
    '#he-links-search-count{font-size:.75rem;color:#64748b;margin-top:6px;min-height:1em}',

    /* Weather panel */
    '#he-wx-panel{position:fixed;top:72px;right:16px;z-index:99985;background:#0b1220;border:1px solid rgba(255,255,255,.14);border-radius:20px;width:320px;box-shadow:0 20px 60px rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;transform:translateY(-8px);overflow:hidden}',
    '#he-wx-panel.open{opacity:1;pointer-events:all;transform:translateY(0)}',
    '#he-wx-panel-hdr{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between}',
    '#he-wx-panel-hdr h4{margin:0;font-size:.72rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.1em}',
    '#he-wx-panel-close{background:none;border:none;color:#64748b;cursor:pointer;font-size:1rem;padding:0;line-height:1}',
    '#he-wx-panel-body{padding:18px;max-height:70vh;overflow-y:auto}',
    '.he-wx-current{display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.07)}',
    '.he-wx-current-icon{font-size:2.8rem;line-height:1}',
    '.he-wx-current-city{font-size:1.05rem;font-weight:800;color:#e5e7eb}',
    '.he-wx-current-time{font-size:.78rem;color:#60a5fa;margin-top:2px}',
    '.he-wx-current-temp{font-size:1.6rem;font-weight:900;color:#e5e7eb;margin-top:4px}',
    '.he-wx-current-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}',
    '.he-wx-meta-pill{font-size:.7rem;color:#94a3b8;background:rgba(255,255,255,.06);border-radius:20px;padding:2px 8px}',
    '.he-wx-day{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.he-wx-day:last-child{border:none}',
    '.he-wx-day-name{width:38px;font-weight:700;color:#94a3b8;font-size:.82rem;flex-shrink:0}',
    '.he-wx-day-icon{width:22px;text-align:center;flex-shrink:0}',
    '.he-wx-day-desc{flex:1;color:#64748b;font-size:.74rem}',
    '.he-wx-day-temp{font-weight:800;color:#e5e7eb;font-size:.82rem;white-space:nowrap}',
    '.he-wx-day-lo{color:#64748b;font-weight:400}',
    '.he-wx-location-prompt{text-align:center;padding:8px 0 12px}',
    '.he-wx-prompt-icon{font-size:2rem;margin-bottom:10px}',
    '.he-wx-prompt-p{font-size:.88rem;color:#cbd5e1;margin-bottom:14px;line-height:1.5}',
    '.he-wx-btn-pri{padding:9px 18px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;margin-right:8px}',
    '.he-wx-btn-sec{padding:9px 18px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:none;color:#94a3b8;font-size:.85rem;font-weight:600;cursor:pointer}',

    /* Expense chart */
    '#he-exp-chart-wrap{padding:12px 16px 0;border-top:1px solid rgba(255,255,255,.06)}',
    '#he-exp-chart-wrap h4{font-size:.68rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px}',
    '.he-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:7px}',
    '.he-bar-label{width:80px;font-size:.7rem;color:#94a3b8;font-weight:700;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}',
    '.he-bar-track{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden}',
    '.he-bar-fill{height:100%;border-radius:4px;transition:width .4s cubic-bezier(.4,0,.2,1)}',
    '.he-bar-val{width:66px;font-size:.7rem;color:#94a3b8;font-weight:700;text-align:right;white-space:nowrap;flex-shrink:0}',

    /* Supabase sync badge */
    '#he-sync-badge{position:fixed;bottom:68px;right:16px;z-index:9988;font-size:.68rem;font-weight:700;color:#64748b;background:rgba(15,23,42,.85);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:3px 10px;pointer-events:none;opacity:0;transition:opacity .3s}',
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
    /* Add form */
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
    /* Summary */
    '#he-ledger-summary{display:flex;gap:12px;flex-wrap:wrap}',
    '.he-ledger-stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px 16px;flex:1;min-width:130px}',
    '.he-ledger-stat-val{font-size:1.3rem;font-weight:900;color:#e5e7eb}',
    '.he-ledger-stat-lbl{font-size:.7rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:2px}',
    /* Filters */
    '#he-ledger-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.he-ledger-filter{padding:7px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#e5e7eb;font-size:.85rem;font-family:inherit;outline:none;cursor:pointer}',
    /* Table */
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
    /* Inbox section */
    '#he-ledger-inbox{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px}',
    '#he-ledger-inbox h3{margin:0 0 12px;font-size:.78rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;display:flex;justify-content:space-between;align-items:center}',
    '.he-inbox-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.84rem;color:#cbd5e1}',
    '.he-inbox-item:last-child{border:none}',
    '.he-inbox-type{padding:2px 8px;border-radius:10px;font-size:.68rem;font-weight:700;flex-shrink:0}',
    '.he-inbox-text{flex:1}',
    '.he-inbox-del{background:none;border:none;color:#475569;cursor:pointer;font-size:.8rem;padding:2px}',
    '.he-inbox-empty{color:#475569;font-size:.84rem;padding:8px 0}',

    /* Session log badge */
    '#he-session-log{position:fixed;bottom:68px;left:116px;z-index:9990;background:rgba(15,23,42,.9);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:6px 12px;font-size:.72rem;color:#94a3b8;font-weight:700;opacity:0;pointer-events:none;transition:opacity .3s;white-space:nowrap}',
    '#he-session-log.visible{opacity:1}',

    /* Mobile */
    '@media(max-width:600px){#he-cmd-box{margin:0 10px}#he-wx-panel{width:calc(100vw - 24px);right:12px}#he-keys-box{padding:20px}#he-ledger-topbar{padding:12px 16px}#he-ledger-body{padding:14px 12px}}'
  ].join('');

  var styleEl=document.createElement('style');
  styleEl.id='homer-enhancements-css';
  styleEl.textContent=CSS;
  document.head.appendChild(styleEl);

  /* ── Boot ──────────────────────────────────────────────────────────── */
  ready(function(){
    removeClock();
    initCommandPalette();
    initKeyboardShortcutsPanel();
    initTabHotkeys();
    initSmoothTabTransitions();
    initMobileBottomSheet();
    initFabTray();
    initPomodoroTitleCountdown();
    initPomodoroSessionLogger();
    initLinksSearch();
    initSmartCaptureAutoTag();
    initHabitMorningReminder();
    initEnhancedWeather();
    initExpenseChart();
    initSupabaseDataSync();
    initExpenseLedger();
  });

  /* ═══════════════════════════════════════════════════════════════════
   * 7. REMOVE FLOATING CLOCK
   * ═══════════════════════════════════════════════════════════════════ */
  function removeClock(){
    function tryRemove(){
      var cl=document.getElementById('homer-clock-widget');
      if(cl){cl.remove();return;}
      new MutationObserver(function(_,o){
        var el=document.getElementById('homer-clock-widget');
        if(el){o.disconnect();el.remove();}
      }).observe(document.body,{childList:true,subtree:true});
    }
    tryRemove();
    setTimeout(tryRemove,800);
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
      {g:'Features',icon:'📥',label:'Quick Capture',hint:'Alt+C',fn:function(){clickEl('homer-capture-btn');}},
      {g:'Features',icon:'✅',label:'Habits',hint:'',fn:function(){clickEl('homer-habits-fab');}},
      {g:'Features',icon:'💰',label:'Expense Ledger',hint:'',fn:function(){openLedger();}},
      {g:'Features',icon:'📋',label:'Daily Brief',hint:'',fn:function(){clickEl('homer-brief-fab');}},
      {g:'Features',icon:'🧠',label:'Joey Memories',hint:'',fn:function(){clickEl('homer-memory-fab');}},
      {g:'Actions',icon:'💡',label:'New Quote',hint:'',fn:function(){clickEl('refresh');}},
      {g:'Actions',icon:'💾',label:'Save Quote',hint:'',fn:function(){clickEl('save');}},
      {g:'Actions',icon:'📋',label:'Copy Quote',hint:'',fn:function(){clickEl('copy');}},
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
    ov.innerHTML='<div id="he-keys-box"><h2>Keyboard Shortcuts</h2><div class="he-key-section">Navigation</div>'+kRow('Command palette','Ctrl','K')+kRow('Switch tab 1–8','Alt','1–8')+kRow('Shortcuts panel','?')+'<div class="he-key-section">Pomodoro</div>'+kRow('Start / Pause','Space')+'<div class="he-key-section">Capture</div>'+kRow('Quick capture','Alt','C')+kRow('Save entry','Ctrl','Enter')+'<div class="he-key-section">General</div>'+kRow('Close any panel','Esc')+kRow('7-day forecast','Click weather')+'<button id="he-keys-close-btn">Close</button></div>';
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
   * 3. TAB HOTKEYS  (Alt+1–8)
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
   * 6. FAB TRAY  — Quick Capture + Focus always visible;
   *               Habits / Brief / Memory behind ⋯ toggle
   * ═══════════════════════════════════════════════════════════════════ */
  function initFabTray(){
    // Inject CSS for the tray
    var s=document.createElement('style');
    s.textContent=[
      '#he-fab-tray{position:fixed;bottom:20px;left:20px;z-index:9992;display:flex;align-items:flex-end;gap:8px}',
      '.he-fab{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer;border:1px solid rgba(255,255,255,.14);transition:background .2s,transform .2s;-webkit-tap-highlight-color:transparent}',
      '.he-fab:hover{transform:scale(1.1)}',
      '#he-fab-more{background:rgba(255,255,255,.08);color:#94a3b8}',
      '#he-fab-more:hover{background:rgba(255,255,255,.15)}',
      '#he-fab-extras{display:flex;gap:8px;align-items:center;overflow:hidden;max-width:0;transition:max-width .3s cubic-bezier(.4,0,.2,1),opacity .25s;opacity:0;pointer-events:none}',
      '#he-fab-extras.open{max-width:300px;opacity:1;pointer-events:all}',
    ].join('');
    document.head.appendChild(s);

    var tray=document.createElement('div');tray.id='he-fab-tray';
    tray.innerHTML='<div id="he-fab-extras"></div><button id="he-fab-more" class="he-fab" title="More">⋯</button>';
    document.body.appendChild(tray);

    var extrasOpen=false;
    document.getElementById('he-fab-more').addEventListener('click',function(){
      extrasOpen=!extrasOpen;
      document.getElementById('he-fab-extras').classList.toggle('open',extrasOpen);
    });

    // Reparent existing FABs into our tray
    var REPARENT=[
      {id:'homer-capture-btn',always:true},
      {id:'homer-pomo-fab',always:true},
      {id:'homer-habits-fab',always:false},
      {id:'homer-expense-fab',always:false},
      {id:'homer-brief-fab',always:false},
      {id:'homer-memory-fab',always:false},
    ];
    function tryReparent(){
      REPARENT.forEach(function(cfg){
        var el=document.getElementById(cfg.id);
        if(!el||el.dataset.heParented)return;
        el.dataset.heParented='1';
        // Remove inline positioning so our tray controls layout
        el.style.position='';el.style.bottom='';el.style.left='';el.style.top='';el.style.right='';el.style.zIndex='';
        el.classList.add('he-fab');
        if(cfg.always){tray.insertBefore(el,tray.firstChild);}
        else{document.getElementById('he-fab-extras').appendChild(el);}
      });
    }
    tryReparent();
    // FABs from homer-features are created on DOMContentLoaded so may not exist yet
    new MutationObserver(tryReparent).observe(document.body,{childList:true,subtree:false});
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 8. POMODORO TITLE COUNTDOWN
   * ═══════════════════════════════════════════════════════════════════ */
  function initPomodoroTitleCountdown(){
    var orig=document.title,pomTimeEl=document.getElementById('pom-time'),pomModeEl=document.getElementById('pom-mode');
    if(!pomTimeEl)return;
    var prev='',last='';
    new MutationObserver(function(){
      var t=(pomTimeEl.textContent||'').trim(),m=(pomModeEl?pomModeEl.textContent:'').toLowerCase();
      if(t&&t!==last){prev=last;last=t;if(!(/^(25|5|15):00$/.test(t)&&!prev)){document.title=(m.includes('break')?'\uD83D\uDFE2':'\uD83C\uDF45')+' '+t+' \u2014 Homer';return;}}
      document.title=orig;
    }).observe(pomTimeEl,{childList:true,subtree:true,characterData:true});
    var rb=document.getElementById('pom-reset');
    if(rb)rb.addEventListener('click',function(){prev='';last='';document.title=orig;});
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 9. POMODORO SESSION LOGGER  (localStorage + Supabase)
   * ═══════════════════════════════════════════════════════════════════ */
  function initPomodoroSessionLogger(){
    var pomModeEl=document.getElementById('pom-mode');if(!pomModeEl)return;
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
        var client=window.__supabase;
        if(client){var uid=window.__sbSession&&window.__sbSession.user&&window.__sbSession.user.id;client.from('focus_sessions').insert({created_at:sess.ts,duration_secs:dur,task_label:task||null,user_id:uid||null}).then(function(r){if(r.error)console.debug('[homer] focus_sessions:',r.error.message);});}
        toast('\uD83C\uDF45 Session logged — '+Math.round(dur/60)+' min','success',2500);
        showBadge('\uD83C\uDF45 '+todayCount()+' sessions today');sessionStart=null;
      }
      if(mode==='focus')sessionStart=Date.now();
    }).observe(pomModeEl,{childList:true,subtree:true,characterData:true});
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
    if(/\b\d[\d,.]*\s*(ron|lei|usd|\$|€|eur|gbp|£)\b/i.test(s))return'expense';
    if(/^[\d,.]+\s+(lei|ron|usd|eur)\b/i.test(s))return'expense';
    if(/^(todo|task|fix|buy|call|send|check|schedule|write|review|update|build|create|book)\b/i.test(s))return'task';
    return'thought';
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 12. HABIT MORNING REMINDER  (8–11 AM)
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
   * 13. ENHANCED WEATHER PANEL
   *     Click widget → location prompt → city + local time + 7-day
   * ═══════════════════════════════════════════════════════════════════ */
  function initEnhancedWeather(){
    var panel=document.createElement('div');panel.id='he-wx-panel';
    panel.innerHTML='<div id="he-wx-panel-hdr"><h4>Weather</h4><button id="he-wx-panel-close">✕</button></div><div id="he-wx-panel-body"></div>';
    document.body.appendChild(panel);

    var isOpen=false,locGranted=false,curLat=44.4268,curLon=26.1025,curCity='Bucharest',curTz='Europe/Bucharest',clockIv=null;

    function openPanel(e){if(e)e.stopPropagation();isOpen=!isOpen;panel.classList.toggle('open',isOpen);if(isOpen)locGranted?fetchWeather():showPrompt();}
    function closePanel(){isOpen=false;panel.classList.remove('open');if(clockIv){clearInterval(clockIv);clockIv=null;}}

    document.getElementById('he-wx-panel-close').addEventListener('click',closePanel);
    panel.addEventListener('click',function(e){e.stopPropagation();});
    document.addEventListener('click',function(){if(isOpen)closePanel();});

    // Attach click to the weather widget (created by homer-features)
    var attached=false;
    (function tryAttach(){
      if(attached)return;
      // Also try the inline weather card in home tab
      var wx=document.getElementById('homer-weather-widget')||document.querySelector('.weather');
      if(!wx){setTimeout(tryAttach,600);return;}
      attached=true;wx.style.cursor='pointer';wx.title='Click for detailed forecast';
      wx.addEventListener('click',openPanel);
    })();

    function showPrompt(){
      var body=document.getElementById('he-wx-panel-body');
      body.innerHTML='<div class="he-wx-location-prompt"><div class="he-wx-prompt-icon">\uD83D\uDCCD</div><p class="he-wx-prompt-p">Use your current location for accurate weather?</p><button class="he-wx-btn-pri" id="he-wx-allow">\uD83D\uDCCD Use My Location</button><button class="he-wx-btn-sec" id="he-wx-deny">Use Bucharest</button></div>';
      document.getElementById('he-wx-allow').addEventListener('click',requestLoc);
      document.getElementById('he-wx-deny').addEventListener('click',function(){fetchWeather();});
    }

    function requestLoc(){
      var body=document.getElementById('he-wx-panel-body');
      body.innerHTML='<div style="text-align:center;padding:24px;color:#64748b;font-size:.88rem">Requesting location\u2026</div>';
      if(!navigator.geolocation){fetchWeather();return;}
      navigator.geolocation.getCurrentPosition(
        function(pos){
          curLat=pos.coords.latitude;curLon=pos.coords.longitude;locGranted=true;
          // Reverse geocode via Nominatim
          fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+curLat+'&lon='+curLon,{headers:{'Accept-Language':'en','User-Agent':'HomerHome/1.0'}})
            .then(function(r){return r.json();})
            .then(function(d){
              var addr=d.address||{};
              curCity=addr.city||addr.town||addr.village||addr.county||'Your Location';
              // Get timezone from browser (best approximation)
              curTz=Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Bucharest';
              fetchWeather();
            })
            .catch(function(){curCity='Your Location';fetchWeather();});
        },
        function(){fetchWeather();}  // denied — fall back to Bucharest
      );
    }

    var WI={0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌧',61:'🌧',63:'🌧',65:'🌧',71:'🌨',73:'🌨',75:'❄️',80:'🌦',81:'🌧',82:'⛈',95:'⛈',96:'⛈',99:'⛈'};
    var WD={0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Foggy',51:'Drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Heavy showers',82:'Showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
    var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],CACHE_KEY='he-wx-v2-cache';

    function fetchWeather(){
      var body=document.getElementById('he-wx-panel-body');if(!body)return;
      body.innerHTML='<div style="padding:20px;text-align:center;color:#64748b;font-size:.85rem">Loading forecast\u2026</div>';
      var cached=safeJson(localStorage.getItem(CACHE_KEY),null);
      if(cached&&cached.lat===curLat&&cached.lon===curLon&&Date.now()-cached.ts<3600000){renderWeather(cached.data);return;}
      var url='https://api.open-meteo.com/v1/forecast?latitude='+curLat+'&longitude='+curLon+'&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone='+encodeURIComponent(curTz)+'&forecast_days=7';
      fetch(url).then(function(r){return r.json();}).then(function(d){
        try{localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),lat:curLat,lon:curLon,data:d}));}catch(_){}
        renderWeather(d);
      }).catch(function(){if(body)body.innerHTML='<div style="color:#f87171;text-align:center;padding:20px;font-size:.85rem">Could not load weather</div>';});
    }

    function renderWeather(d){
      var body=document.getElementById('he-wx-panel-body');if(!body)return;
      var cur=d.current||{};var code=cur.weathercode||0;
      var today=new Date().toISOString().slice(0,10);
      // Local time (live)
      function localTime(){try{return new Date().toLocaleTimeString('en-GB',{timeZone:curTz,hour:'2-digit',minute:'2-digit'});}catch(_){return'--:--';}}
      var html='<div class="he-wx-current">'+
        '<div class="he-wx-current-icon">'+(WI[code]||'🌡')+'</div>'+
        '<div><div class="he-wx-current-city">'+esc(curCity)+'</div>'+
        '<div class="he-wx-current-time" id="he-wx-local-time">'+localTime()+'</div>'+
        '<div class="he-wx-current-temp">'+Math.round(cur.temperature_2m||0)+'°C</div>'+
        '<div class="he-wx-current-meta">'+
          '<span class="he-wx-meta-pill">'+esc(WD[code]||'')+'</span>'+
          (cur.windspeed_10m?'<span class="he-wx-meta-pill">\uD83D\uDCA8 '+Math.round(cur.windspeed_10m)+' km/h</span>':'')+
          (cur.relative_humidity_2m?'<span class="he-wx-meta-pill">\uD83D\uDCA7 '+cur.relative_humidity_2m+'%</span>':'')+
        '</div></div>'+
      '</div>';
      var days=d.daily||{};
      (days.time||[]).forEach(function(date,i){
        var dt=new Date(date+'T12:00:00'),name=date===today?'Today':DAYS[dt.getDay()];
        html+='<div class="he-wx-day"><span class="he-wx-day-name">'+name+'</span><span class="he-wx-day-icon">'+(WI[days.weathercode[i]]||'🌡')+'</span><span class="he-wx-day-desc">'+esc(WD[days.weathercode[i]]||'')+'</span><span class="he-wx-day-temp">'+Math.round(days.temperature_2m_max[i])+'° <span class="he-wx-day-lo">/ '+Math.round(days.temperature_2m_min[i])+'°</span></span></div>';
      });
      body.innerHTML=html;
      // Live clock for the city
      if(clockIv)clearInterval(clockIv);
      clockIv=setInterval(function(){var el=document.getElementById('he-wx-local-time');if(el)el.textContent=localTime();},10000);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 14. EXPENSE CATEGORY CHART  (inside the quick-add panel)
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
   * 15. SUPABASE DATA SYNC
   *     Pulls on load, pushes on change, 30-s periodic backup
   * ═══════════════════════════════════════════════════════════════════ */
  var _syncDirty={};

  function initSupabaseDataSync(){
    var badge=document.createElement('div');badge.id='he-sync-badge';document.body.appendChild(badge);
    function showBadge(txt,cls){badge.className=cls;badge.textContent=txt;badge.classList.add('visible');if(cls==='synced')setTimeout(function(){badge.classList.remove('visible');},3000);}

    function getClient(){return window.__supabase||null;}
    function getUid(){return window.__sbSession&&window.__sbSession.user&&window.__sbSession.user.id||null;}
    function isLoggedIn(){return !!getUid();}

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

    function pullKey(key,cb){
      var client=getClient(),uid=getUid();if(!client||!uid){if(cb)cb(null);return;}
      client.from('field_state').select('value,updated_at').eq('key','he_'+key).eq('user_id',uid).maybeSingle()
        .then(function(r){
          if(r.data&&r.data.value){
            // merge: Supabase wins if present
            localStorage.setItem(key,r.data.value);
          }
          if(cb)cb(r.data?r.data.value:null);
        }).catch(function(){if(cb)cb(null);});
    }

    var SYNC_KEYS=['homer-expenses','homer-habits','homer-inbox'];

    function pullAll(){
      if(!isLoggedIn())return;
      SYNC_KEYS.forEach(function(k){pullKey(k,null);});
    }

    function markDirty(key){_syncDirty[key]=true;}
    function pushDirty(){if(!isLoggedIn())return;Object.keys(_syncDirty).forEach(function(k){pushKey(k);});}

    // Pull on load (wait for session)
    function waitForSession(){
      if(isLoggedIn()){pullAll();return;}
      window.addEventListener('supabase:session',function(){pullAll();},{once:true});
      setTimeout(function(){if(isLoggedIn())pullAll();},2000);
    }
    waitForSession();

    // Watch localStorage writes for our keys and mark dirty
    var origSetItem=localStorage.setItem.bind(localStorage);
    localStorage.setItem=function(key,val){
      origSetItem(key,val);
      if(SYNC_KEYS.indexOf(key)!==-1)markDirty(key);
    };

    // Periodic push every 30 s
    setInterval(pushDirty,30000);

    // Push when page unloads
    window.addEventListener('beforeunload',pushDirty);

    // Push when expense / habit panel closes
    ['homer-expense-panel','homer-habits-panel','homer-inbox-panel'].forEach(function(id){
      waitForEl(id,function(el){
        new MutationObserver(function(){
          if(!el.classList.contains('open'))pushDirty();
        }).observe(el,{attributes:true,attributeFilter:['class']});
      });
    });

    window._heSyncPush=pushKey;
    window._heSyncPullAll=pullAll;
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 16. EXPENSE LEDGER  — full-page sortable table + inbox section
   * ═══════════════════════════════════════════════════════════════════ */
  var _ledgerOpen=false;

  function openLedger(){
    var ov=document.getElementById('he-ledger-ov');
    if(ov){ov.classList.remove('hidden');_ledgerOpen=true;renderLedger();return;}
    buildLedger();
  }

  function buildLedger(){
    var ov=document.createElement('div');ov.id='he-ledger-ov';ov.classList.add('hidden');
    var CAT_OPTS=['food','transport','work','health','entertainment','other'].map(function(c){return'<option value="'+c+'">'+{'food':'Food','transport':'Transport','work':'Work','health':'Health','entertainment':'Entertainment','other':'Other'}[c]+'</option>';}).join('');
    ov.innerHTML=
      '<div id="he-ledger-topbar">'+
        '<h2>\uD83D\uDCCA Expense Ledger</h2>'+
        '<button id="he-ledger-close">Close</button>'+
      '</div>'+
      '<div id="he-ledger-body">'+
        // Add form
        '<div id="he-ledger-add">'+
          '<h3>Add Expense</h3>'+
          '<div class="he-ledger-add-row">'+
            '<input type="text" id="he-l-desc" class="he-ledger-input he-ledger-input-desc" placeholder="Description *">'+
            '<input type="number" id="he-l-amt" class="he-ledger-input he-ledger-input-amt" placeholder="Amount (RON) *" min="0" step="0.01">'+
            '<select id="he-l-cat" class="he-ledger-input he-ledger-input-cat">'+CAT_OPTS+'</select>'+
            '<input type="date" id="he-l-date" class="he-ledger-input he-ledger-input-date">'+
            '<button id="he-l-add-btn" class="he-ledger-add-btn">+ Add</button>'+
          '</div>'+
        '</div>'+
        // Summary stats
        '<div id="he-ledger-summary"></div>'+
        // Filters
        '<div id="he-ledger-filters">'+
          '<select id="he-l-fmo" class="he-ledger-filter"></select>'+
          '<select id="he-l-fcat" class="he-ledger-filter"><option value="">All categories</option>'+CAT_OPTS+'</select>'+
          '<input type="search" id="he-l-fsearch" class="he-ledger-input" placeholder="\uD83D\uDD0D Search\u2026" style="flex:1;min-width:150px">'+
        '</div>'+
        // Table
        '<div id="he-ledger-table-wrap">'+
          '<table id="he-ledger-table">'+
            '<thead><tr>'+
              '<th data-col="date">Date<span class="he-th-arrow"></span></th>'+
              '<th data-col="cat">Category<span class="he-th-arrow"></span></th>'+
              '<th data-col="desc">Description<span class="he-th-arrow"></span></th>'+
              '<th data-col="amount" style="text-align:right">Amount<span class="he-th-arrow"></span></th>'+
              '<th style="width:32px"></th>'+
            '</tr></thead>'+
            '<tbody id="he-ledger-body-rows"></tbody>'+
          '</table>'+
        '</div>'+
        // Inbox
        '<div id="he-ledger-inbox">'+
          '<h3>Inbox <span style="font-weight:400;font-size:.78rem;color:#475569">(unprocessed captures)</span></h3>'+
          '<div id="he-ledger-inbox-items"></div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);

    // Set today's date in date input
    document.getElementById('he-l-date').value=new Date().toISOString().slice(0,10);

    // Close button
    document.getElementById('he-ledger-close').addEventListener('click',function(){ov.classList.add('hidden');_ledgerOpen=false;});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&_ledgerOpen){ov.classList.add('hidden');_ledgerOpen=false;}});

    // Build month filter
    buildMonthFilter();

    // Add expense
    document.getElementById('he-l-add-btn').addEventListener('click',addExpense);
    ['he-l-desc','he-l-amt'].forEach(function(id){document.getElementById(id).addEventListener('keydown',function(e){if(e.key==='Enter')addExpense();});});

    // Sort state
    var sortCol='date',sortDir=-1;
    document.getElementById('he-ledger-table').querySelectorAll('th[data-col]').forEach(function(th){
      th.addEventListener('click',function(){
        if(sortCol===th.dataset.col)sortDir*=-1;else{sortCol=th.dataset.col;sortDir=-1;}
        renderLedger();
      });
    });

    // Filters
    ['he-l-fmo','he-l-fcat','he-l-fsearch'].forEach(function(id){document.getElementById(id).addEventListener('input',renderLedger);});

    ov.classList.remove('hidden');_ledgerOpen=true;
    renderLedger();

    // Expose sort state via closure
    ov._sort=function(){return{col:sortCol,dir:sortDir};};

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
      var sel=document.getElementById('he-l-fmo');
      var cur=sel.value;
      sel.innerHTML='<option value="">All months</option>'+months.map(function(m){var d=new Date(m+'-01');var label=d.toLocaleDateString('en-GB',{month:'long',year:'numeric'});return'<option value="'+m+'">'+label+'</option>';}).join('');
      if(cur)sel.value=cur;
    }
  }

  var CAT_COLOR={food:'#fb7185',transport:'#fbbf24',work:'#60a5fa',health:'#34d399',entertainment:'#a78bfa',other:'#94a3b8'};
  var CAT_LABEL={food:'Food',transport:'Transport',work:'Work',health:'Health',entertainment:'Entertainment',other:'Other'};

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

    // Sort
    filtered.sort(function(a,b){
      var av=sort.col==='amount'?parseFloat(a.amount||0):String(a[sort.col]||'');
      var bv=sort.col==='amount'?parseFloat(b.amount||0):String(b[sort.col]||'');
      return av<bv?-sort.dir:av>bv?sort.dir:0;
    });

    // Summary
    var total=filtered.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    var bycat={};filtered.forEach(function(e){var c=e.cat||'other';bycat[c]=(bycat[c]||0)+(parseFloat(e.amount)||0);});
    var summaryEl=document.getElementById('he-ledger-summary');
    if(summaryEl){
      var statsHtml='<div class="he-ledger-stat"><div class="he-ledger-stat-val">'+total.toFixed(2)+' RON</div><div class="he-ledger-stat-lbl">Total '+(fmo||'all time')+'</div></div>'+
        '<div class="he-ledger-stat"><div class="he-ledger-stat-val">'+filtered.length+'</div><div class="he-ledger-stat-lbl">Transactions</div></div>';
      var topCat=Object.keys(bycat).sort(function(a,b){return bycat[b]-bycat[a];})[0];
      if(topCat)statsHtml+='<div class="he-ledger-stat"><div class="he-ledger-stat-val">'+bycat[topCat].toFixed(0)+' RON</div><div class="he-ledger-stat-lbl">Largest: '+(CAT_LABEL[topCat]||topCat)+'</div></div>';
      summaryEl.innerHTML=statsHtml;
    }

    // Table rows
    if(!filtered.length){tbody.innerHTML='<tr><td colspan="5" class="he-ledger-empty">No expenses match the filters.</td></tr>';return;}
    tbody.innerHTML=filtered.map(function(e){
      var cat=e.cat||'other',col=CAT_COLOR[cat]||'#94a3b8';
      return'<tr data-id="'+e.id+'">'+
        '<td>'+esc(e.date||'')+'</td>'+
        '<td><span class="he-ledger-cat-pill" style="background:'+col+'22;color:'+col+'">'+esc(CAT_LABEL[cat]||cat)+'</span></td>'+
        '<td>'+esc(e.desc||'')+'</td>'+
        '<td style="text-align:right;font-weight:700">'+parseFloat(e.amount||0).toFixed(2)+'</td>'+
        '<td><button class="he-ledger-del" title="Delete">\u2715</button></td>'+
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

    // Inbox section
    renderInbox();
  }

  function renderInbox(){
    var el=document.getElementById('he-ledger-inbox-items');if(!el)return;
    var inbox=safeJson(localStorage.getItem('homer-inbox'),[]);
    if(!inbox.length){el.innerHTML='<div class="he-inbox-empty">No items in inbox.</div>';return;}
    var TCOLOR={thought:'#a78bfa',task:'#34d399',link:'#60a5fa',expense:'#fbbf24'};
    el.innerHTML=inbox.map(function(item,i){
      var tc=TCOLOR[item.type||'thought']||'#94a3b8';
      return'<div class="he-inbox-item" data-idx="'+i+'">'+
        '<span class="he-inbox-type" style="background:'+tc+'22;color:'+tc+'">'+esc(item.type||'thought')+'</span>'+
        '<span class="he-inbox-text">'+esc((item.text||'').slice(0,120))+'</span>'+
        '<button class="he-inbox-del" title="Remove">\u2715</button>'+
      '</div>';
    }).join('');
    el.querySelectorAll('.he-inbox-del').forEach(function(btn){
      btn.addEventListener('click',function(){
        var idx=parseInt(btn.closest('[data-idx]').dataset.idx,10);
        var all=safeJson(localStorage.getItem('homer-inbox'),[]);
        all.splice(idx,1);
        localStorage.setItem('homer-inbox',JSON.stringify(all));
        renderInbox();
      });
    });
  }

  // Override the expense FAB to open the ledger instead
  (function(){
    var tries=0;
    var iv=setInterval(function(){
      var fab=document.getElementById('homer-expense-fab');
      if(fab||++tries>20){clearInterval(iv);
        if(fab&&!fab.dataset.heLedger){fab.dataset.heLedger='1';fab.addEventListener('click',function(e){e.stopImmediatePropagation();openLedger();});}
      }
    },400);
  })();

})();
