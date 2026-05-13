(function () {
  'use strict';

  // ── CSS ──────────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = `
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
  /* Notes Tab */
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
  .an-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  @media(max-width:640px){.an-grid{grid-template-columns:1fr;}}
  .an-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:15px;padding:16px;}
  .an-card h4{margin:0 0 12px;font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;}
  .hm-grid{display:flex;gap:3px;}
  .hm-col{display:flex;flex-direction:column;gap:3px;}
  .hm-cell{width:12px;height:12px;border-radius:2px;background:rgba(255,255,255,.06);}
  .hm-cell[data-v="1"]{background:rgba(96,165,250,.28);}
  .hm-cell[data-v="2"]{background:rgba(96,165,250,.52);}
  .hm-cell[data-v="3"]{background:rgba(96,165,250,.76);}
  .hm-cell[data-v="4"]{background:#60a5fa;}
  .streak-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;}
  .streak-badge{display:flex;flex-direction:column;align-items:center;padding:9px 12px;border-radius:11px;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);min-width:72px;}
  .streak-num{font-size:1.55rem;font-weight:900;color:#60a5fa;line-height:1;}
  .streak-lbl{font-size:.7rem;color:var(--muted);margin-top:3px;text-align:center;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .bar-chart{display:flex;gap:7px;align-items:flex-end;height:110px;margin-top:8px;}
  .bar-col{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;}
  .bar-fill{width:100%;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#60a5fa,#3b82f6);min-height:4px;}
  .bar-lbl{font-size:.68rem;color:var(--muted);}
  .bar-val{font-size:.7rem;color:#60a5fa;font-weight:700;}
  .cat-row{display:flex;align-items:center;gap:9px;margin-bottom:7px;}
  .cat-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
  .cat-name{flex:1;font-size:.84rem;color:var(--text);}
  .cat-amt{font-size:.82rem;color:var(--muted);font-weight:700;}
  .cat-bar-bg{width:100%;height:5px;background:rgba(255,255,255,.07);border-radius:3px;margin-bottom:6px;}
  .cat-bar-fg{height:100%;border-radius:3px;}
  /* Recurring */
  .rt-item{display:flex;align-items:center;gap:10px;padding:10px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);margin-bottom:7px;}
  .rt-info{flex:1;}
  .rt-title{font-size:.9rem;font-weight:700;color:var(--text);}
  .rt-meta{font-size:.74rem;color:var(--muted);margin-top:2px;}
  .rt-freq{padding:3px 8px;border-radius:6px;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;}
  .rt-freq.daily{background:rgba(96,165,250,.15);color:#60a5fa;}
  .rt-freq.weekly{background:rgba(168,85,247,.15);color:#a855f7;}
  .rt-freq.monthly{background:rgba(245,158,11,.15);color:#f59e0b;}
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

  // ── Quick Capture ─────────────────────────────────────────────────────
  var qcEl = null, qcType = 'inbox';
  function buildQC() {
    var el = document.createElement('div');
    el.id = 'qc-overlay';
    el.innerHTML =
      '<div id="qc-box">' +
        '<div class="hn-modal-head"><h3>&#9889; Quick Capture</h3><button class="hn-close-btn" id="qc-x">&times;</button></div>' +
        '<div class="qc-type-row">' +
          '<button class="qc-type-btn active" data-t="inbox">Inbox</button>' +
          '<button class="qc-type-btn" data-t="note">Note</button>' +
          '<button class="qc-type-btn" data-t="task">Task</button>' +
        '</div>' +
        '<input id="qc-title" class="hn-field" type="text" placeholder="What\'s on your mind?">' +
        '<textarea id="qc-detail" class="hn-field hn-textarea" placeholder="Details (optional)..." style="display:none;"></textarea>' +
        '<div class="hn-actions"><button id="qc-cancel" class="btn ghost">Cancel</button><button id="qc-save" class="btn primary">Capture</button></div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('#qc-x').onclick = hideQC;
    el.querySelector('#qc-cancel').onclick = hideQC;
    el.addEventListener('click', function (e) { if (e.target === el) hideQC(); });
    el.querySelectorAll('.qc-type-btn').forEach(function (b) {
      b.onclick = function () {
        qcType = b.dataset.t;
        el.querySelectorAll('.qc-type-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        el.querySelector('#qc-detail').style.display = qcType === 'note' ? 'block' : 'none';
        el.querySelector('#qc-title').placeholder = qcType === 'task' ? 'Task title...' : qcType === 'note' ? 'Note title...' : "What's on your mind?";
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
    qcEl.querySelector('#qc-title').value = '';
    qcEl.querySelector('#qc-detail').value = '';
    qcEl.querySelector('#qc-detail').style.display = qcType === 'note' ? 'block' : 'none';
    qcEl.style.display = 'flex';
    setTimeout(function () { qcEl.querySelector('#qc-title').focus(); }, 50);
  }
  function hideQC() { if (qcEl) qcEl.style.display = 'none'; }
  function doQCSave() {
    var title = (qcEl.querySelector('#qc-title').value || '').trim();
    var detail = (qcEl.querySelector('#qc-detail').value || '').trim();
    if (!title) { qcEl.querySelector('#qc-title').focus(); return; }
    if (qcType === 'inbox') {
      var inbox = ls('homer-inbox') || [];
      inbox.unshift({ id: uid(), text: title, note: detail, date: new Date().toISOString(), done: false });
      lss('homer-inbox', inbox);
      window.dispatchEvent(new CustomEvent('homer:inbox-updated'));
    } else if (qcType === 'note') {
      createNote(title, detail);
    } else if (qcType === 'task') {
      var tasks = ls('homer-task-list') || [];
      tasks.unshift({ id: uid(), text: title, done: false, note: detail, created: new Date().toISOString() });
      lss('homer-task-list', tasks);
    }
    hideQC();
    toast('Captured to ' + qcType);
    syncCtx();
  }

  // ── Notes System ──────────────────────────────────────────────────────
  var NKEY = 'homer-notes', curNoteId = null, saveTimer = null;
  function getNotes() { return ls(NKEY) || []; }
  function setNotes(a) { lss(NKEY, a); }
  function createNote(title, content, isDaily) {
    var note = { id: uid(), title: title || 'Untitled', content: content || '', daily: !!isDaily, date: todayStr(), created: new Date().toISOString(), updated: new Date().toISOString() };
    var notes = getNotes();
    notes.unshift(note);
    setNotes(notes);
    renderNoteList();
    openNote(note.id);
    return note;
  }
  function ensureDaily() {
    var notes = getNotes(), t = todayStr();
    var ex = notes.find(function (n) { return n.daily && n.date === t; });
    if (!ex) {
      var d = new Date();
      var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      ex = createNote(days[d.getDay()] + ' — ' + d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), '', true);
    }
    return ex;
  }
  function openNote(id) {
    curNoteId = id;
    var note = getNotes().find(function (n) { return n.id === id; });
    if (!note) return;
    var t = document.getElementById('notes-title'), b = document.getElementById('notes-body');
    if (t) t.value = note.title;
    if (b) b.value = note.content;
    document.querySelectorAll('.note-item').forEach(function (el) { el.classList.toggle('active', el.dataset.id === id); });
    var st = document.getElementById('notes-status');
    if (st) st.textContent = 'Saved ' + fmtDate(note.updated);
  }
  function saveNote() {
    if (!curNoteId) return;
    var t = document.getElementById('notes-title'), b = document.getElementById('notes-body');
    if (!t || !b) return;
    var notes = getNotes(), note = notes.find(function (n) { return n.id === curNoteId; });
    if (!note) return;
    note.title = t.value || 'Untitled';
    note.content = b.value;
    note.updated = new Date().toISOString();
    setNotes(notes);
    renderNoteList();
    var st = document.getElementById('notes-status');
    if (st) st.textContent = 'Saved';
    syncCtx();
  }
  function delNote() {
    if (!curNoteId || !confirm('Delete this note?')) return;
    setNotes(getNotes().filter(function (n) { return n.id !== curNoteId; }));
    curNoteId = null;
    renderNoteList();
    var notes = getNotes();
    if (notes.length) openNote(notes[0].id);
    else { var t = document.getElementById('notes-title'), b = document.getElementById('notes-body'); if (t) t.value = ''; if (b) b.value = ''; }
  }
  function renderNoteList() {
    var el = document.getElementById('notes-list');
    if (!el) return;
    var notes = getNotes();
    el.innerHTML = '';
    if (!notes.length) { el.innerHTML = '<p style="color:var(--muted);font-size:.83rem;text-align:center;padding:18px 0;">No notes yet</p>'; return; }
    notes.forEach(function (n) {
      var d = document.createElement('div');
      d.className = 'note-item' + (n.id === curNoteId ? ' active' : '');
      d.dataset.id = n.id;
      d.innerHTML = '<div class="note-item-title">' + (n.daily ? '&#128197; ' : '') + esc(n.title) + '</div><div class="note-item-date">' + fmtDate(n.updated || n.created) + '</div>';
      d.onclick = function () { openNote(n.id); };
      el.appendChild(d);
    });
  }
  function initNotesTab() {
    var tab = document.getElementById('tab-notes');
    if (!tab || tab.dataset.init) return;
    tab.dataset.init = '1';
    tab.innerHTML =
      '<h2 class="section">Notes</h2>' +
      '<div class="notes-layout">' +
        '<div class="notes-sidebar-col">' +
          '<div class="notes-sb-head"><h4>All Notes</h4>' +
          '<button id="note-new" class="btn primary" style="padding:4px 11px;font-size:.78rem;">+ New</button></div>' +
          '<div id="notes-list"></div>' +
        '</div>' +
        '<div class="notes-editor-col">' +
          '<div class="notes-tb">' +
            '<button class="notes-tb-btn" id="note-today">Today\'s Note</button>' +
            '<button class="notes-tb-btn" id="note-review-btn">Weekly Review</button>' +
            '<span style="flex:1;"></span>' +
            '<button class="notes-tb-btn danger" id="note-del">Delete</button>' +
          '</div>' +
          '<input id="notes-title" class="hn-field" type="text" placeholder="Note title..." style="font-size:1.1rem;font-weight:800;">' +
          '<textarea id="notes-body" class="hn-field hn-textarea" placeholder="Write here... (Ctrl+S to save)" style="min-height:320px;line-height:1.72;"></textarea>' +
          '<div class="notes-footer">' +
            '<span id="notes-status" style="font-size:.78rem;color:var(--muted);"></span>' +
            '<button id="note-save" class="btn primary">Save</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.getElementById('note-new').onclick = function () { createNote('', '', false); };
    document.getElementById('note-today').onclick = function () { openNote(ensureDaily().id); };
    document.getElementById('note-review-btn').onclick = showWR;
    document.getElementById('note-del').onclick = delNote;
    document.getElementById('note-save').onclick = saveNote;
    var body = document.getElementById('notes-body'), ttl = document.getElementById('notes-title');
    function sched() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNote, 1600); var st = document.getElementById('notes-status'); if (st) st.textContent = 'Unsaved...'; }
    body.addEventListener('input', sched);
    ttl.addEventListener('input', sched);
    body.addEventListener('keydown', function (e) { if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveNote(); } });
    renderNoteList();
    var notes = getNotes();
    if (notes.length && !curNoteId) openNote(notes[0].id);
  }

  // ── Analytics ─────────────────────────────────────────────────────────
  function calcStreak(habit) {
    if (!habit || !habit.logs) return 0;
    var streak = 0, d = new Date();
    while (streak < 366) { var k = d.toISOString().slice(0, 10); if (habit.logs[k]) { streak++; d.setDate(d.getDate() - 1); } else break; }
    return streak;
  }
  function initAnalyticsTab() {
    var tab = document.getElementById('tab-analytics');
    if (!tab) return;
    var habits = ls('homer-habits') || [];
    var expenses = ls('homer-expenses') || [];

    // Streaks
    var streakHtml = habits.length
      ? '<div class="streak-row">' + habits.map(function (h) {
          return '<div class="streak-badge"><div class="streak-num">' + calcStreak(h) + '</div><div class="streak-lbl">' + esc(h.name || 'Habit') + '</div></div>';
        }).join('') + '</div>'
      : '<p style="color:var(--muted);font-size:.84rem;">No habits tracked yet.</p>';

    // Heatmap (16 weeks)
    var today = new Date(), days = [];
    for (var i = 111; i >= 0; i--) { var dd = new Date(today); dd.setDate(dd.getDate() - i); days.push(dd.toISOString().slice(0, 10)); }
    var counts = {}; days.forEach(function (d2) { counts[d2] = 0; });
    habits.forEach(function (h) { if (h.logs) Object.keys(h.logs).forEach(function (d2) { if (h.logs[d2] && counts[d2] !== undefined) counts[d2]++; }); });
    var maxC = habits.length || 1;
    var hmHtml = '<div class="hm-grid">';
    for (var w = 0; w < 16; w++) {
      hmHtml += '<div class="hm-col">';
      for (var wd = 0; wd < 7; wd++) { var day = days[w * 7 + wd]; var c = day ? (counts[day] || 0) : 0; var v = c === 0 ? 0 : Math.ceil((c / maxC) * 4); hmHtml += '<div class="hm-cell" data-v="' + v + '" title="' + (day || '') + ': ' + c + '"></div>'; }
      hmHtml += '</div>';
    }
    hmHtml += '</div><div style="display:flex;align-items:center;gap:4px;margin-top:7px;font-size:.68rem;color:var(--muted);">Less ';
    for (var vi = 0; vi <= 4; vi++) hmHtml += '<div class="hm-cell" data-v="' + vi + '" style="width:10px;height:10px;"></div>';
    hmHtml += ' More</div>';

    // Expense bar (6 months)
    var months = [];
    var now2 = new Date();
    for (var mi = 5; mi >= 0; mi--) { var md = new Date(now2.getFullYear(), now2.getMonth() - mi, 1); months.push({ key: md.getFullYear() + '-' + String(md.getMonth() + 1).padStart(2, '0'), lbl: md.toLocaleDateString(undefined, { month: 'short' }), total: 0 }); }
    expenses.forEach(function (e) { var k = (e.date || '').slice(0, 7); var m = months.find(function (x) { return x.key === k; }); if (m) m.total += parseFloat(e.amount || 0); });
    var maxM = Math.max.apply(null, months.map(function (m) { return m.total; })) || 1;
    var barHtml = '<div class="bar-chart">' + months.map(function (m) {
      var pct = Math.round((m.total / maxM) * 100);
      return '<div class="bar-col"><div class="bar-val">' + (m.total > 0 ? Math.round(m.total) : '') + '</div><div class="bar-fill" style="height:' + Math.max(pct, 4) + 'px;"></div><div class="bar-lbl">' + m.lbl + '</div></div>';
    }).join('') + '</div>';

    // Categories
    var cats = {};
    expenses.forEach(function (e) { var c = e.category || 'Other'; cats[c] = (cats[c] || 0) + parseFloat(e.amount || 0); });
    var catEntries = Object.keys(cats).map(function (k) { return [k, cats[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    var catTotal = catEntries.reduce(function (s, e) { return s + e[1]; }, 0) || 1;
    var colors = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#818cf8', '#f472b6', '#4ade80'];
    var catHtml = catEntries.length
      ? catEntries.map(function (e, i) {
          var pct = Math.round((e[1] / catTotal) * 100);
          return '<div class="cat-row"><div class="cat-dot" style="background:' + colors[i % 8] + ';"></div><div class="cat-name">' + esc(e[0]) + '</div><div class="cat-amt">' + Math.round(e[1]) + ' (' + pct + '%)</div></div>' +
            '<div class="cat-bar-bg"><div class="cat-bar-fg" style="width:' + pct + '%;background:' + colors[i % 8] + ';"></div></div>';
        }).join('')
      : '<p style="color:var(--muted);font-size:.84rem;">No expenses logged yet.</p>';

    tab.innerHTML =
      '<h2 class="section">Analytics</h2>' +
      '<div class="an-grid">' +
        '<div class="an-card"><h4>Habit Streaks</h4>' + streakHtml + '</div>' +
        '<div class="an-card"><h4>Habit Heatmap (16 weeks)</h4>' + hmHtml + '</div>' +
        '<div class="an-card"><h4>Monthly Spend</h4>' + barHtml + '</div>' +
        '<div class="an-card"><h4>Expense Categories</h4>' + catHtml + '</div>' +
      '</div>';
  }

  // ── Recurring Tasks ───────────────────────────────────────────────────
  var RTKEY = 'homer-recurring';
  function getRT() { return ls(RTKEY) || []; }
  function setRT(a) { lss(RTKEY, a); }
  function checkRecurring() {
    var tasks = getRT(), t = todayStr(), inbox = ls('homer-inbox') || [], changed = false;
    tasks.forEach(function (task) {
      if (!task.enabled) return;
      var fire = false;
      if (task.freq === 'daily') fire = task.lastFired !== t;
      else if (task.freq === 'weekly') { var lf = task.lastFired ? new Date(task.lastFired) : null; fire = !lf || Math.floor((Date.now() - lf) / 86400000) >= 7; }
      else if (task.freq === 'monthly') { var lf2 = task.lastFired ? new Date(task.lastFired) : null; var now3 = new Date(); fire = !lf2 || (now3.getMonth() !== lf2.getMonth() || now3.getFullYear() !== lf2.getFullYear()); }
      if (fire) { inbox.unshift({ id: uid(), text: '[Recurring] ' + task.title, date: new Date().toISOString(), done: false }); task.lastFired = t; changed = true; }
    });
    if (changed) { setRT(tasks); lss('homer-inbox', inbox); window.dispatchEvent(new CustomEvent('homer:inbox-updated')); }
  }
  function initRecurringTab() {
    var tab = document.getElementById('tab-recurring');
    if (!tab) return;
    var tasks = getRT();
    tab.innerHTML =
      '<h2 class="section">Recurring Tasks</h2>' +
      '<p class="muted" style="margin-bottom:16px;font-size:.88rem;">Tasks that auto-inject into your inbox when due.</p>' +
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px;">' +
        '<input id="rt-title" type="text" placeholder="Task title..." style="flex:2;min-width:140px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);">' +
        '<select id="rt-freq" style="flex:1;min-width:100px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);">' +
          '<option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>' +
        '</select>' +
        '<button id="rt-add" class="btn primary">Add</button>' +
      '</div>' +
      '<div id="rt-list">' + (tasks.length ? '' : '<p class="muted" style="font-size:.86rem;">No recurring tasks yet.</p>') + '</div>';

    var listEl = document.getElementById('rt-list');
    tasks.forEach(function (task) {
      var el = document.createElement('div');
      el.className = 'rt-item';
      el.innerHTML =
        '<input type="checkbox" style="accent-color:#60a5fa;width:15px;height:15px;cursor:pointer;" ' + (task.enabled ? 'checked' : '') + '>' +
        '<div class="rt-info"><div class="rt-title">' + esc(task.title) + '</div><div class="rt-meta">Last: ' + (task.lastFired ? fmtDate(task.lastFired) : 'Never') + '</div></div>' +
        '<span class="rt-freq ' + task.freq + '">' + task.freq + '</span>' +
        '<button class="notes-tb-btn danger" style="padding:4px 8px;">&#x2715;</button>';
      el.querySelector('input').onchange = function (e) { var arr = getRT(); var x = arr.find(function (x) { return x.id === task.id; }); if (x) { x.enabled = e.target.checked; setRT(arr); } };
      el.querySelector('.danger').onclick = function () { if (!confirm('Delete?')) return; setRT(getRT().filter(function (x) { return x.id !== task.id; })); initRecurringTab(); };
      listEl.appendChild(el);
    });

    document.getElementById('rt-add').onclick = function () {
      var title = document.getElementById('rt-title').value.trim();
      if (!title) return;
      var arr = getRT();
      arr.push({ id: uid(), title: title, freq: document.getElementById('rt-freq').value, enabled: true, lastFired: null, created: new Date().toISOString() });
      setRT(arr);
      document.getElementById('rt-title').value = '';
      initRecurringTab();
    };
  }

  // ── Session Notes Modal ───────────────────────────────────────────────
  var snEl = null, snData = null;
  function buildSN() {
    var el = document.createElement('div'); el.id = 'sn-overlay';
    el.innerHTML =
      '<div id="sn-box">' +
        '<div class="hn-modal-head"><h3>&#9203; Session Complete</h3><button class="hn-close-btn" id="sn-x">&times;</button></div>' +
        '<p id="sn-ctx" style="color:var(--muted);font-size:.88rem;margin:0 0 16px;">How did your focus session go?</p>' +
        '<input id="sn-acc" class="hn-field" type="text" placeholder="What did you accomplish?">' +
        '<textarea id="sn-notes-ta" class="hn-field hn-textarea" placeholder="Any reflections or notes..."></textarea>' +
        '<div class="hn-actions"><button id="sn-skip" class="btn ghost">Skip</button><button id="sn-save" class="btn primary">Save</button></div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('#sn-x').onclick = hideSN;
    el.querySelector('#sn-skip').onclick = hideSN;
    el.querySelector('#sn-save').onclick = saveSN;
    el.addEventListener('click', function (e) { if (e.target === el) hideSN(); });
    return el;
  }
  function showSN(data) {
    if (!snEl) snEl = buildSN();
    snData = data || {};
    snEl.querySelector('#sn-ctx').textContent = 'Focus session #' + (snData.count || 1) + ' complete. How did it go?';
    snEl.querySelector('#sn-acc').value = '';
    snEl.querySelector('#sn-notes-ta').value = '';
    snEl.style.display = 'flex';
    setTimeout(function () { snEl.querySelector('#sn-acc').focus(); }, 50);
  }
  function hideSN() { if (snEl) snEl.style.display = 'none'; }
  function saveSN() {
    var acc = (snEl.querySelector('#sn-acc').value || '').trim(), notes = (snEl.querySelector('#sn-notes-ta').value || '').trim();
    if (acc || notes) {
      var sessions = ls('homer-sessions') || [];
      sessions.unshift({ id: uid(), accomplished: acc, notes: notes, date: new Date().toISOString(), count: (snData || {}).count });
      lss('homer-sessions', sessions);
    }
    hideSN(); syncCtx();
  }
  window.addEventListener('homer:pom-complete', function (e) { var d = (e && e.detail) || {}; if (d.phase === 'focus') setTimeout(function () { showSN({ count: d.count }); }, 600); });

  // ── Weekly Review Modal ───────────────────────────────────────────────
  var wrEl = null, wrEnergy = 3;
  function buildWR() {
    var el = document.createElement('div'); el.id = 'wr-overlay';
    var energyBtns = [1, 2, 3, 4, 5].map(function (n) {
      var lbl = ['', 'Drained', 'Low', 'Okay', 'Good', 'Energized'][n];
      return '<button class="wr-energy-btn' + (n === 3 ? ' active' : '') + '" data-e="' + n + '">' + n + ' — ' + lbl + '</button>';
    }).join('');
    el.innerHTML =
      '<div id="wr-box">' +
        '<div class="hn-modal-head" style="margin-bottom:6px;"><h3>&#128196; Weekly Review</h3><button class="hn-close-btn" id="wr-x">&times;</button></div>' +
        '<div class="wr-label">Energy / Mood This Week</div>' +
        '<div class="wr-energy-row">' + energyBtns + '</div>' +
        '<div class="wr-label">Top Win</div>' +
        '<textarea id="wr-win" class="hn-field hn-textarea" placeholder="What went well?"></textarea>' +
        '<div class="wr-label">What Didn\'t Work</div>' +
        '<textarea id="wr-block" class="hn-field hn-textarea" placeholder="What held you back?"></textarea>' +
        '<div class="wr-label">Next Week Focus</div>' +
        '<textarea id="wr-next" class="hn-field hn-textarea" placeholder="#1 priority next week?"></textarea>' +
        '<div class="wr-label">Free Notes</div>' +
        '<textarea id="wr-free" class="hn-field hn-textarea" placeholder="Anything else..."></textarea>' +
        '<div class="hn-actions" style="margin-top:16px;"><button id="wr-cancel" class="btn ghost">Cancel</button><button id="wr-save" class="btn primary">Save Review</button></div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelectorAll('.wr-energy-btn').forEach(function (b) { b.onclick = function () { wrEnergy = parseInt(b.dataset.e); el.querySelectorAll('.wr-energy-btn').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); }; });
    el.querySelector('#wr-x').onclick = hideWR;
    el.querySelector('#wr-cancel').onclick = hideWR;
    el.querySelector('#wr-save').onclick = saveWR;
    el.addEventListener('click', function (e) { if (e.target === el) hideWR(); });
    return el;
  }
  function showWR() {
    if (!wrEl) wrEl = buildWR();
    ['#wr-win', '#wr-block', '#wr-next', '#wr-free'].forEach(function (s) { wrEl.querySelector(s).value = ''; });
    wrEnergy = 3;
    wrEl.querySelectorAll('.wr-energy-btn').forEach(function (b) { b.classList.toggle('active', parseInt(b.dataset.e) === 3); });
    wrEl.style.display = 'flex';
  }
  function hideWR() { if (wrEl) wrEl.style.display = 'none'; }
  function saveWR() {
    var win = wrEl.querySelector('#wr-win').value.trim(), block = wrEl.querySelector('#wr-block').value.trim();
    var next = wrEl.querySelector('#wr-next').value.trim(), free = wrEl.querySelector('#wr-free').value.trim();
    var weekLabel = 'Week of ' + new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    var content = ['**Energy:** ' + wrEnergy + '/5', win && '**Win:** ' + win, block && '**Blocker:** ' + block, next && '**Next week:** ' + next, free && '**Notes:** ' + free].filter(Boolean).join('\n\n');
    createNote('Weekly Review — ' + weekLabel, content, false);
    var revs = ls('homer-weekly-reviews') || [];
    revs.unshift({ id: uid(), date: todayStr(), energy: wrEnergy, win: win, block: block, next: next, free: free });
    lss('homer-weekly-reviews', revs);
    hideWR();
    toast('Weekly review saved as a note');
    window.dispatchEvent(new CustomEvent('homer-tab-change', { detail: { tab: 'notes' } }));
    syncCtx();
  }

  // ── Second Brain Search ───────────────────────────────────────────────
  var sbEl2 = null;
  function buildSB() {
    var el = document.createElement('div'); el.id = 'sb-overlay';
    el.innerHTML =
      '<div id="sb-box">' +
        '<div id="sb-input-wrap">' +
          '<svg viewBox="0 0 24 24" style="width:17px;height:17px;flex-shrink:0;stroke:var(--muted);fill:none;stroke-width:2;stroke-linecap:round;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          '<input id="sb-input" type="text" placeholder="Search notes, inbox, tasks, expenses, habits..." autocomplete="off">' +
          '<kbd style="font-size:.7rem;color:var(--muted);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:3px 7px;border-radius:6px;flex-shrink:0;">ESC</kbd>' +
        '</div>' +
        '<div id="sb-results"><p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">Type to search&hellip;</p></div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('#sb-input').addEventListener('input', function () { doSearch(this.value.trim().toLowerCase()); });
    el.addEventListener('click', function (e) { if (e.target === el) hideSB(); });
    el.querySelector('#sb-input').addEventListener('keydown', function (e) { if (e.key === 'Escape') hideSB(); });
    return el;
  }
  function showSB() {
    if (!sbEl2) sbEl2 = buildSB();
    sbEl2.style.display = 'flex';
    sbEl2.querySelector('#sb-input').value = '';
    sbEl2.querySelector('#sb-results').innerHTML = '<p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">Type to search&hellip;</p>';
    setTimeout(function () { sbEl2.querySelector('#sb-input').focus(); }, 50);
  }
  function hideSB() { if (sbEl2) sbEl2.style.display = 'none'; }
  function doSearch(q) {
    var res = document.getElementById('sb-results');
    if (!res) return;
    if (q.length < 2) { res.innerHTML = '<p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">Type at least 2 chars&hellip;</p>'; return; }
    var results = [];
    var colors = { Note: '#60a5fa', Inbox: '#34d399', Task: '#fbbf24', Expense: '#f87171', Habit: '#a78bfa' };
    getNotes().forEach(function (n) { if ((n.title + ' ' + n.content).toLowerCase().includes(q)) results.push({ type: 'Note', title: n.title, snip: (n.content || '').slice(0, 80), act: function () { window.dispatchEvent(new CustomEvent('homer-tab-change', { detail: { tab: 'notes' } })); setTimeout(function () { openNote(n.id); }, 150); hideSB(); } }); });
    (ls('homer-inbox') || []).forEach(function (item) { if ((item.text + ' ' + (item.note || '')).toLowerCase().includes(q)) results.push({ type: 'Inbox', title: item.text, snip: item.note || '', act: hideSB }); });
    (ls('homer-task-list') || []).forEach(function (t) { if ((t.text || '').toLowerCase().includes(q)) results.push({ type: 'Task', title: t.text, snip: t.done ? 'Completed' : 'Open', act: hideSB }); });
    (ls('homer-expenses') || []).forEach(function (e) { var desc = e.desc || e.description || ''; if ((desc + ' ' + (e.category || '')).toLowerCase().includes(q)) results.push({ type: 'Expense', title: desc || 'Expense', snip: (e.category || '') + ' · ' + (e.amount || ''), act: hideSB }); });
    (ls('homer-habits') || []).forEach(function (h) { if ((h.name || '').toLowerCase().includes(q)) results.push({ type: 'Habit', title: h.name, snip: 'Streak: ' + calcStreak(h), act: hideSB }); });
    if (!results.length) { res.innerHTML = '<p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">No results for &ldquo;' + esc(q) + '&rdquo;</p>'; return; }
    var html = results.slice(0, 20).map(function (r, i) {
      return '<div class="sb-result" data-i="' + i + '"><div class="sb-result-type" style="color:' + (colors[r.type] || 'var(--muted)') + ';">' + r.type + '</div><div class="sb-result-title">' + esc(r.title || '') + '</div>' + (r.snip ? '<div class="sb-result-snip">' + esc(r.snip) + '</div>' : '') + '</div>';
    }).join('');
    res.innerHTML = html;
    res.querySelectorAll('.sb-result').forEach(function (el, i) { el.onclick = results[i].act; });
  }

  // ── Joey Context Sync ─────────────────────────────────────────────────
  var ctxTimer = null;
  function syncCtx() {
    clearTimeout(ctxTimer);
    ctxTimer = setTimeout(function () {
      try {
        var ctx = {
          notes: getNotes().slice(0, 20).map(function (n) { return { title: n.title, date: n.date, snippet: (n.content || '').slice(0, 200) }; }),
          sessions: (ls('homer-sessions') || []).slice(0, 10),
          lastReview: (ls('homer-weekly-reviews') || [])[0] || null,
          recurring: getRT().map(function (t) { return t.title + ' (' + t.freq + ')'; })
        };
        localStorage.setItem('homer-notion-context', JSON.stringify(ctx));
      } catch (_) {}
    }, 2000);
  }

  // ── DOM: Add new tab sections + nav buttons ───────────────────────────
  function addTabSections() {
    var shell = document.querySelector('.shell');
    if (!shell) return;
    var defs = [
      { id: 'tab-notes', label: '&#128221; Notes', sbLabel: 'Notes', sbIcon: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
      { id: 'tab-analytics', label: '&#128200; Analytics', sbLabel: 'Analytics', sbIcon: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
      { id: 'tab-recurring', label: '&#128260; Recurring', sbLabel: 'Recurring', sbIcon: '<svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' }
    ];
    var tabsBar = document.querySelector('.tabs');
    var sidebar = document.getElementById('desktop-sidebar');
    var spacer = sidebar && sidebar.querySelector('.sb-spacer');

    defs.forEach(function (def) {
      var tab = def.id.replace('tab-', '');
      if (!document.getElementById(def.id)) {
        var s = document.createElement('section');
        s.id = def.id; s.className = 'tab card'; s.style.display = 'none';
        shell.appendChild(s);
      }
      if (tabsBar && !tabsBar.querySelector('[data-tab="' + tab + '"]')) {
        var b = document.createElement('button'); b.className = 'tab-btn'; b.dataset.tab = tab; b.innerHTML = def.label;
        tabsBar.appendChild(b);
      }
      if (sidebar && spacer && !sidebar.querySelector('[data-tab="' + tab + '"]')) {
        var sb = document.createElement('button'); sb.className = 'sb-item'; sb.dataset.tab = tab;
        sb.innerHTML = def.sbIcon + '<span class="sb-label">' + def.sbLabel + '</span>';
        sidebar.insertBefore(sb, spacer);
      }
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
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); showSB(); }
    if (e.key === 'Escape') { hideSB(); hideQC(); hideWR(); hideSN(); }
  });

  // ── Wire mobile capture button ────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#msheet-qa-capture');
    if (btn) { showQC('inbox'); document.getElementById('mobile-sheet') && (document.getElementById('mobile-sheet').classList.remove('open')); }
  });

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    addTabSections();
    checkRecurring();
    syncCtx();
    // Forward new tab button clicks into onTab
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (btn) onTab(btn.dataset.tab);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 120);

})();
