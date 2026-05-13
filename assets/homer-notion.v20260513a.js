(function () {
  'use strict';

  // ── CSS ──────────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = `
  /* Modals */
  #qc-overlay,#sb-overlay,#sn-overlay,#wr-overlay{position:fixed;inset:0;z-index:10500;background:rgba(2,6,23,.85);backdrop-filter:blur(7px);display:none;align-items:flex-start;justify-content:center;padding-top:70px;}
  #sn-overlay,#wr-overlay{align-items:center;padding-top:0;}
  #qc-box,#sb-box,#sn-box,#wr-box{background:linear-gradient(160deg,#0f1729,#020617);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:26px;box-shadow:0 24px 80px rgba(2,6,23,.65);}
  #qc-box{width:min(540px,92vw);}
  #sb-box{width:min(660px,94vw);max-height:80vh;display:flex;flex-direction:column;padding:0;overflow:hidden;}
  #sn-box{width:min(480px,92vw);}
  #wr-box{width:min(600px,96vw);max-height:90vh;overflow-y:auto;}
  .hn-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
  .hn-modal-head h3{margin:0;font-size:1.05rem;}
  .hn-close-btn{background:none;border:none;color:var(--muted);font-size:1.35rem;cursor:pointer;padding:0 4px;line-height:1;}
  .qc-type-row{display:flex;gap:8px;margin-bottom:14px;}
  .qc-type-btn{flex:1;padding:8px 4px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:none;color:var(--muted);cursor:pointer;font-size:.82rem;font-weight:700;transition:all .15s;}
  .qc-type-btn.active{background:rgba(96,165,250,.18);border-color:#60a5fa;color:#60a5fa;}
  .hn-field{width:100%;padding:11px 14px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:var(--text);font-size:.95rem;margin-bottom:10px;font-family:inherit;}
  .hn-textarea{resize:vertical;min-height:72px;}
  .hn-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}
  .hn-label{font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:5px;margin-top:10px;}
  #sb-input-wrap{padding:16px 18px 12px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:10px;}
  #sb-input{flex:1;padding:9px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:var(--text);font-size:.97rem;}
  #sb-results{overflow-y:auto;padding:10px 18px 18px;flex:1;}
  .sb-result{padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);margin-bottom:7px;cursor:pointer;transition:background .15s;}
  .sb-result:hover{background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.3);}
  .sb-result-type{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;}
  .sb-result-title{font-size:.92rem;font-weight:700;color:var(--text);}
  .sb-result-snip{font-size:.8rem;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .wr-label{font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px;margin-top:14px;}
  .wr-energy-row{display:flex;gap:6px;flex-wrap:wrap;}
  .wr-energy-btn{flex:1;min-width:80px;padding:7px 4px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:none;color:var(--muted);cursor:pointer;font-size:.78rem;font-weight:700;transition:all .15s;text-align:center;}
  .wr-energy-btn.active{background:rgba(96,165,250,.18);border-color:#60a5fa;color:#60a5fa;}

  /* Notes */
  .notes-layout{display:grid;grid-template-columns:220px 1fr;gap:14px;min-height:460px;}
  @media(max-width:640px){.notes-layout{grid-template-columns:1fr;}.notes-sidebar-col{display:none;}}
  .notes-sidebar-col{display:flex;flex-direction:column;gap:7px;}
  .notes-sb-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
  .notes-sb-head h4{margin:0;font-size:.78rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);}
  .note-item{padding:9px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);cursor:pointer;transition:all .14s;}
  .note-item:hover{background:rgba(96,165,250,.08);border-color:rgba(96,165,250,.2);}
  .note-item.active{background:rgba(96,165,250,.14);border-color:#60a5fa;}
  .note-item-title{font-size:.85rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .note-item-date{font-size:.72rem;color:var(--muted);margin-top:2px;}
  .notes-editor-col{display:flex;flex-direction:column;gap:9px;}
  .notes-tb{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
  .notes-tb-btn{padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:none;color:var(--muted);cursor:pointer;font-size:.8rem;transition:all .14s;}
  .notes-tb-btn:hover{background:rgba(255,255,255,.07);color:var(--text);}
  .notes-tb-btn.danger{color:#f87171;}
  #notes-title{width:100%;padding:9px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:var(--text);font-size:1.1rem;font-weight:800;}
  #notes-body{width:100%;min-height:320px;padding:13px;border-radius:11px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.03);color:var(--text);font-size:.92rem;font-family:inherit;resize:vertical;line-height:1.72;}
  .notes-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;}

  /* Analytics */
  .an-filter-bar{display:flex;gap:8px;align-items:center;margin-bottom:18px;flex-wrap:wrap;}
  .an-range-btn{padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.12);background:none;color:var(--muted);cursor:pointer;font-size:.8rem;font-weight:700;transition:all .15s;}
  .an-range-btn.active{background:rgba(96,165,250,.18);border-color:#60a5fa;color:#60a5fa;}
  .an-summary-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px;}
  .an-summary-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;}
  .an-summary-val{font-size:1.6rem;font-weight:900;color:#60a5fa;line-height:1.1;}
  .an-summary-lbl{font-size:.72rem;color:var(--muted);margin-top:4px;}
  .an-summary-delta{font-size:.72rem;font-weight:700;margin-top:2px;}
  .an-summary-delta.up{color:#34d399;}.an-summary-delta.down{color:#f87171;}.an-summary-delta.flat{color:var(--muted);}
  .an-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  @media(max-width:700px){.an-grid{grid-template-columns:1fr;}}
  .an-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:15px;padding:16px;}
  .an-card h4{margin:0 0 12px;font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;}
  .an-card-full{grid-column:1/-1;}
  .hm-grid{display:flex;gap:3px;}
  .hm-col{display:flex;flex-direction:column;gap:3px;}
  .hm-cell{width:12px;height:12px;border-radius:2px;background:rgba(255,255,255,.06);}
  .hm-cell[data-v="1"]{background:rgba(96,165,250,.28);}
  .hm-cell[data-v="2"]{background:rgba(96,165,250,.52);}
  .hm-cell[data-v="3"]{background:rgba(96,165,250,.76);}
  .hm-cell[data-v="4"]{background:#60a5fa;}
  .streak-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;}
  .streak-badge{display:flex;flex-direction:column;align-items:center;padding:8px 11px;border-radius:11px;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);min-width:68px;}
  .streak-num{font-size:1.45rem;font-weight:900;color:#60a5fa;line-height:1;}
  .streak-lbl{font-size:.68rem;color:var(--muted);margin-top:3px;text-align:center;max-width:75px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .streak-rate{font-size:.65rem;color:#34d399;margin-top:1px;}
  .bar-chart{display:flex;gap:5px;align-items:flex-end;height:90px;margin-top:8px;}
  .bar-col{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;}
  .bar-fill{width:100%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#60a5fa,#3b82f6);min-height:3px;}
  .bar-fill.green{background:linear-gradient(180deg,#34d399,#10b981);}
  .bar-fill.purple{background:linear-gradient(180deg,#a78bfa,#7c3aed);}
  .bar-lbl{font-size:.62rem;color:var(--muted);}
  .bar-val{font-size:.65rem;color:#60a5fa;font-weight:700;}
  .cat-row{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
  .cat-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .cat-name{flex:1;font-size:.83rem;color:var(--text);}
  .cat-amt{font-size:.8rem;color:var(--muted);font-weight:700;}
  .cat-delta{font-size:.72rem;font-weight:700;margin-left:4px;}
  .cat-delta.up{color:#f87171;}.cat-delta.down{color:#34d399;}
  .cat-bar-bg{width:100%;height:5px;background:rgba(255,255,255,.07);border-radius:3px;margin-bottom:5px;}
  .cat-bar-fg{height:100%;border-radius:3px;}
  .budget-row{display:flex;align-items:center;gap:8px;margin-bottom:9px;}
  .budget-lbl{width:80px;font-size:.72rem;color:var(--muted);font-weight:700;flex-shrink:0;}
  .budget-track{flex:1;height:8px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden;}
  .budget-fill{height:100%;border-radius:4px;transition:width .4s;}
  .budget-info{font-size:.7rem;color:var(--muted);width:80px;text-align:right;flex-shrink:0;}
  .budget-info.warn{color:#fbbf24;}.budget-info.over{color:#f87171;}
  .day-row{display:flex;gap:5px;margin-top:6px;}
  .day-cell{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;}
  .day-dot{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:var(--muted);}
  .day-dot.active{background:rgba(96,165,250,.25);color:#60a5fa;border:1px solid rgba(96,165,250,.4);}
  .day-dot.best{background:#60a5fa;color:#fff;border:none;}
  .day-name{font-size:.6rem;color:var(--muted);}
  .energy-chart{display:flex;gap:6px;align-items:flex-end;height:60px;margin-top:8px;}
  .energy-bar-col{display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;}
  .energy-bar{width:100%;border-radius:3px 3px 0 0;min-height:3px;}
  .energy-lbl{font-size:.6rem;color:var(--muted);}

  /* Recurring Tasks */
  .rt-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;}
  .rt-add-form{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;margin-bottom:18px;}
  .rt-add-form h4{margin:0 0 12px;font-size:.88rem;font-weight:800;}
  .rt-form-row{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:10px;}
  .rt-form-row>*{flex:1;min-width:120px;}
  .rt-templates{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
  .rt-tpl-btn{padding:5px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:none;color:var(--muted);cursor:pointer;font-size:.75rem;font-weight:700;transition:all .15s;white-space:nowrap;}
  .rt-tpl-btn:hover{background:rgba(255,255,255,.07);color:var(--text);}
  .rt-item{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);margin-bottom:8px;transition:border-color .15s;}
  .rt-item.paused-item{opacity:.5;}
  .rt-item-body{flex:1;min-width:0;}
  .rt-item-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  .rt-item-title{font-size:.9rem;font-weight:700;color:var(--text);}
  .rt-item-meta{font-size:.72rem;color:var(--muted);margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;}
  .rt-item-actions{display:flex;gap:5px;flex-shrink:0;align-items:center;}
  .rt-freq{padding:2px 7px;border-radius:5px;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;}
  .rt-freq.daily{background:rgba(96,165,250,.15);color:#60a5fa;}
  .rt-freq.weekly{background:rgba(168,85,247,.15);color:#a855f7;}
  .rt-freq.monthly{background:rgba(245,158,11,.15);color:#f59e0b;}
  .rt-freq.interval{background:rgba(52,211,153,.15);color:#34d399;}
  .rt-cat{padding:2px 7px;border-radius:5px;font-size:.66rem;font-weight:700;}
  .rt-priority-high{padding:2px 7px;border-radius:5px;font-size:.66rem;background:rgba(248,113,113,.15);color:#f87171;}
  .rt-priority-medium{padding:2px 7px;border-radius:5px;font-size:.66rem;background:rgba(251,191,36,.15);color:#fbbf24;}
  .rt-priority-low{padding:2px 7px;border-radius:5px;font-size:.66rem;background:rgba(148,163,184,.1);color:var(--muted);}
  .rt-pause-all{padding:6px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:none;color:var(--muted);cursor:pointer;font-size:.8rem;font-weight:700;transition:all .15s;}
  .rt-pause-all.paused-state{background:rgba(245,158,11,.12);border-color:#f59e0b;color:#f59e0b;}
  .rt-small-btn{padding:3px 8px;border-radius:7px;border:1px solid rgba(255,255,255,.1);background:none;color:var(--muted);cursor:pointer;font-size:.72rem;transition:all .14s;}
  .rt-small-btn:hover{background:rgba(255,255,255,.07);color:var(--text);}
  .rt-skip-btn:hover{color:#fbbf24;border-color:rgba(251,191,36,.3);}
  .rt-del-btn:hover{color:#f87171;border-color:rgba(248,113,113,.3);}
  .rt-empty{text-align:center;padding:40px 0;color:var(--muted);font-size:.88rem;}
  `;
  document.head.appendChild(styleEl);

  // ── Helpers ───────────────────────────────────────────────────────────
  function ls(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function lss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toast(msg) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e293b;color:#e2e8f0;padding:10px 20px;border-radius:30px;font-size:.85rem;font-weight:700;z-index:12000;box-shadow:0 8px 24px rgba(0,0,0,.4);pointer-events:none;transition:opacity .3s;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 2200);
  }
  function addDays(dateStr, n) { var d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  // ── Habits data ───────────────────────────────────────────────────────
  function getHabitsData() {
    var d = ls('homer-habits') || {};
    return {
      habits: Array.isArray(d.habits) ? d.habits : (Array.isArray(d) ? d : []),
      completions: (d && !Array.isArray(d) && d.completions) ? d.completions : {}
    };
  }
  function calcStreak(habit, completions) {
    var d = new Date(), streak = 0, target = (habit.target && habit.target > 1) ? habit.target : 1;
    for (var i = 0; i < 366; i++) {
      var k = d.toISOString().slice(0, 10);
      var v = completions[habit.id + ':' + k];
      if ((v === true ? 1 : (Number(v) || 0)) >= target) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }
  function calcCompletionRate(habit, completions, days) {
    var now = new Date(), done = 0, scheduled = 0;
    for (var i = 0; i < days; i++) {
      var d2 = new Date(now); d2.setDate(d2.getDate() - i);
      var k = d2.toISOString().slice(0, 10);
      // Check if scheduled that day
      var dayOfWeek = d2.getDay();
      var isScheduled = !habit.freq || habit.freq === 'daily' ||
        (Array.isArray(habit.freq) && habit.freq.indexOf(dayOfWeek) !== -1);
      if (isScheduled) {
        scheduled++;
        var v = completions[habit.id + ':' + k];
        var target = (habit.target && habit.target > 1) ? habit.target : 1;
        if ((v === true ? 1 : (Number(v) || 0)) >= target) done++;
      }
    }
    return scheduled ? Math.round((done / scheduled) * 100) : 0;
  }

  // ── Tab System Patch ──────────────────────────────────────────────────
  var MY_TABS = ['notes', 'analytics', 'recurring'];
  function patchTabSystem() {
    var orig = window._homerShowTab;
    if (!orig || orig._hn) return;
    function patched(name) {
      MY_TABS.forEach(function (tab) { var el = document.getElementById('tab-' + tab); if (el) el.style.display = 'none'; });
      orig(name);
      if (MY_TABS.indexOf(name) !== -1) { var el = document.getElementById('tab-' + name); if (el) el.style.display = 'block'; }
      document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
      // Direction-aware tab transition animation
      var shown = document.getElementById('tab-' + name);
      if (shown) {
        var dir = window._homerSwipeDir || '';
        window._homerSwipeDir = '';
        shown.classList.remove('tab-anim', 'tab-anim-right', 'tab-anim-left');
        void shown.offsetWidth; // force reflow
        shown.classList.add(dir === 'right' ? 'tab-anim-right' : dir === 'left' ? 'tab-anim-left' : 'tab-anim');
      }
    }
    patched._hn = true;
    window._homerShowTab = patched;
    // When any non-custom tab activates via app-shell's local showTab (which bypasses
    // our patch), hide MY_TABS so their content doesn't bleed into other tabs.
    if (!window._hnTabHideBound) {
      window._hnTabHideBound = true;
      window.addEventListener('homer-tab-change', function (e) {
        var name = e && e.detail && e.detail.tab;
        if (!name || MY_TABS.indexOf(name) !== -1) return;
        MY_TABS.forEach(function (t) {
          var el = document.getElementById('tab-' + t);
          if (el && el.style.display !== 'none') el.style.display = 'none';
        });
      });
    }
    MY_TABS.forEach(function (tab) {
      document.querySelectorAll('[data-tab="' + tab + '"]').forEach(function (btn) {
        if (!btn._hnWired) { btn._hnWired = true; btn.addEventListener('click', function () { patched(tab); }); }
      });
    });
  }

  // ── Quick Capture ─────────────────────────────────────────────────────
  var qcEl = null, qcType = 'inbox';
  function buildQC() {
    var el = document.createElement('div'); el.id = 'qc-overlay';
    el.innerHTML =
      '<div id="qc-box">' +
        '<div class="hn-modal-head"><h3>&#9889; Quick Capture</h3><button class="hn-close-btn" id="qc-x">&times;</button></div>' +
        '<div class="qc-type-row"><button class="qc-type-btn active" data-t="inbox">Inbox</button><button class="qc-type-btn" data-t="note">Note</button><button class="qc-type-btn" data-t="task">Task</button></div>' +
        '<input id="qc-title" class="hn-field" type="text" placeholder="What\'s on your mind?">' +
        '<textarea id="qc-detail" class="hn-field hn-textarea" placeholder="Details (optional)..." style="display:none;"></textarea>' +
        '<div class="hn-actions"><button id="qc-cancel" class="btn ghost">Cancel</button><button id="qc-save" class="btn primary">Capture</button></div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('#qc-x').onclick = hideQC; el.querySelector('#qc-cancel').onclick = hideQC;
    el.addEventListener('click', function (e) { if (e.target === el) hideQC(); });
    el.querySelectorAll('.qc-type-btn').forEach(function (b) {
      b.onclick = function () {
        qcType = b.dataset.t; el.querySelectorAll('.qc-type-btn').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active');
        el.querySelector('#qc-detail').style.display = qcType === 'note' ? 'block' : 'none';
      };
    });
    el.querySelector('#qc-save').onclick = doQCSave;
    el.querySelector('#qc-title').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doQCSave(); } });
    return el;
  }
  function showQC(type) {
    if (!qcEl) qcEl = buildQC();
    qcType = type || 'inbox';
    qcEl.querySelectorAll('.qc-type-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.t === qcType); });
    qcEl.querySelector('#qc-title').value = ''; qcEl.querySelector('#qc-detail').value = '';
    qcEl.querySelector('#qc-detail').style.display = qcType === 'note' ? 'block' : 'none';
    qcEl.style.display = 'flex'; setTimeout(function () { qcEl.querySelector('#qc-title').focus(); }, 50);
  }
  function hideQC() { if (qcEl) qcEl.style.display = 'none'; }
  function doQCSave() {
    var title = (qcEl.querySelector('#qc-title').value || '').trim(), detail = (qcEl.querySelector('#qc-detail').value || '').trim();
    if (!title) { qcEl.querySelector('#qc-title').focus(); return; }
    if (qcType === 'inbox') { var inbox = ls('homer-inbox') || []; inbox.unshift({ id: uid(), text: title, note: detail, date: new Date().toISOString(), done: false }); lss('homer-inbox', inbox); window.dispatchEvent(new CustomEvent('homer:inbox-updated')); }
    else if (qcType === 'note') { createNote(title, detail); }
    else if (qcType === 'task') { var tasks = ls('homer-task-list') || []; tasks.unshift({ id: uid(), text: title, done: false, note: detail, created: new Date().toISOString() }); lss('homer-task-list', tasks); }
    hideQC(); toast('Captured to ' + qcType); syncCtx();
  }

  // ── Notes System ──────────────────────────────────────────────────────
  var NKEY = 'homer-notes', curNoteId = null, saveTimer = null;
  function getNotes() { return ls(NKEY) || []; }
  function setNotes(a) { lss(NKEY, a); }
  function createNote(title, content, isDaily) {
    var note = { id: uid(), title: title || 'Untitled', content: content || '', daily: !!isDaily, date: todayStr(), created: new Date().toISOString(), updated: new Date().toISOString() };
    var notes = getNotes(); notes.unshift(note); setNotes(notes); renderNoteList(); openNote(note.id); return note;
  }
  function ensureDaily() {
    var notes = getNotes(), t = todayStr(), ex = notes.find(function (n) { return n.daily && n.date === t; });
    if (!ex) { var d = new Date(); var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; ex = createNote(days[d.getDay()] + ' — ' + d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), '', true); }
    return ex;
  }
  function openNote(id) {
    curNoteId = id; var note = getNotes().find(function (n) { return n.id === id; }); if (!note) return;
    var t = document.getElementById('notes-title'), b = document.getElementById('notes-body');
    if (t) t.value = note.title; if (b) b.value = note.content;
    document.querySelectorAll('.note-item').forEach(function (el) { el.classList.toggle('active', el.dataset.id === id); });
    var st = document.getElementById('notes-status'); if (st) st.textContent = 'Saved ' + fmtDate(note.updated);
  }
  function saveNote() {
    if (!curNoteId) return;
    var t = document.getElementById('notes-title'), b = document.getElementById('notes-body'); if (!t || !b) return;
    var notes = getNotes(), note = notes.find(function (n) { return n.id === curNoteId; }); if (!note) return;
    note.title = t.value || 'Untitled'; note.content = b.value; note.updated = new Date().toISOString();
    setNotes(notes); renderNoteList();
    var st = document.getElementById('notes-status'); if (st) st.textContent = 'Saved';
    syncCtx(); pushNotesToDrive();
  }
  function delNote() {
    if (!curNoteId || !confirm('Delete this note?')) return;
    setNotes(getNotes().filter(function (n) { return n.id !== curNoteId; })); curNoteId = null; renderNoteList();
    var notes = getNotes(); if (notes.length) openNote(notes[0].id);
    else { var t = document.getElementById('notes-title'), b = document.getElementById('notes-body'); if (t) t.value = ''; if (b) b.value = ''; }
  }
  function renderNoteList() {
    var el = document.getElementById('notes-list'); if (!el) return;
    var notes = getNotes(); el.innerHTML = '';
    if (!notes.length) { el.innerHTML = '<p style="color:var(--muted);font-size:.83rem;text-align:center;padding:18px 0;">No notes yet</p>'; return; }
    notes.forEach(function (n) {
      var d = document.createElement('div'); d.className = 'note-item' + (n.id === curNoteId ? ' active' : ''); d.dataset.id = n.id;
      d.innerHTML = '<div class="note-item-title">' + (n.daily ? '&#128197; ' : '') + esc(n.title) + '</div><div class="note-item-date">' + fmtDate(n.updated || n.created) + '</div>';
      d.onclick = function () { openNote(n.id); }; el.appendChild(d);
    });
  }
  function initNotesTab() {
    var tab = document.getElementById('tab-notes'); if (!tab || tab.dataset.init) return; tab.dataset.init = '1';
    tab.innerHTML =
      '<h2 class="section">Notes</h2>' +
      '<div class="notes-layout">' +
        '<div class="notes-sidebar-col"><div class="notes-sb-head"><h4>All Notes</h4><button id="note-new" class="btn primary" style="padding:4px 11px;font-size:.78rem;">+ New</button></div><div id="notes-list"></div></div>' +
        '<div class="notes-editor-col">' +
          '<div class="notes-tb"><button class="notes-tb-btn" id="note-today">Today\'s Note</button><button class="notes-tb-btn" id="note-review-btn">Weekly Review</button><span style="flex:1;"></span><button class="notes-tb-btn danger" id="note-del">Delete</button></div>' +
          '<input id="notes-title" class="hn-field" type="text" placeholder="Note title..." style="font-size:1.1rem;font-weight:800;">' +
          '<textarea id="notes-body" class="hn-field hn-textarea" placeholder="Write here... (Ctrl+S to save)" style="min-height:320px;line-height:1.72;"></textarea>' +
          '<div class="notes-footer"><span id="notes-status" style="font-size:.78rem;color:var(--muted);"></span><button id="note-save" class="btn primary">Save</button></div>' +
        '</div>' +
      '</div>';
    document.getElementById('note-new').onclick = function () { createNote('', '', false); };
    document.getElementById('note-today').onclick = function () { openNote(ensureDaily().id); };
    document.getElementById('note-review-btn').onclick = showWR;
    document.getElementById('note-del').onclick = delNote;
    document.getElementById('note-save').onclick = saveNote;
    var body = document.getElementById('notes-body'), ttl = document.getElementById('notes-title');
    function sched() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNote, 1600); var st = document.getElementById('notes-status'); if (st) st.textContent = 'Unsaved...'; }
    body.addEventListener('input', sched); ttl.addEventListener('input', sched);
    body.addEventListener('keydown', function (e) { if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveNote(); } });
    renderNoteList(); var notes = getNotes(); if (notes.length && !curNoteId) openNote(notes[0].id);
  }

  // ── Analytics ─────────────────────────────────────────────────────────
  var anRange = 30; // default date range in days

  function daysAgoStr(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

  function initAnalyticsTab() {
    var tab = document.getElementById('tab-analytics'); if (!tab) return;

    var hd = getHabitsData(), habits = hd.habits, completions = hd.completions;
    var expenses = ls('homer-expenses') || []; if (!Array.isArray(expenses)) expenses = [];
    var sessions = ls('homer-sessions') || []; if (!Array.isArray(sessions)) sessions = [];
    var reviews = ls('homer-weekly-reviews') || []; if (!Array.isArray(reviews)) reviews = [];
    var budgets = ls('homer-expense-budgets') || { food: 1500, transport: 400, work: 500, health: 300, entertainment: 300, other: 200 };
    var rangeStart = daysAgoStr(anRange);

    // Filter by range
    var rangeExpenses = expenses.filter(function (e) { return (e.date || '') >= rangeStart; });
    var rangeSessions = sessions.filter(function (s) { return (s.date || '') >= rangeStart; });

    // ─── Summary row ───────────────────────────────────────────────────
    // This period vs previous period
    var prevStart = daysAgoStr(anRange * 2), prevEnd = rangeStart;
    var prevExpenses = expenses.filter(function (e) { return (e.date || '') >= prevStart && (e.date || '') < prevEnd; });
    var curSpend = rangeExpenses.reduce(function (s, e) { return s + parseFloat(e.amount || 0); }, 0);
    var prevSpend = prevExpenses.reduce(function (s, e) { return s + parseFloat(e.amount || 0); }, 0);
    var spendDelta = prevSpend ? Math.round(((curSpend - prevSpend) / prevSpend) * 100) : 0;
    var curSessions = rangeSessions.length;
    var prevSessions = sessions.filter(function (s) { return (s.date || '') >= prevStart && (s.date || '') < prevEnd; }).length;
    var focusDelta = prevSessions ? Math.round(((curSessions - prevSessions) / prevSessions) * 100) : 0;
    var avgHabitRate = habits.length ? Math.round(habits.reduce(function (s, h) { return s + calcCompletionRate(h, completions, anRange); }, 0) / habits.length) : 0;
    var prevAvgRate = habits.length ? Math.round(habits.reduce(function (s, h) { return s + calcCompletionRate(h, completions, anRange * 2); }, 0) / habits.length) : 0;
    var habitDelta = prevAvgRate ? (avgHabitRate - prevAvgRate) : 0;

    function deltaHtml(d) { if (!d) return '<div class="an-summary-delta flat">no change</div>'; return d > 0 ? '<div class="an-summary-delta up">&#9650; ' + Math.abs(d) + '% vs prev</div>' : '<div class="an-summary-delta down">&#9660; ' + Math.abs(d) + '% vs prev</div>'; }

    var summaryHtml =
      '<div class="an-summary-card"><div class="an-summary-val">' + Math.round(curSpend) + '</div><div class="an-summary-lbl">Total Spend (' + anRange + 'd)</div>' + (spendDelta ? '<div class="an-summary-delta ' + (spendDelta > 0 ? 'down' : 'up') + '">' + (spendDelta > 0 ? '&#9650;' : '&#9660;') + ' ' + Math.abs(spendDelta) + '% vs prev</div>' : '') + '</div>' +
      '<div class="an-summary-card"><div class="an-summary-val">' + curSessions + '</div><div class="an-summary-lbl">Focus Sessions</div>' + deltaHtml(focusDelta) + '</div>' +
      '<div class="an-summary-card"><div class="an-summary-val">' + avgHabitRate + '%</div><div class="an-summary-lbl">Habit Completion</div>' + deltaHtml(habitDelta) + '</div>' +
      '<div class="an-summary-card"><div class="an-summary-val">' + habits.reduce(function (m, h) { return Math.max(m, calcStreak(h, completions)); }, 0) + '</div><div class="an-summary-lbl">Best Streak (days)</div></div>';

    // ─── Habit streaks + completion rate ──────────────────────────────
    var streakHtml = habits.length
      ? '<div class="streak-row">' + habits.map(function (h) {
          var rate = calcCompletionRate(h, completions, anRange);
          return '<div class="streak-badge"><div class="streak-num">' + calcStreak(h, completions) + '</div><div class="streak-lbl">' + esc(h.name || 'Habit') + '</div><div class="streak-rate">' + rate + '% done</div></div>';
        }).join('') + '</div>'
      : '<p style="color:var(--muted);font-size:.84rem;">No habits tracked yet.</p>';

    // ─── Best day of week ──────────────────────────────────────────────
    var dayTotals = [0,0,0,0,0,0,0];
    Object.keys(completions).forEach(function (key) {
      var date = key.slice(-10);
      if (date < rangeStart) return;
      var v = completions[key]; var count = (v === true) ? 1 : (Number(v) || 0);
      if (count > 0) { var d2 = new Date(date); if (!isNaN(d2)) dayTotals[d2.getDay()]++; }
    });
    var maxDay = Math.max.apply(null, dayTotals) || 1;
    var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var bestDayIdx = dayTotals.indexOf(Math.max.apply(null, dayTotals));
    var dayHtml = '<div class="day-row">' + dayNames.map(function (dn, i) {
      var cls = dayTotals[i] === 0 ? '' : (i === bestDayIdx ? 'best' : (dayTotals[i] > maxDay * 0.6 ? 'active' : ''));
      return '<div class="day-cell"><div class="day-dot ' + cls + '">' + dayTotals[i] + '</div><div class="day-name">' + dn + '</div></div>';
    }).join('') + '</div>';

    // ─── Heatmap ──────────────────────────────────────────────────────
    var today = new Date(), hmDays = [];
    for (var i = 111; i >= 0; i--) { var dd = new Date(today); dd.setDate(dd.getDate() - i); hmDays.push(dd.toISOString().slice(0, 10)); }
    var dayCounts = {}; hmDays.forEach(function (d2) { dayCounts[d2] = 0; });
    Object.keys(completions).forEach(function (key) {
      var date = key.slice(-10); var v = completions[key]; var count = (v === true) ? 1 : (Number(v) || 0);
      if (count > 0 && dayCounts[date] !== undefined) dayCounts[date]++;
    });
    var maxC = habits.length || 1;
    var hmHtml = '<div class="hm-grid">';
    for (var w = 0; w < 16; w++) {
      hmHtml += '<div class="hm-col">';
      for (var wd = 0; wd < 7; wd++) { var day = hmDays[w * 7 + wd]; var c = day ? (dayCounts[day] || 0) : 0; var vi = c === 0 ? 0 : Math.min(Math.ceil((c / maxC) * 4), 4); hmHtml += '<div class="hm-cell" data-v="' + vi + '" title="' + esc(day || '') + ': ' + c + ' habits"></div>'; }
      hmHtml += '</div>';
    }
    hmHtml += '</div><div style="display:flex;align-items:center;gap:4px;margin-top:7px;font-size:.68rem;color:var(--muted);">Less ';
    for (var li = 0; li <= 4; li++) hmHtml += '<div class="hm-cell" data-v="' + li + '" style="width:10px;height:10px;"></div>';
    hmHtml += ' More</div>';

    // ─── Focus sessions bar (last 14 days) ────────────────────────────
    var focusDays = [];
    for (var fi = 13; fi >= 0; fi--) { var fd = new Date(); fd.setDate(fd.getDate() - fi); focusDays.push({ key: fd.toISOString().slice(0, 10), lbl: ['Su','Mo','Tu','We','Th','Fr','Sa'][fd.getDay()], count: 0 }); }
    sessions.forEach(function (s) { var key = (s.date || '').slice(0, 10); var fd2 = focusDays.find(function (d2) { return d2.key === key; }); if (fd2) fd2.count++; });
    var maxF = Math.max.apply(null, focusDays.map(function (d2) { return d2.count; })) || 1;
    var focusBarHtml = '<div class="bar-chart">' + focusDays.map(function (d2) {
      var pct = Math.round((d2.count / maxF) * 100);
      return '<div class="bar-col"><div class="bar-val" style="color:#a78bfa;">' + (d2.count || '') + '</div><div class="bar-fill purple" style="height:' + Math.max(pct, d2.count ? 8 : 3) + 'px;"></div><div class="bar-lbl">' + d2.lbl + '</div></div>';
    }).join('') + '</div>';
    var totalFocusMin = rangeSessions.length * 25;

    // ─── Expense bar (6 months) ───────────────────────────────────────
    var months = [];
    var now2 = new Date();
    for (var mi = 5; mi >= 0; mi--) { var md = new Date(now2.getFullYear(), now2.getMonth() - mi, 1); months.push({ key: md.getFullYear() + '-' + String(md.getMonth() + 1).padStart(2, '0'), lbl: md.toLocaleDateString(undefined, { month: 'short' }), total: 0 }); }
    expenses.forEach(function (e) { var k = (e.date || '').slice(0, 7); var m = months.find(function (x) { return x.key === k; }); if (m) m.total += parseFloat(e.amount || 0); });
    var maxM = Math.max.apply(null, months.map(function (m) { return m.total; })) || 1;
    var barHtml = '<div class="bar-chart">' + months.map(function (m) {
      var pct = Math.round((m.total / maxM) * 100);
      return '<div class="bar-col"><div class="bar-val">' + (m.total > 0 ? Math.round(m.total) : '') + '</div><div class="bar-fill" style="height:' + Math.max(pct, m.total ? 8 : 3) + 'px;"></div><div class="bar-lbl">' + m.lbl + '</div></div>';
    }).join('') + '</div>';

    // ─── Categories + MoM delta ────────────────────────────────────────
    var curMoKey = new Date().toISOString().slice(0, 7), prevMoKey = (function () { var d2 = new Date(); d2.setMonth(d2.getMonth() - 1); return d2.toISOString().slice(0, 7); })();
    var curMoCats = {}, prevMoCats = {};
    expenses.forEach(function (e) {
      var c = e.cat || e.category || 'other';
      if ((e.date || '').slice(0, 7) === curMoKey) curMoCats[c] = (curMoCats[c] || 0) + parseFloat(e.amount || 0);
      if ((e.date || '').slice(0, 7) === prevMoKey) prevMoCats[c] = (prevMoCats[c] || 0) + parseFloat(e.amount || 0);
    });
    var catEntries = Object.keys(curMoCats).map(function (k) { return [k, curMoCats[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    var catTotal = catEntries.reduce(function (s, e) { return s + e[1]; }, 0) || 1;
    var colors = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#818cf8'];
    var catHtml = catEntries.length
      ? catEntries.map(function (e, i) {
          var pct = Math.round((e[1] / catTotal) * 100);
          var prev = prevMoCats[e[0]] || 0; var delta = prev ? Math.round(((e[1] - prev) / prev) * 100) : 0;
          var deltaHtml2 = delta ? '<span class="cat-delta ' + (delta > 0 ? 'up' : 'down') + '">' + (delta > 0 ? '&#9650;' : '&#9660;') + Math.abs(delta) + '%</span>' : '';
          return '<div class="cat-row"><div class="cat-dot" style="background:' + colors[i % 6] + ';"></div><div class="cat-name">' + esc(e[0]) + deltaHtml2 + '</div><div class="cat-amt">' + Math.round(e[1]) + '</div></div>' +
            '<div class="cat-bar-bg"><div class="cat-bar-fg" style="width:' + pct + '%;background:' + colors[i % 6] + ';"></div></div>';
        }).join('')
      : '<p style="color:var(--muted);font-size:.84rem;">No expenses this month.</p>';

    // ─── Budget progress ──────────────────────────────────────────────
    var curMonthTotal = expenses.filter(function (e) { return (e.date || '').slice(0, 7) === curMoKey; }).reduce(function (s, e) { return s + parseFloat(e.amount || 0); }, 0);
    var budgetCats = Object.keys(budgets).slice(0, 6);
    var budgetHtml = budgetCats.map(function (cat) {
      var spent = (curMoCats[cat] || 0), budget = budgets[cat] || 1;
      var pct = Math.min(Math.round((spent / budget) * 100), 100);
      var over = spent > budget, warn = spent > budget * 0.8;
      var fill = over ? '#f87171' : (warn ? '#fbbf24' : '#34d399');
      return '<div class="budget-row"><div class="budget-lbl">' + esc(cat) + '</div><div class="budget-track"><div class="budget-fill" style="width:' + pct + '%;background:' + fill + ';"></div></div><div class="budget-info ' + (over ? 'over' : (warn ? 'warn' : '')) + '">' + Math.round(spent) + ' / ' + budget + '</div></div>';
    }).join('');

    // ─── Energy trend (weekly reviews) ───────────────────────────────
    var recentReviews = reviews.slice(0, 8).reverse();
    var energyHtml = recentReviews.length
      ? '<div class="energy-chart">' + recentReviews.map(function (r) {
          var e2 = r.energy || 3; var pct = (e2 / 5) * 100;
          var col = e2 >= 4 ? '#34d399' : (e2 >= 3 ? '#60a5fa' : '#f87171');
          return '<div class="energy-bar-col"><div class="energy-bar" style="height:' + Math.max(pct * 0.55, 4) + 'px;background:' + col + ';border-radius:3px 3px 0 0;width:100%;"></div><div class="energy-lbl">' + e2 + '</div></div>';
        }).join('') + '</div><div style="font-size:.72rem;color:var(--muted);margin-top:5px;">Last ' + recentReviews.length + ' weekly reviews</div>'
      : '<p style="color:var(--muted);font-size:.84rem;">No weekly reviews yet. Use Notes → Weekly Review.</p>';

    // ─── Render ───────────────────────────────────────────────────────
    tab.innerHTML =
      '<h2 class="section">Analytics</h2>' +
      '<div class="an-filter-bar">' +
        [7, 30, 90].map(function (d2) { return '<button class="an-range-btn' + (anRange === d2 ? ' active' : '') + '" data-range="' + d2 + '">' + d2 + ' days</button>'; }).join('') +
        '<span style="flex:1;"></span>' +
        '<button id="an-csv-btn" class="notes-tb-btn">&#11015; Export CSV</button>' +
      '</div>' +
      '<div class="an-summary-row">' + summaryHtml + '</div>' +
      '<div class="an-grid">' +
        '<div class="an-card"><h4>Habit Streaks &amp; Completion Rate</h4>' + streakHtml + '</div>' +
        '<div class="an-card"><h4>Best Day of Week</h4>' + dayHtml + '</div>' +
        '<div class="an-card an-card-full"><h4>Habit Heatmap (16 weeks)</h4>' + hmHtml + '</div>' +
        '<div class="an-card"><h4>Focus Sessions (last 14 days) &mdash; ~' + totalFocusMin + ' min</h4>' + focusBarHtml + '</div>' +
        '<div class="an-card"><h4>Weekly Energy Trend</h4>' + energyHtml + '</div>' +
        '<div class="an-card"><h4>Monthly Spend</h4>' + barHtml + '</div>' +
        '<div class="an-card"><h4>This Month by Category</h4>' + catHtml + '</div>' +
        '<div class="an-card an-card-full"><h4>Budget Progress &mdash; ' + curMoKey + ' &nbsp; Total: ' + Math.round(curMonthTotal) + '</h4>' + budgetHtml + '</div>' +
      '</div>';

    tab.querySelectorAll('.an-range-btn').forEach(function (btn) {
      btn.onclick = function () { anRange = parseInt(btn.dataset.range); initAnalyticsTab(); };
    });
    var csvBtn = document.getElementById('an-csv-btn');
    if (csvBtn) csvBtn.onclick = exportAnalyticsCSV;
  }

  function exportAnalyticsCSV() {
    var expenses = ls('homer-expenses') || [];
    var hd = getHabitsData();
    var sessions = ls('homer-sessions') || [];
    var rows = ['Type,Date,Label,Amount/Value'];
    expenses.forEach(function (e) { rows.push('Expense,' + (e.date || '') + ',' + esc(e.desc || '') + ',' + (e.amount || '')); });
    hd.habits.forEach(function (h) {
      Object.keys(hd.completions).forEach(function (key) {
        if (key.indexOf(h.id + ':') === 0) { var date = key.slice(-10); var v = hd.completions[key]; rows.push('Habit,' + date + ',' + esc(h.name || '') + ',' + (v === true ? 1 : (Number(v) || 0))); }
      });
    });
    sessions.forEach(function (s) { rows.push('Session,' + (s.date || '').slice(0, 10) + ',' + esc(s.accomplished || '') + ',25'); });
    var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'homer-analytics-' + todayStr() + '.csv'; a.click();
  }

  // ── Recurring Tasks ───────────────────────────────────────────────────
  var RTKEY = 'homer-recurring';
  var RT_CATS = { health: '#34d399', work: '#60a5fa', personal: '#a78bfa', finance: '#fbbf24', fitness: '#f87171' };
  var RT_TEMPLATES = [
    { title: 'Morning Routine', freq: 'daily', category: 'health', priority: 'high', injectTo: 'inbox' },
    { title: 'Weekly Review', freq: 'weekly', days: [1], category: 'personal', priority: 'medium', injectTo: 'inbox' },
    { title: 'Monthly Budget Check', freq: 'monthly', dayOfMonth: 1, category: 'finance', priority: 'high', injectTo: 'inbox' },
    { title: 'End of Week Wrap-up', freq: 'weekly', days: [5], category: 'work', priority: 'medium', injectTo: 'inbox' },
    { title: 'Quarterly Planning', freq: 'interval', intervalDays: 90, category: 'personal', priority: 'high', injectTo: 'inbox' }
  ];

  function getRT() { return ls(RTKEY) || []; }
  function setRT(a) { lss(RTKEY, a); }

  function calcNextDue(task) {
    var t = todayStr();
    if (!task.enabled) return 'paused';
    if (task.freq === 'daily') {
      return task.lastFired === t ? 'Tomorrow' : 'Today';
    }
    if (task.freq === 'weekly') {
      if (!task.lastFired) return 'Today';
      var days = task.days && task.days.length ? task.days : [1];
      var now = new Date(); var nowDay = now.getDay();
      var daysUntil = days.map(function (d2) { var diff = (d2 - nowDay + 7) % 7; return diff === 0 ? 7 : diff; });
      var min = Math.min.apply(null, daysUntil);
      var daysDiff = daysBetween(task.lastFired, t);
      if (daysDiff >= 7) return 'Today';
      return 'In ' + min + ' day' + (min === 1 ? '' : 's');
    }
    if (task.freq === 'monthly') {
      if (!task.lastFired) return 'Today';
      var lf = new Date(task.lastFired), now3 = new Date();
      if (now3.getMonth() !== lf.getMonth() || now3.getFullYear() !== lf.getFullYear()) return 'Today';
      return 'Next month';
    }
    if (task.freq === 'interval') {
      if (!task.lastFired) return 'Today';
      var elapsed = daysBetween(task.lastFired, t);
      var remaining = (task.intervalDays || 7) - elapsed;
      return remaining <= 0 ? 'Today' : 'In ' + remaining + 'd';
    }
    return '—';
  }

  function checkRecurring() {
    var tasks = getRT(), t = todayStr();
    var inbox = ls('homer-inbox') || []; if (!Array.isArray(inbox)) inbox = [];
    var pomTasks = ls('homer-task-list') || []; if (!Array.isArray(pomTasks)) pomTasks = [];
    var changed = false;
    tasks.forEach(function (task) {
      if (!task.enabled || task.paused) return;
      var fire = false;
      if (task.freq === 'daily') fire = task.lastFired !== t;
      else if (task.freq === 'weekly') {
        if (!task.lastFired) { fire = true; }
        else {
          var daysDiff = daysBetween(task.lastFired, t);
          if (daysDiff >= 7) fire = true;
          else if (task.days && task.days.length) {
            var todayDayOfWeek = new Date().getDay();
            fire = task.days.indexOf(todayDayOfWeek) !== -1 && task.lastFired !== t;
          }
        }
      }
      else if (task.freq === 'monthly') {
        var lf = task.lastFired ? new Date(task.lastFired) : null;
        var now3 = new Date();
        if (!lf || (now3.getMonth() !== lf.getMonth() || now3.getFullYear() !== lf.getFullYear())) {
          if (task.dayOfMonth) fire = new Date().getDate() >= task.dayOfMonth;
          else fire = true;
        }
      }
      else if (task.freq === 'interval') {
        var elapsed = task.lastFired ? daysBetween(task.lastFired, t) : 999;
        fire = elapsed >= (task.intervalDays || 7);
      }

      if (fire) {
        var item = { id: uid(), text: (task.priority === 'high' ? '🔴 ' : task.priority === 'medium' ? '🟡 ' : '') + '[Recurring] ' + task.title, date: new Date().toISOString(), done: false, recurringId: task.id };
        if (task.dueDate) item.dueDate = task.dueDate;
        if (task.injectTo === 'tasks') {
          pomTasks.unshift({ id: uid(), text: item.text, done: false, created: new Date().toISOString() });
        } else {
          inbox.unshift(item);
        }
        if (!task.completions) task.completions = { fired: 0 };
        task.completions.fired = (task.completions.fired || 0) + 1;
        task.lastFired = t;
        changed = true;
      }
    });
    if (changed) {
      setRT(tasks); lss('homer-inbox', inbox); lss('homer-task-list', pomTasks);
      window.dispatchEvent(new CustomEvent('homer:inbox-updated'));
    }
  }

  function skipOccurrence(taskId) {
    var arr = getRT(), task = arr.find(function (x) { return x.id === taskId; });
    if (!task) return;
    task.lastFired = todayStr();
    if (!task.completions) task.completions = { fired: 0 };
    task.completions.fired = (task.completions.fired || 0) + 1;
    setRT(arr);
    initRecurringTab();
    toast('Skipped — will fire next occurrence');
  }

  function initRecurringTab() {
    var tab = document.getElementById('tab-recurring'); if (!tab) return;
    var tasks = getRT();
    var allPaused = tasks.length && tasks.every(function (t) { return t.paused; });

    var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    tab.innerHTML =
      '<h2 class="section">Recurring Tasks</h2>' +
      '<div class="rt-header">' +
        '<p class="muted" style="margin:0;font-size:.86rem;">Auto-inject into inbox or tasks when due.</p>' +
        '<button id="rt-pause-all" class="rt-pause-all' + (allPaused ? ' paused-state' : '') + '">' + (allPaused ? '&#9654; Resume All' : '&#9646;&#9646; Pause All') + '</button>' +
      '</div>' +

      // Add form
      '<div class="rt-add-form">' +
        '<h4>&#43; New Recurring Task</h4>' +
        '<div class="hn-label">Quick Templates</div>' +
        '<div class="rt-templates">' +
          RT_TEMPLATES.map(function (t2) { return '<button class="rt-tpl-btn" data-tpl="' + esc(JSON.stringify(t2)) + '">' + esc(t2.title) + '</button>'; }).join('') +
        '</div>' +
        '<div class="rt-form-row">' +
          '<input id="rt-title" type="text" placeholder="Task title *" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);">' +
          '<select id="rt-freq" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="interval">Every N days</option></select>' +
          '<select id="rt-priority" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);"><option value="">No priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>' +
        '</div>' +
        '<div id="rt-freq-extra" style="margin-bottom:10px;"></div>' +
        '<div class="rt-form-row">' +
          '<select id="rt-cat" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);"><option value="">Category</option><option value="health">Health</option><option value="work">Work</option><option value="personal">Personal</option><option value="finance">Finance</option><option value="fitness">Fitness</option></select>' +
          '<select id="rt-inject" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);"><option value="inbox">&#128236; Inject to Inbox</option><option value="tasks">&#127813; Inject to Pomodoro Tasks</option></select>' +
          '<div style="display:flex;flex-direction:column;gap:3px;"><label style="font-size:.7rem;color:var(--muted);">Due date (optional)</label><input id="rt-due" type="date" style="padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);"></div>' +
        '</div>' +
        '<button id="rt-add" class="btn primary" style="width:100%;">Add Recurring Task</button>' +
      '</div>' +

      // List
      '<div id="rt-list">' + (!tasks.length ? '<div class="rt-empty">No recurring tasks yet. Add one above or use a template.</div>' : '') + '</div>';

    // Render task cards
    var listEl = document.getElementById('rt-list');
    tasks.forEach(function (task) {
      var nextDue = calcNextDue(task);
      var catColor = RT_CATS[task.category] || 'var(--muted)';
      var firedCount = (task.completions && task.completions.fired) || 0;
      var freqLabel = task.freq === 'interval' ? 'Every ' + (task.intervalDays || 7) + 'd' : task.freq;
      if (task.freq === 'weekly' && task.days && task.days.length) freqLabel += ' (' + task.days.map(function (d2) { return DAY_NAMES[d2]; }).join(',') + ')';
      if (task.freq === 'monthly' && task.dayOfMonth) freqLabel += ' (day ' + task.dayOfMonth + ')';

      var el = document.createElement('div');
      el.className = 'rt-item' + (task.paused ? ' paused-item' : '');
      el.innerHTML =
        '<input type="checkbox" style="accent-color:#60a5fa;width:15px;height:15px;cursor:pointer;flex-shrink:0;margin-top:2px;" ' + (task.enabled && !task.paused ? 'checked' : '') + '>' +
        '<div class="rt-item-body">' +
          '<div class="rt-item-top">' +
            '<span class="rt-item-title">' + esc(task.title) + '</span>' +
            '<span class="rt-freq ' + task.freq + '">' + esc(freqLabel) + '</span>' +
            (task.category ? '<span class="rt-cat" style="background:' + catColor + '22;color:' + catColor + ';">' + esc(task.category) + '</span>' : '') +
            (task.priority ? '<span class="rt-priority-' + task.priority + '">' + task.priority + '</span>' : '') +
            (task.injectTo === 'tasks' ? '<span style="font-size:.66rem;color:var(--muted);">&#8594; tasks</span>' : '') +
          '</div>' +
          '<div class="rt-item-meta">' +
            '<span>Next: <strong style="color:' + (nextDue === 'Today' ? '#34d399' : 'var(--text)') + ';">' + esc(nextDue) + '</strong></span>' +
            '<span>Fired: ' + firedCount + 'x</span>' +
            (task.lastFired ? '<span>Last: ' + fmtDate(task.lastFired) + '</span>' : '') +
            (task.dueDate ? '<span>Due: ' + fmtDate(task.dueDate) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="rt-item-actions">' +
          '<button class="rt-small-btn rt-skip-btn" title="Skip this occurrence">Skip</button>' +
          '<button class="rt-small-btn rt-pause-btn">' + (task.paused ? 'Resume' : 'Pause') + '</button>' +
          '<button class="rt-small-btn rt-del-btn" style="color:#f87171;">&#x2715;</button>' +
        '</div>';

      el.querySelector('input[type=checkbox]').onchange = function (e) {
        var arr = getRT(), x = arr.find(function (x) { return x.id === task.id; });
        if (x) { x.enabled = e.target.checked; setRT(arr); }
      };
      el.querySelector('.rt-skip-btn').onclick = function () { skipOccurrence(task.id); };
      el.querySelector('.rt-pause-btn').onclick = function () {
        var arr = getRT(), x = arr.find(function (x) { return x.id === task.id; });
        if (x) { x.paused = !x.paused; setRT(arr); initRecurringTab(); }
      };
      el.querySelector('.rt-del-btn').onclick = function () {
        if (!confirm('Delete "' + task.title + '"?')) return;
        setRT(getRT().filter(function (x) { return x.id !== task.id; })); initRecurringTab();
      };
      listEl.appendChild(el);
    });

    // Freq extra options
    var freqSel = document.getElementById('rt-freq');
    function updateFreqExtra() {
      var fe = document.getElementById('rt-freq-extra'); if (!fe) return;
      var f = freqSel.value;
      if (f === 'weekly') {
        fe.innerHTML = '<div class="hn-label">Which days?</div><div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          DAY_NAMES.map(function (dn, i) { return '<label style="display:flex;align-items:center;gap:4px;font-size:.8rem;cursor:pointer;"><input type="checkbox" class="rt-day-cb" value="' + i + '" style="accent-color:#60a5fa;">' + dn + '</label>'; }).join('') + '</div>';
      } else if (f === 'monthly') {
        fe.innerHTML = '<div class="hn-label">Day of month</div><input id="rt-dom" type="number" min="1" max="31" value="1" style="width:80px;padding:8px 10px;border-radius:9px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);">';
      } else if (f === 'interval') {
        fe.innerHTML = '<div class="hn-label">Every how many days?</div><input id="rt-interval" type="number" min="1" max="365" value="7" style="width:90px;padding:8px 10px;border-radius:9px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);">';
      } else {
        fe.innerHTML = '';
      }
    }
    freqSel.addEventListener('change', updateFreqExtra);

    // Templates
    tab.querySelectorAll('.rt-tpl-btn').forEach(function (btn) {
      btn.onclick = function () {
        try {
          var tpl = JSON.parse(btn.dataset.tpl);
          document.getElementById('rt-title').value = tpl.title || '';
          document.getElementById('rt-freq').value = tpl.freq || 'daily';
          document.getElementById('rt-cat').value = tpl.category || '';
          document.getElementById('rt-priority').value = tpl.priority || '';
          document.getElementById('rt-inject').value = tpl.injectTo || 'inbox';
          freqSel.dispatchEvent(new Event('change'));
          if (tpl.freq === 'weekly' && tpl.days) {
            setTimeout(function () { tpl.days.forEach(function (d2) { var cb = document.querySelector('.rt-day-cb[value="' + d2 + '"]'); if (cb) cb.checked = true; }); }, 50);
          }
        } catch (_) {}
      };
    });

    // Pause all
    document.getElementById('rt-pause-all').onclick = function () {
      var arr = getRT(); var shouldPause = !allPaused;
      arr.forEach(function (t2) { t2.paused = shouldPause; }); setRT(arr); initRecurringTab();
    };

    // Add button
    document.getElementById('rt-add').onclick = function () {
      var title = (document.getElementById('rt-title').value || '').trim();
      if (!title) { document.getElementById('rt-title').focus(); return; }
      var freq = document.getElementById('rt-freq').value;
      var task = {
        id: uid(), title: title, freq: freq, enabled: true, paused: false,
        category: document.getElementById('rt-cat').value,
        priority: document.getElementById('rt-priority').value,
        injectTo: document.getElementById('rt-inject').value,
        dueDate: document.getElementById('rt-due').value || null,
        lastFired: null, completions: { fired: 0 }, created: new Date().toISOString()
      };
      if (freq === 'weekly') {
        var cbs = document.querySelectorAll('.rt-day-cb:checked');
        task.days = Array.prototype.map.call(cbs, function (cb) { return parseInt(cb.value); });
      } else if (freq === 'monthly') {
        task.dayOfMonth = parseInt(document.getElementById('rt-dom').value || '1');
      } else if (freq === 'interval') {
        task.intervalDays = parseInt(document.getElementById('rt-interval').value || '7');
      }
      var arr = getRT(); arr.push(task); setRT(arr);
      document.getElementById('rt-title').value = '';
      initRecurringTab();
      toast('Recurring task added');
    };
  }

  // ── Session Notes Modal ───────────────────────────────────────────────
  var snEl = null, snData = null;
  function buildSN() {
    var el = document.createElement('div'); el.id = 'sn-overlay';
    el.innerHTML = '<div id="sn-box"><div class="hn-modal-head"><h3>&#9203; Session Complete</h3><button class="hn-close-btn" id="sn-x">&times;</button></div><p id="sn-ctx" style="color:var(--muted);font-size:.88rem;margin:0 0 16px;">How did your focus session go?</p><input id="sn-acc" class="hn-field" type="text" placeholder="What did you accomplish?"><textarea id="sn-notes-ta" class="hn-field hn-textarea" placeholder="Any reflections or notes..."></textarea><div class="hn-actions"><button id="sn-skip" class="btn ghost">Skip</button><button id="sn-save" class="btn primary">Save</button></div></div>';
    document.body.appendChild(el);
    el.querySelector('#sn-x').onclick = hideSN; el.querySelector('#sn-skip').onclick = hideSN; el.querySelector('#sn-save').onclick = saveSN;
    el.addEventListener('click', function (e) { if (e.target === el) hideSN(); });
    return el;
  }
  function showSN(data) {
    if (!snEl) snEl = buildSN(); snData = data || {};
    snEl.querySelector('#sn-ctx').textContent = 'Focus session #' + (snData.count || 1) + ' complete. How did it go?';
    snEl.querySelector('#sn-acc').value = ''; snEl.querySelector('#sn-notes-ta').value = '';
    snEl.style.display = 'flex'; setTimeout(function () { snEl.querySelector('#sn-acc').focus(); }, 50);
  }
  function hideSN() { if (snEl) snEl.style.display = 'none'; }
  function saveSN() {
    var acc = (snEl.querySelector('#sn-acc').value || '').trim(), notes = (snEl.querySelector('#sn-notes-ta').value || '').trim();
    if (acc || notes) { var sessions = ls('homer-sessions') || []; sessions.unshift({ id: uid(), accomplished: acc, notes: notes, date: new Date().toISOString(), count: (snData || {}).count }); lss('homer-sessions', sessions); }
    hideSN(); syncCtx();
  }
  window.addEventListener('homer:pom-complete', function (e) { var d = (e && e.detail) || {}; if (d.phase === 'focus') setTimeout(function () { showSN({ count: d.count }); }, 600); });

  // ── Weekly Review Modal ───────────────────────────────────────────────
  var wrEl = null, wrEnergy = 3;
  function buildWR() {
    var el = document.createElement('div'); el.id = 'wr-overlay';
    var energyBtns = [1,2,3,4,5].map(function (n) { var lbl = ['','Drained','Low','Okay','Good','Energized'][n]; return '<button class="wr-energy-btn' + (n===3?' active':'') + '" data-e="' + n + '">' + n + ' — ' + lbl + '</button>'; }).join('');
    el.innerHTML = '<div id="wr-box"><div class="hn-modal-head" style="margin-bottom:6px;"><h3>&#128196; Weekly Review</h3><button class="hn-close-btn" id="wr-x">&times;</button></div><div class="wr-label">Energy / Mood This Week</div><div class="wr-energy-row">' + energyBtns + '</div><div class="wr-label">Top Win</div><textarea id="wr-win" class="hn-field hn-textarea" placeholder="What went well?"></textarea><div class="wr-label">What Didn\'t Work</div><textarea id="wr-block" class="hn-field hn-textarea" placeholder="What held you back?"></textarea><div class="wr-label">Next Week Focus</div><textarea id="wr-next" class="hn-field hn-textarea" placeholder="#1 priority next week?"></textarea><div class="wr-label">Free Notes</div><textarea id="wr-free" class="hn-field hn-textarea" placeholder="Anything else..."></textarea><div class="hn-actions" style="margin-top:16px;"><button id="wr-cancel" class="btn ghost">Cancel</button><button id="wr-save" class="btn primary">Save Review</button></div></div>';
    document.body.appendChild(el);
    el.querySelectorAll('.wr-energy-btn').forEach(function (b) { b.onclick = function () { wrEnergy = parseInt(b.dataset.e); el.querySelectorAll('.wr-energy-btn').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); }; });
    el.querySelector('#wr-x').onclick = hideWR; el.querySelector('#wr-cancel').onclick = hideWR; el.querySelector('#wr-save').onclick = saveWR;
    el.addEventListener('click', function (e) { if (e.target === el) hideWR(); });
    return el;
  }
  function showWR() {
    if (!wrEl) wrEl = buildWR();
    ['#wr-win','#wr-block','#wr-next','#wr-free'].forEach(function (s) { wrEl.querySelector(s).value = ''; });
    wrEnergy = 3; wrEl.querySelectorAll('.wr-energy-btn').forEach(function (b) { b.classList.toggle('active', parseInt(b.dataset.e) === 3); });
    wrEl.style.display = 'flex';
  }
  function hideWR() { if (wrEl) wrEl.style.display = 'none'; }
  function saveWR() {
    var win = wrEl.querySelector('#wr-win').value.trim(), block = wrEl.querySelector('#wr-block').value.trim();
    var next = wrEl.querySelector('#wr-next').value.trim(), free = wrEl.querySelector('#wr-free').value.trim();
    var weekLabel = 'Week of ' + new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    var content = ['**Energy:** ' + wrEnergy + '/5', win && '**Win:** ' + win, block && '**Blocker:** ' + block, next && '**Next week:** ' + next, free && '**Notes:** ' + free].filter(Boolean).join('\n\n');
    createNote('Weekly Review — ' + weekLabel, content, false);
    var revs = ls('homer-weekly-reviews') || []; revs.unshift({ id: uid(), date: todayStr(), energy: wrEnergy, win: win, block: block, next: next, free: free }); lss('homer-weekly-reviews', revs);
    hideWR(); toast('Weekly review saved');
    if (window._homerShowTab) window._homerShowTab('notes');
    syncCtx();
  }

  // ── Second Brain Search ───────────────────────────────────────────────
  var sbEl2 = null;
  function buildSB() {
    var el = document.createElement('div'); el.id = 'sb-overlay';
    el.innerHTML = '<div id="sb-box"><div id="sb-input-wrap"><svg viewBox="0 0 24 24" style="width:17px;height:17px;flex-shrink:0;stroke:var(--muted);fill:none;stroke-width:2;stroke-linecap:round;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="sb-input" type="text" placeholder="Search notes, inbox, tasks, expenses, habits..." autocomplete="off"><kbd style="font-size:.7rem;color:var(--muted);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:3px 7px;border-radius:6px;flex-shrink:0;">ESC</kbd></div><div id="sb-results"><p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">Type to search&hellip;</p></div></div>';
    document.body.appendChild(el);
    el.querySelector('#sb-input').addEventListener('input', function () { doSearch(this.value.trim().toLowerCase()); });
    el.addEventListener('click', function (e) { if (e.target === el) hideSB(); });
    el.querySelector('#sb-input').addEventListener('keydown', function (e) { if (e.key === 'Escape') hideSB(); });
    return el;
  }
  function showSB() {
    if (!sbEl2) sbEl2 = buildSB(); sbEl2.style.display = 'flex';
    sbEl2.querySelector('#sb-input').value = ''; sbEl2.querySelector('#sb-results').innerHTML = '<p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">Type to search&hellip;</p>';
    setTimeout(function () { sbEl2.querySelector('#sb-input').focus(); }, 50);
  }
  function hideSB() { if (sbEl2) sbEl2.style.display = 'none'; }
  function doSearch(q) {
    var res = document.getElementById('sb-results'); if (!res) return;
    if (q.length < 2) { res.innerHTML = '<p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">Type at least 2 chars&hellip;</p>'; return; }
    var results = [], colors = { Note: '#60a5fa', Inbox: '#34d399', Task: '#fbbf24', Expense: '#f87171', Habit: '#a78bfa', Recurring: '#34d399' };
    getNotes().forEach(function (n) { if ((n.title + ' ' + n.content).toLowerCase().includes(q)) results.push({ type: 'Note', title: n.title, snip: (n.content || '').slice(0, 80), act: function () { if (window._homerShowTab) window._homerShowTab('notes'); setTimeout(function () { openNote(n.id); }, 150); hideSB(); } }); });
    (ls('homer-inbox') || []).forEach(function (item) { if (item && (item.text + ' ' + (item.note || '')).toLowerCase().includes(q)) results.push({ type: 'Inbox', title: item.text, snip: item.note || '', act: hideSB }); });
    (ls('homer-task-list') || []).forEach(function (t) { if (t && (t.text || '').toLowerCase().includes(q)) results.push({ type: 'Task', title: t.text, snip: t.done ? 'Completed' : 'Open', act: hideSB }); });
    (ls('homer-expenses') || []).forEach(function (e) { if (!e) return; var desc = e.desc || e.description || ''; var cat = e.cat || e.category || ''; if ((desc + ' ' + cat).toLowerCase().includes(q)) results.push({ type: 'Expense', title: desc || 'Expense', snip: cat + (e.amount ? ' · ' + e.amount : ''), act: hideSB }); });
    var hd = getHabitsData(); hd.habits.forEach(function (h) { if ((h.name || '').toLowerCase().includes(q)) results.push({ type: 'Habit', title: h.name, snip: 'Streak: ' + calcStreak(h, hd.completions), act: hideSB }); });
    getRT().forEach(function (t) { if ((t.title || '').toLowerCase().includes(q)) results.push({ type: 'Recurring', title: t.title, snip: t.freq + (t.category ? ' · ' + t.category : ''), act: function () { if (window._homerShowTab) window._homerShowTab('recurring'); hideSB(); } }); });
    if (!results.length) { res.innerHTML = '<p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">No results for &ldquo;' + esc(q) + '&rdquo;</p>'; return; }
    var html = results.slice(0, 20).map(function (r, i) { return '<div class="sb-result" data-i="' + i + '"><div class="sb-result-type" style="color:' + (colors[r.type] || 'var(--muted)') + ';">' + r.type + '</div><div class="sb-result-title">' + esc(r.title || '') + '</div>' + (r.snip ? '<div class="sb-result-snip">' + esc(r.snip) + '</div>' : '') + '</div>'; }).join('');
    res.innerHTML = html;
    res.querySelectorAll('.sb-result').forEach(function (el, i) { el.onclick = results[i].act; });
  }

  // ── Joey Context Sync ─────────────────────────────────────────────────
  var ctxTimer = null;
  function syncCtx() {
    clearTimeout(ctxTimer);
    ctxTimer = setTimeout(function () {
      try {
        var ctx = { notes: getNotes().slice(0, 20).map(function (n) { return { title: n.title, date: n.date, snippet: (n.content || '').slice(0, 200) }; }), sessions: (ls('homer-sessions') || []).slice(0, 10), lastReview: (ls('homer-weekly-reviews') || [])[0] || null, recurring: getRT().map(function (t) { return t.title + ' (' + t.freq + ')'; }) };
        localStorage.setItem('homer-notion-context', JSON.stringify(ctx));
      } catch (_) {}
    }, 2000);
  }

  // ── Drive Notes Backup ────────────────────────────────────────────────
  var notesDriveTimer = null;
  function buildNotesMd(notes) {
    var lines = ['# My Notes', '', 'Personal notes from Homer Home.', ''];
    notes.forEach(function (n) { lines.push('## ' + (n.title || 'Untitled')); if (n.daily) lines.push('_Daily note — ' + n.date + '_', ''); if (n.content) lines.push(n.content, ''); lines.push('---', ''); });
    return lines.join('\n');
  }
  function pushNotesToDrive() {
    clearTimeout(notesDriveTimer);
    notesDriveTimer = setTimeout(function () {
      try {
        var notes = getNotes(); if (!notes.length) return;
        var authHeader = typeof window.supabaseAuthHeader === 'function' ? window.supabaseAuthHeader() : null;
        var pass = localStorage.getItem('homer-sync-pass') || '';
        if (!authHeader && !pass) return;
        var body = { notesMarkdown: buildNotesMd(notes), redisOnly: true };
        if (!authHeader) body.passphrase = pass;
        var headers = { 'Content-Type': 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;
        fetch('/api/gdrive-backup', { method: 'POST', headers: headers, body: JSON.stringify(body) }).catch(function () {});
      } catch (_) {}
    }, 60000);
  }

  // ── DOM: Add new tab sections + nav buttons ───────────────────────────
  function addTabSections() {
    var shell = document.querySelector('.shell'); if (!shell) return;
    // Notes is NOT in the nav — accessed via Alt+N, Ctrl+K, quick actions
    var defs = [
      { tab: 'analytics', label: '&#128200; Analytics', sbLabel: 'Analytics', sbIcon: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
      { tab: 'recurring', label: '&#128260; Recurring', sbLabel: 'Recurring', sbIcon: '<svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' }
    ];
    // Always create notes section even though it has no nav button
    if (!document.getElementById('tab-notes')) { var ns = document.createElement('section'); ns.id = 'tab-notes'; ns.className = 'tab card'; ns.style.display = 'none'; shell.appendChild(ns); }

    var tabsBar = document.querySelector('.tabs');
    var sidebar = document.getElementById('desktop-sidebar');
    var spacer = sidebar && sidebar.querySelector('.sb-spacer');
    defs.forEach(function (def) {
      if (!document.getElementById('tab-' + def.tab)) { var s = document.createElement('section'); s.id = 'tab-' + def.tab; s.className = 'tab card'; s.style.display = 'none'; shell.appendChild(s); }
      if (tabsBar && !tabsBar.querySelector('[data-tab="' + def.tab + '"]')) { var b = document.createElement('button'); b.className = 'tab-btn'; b.dataset.tab = def.tab; b.innerHTML = def.label; tabsBar.appendChild(b); }
      if (sidebar && spacer && !sidebar.querySelector('[data-tab="' + def.tab + '"]')) { var sb = document.createElement('button'); sb.className = 'sb-item'; sb.dataset.tab = def.tab; sb.innerHTML = def.sbIcon + '<span class="sb-label">' + def.sbLabel + '</span>'; sidebar.insertBefore(sb, spacer); }
    });
  }

  // ── Tab init on show ──────────────────────────────────────────────────
  function onTab(tab) {
    if (tab === 'notes') initNotesTab();
    else if (tab === 'analytics') initAnalyticsTab();
    else if (tab === 'recurring') initRecurringTab();
  }
  window.addEventListener('homer-tab-change', function (e) { onTab(e && e.detail && e.detail.tab); });

  // ── Keyboard Shortcuts ────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.key === 'n') { e.preventDefault(); showQC('inbox'); }
    if (e.altKey && e.key === 'd') { e.preventDefault(); if (window._homerShowTab) window._homerShowTab('daily-brief'); }
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); showSB(); }
    if (e.key === 'Escape') { hideSB(); hideQC(); hideWR(); hideSN(); }
  });

  // ── Mobile quick actions ──────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#msheet-qa-capture');
    if (btn) { showQC('inbox'); var sheet = document.getElementById('mobile-sheet'); if (sheet) sheet.classList.remove('open'); }
    var notesBtn = e.target.closest('#msheet-qa-notes');
    if (notesBtn) { var s2 = document.getElementById('mobile-sheet'); if (s2) s2.classList.remove('open'); if (window._homerShowTab) window._homerShowTab('notes'); }
    var briefBtn = e.target.closest('#msheet-qa-brief');
    if (briefBtn) { var s3 = document.getElementById('mobile-sheet'); if (s3) s3.classList.remove('open'); if (window._homerShowTab) window._homerShowTab('daily-brief'); }
  });

  // ── Swipe Navigation ──────────────────────────────────────────────────
  function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} }
  function initSwipeNav() {
    if (!('ontouchstart' in window)) return;
    var SWIPE_TABS = ['home', 'pomodoro', 'tasks', 'tools', 'vault', 'analytics', 'recurring'];
    var sx = 0, sy = 0, st = 0;
    document.addEventListener('touchstart', function (e) {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      st = Date.now();
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      var dt = Date.now() - st;
      // Require: horizontal-dominant, >= 90px, < 500ms
      if (Math.abs(dx) < 90 || dt > 500 || Math.abs(dy) > Math.abs(dx) * 0.65) return;
      // Skip when overlays/modals/inputs are active
      var tgt = e.target;
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT') return;
      if (tgt.closest && tgt.closest('#mobile-sheet,#qc-overlay,#sb-overlay,#sn-overlay,#wr-overlay,.vault-ov,.goals-overlay,.issue-overlay,.oc-panel')) return;
      var current = (document.body.dataset && document.body.dataset.activeTab) || 'home';
      var avail = SWIPE_TABS.filter(function (t) { return !!document.getElementById('tab-' + t); });
      var idx = avail.indexOf(current);
      if (idx < 0) return;
      var goingForward = dx < 0; // swipe-left = forward tab, swipe-right = back
      var next = goingForward ? idx + 1 : idx - 1;
      if (next < 0 || next >= avail.length) return;
      if (window._homerShowTab) {
        // Set direction for the animation: new tab enters from right when going forward
        window._homerSwipeDir = goingForward ? 'right' : 'left';
        window._homerShowTab(avail[next]);
        haptic(8);
      }
    }, { passive: true });

    // Haptic feedback on bottom nav button taps
    var nav = document.getElementById('mobile-nav');
    if (nav) {
      nav.addEventListener('touchend', function (e) {
        if (e.target.closest('.mnav-btn')) haptic(4);
      }, { passive: true });
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    addTabSections();
    checkRecurring();
    syncCtx();
    setTimeout(patchTabSystem, 300);
    initSwipeNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 120);

})();
