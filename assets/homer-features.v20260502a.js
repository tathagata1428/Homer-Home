/* ====================================================================
 * Homer Features  v20260502a
 * Toast · Error Boundary · Offline Indicator · Theme Toggle ·
 * Clock · Weather · Quick Capture · Pomodoro · Habit Tracker ·
 * Expense Tracker · Daily Brief · Joey Memory Editor ·
 * Skeleton Loaders · Smooth Transitions · Joey Typing Indicator
 * ==================================================================== */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function safeJson(s, fb) { try { return s ? JSON.parse(s) : fb; } catch (_) { return fb; } }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function pad(n) { return String(n).padStart(2,'0'); }

  // ── CSS ─────────────────────────────────────────────────────────────
  var CSS = `
    /* TOASTS */
    #homer-toasts{position:fixed;bottom:80px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:340px}
    .homer-toast{background:#1e293b;border:1px solid rgba(255,255,255,.14);color:#e5e7eb;padding:12px 16px;border-radius:12px;font-size:.88rem;font-weight:600;line-height:1.4;display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(0,0,0,.4);pointer-events:all;cursor:pointer;animation:toast-in .25s cubic-bezier(.34,1.56,.64,1);transition:opacity .3s,transform .3s}
    .homer-toast.removing{opacity:0;transform:translateX(20px)}
    .homer-toast.success{border-left:3px solid #34d399}
    .homer-toast.error{border-left:3px solid #f87171}
    .homer-toast.info{border-left:3px solid #60a5fa}
    .homer-toast.warn{border-left:3px solid #fbbf24}
    @keyframes toast-in{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}

    /* OFFLINE */
    #homer-offline-banner{position:fixed;top:0;left:0;right:0;z-index:99998;background:#ef4444;color:#fff;text-align:center;padding:8px 16px;font-size:.85rem;font-weight:700;transform:translateY(-100%);transition:transform .3s}
    #homer-offline-banner.visible{transform:translateY(0)}

    /* THEME TOGGLE */
    #homer-theme-btn{position:fixed;bottom:20px;left:20px;z-index:9990;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:background .2s,transform .2s}
    #homer-theme-btn:hover{background:rgba(255,255,255,.15);transform:scale(1.1)}
    body.theme-light{--bg:#f1f5f9;--text:#0f172a;--muted:#64748b;--card-a:rgba(0,0,0,.04);--card-b:rgba(0,0,0,.02);--accent:#3b82f6;background:#f1f5f9;color:#0f172a}
    body.theme-light #homer-theme-btn{background:rgba(0,0,0,.07);border-color:rgba(0,0,0,.12)}
    body.theme-light .homer-toast{background:#fff;border-color:rgba(0,0,0,.12);color:#0f172a;box-shadow:0 4px 20px rgba(0,0,0,.15)}

    /* CLOCK */
    #homer-clock-widget{position:fixed;top:16px;right:16px;z-index:9980;background:rgba(15,23,42,.85);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:10px 16px;min-width:160px;text-align:right;font-family:'SF Mono','Fira Code',monospace;color:#e5e7eb;cursor:pointer;transition:opacity .2s;user-select:none}
    #homer-clock-widget:hover{opacity:.75}
    #homer-clock-time{font-size:1.4rem;font-weight:700;letter-spacing:1px;line-height:1}
    #homer-clock-date{font-size:.7rem;color:#94a3b8;margin-top:2px}
    #homer-clock-tz{font-size:.65rem;color:#60a5fa;margin-top:1px}
    .homer-clock-alt{font-size:.7rem;color:#94a3b8;margin-top:4px;border-top:1px solid rgba(255,255,255,.08);padding-top:4px;display:none}
    #homer-clock-widget.expanded .homer-clock-alt{display:block}

    /* WEATHER */
    #homer-weather-widget{position:fixed;top:16px;right:196px;z-index:9980;background:rgba(15,23,42,.85);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:10px 14px;min-width:110px;text-align:right;color:#e5e7eb;cursor:pointer;transition:opacity .2s}
    #homer-weather-widget:hover{opacity:.75}
    #homer-weather-icon{font-size:1.4rem;line-height:1}
    #homer-weather-temp{font-size:1rem;font-weight:700;margin-top:2px}
    #homer-weather-desc{font-size:.65rem;color:#94a3b8;margin-top:1px}
    #homer-weather-loc{font-size:.6rem;color:#60a5fa}

    /* QUICK CAPTURE */
    #homer-capture-btn{position:fixed;bottom:20px;left:68px;z-index:9990;width:38px;height:38px;border-radius:50%;background:rgba(96,165,250,.15);border:1px solid rgba(96,165,250,.3);color:#60a5fa;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:900;transition:background .2s,transform .2s}
    #homer-capture-btn:hover{background:rgba(96,165,250,.25);transform:scale(1.1)}
    #homer-capture-modal{position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s}
    #homer-capture-modal.open{opacity:1;pointer-events:all}
    #homer-capture-inner{background:#0f172a;border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:24px;width:100%;max-width:480px;margin:16px;box-shadow:0 24px 64px rgba(0,0,0,.5);transform:translateY(20px);transition:transform .25s}
    #homer-capture-modal.open #homer-capture-inner{transform:translateY(0)}
    #homer-capture-title{font-size:1.1rem;font-weight:800;color:#e5e7eb;margin-bottom:14px}
    #homer-capture-text{width:100%;min-height:90px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e5e7eb;font-size:.92rem;font-family:inherit;resize:vertical;outline:none;transition:border-color .2s;box-sizing:border-box}
    #homer-capture-text:focus{border-color:#60a5fa}
    .homer-capture-tags{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap}
    .homer-capture-tag{padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700;cursor:pointer;border:1px solid transparent;transition:all .15s}
    .homer-capture-tag.thought{background:rgba(139,92,246,.15);border-color:rgba(139,92,246,.3);color:#a78bfa}
    .homer-capture-tag.task{background:rgba(52,211,153,.15);border-color:rgba(52,211,153,.3);color:#34d399}
    .homer-capture-tag.link{background:rgba(96,165,250,.15);border-color:rgba(96,165,250,.3);color:#60a5fa}
    .homer-capture-tag.expense{background:rgba(251,191,36,.15);border-color:rgba(251,191,36,.3);color:#fbbf24}
    .homer-capture-tag:not(.active){opacity:.45}
    .homer-capture-tag.active{opacity:1}
    #homer-capture-actions{display:flex;gap:10px;margin-top:14px;justify-content:flex-end}
    .homer-cap-btn-sec{padding:8px 18px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:none;color:#94a3b8;cursor:pointer;font-size:.85rem;font-weight:600}
    .homer-cap-btn-pri{padding:8px 20px;border-radius:10px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-size:.85rem;font-weight:700;transition:background .2s}
    .homer-cap-btn-pri:hover{background:#2563eb}
    #homer-inbox-panel{position:fixed;right:0;top:0;bottom:0;width:360px;background:#0b1220;border-left:1px solid rgba(255,255,255,.1);z-index:9970;transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;overflow:hidden}
    #homer-inbox-panel.open{transform:translateX(0)}
    .homer-inbox-header{padding:20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between}
    .homer-inbox-header h2{font-size:1rem;font-weight:800;color:#e5e7eb;margin:0}
    .homer-inbox-list{flex:1;overflow-y:auto;padding:12px}
    .homer-inbox-item{background:rgba(255,255,255,.04);border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,.08)}
    .homer-inbox-item-text{font-size:.85rem;color:#e5e7eb;margin-bottom:6px;white-space:pre-wrap;word-break:break-word}
    .homer-inbox-item-meta{display:flex;align-items:center;gap:8px;font-size:.72rem;color:#64748b}
    .homer-inbox-item-type{padding:2px 8px;border-radius:10px;font-weight:700;font-size:.68rem}
    .homer-inbox-item-del{margin-left:auto;background:none;border:none;color:#64748b;cursor:pointer;font-size:.8rem;padding:2px 6px;border-radius:6px;transition:color .15s}
    .homer-inbox-item-del:hover{color:#f87171}

    /* POMODORO */
    #homer-pomo-fab{position:fixed;bottom:20px;left:116px;z-index:9990;width:38px;height:38px;border-radius:50%;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#f87171;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:background .2s,transform .2s}
    #homer-pomo-fab:hover{background:rgba(239,68,68,.25);transform:scale(1.1)}
    #homer-pomo-fab.running{animation:pomo-pulse 1.5s ease-in-out infinite}
    @keyframes pomo-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
    #homer-pomodoro-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.95);width:340px;background:#0f172a;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:30px;z-index:99980;box-shadow:0 32px 80px rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:all .25s cubic-bezier(.34,1.56,.64,1)}
    #homer-pomodoro-panel.open{opacity:1;pointer-events:all;transform:translate(-50%,-50%) scale(1)}
    #homer-pomo-title{font-size:1rem;font-weight:800;color:#94a3b8;text-align:center;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px}
    #homer-pomo-ring{position:relative;width:180px;height:180px;margin:0 auto 20px}
    #homer-pomo-svg{transform:rotate(-90deg)}
    #homer-pomo-track{fill:none;stroke:rgba(255,255,255,.08);stroke-width:8}
    #homer-pomo-arc{fill:none;stroke:#ef4444;stroke-width:8;stroke-linecap:round;transition:stroke-dashoffset .5s linear,stroke .5s}
    #homer-pomo-arc.brk{stroke:#34d399}
    #homer-pomo-time{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
    #homer-pomo-time-text{font-size:2.2rem;font-weight:900;color:#e5e7eb;letter-spacing:-1px;font-family:'SF Mono','Fira Code',monospace}
    #homer-pomo-mode-text{font-size:.72rem;color:#64748b;margin-top:2px}
    .homer-pomo-controls{display:flex;gap:10px;justify-content:center;margin-bottom:18px}
    .homer-pomo-btn{padding:10px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e5e7eb;font-size:.85rem;font-weight:700;cursor:pointer;transition:background .15s}
    .homer-pomo-btn:hover{background:rgba(255,255,255,.12)}
    .homer-pomo-btn.primary{background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.4);color:#fca5a5}
    .homer-pomo-btn.primary:hover{background:rgba(239,68,68,.3)}
    #homer-pomo-sessions{text-align:center;font-size:.75rem;color:#64748b;margin-bottom:14px}
    .homer-pomo-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.15);margin:0 2px;transition:background .3s}
    .homer-pomo-dot.done{background:#ef4444}
    #homer-pomo-task{width:100%;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#e5e7eb;font-size:.82rem;outline:none;font-family:inherit;box-sizing:border-box}

    /* HABITS */
    #homer-habits-fab{position:fixed;bottom:20px;left:164px;z-index:9990;width:38px;height:38px;border-radius:50%;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.3);color:#34d399;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:background .2s,transform .2s}
    #homer-habits-fab:hover{background:rgba(52,211,153,.25);transform:scale(1.1)}
    #homer-habits-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.95);width:540px;max-width:calc(100vw - 32px);max-height:80vh;background:#0f172a;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:28px;z-index:99980;box-shadow:0 32px 80px rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:all .25s cubic-bezier(.34,1.56,.64,1);overflow-y:auto}
    #homer-habits-panel.open{opacity:1;pointer-events:all;transform:translate(-50%,-50%) scale(1)}
    .homer-habits-title{font-size:1.1rem;font-weight:800;color:#e5e7eb;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between}
    .homer-habit-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
    .homer-habit-check{width:22px;height:22px;border-radius:6px;border:2px solid rgba(255,255,255,.2);background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.9rem;transition:all .2s;flex-shrink:0;color:#fff}
    .homer-habit-check.done{background:#34d399;border-color:#34d399}
    .homer-habit-name{flex:1;font-size:.88rem;color:#e5e7eb;font-weight:600}
    .homer-habit-streak{font-size:.72rem;color:#fbbf24;font-weight:700;white-space:nowrap}
    .homer-habit-heatmap{display:flex;gap:2px;flex-wrap:wrap;max-width:120px}
    .homer-habit-day{width:10px;height:10px;border-radius:2px;background:rgba(255,255,255,.06);flex-shrink:0}
    .homer-habit-day.done{background:#34d399}
    .homer-habit-day.today{outline:1px solid #60a5fa}
    .homer-habits-add{display:flex;gap:8px;margin-top:14px}
    .homer-habits-add input{flex:1;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#e5e7eb;font-size:.85rem;outline:none;font-family:inherit}
    .homer-habits-add button{padding:8px 16px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer}

    /* EXPENSE TRACKER */
    #homer-expense-fab{position:fixed;bottom:20px;left:212px;z-index:9990;width:38px;height:38px;border-radius:50%;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.3);color:#fbbf24;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:background .2s,transform .2s}
    #homer-expense-fab:hover{background:rgba(251,191,36,.25);transform:scale(1.1)}
    #homer-expense-panel{position:fixed;right:0;top:0;bottom:0;width:400px;max-width:100vw;background:#0b1220;border-left:1px solid rgba(255,255,255,.1);z-index:9970;transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;overflow:hidden}
    #homer-expense-panel.open{transform:translateX(0)}
    .homer-exp-header{padding:20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between}
    .homer-exp-header h2{font-size:1rem;font-weight:800;color:#e5e7eb;margin:0}
    .homer-exp-summary{padding:16px 20px;background:rgba(96,165,250,.07);border-bottom:1px solid rgba(255,255,255,.06)}
    .homer-exp-total{font-size:1.6rem;font-weight:900;color:#e5e7eb}
    .homer-exp-month{font-size:.72rem;color:#64748b;margin-top:2px}
    .homer-exp-cats{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
    .homer-exp-cat{font-size:.72rem;padding:3px 10px;border-radius:20px;font-weight:700}
    .homer-exp-add{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
    .homer-exp-add-row{display:flex;gap:6px;align-items:center;margin-bottom:4px}
    .homer-exp-input{flex:1;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#e5e7eb;font-size:.85rem;outline:none;font-family:inherit}
    .homer-exp-amount{width:90px;flex:0}
    .homer-exp-cat-sel{padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#0b1220;color:#e5e7eb;font-size:.82rem}
    .homer-exp-add-btn{padding:8px 14px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;white-space:nowrap}
    .homer-exp-list{flex:1;overflow-y:auto;padding:10px}
    .homer-exp-item{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
    .homer-exp-item-desc{flex:1;font-size:.85rem;color:#e5e7eb;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .homer-exp-item-cat{font-size:.7rem;padding:2px 8px;border-radius:10px;font-weight:700;flex-shrink:0}
    .homer-exp-item-amount{font-size:.9rem;font-weight:800;color:#e5e7eb;white-space:nowrap}
    .homer-exp-item-del{background:none;border:none;color:#64748b;cursor:pointer;font-size:.8rem;padding:2px;transition:color .15s;flex-shrink:0}
    .homer-exp-item-del:hover{color:#f87171}
    .homer-exp-item-date{font-size:.68rem;color:#64748b;white-space:nowrap}
    .cat-food{background:rgba(251,113,133,.15);color:#fb7185}
    .cat-transport{background:rgba(251,191,36,.15);color:#fbbf24}
    .cat-work{background:rgba(96,165,250,.15);color:#60a5fa}
    .cat-health{background:rgba(52,211,153,.15);color:#34d399}
    .cat-entertainment{background:rgba(167,139,250,.15);color:#a78bfa}
    .cat-other{background:rgba(148,163,184,.15);color:#94a3b8}

    /* DAILY BRIEF */
    #homer-brief-fab{position:fixed;bottom:20px;left:260px;z-index:9990;width:38px;height:38px;border-radius:50%;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3);color:#a78bfa;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:background .2s,transform .2s}
    #homer-brief-fab:hover{background:rgba(139,92,246,.25);transform:scale(1.1)}
    #homer-brief-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.95);width:560px;max-width:calc(100vw - 32px);max-height:85vh;background:#0f172a;border:1px solid rgba(255,255,255,.14);border-radius:24px;z-index:99980;box-shadow:0 32px 80px rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:all .25s cubic-bezier(.34,1.56,.64,1);overflow:hidden;display:flex;flex-direction:column}
    #homer-brief-panel.open{opacity:1;pointer-events:all;transform:translate(-50%,-50%) scale(1)}
    .homer-brief-hdr{padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
    .homer-brief-hdr h2{font-size:1.1rem;font-weight:800;color:#e5e7eb;margin:0}
    #homer-brief-body{flex:1;overflow-y:auto;padding:20px 24px;font-size:.9rem;color:#cbd5e1;line-height:1.7}
    #homer-brief-body h3{font-size:.78rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:16px 0 6px}
    #homer-brief-body h3:first-child{margin-top:0}
    .homer-brief-item{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;font-size:.87rem}
    .homer-brief-dot{width:6px;height:6px;border-radius:50%;background:#3b82f6;margin-top:7px;flex-shrink:0}

    /* MEMORY EDITOR */
    #homer-memory-fab{position:fixed;bottom:20px;left:308px;z-index:9990;width:38px;height:38px;border-radius:50%;background:rgba(251,113,133,.15);border:1px solid rgba(251,113,133,.3);color:#fb7185;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:background .2s,transform .2s}
    #homer-memory-fab:hover{background:rgba(251,113,133,.25);transform:scale(1.1)}
    #homer-memory-panel{position:fixed;right:0;top:0;bottom:0;width:420px;max-width:100vw;background:#0b1220;border-left:1px solid rgba(255,255,255,.1);z-index:9972;transform:translateX(100%);transition:transform .3s;display:flex;flex-direction:column}
    #homer-memory-panel.open{transform:translateX(0)}
    .homer-mem-header{padding:20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between}
    .homer-mem-header h2{font-size:1rem;font-weight:800;color:#e5e7eb;margin:0}
    .homer-mem-search{padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
    .homer-mem-search input{width:100%;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#e5e7eb;font-size:.85rem;outline:none;font-family:inherit;box-sizing:border-box}
    .homer-mem-list{flex:1;overflow-y:auto;padding:10px}
    .homer-mem-item{border-radius:12px;padding:12px;margin-bottom:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
    .homer-mem-text{font-size:.84rem;color:#e5e7eb;line-height:1.5;word-break:break-word}
    .homer-mem-text[contenteditable="true"]{outline:1px solid #3b82f6;border-radius:6px;padding:4px;background:rgba(59,130,246,.08)}
    .homer-mem-meta{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:.72rem;color:#64748b}
    .homer-mem-edit{background:none;border:none;color:#60a5fa;cursor:pointer;font-size:.72rem;font-weight:700;padding:2px 6px;border-radius:6px}
    .homer-mem-edit:hover{background:rgba(96,165,250,.12)}
    .homer-mem-del{background:none;border:none;color:#64748b;cursor:pointer;font-size:.72rem;padding:2px 6px;border-radius:6px;transition:color .15s}
    .homer-mem-del:hover{color:#f87171}
    .homer-mem-save{background:none;border:1px solid rgba(52,211,153,.3);color:#34d399;cursor:pointer;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:6px;display:none}

    /* JOEY TYPING */
    .homer-typing-indicator{display:inline-flex;gap:4px;align-items:center;padding:6px 10px}
    .homer-typing-dot{width:7px;height:7px;border-radius:50%;background:#60a5fa;animation:typing-bounce .9s infinite}
    .homer-typing-dot:nth-child(2){animation-delay:.15s}
    .homer-typing-dot:nth-child(3){animation-delay:.3s}
    @keyframes typing-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}

    /* SKELETON */
    .homer-skeleton{background:linear-gradient(90deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,.12) 50%,rgba(255,255,255,.06) 100%);background-size:200% 100%;animation:skel-shimmer 1.5s infinite;border-radius:6px}
    @keyframes skel-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .homer-skeleton-text{height:14px;margin:4px 0}
    .homer-skeleton-title{height:20px;width:60%;margin-bottom:10px}
    .homer-skeleton-card{height:80px;border-radius:12px;margin-bottom:10px}

    /* SMOOTH TRANSITIONS */
    .homer-fade-in{animation:homer-fade-in .25s ease}
    @keyframes homer-fade-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

    /* ERROR BOUNDARY */
    #homer-error-boundary{position:fixed;inset:0;z-index:999999;background:#0f172a;display:none;align-items:center;justify-content:center}
    #homer-error-boundary.visible{display:flex}
    .homer-error-box{max-width:400px;text-align:center;padding:40px 32px}
    .homer-error-icon{font-size:3rem;margin-bottom:16px}
    .homer-error-title{font-size:1.3rem;font-weight:800;color:#e5e7eb;margin-bottom:8px}
    .homer-error-msg{font-size:.88rem;color:#94a3b8;margin-bottom:24px;line-height:1.6}
    .homer-error-reload{padding:10px 24px;border-radius:12px;border:none;background:#3b82f6;color:#fff;font-size:.9rem;font-weight:700;cursor:pointer}

    /* SHARED CLOSE BTN */
    .homer-panel-close{background:none;border:none;color:#64748b;cursor:pointer;font-size:1.1rem;padding:4px;border-radius:6px;transition:color .15s;line-height:1}
    .homer-panel-close:hover{color:#e5e7eb}

    /* SHARED OVERLAY */
    .homer-overlay{position:fixed;inset:0;z-index:9960;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s}
    .homer-overlay.open{opacity:1;pointer-events:all}

    /* MOBILE */
    @media(max-width:600px){
      #homer-clock-widget{top:8px;right:8px;padding:6px 10px;min-width:120px}
      #homer-weather-widget{display:none}
      #homer-expense-panel,#homer-memory-panel,#homer-inbox-panel{width:100vw}
      #homer-habits-panel,#homer-brief-panel,#homer-pomodoro-panel{width:calc(100vw - 32px)}
    }
  `;
  var styleEl = document.createElement('style');
  styleEl.id = 'homer-features-css';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // ── Toast System ─────────────────────────────────────────────────────
  var toastContainer;
  function initToasts() {
    toastContainer = document.createElement('div');
    toastContainer.id = 'homer-toasts';
    document.body.appendChild(toastContainer);
  }
  window._homerToast = function(opts) {
    if (!toastContainer) return;
    var msg = typeof opts === 'string' ? opts : (opts.message || '');
    var type = typeof opts === 'string' ? 'info' : (opts.type || 'info');
    var duration = typeof opts === 'object' && opts.duration ? opts.duration : 3500;
    var icons = { success: '✓', error: '✗', info: 'ℹ', warn: '⚠' };
    var el = document.createElement('div');
    el.className = 'homer-toast ' + type;
    el.innerHTML = '<span>' + (icons[type] || 'ℹ') + '</span><span>' + esc(msg) + '</span>';
    el.addEventListener('click', function() { removeToast(el); });
    toastContainer.appendChild(el);
    setTimeout(function() { removeToast(el); }, duration);
    while (toastContainer.children.length > 5) removeToast(toastContainer.firstChild);
  };
  function removeToast(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('removing');
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }

  // ── Error Boundary ───────────────────────────────────────────────────
  function initErrorBoundary() {
    var b = document.createElement('div');
    b.id = 'homer-error-boundary';
    b.innerHTML = '<div class="homer-error-box">' +
      '<div class="homer-error-icon">⚡</div>' +
      '<div class="homer-error-title">Something went wrong</div>' +
      '<div class="homer-error-msg">An unexpected error occurred. Your data is safe.</div>' +
      '<button class="homer-error-reload" onclick="location.reload()">Reload Page</button>' +
      '</div>';
    document.body.appendChild(b);
    window.addEventListener('unhandledrejection', function(e) {
      var msg = e.reason && e.reason.message ? e.reason.message : String(e.reason || '');
      if (msg && (msg.includes('Cannot read properties') || msg.includes('is not a function'))) {
        window._homerToast({ message: 'JS error: ' + msg.slice(0, 80), type: 'error', duration: 7000 });
      }
    });
  }

  // ── Offline Indicator ────────────────────────────────────────────────
  function initOfflineIndicator() {
    var banner = document.createElement('div');
    banner.id = 'homer-offline-banner';
    banner.textContent = '⚡ You\'re offline — changes will sync when reconnected';
    document.body.appendChild(banner);
    function update() {
      if (navigator.onLine) {
        if (banner.classList.contains('visible')) {
          banner.classList.remove('visible');
          window._homerToast({ message: 'Back online', type: 'success', duration: 2000 });
        }
      } else {
        banner.classList.add('visible');
        window._homerToast({ message: 'You\'re offline', type: 'warn', duration: 5000 });
      }
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if (!navigator.onLine) banner.classList.add('visible');
  }

  // ── Theme Toggle ─────────────────────────────────────────────────────
  function initThemeToggle() {
    var THEME_KEY = 'homer-theme';
    var btn = document.createElement('button');
    btn.id = 'homer-theme-btn';
    document.body.appendChild(btn);
    var themes = ['auto', 'dark', 'light'];
    var icons = { auto: '⚙', dark: '🌙', light: '☀' };
    var current = localStorage.getItem(THEME_KEY) || 'auto';
    function apply(t) {
      current = t;
      localStorage.setItem(THEME_KEY, t);
      document.body.classList.remove('theme-light', 'theme-dark');
      if (t === 'light') document.body.classList.add('theme-light');
      else if (t === 'auto') {
        if (!window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('theme-light');
      }
      btn.textContent = icons[t];
      btn.title = 'Theme: ' + t + ' (click to cycle)';
    }
    btn.addEventListener('click', function() {
      var idx = (themes.indexOf(current) + 1) % themes.length;
      apply(themes[idx]);
      window._homerToast({ message: 'Theme: ' + themes[idx], type: 'info', duration: 1500 });
    });
    apply(current);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      if (current === 'auto') apply('auto');
    });
  }

  // ── Clock ────────────────────────────────────────────────────────────
  function initClock() {
    var w = document.createElement('div');
    w.id = 'homer-clock-widget';
    w.innerHTML =
      '<div id="homer-clock-time">--:--:--</div>' +
      '<div id="homer-clock-date"></div>' +
      '<div id="homer-clock-tz">Bucharest (EET)</div>' +
      '<div class="homer-clock-alt" id="homer-clock-utc"></div>' +
      '<div class="homer-clock-alt" id="homer-clock-nyc"></div>';
    document.body.appendChild(w);
    w.addEventListener('click', function() { w.classList.toggle('expanded'); });
    function fmt(date, tz) {
      try { return date.toLocaleTimeString('en-GB', { timeZone: tz, hour12: false }); }
      catch (_) { return '--:--:--'; }
    }
    function fmtDate(date, tz) {
      try { return date.toLocaleDateString('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }); }
      catch (_) { return ''; }
    }
    function tick() {
      var now = new Date();
      var elTime = document.getElementById('homer-clock-time');
      if(!elTime) return;
      elTime.textContent = fmt(now, 'Europe/Bucharest');
      var elDate = document.getElementById('homer-clock-date');
      if(elDate) elDate.textContent = fmtDate(now, 'Europe/Bucharest');
      var elUtc = document.getElementById('homer-clock-utc');
      if(elUtc) elUtc.textContent = 'UTC  ' + fmt(now, 'UTC');
      var elNyc = document.getElementById('homer-clock-nyc');
      if(elNyc) elNyc.textContent = 'NYC  ' + fmt(now, 'America/New_York');
    }
    tick();
    setInterval(tick, 1000);
  }

  // ── Weather ──────────────────────────────────────────────────────────
  function initWeather() {
    var w = document.createElement('div');
    w.id = 'homer-weather-widget';
    w.innerHTML =
      '<div id="homer-weather-icon" class="homer-skeleton" style="height:24px;width:28px;border-radius:4px;display:inline-block"></div>' +
      '<div id="homer-weather-temp" class="homer-skeleton homer-skeleton-text" style="width:55px;margin:4px 0 2px auto"></div>' +
      '<div id="homer-weather-desc" class="homer-skeleton homer-skeleton-text" style="width:80px;margin-left:auto"></div>' +
      '<div id="homer-weather-loc">Bucharest</div>';
    document.body.appendChild(w);
    var WMO = {
      0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',
      51:'🌦',53:'🌦',55:'🌧',61:'🌧',63:'🌧',65:'🌧',
      71:'🌨',73:'🌨',75:'❄️',80:'🌦',81:'🌧',82:'⛈',
      95:'⛈',96:'⛈',99:'⛈'
    };
    var WDESC = {
      0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
      45:'Fog',48:'Foggy',51:'Drizzle',53:'Drizzle',55:'Heavy drizzle',
      61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
      80:'Showers',81:'Heavy showers',82:'Showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'
    };
    var CACHE_KEY = 'homer-weather-cache';
    var CACHE_TTL = 30 * 60 * 1000;
    function fetchWeather() {
      var cached = safeJson(localStorage.getItem(CACHE_KEY), null);
      if (cached && (Date.now() - cached.ts) < CACHE_TTL) { render(cached.data); return; }
      fetch('https://api.open-meteo.com/v1/forecast?latitude=44.4268&longitude=26.1025&current=temperature_2m,weathercode&timezone=Europe%2FBucharest')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var data = { temp: Math.round(d.current.temperature_2m), code: d.current.weathercode };
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
          render(data);
        })
        .catch(function() {
          var icon = document.getElementById('homer-weather-icon');
          var temp = document.getElementById('homer-weather-temp');
          var desc = document.getElementById('homer-weather-desc');
          if(icon) icon.textContent = '?';
          if(temp) temp.textContent = '--°C';
          if(desc) desc.textContent = 'N/A';
        });
    }
    function render(data) {
      var icon = document.getElementById('homer-weather-icon');
      var temp = document.getElementById('homer-weather-temp');
      var desc = document.getElementById('homer-weather-desc');
      if(!icon || !temp || !desc) return;
      icon.className = ''; icon.textContent = WMO[data.code] || '🌡';
      temp.className = ''; temp.textContent = data.temp + '°C';
      desc.className = ''; desc.textContent = WDESC[data.code] || 'Unknown';
    }
    fetchWeather();
    setInterval(fetchWeather, CACHE_TTL);
  }

  // ── Quick Capture ────────────────────────────────────────────────────
  function initQuickCapture() {
    var INBOX_KEY = 'homer-inbox';
    var captureBtn = document.createElement('button');
    captureBtn.id = 'homer-capture-btn';
    captureBtn.title = 'Quick capture (Alt+C)';
    captureBtn.textContent = '+';
    document.body.appendChild(captureBtn);

    var modal = document.createElement('div');
    modal.id = 'homer-capture-modal';
    modal.innerHTML =
      '<div id="homer-capture-inner">' +
        '<div id="homer-capture-title">📥 Quick Capture</div>' +
        '<textarea id="homer-capture-text" placeholder="Thought, task, link, or expense… (Ctrl+Enter to save)"></textarea>' +
        '<div class="homer-capture-tags">' +
          '<span class="homer-capture-tag thought active" data-type="thought">💭 Thought</span>' +
          '<span class="homer-capture-tag task" data-type="task">✅ Task</span>' +
          '<span class="homer-capture-tag link" data-type="link">🔗 Link</span>' +
          '<span class="homer-capture-tag expense" data-type="expense">💰 Expense</span>' +
        '</div>' +
        '<div id="homer-capture-actions">' +
          '<button class="homer-cap-btn-sec" id="homer-capture-view">View inbox</button>' +
          '<button class="homer-cap-btn-sec" id="homer-capture-cancel">Cancel</button>' +
          '<button class="homer-cap-btn-pri" id="homer-capture-save">Save</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    var inboxPanel = document.createElement('div');
    inboxPanel.id = 'homer-inbox-panel';
    inboxPanel.innerHTML =
      '<div class="homer-inbox-header"><h2>📥 Inbox</h2>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<button id="homer-inbox-sync" title="Sync inbox across devices" style="background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.25);color:#60a5fa;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:.75rem;font-weight:700;transition:all .15s;white-space:nowrap">⟳ Sync</button>' +
          '<button class="homer-panel-close" id="homer-inbox-close">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="homer-inbox-list" id="homer-inbox-list"></div>';
    document.body.appendChild(inboxPanel);

    var ov = document.createElement('div');
    ov.className = 'homer-overlay'; ov.id = 'homer-inbox-overlay';
    document.body.appendChild(ov);

    var activeType = 'thought';
    modal.querySelectorAll('.homer-capture-tag').forEach(function(tag) {
      tag.addEventListener('click', function() {
        modal.querySelectorAll('.homer-capture-tag').forEach(function(t) { t.classList.remove('active'); });
        tag.classList.add('active');
        activeType = tag.dataset.type;
      });
    });

    function openCapture() {
      modal.classList.add('open');
      setTimeout(function() { document.getElementById('homer-capture-text').focus(); }, 50);
    }
    function closeCapture() {
      modal.classList.remove('open');
      document.getElementById('homer-capture-text').value = '';
    }
    function openInbox() {
      inboxPanel.classList.add('open'); ov.classList.add('open'); renderInbox();
      if (typeof window._homerSyncInbox === 'function') window._homerSyncInbox();
    }
    function closeInbox() { inboxPanel.classList.remove('open'); ov.classList.remove('open'); }

    captureBtn.addEventListener('click', openCapture);
    document.getElementById('homer-capture-cancel').addEventListener('click', closeCapture);
    document.getElementById('homer-capture-view').addEventListener('click', function() { closeCapture(); openInbox(); });
    document.getElementById('homer-inbox-close').addEventListener('click', closeInbox);
    document.getElementById('homer-inbox-sync').addEventListener('click', function() {
      var btn = this;
      btn.textContent = '⟳ …';
      btn.style.opacity = '.6';
      btn.disabled = true;
      if (typeof window._homerSyncInbox === 'function') window._homerSyncInbox();
      setTimeout(function() { btn.textContent = '⟳ Sync'; btn.style.opacity = ''; btn.disabled = false; }, 2000);
    });
    ov.addEventListener('click', closeInbox);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeCapture(); });
    document.getElementById('homer-capture-save').addEventListener('click', saveCapture);
    document.getElementById('homer-capture-text').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.ctrlKey) saveCapture();
      if (e.key === 'Escape') closeCapture();
    });
    document.addEventListener('keydown', function(e) {
      if (e.altKey && e.key === 'c') { e.preventDefault(); openCapture(); }
    });

    function saveCapture() {
      var text = document.getElementById('homer-capture-text').value.trim();
      if (!text) return;
      var inbox = safeJson(localStorage.getItem(INBOX_KEY), []);
      inbox.unshift({ id: Date.now(), text: text, type: activeType, ts: new Date().toISOString() });
      localStorage.setItem(INBOX_KEY, JSON.stringify(inbox.slice(0, 200)));
      closeCapture();
      window._homerToast({ message: 'Captured!', type: 'success', duration: 1500 });
      if (typeof window._homerSyncInbox === 'function') setTimeout(window._homerSyncInbox, 300);
      if (activeType === 'expense') setTimeout(function() { if (window._homerOpenExpenses) window._homerOpenExpenses(text); }, 300);
    }

    function renderInbox() {
      var inbox = safeJson(localStorage.getItem(INBOX_KEY), []);
      var list = document.getElementById('homer-inbox-list');
      if (!inbox.length) { list.innerHTML = '<div style="text-align:center;color:#64748b;padding:40px;font-size:.85rem">Inbox is empty</div>'; return; }
      var colors = { thought: '#a78bfa', task: '#34d399', link: '#60a5fa', expense: '#fbbf24' };
      list.innerHTML = inbox.map(function(item) {
        var c = colors[item.type] || '#94a3b8';
        var dt = new Date(item.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return '<div class="homer-inbox-item homer-fade-in" data-id="' + item.id + '">' +
          '<div class="homer-inbox-item-text">' + esc(item.text) + '</div>' +
          '<div class="homer-inbox-item-meta">' +
            '<span class="homer-inbox-item-type" style="background:' + c + '22;color:' + c + '">' + item.type + '</span>' +
            '<span>' + dt + '</span>' +
            '<button class="homer-inbox-item-del">✕</button>' +
          '</div></div>';
      }).join('');
      list.querySelectorAll('.homer-inbox-item-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = parseInt(btn.closest('[data-id]').dataset.id);
          localStorage.setItem(INBOX_KEY, JSON.stringify(safeJson(localStorage.getItem(INBOX_KEY), []).filter(function(x) { return x.id !== id; })));
          renderInbox();
        });
      });
    }
    window._homerOpenInbox = openInbox;

    // Re-render whenever a sync pulls new inbox data from the cloud
    window.addEventListener('homer-inbox-changed', function() {
      if (inboxPanel.classList.contains('open')) renderInbox();
    });
  }

  // ── Joey Typing Indicator ────────────────────────────────────────────
  function initJoeyTyping() {
    var ind = document.createElement('div');
    ind.id = 'homer-joey-typing';
    ind.className = 'homer-typing-indicator';
    ind.innerHTML = '<div class="homer-typing-dot"></div><div class="homer-typing-dot"></div><div class="homer-typing-dot"></div>';
    ind.style.display = 'none';
    document.body.appendChild(ind);
    // Try to move near Joey messages once the panel is rendered
    function attach() {
      var target = document.getElementById('joey-msgs') || document.getElementById('oc-msgs') || document.querySelector('[id$="-msgs"]');
      if (target) { target.appendChild(ind); return true; }
      return false;
    }
    if (!attach()) setTimeout(attach, 2000);
    window.addEventListener('joey-streaming-start', function() {
      ind.style.display = 'inline-flex';
      var sb = document.getElementById('oc-send') || document.getElementById('joey-send');
      if (sb) sb.style.opacity = '.4';
    });
    window.addEventListener('joey-streaming-end', function() {
      ind.style.display = 'none';
      var sb = document.getElementById('oc-send') || document.getElementById('joey-send');
      if (sb) sb.style.opacity = '1';
    });
    window._homerSetJoeyTyping = function(on) { ind.style.display = on ? 'inline-flex' : 'none'; };
  }

  // ── Pomodoro ─────────────────────────────────────────────────────────
  function initPomodoro() {
    var SESSIONS_KEY = 'homer-pomodoro';
    var WORK = 25 * 60, SHORT_BREAK = 5 * 60, LONG_BREAK = 15 * 60;
    var CIRC = 2 * Math.PI * 80;

    var fab = document.createElement('button');
    fab.id = 'homer-pomo-fab'; fab.title = 'Pomodoro Timer'; fab.textContent = '🍅';
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.id = 'homer-pomodoro-panel';
    panel.innerHTML =
      '<button id="homer-pomo-close" class="homer-panel-close" style="position:absolute;top:12px;right:12px">✕</button>' +
      '<div id="homer-pomo-title">FOCUS</div>' +
      '<div id="homer-pomo-ring">' +
        '<svg id="homer-pomo-svg" viewBox="0 0 180 180" width="180" height="180">' +
          '<circle id="homer-pomo-track" cx="90" cy="90" r="80"/>' +
          '<circle id="homer-pomo-arc" cx="90" cy="90" r="80"/>' +
        '</svg>' +
        '<div id="homer-pomo-time"><div id="homer-pomo-time-text">25:00</div><div id="homer-pomo-mode-text">Work session</div></div>' +
      '</div>' +
      '<div id="homer-pomo-sessions"></div>' +
      '<div class="homer-pomo-controls">' +
        '<button class="homer-pomo-btn primary" id="homer-pomo-start">▶ Start</button>' +
        '<button class="homer-pomo-btn" id="homer-pomo-reset">↺</button>' +
        '<button class="homer-pomo-btn" id="homer-pomo-skip">⏭</button>' +
      '</div>' +
      '<input id="homer-pomo-task" placeholder="What are you working on?" />';
    document.body.appendChild(panel);

    var arc = document.getElementById('homer-pomo-arc');
    arc.style.strokeDasharray = CIRC;
    arc.style.strokeDashoffset = 0;

    var data = safeJson(localStorage.getItem(SESSIONS_KEY), { sessions: [], cycleCount: 0 });
    var timer = null, running = false, isBreak = false, remaining = WORK, total = WORK;
    // Wall-clock anchors — the only source of truth for elapsed time.
    // setInterval alone drifts and catches up chaotically when the tab is hidden.
    var startedAt = 0, remainingAtStart = WORK;

    function fmtTime(s) { return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
    function save() { localStorage.setItem(SESSIONS_KEY, JSON.stringify(data)); }
    function updateDisplay() {
      document.getElementById('homer-pomo-time-text').textContent = fmtTime(remaining);
      document.getElementById('homer-pomo-title').textContent = isBreak ? 'BREAK' : 'FOCUS';
      document.getElementById('homer-pomo-mode-text').textContent = isBreak ? 'Rest up!' : 'Deep work';
      arc.style.strokeDashoffset = CIRC * (1 - remaining / total);
      arc.setAttribute('class', isBreak ? 'brk' : '');
      var dots = '';
      for (var i = 0; i < 4; i++) dots += '<span class="homer-pomo-dot' + (i < (data.cycleCount % 4) ? ' done' : '') + '"></span>';
      document.getElementById('homer-pomo-sessions').innerHTML = 'Session ' + (data.cycleCount + 1) + ' &nbsp;' + dots;
      document.title = running ? fmtTime(remaining) + (isBreak ? ' 🍃' : ' 🍅') + ' · Homer' : 'Homer';
    }

    function onExpire() {
      clearInterval(timer); timer = null; running = false; fab.classList.remove('running');
      document.getElementById('homer-pomo-start').textContent = '▶ Start';
      if (!isBreak) {
        data.cycleCount++;
        data.sessions.push({ ts: new Date().toISOString(), task: document.getElementById('homer-pomo-task').value, duration: total });
        data.sessions = data.sessions.slice(-200);
        save();
        var longBreak = data.cycleCount % 4 === 0;
        isBreak = true; total = remaining = longBreak ? LONG_BREAK : SHORT_BREAK;
        remainingAtStart = remaining;
        window._homerToast({ message: longBreak ? '🎉 Long break! 15 min' : '✅ Break time! 5 min', type: 'success', duration: 6000 });
        try { if (Notification.permission === 'granted') new Notification('🍅 Pomodoro', { body: 'Time for a break!' }); } catch (_) {}
      } else {
        isBreak = false; total = remaining = WORK;
        remainingAtStart = remaining;
        window._homerToast({ message: '🍅 Back to work!', type: 'info', duration: 4000 });
      }
      updateDisplay();
    }

    // Fires at 250 ms so it never lags more than a quarter-second behind the
    // real clock. Elapsed is derived from Date.now(), not tick count, so
    // browser tab throttling cannot cause multi-second jumps.
    function tick() {
      var elapsed = Math.floor((Date.now() - startedAt) / 1000);
      var newRemaining = Math.max(0, remainingAtStart - elapsed);
      if (newRemaining === remaining && newRemaining > 0) return; // no visible change yet
      remaining = newRemaining;
      if (remaining > 0) { updateDisplay(); return; }
      onExpire();
    }

    document.getElementById('homer-pomo-start').addEventListener('click', function() {
      if (running) {
        // Snapshot the exact remaining seconds before stopping the interval
        remaining = Math.max(0, remainingAtStart - Math.floor((Date.now() - startedAt) / 1000));
        clearInterval(timer); timer = null; running = false; fab.classList.remove('running');
        this.textContent = '▶ Start'; this.classList.add('primary');
        updateDisplay();
      } else {
        startedAt = Date.now(); remainingAtStart = remaining;
        running = true; timer = setInterval(tick, 250); fab.classList.add('running');
        this.textContent = '⏸ Pause'; this.classList.remove('primary');
        try { if (Notification.permission !== 'denied') Notification.requestPermission(); } catch (_) {}
      }
    });
    document.getElementById('homer-pomo-reset').addEventListener('click', function() {
      clearInterval(timer); timer = null; running = false; fab.classList.remove('running');
      isBreak = false; total = remaining = WORK; startedAt = 0; remainingAtStart = WORK;
      document.getElementById('homer-pomo-start').textContent = '▶ Start';
      updateDisplay();
    });
    document.getElementById('homer-pomo-skip').addEventListener('click', function() {
      remaining = 0; remainingAtStart = 0; startedAt = 0;
      onExpire();
    });
    document.getElementById('homer-pomo-close').addEventListener('click', function() { panel.classList.remove('open'); });
    fab.addEventListener('click', function() { panel.classList.toggle('open'); });
    updateDisplay();
  }

  // ── Habit Tracker ────────────────────────────────────────────────────
  function initHabits() {
    var KEY = 'homer-habits';
    var fab = document.createElement('button');
    fab.id = 'homer-habits-fab'; fab.title = 'Habit Tracker'; fab.textContent = '✅';
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.id = 'homer-habits-panel';
    panel.innerHTML =
      '<div class="homer-habits-title">Habit Tracker<button class="homer-panel-close" id="homer-habits-close">✕</button></div>' +
      '<div id="homer-habits-list"></div>' +
      '<div class="homer-habits-add"><input id="homer-habits-new" placeholder="Add new habit…" /><button id="homer-habits-add-btn">Add</button></div>';
    document.body.appendChild(panel);

    var ov = document.createElement('div');
    ov.className = 'homer-overlay'; ov.id = 'homer-habits-ov';
    document.body.appendChild(ov);

    function get() { return safeJson(localStorage.getItem(KEY), { habits: [], completions: {} }); }
    function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
    function todayKey() { return new Date().toISOString().slice(0, 10); }
    function streak(habitId, completions) {
      var s = 0; var d = new Date();
      for (var i = 0; i < 365; i++) {
        if (completions[habitId + ':' + d.toISOString().slice(0, 10)]) s++;
        else if (i > 0) break;
        d.setDate(d.getDate() - 1);
      }
      return s;
    }

    function render() {
      var d = get(); var today = todayKey();
      var list = document.getElementById('homer-habits-list');
      if (!d.habits.length) { list.innerHTML = '<div style="text-align:center;color:#64748b;padding:20px;font-size:.85rem">No habits yet — add one below!</div>'; return; }
      list.innerHTML = d.habits.map(function(h) {
        var done = !!d.completions[h.id + ':' + today];
        var s = streak(h.id, d.completions);
        var heat = '';
        for (var i = 27; i >= 0; i--) {
          var dt = new Date(); dt.setDate(dt.getDate() - i);
          var dk = dt.toISOString().slice(0, 10);
          heat += '<span class="homer-habit-day' + (d.completions[h.id + ':' + dk] ? ' done' : '') + (i === 0 ? ' today' : '') + '" title="' + dk + '"></span>';
        }
        return '<div class="homer-habit-row" data-id="' + h.id + '">' +
          '<button class="homer-habit-check' + (done ? ' done' : '') + '">' + (done ? '✓' : '') + '</button>' +
          '<span class="homer-habit-name">' + esc(h.name) + '</span>' +
          '<span class="homer-habit-streak">' + (s ? '🔥' + s : '') + '</span>' +
          '<div class="homer-habit-heatmap">' + heat + '</div>' +
          '<button class="homer-habit-del homer-panel-close" title="Delete">✕</button>' +
          '</div>';
      }).join('');
      list.querySelectorAll('.homer-habit-check').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var d2 = get(); var id = parseInt(btn.closest('[data-id]').dataset.id);
          var ck = id + ':' + todayKey();
          if (d2.completions[ck]) delete d2.completions[ck];
          else { d2.completions[ck] = true; window._homerToast({ message: 'Habit done! 🎉', type: 'success', duration: 1500 }); }
          save(d2); render();
        });
      });
      list.querySelectorAll('.homer-habit-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = parseInt(btn.closest('[data-id]').dataset.id);
          var d2 = get(); d2.habits = d2.habits.filter(function(h) { return h.id !== id; });
          save(d2); render();
        });
      });
    }

    document.getElementById('homer-habits-add-btn').addEventListener('click', function() {
      var inp = document.getElementById('homer-habits-new');
      var name = inp.value.trim(); if (!name) return;
      var d = get(); d.habits.push({ id: Date.now(), name: name }); save(d); inp.value = ''; render();
    });
    document.getElementById('homer-habits-new').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('homer-habits-add-btn').click();
    });

    function open() { panel.classList.add('open'); ov.classList.add('open'); render(); }
    function close() { panel.classList.remove('open'); ov.classList.remove('open'); }
    document.getElementById('homer-habits-close').addEventListener('click', close);
    ov.addEventListener('click', close);
    fab.addEventListener('click', function() { panel.classList.contains('open') ? close() : open(); });
  }

  // ── Expense Tracker ──────────────────────────────────────────────────
  function initExpenses() {
    var KEY = 'homer-expenses';
    var CATS = ['food', 'transport', 'work', 'health', 'entertainment', 'other'];
    var EMOJI = { food: '🍔', transport: '🚗', work: '💼', health: '❤️', entertainment: '🎬', other: '📦' };

    var fab = document.createElement('button');
    fab.id = 'homer-expense-fab'; fab.title = 'Expense Tracker'; fab.textContent = '💰';
    document.body.appendChild(fab);

    var ov = document.createElement('div');
    ov.className = 'homer-overlay'; ov.id = 'homer-expense-ov';
    document.body.appendChild(ov);

    var panel = document.createElement('div');
    panel.id = 'homer-expense-panel';
    panel.innerHTML =
      '<div class="homer-exp-header"><h2>💰 Expenses</h2><button class="homer-panel-close" id="homer-exp-close">✕</button></div>' +
      '<div class="homer-exp-summary"><div class="homer-exp-total" id="homer-exp-total">0.00 RON</div><div class="homer-exp-month" id="homer-exp-month"></div><div class="homer-exp-cats" id="homer-exp-cats"></div></div>' +
      '<div class="homer-exp-add">' +
        '<div class="homer-exp-add-row"><input class="homer-exp-input" id="homer-exp-desc" placeholder="Description" /><input class="homer-exp-input homer-exp-amount" id="homer-exp-amount" type="number" placeholder="0.00" step="0.01" min="0" /></div>' +
        '<div class="homer-exp-add-row" style="margin-top:6px">' +
          '<select class="homer-exp-cat-sel" id="homer-exp-cat">' + CATS.map(function(c) { return '<option value="' + c + '">' + EMOJI[c] + ' ' + c + '</option>'; }).join('') + '</select>' +
          '<input class="homer-exp-input" id="homer-exp-date" type="date" style="flex:0;width:130px" />' +
          '<button class="homer-exp-add-btn" id="homer-exp-add-btn">Add</button>' +
        '</div>' +
      '</div>' +
      '<div class="homer-exp-list" id="homer-exp-list"></div>';
    document.body.appendChild(panel);
    document.getElementById('homer-exp-date').value = new Date().toISOString().slice(0, 10);

    function get() { return safeJson(localStorage.getItem(KEY), []); }
    function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

    function render() {
      var data = get(); var now = new Date(); var mo = now.toISOString().slice(0, 7);
      var mData = data.filter(function(e) { return (e.date || '').startsWith(mo); });
      var total = mData.reduce(function(s, e) { return s + (e.amount || 0); }, 0);
      document.getElementById('homer-exp-total').textContent = total.toFixed(2) + ' RON';
      document.getElementById('homer-exp-month').textContent = now.toLocaleString('en', { month: 'long', year: 'numeric' });
      var catT = {};
      mData.forEach(function(e) { catT[e.cat] = (catT[e.cat] || 0) + (e.amount || 0); });
      document.getElementById('homer-exp-cats').innerHTML = Object.keys(catT).map(function(c) {
        return '<span class="homer-exp-cat cat-' + c + '">' + EMOJI[c] + ' ' + catT[c].toFixed(0) + '</span>';
      }).join('');
      var sorted = data.slice().sort(function(a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; });
      var list = document.getElementById('homer-exp-list');
      list.innerHTML = sorted.slice(0, 100).map(function(e) {
        return '<div class="homer-exp-item" data-id="' + e.id + '">' +
          '<span class="homer-exp-item-cat cat-' + e.cat + '">' + EMOJI[e.cat] + '</span>' +
          '<span class="homer-exp-item-desc">' + esc(e.desc) + '</span>' +
          '<span class="homer-exp-item-date">' + (e.date || '') + '</span>' +
          '<span class="homer-exp-item-amount">' + (e.amount || 0).toFixed(2) + '</span>' +
          '<button class="homer-exp-item-del">✕</button></div>';
      }).join('');
      list.querySelectorAll('.homer-exp-item-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = parseInt(btn.closest('[data-id]').dataset.id);
          save(get().filter(function(e) { return e.id !== id; })); render();
        });
      });
    }

    document.getElementById('homer-exp-add-btn').addEventListener('click', function() {
      var desc = document.getElementById('homer-exp-desc').value.trim();
      var amount = parseFloat(document.getElementById('homer-exp-amount').value);
      if (!desc || isNaN(amount) || amount <= 0) { window._homerToast({ message: 'Enter description and amount', type: 'warn' }); return; }
      var data = get();
      data.push({ id: Date.now(), desc: desc, amount: amount, cat: document.getElementById('homer-exp-cat').value, date: document.getElementById('homer-exp-date').value });
      save(data); document.getElementById('homer-exp-desc').value = ''; document.getElementById('homer-exp-amount').value = '';
      render(); window._homerToast({ message: 'Expense added', type: 'success', duration: 1500 });
    });
    ['homer-exp-desc', 'homer-exp-amount'].forEach(function(id) {
      document.getElementById(id).addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('homer-exp-add-btn').click(); });
    });

    function open(prefill) { panel.classList.add('open'); ov.classList.add('open'); render(); if (prefill) document.getElementById('homer-exp-desc').value = prefill; }
    function close() { panel.classList.remove('open'); ov.classList.remove('open'); }
    document.getElementById('homer-exp-close').addEventListener('click', close);
    ov.addEventListener('click', close);
    fab.addEventListener('click', function() { panel.classList.contains('open') ? close() : open(); });
    window._homerOpenExpenses = open;
  }

  // ── Daily Brief ──────────────────────────────────────────────────────
  function initDailyBrief() {
    var SEEN_KEY = 'homer-brief-seen';
    var fab = document.createElement('button');
    fab.id = 'homer-brief-fab'; fab.title = 'Daily Brief'; fab.textContent = '📋';
    document.body.appendChild(fab);

    var ov = document.createElement('div');
    ov.className = 'homer-overlay'; ov.id = 'homer-brief-ov';
    document.body.appendChild(ov);

    var panel = document.createElement('div');
    panel.id = 'homer-brief-panel';
    panel.innerHTML =
      '<div class="homer-brief-hdr"><h2>📋 Daily Brief</h2><button class="homer-panel-close" id="homer-brief-close">✕</button></div>' +
      '<div id="homer-brief-body"></div>';
    document.body.appendChild(panel);

    function build() {
      var body = document.getElementById('homer-brief-body');
      var now = new Date();
      var h = now.getHours();
      var greeting = h < 12 ? '🌅 Good morning' : h < 17 ? '☀️ Good afternoon' : '🌙 Good evening';
      var dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
      var ds = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      var today = now.toISOString().slice(0, 10);
      var mo = now.toISOString().slice(0, 7);
      var html = '<p style="font-size:1.05rem;font-weight:700;color:#e5e7eb;margin-bottom:16px">' + greeting + ', Bogdan!<br><span style="font-size:.83rem;color:#94a3b8;font-weight:400">' + dow + ', ' + ds + '</span></p>';
      var WD = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',51:'Drizzle',61:'Light rain',63:'Rain',71:'Snow',80:'Showers',95:'Thunderstorm'};
      var wc = safeJson(localStorage.getItem('homer-weather-cache'), null);
      if (wc && wc.data) {
        html += '<h3>🌤 Weather</h3><div class="homer-brief-item"><div class="homer-brief-dot"></div><span>Bucharest — ' + wc.data.temp + '°C, ' + (WD[wc.data.code] || 'Unknown') + '</span></div>';
      }
      var habits = safeJson(localStorage.getItem('homer-habits'), { habits: [], completions: {} });
      if (habits.habits.length) {
        var pending = habits.habits.filter(function(h2) { return !habits.completions[h2.id + ':' + today]; });
        html += '<h3>✅ Habits (' + (habits.habits.length - pending.length) + '/' + habits.habits.length + ' done)</h3>';
        pending.slice(0, 5).forEach(function(h2) { html += '<div class="homer-brief-item"><div class="homer-brief-dot" style="background:#fbbf24"></div><span>' + esc(h2.name) + '</span></div>'; });
        if (!pending.length) html += '<div class="homer-brief-item"><div class="homer-brief-dot" style="background:#34d399"></div><span>All habits complete! 🎉</span></div>';
      }
      var inbox = safeJson(localStorage.getItem('homer-inbox'), []);
      if (inbox.length) {
        html += '<h3>📥 Inbox (' + inbox.length + ')</h3>';
        inbox.slice(0, 3).forEach(function(item) { html += '<div class="homer-brief-item"><div class="homer-brief-dot"></div><span>' + esc(item.text.slice(0, 90)) + (item.text.length > 90 ? '…' : '') + '</span></div>'; });
        if (inbox.length > 3) html += '<div style="font-size:.75rem;color:#64748b;margin-left:14px">+' + (inbox.length - 3) + ' more</div>';
      }
      var expenses = safeJson(localStorage.getItem('homer-expenses'), []);
      var moExp = expenses.filter(function(e) { return (e.date || '').startsWith(mo); });
      if (moExp.length) {
        var tot = moExp.reduce(function(s, e) { return s + (e.amount || 0); }, 0);
        html += '<h3>💰 Spending this month</h3><div class="homer-brief-item"><div class="homer-brief-dot" style="background:#fbbf24"></div><span><strong style="color:#e5e7eb">' + tot.toFixed(2) + ' RON</strong> · ' + moExp.length + ' transactions</span></div>';
      }
      var pomo = safeJson(localStorage.getItem('homer-pomodoro'), { sessions: [] });
      var todaySess = pomo.sessions.filter(function(s) { return s.ts && s.ts.startsWith(today); });
      if (todaySess.length) html += '<h3>🍅 Focus sessions</h3><div class="homer-brief-item"><div class="homer-brief-dot"></div><span>' + todaySess.length + ' sessions completed today</span></div>';
      html += '<div style="margin-top:20px;padding:14px;border-radius:12px;background:rgba(96,165,250,.07);border:1px solid rgba(96,165,250,.12);font-size:.82rem;color:#94a3b8;text-align:center">Say <em style="color:#60a5fa">"daily brief"</em> to Joey for an AI-powered summary</div>';
      body.innerHTML = html;
      body.classList.add('homer-fade-in');
    }

    function open() { panel.classList.add('open'); ov.classList.add('open'); build(); }
    function close() { panel.classList.remove('open'); ov.classList.remove('open'); }
    document.getElementById('homer-brief-close').addEventListener('click', close);
    ov.addEventListener('click', close);
    fab.addEventListener('click', function() { panel.classList.contains('open') ? close() : open(); });

    // Auto-show once in the morning
    var today2 = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(SEEN_KEY) !== today2 && new Date().getHours() >= 6 && new Date().getHours() <= 10) {
      setTimeout(function() { if (document.visibilityState !== 'hidden') { open(); localStorage.setItem(SEEN_KEY, today2); } }, 3500);
    }
  }

  // ── Joey Memory Editor ───────────────────────────────────────────────
  function initMemoryEditor() {
    var fab = document.createElement('button');
    fab.id = 'homer-memory-fab'; fab.title = 'Joey Memories'; fab.textContent = '🧠';
    document.body.appendChild(fab);

    var ov = document.createElement('div');
    ov.className = 'homer-overlay'; ov.id = 'homer-memory-ov';
    document.body.appendChild(ov);

    var panel = document.createElement('div');
    panel.id = 'homer-memory-panel';
    panel.innerHTML =
      '<div class="homer-mem-header"><h2>🧠 Joey Memories</h2><button class="homer-panel-close" id="homer-mem-close">✕</button></div>' +
      '<div class="homer-mem-search"><input id="homer-mem-search" placeholder="Search memories…" /></div>' +
      '<div class="homer-mem-list" id="homer-mem-list"><div style="text-align:center;color:#64748b;padding:40px;font-size:.85rem">Open to load memories</div></div>';
    document.body.appendChild(panel);

    var allMems = [];

    document.getElementById('homer-mem-search').addEventListener('input', function() {
      var q = this.value.toLowerCase();
      renderMems(q ? allMems.filter(function(m) { return (m.content || m.text || '').toLowerCase().includes(q); }) : allMems);
    });

    function loadMems() {
      var list = document.getElementById('homer-mem-list');
      list.innerHTML = '<div class="homer-skeleton homer-skeleton-card" style="margin:12px"></div><div class="homer-skeleton homer-skeleton-card" style="margin:12px"></div>';
      var auth = typeof window.supabaseAuthHeader === 'function' ? window.supabaseAuthHeader() : '';
      var headers = { 'Content-Type': 'application/json' };
      if (auth) headers['Authorization'] = auth;
      fetch('/api/joey', { method: 'POST', headers: headers, body: JSON.stringify({ action: 'getMemory' }) })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var mems = [];
          if (d && d.memory) {
            if (Array.isArray(d.memory)) mems = d.memory;
            else if (typeof d.memory === 'string') {
              try { mems = JSON.parse(d.memory); }
              catch (_) { mems = d.memory.split('\n').filter(Boolean).map(function(t, i) { return { id: i, content: t }; }); }
            }
          }
          allMems = mems; renderMems(mems);
        })
        .catch(function(e) {
          list.innerHTML = '<div style="text-align:center;color:#f87171;padding:40px;font-size:.85rem">Could not load.<br><small style="color:#64748b">' + esc(String(e.message || e)) + '</small></div>';
        });
    }

    function renderMems(mems) {
      var list = document.getElementById('homer-mem-list');
      if (!mems.length) { list.innerHTML = '<div style="text-align:center;color:#64748b;padding:40px;font-size:.85rem">No memories found</div>'; return; }
      list.innerHTML = mems.map(function(m, i) {
        var text = m.content || m.text || m.value || JSON.stringify(m);
        var ds = m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
        return '<div class="homer-mem-item homer-fade-in" data-idx="' + i + '">' +
          '<div class="homer-mem-text" id="homer-mem-txt-' + i + '">' + esc(text) + '</div>' +
          '<div class="homer-mem-meta">' + (ds ? '<span>' + ds + '</span>' : '') +
            '<button class="homer-mem-edit" data-idx="' + i + '">Edit</button>' +
            '<button class="homer-mem-save" id="homer-mem-sv-' + i + '" data-idx="' + i + '">Save</button>' +
            '<button class="homer-mem-del" data-idx="' + i + '">Delete</button>' +
          '</div></div>';
      }).join('');
      list.querySelectorAll('.homer-mem-edit').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = btn.dataset.idx;
          var el = document.getElementById('homer-mem-txt-' + idx);
          el.contentEditable = 'true'; el.focus();
          document.getElementById('homer-mem-sv-' + idx).style.display = 'inline';
          btn.style.display = 'none';
        });
      });
      list.querySelectorAll('.homer-mem-save').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(btn.dataset.idx);
          var el = document.getElementById('homer-mem-txt-' + idx);
          var newText = el.textContent.trim();
          el.contentEditable = 'false'; btn.style.display = 'none';
          allMems[idx] = Object.assign({}, allMems[idx], { content: newText, text: newText });
          window._homerToast({ message: 'Memory updated locally', type: 'success' });
        });
      });
      list.querySelectorAll('.homer-mem-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          allMems.splice(parseInt(btn.dataset.idx), 1);
          renderMems(allMems);
          window._homerToast({ message: 'Memory removed', type: 'info' });
        });
      });
    }

    function open() { panel.classList.add('open'); ov.classList.add('open'); loadMems(); }
    function close() { panel.classList.remove('open'); ov.classList.remove('open'); }
    document.getElementById('homer-mem-close').addEventListener('click', close);
    ov.addEventListener('click', close);
    fab.addEventListener('click', function() { panel.classList.contains('open') ? close() : open(); });
  }

  // ── Init ─────────────────────────────────────────────────────────────
  ready(function () {
    initToasts();
    initErrorBoundary();
    initOfflineIndicator();
    initThemeToggle();
    initClock();
    initWeather();
    initQuickCapture();
    initJoeyTyping();
    initPomodoro();
    initHabits();
    initExpenses();
    initDailyBrief();
    initMemoryEditor();
  });

})();
