/* ====================================================================
 * Homer Tips  v20260609a
 * Searchable reference tab: keyboard shortcuts, feature guide, how-tos
 * ==================================================================== */
(function () {
  'use strict';

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ── CSS ──────────────────────────────────────────────────────────── */
  var CSS = `
    /* ── Tab container ───────────────────────────────────────────────*/
    #tab-tips {
      padding: 0 !important;
      background: transparent !important;
      border-radius: 12px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif;
      color: #f0f0ff;
    }
    .tips-page { max-width: 680px; margin: 0 auto; padding: 0 0 40px; }

    /* ── Hero header ─────────────────────────────────────────────────*/
    .tips-hero { padding: 28px 24px 20px; }
    .tips-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .tips-hero-icon { font-size: 2rem; line-height: 1; flex-shrink: 0; }
    .tips-hero-text { flex: 1; }
    .tips-hero-title { font-size: 1.4rem; font-weight: 700; color: #f0f0ff; letter-spacing: -.01em; margin: 0 0 3px; }
    .tips-hero-sub { font-size: .8rem; color: rgba(240,240,255,.45); line-height: 1.5; }
    .tips-version-badge { font-size: .65rem; color: rgba(240,240,255,.35); background: rgba(204,0,255,.08); border: 1px solid rgba(204,0,255,.15); border-radius: 20px; padding: 3px 9px; white-space: nowrap; align-self: flex-start; margin-top: 4px; }

    /* ── Search ──────────────────────────────────────────────────────*/
    .tips-search-wrap { padding: 0 24px 16px; }
    .tips-search-box { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,.04); border: 1px solid rgba(204,0,255,.2); border-radius: 8px; padding: 8px 12px; }
    .tips-search-icon { color: rgba(240,240,255,.3); font-size: .85rem; flex-shrink: 0; }
    #tips-search-input { border: none; outline: none; background: none; font-size: .85rem; color: #f0f0ff; flex: 1; font-family: inherit; min-width: 0; }
    #tips-search-input::placeholder { color: rgba(240,240,255,.25); }
    .tips-search-clear { background: none; border: none; color: rgba(240,240,255,.3); cursor: pointer; font-size: .8rem; padding: 1px 4px; border-radius: 3px; display: none; line-height: 1; }
    .tips-search-clear:hover { background: rgba(255,255,255,.06); color: #f0f0ff; }
    .tips-search-clear.visible { display: block; }

    /* ── Section divider ─────────────────────────────────────────────*/
    .tips-section { padding: 0 24px 20px; }
    .tips-section-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,.07); }
    .tips-section-hd svg { color: rgba(240,240,255,.35); flex-shrink: 0; }
    .tips-section-title { font-size: .8rem; font-weight: 700; color: rgba(240,240,255,.45); text-transform: uppercase; letter-spacing: .08em; flex: 1; }
    .tips-section-count { font-size: .65rem; color: rgba(240,240,255,.3); background: rgba(204,0,255,.08); border-radius: 10px; padding: 1px 7px; }

    /* ── Keyboard shortcuts ──────────────────────────────────────────*/
    .tips-shortcuts-list { display: flex; flex-direction: column; gap: 1px; }
    .tips-shortcut-row { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 6px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); transition: background .08s; }
    .tips-shortcut-row:hover { background: rgba(204,0,255,.06); border-color: rgba(204,0,255,.18); }
    .tips-shortcut-row.hidden { display: none; }
    .tips-keys { display: flex; align-items: center; gap: 3px; flex-shrink: 0; min-width: 130px; }
    .tips-key { display: inline-flex; align-items: center; justify-content: center; padding: 2px 7px; background: rgba(204,0,255,.10); border: 1px solid rgba(204,0,255,.3); border-bottom-width: 2px; border-radius: 4px; font-size: .7rem; font-weight: 600; color: #CC00FF; white-space: nowrap; letter-spacing: .01em; }
    .tips-key-sep { font-size: .65rem; color: rgba(240,240,255,.3); padding: 0 1px; }
    .tips-shortcut-main { flex: 1; min-width: 0; }
    .tips-shortcut-action { font-size: .82rem; font-weight: 600; color: #f0f0ff; margin-bottom: 1px; }
    .tips-shortcut-desc { font-size: .72rem; color: rgba(240,240,255,.45); }

    /* ── Feature cards ───────────────────────────────────────────────*/
    .tips-features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    @media (max-width: 480px) { .tips-features-grid { grid-template-columns: 1fr; } }
    .tips-feat-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 12px 14px; cursor: pointer; transition: box-shadow .12s, border-color .12s, background .12s; position: relative; }
    .tips-feat-card:hover { background: rgba(204,0,255,.06); border-color: rgba(204,0,255,.2); box-shadow: 0 4px 16px rgba(204,0,255,.1); }
    .tips-feat-card.hidden { display: none; }
    .tips-feat-card.no-nav { cursor: default; }
    .tips-feat-top { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 5px; }
    .tips-feat-icon { font-size: 1.3rem; line-height: 1; flex-shrink: 0; }
    .tips-feat-name { font-size: .82rem; font-weight: 700; color: #f0f0ff; flex: 1; line-height: 1.3; }
    .tips-feat-new { font-size: .55rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #CC00FF; background: rgba(204,0,255,.12); border-radius: 3px; padding: 1px 5px; vertical-align: middle; margin-left: 4px; }
    .tips-feat-desc { font-size: .74rem; color: rgba(240,240,255,.45); line-height: 1.5; }
    .tips-feat-goto { position: absolute; bottom: 10px; right: 11px; font-size: .65rem; color: rgba(240,240,255,.2); }
    .tips-feat-card:hover .tips-feat-goto { color: #CC00FF; }

    /* ── How-To accordion ────────────────────────────────────────────*/
    .tips-howto-list { display: flex; flex-direction: column; gap: 4px; }
    .tips-howto-item { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: 8px; overflow: hidden; }
    .tips-howto-item.hidden { display: none; }
    .tips-howto-header { display: flex; align-items: center; gap: 10px; padding: 11px 14px; cursor: pointer; user-select: none; transition: background .08s; }
    .tips-howto-header:hover { background: rgba(204,0,255,.06); }
    .tips-howto-chevron { font-size: .75rem; color: rgba(240,240,255,.35); transition: transform .2s; flex-shrink: 0; }
    .tips-howto-item.open .tips-howto-chevron { transform: rotate(90deg); }
    .tips-howto-hd-text { flex: 1; font-size: .83rem; font-weight: 600; color: #f0f0ff; }
    .tips-howto-body { max-height: 0; overflow: hidden; transition: max-height .25s ease; }
    .tips-howto-item.open .tips-howto-body { max-height: 600px; }
    .tips-howto-steps { padding: 0 16px 14px 16px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,.06); padding-top: 12px; margin: 0 2px; }
    .tips-howto-step { display: flex; align-items: flex-start; gap: 10px; }
    .tips-step-num { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg,#CC00FF,#FF0066); color: #fff; font-size: .65rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
    .tips-step-text { font-size: .8rem; color: rgba(240,240,255,.65); line-height: 1.55; flex: 1; }
    .tips-step-text code { background: rgba(204,0,255,.1); border-radius: 3px; padding: 1px 5px; font-size: .78rem; font-family: "SF Mono", "Fira Mono", monospace; color: #CC00FF; }

    /* ── No results ──────────────────────────────────────────────────*/
    .tips-no-results { text-align: center; padding: 32px 20px; display: none; }
    .tips-no-results.visible { display: block; }
    .tips-no-results-icon { font-size: 1.8rem; margin-bottom: 8px; }
    .tips-no-results-text { font-size: .82rem; color: rgba(240,240,255,.35); }

    /* ── Section hidden when all items hidden ─────────────────────────*/
    .tips-section.all-hidden { display: none; }
  `;
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ── Data ──────────────────────────────────────────────────────────── */
  var SHORTCUTS = [
    { keys: [['Ctrl','K']], action: 'Global Search', desc: 'Search across journal, notes, tasks, links, quotes and kanban' },
    { keys: [['Ctrl','Space']], action: 'Quick Capture', desc: 'Instantly save a thought to Inbox without leaving your current view' },
    { keys: [['Ctrl','S']], action: 'Save note', desc: 'Save the current note in the Second Brain notes editor' },
    { keys: [['&#8593;'],['&#8595;']], action: 'Navigate results', desc: 'Move up and down through Global Search results' },
    { keys: [['Enter']], action: 'Open result', desc: 'Open the highlighted result in Global Search or confirm in Quick Capture' },
    { keys: [['Esc']], action: 'Close overlay', desc: 'Dismiss Global Search, Quick Capture, Weekly Review, or any modal' },
  ];

  var FEATURES = [
    { icon: '&#127759;', name: 'Daily Brief', desc: 'AI morning summary: weather, tasks due today, habit streaks, and news headlines.', tab: 'daily-brief', isNew: false },
    { icon: '&#128204;', name: 'Global Search', desc: 'Search everything at once — journal, notes, links, tasks, kanban, quotes.', tab: null, action: 'sb', isNew: true },
    { icon: '&#9889;', name: 'Quick Capture', desc: 'Save thoughts to Inbox, Notes, or Tasks in 2 seconds. Never lose an idea.', tab: null, action: 'qc', isNew: true },
    { icon: '&#128468;', name: 'Journal + AI', desc: 'Write daily entries and get AI reflection: themes, insight, and affirmation.', tab: 'journal', isNew: false },
    { icon: '&#128197;', name: 'Weekly Review', desc: 'Auto-populated stats every week: habit rate, focus hours, journal streak, spend.', tab: null, action: 'wr', isNew: true },
    { icon: '&#128260;', name: 'Recurring Tasks', desc: 'Tasks that auto-reset on your schedule. Appears in Daily Brief when due.', tab: 'recurring', isNew: false },
    { icon: '&#128276;', name: 'Smart Reminders', desc: 'Browser notifications for tasks and car document expiry (30 days + 7 days).', tab: 'reminders', isNew: false },
    { icon: '&#128665;', name: 'Car Tracker', desc: 'Document expiry, maintenance history, fuel logs, odometer tracking, cloud sync.', tab: 'vault', isNew: false },
    { icon: '&#128193;', name: 'Vault', desc: 'AES-encrypted notes, credentials, Kanban board, and life goals. Unlocked locally.', tab: 'vault', isNew: false },
    { icon: '&#127919;', name: 'Focus / Pomodoro', desc: 'Timer with task list, session history, and phase-end sound cues.', tab: 'focus', isNew: false },
    { icon: '&#128200;', name: 'Expenses & Budget', desc: 'Track income and expenses with category budgets and monthly trends.', tab: 'budget', isNew: false },
    { icon: '&#9989;', name: 'Habits', desc: 'Daily / weekday / weekly habits with streak tracking and completion calendar.', tab: 'habits', isNew: false },
    { icon: '&#129504;', name: 'Joey AI', desc: 'Context-aware assistant with access to your journal, habits, and memories.', tab: 'joey', isNew: false },
    { icon: '&#128260;', name: 'Real-time Sync', desc: 'Changes sync instantly across devices via Supabase Realtime WebSocket.', tab: 'sync', isNew: false },
  ];

  var HOWTOS = [
    {
      title: 'Use Quick Capture in your workflow',
      steps: [
        'Press <code>Ctrl+Space</code> from anywhere on the page to open Quick Capture.',
        'Choose a destination: <code>Inbox</code> (default), <code>Note</code>, or <code>Task</code>.',
        'Type your thought and press <code>Enter</code> or click Save.',
        'Inbox items accumulate in the Inbox screen. Review and triage them later.',
        'Notes land in Second Brain &rarr; Notes. Tasks appear at the top of the Pomodoro list.',
      ],
    },
    {
      title: 'Get AI reflections on a journal entry',
      steps: [
        'Open the <strong>Journal</strong> tab and click <strong>+ New</strong> or open an existing entry.',
        'Write at least 20 characters &mdash; the reflection button activates automatically.',
        'Click <strong>Get AI Reflection</strong> at the bottom of the editor.',
        'Joey analyses your writing and returns: detected themes, a personal insight, and an affirmation.',
        'The reflection is saved with the entry so you can re-read it any time.',
      ],
    },
    {
      title: 'Create a recurring task',
      steps: [
        'Open the <strong>Recurring</strong> tab.',
        'Click <strong>+ Add recurring task</strong> and give it a name.',
        'Choose frequency: <code>Daily</code>, <code>Weekdays</code>, <code>Weekly</code>, or <code>Monthly</code>. For monthly, pick the day of the month.',
        'The task appears in the Daily Brief on its due date.',
        'Tick it as done in Daily Brief or the Recurring tab &mdash; it resets automatically on the next cycle.',
      ],
    },
    {
      title: 'Track car documents and get expiry alerts',
      steps: [
        'Go to <strong>Vault &rarr; Car Tracker</strong>.',
        'Open the <strong>Documents</strong> tab and click <strong>+ Add document</strong>.',
        'Enter the document name (e.g. Insurance, MOT) and its expiry date.',
        'Homer schedules browser notifications at <strong>30 days</strong> and <strong>7 days</strong> before expiry.',
        'Expired documents show in red in the Daily Brief as a reminder to renew.',
      ],
    },
    {
      title: 'Search across all your data',
      steps: [
        'Press <code>Ctrl+K</code> or click the search icon to open Global Search.',
        'Start typing &mdash; results appear live from journal, notes, tasks, links, quotes, and kanban.',
        'Use <code>&uarr;</code> / <code>&darr;</code> to navigate the list, <code>Enter</code> to open the result.',
        'Clicking a journal result opens that entry. Clicking a task highlights the Pomodoro tab.',
        'Press <code>Esc</code> to close without navigating away.',
      ],
    },
    {
      title: 'Sync data across devices',
      steps: [
        'Open <strong>Settings &rarr; Sync</strong> and sign in with your account.',
        'Changes are pushed to Supabase automatically after each edit (debounced ~1s).',
        'On another device, open Homer and sign in with the same account &mdash; data pulls on load.',
        'Use the <strong>Sync Now</strong> button to force an immediate push + pull.',
        '<strong>Vault data</strong> syncs only after you unlock the vault on the source device first.',
        'The car tracker has a <strong>&#9729; sync button</strong> in its header for explicit cloud push.',
      ],
    },
    {
      title: 'Set up the Weekly Review',
      steps: [
        'Open <strong>Second Brain &rarr; Weekly Review</strong> (or press its button in the Second Brain tab).',
        'Stats auto-populate: average habit completion, focus sessions this week, journal entries, and top expense category.',
        'Add your own reflections in the free-text sections: wins, challenges, intentions.',
        'Save the review &mdash; it\'s stored locally and syncs with your other devices.',
        'Past reviews are accessible from the review history at the bottom of the panel.',
      ],
    },
    {
      title: 'Manage expenses and set budgets',
      steps: [
        'Open the <strong>Budget</strong> tab.',
        'Use the <strong>Add</strong> button to log an expense or income with amount, category, and date.',
        'Switch to the <strong>Budgets</strong> sub-tab to set monthly spending limits per category.',
        'The overview card shows total in vs. out, and progress bars per category colour red when over budget.',
        'Use <strong>Templates</strong> to save frequent expense types for fast entry.',
      ],
    },
  ];

  /* ── Rendering ────────────────────────────────────────────────────── */
  function buildKeyHtml(keyGroups) {
    return keyGroups.map(function (group, i) {
      var parts = group.map(function (k) {
        return '<span class="tips-key">' + k + '</span>';
      }).join('<span class="tips-key-sep">+</span>');
      return (i > 0 ? '<span class="tips-key-sep" style="margin:0 4px">/</span>' : '') + parts;
    }).join('');
  }

  function renderShortcuts(filter) {
    var rows = SHORTCUTS.map(function (s) {
      var searchText = (s.action + ' ' + s.desc).toLowerCase();
      var keyText = s.keys.flat().join(' ').toLowerCase();
      var hidden = filter && !(searchText.includes(filter) || keyText.includes(filter));
      return '<div class="tips-shortcut-row' + (hidden ? ' hidden' : '') + '">'
        + '<div class="tips-keys">' + buildKeyHtml(s.keys) + '</div>'
        + '<div class="tips-shortcut-main">'
        + '<div class="tips-shortcut-action">' + esc(s.action) + '</div>'
        + '<div class="tips-shortcut-desc">' + esc(s.desc) + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    var count = filter ? SHORTCUTS.filter(function (s) {
      var t = (s.action + ' ' + s.desc + ' ' + s.keys.flat().join(' ')).toLowerCase();
      return t.includes(filter);
    }).length : SHORTCUTS.length;
    return { html: '<div class="tips-shortcuts-list">' + rows + '</div>', count: count };
  }

  function renderFeatures(filter) {
    var cards = FEATURES.map(function (f) {
      var searchText = (f.name + ' ' + f.desc).toLowerCase();
      var hidden = filter && !searchText.includes(filter);
      var clickable = !!(f.tab || f.action);
      return '<div class="tips-feat-card' + (hidden ? ' hidden' : '') + (clickable ? '' : ' no-nav') + '"'
        + ' data-tab="' + esc(f.tab || '') + '" data-action="' + esc(f.action || '') + '">'
        + '<div class="tips-feat-top">'
        + '<div class="tips-feat-icon">' + f.icon + '</div>'
        + '<div class="tips-feat-name">' + esc(f.name) + (f.isNew ? '<span class="tips-feat-new">New</span>' : '') + '</div>'
        + '</div>'
        + '<div class="tips-feat-desc">' + esc(f.desc) + '</div>'
        + (clickable ? '<div class="tips-feat-goto">Open &rarr;</div>' : '')
        + '</div>';
    }).join('');
    var count = filter ? FEATURES.filter(function (f) {
      return (f.name + ' ' + f.desc).toLowerCase().includes(filter);
    }).length : FEATURES.length;
    return { html: '<div class="tips-features-grid">' + cards + '</div>', count: count };
  }

  function renderHowTos(filter) {
    var items = HOWTOS.map(function (h, idx) {
      var stepsText = h.steps.join(' ').replace(/<[^>]+>/g, '').toLowerCase();
      var searchText = (h.title + ' ' + stepsText).toLowerCase();
      var hidden = filter && !searchText.includes(filter);
      var stepsHtml = h.steps.map(function (step, i) {
        return '<div class="tips-howto-step">'
          + '<div class="tips-step-num">' + (i + 1) + '</div>'
          + '<div class="tips-step-text">' + step + '</div>'
          + '</div>';
      }).join('');
      return '<div class="tips-howto-item' + (hidden ? ' hidden' : '') + '" data-idx="' + idx + '">'
        + '<div class="tips-howto-header">'
        + '<span class="tips-howto-chevron">&#9654;</span>'
        + '<span class="tips-howto-hd-text">' + esc(h.title) + '</span>'
        + '</div>'
        + '<div class="tips-howto-body">'
        + '<div class="tips-howto-steps">' + stepsHtml + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    var count = filter ? HOWTOS.filter(function (h) {
      var t = (h.title + ' ' + h.steps.join(' ')).replace(/<[^>]+>/g, '').toLowerCase();
      return t.includes(filter);
    }).length : HOWTOS.length;
    return { html: '<div class="tips-howto-list">' + items + '</div>', count: count };
  }

  function renderTab() {
    var tab = document.getElementById('tab-tips');
    if (!tab) return;

    var sc = renderShortcuts('');
    var ft = renderFeatures('');
    var ht = renderHowTos('');

    tab.innerHTML = '<div class="tips-page">'
      + '<div class="tips-hero">'
      + '<div class="tips-hero-top">'
      + '<div class="tips-hero-icon">&#128161;</div>'
      + '<div class="tips-hero-text">'
      + '<div class="tips-hero-title">Tips &amp; Shortcuts</div>'
      + '<div class="tips-hero-sub">Everything Homer can do &mdash; keyboard shortcuts, feature guide, and step-by-step how-tos.</div>'
      + '</div>'
      + '<div class="tips-version-badge">Homer v13</div>'
      + '</div>'
      + '</div>'

      // Search
      + '<div class="tips-search-wrap">'
      + '<div class="tips-search-box">'
      + '<span class="tips-search-icon">&#128269;</span>'
      + '<input type="text" id="tips-search-input" placeholder="Search shortcuts, features, how-tos\u2026" autocomplete="off" spellcheck="false">'
      + '<button class="tips-search-clear" id="tips-search-clear">&times;</button>'
      + '</div>'
      + '</div>'

      // Shortcuts
      + '<div class="tips-section" id="tips-sec-shortcuts">'
      + '<div class="tips-section-hd">'
      + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
      + '<span class="tips-section-title">Keyboard Shortcuts</span>'
      + '<span class="tips-section-count" id="tips-sc-count">' + sc.count + '</span>'
      + '</div>'
      + sc.html
      + '</div>'

      // Features
      + '<div class="tips-section" id="tips-sec-features">'
      + '<div class="tips-section-hd">'
      + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
      + '<span class="tips-section-title">Features</span>'
      + '<span class="tips-section-count" id="tips-ft-count">' + ft.count + '</span>'
      + '</div>'
      + ft.html
      + '</div>'

      // How-tos
      + '<div class="tips-section" id="tips-sec-howtos">'
      + '<div class="tips-section-hd">'
      + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      + '<span class="tips-section-title">How-To Guides</span>'
      + '<span class="tips-section-count" id="tips-ht-count">' + ht.count + '</span>'
      + '</div>'
      + ht.html
      + '</div>'

      // No results
      + '<div class="tips-no-results" id="tips-no-results">'
      + '<div class="tips-no-results-icon">&#128269;</div>'
      + '<div class="tips-no-results-text">No matches found. Try a different search term.</div>'
      + '</div>'

      + '</div>';

    /* Search */
    var searchInput = document.getElementById('tips-search-input');
    var searchClear = document.getElementById('tips-search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        doFilter(searchInput.value.trim().toLowerCase());
        searchClear.classList.toggle('visible', searchInput.value.length > 0);
      });
    }
    if (searchClear) {
      searchClear.addEventListener('click', function () {
        searchInput.value = '';
        searchClear.classList.remove('visible');
        doFilter('');
        searchInput.focus();
      });
    }

    /* Feature card clicks */
    tab.querySelectorAll('.tips-feat-card').forEach(function (card) {
      var tabTarget = card.dataset.tab;
      var action    = card.dataset.action;
      if (!tabTarget && !action) return;
      card.addEventListener('click', function () {
        if (action === 'sb' && window.showSB) { window.showSB(); return; }
        if (action === 'qc' && window.showQC) { window.showQC('inbox'); return; }
        if (action === 'wr' && window.showWR) { window.showWR(); return; }
        if (tabTarget && typeof window._homerShowTab === 'function') {
          window._homerShowTab(tabTarget);
        }
      });
    });

    /* How-to accordion */
    tab.querySelectorAll('.tips-howto-header').forEach(function (hdr) {
      hdr.addEventListener('click', function () {
        var item = hdr.closest('.tips-howto-item');
        if (!item) return;
        var wasOpen = item.classList.contains('open');
        /* Close all */
        tab.querySelectorAll('.tips-howto-item').forEach(function (i) { i.classList.remove('open'); });
        /* Toggle current */
        if (!wasOpen) item.classList.add('open');
      });
    });
  }

  function doFilter(filter) {
    var tab = document.getElementById('tab-tips');
    if (!tab) return;

    var scCount = 0, ftCount = 0, htCount = 0;

    /* Shortcuts */
    tab.querySelectorAll('.tips-shortcut-row').forEach(function (row, i) {
      var s = SHORTCUTS[i];
      if (!s) return;
      var t = (s.action + ' ' + s.desc + ' ' + s.keys.flat().join(' ')).toLowerCase();
      var hide = filter && !t.includes(filter);
      row.classList.toggle('hidden', !!hide);
      if (!hide) scCount++;
    });

    /* Features */
    tab.querySelectorAll('.tips-feat-card').forEach(function (card, i) {
      var f = FEATURES[i];
      if (!f) return;
      var t = (f.name + ' ' + f.desc).toLowerCase();
      var hide = filter && !t.includes(filter);
      card.classList.toggle('hidden', !!hide);
      if (!hide) ftCount++;
    });

    /* How-tos */
    tab.querySelectorAll('.tips-howto-item').forEach(function (item, i) {
      var h = HOWTOS[i];
      if (!h) return;
      var t = (h.title + ' ' + h.steps.join(' ')).replace(/<[^>]+>/g, '').toLowerCase();
      var hide = filter && !t.includes(filter);
      item.classList.toggle('hidden', !!hide);
      if (!hide) htCount++;
    });

    /* Update counts */
    var scCountEl = document.getElementById('tips-sc-count');
    var ftCountEl = document.getElementById('tips-ft-count');
    var htCountEl = document.getElementById('tips-ht-count');
    if (scCountEl) scCountEl.textContent = scCount;
    if (ftCountEl) ftCountEl.textContent = ftCount;
    if (htCountEl) htCountEl.textContent = htCount;

    /* Hide empty sections */
    var scSec = document.getElementById('tips-sec-shortcuts');
    var ftSec = document.getElementById('tips-sec-features');
    var htSec = document.getElementById('tips-sec-howtos');
    if (scSec) scSec.classList.toggle('all-hidden', filter && scCount === 0);
    if (ftSec) ftSec.classList.toggle('all-hidden', filter && ftCount === 0);
    if (htSec) htSec.classList.toggle('all-hidden', filter && htCount === 0);

    /* No results */
    var nr = document.getElementById('tips-no-results');
    if (nr) nr.classList.toggle('visible', !!(filter && scCount === 0 && ftCount === 0 && htCount === 0));
  }

  /* ── Tab registration ─────────────────────────────────────────────── */
  var MY_TAB = 'tips';

  function patchTabSystem() {
    var orig = window._homerShowTab;
    if (!orig || orig._hjTips) return;
    function patched(name) {
      var jt = document.getElementById('tab-tips');
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
    patched._hjTips = true;
    window._homerShowTab = patched;

    if (!window._hjTipsHideBound) {
      window._hjTipsHideBound = true;
      window.addEventListener('homer-tab-change', function (e) {
        var name = e && e.detail && e.detail.tab;
        if (!name || name === MY_TAB) return;
        var jt = document.getElementById('tab-tips');
        if (jt && jt.style.display !== 'none') jt.style.display = 'none';
      });
    }

    document.querySelectorAll('[data-tab="' + MY_TAB + '"]').forEach(function (btn) {
      if (!btn._hjTipsWired) { btn._hjTipsWired = true; btn.addEventListener('click', function () { patched(MY_TAB); }); }
    });
  }

  function addTabSection() {
    if (document.getElementById('tab-tips')) return;
    var shell = document.querySelector('.shell');
    if (!shell) return;
    var s = document.createElement('section');
    s.id = 'tab-tips'; s.className = 'tab card'; s.style.display = 'none';
    shell.appendChild(s);
  }

  function addNavButtons() {
    var sidebar = document.getElementById('desktop-sidebar');
    var spacer  = sidebar && sidebar.querySelector('.sb-spacer');
    if (sidebar && spacer && !sidebar.querySelector('[data-tab="tips"]')) {
      var sb = document.createElement('button');
      sb.className = 'sb-item'; sb.dataset.tab = 'tips';
      sb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span class="sb-label">Tips</span>';
      sidebar.insertBefore(sb, spacer);
    }

    var tabsBar = document.querySelector('.tabs');
    if (tabsBar && !tabsBar.querySelector('[data-tab="tips"]')) {
      var tb = document.createElement('button');
      tb.className = 'tab-btn'; tb.dataset.tab = 'tips'; tb.textContent = '💡 Tips';
      tabsBar.appendChild(tb);
    }

    var msheet = document.querySelector('.msheet-grid');
    if (msheet && !msheet.querySelector('[data-tab="tips"]')) {
      var ms = document.createElement('div');
      ms.className = 'msheet-item'; ms.dataset.tab = 'tips';
      ms.innerHTML = '<div class="msheet-icon">💡</div><span>Tips</span>';
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
  });

})();
