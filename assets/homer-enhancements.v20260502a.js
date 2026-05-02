/* ====================================================================
 * Homer Enhancements  v20260502a
 *
 * Features (all additive, zero-breakage on existing code):
 *   1. Command Palette     — Ctrl+K to navigate tabs + open panels
 *   2. Keyboard Shortcuts  — press ? to show shortcut reference card
 *   3. Tab Shortcuts       — Alt+1..8 to switch tabs instantly
 *   4. Pomodoro Title      — live countdown in browser tab title
 *   5. Links Live Search   — filter the links grid in real-time
 *   6. Smart Capture Tag   — auto-detect expense / link / task / thought
 *   7. Weather Forecast    — click weather widget for 7-day popup
 *   8. Expense Chart       — category bar chart inside expense panel
 *   9. Habit Reminder      — morning toast for pending habits (8-11 AM)
 * ==================================================================== */
(function () {
  'use strict';

  /* ── Utilities ─────────────────────────────────────────────────────── */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Graceful toast — uses homer's system if available, falls back to inline
  function toast(msg, type, duration) {
    if (typeof window._homerToast === 'function') {
      window._homerToast({ message: msg, type: type || 'info', duration: duration || 3500 });
      return;
    }
    var el = document.createElement('div');
    el.style.cssText =
      'position:fixed;bottom:80px;right:20px;z-index:99999;background:#1e293b;' +
      'border:1px solid rgba(255,255,255,.15);color:#e5e7eb;padding:12px 16px;' +
      'border-radius:12px;font-size:.88rem;font-weight:600;line-height:1.4;' +
      'box-shadow:0 8px 32px rgba(0,0,0,.4);cursor:pointer;max-width:320px;';
    el.textContent = msg;
    el.addEventListener('click', function () { if (el.parentNode) el.parentNode.removeChild(el); });
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, duration || 3500);
  }

  /* ── CSS injection ─────────────────────────────────────────────────── */
  var CSS = [
    /* Command Palette */
    '#he-cmd-overlay{position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);display:flex;align-items:flex-start;justify-content:center;padding-top:14vh;opacity:0;pointer-events:none;transition:opacity .15s}',
    '#he-cmd-overlay.open{opacity:1;pointer-events:all}',
    '#he-cmd-box{background:#0f172a;border:1px solid rgba(255,255,255,.18);border-radius:18px;width:100%;max-width:560px;margin:0 16px;box-shadow:0 32px 80px rgba(0,0,0,.75);overflow:hidden;transform:translateY(-8px);transition:transform .15s}',
    '#he-cmd-overlay.open #he-cmd-box{transform:translateY(0)}',
    '#he-cmd-input{width:100%;padding:16px 20px;background:none;border:none;outline:none;color:#e5e7eb;font-size:1rem;font-family:inherit;border-bottom:1px solid rgba(255,255,255,.08);box-sizing:border-box}',
    '#he-cmd-input::placeholder{color:#64748b}',
    '#he-cmd-results{max-height:380px;overflow-y:auto;padding:8px 8px 12px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent}',
    '.he-cmd-group{padding:8px 12px 4px;font-size:.68rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.1em}',
    '.he-cmd-item{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:background .08s;color:#e5e7eb;font-size:.9rem;font-weight:600;user-select:none}',
    '.he-cmd-item.active,.he-cmd-item:hover{background:rgba(96,165,250,.15)}',
    '.he-cmd-icon{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0}',
    '.he-cmd-label{flex:1}',
    '.he-cmd-hint{font-size:.7rem;color:#64748b;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:2px 7px;font-family:monospace;font-weight:700;white-space:nowrap}',
    '#he-cmd-empty{text-align:center;color:#64748b;padding:28px;font-size:.9rem}',

    /* Keyboard Shortcuts panel */
    '#he-keys-overlay{position:fixed;inset:0;z-index:999997;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .15s}',
    '#he-keys-overlay.open{opacity:1;pointer-events:all}',
    '#he-keys-box{background:#0f172a;border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:28px 32px;max-width:500px;width:calc(100% - 32px);box-shadow:0 24px 64px rgba(0,0,0,.6);max-height:85vh;overflow-y:auto}',
    '#he-keys-box h2{font-size:.95rem;font-weight:800;color:#e5e7eb;margin:0 0 18px;text-align:center;letter-spacing:.04em;text-transform:uppercase}',
    '.he-key-section{font-size:.68rem;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.he-key-section:first-of-type{margin-top:0}',
    '.he-key-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;gap:16px}',
    '.he-key-desc{font-size:.85rem;color:#cbd5e1;flex:1}',
    '.he-key-combo{display:flex;gap:4px;align-items:center;flex-shrink:0}',
    '.he-kbd{display:inline-block;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#94a3b8;font-size:.72rem;font-weight:700;font-family:"SF Mono","Fira Code",monospace;line-height:1.5}',
    '.he-kbd-sep{color:#475569;font-size:.7rem}',
    '#he-keys-close-btn{display:block;width:100%;margin-top:18px;padding:9px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#94a3b8;font-size:.82rem;font-weight:700;cursor:pointer;transition:background .15s}',
    '#he-keys-close-btn:hover{background:rgba(255,255,255,.08)}',

    /* Links live search */
    '#he-links-search-wrap{margin-bottom:16px}',
    '#he-links-search{width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0b1220;color:var(--text);font-size:.9rem;font-family:inherit;outline:none;transition:border-color .2s;box-sizing:border-box}',
    '#he-links-search::placeholder{color:#64748b}',
    '#he-links-search:focus{border-color:rgba(96,165,250,.5)}',
    '#he-links-search-count{font-size:.75rem;color:#64748b;margin-top:6px;min-height:1em}',

    /* 7-day weather forecast popup */
    '#he-wx-forecast{position:fixed;top:72px;right:16px;z-index:99985;background:rgba(9,17,32,.97);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:18px;width:290px;box-shadow:0 16px 48px rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;transform:translateY(-6px)}',
    '#he-wx-forecast.open{opacity:1;pointer-events:all;transform:translateY(0)}',
    '#he-wx-forecast h4{margin:0 0 12px;font-size:.72rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.1em}',
    '.he-wx-day{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.83rem}',
    '.he-wx-day:last-child{border:none;padding-bottom:0}',
    '.he-wx-day-name{width:38px;font-weight:700;color:#94a3b8;flex-shrink:0}',
    '.he-wx-day-icon{width:22px;text-align:center;flex-shrink:0}',
    '.he-wx-day-desc{flex:1;color:#64748b;font-size:.74rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.he-wx-day-temp{font-weight:800;color:#e5e7eb;white-space:nowrap;font-size:.83rem}',
    '.he-wx-day-lo{color:#64748b;font-weight:400}',

    /* Expense category chart */
    '#he-exp-chart-wrap{padding:12px 16px 0;border-top:1px solid rgba(255,255,255,.06)}',
    '#he-exp-chart-wrap h4{font-size:.68rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px}',
    '.he-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:7px}',
    '.he-bar-label{width:80px;font-size:.7rem;color:#94a3b8;font-weight:700;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}',
    '.he-bar-track{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden}',
    '.he-bar-fill{height:100%;border-radius:4px;transition:width .4s cubic-bezier(.4,0,.2,1)}',
    '.he-bar-val{width:66px;font-size:.7rem;color:#94a3b8;font-weight:700;text-align:right;white-space:nowrap;flex-shrink:0}',

    /* Mobile */
    '@media(max-width:600px){#he-cmd-box{margin:0 10px}#he-wx-forecast{width:calc(100vw - 32px);right:16px}#he-keys-box{padding:20px}}'
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.id = 'homer-enhancements-css';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ── Boot ──────────────────────────────────────────────────────────── */
  ready(function () {
    initCommandPalette();
    initKeyboardShortcutsPanel();
    initTabKeyboardShortcuts();
    initPomodoroTitleCountdown();
    initLinksSearch();
    initSmartCaptureAutoTag();
    initWeatherForecast();
    initExpenseChart();
    initHabitMorningReminder();
  });

  /* ═══════════════════════════════════════════════════════════════════
   * 1. COMMAND PALETTE  (Ctrl+K)
   * ═══════════════════════════════════════════════════════════════════ */
  function initCommandPalette() {
    var overlay = document.createElement('div');
    overlay.id = 'he-cmd-overlay';
    overlay.innerHTML =
      '<div id="he-cmd-box">' +
        '<input id="he-cmd-input" autocomplete="off" spellcheck="false"' +
        ' placeholder="Navigate tabs, open panels, search\u2026">' +
        '<div id="he-cmd-results"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var CMDS = [
      { g:'Tabs', icon:'🏠', label:'Home',           hint:'Alt+1', fn:function(){switchTab('home');}},
      { g:'Tabs', icon:'🍅', label:'Pomodoro',       hint:'Alt+2', fn:function(){switchTab('pomodoro');}},
      { g:'Tabs', icon:'🔬', label:'Focus Lab',      hint:'Alt+3', fn:function(){switchTab('focuslab');}},
      { g:'Tabs', icon:'📈', label:'Investing',      hint:'Alt+4', fn:function(){switchTab('investing');}},
      { g:'Tabs', icon:'🛠', label:'Tools',          hint:'Alt+5', fn:function(){switchTab('tools');}},
      { g:'Tabs', icon:'🔗', label:'Links',          hint:'Alt+6', fn:function(){switchTab('links');}},
      { g:'Tabs', icon:'📰', label:'News',           hint:'Alt+7', fn:function(){switchTab('news');}},
      { g:'Tabs', icon:'🔒', label:'Vault',          hint:'Alt+8', fn:function(){switchTab('vault');}},
      { g:'Features', icon:'📥', label:'Quick Capture',  hint:'Alt+C', fn:function(){clickEl('homer-capture-btn');}},
      { g:'Features', icon:'✅', label:'Habits',          hint:'',      fn:function(){clickEl('homer-habits-fab');}},
      { g:'Features', icon:'💰', label:'Expenses',        hint:'',      fn:function(){clickEl('homer-expense-fab');}},
      { g:'Features', icon:'📋', label:'Daily Brief',     hint:'',      fn:function(){clickEl('homer-brief-fab');}},
      { g:'Features', icon:'🧠', label:'Joey Memories',   hint:'',      fn:function(){clickEl('homer-memory-fab');}},
      { g:'Actions',  icon:'💡', label:'New Quote',       hint:'',      fn:function(){clickEl('refresh');}},
      { g:'Actions',  icon:'💾', label:'Save Quote',      hint:'',      fn:function(){clickEl('save');}},
      { g:'Actions',  icon:'📋', label:'Copy Quote',      hint:'',      fn:function(){clickEl('copy');}},
      { g:'Help',     icon:'⌨', label:'Keyboard Shortcuts', hint:'?',  fn:function(){openShortcutsPanel();}},
    ];

    var recent = [];
    var activeIdx = 0;
    var filtered = CMDS.slice();

    function render(q) {
      var ql = (q || '').toLowerCase().trim();
      filtered = ql
        ? CMDS.filter(function(c){ return (c.label+' '+c.g+' '+c.hint).toLowerCase().includes(ql); })
        : CMDS.slice();

      if (!ql && recent.length) {
        var rs = new Set(recent);
        filtered = filtered.filter(function(c){return rs.has(c.label);})
          .concat(filtered.filter(function(c){return !rs.has(c.label);}));
      }

      activeIdx = 0;
      var html = '';
      if (!filtered.length) {
        html = '<div id="he-cmd-empty">No results for &ldquo;' + esc(q) + '&rdquo;</div>';
      } else {
        var lastGroup = '';
        filtered.forEach(function(cmd, i) {
          if (cmd.g !== lastGroup && !ql) {
            html += '<div class="he-cmd-group">' + esc(cmd.g) + '</div>';
            lastGroup = cmd.g;
          }
          html += '<div class="he-cmd-item' + (i===0?' active':'') + '" data-idx="'+i+'">' +
            '<div class="he-cmd-icon">' + cmd.icon + '</div>' +
            '<div class="he-cmd-label">' + esc(cmd.label) + '</div>' +
            (cmd.hint ? '<div class="he-cmd-hint">' + esc(cmd.hint) + '</div>' : '') +
          '</div>';
        });
      }
      document.getElementById('he-cmd-results').innerHTML = html;
      document.getElementById('he-cmd-results').querySelectorAll('.he-cmd-item').forEach(function(el){
        el.addEventListener('mouseenter', function(){
          activeIdx = parseInt(el.dataset.idx, 10);
          markActive();
        });
        el.addEventListener('click', function(){ run(parseInt(el.dataset.idx, 10)); });
      });
    }

    function markActive() {
      document.getElementById('he-cmd-results').querySelectorAll('.he-cmd-item').forEach(function(el, i){
        el.classList.toggle('active', i === activeIdx);
        if (i === activeIdx) el.scrollIntoView({block:'nearest'});
      });
    }

    function run(idx) {
      var cmd = filtered[idx];
      if (!cmd) return;
      recent = [cmd.label].concat(recent.filter(function(l){return l!==cmd.label;})).slice(0,5);
      cmd.fn();
      close();
    }

    function open() {
      overlay.classList.add('open');
      var inp = document.getElementById('he-cmd-input');
      inp.value = '';
      render('');
      setTimeout(function(){ inp.focus(); }, 40);
    }

    function close() { overlay.classList.remove('open'); }

    document.getElementById('he-cmd-input').addEventListener('input', function(){ render(this.value); });
    document.getElementById('he-cmd-input').addEventListener('keydown', function(e){
      if (e.key==='ArrowDown'){ e.preventDefault(); activeIdx=Math.min(activeIdx+1,filtered.length-1); markActive(); }
      else if (e.key==='ArrowUp'){ e.preventDefault(); activeIdx=Math.max(activeIdx-1,0); markActive(); }
      else if (e.key==='Enter'){ run(activeIdx); }
      else if (e.key==='Escape'){ close(); }
    });
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });

    document.addEventListener('keydown', function(e){
      if ((e.ctrlKey||e.metaKey) && e.key==='k') {
        e.preventDefault();
        overlay.classList.contains('open') ? close() : open();
      }
    });

    window._heOpenCommandPalette = open;
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 2. KEYBOARD SHORTCUTS PANEL  (press ?)
   * ═══════════════════════════════════════════════════════════════════ */
  function initKeyboardShortcutsPanel() {
    function kRow(desc) {
      var keys = Array.prototype.slice.call(arguments, 1);
      var combo = keys.map(function(k, i){
        return '<span class="he-kbd">' + esc(k) + '</span>' +
          (i < keys.length-1 ? '<span class="he-kbd-sep"> + </span>' : '');
      }).join('');
      return '<div class="he-key-row"><span class="he-key-desc">'+esc(desc)+'</span>'+
        '<span class="he-key-combo">'+combo+'</span></div>';
    }

    var overlay = document.createElement('div');
    overlay.id = 'he-keys-overlay';
    overlay.innerHTML =
      '<div id="he-keys-box">' +
        '<h2>Keyboard Shortcuts</h2>' +
        '<div class="he-key-section">Navigation</div>' +
        kRow('Command palette', 'Ctrl', 'K') +
        kRow('Switch tab 1\u20138', 'Alt', '1\u20138') +
        kRow('This shortcuts panel', '?') +
        '<div class="he-key-section">Pomodoro</div>' +
        kRow('Start / Pause timer', 'Space') +
        '<div class="he-key-section">Quick Capture</div>' +
        kRow('Open capture modal', 'Alt', 'C') +
        kRow('Save entry (inside modal)', 'Ctrl', 'Enter') +
        '<div class="he-key-section">General</div>' +
        kRow('Close any panel or overlay', 'Esc') +
        kRow('7-day weather forecast', 'Click weather widget') +
        '<button id="he-keys-close-btn">Close</button>' +
      '</div>';
    document.body.appendChild(overlay);

    function close(){ overlay.classList.remove('open'); }
    document.getElementById('he-keys-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
    document.addEventListener('keydown', function(e){
      if (e.key==='Escape') close();
    });

    document.addEventListener('keydown', function(e){
      var tag = (e.target.tagName||'').toUpperCase();
      if (tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||e.target.isContentEditable) return;
      if (e.key==='?'&&!e.ctrlKey&&!e.metaKey&&!e.altKey) {
        e.preventDefault();
        openShortcutsPanel();
      }
    });
  }

  function openShortcutsPanel() {
    var el = document.getElementById('he-keys-overlay');
    if (el) el.classList.add('open');
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 3. TAB KEYBOARD SHORTCUTS  (Alt+1..8)
   * ═══════════════════════════════════════════════════════════════════ */
  function initTabKeyboardShortcuts() {
    var TABS = ['home','pomodoro','focuslab','investing','tools','links','news','vault'];
    document.addEventListener('keydown', function(e){
      if (!e.altKey||e.ctrlKey||e.metaKey) return;
      var tag = (e.target.tagName||'').toUpperCase();
      if (tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
      var n = parseInt(e.key, 10);
      if (n>=1 && n<=8) { e.preventDefault(); switchTab(TABS[n-1]); }
    });
  }

  function switchTab(name) {
    var btn = document.querySelector('.sb-item[data-tab="'+name+'"]') ||
              document.querySelector('.tab-btn[data-tab="'+name+'"]');
    if (btn) btn.click();
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 4. POMODORO TITLE COUNTDOWN
   * ═══════════════════════════════════════════════════════════════════ */
  function initPomodoroTitleCountdown() {
    var originalTitle = document.title;
    var pomTimeEl = document.getElementById('pom-time');
    var pomModeEl = document.getElementById('pom-mode');
    if (!pomTimeEl) return;

    var prevTime = '';
    var lastTime = '';

    new MutationObserver(function(){
      var timeText = (pomTimeEl.textContent || '').trim();
      var modeText = (pomModeEl ? pomModeEl.textContent : '').toLowerCase();

      if (timeText && timeText !== lastTime) {
        prevTime = lastTime;
        lastTime = timeText;
        // Skip updating if it looks like a clean reset and we have no prior value
        var cleanReset = /^(25|5|15):00$/.test(timeText) && !prevTime;
        if (!cleanReset) {
          var icon = modeText.includes('break') ? '\uD83D\uDFE2' : '\uD83C\uDF45';
          document.title = icon + ' ' + timeText + ' \u2014 Homer';
          return;
        }
      }
      document.title = originalTitle;
    }).observe(pomTimeEl, { childList:true, subtree:true, characterData:true });

    var resetBtn = document.getElementById('pom-reset');
    if (resetBtn) resetBtn.addEventListener('click', function(){
      prevTime = ''; lastTime = '';
      document.title = originalTitle;
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 5. LINKS LIVE SEARCH
   * ═══════════════════════════════════════════════════════════════════ */
  function initLinksSearch() {
    var section = document.getElementById('tab-links');
    if (!section) return;

    var wrap = document.createElement('div');
    wrap.id = 'he-links-search-wrap';
    var inp = document.createElement('input');
    inp.type = 'search';
    inp.id = 'he-links-search';
    inp.placeholder = '\uD83D\uDD0D Search links by name, URL or category\u2026';
    var countEl = document.createElement('div');
    countEl.id = 'he-links-search-count';
    wrap.appendChild(inp);
    wrap.appendChild(countEl);

    var grid = document.getElementById('links-grid');
    if (grid) section.insertBefore(wrap, grid);
    else {
      var h2 = section.querySelector('h2.section');
      if (h2) h2.insertAdjacentElement('afterend', wrap);
      else section.insertBefore(wrap, section.firstChild);
    }

    inp.addEventListener('input', function(){ filterLinks(this.value.trim()); });

    var g2 = document.getElementById('links-grid');
    if (g2) {
      new MutationObserver(function(){
        if (inp.value.trim()) filterLinks(inp.value.trim());
        else countEl.textContent = '';
      }).observe(g2, { childList:true });
    }

    function filterLinks(q) {
      var g = document.getElementById('links-grid');
      if (!g) return;
      if (!q) {
        Array.from(g.children).forEach(function(el){ el.style.display=''; });
        countEl.textContent = '';
        return;
      }
      var ql = q.toLowerCase();
      var total = 0, shown = 0;
      Array.from(g.children).forEach(function(el){
        total++;
        var text = (el.textContent||el.innerText||'').toLowerCase();
        var href = '';
        var a = el.querySelector('a');
        if (a) href = (a.href||'').toLowerCase();
        var match = text.includes(ql) || href.includes(ql);
        el.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      countEl.textContent = shown + ' of ' + total + ' links match';
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 6. SMART CAPTURE AUTO-TAG
   * ═══════════════════════════════════════════════════════════════════ */
  function initSmartCaptureAutoTag() {
    new MutationObserver(function(){
      var ta = document.getElementById('homer-capture-text');
      if (ta && !ta.dataset.heTagged) { ta.dataset.heTagged='1'; attachSmartTag(ta); }
    }).observe(document.body, { childList:true, subtree:true });

    var ta = document.getElementById('homer-capture-text');
    if (ta) { ta.dataset.heTagged='1'; attachSmartTag(ta); }
  }

  function attachSmartTag(textarea) {
    var last = '';
    textarea.addEventListener('input', function(){
      var val = textarea.value.trim();
      if (!val || val.length < 4) return;
      var type = detectCaptureType(val);
      if (type === last) return;
      last = type;
      var modal = document.getElementById('homer-capture-modal');
      if (!modal) return;
      modal.querySelectorAll('.homer-capture-tag').forEach(function(tag){
        if (tag.dataset.type === type && !tag.classList.contains('active')) {
          tag.dispatchEvent(new MouseEvent('click', {bubbles:true}));
        }
      });
    });
  }

  function detectCaptureType(text) {
    if (/^https?:\/\/\S+/.test(text) || /^www\.\S+\.\S{2,}/.test(text)) return 'link';
    if (/\b\d[\d,.]*\s*(ron|lei|usd|\$|€|eur|gbp|£)\b/i.test(text)) return 'expense';
    if (/^[\d,.]+\s+(lei|ron|usd|eur)\b/i.test(text)) return 'expense';
    if (/^(todo|task|fix|buy|call|send|check|schedule|write|review|update|build|create|book)\b/i.test(text)) return 'task';
    return 'thought';
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 7. WEATHER 7-DAY FORECAST  (click weather widget)
   * ═══════════════════════════════════════════════════════════════════ */
  function initWeatherForecast() {
    var panel = document.createElement('div');
    panel.id = 'he-wx-forecast';
    panel.innerHTML =
      '<h4>7-Day Forecast \u2014 Bucharest</h4>' +
      '<div id="he-wx-forecast-body" style="color:#64748b;font-size:.8rem;text-align:center;padding:10px">Loading\u2026</div>';
    document.body.appendChild(panel);

    var isOpen = false;

    function openPanel(e) {
      if (e) e.stopPropagation();
      isOpen = !isOpen;
      panel.classList.toggle('open', isOpen);
      if (isOpen) fetchForecast();
    }
    function closePanel() { isOpen = false; panel.classList.remove('open'); }

    panel.addEventListener('click', function(e){ e.stopPropagation(); });
    document.addEventListener('click', function(){ if (isOpen) closePanel(); });

    // Attach to weather widget (may be dynamic)
    var attached = false;
    (function tryAttach(){
      if (attached) return;
      var wx = document.getElementById('homer-weather-widget');
      if (!wx) { setTimeout(tryAttach, 600); return; }
      attached = true;
      wx.title = 'Click for 7-day forecast';
      wx.addEventListener('click', openPanel);
    })();

    var WMO_ICON = {0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌧',61:'🌧',63:'🌧',65:'🌧',71:'🌨',73:'🌨',75:'❄️',80:'🌦',81:'🌧',82:'⛈',95:'⛈',96:'⛈',99:'⛈'};
    var WMO_DESC = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Foggy',51:'Drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Heavy showers',82:'Showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
    var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var CACHE_KEY = 'he-forecast-cache';

    function fetchForecast() {
      var cached = null;
      try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); } catch(_){}
      if (cached && Date.now()-cached.ts < 3600000) { renderForecast(cached.data); return; }

      fetch('https://api.open-meteo.com/v1/forecast?latitude=44.4268&longitude=26.1025' +
        '&daily=weathercode,temperature_2m_max,temperature_2m_min' +
        '&timezone=Europe%2FBucharest&forecast_days=7')
        .then(function(r){ return r.json(); })
        .then(function(d){
          var data = (d.daily.time||[]).map(function(date,i){
            return { date:date, code:d.daily.weathercode[i],
              max:Math.round(d.daily.temperature_2m_max[i]),
              min:Math.round(d.daily.temperature_2m_min[i]) };
          });
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(),data:data})); } catch(_){}
          renderForecast(data);
        })
        .catch(function(){
          var b = document.getElementById('he-wx-forecast-body');
          if (b) b.innerHTML = '<div style="color:#f87171;font-size:.8rem;padding:10px;text-align:center">Could not load forecast</div>';
        });
    }

    function renderForecast(days) {
      var body = document.getElementById('he-wx-forecast-body');
      if (!body) return;
      var today = new Date().toISOString().slice(0,10);
      body.innerHTML = days.map(function(d){
        var dt = new Date(d.date+'T12:00:00');
        var name = d.date===today ? 'Today' : DAYS[dt.getDay()];
        return '<div class="he-wx-day">' +
          '<span class="he-wx-day-name">'+name+'</span>' +
          '<span class="he-wx-day-icon">'+(WMO_ICON[d.code]||'🌡')+'</span>' +
          '<span class="he-wx-day-desc">'+esc(WMO_DESC[d.code]||'')+'</span>' +
          '<span class="he-wx-day-temp">'+d.max+'° <span class="he-wx-day-lo">/ '+d.min+'°</span></span>' +
        '</div>';
      }).join('');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 8. EXPENSE CATEGORY CHART
   * ═══════════════════════════════════════════════════════════════════ */
  function initExpenseChart() {
    var CAT_COLOR = { food:'#fb7185', transport:'#fbbf24', work:'#60a5fa', health:'#34d399', entertainment:'#a78bfa', other:'#94a3b8' };
    var CAT_LABEL = { food:'\uD83C\uDF54 Food', transport:'\uD83D\uDE97 Transit', work:'\uD83D\uDCBC Work', health:'\uD83C\uDFE5 Health', entertainment:'\uD83C\uDFAC Fun', other:'\uD83D\uDCE6 Other' };

    (function inject(){
      var expPanel = document.getElementById('homer-expense-panel');
      if (!expPanel) { setTimeout(inject, 700); return; }
      if (document.getElementById('he-exp-chart-wrap')) return;

      var chartWrap = document.createElement('div');
      chartWrap.id = 'he-exp-chart-wrap';
      chartWrap.innerHTML = '<h4>This Month by Category</h4><div id="he-exp-chart"></div>';

      var list = document.getElementById('homer-exp-list');
      if (list) list.before(chartWrap); else expPanel.appendChild(chartWrap);

      new MutationObserver(function(){
        if (expPanel.classList.contains('open')) renderChart();
      }).observe(expPanel, { attributes:true, attributeFilter:['class'] });

      if (list) {
        new MutationObserver(function(){
          if (expPanel.classList.contains('open')) renderChart();
        }).observe(list, { childList:true });
      }
    })();

    function renderChart() {
      var chartEl = document.getElementById('he-exp-chart');
      if (!chartEl) return;
      var all = [];
      try { all = JSON.parse(localStorage.getItem('homer-expenses')||'[]'); } catch(_){}
      var mo = new Date().toISOString().slice(0,7);
      var totals = {};
      all.filter(function(e){ return (e.date||'').startsWith(mo); }).forEach(function(e){
        var cat = e.cat||'other';
        totals[cat] = (totals[cat]||0) + (parseFloat(e.amount)||0);
      });
      var cats = Object.keys(totals).sort(function(a,b){ return totals[b]-totals[a]; });
      if (!cats.length) {
        chartEl.innerHTML = '<div style="font-size:.72rem;color:#64748b;text-align:center;padding:8px 0">No expenses this month yet</div>';
        return;
      }
      var max = Math.max.apply(null, cats.map(function(k){ return totals[k]; }));
      chartEl.innerHTML = cats.map(function(cat){
        var pct = max>0 ? (totals[cat]/max*100).toFixed(1) : 0;
        return '<div class="he-bar-row">' +
          '<div class="he-bar-label">'+esc(CAT_LABEL[cat]||cat)+'</div>' +
          '<div class="he-bar-track"><div class="he-bar-fill" style="width:'+pct+'%;background:'+(CAT_COLOR[cat]||'#94a3b8')+'"></div></div>' +
          '<div class="he-bar-val">'+totals[cat].toFixed(0)+' RON</div>' +
        '</div>';
      }).join('');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
   * 9. HABIT MORNING REMINDER  (8–11 AM, once per day)
   * ═══════════════════════════════════════════════════════════════════ */
  function initHabitMorningReminder() {
    var REMINDED_KEY = 'he-habit-reminded';
    var today = new Date().toISOString().slice(0,10);
    var h = new Date().getHours();
    if (localStorage.getItem(REMINDED_KEY) === today) return;
    if (h < 8 || h > 11) return;

    setTimeout(function(){
      var habits = null;
      try { habits = JSON.parse(localStorage.getItem('homer-habits')||'null'); } catch(_){}
      if (!habits||!habits.habits||!habits.habits.length) return;
      var pending = habits.habits.filter(function(hb){
        return !(habits.completions||{})[hb.id+':'+today];
      });
      if (!pending.length) return;
      localStorage.setItem(REMINDED_KEY, today);
      var names = pending.slice(0,3).map(function(hb){ return hb.name; });
      var extra = pending.length>3 ? ' +' + (pending.length-3) + ' more' : '';
      toast('Habits due today: ' + names.join(', ') + extra, 'info', 6000);
    }, 5000);
  }

  /* ── Shared helpers ────────────────────────────────────────────────── */
  function clickEl(id) {
    var el = document.getElementById(id);
    if (el) el.click();
  }

})();
