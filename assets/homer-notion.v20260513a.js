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
  #wr-stats{display:none;flex-wrap:wrap;gap:8px;margin-bottom:16px;padding:14px 16px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.08);border-radius:12px;}
  .wr-stat-item{display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);}
  .wr-stat-icon{font-size:.95rem;line-height:1;flex-shrink:0;}
  .wr-stat-val{font-size:.95rem;font-weight:800;line-height:1;}
  .wr-stat-lbl{font-size:.72rem;color:var(--muted);line-height:1;}
  .wr-stats-hd{width:100%;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#475569;margin-bottom:2px;}
  .sb-result.active{background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.3);}

  /* ── Notes — Notion-style ───────────────────────────────────────────── */
  .notes-layout{display:grid;grid-template-columns:240px 1fr;min-height:560px;border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;background:rgba(255,255,255,.01);}
  @media(max-width:700px){.notes-layout{grid-template-columns:1fr;}.notes-sidebar-col{display:none;}}

  /* Sidebar */
  .notes-sidebar-col{background:rgba(0,0,0,.18);border-right:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;min-height:0;}
  .notes-sb-head{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;border-bottom:1px solid rgba(255,255,255,.05);}
  .notes-sb-head h4{margin:0;font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800;}
  .notes-new-btn{background:none;border:1px solid rgba(255,255,255,.12);color:var(--muted);font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:6px;cursor:pointer;font-family:inherit;transition:all .14s;}
  .notes-new-btn:hover{background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.3);color:#60a5fa;}
  #notes-list{overflow-y:auto;flex:1;padding:6px 8px;}
  .note-item{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;transition:background .12s;margin-bottom:1px;border:none;background:none;}
  .note-item:hover{background:rgba(255,255,255,.05);}
  .note-item.active{background:rgba(96,165,250,.12);}
  .note-item-emoji{font-size:.85rem;line-height:1.5;flex-shrink:0;opacity:.85;}
  .note-item-info{min-width:0;flex:1;}
  .note-item-title{font-size:.82rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.35;}
  .note-item.active .note-item-title{color:#93c5fd;}
  .note-item-date{font-size:.67rem;color:var(--muted);margin-top:1px;}

  /* Editor column */
  .notes-editor-col{display:flex;flex-direction:column;min-height:0;background:transparent;}
  .notes-editor-toolbar{display:flex;align-items:center;gap:6px;padding:10px 20px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0;}
  .notes-tb-btn{padding:4px 11px;border-radius:7px;border:1px solid rgba(255,255,255,.08);background:none;color:var(--muted);cursor:pointer;font-size:.76rem;font-weight:600;transition:all .12s;font-family:inherit;}
  .notes-tb-btn:hover{background:rgba(255,255,255,.06);color:var(--text);}
  .notes-tb-btn.danger{color:#f87171;}
  .notes-tb-btn.danger:hover{background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.2);}
  #notes-status{font-size:.72rem;color:var(--muted);font-style:italic;}

  /* Document area */
  .notes-doc{flex:1;overflow-y:auto;display:flex;flex-direction:column;padding:0;}
  .notes-empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;opacity:.35;user-select:none;padding:60px 20px;}
  .notes-empty-icon{font-size:2.8rem;}
  .notes-empty-text{font-size:.85rem;color:var(--muted);text-align:center;}
  #notes-editor-content{display:none;flex-direction:column;flex:1;padding:36px 72px 40px;}
  @media(max-width:900px){#notes-editor-content{padding:28px 32px 36px;}}
  @media(max-width:600px){#notes-editor-content{padding:20px 18px 28px;}}
  .notes-doc-emoji{font-size:2.8rem;line-height:1;margin-bottom:14px;user-select:none;}
  #notes-title{width:100%;padding:0;border:none;background:transparent;color:var(--text);font-size:2rem;font-weight:800;font-family:inherit;line-height:1.2;margin-bottom:16px;outline:none;letter-spacing:-.025em;}
  #notes-title::placeholder{color:rgba(255,255,255,.15);}
  #notes-body{width:100%;flex:1;min-height:300px;padding:0;border:none;background:transparent;color:rgba(240,240,255,.82);font-size:.97rem;font-family:inherit;resize:none;line-height:1.82;outline:none;}
  #notes-body::placeholder{color:rgba(255,255,255,.18);}
  .notes-footer{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:8px 72px 16px;border-top:1px solid rgba(255,255,255,.04);flex-shrink:0;}
  @media(max-width:900px){.notes-footer{padding:8px 32px 16px;}}
  @media(max-width:600px){.notes-footer{padding:8px 18px 14px;}}

  /* Analytics */
  .an-filter-bar{display:flex;gap:8px;align-items:center;margin-bottom:18px;flex-wrap:wrap;}
  .an-range-btn{padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.12);background:none;color:var(--muted);cursor:pointer;font-size:.8rem;font-weight:700;transition:all .15s;}
  .an-range-btn.active{background:rgba(96,165,250,.18);border-color:#60a5fa;color:#60a5fa;}
  .an-summary-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px;}
  .an-summary-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;position:relative;overflow:hidden;}
  .an-summary-card.spend{border-color:rgba(251,191,36,.2);}
  .an-summary-card.focus{border-color:rgba(167,139,250,.2);}
  .an-summary-card.habits{border-color:rgba(52,211,153,.2);}
  .an-summary-card.streak{border-color:rgba(248,113,113,.2);}
  .an-summary-card.notes{border-color:rgba(96,165,250,.2);}
  .an-summary-icon{font-size:1.2rem;margin-bottom:6px;display:block;}
  .an-summary-val{font-size:1.5rem;font-weight:900;color:#60a5fa;line-height:1.1;}
  .an-summary-card.spend .an-summary-val{color:#fbbf24;}
  .an-summary-card.focus .an-summary-val{color:#a78bfa;}
  .an-summary-card.habits .an-summary-val{color:#34d399;}
  .an-summary-card.streak .an-summary-val{color:#f87171;}
  .an-summary-lbl{font-size:.7rem;color:var(--muted);margin-top:4px;line-height:1.4;}
  .an-summary-delta{font-size:.7rem;font-weight:700;margin-top:3px;}
  .an-summary-delta.up{color:#34d399;}.an-summary-delta.down{color:#f87171;}.an-summary-delta.flat{color:var(--muted);}
  .an-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  @media(max-width:700px){.an-grid{grid-template-columns:1fr;}}
  .an-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:15px;padding:16px;}
  .an-card h4{margin:0 0 4px;font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;}
  .an-card-sub{font-size:.76rem;color:var(--muted);margin:0 0 12px;line-height:1.5;opacity:.75;}
  .an-card-full{grid-column:1/-1;}
  .hm-wrap{overflow-x:auto;padding-bottom:4px;}
  .hm-month-row{display:flex;gap:3px;margin-bottom:3px;}
  .hm-mo-lbl{width:12px;font-size:.6rem;color:var(--muted);white-space:nowrap;overflow:visible;text-align:left;}
  .hm-grid{display:flex;gap:3px;}
  .hm-col{display:flex;flex-direction:column;gap:3px;}
  .hm-cell{width:12px;height:12px;border-radius:2px;background:rgba(255,255,255,.06);}
  .hm-cell[data-v="1"]{background:rgba(96,165,250,.28);}
  .hm-cell[data-v="2"]{background:rgba(96,165,250,.52);}
  .hm-cell[data-v="3"]{background:rgba(96,165,250,.76);}
  .hm-cell[data-v="4"]{background:#60a5fa;}
  .streak-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;}
  .streak-badge{display:flex;flex-direction:column;align-items:center;padding:8px 11px;border-radius:11px;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);min-width:68px;}
  .streak-num{font-size:1.35rem;font-weight:900;color:#60a5fa;line-height:1;}
  .streak-lbl{font-size:.68rem;color:var(--muted);margin-top:3px;text-align:center;max-width:75px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .streak-rate{font-size:.65rem;color:#34d399;margin-top:1px;}
  .bar-chart{display:flex;gap:5px;align-items:flex-end;height:90px;margin-top:8px;}
  .bar-col{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;}
  .bar-fill{width:100%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#60a5fa,#3b82f6);min-height:3px;}
  .bar-fill.green{background:linear-gradient(180deg,#34d399,#10b981);}
  .bar-fill.purple{background:linear-gradient(180deg,#a78bfa,#7c3aed);}
  .bar-lbl{font-size:.62rem;color:var(--muted);}
  .bar-val{font-size:.65rem;color:#60a5fa;font-weight:700;}
  .cat-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
  .cat-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .cat-name{flex:1;font-size:.82rem;color:var(--text);}
  .cat-pct{font-size:.72rem;color:var(--muted);font-weight:700;width:30px;text-align:right;flex-shrink:0;}
  .cat-amt{font-size:.78rem;color:var(--muted);font-weight:700;width:42px;text-align:right;flex-shrink:0;}
  .cat-delta{font-size:.7rem;font-weight:700;margin-left:4px;}
  .cat-delta.up{color:#f87171;}.cat-delta.down{color:#34d399;}
  .cat-bar-bg{width:100%;height:4px;background:rgba(255,255,255,.07);border-radius:3px;margin-bottom:6px;}
  .cat-bar-fg{height:100%;border-radius:3px;transition:width .4s;}
  .env-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px;margin-top:6px;}
  .env-card{border-radius:13px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);overflow:hidden;transition:border-color .2s;}
  .env-card:hover{border-color:rgba(255,255,255,.15);}
  .env-body{padding:11px 12px 9px;}
  .env-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;gap:4px;}
  .env-name{font-size:.79rem;font-weight:700;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .env-status{font-size:.58rem;font-weight:800;padding:2px 6px;border-radius:10px;text-transform:uppercase;letter-spacing:.04em;flex-shrink:0;}
  .env-status.ok{background:rgba(52,211,153,.15);color:#34d399;}
  .env-status.warn{background:rgba(251,191,36,.15);color:#fbbf24;}
  .env-status.over{background:rgba(248,113,113,.15);color:#f87171;}
  .env-spent{font-size:1.55rem;font-weight:900;line-height:1;margin-bottom:2px;}
  .env-of{font-size:.72rem;color:var(--muted);margin-bottom:3px;}
  .env-remaining{font-size:.69rem;font-weight:700;margin-bottom:1px;}
  .env-set-btn{background:none;border:1px dashed rgba(255,255,255,.2);color:var(--muted);font-size:.68rem;padding:2px 8px;border-radius:6px;cursor:pointer;font-family:inherit;transition:all .14s;}
  .env-set-btn:hover{border-color:#60a5fa;color:#60a5fa;}
  .env-add-btn{display:block;width:100%;margin-top:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#94a3b8;font-size:.7rem;font-weight:700;padding:4px 0;border-radius:7px;cursor:pointer;font-family:inherit;transition:all .14s;text-align:center;}
  .env-add-btn:hover{background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.3);color:#60a5fa;}
  .env-bar-wrap{height:5px;background:rgba(255,255,255,.05);}
  .env-bar-fill{height:100%;transition:width .5s cubic-bezier(.4,0,.2,1);}
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

  /* Recurring Tasks — Dashboard */
  .rt-hd-btn{padding:7px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:var(--muted);cursor:pointer;font-size:.78rem;font-weight:700;transition:all .14s;font-family:inherit;}
  .rt-hd-btn:hover{background:rgba(96,165,250,.1);color:#60a5fa;border-color:rgba(96,165,250,.3);}
  .rt-hd-btn.primary{background:rgba(96,165,250,.18);border-color:#60a5fa;color:#60a5fa;}
  .rt-hd-btn.primary:hover{background:rgba(96,165,250,.28);}
  .rt-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
  @media(max-width:640px){.rt-stats{grid-template-columns:repeat(2,1fr);}}
  .rt-stat{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px 14px;}
  .rt-stat-val{font-size:1.55rem;font-weight:900;line-height:1.1;}
  .rt-stat-lbl{font-size:.67rem;color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.05em;}
  .rt-section{margin-bottom:22px;}
  .rt-section-hd{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
  .rt-section-hd h3{margin:0;font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);}
  .rt-section-badge{font-size:.67rem;font-weight:700;padding:2px 8px;border-radius:999px;}
  .rt-action-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;}
  .rt-action-card{background:linear-gradient(145deg,rgba(30,41,59,.85),rgba(15,23,42,.78));border:1px solid rgba(148,163,184,.1);border-radius:14px;padding:14px;}
  .rt-action-card.overdue{border-left:3px solid #f87171;}
  .rt-action-card.due-today{border-left:3px solid #fbbf24;}
  .rt-ac-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;}
  .rt-ac-title{font-size:.88rem;font-weight:700;color:var(--text);line-height:1.3;flex:1;}
  .rt-ac-tag{font-size:.63rem;font-weight:800;padding:2px 7px;border-radius:5px;flex-shrink:0;}
  .rt-ac-badges{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;}
  .rt-ac-note{font-size:.76rem;color:var(--muted);margin-bottom:10px;line-height:1.5;}
  .rt-ac-btns{display:flex;gap:6px;}
  .rt-done-btn{flex:1;padding:8px;border-radius:9px;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.3);color:#34d399;font-weight:800;font-size:.8rem;cursor:pointer;transition:all .15s;font-family:inherit;}
  .rt-done-btn:hover{background:rgba(52,211,153,.28);box-shadow:0 4px 14px rgba(52,211,153,.18);}
  .rt-skip-btn{padding:8px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--muted);cursor:pointer;font-size:.78rem;transition:all .14s;font-family:inherit;}
  .rt-skip-btn:hover{background:rgba(255,255,255,.08);color:var(--text);}
  .rt-done-list{display:flex;flex-direction:column;gap:6px;margin-top:10px;}
  .rt-done-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:rgba(52,211,153,.05);border:1px solid rgba(52,211,153,.12);}
  .rt-done-check{width:20px;height:20px;border-radius:50%;background:rgba(52,211,153,.18);border:2px solid #34d399;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.65rem;color:#34d399;}
  .rt-done-item-title{font-size:.83rem;font-weight:700;color:var(--muted);text-decoration:line-through;flex:1;}
  .rt-catchup{text-align:center;padding:28px 0;color:var(--muted);font-size:.86rem;}
  .rt-upcoming-strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin;-webkit-overflow-scrolling:touch;}
  .rt-up-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:10px 12px;flex-shrink:0;min-width:130px;}
  .rt-up-title{font-size:.8rem;font-weight:700;color:var(--text);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .rt-up-when{font-size:.68rem;color:#60a5fa;font-weight:700;}
  .rt-sched-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;}
  .rt-sched-card{background:rgba(255,255,255,.022);border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:11px 12px;}
  .rt-sched-card.paused{opacity:.48;}
  .rt-sched-title{font-size:.83rem;font-weight:700;color:var(--text);margin-bottom:5px;}
  .rt-sched-badges{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:5px;}
  .rt-sched-meta{font-size:.68rem;color:var(--muted);line-height:1.65;}
  .rt-sched-actions{display:flex;gap:5px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.06);}
  .rt-sched-btn{font-size:.62rem;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--muted);cursor:pointer;transition:all .12s;font-family:inherit;}
  .rt-sched-btn:hover{background:rgba(96,165,250,.1);color:#60a5fa;border-color:rgba(96,165,250,.25);}
  .rt-sched-btn.danger:hover{background:rgba(248,113,113,.1);color:#f87171;border-color:rgba(248,113,113,.25);}
  .rt-toggle-sec{background:none;border:none;padding:0;cursor:pointer;font-size:.72rem;font-weight:700;color:var(--muted);display:flex;align-items:center;gap:4px;font-family:inherit;margin-left:auto;}
  .rt-toggle-sec:hover{color:var(--text);}
  /* Reused badge classes */
  .rt-freq{padding:2px 7px;border-radius:5px;font-size:.63rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;}
  .rt-freq.daily{background:rgba(96,165,250,.15);color:#60a5fa;}
  .rt-freq.weekly{background:rgba(168,85,247,.15);color:#a855f7;}
  .rt-freq.monthly{background:rgba(245,158,11,.15);color:#f59e0b;}
  .rt-freq.interval{background:rgba(52,211,153,.15);color:#34d399;}
  .rt-cat{padding:2px 7px;border-radius:5px;font-size:.63rem;font-weight:700;}
  .rt-priority-high{padding:2px 7px;border-radius:5px;font-size:.63rem;background:rgba(248,113,113,.15);color:#f87171;}
  .rt-priority-medium{padding:2px 7px;border-radius:5px;font-size:.63rem;background:rgba(251,191,36,.15);color:#fbbf24;}
  .rt-priority-low{padding:2px 7px;border-radius:5px;font-size:.63rem;background:rgba(148,163,184,.1);color:var(--muted);}
  /* Schedule modal */
  #rt-modal-bg{display:none;position:fixed;inset:0;z-index:10500;background:rgba(2,6,23,.82);backdrop-filter:blur(8px);align-items:center;justify-content:center;}
  #rt-modal-bg.open{display:flex;}
  #rt-modal{background:linear-gradient(160deg,#0f1729,#020617);border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:24px;width:min(540px,94vw);max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(2,6,23,.7);}
  #rt-modal h3{margin:0 0 16px;font-size:1rem;font-weight:800;}
  .rt-form-row{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:10px;}
  .rt-form-row>*{flex:1;min-width:120px;}
  .rt-templates{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
  .rt-tpl-btn{padding:5px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:none;color:var(--muted);cursor:pointer;font-size:.75rem;font-weight:700;transition:all .15s;white-space:nowrap;font-family:inherit;}
  .rt-tpl-btn:hover{background:rgba(255,255,255,.07);color:var(--text);}
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
  function noteEmoji(n) { return n.emoji || (n.daily ? '📅' : '📄'); }
  function showNotesEmpty(show) {
    var em = document.getElementById('notes-empty'), ec = document.getElementById('notes-editor-content');
    if (em) em.style.display = show ? 'flex' : 'none';
    if (ec) ec.style.display = show ? 'none' : 'flex';
  }
  function openNote(id) {
    // Save the current note before switching so no content is lost
    if (curNoteId && curNoteId !== id) { clearTimeout(saveTimer); saveNote(); }
    curNoteId = id; var note = getNotes().find(function (n) { return n.id === id; }); if (!note) return;
    var t = document.getElementById('notes-title'), b = document.getElementById('notes-body'), em = document.getElementById('note-emoji');
    if (em) em.textContent = noteEmoji(note);
    if (t) t.value = note.title; if (b) b.value = note.content;
    document.querySelectorAll('.note-item').forEach(function (el) { el.classList.toggle('active', el.dataset.id === id); });
    var st = document.getElementById('notes-status'); if (st) st.textContent = 'Saved ' + fmtDate(note.updated);
    showNotesEmpty(false);
  }
  function saveNote() {
    if (!curNoteId) return;
    var t = document.getElementById('notes-title'), b = document.getElementById('notes-body'); if (!t || !b) return;
    var notes = getNotes(), note = notes.find(function (n) { return n.id === curNoteId; }); if (!note) return;
    var now = Date.now();
    note.title = t.value || 'Untitled'; note.content = b.value;
    note.updated = new Date(now).toISOString(); note.updatedAt = now;
    setNotes(notes); renderNoteList();
    var st = document.getElementById('notes-status'); if (st) st.textContent = 'Saved';
    syncCtx(); pushNotesToDrive();
  }
  function delNote() {
    if (!curNoteId || !confirm('Delete this note?')) return;
    setNotes(getNotes().filter(function (n) { return n.id !== curNoteId; })); curNoteId = null; renderNoteList();
    var notes = getNotes(); if (notes.length) openNote(notes[0].id);
    else showNotesEmpty(true);
  }
  function renderNoteList() {
    var el = document.getElementById('notes-list'); if (!el) return;
    var notes = getNotes(); el.innerHTML = '';
    if (!notes.length) { el.innerHTML = '<p style="color:var(--muted);font-size:.83rem;text-align:center;padding:18px 0;">No notes yet</p>'; return; }
    notes.forEach(function (n) {
      var d = document.createElement('div'); d.className = 'note-item' + (n.id === curNoteId ? ' active' : ''); d.dataset.id = n.id;
      d.innerHTML = '<div class="note-item-emoji">' + noteEmoji(n) + '</div><div class="note-item-info"><div class="note-item-title">' + esc(n.title || 'Untitled') + '</div><div class="note-item-date">' + fmtDate(n.updated || n.created) + '</div></div>';
      d.onclick = function () { openNote(n.id); }; el.appendChild(d);
    });
  }
  window._homerRenderNoteList = renderNoteList;
  function initNotesTab() {
    var tab = document.getElementById('tab-notes'); if (!tab || tab.dataset.init) return; tab.dataset.init = '1';
    tab.innerHTML =
      '<h2 class="section">Notes</h2>' +
      '<div class="notes-layout">' +
        '<div class="notes-sidebar-col">' +
          '<div class="notes-sb-head"><h4>Pages</h4><button id="note-new" class="notes-new-btn">+ New</button></div>' +
          '<div id="notes-list"></div>' +
        '</div>' +
        '<div class="notes-editor-col">' +
          '<div class="notes-editor-toolbar">' +
            '<button class="notes-tb-btn" id="note-today">Today\'s Note</button>' +
            '<button class="notes-tb-btn" id="note-review-btn">Weekly Review</button>' +
            '<span style="flex:1;"></span>' +
            '<span id="notes-status"></span>' +
            '<button class="notes-tb-btn danger" id="note-del">Delete</button>' +
          '</div>' +
          '<div class="notes-doc">' +
            '<div id="notes-empty" class="notes-empty-state" style="display:flex;">' +
              '<div class="notes-empty-icon">📝</div>' +
              '<div class="notes-empty-text">Select a page or create a new one</div>' +
            '</div>' +
            '<div id="notes-editor-content" style="display:none;flex-direction:column;flex:1;">' +
              '<div id="note-emoji" class="notes-doc-emoji">📄</div>' +
              '<input id="notes-title" type="text" placeholder="Untitled">' +
              '<textarea id="notes-body" placeholder="Start writing... (Ctrl+S to save)"></textarea>' +
            '</div>' +
          '</div>' +
          '<div class="notes-footer"><span></span><button id="note-save" class="btn primary" style="font-size:.82rem;padding:6px 18px;">Save</button></div>' +
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
    renderNoteList(); var notes = getNotes(); if (notes.length && !curNoteId) openNote(notes[0].id); else if (!notes.length) showNotesEmpty(true);
  }

  // ── Analytics ─────────────────────────────────────────────────────────
  var anRange = 30; // default date range in days

  function daysAgoStr(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

  var EXP_CAT_COLORS_BASE = {
    groceries:'#22c55e', restaurants:'#fb923c', coffee:'#b45309', food:'#fb7185',
    rent:'#6366f1', home:'#14b8a6', transport:'#fbbf24', utilities:'#eab308',
    insurance:'#64748b', health:'#34d399', fitness:'#ef4444', work:'#60a5fa',
    education:'#f97316', shopping:'#f472b6', travel:'#38bdf8', personal:'#e879f9',
    subscriptions:'#818cf8', entertainment:'#a78bfa', savings:'#0ea5e9',
    gifts:'#fdba74', other:'#94a3b8'
  };
  var EXP_CAT_EMOJI_BASE = {
    groceries:'🛒', restaurants:'🍽️', coffee:'☕', food:'🍔', rent:'🏡',
    home:'🏠', transport:'🚗', utilities:'💡', insurance:'🛡️', health:'❤️',
    fitness:'🏋️', work:'💼', education:'📚', shopping:'🛍️', travel:'✈️',
    personal:'💅', subscriptions:'📱', entertainment:'🎬', savings:'🏦',
    gifts:'🎁', other:'📦'
  };
  // Merge custom categories into the base maps at runtime
  function getExpCatMaps() {
    var colors = {}, emoji = {}, k;
    for (k in EXP_CAT_COLORS_BASE) colors[k] = EXP_CAT_COLORS_BASE[k];
    for (k in EXP_CAT_EMOJI_BASE)  emoji[k]  = EXP_CAT_EMOJI_BASE[k];
    var custom = ls('homer-expense-cats') || [];
    custom.forEach(function(c) { if (c.name) { colors[c.name] = c.color || '#94a3b8'; emoji[c.name] = c.emoji || '🏷️'; } });
    return { colors: colors, emoji: emoji };
  }

  function initAnalyticsTab() {
    var tab = document.getElementById('tab-analytics'); if (!tab) return;

    // Migrate legacy homer-pomodoro sessions into homer-sessions (one-time, so focus counts work)
    (function migratePomo() {
      var pomo = ls('homer-pomodoro'); if (!pomo || !pomo.sessions || !pomo.sessions.length) return;
      var existing = ls('homer-sessions') || [];
      var existingTs = {}; existing.forEach(function(s) { if (s.ts || s.date) existingTs[(s.ts || s.date).slice(0, 16)] = true; });
      var toMigrate = pomo.sessions.filter(function(s) { return s.ts && !existingTs[s.ts.slice(0, 16)]; });
      if (!toMigrate.length) return;
      toMigrate.forEach(function(s) {
        existing.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), accomplished: s.task || '', notes: '', task: s.task || '', date: s.ts, count: 0, duration: 25 });
      });
      lss('homer-sessions', existing);
    })();

    var catMaps = getExpCatMaps();
    var EXP_CAT_COLORS = catMaps.colors, EXP_CAT_EMOJI = catMaps.emoji;

    var hd = getHabitsData(), habits = hd.habits, completions = hd.completions;
    var expenses = ls('homer-expenses') || []; if (!Array.isArray(expenses)) expenses = [];
    var sessions = ls('homer-sessions') || []; if (!Array.isArray(sessions)) sessions = [];
    var reviews = ls('homer-weekly-reviews') || []; if (!Array.isArray(reviews)) reviews = [];
    var notes = ls('homer-notes') || []; if (!Array.isArray(notes)) notes = [];
    var budgets = ls('homer-expense-budgets') || { groceries: 1200, restaurants: 600, coffee: 200, food: 500, rent: 3000, home: 400, transport: 400, utilities: 500, insurance: 300, health: 300, fitness: 200, work: 400, education: 200, shopping: 400, travel: 1000, personal: 200, subscriptions: 150, entertainment: 300, savings: 1000, gifts: 200, other: 200 };
    var rangeStart = daysAgoStr(anRange);

    // Filter by range
    var rangeExpenses = expenses.filter(function (e) { return (e.date || '') >= rangeStart; });
    var rangeSessions = sessions.filter(function (s) { return (s.date || '') >= rangeStart; });
    var rangeNotes = notes.filter(function (n) { return (n.updated || n.created || '') >= rangeStart; });

    // ─── Summary row ───────────────────────────────────────────────────
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
    var bestStreak = habits.reduce(function (m, h) { return Math.max(m, calcStreak(h, completions)); }, 0);
    var totalFocusMin = rangeSessions.reduce(function (s, sess) { return s + (sess.duration || 25); }, 0);
    var focusHrs = Math.floor(totalFocusMin / 60), focusMinsRem = totalFocusMin % 60;
    var focusLabel = totalFocusMin >= 60 ? focusHrs + 'h ' + (focusMinsRem ? focusMinsRem + 'm' : '') : totalFocusMin + 'm';

    function mkDelta(d, invertColor) {
      if (!d) return '<div class="an-summary-delta flat">— same as prev</div>';
      var isGood = invertColor ? d < 0 : d > 0;
      return '<div class="an-summary-delta ' + (isGood ? 'up' : 'down') + '">' + (d > 0 ? '&#9650; ' : '&#9660; ') + Math.abs(d) + '% vs prev</div>';
    }

    var summaryHtml =
      '<div class="an-summary-card spend"><div class="an-summary-icon">💰</div><div class="an-summary-val">' + Math.round(curSpend) + '</div><div class="an-summary-lbl">Total Spend (' + anRange + 'd)</div>' + mkDelta(spendDelta, true) + '</div>' +
      '<div class="an-summary-card focus"><div class="an-summary-icon">⏱️</div><div class="an-summary-val">' + focusLabel + '</div><div class="an-summary-lbl">Focus Time (' + curSessions + ' sessions)</div>' + mkDelta(focusDelta, false) + '</div>' +
      '<div class="an-summary-card habits"><div class="an-summary-icon">✅</div><div class="an-summary-val">' + avgHabitRate + '%</div><div class="an-summary-lbl">Habit Completion</div>' + mkDelta(habitDelta, false) + '</div>' +
      '<div class="an-summary-card streak"><div class="an-summary-icon">🔥</div><div class="an-summary-val">' + bestStreak + '</div><div class="an-summary-lbl">Best Streak (days)</div></div>' +
      '<div class="an-summary-card notes"><div class="an-summary-icon">✏️</div><div class="an-summary-val">' + rangeNotes.length + '</div><div class="an-summary-lbl">Notes Written</div></div>';

    // ─── Habit streaks + completion rate ──────────────────────────────
    var streakHtml = habits.length
      ? '<p class="an-card-sub">Current active streaks and completion rate per habit over the selected period.</p><div class="streak-row">' + habits.map(function (h) {
          var rate = calcCompletionRate(h, completions, anRange);
          var streak = calcStreak(h, completions);
          var fire = streak >= 7 ? ' 🔥' : (streak >= 3 ? ' ⚡' : '');
          return '<div class="streak-badge"><div class="streak-num">' + streak + fire + '</div><div class="streak-lbl">' + esc(h.name || 'Habit') + '</div><div class="streak-rate">' + rate + '% done</div></div>';
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
    var bestDayName = dayTotals[bestDayIdx] > 0 ? dayNames[bestDayIdx] : null;
    var dayHtml =
      '<p class="an-card-sub">Which day of the week you complete the most habits.' + (bestDayName ? ' You\'re most consistent on <strong>' + bestDayName + '</strong>.' : '') + '</p>' +
      '<div class="day-row">' + dayNames.map(function (dn, i) {
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
    // Build month labels above heatmap
    var monthLabels = new Array(16).fill('');
    for (var w = 0; w < 16; w++) {
      var firstDay = hmDays[w * 7];
      if (firstDay) {
        var prevWeekDay = w > 0 ? hmDays[(w - 1) * 7] : null;
        var curMo = firstDay.slice(5, 7), prevMo = prevWeekDay ? prevWeekDay.slice(5, 7) : null;
        if (curMo !== prevMo) {
          var d3 = new Date(firstDay);
          monthLabels[w] = d3.toLocaleDateString(undefined, { month: 'short' });
        }
      }
    }
    var hmHtml = '<div class="hm-wrap">';
    hmHtml += '<div class="hm-month-row">' + monthLabels.map(function (lbl) { return '<div class="hm-mo-lbl">' + lbl + '</div>'; }).join('') + '</div>';
    hmHtml += '<div class="hm-grid">';
    for (var w2 = 0; w2 < 16; w2++) {
      hmHtml += '<div class="hm-col">';
      for (var wd = 0; wd < 7; wd++) { var day = hmDays[w2 * 7 + wd]; var c = day ? (dayCounts[day] || 0) : 0; var vi = c === 0 ? 0 : Math.min(Math.ceil((c / maxC) * 4), 4); hmHtml += '<div class="hm-cell" data-v="' + vi + '" title="' + esc(day || '') + ': ' + c + ' habits"></div>'; }
      hmHtml += '</div>';
    }
    hmHtml += '</div></div>';
    hmHtml += '<div style="display:flex;align-items:center;gap:4px;margin-top:7px;font-size:.68rem;color:var(--muted);">Less ';
    for (var li = 0; li <= 4; li++) hmHtml += '<div class="hm-cell" data-v="' + li + '" style="width:10px;height:10px;"></div>';
    hmHtml += ' More</div>';

    // ─── Focus sessions bar (last 14 days) ────────────────────────────
    var focusDays = [];
    for (var fi = 13; fi >= 0; fi--) { var fd = new Date(); fd.setDate(fd.getDate() - fi); focusDays.push({ key: fd.toISOString().slice(0, 10), lbl: ['Su','Mo','Tu','We','Th','Fr','Sa'][fd.getDay()], count: 0 }); }
    sessions.forEach(function (s) { var key = (s.date || '').slice(0, 10); var fd2 = focusDays.find(function (d2) { return d2.key === key; }); if (fd2) fd2.count++; });
    var maxF = Math.max.apply(null, focusDays.map(function (d2) { return d2.count; })) || 1;
    var focusBarHtml = '<p class="an-card-sub">Each bar = one 25-minute Pomodoro session. Total this period: <strong style="color:#a78bfa">' + focusLabel + '</strong> (' + curSessions + ' sessions).</p><div class="bar-chart">' + focusDays.map(function (d2) {
      var pct = Math.round((d2.count / maxF) * 100);
      return '<div class="bar-col"><div class="bar-val" style="color:#a78bfa;">' + (d2.count || '') + '</div><div class="bar-fill purple" style="height:' + Math.max(pct, d2.count ? 8 : 3) + 'px;"></div><div class="bar-lbl">' + d2.lbl + '</div></div>';
    }).join('') + '</div>';

    // ─── Expense bar (6 months) ───────────────────────────────────────
    var months = [];
    var now2 = new Date();
    for (var mi = 5; mi >= 0; mi--) { var md = new Date(now2.getFullYear(), now2.getMonth() - mi, 1); months.push({ key: md.getFullYear() + '-' + String(md.getMonth() + 1).padStart(2, '0'), lbl: md.toLocaleDateString(undefined, { month: 'short' }), total: 0 }); }
    expenses.forEach(function (e) { var k = (e.date || '').slice(0, 7); var m = months.find(function (x) { return x.key === k; }); if (m) m.total += parseFloat(e.amount || 0); });
    var maxM = Math.max.apply(null, months.map(function (m) { return m.total; })) || 1;
    var barHtml = '<p class="an-card-sub">Monthly spending trend. Hover a bar to see the exact amount.</p><div class="bar-chart">' + months.map(function (m) {
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
    var catEntries = Object.keys(curMoCats).map(function (k) { return [k, curMoCats[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var catTotal = catEntries.reduce(function (s, e) { return s + e[1]; }, 0) || 1;
    var catHtml = catEntries.length
      ? '<p class="an-card-sub">Spending breakdown this month. Arrows show change vs last month.</p>' +
        catEntries.map(function (e) {
          var cat = e[0], amt = e[1];
          var pct = Math.round((amt / catTotal) * 100);
          var prev = prevMoCats[cat] || 0; var delta = prev ? Math.round(((amt - prev) / prev) * 100) : 0;
          var deltaHtml2 = delta ? '<span class="cat-delta ' + (delta > 0 ? 'up' : 'down') + '">' + (delta > 0 ? '&#9650;' : '&#9660;') + Math.abs(delta) + '%</span>' : '';
          var col = EXP_CAT_COLORS[cat] || '#94a3b8';
          var emoji = EXP_CAT_EMOJI[cat] || '📦';
          return '<div class="cat-row"><div class="cat-dot" style="background:' + col + ';"></div><div class="cat-name">' + emoji + ' ' + esc(cat) + deltaHtml2 + '</div><div class="cat-pct">' + pct + '%</div><div class="cat-amt">' + Math.round(amt) + '</div></div>' +
            '<div class="cat-bar-bg"><div class="cat-bar-fg" style="width:' + pct + '%;background:' + col + ';"></div></div>';
        }).join('')
      : '<p style="color:var(--muted);font-size:.84rem;">No expenses this month.</p>';

    // ─── Budget envelopes ─────────────────────────────────────────────
    var curMonthTotal = expenses.filter(function (e) { return (e.date || '').slice(0, 7) === curMoKey; }).reduce(function (s, e) { return s + parseFloat(e.amount || 0); }, 0);
    // All built-in cats + any custom cats with spend or budget
    var budgetCatSet = {};
    Object.keys(EXP_CAT_COLORS_BASE).forEach(function (k) { budgetCatSet[k] = true; });
    Object.keys(budgets).forEach(function (k) { if (budgets[k]) budgetCatSet[k] = true; });
    Object.keys(curMoCats).forEach(function (k) { budgetCatSet[k] = true; });
    // Sort: over-budget first, then has spend, then has budget, then alphabetical
    var budgetCats = Object.keys(budgetCatSet).sort(function (a, b) {
      var sa = curMoCats[a] || 0, sb = curMoCats[b] || 0;
      var oa = budgets[a] && sa > budgets[a], ob = budgets[b] && sb > budgets[b];
      if (oa && !ob) return -1; if (ob && !oa) return 1;
      var ha = sa > 0, hb = sb > 0;
      if (ha && !hb) return -1; if (hb && !ha) return 1;
      var bha = !!(budgets[a]), bhb = !!(budgets[b]);
      if (bha && !bhb) return -1; if (bhb && !bha) return 1;
      return sb - sa || a.localeCompare(b);
    });
    var budgetHtml = '<p class="an-card-sub">Click budget amount to edit · Click <strong>+ Add</strong> to log a transaction · Red = over, yellow = &gt;80%.</p>' +
      '<div class="env-grid">' +
      budgetCats.map(function (cat) {
        var spent = curMoCats[cat] || 0, budget = budgets[cat] || 0;
        var catColor = EXP_CAT_COLORS[cat] || '#94a3b8';
        var emoji = EXP_CAT_EMOJI[cat] || '📦';
        var over = budget && spent > budget, warn = budget && !over && spent > budget * 0.8;
        var fillColor = over ? '#f87171' : (warn ? '#fbbf24' : catColor);
        var pct = budget ? Math.min(Math.round(spent / budget * 100), 100) : (spent > 0 ? 100 : 0);
        var statusBadge = over
          ? '<span class="env-status over">Over!</span>'
          : (warn ? '<span class="env-status warn">Caution</span>'
          : (budget ? '<span class="env-status ok">OK</span>' : ''));
        var remaining = budget && !over
          ? '<div class="env-remaining" style="color:#34d399">+' + Math.round(budget - spent) + ' left</div>'
          : (over ? '<div class="env-remaining" style="color:#f87171">-' + Math.round(spent - budget) + ' over</div>' : '');
        var budgetLine = budget
          ? 'of <span class="env-editable" data-cat="' + esc(cat) + '" title="Click to edit budget">' + Math.round(budget) + '</span>'
          : '<button class="env-set-btn" data-cat="' + esc(cat) + '">Set budget</button>';
        var spentDisplay = spent > 0
          ? '<div class="env-spent" style="color:' + catColor + '">' + Math.round(spent) + '</div>'
          : '<div class="env-spent" style="color:#334155">—</div>';
        return '<div class="env-card" style="border-color:' + (spent > 0 || budget > 0 ? fillColor + '40' : 'rgba(255,255,255,.05)') + '">' +
          '<div class="env-body">' +
            '<div class="env-head"><span class="env-name">' + emoji + ' ' + esc(cat) + '</span>' + statusBadge + '</div>' +
            spentDisplay +
            '<div class="env-of">' + budgetLine + '</div>' +
            remaining +
            '<button class="env-add-btn" data-cat="' + esc(cat) + '" title="Add transaction to ' + esc(cat) + '">+ Add</button>' +
          '</div>' +
          '<div class="env-bar-wrap"><div class="env-bar-fill" style="width:' + pct + '%;background:' + fillColor + '"></div></div>' +
        '</div>';
      }).join('') +
      '</div>';

    // ─── Energy trend (weekly reviews) ───────────────────────────────
    var recentReviews = reviews.slice(0, 8).reverse();
    var avgEnergy = recentReviews.length ? (recentReviews.reduce(function (s, r) { return s + (r.energy || 3); }, 0) / recentReviews.length).toFixed(1) : null;
    var energyHtml = recentReviews.length
      ? '<p class="an-card-sub">Weekly energy score (1–5) from your reviews. Avg: <strong style="color:#60a5fa">' + avgEnergy + '/5</strong></p>' +
        '<div class="energy-chart">' + recentReviews.map(function (r) {
          var e2 = r.energy || 3; var pct = (e2 / 5) * 100;
          var col = e2 >= 4 ? '#34d399' : (e2 >= 3 ? '#60a5fa' : '#f87171');
          return '<div class="energy-bar-col"><div class="energy-bar" style="height:' + Math.max(pct * 0.55, 4) + 'px;background:' + col + ';border-radius:3px 3px 0 0;width:100%;"></div><div class="energy-lbl">' + e2 + '</div></div>';
        }).join('') + '</div>'
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
        '<div class="an-card"><h4>Habit Streaks &amp; Completion</h4>' + streakHtml + '</div>' +
        '<div class="an-card"><h4>Best Day of Week</h4>' + dayHtml + '</div>' +
        '<div class="an-card an-card-full"><h4>Habit Activity Heatmap <span style="font-weight:400;opacity:.6">(16 weeks)</span></h4><p class="an-card-sub">Each cell = one day. Darker = more habits completed. Shows habit consistency at a glance.</p>' + hmHtml + '</div>' +
        '<div class="an-card"><h4>Focus Sessions</h4>' + focusBarHtml + '</div>' +
        '<div class="an-card"><h4>Weekly Energy Trend</h4>' + energyHtml + '</div>' +
        '<div class="an-card"><h4>Monthly Spend</h4>' + barHtml + '</div>' +
        '<div class="an-card"><h4>This Month by Category</h4>' + catHtml + '</div>' +
        '<div class="an-card an-card-full"><h4>Budget Tracker <span style="font-weight:400;opacity:.6">' + curMoKey + ' &mdash; Total: ' + Math.round(curMonthTotal) + '</span></h4>' + budgetHtml + '</div>' +
      '</div>';

    tab.querySelectorAll('.an-range-btn').forEach(function (btn) {
      btn.onclick = function () { anRange = parseInt(btn.dataset.range); initAnalyticsTab(); };
    });
    var csvBtn = document.getElementById('an-csv-btn');
    if (csvBtn) csvBtn.onclick = exportAnalyticsCSV;

    // Budget envelope inline editing
    function saveBudget(cat, val) {
      var bud = ls('homer-expense-budgets') || {};
      if (!isNaN(val) && val > 0) bud[cat] = Math.round(val); else delete bud[cat];
      lss('homer-expense-budgets', bud);
      initAnalyticsTab();
    }
    function makeEnvInput(cat, cur) {
      var inp = document.createElement('input');
      inp.type = 'number'; inp.value = cur; inp.min = '0'; inp.step = '50';
      inp.title = 'Enter to save · Esc to cancel';
      inp.style.cssText = 'width:80px;padding:2px 7px;border-radius:7px;border:1px solid #60a5fa;background:rgba(96,165,250,.12);color:#60a5fa;font-size:.88rem;font-weight:800;font-family:inherit;outline:none;';
      var done = false;
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !done) { done = true; saveBudget(cat, parseFloat(inp.value)); }
        if (e.key === 'Escape' && !done) { done = true; initAnalyticsTab(); }
        e.stopPropagation();
      });
      inp.addEventListener('blur', function () { if (!done) { done = true; saveBudget(cat, parseFloat(inp.value)); } });
      return inp;
    }
    tab.querySelectorAll('.env-editable').forEach(function (el) {
      el.style.cssText = 'cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;';
      el.onclick = function (e) {
        e.stopPropagation();
        var cat = el.dataset.cat, cur = (budgets[cat] || 0);
        var inp = makeEnvInput(cat, cur);
        el.parentNode.replaceChild(inp, el);
        inp.focus(); inp.select();
      };
    });
    tab.querySelectorAll('.env-set-btn').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var cat = btn.dataset.cat;
        var inp = makeEnvInput(cat, 0);
        inp.placeholder = 'Amount…';
        btn.parentNode.replaceChild(inp, btn);
        inp.focus();
      };
    });
    tab.querySelectorAll('.env-add-btn').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (window._homerOpenExpenses) window._homerOpenExpenses('', btn.dataset.cat);
      };
    });
  }
  window._homerInitAnalytics = initAnalyticsTab;

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
    { title: 'Morning Routine',      freq: 'daily',    category: 'health',   priority: 'high'   },
    { title: 'Weekly Review',        freq: 'weekly',   days: [1],            category: 'personal', priority: 'medium' },
    { title: 'Monthly Budget Check', freq: 'monthly',  dayOfMonth: 1,        category: 'finance',  priority: 'high'   },
    { title: 'End of Week Wrap-up',  freq: 'weekly',   days: [5],            category: 'work',     priority: 'medium' },
    { title: 'Quarterly Planning',   freq: 'interval', intervalDays: 90,     category: 'personal', priority: 'high'   }
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
      var dom = task.dayOfMonth || 1;
      var nowDate = new Date(t);
      var target;
      if (task.lastFired) {
        var lf2 = new Date(task.lastFired);
        // If already fired this month on or after the due day, next occurrence is next month
        if (lf2.getFullYear() === nowDate.getFullYear() && lf2.getMonth() === nowDate.getMonth() && lf2.getDate() >= dom) {
          target = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, dom);
        } else {
          target = new Date(nowDate.getFullYear(), nowDate.getMonth(), dom);
        }
      } else {
        target = new Date(nowDate.getFullYear(), nowDate.getMonth(), dom);
      }
      var daysLeft = Math.round((target - nowDate) / 86400000);
      if (daysLeft <= 0) return 'Today';
      if (daysLeft === 1) return 'In 1 day';
      return 'In ' + daysLeft + 'd';
    }
    if (task.freq === 'interval') {
      if (!task.lastFired) return 'Today';
      var elapsed = daysBetween(task.lastFired, t);
      var remaining = (task.intervalDays || 7) - elapsed;
      return remaining <= 0 ? 'Today' : 'In ' + remaining + 'd';
    }
    return '—';
  }

  // Recurring tab is the action center — no injection to inbox/tasks.
  function checkRecurring() { /* no-op: tasks surface in the Recurring tab when due */ }

  function isRTOverdue(task) {
    if (!task.enabled || task.paused || !task.lastFired) return false;
    var t = todayStr();
    if (task.lastFired === t) return false;
    if (task.freq === 'daily')    return daysBetween(task.lastFired, t) >= 2;
    if (task.freq === 'weekly')   return daysBetween(task.lastFired, t) >= 14;
    if (task.freq === 'monthly') {
      var dom2 = task.dayOfMonth || 1;
      var lf3 = new Date(task.lastFired), now2 = new Date(t);
      var monthsDiff = (now2.getFullYear() - lf3.getFullYear()) * 12 + (now2.getMonth() - lf3.getMonth());
      return monthsDiff > 1 || (monthsDiff === 1 && now2.getDate() > dom2);
    }
    if (task.freq === 'interval') return daysBetween(task.lastFired, t) >= (task.intervalDays || 7) * 2;
    return false;
  }

  function markRTDone(taskId) {
    var arr = getRT(), task = arr.find(function(t) { return t.id === taskId; });
    if (!task) return;
    var today = todayStr();
    task.lastFired = today; task.lastCompleted = today;
    if (!Array.isArray(task.completions)) task.completions = [];
    task.completions.unshift({ date: today, ts: Date.now() });
    if (task.completions.length > 90) task.completions = task.completions.slice(0, 90);
    setRT(arr);
    initRecurringTab();
    toast('\u2713 ' + task.title);
  }

  function skipOccurrence(taskId) {
    var arr = getRT(), task = arr.find(function(x) { return x.id === taskId; });
    if (!task) return;
    task.lastFired = todayStr();
    setRT(arr);
    initRecurringTab();
    toast('Skipped \u2014 next occurrence scheduled');
  }

  function computeRTStreak(task) {
    if (!Array.isArray(task.completions) || !task.completions.length) return 0;
    var today = new Date(todayStr());
    var sorted = task.completions.map(function(c) { return new Date(c.date || c); }).sort(function(a,b){return b-a;});
    if (task.freq === 'daily') {
      var streak = 0;
      for (var i = 0; i < sorted.length; i++) {
        var diff = Math.round((today - sorted[i]) / 86400000);
        if (diff === i || diff === i + 1) streak++; else break;
      }
      return streak;
    }
    var ago60 = new Date(today); ago60.setDate(ago60.getDate() - 60);
    return sorted.filter(function(d) { return d >= ago60; }).length;
  }

  var RT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var _editingTaskId = null;

  function buildRTModal() {
    var sel = function(attrs) { return '<select ' + attrs + ' style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(20,32,54,.95);color:var(--text);font-family:inherit;">'; };
    var inp = function(id, ph) { return '<input id="' + id + '" type="text" placeholder="' + ph + '" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);font-family:inherit;width:100%;box-sizing:border-box;">'; };
    var mbg = document.createElement('div'); mbg.id = 'rt-modal-bg';
    mbg.innerHTML =
      '<div id="rt-modal">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
          '<h3 id="rt-modal-title">&#128260; New Schedule</h3>' +
          '<button id="rt-modal-x" style="background:none;border:none;color:var(--muted);font-size:1.4rem;cursor:pointer;line-height:1;padding:0 4px;">&times;</button>' +
        '</div>' +
        '<div class="hn-label">Quick Templates</div>' +
        '<div class="rt-templates" id="rt-modal-tpls"></div>' +
        '<div class="rt-form-row">' + inp('rt-title', 'Schedule title *') + '</div>' +
        '<div class="rt-form-row">' +
          sel('id="rt-freq"') + '<option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="interval">Every N days</option></select>' +
          sel('id="rt-priority"') + '<option value="">No priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>' +
        '</div>' +
        '<div id="rt-freq-extra" style="margin-bottom:10px;"></div>' +
        '<div class="rt-form-row">' +
          sel('id="rt-cat"') + '<option value="">Category</option><option value="health">Health</option><option value="work">Work</option><option value="personal">Personal</option><option value="finance">Finance</option><option value="fitness">Fitness</option></select>' +
          '<textarea id="rt-note" rows="2" placeholder="Notes (optional)" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.05);color:var(--text);font-family:inherit;resize:none;"></textarea>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">' +
          '<button id="rt-modal-cancel" class="btn ghost">Cancel</button>' +
          '<button id="rt-add" class="btn primary">Add Schedule</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(mbg);

    var tplsEl = mbg.querySelector('#rt-modal-tpls');
    RT_TEMPLATES.forEach(function(t2) {
      var b = document.createElement('button'); b.className = 'rt-tpl-btn'; b.textContent = t2.title;
      b.onclick = function() {
        document.getElementById('rt-title').value = t2.title || '';
        document.getElementById('rt-freq').value = t2.freq || 'daily';
        document.getElementById('rt-cat').value = t2.category || '';
        document.getElementById('rt-priority').value = t2.priority || '';
        document.getElementById('rt-freq').dispatchEvent(new Event('change'));
        if (t2.freq === 'weekly' && t2.days) {
          setTimeout(function() { t2.days.forEach(function(d2) { var cb = document.querySelector('.rt-day-cb[value="' + d2 + '"]'); if (cb) cb.checked = true; }); }, 60);
        }
      };
      tplsEl.appendChild(b);
    });

    var freqSel = mbg.querySelector('#rt-freq');
    function updateFreqExtra() {
      var fe = document.getElementById('rt-freq-extra'); if (!fe) return;
      var f = freqSel.value;
      var baseStyle = 'padding:8px 10px;border-radius:9px;border:1px solid var(--border);background:rgba(20,32,54,.95);color:var(--text);';
      if (f === 'weekly') {
        fe.innerHTML = '<div class="hn-label">Which days?</div><div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          RT_DAY_NAMES.map(function(dn, i) { return '<label style="display:flex;align-items:center;gap:4px;font-size:.8rem;cursor:pointer;"><input type="checkbox" class="rt-day-cb" value="' + i + '" style="accent-color:#60a5fa;">' + dn + '</label>'; }).join('') + '</div>';
      } else if (f === 'monthly') {
        fe.innerHTML = '<div class="hn-label">Day of month</div><input id="rt-dom" type="number" min="1" max="31" value="1" style="width:80px;' + baseStyle + '">';
      } else if (f === 'interval') {
        fe.innerHTML = '<div class="hn-label">Every how many days?</div><input id="rt-interval" type="number" min="1" max="365" value="7" style="width:90px;' + baseStyle + '">';
      } else { fe.innerHTML = ''; }
    }
    freqSel.addEventListener('change', updateFreqExtra);

    function closeModal() { mbg.classList.remove('open'); }
    mbg.querySelector('#rt-modal-x').onclick = closeModal;
    mbg.querySelector('#rt-modal-cancel').onclick = closeModal;
    mbg.addEventListener('click', function(e) { if (e.target === mbg) closeModal(); });

    mbg.querySelector('#rt-add').onclick = function() {
      var title = (document.getElementById('rt-title').value || '').trim();
      if (!title) { document.getElementById('rt-title').focus(); return; }
      var freq = document.getElementById('rt-freq').value;
      var arr = getRT();
      if (_editingTaskId) {
        var idx = -1;
        for (var j = 0; j < arr.length; j++) { if (arr[j].id === _editingTaskId) { idx = j; break; } }
        if (idx !== -1) {
          arr[idx] = Object.assign({}, arr[idx], {
            title: title, freq: freq,
            category: document.getElementById('rt-cat').value,
            priority: document.getElementById('rt-priority').value,
            note: (document.getElementById('rt-note').value || '').trim()
          });
          if (freq === 'weekly') {
            var ecbs = document.querySelectorAll('.rt-day-cb:checked');
            arr[idx].days = Array.prototype.map.call(ecbs, function(cb) { return parseInt(cb.value); });
          } else if (freq === 'monthly') {
            arr[idx].dayOfMonth = parseInt(document.getElementById('rt-dom').value || '1');
          } else if (freq === 'interval') {
            arr[idx].intervalDays = parseInt(document.getElementById('rt-interval').value || '7');
          }
          setRT(arr);
        }
        closeModal(); initRecurringTab(); toast('Schedule updated');
      } else {
        var task = {
          id: uid(), title: title, freq: freq, enabled: true, paused: false,
          category: document.getElementById('rt-cat').value,
          priority: document.getElementById('rt-priority').value,
          note: (document.getElementById('rt-note').value || '').trim(),
          lastFired: null, completions: [], created: new Date().toISOString()
        };
        if (freq === 'weekly') {
          var cbs = document.querySelectorAll('.rt-day-cb:checked');
          task.days = Array.prototype.map.call(cbs, function(cb) { return parseInt(cb.value); });
        } else if (freq === 'monthly') {
          task.dayOfMonth = parseInt(document.getElementById('rt-dom').value || '1');
        } else if (freq === 'interval') {
          task.intervalDays = parseInt(document.getElementById('rt-interval').value || '7');
        }
        arr.push(task); setRT(arr);
        document.getElementById('rt-title').value = '';
        closeModal(); initRecurringTab(); toast('Schedule added');
      }
    };
  }

  function openRTModal() {
    if (!document.getElementById('rt-modal-bg')) buildRTModal();
    _editingTaskId = null;
    document.getElementById('rt-modal-title').textContent = '\uD83D\uDD01 New Schedule';
    document.getElementById('rt-add').textContent = 'Add Schedule';
    document.getElementById('rt-title').value = '';
    document.getElementById('rt-freq').value = 'daily';
    document.getElementById('rt-priority').value = '';
    document.getElementById('rt-cat').value = '';
    document.getElementById('rt-freq-extra').innerHTML = '';
    document.getElementById('rt-note').value = '';
    document.getElementById('rt-modal-bg').classList.add('open');
    setTimeout(function() { document.getElementById('rt-title').focus(); }, 60);
  }

  function openRTEditModal(task) {
    if (!document.getElementById('rt-modal-bg')) buildRTModal();
    _editingTaskId = task.id;
    document.getElementById('rt-modal-title').textContent = '\u270F\uFE0F Edit Schedule';
    document.getElementById('rt-add').textContent = 'Save Changes';
    document.getElementById('rt-title').value = task.title || '';
    document.getElementById('rt-freq').value = task.freq || 'daily';
    document.getElementById('rt-priority').value = task.priority || '';
    document.getElementById('rt-cat').value = task.category || '';
    document.getElementById('rt-note').value = task.note || '';
    document.getElementById('rt-freq').dispatchEvent(new Event('change'));
    setTimeout(function() {
      if (task.freq === 'weekly' && task.days) {
        task.days.forEach(function(d2) { var cb = document.querySelector('.rt-day-cb[value="' + d2 + '"]'); if (cb) cb.checked = true; });
      } else if (task.freq === 'monthly' && task.dayOfMonth) {
        var domEl = document.getElementById('rt-dom'); if (domEl) domEl.value = task.dayOfMonth;
      } else if (task.freq === 'interval' && task.intervalDays) {
        var intEl = document.getElementById('rt-interval'); if (intEl) intEl.value = task.intervalDays;
      }
    }, 60);
    document.getElementById('rt-modal-bg').classList.add('open');
    setTimeout(function() { document.getElementById('rt-title').focus(); }, 70);
  }

  function initRecurringTab() {
    var tab = document.getElementById('tab-recurring'); if (!tab) return;

    // Migrate old data
    var tasks = getRT(), migrated = false;
    tasks.forEach(function(t) {
      if (!Array.isArray(t.completions)) { t.completions = []; migrated = true; }
      if (t.status !== undefined) { delete t.status; migrated = true; }
    });
    if (migrated) setRT(tasks);

    var today = todayStr();
    var active = tasks.filter(function(t) { return t.enabled && !t.paused; });
    var actionItems = active.filter(function(t) { return calcNextDue(t) === 'Today' && t.lastFired !== today; });
    // Expose for Daily Brief — exact same criteria, no reimplementation
    var tomorrowItems = active.filter(function(t) {
      var nd = calcNextDue(t); return nd === 'Tomorrow' || nd === 'In 1 day' || nd === 'In 1d';
    });
    window.__homerRTDue = { today: actionItems, tomorrow: tomorrowItems };
    var doneToday  = tasks.filter(function(t) { return t.lastCompleted === today || (t.completions.length && t.completions[0].date === today); });
    var doneIds = {}; doneToday.forEach(function(t) { doneIds[t.id] = true; });
    var tomorrowItems = active.filter(function(t) { return calcNextDue(t) === 'Tomorrow' && !doneIds[t.id]; });
    var thisMonth = today.slice(0, 7);
    var monthDone = 0;
    tasks.forEach(function(t) { monthDone += t.completions.filter(function(c) { return (c.date || '').startsWith(thisMonth); }).length; });

    var allPaused = tasks.length > 0 && tasks.every(function(t) { return t.paused; });

    tab.innerHTML = '';
    var dash = document.createElement('div'); dash.style.cssText = 'display:flex;flex-direction:column;gap:20px;';
    tab.appendChild(dash);

    // ── Header
    var hd = document.createElement('div');
    hd.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;';
    hd.innerHTML =
      '<h2 class="section" style="margin:0;">&#128260; Recurring Tasks</h2>' +
      '<div style="display:flex;gap:7px;align-items:center;">' +
        '<button class="rt-hd-btn" id="rt-manage-btn">&#9776; Manage</button>' +
        '<button class="rt-hd-btn primary" id="rt-new-btn">&#43; New Schedule</button>' +
      '</div>';
    dash.appendChild(hd);

    // ── Stats
    var statsEl = document.createElement('div'); statsEl.className = 'rt-stats';
    [
      { val: active.length,            lbl: 'Active',        color: '#60a5fa' },
      { val: actionItems.length,       lbl: 'Due Today',     color: '#fbbf24' },
      { val: actionItems.filter(isRTOverdue).length, lbl: 'Overdue', color: '#f87171' },
      { val: monthDone,                lbl: 'Done This Month',color: '#34d399' }
    ].forEach(function(s) {
      var el = document.createElement('div'); el.className = 'rt-stat';
      el.innerHTML = '<div class="rt-stat-val" style="color:' + s.color + ';">' + s.val + '</div><div class="rt-stat-lbl">' + s.lbl + '</div>';
      statsEl.appendChild(el);
    });
    dash.appendChild(statsEl);

    // ── Needs Attention
    var attnEl = document.createElement('div'); attnEl.className = 'rt-section';
    var attnCount = actionItems.length + tomorrowItems.length;
    var attnHd = '<div class="rt-section-hd"><h3>Needs Attention</h3>' +
      (attnCount ? '<span class="rt-section-badge" style="background:rgba(251,191,36,.14);color:#fbbf24;">' + attnCount + '</span>' : '') +
      '</div>';
    var attnBody = '';
    if (!actionItems.length && !tomorrowItems.length && !doneToday.length) {
      attnBody = '<div class="rt-catchup">&#127881; All caught up! Nothing due today or tomorrow.</div>';
    } else {
      if (actionItems.length || tomorrowItems.length) {
        attnBody += '<div class="rt-action-grid">';
        actionItems.forEach(function(task) {
          var overdue = isRTOverdue(task);
          var catColor = RT_CATS[task.category] || 'var(--muted)';
          var freqLabel = task.freq === 'interval' ? 'Every ' + (task.intervalDays || 7) + 'd' : task.freq;
          if (task.freq === 'weekly' && task.days && task.days.length) freqLabel += ' (' + task.days.map(function(d2) { return RT_DAY_NAMES[d2]; }).join(',') + ')';
          if (task.freq === 'monthly' && task.dayOfMonth) freqLabel += ' (day ' + task.dayOfMonth + ')';
          var streak = computeRTStreak(task);
          attnBody +=
            '<div class="rt-action-card ' + (overdue ? 'overdue' : 'due-today') + '">' +
              '<div class="rt-ac-top">' +
                '<div class="rt-ac-title">' + esc(task.title) + '</div>' +
                (overdue
                  ? '<span class="rt-ac-tag" style="background:rgba(248,113,113,.15);color:#f87171;">OVERDUE</span>'
                  : '<span class="rt-ac-tag" style="background:rgba(251,191,36,.15);color:#fbbf24;">TODAY</span>') +
              '</div>' +
              '<div class="rt-ac-badges">' +
                '<span class="rt-freq ' + task.freq + '">' + esc(freqLabel) + '</span>' +
                (task.category ? '<span class="rt-cat" style="background:' + catColor + '22;color:' + catColor + ';">' + esc(task.category) + '</span>' : '') +
                (task.priority ? '<span class="rt-priority-' + task.priority + '">' + task.priority + '</span>' : '') +
                (streak > 1 ? '<span style="font-size:.62rem;color:#fbbf24;font-weight:800;">&#9733; ' + streak + '</span>' : '') +
              '</div>' +
              (task.note ? '<div class="rt-ac-note">' + esc(task.note) + '</div>' : '') +
              '<div class="rt-ac-btns">' +
                '<button class="rt-done-btn" data-done="' + esc(task.id) + '">&#10003; Mark Done</button>' +
                '<button class="rt-skip-btn" data-skip="' + esc(task.id) + '">Skip</button>' +
              '</div>' +
            '</div>';
        });
        tomorrowItems.forEach(function(task) {
          var catColor = RT_CATS[task.category] || 'var(--muted)';
          var freqLabel = task.freq === 'interval' ? 'Every ' + (task.intervalDays || 7) + 'd' : task.freq;
          if (task.freq === 'weekly' && task.days && task.days.length) freqLabel += ' (' + task.days.map(function(d2) { return RT_DAY_NAMES[d2]; }).join(',') + ')';
          if (task.freq === 'monthly' && task.dayOfMonth) freqLabel += ' (day ' + task.dayOfMonth + ')';
          var streak = computeRTStreak(task);
          attnBody +=
            '<div class="rt-action-card tomorrow">' +
              '<div class="rt-ac-top">' +
                '<div class="rt-ac-title">' + esc(task.title) + '</div>' +
                '<span class="rt-ac-tag" style="background:rgba(96,165,250,.15);color:#60a5fa;">TOMORROW</span>' +
              '</div>' +
              '<div class="rt-ac-badges">' +
                '<span class="rt-freq ' + task.freq + '">' + esc(freqLabel) + '</span>' +
                (task.category ? '<span class="rt-cat" style="background:' + catColor + '22;color:' + catColor + ';">' + esc(task.category) + '</span>' : '') +
                (task.priority ? '<span class="rt-priority-' + task.priority + '">' + task.priority + '</span>' : '') +
                (streak > 1 ? '<span style="font-size:.62rem;color:#fbbf24;font-weight:800;">&#9733; ' + streak + '</span>' : '') +
              '</div>' +
              (task.note ? '<div class="rt-ac-note">' + esc(task.note) + '</div>' : '') +
            '</div>';
        });
        attnBody += '</div>';
      }
      if (doneToday.length) {
        attnBody += '<div class="rt-done-list">';
        doneToday.forEach(function(task) {
          attnBody += '<div class="rt-done-item"><div class="rt-done-check">&#10003;</div><div class="rt-done-item-title">' + esc(task.title) + '</div><span style="font-size:.68rem;color:#34d399;font-weight:700;">Done</span></div>';
        });
        attnBody += '</div>';
      }
    }
    attnEl.innerHTML = attnHd + attnBody;
    attnEl.querySelectorAll('[data-done]').forEach(function(btn) { btn.onclick = function() { markRTDone(btn.dataset.done); }; });
    attnEl.querySelectorAll('[data-skip]').forEach(function(btn) { btn.onclick = function() { skipOccurrence(btn.dataset.skip); }; });
    dash.appendChild(attnEl);

    // ── All Schedules (collapsible)
    var schedEl = document.createElement('div'); schedEl.className = 'rt-section';
    var schedBody = document.createElement('div'); schedBody.id = 'rt-sched-body'; schedBody.style.display = 'none';
    schedEl.innerHTML = '<div class="rt-section-hd" style="cursor:pointer;" id="rt-sched-hd"><h3>All Schedules (' + tasks.length + ')</h3><button class="rt-toggle-sec" id="rt-sched-chevron">&#9660; Show</button></div>';
    schedEl.appendChild(schedBody);
    dash.appendChild(schedEl);

    document.getElementById('rt-sched-hd').onclick = function() {
      var open = schedBody.style.display !== 'none';
      schedBody.style.display = open ? 'none' : 'block';
      document.getElementById('rt-sched-chevron').innerHTML = open ? '&#9660; Show' : '&#9650; Hide';
      if (!open) renderRTSchedGrid(schedBody, getRT());
    };

    // ── Header button wiring
    tab.querySelector('#rt-new-btn').onclick = openRTModal;
    tab.querySelector('#rt-manage-btn').onclick = function() {
      schedBody.style.display = 'block';
      document.getElementById('rt-sched-chevron').innerHTML = '&#9650; Hide';
      renderRTSchedGrid(schedBody, getRT());
      schedEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  function renderRTSchedGrid(container, tasks) {
    if (!tasks.length) { container.innerHTML = '<div class="rt-catchup">No schedules yet. Add your first one.</div>'; return; }
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
      '<span style="font-size:.8rem;color:var(--muted);">' + tasks.length + ' schedule' + (tasks.length > 1 ? 's' : '') + '</span>' +
      '<button class="rt-hd-btn primary" id="rt-sched-add-btn" style="font-size:.74rem;padding:5px 11px;">&#43; Add</button>' +
    '</div><div class="rt-sched-grid">';

    tasks.forEach(function(task) {
      var catColor = RT_CATS[task.category] || 'var(--muted)';
      var freqLabel = task.freq === 'interval' ? 'Every ' + (task.intervalDays || 7) + 'd' : task.freq;
      if (task.freq === 'weekly' && task.days && task.days.length) freqLabel += ' (' + task.days.map(function(d2) { return RT_DAY_NAMES[d2]; }).join(',') + ')';
      if (task.freq === 'monthly' && task.dayOfMonth) freqLabel += ' (day ' + task.dayOfMonth + ')';
      var streak = computeRTStreak(task);
      var total = task.completions.length;
      html +=
        '<div class="rt-sched-card' + (task.paused ? ' paused' : '') + '">' +
          '<div class="rt-sched-title">' + esc(task.title) + '</div>' +
          '<div class="rt-sched-badges">' +
            '<span class="rt-freq ' + task.freq + '">' + esc(freqLabel) + '</span>' +
            (task.category ? '<span class="rt-cat" style="background:' + catColor + '22;color:' + catColor + ';">' + esc(task.category) + '</span>' : '') +
            (task.priority ? '<span class="rt-priority-' + task.priority + '">' + task.priority + '</span>' : '') +
          '</div>' +
          '<div class="rt-sched-meta">' +
            'Next: ' + esc(calcNextDue(task)) +
            (streak > 0 ? ' &nbsp;&bull;&nbsp; <span style="color:#fbbf24;font-weight:700;">&#9733; ' + streak + '</span>' : '') +
            (total > 0 ? ' &nbsp;&bull;&nbsp; ' + total + ' done' : '') +
            (task.lastCompleted ? '<br>Last: ' + fmtDate(task.lastCompleted) : '') +
          '</div>' +
          '<div class="rt-sched-actions">' +
            '<button class="rt-sched-btn rt-sched-edit-btn" data-id="' + esc(task.id) + '">&#9998; Edit</button>' +
            '<button class="rt-sched-btn rt-sched-pause-btn" data-id="' + esc(task.id) + '">' + (task.paused ? 'Resume' : 'Pause') + '</button>' +
            '<button class="rt-sched-btn danger rt-sched-del-btn" data-id="' + esc(task.id) + '">&#x2715; Delete</button>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelector('#rt-sched-add-btn').onclick = openRTModal;
    container.querySelectorAll('.rt-sched-edit-btn').forEach(function(btn) {
      btn.onclick = function() {
        var arr = getRT(), t = arr.find(function(x) { return x.id === btn.dataset.id; });
        if (t) openRTEditModal(t);
      };
    });
    container.querySelectorAll('.rt-sched-pause-btn').forEach(function(btn) {
      btn.onclick = function() {
        var arr = getRT(), x = arr.find(function(t) { return t.id === btn.dataset.id; });
        if (x) { x.paused = !x.paused; setRT(arr); initRecurringTab(); }
      };
    });
    container.querySelectorAll('.rt-sched-del-btn').forEach(function(btn) {
      btn.onclick = function() {
        var arr = getRT(), t = arr.find(function(x) { return x.id === btn.dataset.id; });
        if (!t || !confirm('Delete "' + t.title + '"?')) return;
        setRT(arr.filter(function(x) { return x.id !== btn.dataset.id; })); initRecurringTab();
      };
    });
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
    if (acc || notes) {
      var sessions = ls('homer-sessions') || [];
      var sid = (snData || {}).sessionId, found = false;
      if (sid) { for (var i = 0; i < sessions.length; i++) { if (sessions[i].id === sid) { sessions[i].accomplished = acc; sessions[i].notes = notes; found = true; break; } } }
      if (!found) sessions.unshift({ id: uid(), accomplished: acc, notes: notes, date: new Date().toISOString(), count: (snData || {}).count });
      lss('homer-sessions', sessions);
    }
    hideSN(); syncCtx();
  }
  window.addEventListener('homer:pom-complete', function (e) { var d = (e && e.detail) || {}; if (d.phase === 'focus') setTimeout(function () { showSN({ count: d.count, sessionId: d.sessionId }); }, 600); });

  // ── Weekly Review Modal ───────────────────────────────────────────────
  var wrEl = null, wrEnergy = 3;
  function buildWR() {
    var el = document.createElement('div'); el.id = 'wr-overlay';
    var energyBtns = [1,2,3,4,5].map(function (n) { var lbl = ['','Drained','Low','Okay','Good','Energized'][n]; return '<button class="wr-energy-btn' + (n===3?' active':'') + '" data-e="' + n + '">' + n + ' \u2014 ' + lbl + '</button>'; }).join('');
    el.innerHTML = '<div id="wr-box"><div class="hn-modal-head" style="margin-bottom:6px;"><h3>&#128196; Weekly Review</h3><button class="hn-close-btn" id="wr-x">&times;</button></div><div id="wr-stats"></div><div class="wr-label">Energy / Mood This Week</div><div class="wr-energy-row">' + energyBtns + '</div><div class="wr-label">Top Win</div><textarea id="wr-win" class="hn-field hn-textarea" placeholder="What went well?"></textarea><div class="wr-label">What Didn\'t Work</div><textarea id="wr-block" class="hn-field hn-textarea" placeholder="What held you back?"></textarea><div class="wr-label">Next Week Focus</div><textarea id="wr-next" class="hn-field hn-textarea" placeholder="#1 priority next week?"></textarea><div class="wr-label">Free Notes</div><textarea id="wr-free" class="hn-field hn-textarea" placeholder="Anything else..."></textarea><div class="hn-actions" style="margin-top:16px;"><button id="wr-cancel" class="btn ghost">Cancel</button><button id="wr-save" class="btn primary">Save Review</button></div></div>';
    document.body.appendChild(el);
    el.querySelectorAll('.wr-energy-btn').forEach(function (b) { b.onclick = function () { wrEnergy = parseInt(b.dataset.e); el.querySelectorAll('.wr-energy-btn').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); }; });
    el.querySelector('#wr-x').onclick = hideWR; el.querySelector('#wr-cancel').onclick = hideWR; el.querySelector('#wr-save').onclick = saveWR;
    el.addEventListener('click', function (e) { if (e.target === el) hideWR(); });
    return el;
  }
  function computeWRStats() {
    var stats = [];
    var now = new Date(), ago7 = new Date(now); ago7.setDate(ago7.getDate() - 7);
    var ago7Str = ago7.toISOString().slice(0, 10);
    // Habits: 7-day avg rate + best streak
    var hd = getHabitsData();
    if (hd.habits.length) {
      var rates = hd.habits.map(function (h) { return calcCompletionRate(h, hd.completions, 7); });
      var avg = Math.round(rates.reduce(function (s, r) { return s + r; }, 0) / rates.length);
      var bestStreak = hd.habits.reduce(function (m, h) { return Math.max(m, calcStreak(h, hd.completions)); }, 0);
      stats.push({ icon: '\uD83D\uDD25', value: avg + '%', label: 'habit rate', color: '#34d399' });
      if (bestStreak > 0) stats.push({ icon: '\u26A1', value: bestStreak + 'd', label: 'best streak', color: '#fbbf24' });
    }
    // Focus sessions + time in past 7 days
    var sessions = (ls('homer-sessions') || []).filter(function (s) { return (s.date || '') >= ago7Str; });
    if (sessions.length) {
      var totalMin = sessions.reduce(function (s, x) { return s + (x.duration || 25); }, 0);
      var hrs = Math.floor(totalMin / 60), rem = totalMin % 60;
      stats.push({ icon: '\uD83C\uDFAF', value: sessions.length + '', label: 'focus sessions', color: '#a78bfa' });
      stats.push({ icon: '\u23F1\uFE0F', value: (hrs ? hrs + 'h ' : '') + (rem ? rem + 'm' : hrs + 'h'), label: 'focus time', color: '#60a5fa' });
    }
    // Journal entries this week
    var jCount = (ls('homer-journal') || []).filter(function (e) { return !e.deleted && (e.date || '') >= ago7Str; }).length;
    if (jCount) stats.push({ icon: '\uD83D\uDCD6', value: jCount + '', label: jCount === 1 ? 'journal entry' : 'journal entries', color: '#fb923c' });
    // Expenses this week: total + top category
    var weekExp = (ls('homer-expenses') || []).filter(function (e) { return (e.date || '') >= ago7Str; });
    if (weekExp.length) {
      var total = weekExp.reduce(function (s, e) { return s + parseFloat(e.amount || 0); }, 0);
      var catTotals = {};
      weekExp.forEach(function (e) { var c = e.cat || e.category || 'other'; catTotals[c] = (catTotals[c] || 0) + parseFloat(e.amount || 0); });
      var topCat = Object.keys(catTotals).sort(function (a, b) { return catTotals[b] - catTotals[a]; })[0] || '';
      stats.push({ icon: '\uD83D\uDCB0', value: Math.round(total) + '', label: 'spent' + (topCat ? ' \u00b7 top: ' + topCat : ''), color: '#f87171' });
    }
    return stats;
  }
  function showWR() {
    if (!wrEl) wrEl = buildWR();
    ['#wr-win','#wr-block','#wr-next','#wr-free'].forEach(function (s) { wrEl.querySelector(s).value = ''; });
    wrEnergy = 3; wrEl.querySelectorAll('.wr-energy-btn').forEach(function (b) { b.classList.toggle('active', parseInt(b.dataset.e) === 3); });
    // Populate auto-stats
    var statsEl = wrEl.querySelector('#wr-stats');
    if (statsEl) {
      var stats = computeWRStats();
      if (stats.length) {
        statsEl.style.display = 'flex';
        statsEl.innerHTML = '<div class="wr-stats-hd">Last 7 days</div>' + stats.map(function (s) {
          return '<div class="wr-stat-item"><span class="wr-stat-icon">' + s.icon + '</span><span class="wr-stat-val" style="color:' + s.color + ';">' + esc(s.value) + '</span><span class="wr-stat-lbl">' + esc(s.label) + '</span></div>';
        }).join('');
      } else {
        statsEl.style.display = 'none';
      }
    }
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
  var sbEl2 = null, _sbResults = [], _sbActiveIdx = -1;
  function _sbSetActive(i) {
    _sbActiveIdx = i;
    var items = document.querySelectorAll('#sb-results .sb-result');
    items.forEach(function (el, idx) { el.classList.toggle('active', idx === i); });
    if (i >= 0 && items[i]) items[i].scrollIntoView({ block: 'nearest' });
  }
  function buildSB() {
    var el = document.createElement('div'); el.id = 'sb-overlay';
    el.innerHTML = '<div id="sb-box"><div id="sb-input-wrap"><svg viewBox="0 0 24 24" style="width:17px;height:17px;flex-shrink:0;stroke:var(--muted);fill:none;stroke-width:2;stroke-linecap:round;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="sb-input" type="text" placeholder="Search notes, journal, links, quotes, tasks, kanban..." autocomplete="off"><kbd style="font-size:.7rem;color:var(--muted);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:3px 7px;border-radius:6px;flex-shrink:0;">ESC</kbd></div><div id="sb-results"><p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">Type to search&hellip;</p></div></div>';
    document.body.appendChild(el);
    el.querySelector('#sb-input').addEventListener('input', function () { _sbActiveIdx = -1; doSearch(this.value.trim().toLowerCase()); });
    el.addEventListener('click', function (e) { if (e.target === el) hideSB(); });
    el.querySelector('#sb-input').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); _sbSetActive(Math.min(_sbActiveIdx + 1, _sbResults.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); _sbSetActive(Math.max(_sbActiveIdx - 1, 0)); }
      else if (e.key === 'Enter' && _sbActiveIdx >= 0 && _sbResults[_sbActiveIdx]) { _sbResults[_sbActiveIdx].act(); }
      else if (e.key === 'Escape') hideSB();
    });
    return el;
  }
  function showSB() {
    if (!sbEl2) sbEl2 = buildSB(); sbEl2.style.display = 'flex';
    _sbResults = []; _sbActiveIdx = -1;
    sbEl2.querySelector('#sb-input').value = ''; sbEl2.querySelector('#sb-results').innerHTML = '<p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">Type to search&hellip;</p>';
    setTimeout(function () { sbEl2.querySelector('#sb-input').focus(); }, 50);
  }
  function hideSB() { if (sbEl2) sbEl2.style.display = 'none'; }
  function doSearch(q) {
    var res = document.getElementById('sb-results'); if (!res) return;
    if (q.length < 2) { res.innerHTML = '<p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">Type at least 2 chars&hellip;</p>'; _sbResults = []; return; }
    var results = [];
    var colors = { Note:'#60a5fa', Inbox:'#a78bfa', Task:'#fbbf24', 'Pom Task':'#f87171', Kanban:'#34d399', Expense:'#f87171', Habit:'#34d399', Recurring:'#38bdf8', Journal:'#fb923c', Link:'#60a5fa', Quote:'#facc15' };
    // Notes
    getNotes().forEach(function (n) { if ((n.title + ' ' + n.content).toLowerCase().includes(q)) results.push({ type: 'Note', title: n.title, snip: (n.content || '').slice(0, 80), act: function () { if (window._homerShowTab) window._homerShowTab('notes'); setTimeout(function () { openNote(n.id); }, 150); hideSB(); } }); });
    // Journal entries
    (ls('homer-journal') || []).filter(function (e) { return !e.deleted; }).forEach(function (e) { var text = e.content || e.text || ''; if (text.toLowerCase().includes(q)) results.push({ type: 'Journal', title: 'Journal \u2014 ' + (e.date || ''), snip: text.slice(0, 80), act: function () { if (window._homerShowTab) window._homerShowTab('journal'); hideSB(); } }); });
    // Saved quotes
    (ls('motivator.savedQuotes.v1') || []).forEach(function (sq) { var text = sq.q || sq.text || sq.quote || ''; var author = sq.a || sq.author || ''; if ((text + ' ' + author).toLowerCase().includes(q)) results.push({ type: 'Quote', title: '\u201c' + text.slice(0, 60) + '\u201d', snip: author ? '\u2014 ' + author : '', act: hideSB }); });
    // Links
    (ls('homer-links') || []).forEach(function (lk) { if (lk && ((lk.name || '') + ' ' + (lk.url || '') + ' ' + (lk.cat || '')).toLowerCase().includes(q)) results.push({ type: 'Link', title: lk.name || lk.url, snip: lk.url || '', act: function () { if (window._homerShowTab) window._homerShowTab('links'); hideSB(); } }); });
    // Kanban tasks
    var kanban = ls('homer-kanban') || {}; (kanban.tasks || []).forEach(function (t) { if (t && (t.summary || '').toLowerCase().includes(q)) { var colLabel = { todo: 'Todo', progress: 'In Progress', done: 'Done' }[t.col || 'todo'] || (t.col || ''); results.push({ type: 'Kanban', title: t.summary, snip: colLabel, act: function () { if (window._homerShowTab) window._homerShowTab('vault'); setTimeout(function () { var b = document.getElementById('vd-open-kanban'); if (b) b.click(); }, 250); hideSB(); } }); } });
    // Pomodoro tasks
    (ls('pom.tasks.v1') || []).forEach(function (t) { if (t && (t.text || '').toLowerCase().includes(q)) results.push({ type: 'Pom Task', title: t.text, snip: t.done ? 'Done' : 'Open', act: function () { if (window._homerShowTab) window._homerShowTab('pomodoro'); hideSB(); } }); });
    // Inbox
    (ls('homer-inbox') || []).forEach(function (item) { if (item && (item.text + ' ' + (item.note || '')).toLowerCase().includes(q)) results.push({ type: 'Inbox', title: item.text, snip: item.note || '', act: hideSB }); });
    // Capture tasks
    (ls('homer-task-list') || []).forEach(function (t) { if (t && (t.text || '').toLowerCase().includes(q)) results.push({ type: 'Task', title: t.text, snip: t.done ? 'Done' : 'Open', act: hideSB }); });
    // Expenses
    (ls('homer-expenses') || []).forEach(function (e) { if (!e) return; var desc = e.desc || e.description || ''; var cat = e.cat || e.category || ''; if ((desc + ' ' + cat).toLowerCase().includes(q)) results.push({ type: 'Expense', title: desc || 'Expense', snip: cat + (e.amount ? ' \u00b7 ' + e.amount : ''), act: hideSB }); });
    // Habits
    var hd = getHabitsData(); hd.habits.forEach(function (h) { if ((h.name || '').toLowerCase().includes(q)) results.push({ type: 'Habit', title: h.name, snip: 'Streak: ' + calcStreak(h, hd.completions), act: hideSB }); });
    // Recurring tasks
    getRT().forEach(function (t) { if ((t.title || '').toLowerCase().includes(q)) results.push({ type: 'Recurring', title: t.title, snip: t.freq + (t.category ? ' \u00b7 ' + t.category : ''), act: function () { if (window._homerShowTab) window._homerShowTab('recurring'); hideSB(); } }); });
    _sbResults = results;
    if (!results.length) { res.innerHTML = '<p style="text-align:center;color:var(--muted);padding:28px 0;font-size:.88rem;">No results for &ldquo;' + esc(q) + '&rdquo;</p>'; return; }
    var html = results.slice(0, 25).map(function (r, i) { return '<div class="sb-result" data-i="' + i + '"><div class="sb-result-type" style="color:' + (colors[r.type] || 'var(--muted)') + ';">' + r.type + '</div><div class="sb-result-title">' + esc(r.title || '') + '</div>' + (r.snip ? '<div class="sb-result-snip">' + esc(r.snip) + '</div>' : '') + '</div>'; }).join('');
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
    if (tab === 'notes') { initNotesTab(); renderNoteList(); }
    else if (tab === 'analytics') initAnalyticsTab();
    else if (tab === 'recurring') initRecurringTab();
  }
  window.addEventListener('homer-tab-change', function (e) { onTab(e && e.detail && e.detail.tab); });

  // ── Keyboard Shortcuts ────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.key === 'n') { e.preventDefault(); showQC('inbox'); }
    if (e.altKey && e.key === 'd') { e.preventDefault(); if (window._homerShowTab) window._homerShowTab('daily-brief'); }
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); showSB(); }
    if (e.ctrlKey && e.key === ' ') { e.preventDefault(); showQC('inbox'); }
    if (e.key === 'Escape') { hideSB(); hideQC(); hideWR(); hideSN(); }
  });

  // ── Mobile quick actions ──────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#msheet-qa-capture');
    if (btn) { showQC('inbox'); var sheet = document.getElementById('mobile-sheet'); if (sheet) sheet.classList.remove('open'); }
    var qnoteBtn = e.target.closest('#msheet-qa-qnote');
    if (qnoteBtn) { var s0 = document.getElementById('mobile-sheet'); if (s0) s0.classList.remove('open'); showQC('note'); }
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

  // ── More-sheet scroll lock ────────────────────────────────────────────
  // Attach a NON-PASSIVE document-level touchmove handler while the sheet is
  // open. This is the only reliable way to stop Chrome Android from scrolling
  // the page behind the sheet — CSS overscroll-behavior and overflow:hidden
  // on body are both insufficient because Chrome still processes gestures that
  // originate on the fixed overlay. The document handler can call
  // preventDefault() which fully cancels the gesture for anything outside the
  // scrollable sheet content.
  function initSheetScrollLock() {
    var sheet = document.getElementById('mobile-sheet');
    var content = document.getElementById('mobile-sheet-content');
    if (!sheet || !content) return;
    var moveHandler = null, startHandler = null, startY = 0;

    function lock() {
      if (moveHandler) return;
      startHandler = function (e) { startY = e.touches[0].clientY; };
      moveHandler = function (e) {
        var inContent = content.contains(e.target);
        if (!inContent) { e.preventDefault(); return; }
        // Block downward drag when content is already at the top —
        // this is exactly what triggers Chrome's pull-to-refresh.
        var goingDown = e.touches[0].clientY > startY;
        if (goingDown && content.scrollTop <= 0) e.preventDefault();
      };
      document.addEventListener('touchstart', startHandler, { passive: true });
      document.addEventListener('touchmove',  moveHandler,  { passive: false });
    }

    function unlock() {
      if (!moveHandler) return;
      document.removeEventListener('touchstart', startHandler, { passive: true });
      document.removeEventListener('touchmove',  moveHandler,  { passive: false });
      moveHandler = startHandler = null;
    }

    new MutationObserver(function () {
      sheet.classList.contains('open') ? lock() : unlock();
    }).observe(sheet, { attributes: true, attributeFilter: ['class'] });
  }

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    addTabSections();
    checkRecurring();
    syncCtx();
    setTimeout(patchTabSystem, 300);
    initSwipeNav();
    initSheetScrollLock();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 120);

})();
