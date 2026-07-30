(function () {
  'use strict';

  var SETTINGS_KEY = 'homer-productivity.v1';
  var INBOX_KEY = 'homer-universal-inbox.v1';
  var ARCHIVE_KEY = 'homer-capture-archive.v1';
  var TASKS_KEY = 'pom.tasks.v1';
  var HABITS_KEY = 'homer-habits';
  var TODAY_KEY = 'pom.today.v1';
  var SESSIONS_KEY = 'homer-sessions';
  var state = { paletteIndex: 0, paletteItems: [] };

  function read(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function todayKey(date) {
    var d = date || new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function settings() {
    var value = read(SETTINGS_KEY, {});
    value.context = value.context || 'personal';
    value.energy = value.energy || 'steady';
    value.focus = value.focus || {};
    value.weeklyWins = value.weeklyWins || {};
    return value;
  }

  function saveSettings(next) {
    write(SETTINGS_KEY, next);
  }

  function classify(text) {
    var value = String(text || '').toLowerCase();
    if (/\b(remind|tomorrow|tonight|next week|at \d|on (mon|tue|wed|thu|fri|sat|sun))\b/.test(value)) return 'reminder';
    if (/\b(goal|someday|this year|milestone|aim to)\b/.test(value)) return 'goal';
    if (/\b(idea|maybe|could|what if|concept)\b/.test(value)) return 'idea';
    if (/\b(todo|task|call|email|send|buy|book|fix|finish|review|submit|pay)\b/.test(value)) return 'task';
    return 'note';
  }

  function capture(text, forcedType) {
    var clean = String(text || '').trim();
    if (!clean) return false;
    var items = read(INBOX_KEY, []);
    items.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: clean,
      type: forcedType || classify(clean),
      createdAt: Date.now(),
      processed: false
    });
    write(INBOX_KEY, items);
    renderInbox();
    refreshStats();
    return true;
  }

  function addTask(text) {
    if (window._homerPomodoroAgent && typeof window._homerPomodoroAgent.addTask === 'function') {
      return window._homerPomodoroAgent.addTask(text);
    }
    var tasks = read(TASKS_KEY, []);
    tasks.unshift({ text: text, done: false, ts: Date.now() });
    write(TASKS_KEY, tasks);
    window.dispatchEvent(new StorageEvent('storage', { key: TASKS_KEY }));
    return true;
  }

  function addNote(text, kind) {
    var notes = read('homer-notes', []);
    var now = new Date().toISOString();
    notes.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: kind === 'goal' ? 'Goal: ' + text.slice(0, 72) : text.slice(0, 72),
      content: text,
      daily: false,
      created: now,
      updated: now,
      source: 'universal-inbox',
      kind: kind
    });
    write('homer-notes', notes);
  }

  function reminderTime(text) {
    var now = new Date();
    var next = new Date(now.getTime() + 60 * 60 * 1000);
    if (/\btomorrow\b/i.test(text)) {
      next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
    } else if (/\btonight\b/i.test(text)) {
      next.setHours(20, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
    }
    var time = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (time) {
      var hour = Number(time[1]);
      var minute = Number(time[2] || 0);
      if (time[3] && time[3].toLowerCase() === 'pm' && hour < 12) hour += 12;
      if (time[3] && time[3].toLowerCase() === 'am' && hour === 12) hour = 0;
      next.setHours(hour, minute, 0, 0);
      if (next <= now && !/\btomorrow\b/i.test(text)) next.setDate(next.getDate() + 1);
    }
    return next.getTime();
  }

  function addReminder(text) {
    var reminders = read('homer-reminders', []);
    reminders.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: text,
      body: 'Captured from Homer Inbox',
      triggerAt: reminderTime(text),
      enabled: true,
      recurType: 'none',
      createdAt: Date.now()
    });
    write('homer-reminders', reminders);
  }

  function processCapture(id) {
    var items = read(INBOX_KEY, []);
    var item = items.find(function (entry) { return entry.id === id; });
    if (!item || item.processed) return;
    if (item.type === 'task') addTask(item.text);
    else if (item.type === 'reminder') addReminder(item.text);
    else addNote(item.text, item.type);
    var archive = read(ARCHIVE_KEY, []);
    archive.unshift({
      id: item.id,
      text: item.text,
      type: item.type,
      createdAt: item.createdAt,
      filedAt: Date.now()
    });
    item.processed = true;
    item.filedAt = Date.now();
    write(ARCHIVE_KEY, archive.slice(0, 500));
    write(INBOX_KEY, items);
    renderInbox();
    refreshStats();
  }

  function deleteCapture(id) {
    write(INBOX_KEY, read(INBOX_KEY, []).filter(function (entry) { return entry.id !== id; }));
    renderInbox();
    refreshStats();
  }

  function renderInbox() {
    var root = document.getElementById('universal-inbox-list');
    if (!root) return;
    var items = read(INBOX_KEY, []).slice(0, 12);
    root.textContent = '';
    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'inbox-empty';
      empty.textContent = 'Nothing waiting. Add anything you do not want to forget.';
      root.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'inbox-item' + (item.processed ? ' processed' : '');
      row.dataset.id = item.id;

      var type = document.createElement('select');
      type.className = 'inbox-type';
      type.setAttribute('aria-label', 'Capture type');
      ['task', 'note', 'reminder', 'idea', 'goal'].forEach(function (name) {
        var option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.selected = item.type === name;
        type.appendChild(option);
      });
      type.disabled = !!item.processed;
      type.addEventListener('change', function () {
        var all = read(INBOX_KEY, []);
        var current = all.find(function (entry) { return entry.id === item.id; });
        if (current) current.type = type.value;
        write(INBOX_KEY, all);
      });

      var copy = document.createElement('div');
      copy.className = 'inbox-copy';
      copy.textContent = item.text;
      copy.title = item.text;

      var actions = document.createElement('div');
      actions.className = 'inbox-actions';
      if (!item.processed) {
        var file = document.createElement('button');
        file.type = 'button';
        var actionLabels = {
          task: 'Add to tasks',
          reminder: 'Schedule',
          note: 'Save note',
          idea: 'Save idea',
          goal: 'Save goal'
        };
        file.textContent = actionLabels[item.type] || 'File';
        file.addEventListener('click', function () { processCapture(item.id); });
        actions.appendChild(file);
      }
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', function () { deleteCapture(item.id); });
      actions.appendChild(remove);

      row.appendChild(type);
      row.appendChild(copy);
      row.appendChild(actions);
      root.appendChild(row);
    });
  }

  function habitMetrics() {
    var data = read(HABITS_KEY, { habits: [], completions: {} });
    var habits = Array.isArray(data.habits) ? data.habits.filter(function (habit) { return !habit.archived; }) : [];
    var completions = data.completions || {};
    var today = todayKey();
    var doneToday = habits.filter(function (habit) {
      return Number(completions[habit.id + ':' + today]) >= Number(habit.target || 1);
    }).length;
    var since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    var weekly = Object.keys(completions).filter(function (key) {
      if (!completions[key]) return false;
      var date = key.slice(-10);
      var parsed = new Date(date + 'T00:00:00');
      return !isNaN(parsed.getTime()) && parsed >= since;
    }).length;
    return { doneToday: doneToday, total: habits.length, weekly: weekly };
  }

  function focusMinutes() {
    var today = read(TODAY_KEY, {});
    return today.date === todayKey() ? Number(today.mins || 0) : 0;
  }

  function weeklyFocusMinutes() {
    var cutoff = Date.now() - 7 * 86400000;
    var sessions = read(SESSIONS_KEY, []);
    var total = 0;
    if (Array.isArray(sessions)) {
      sessions.forEach(function (session) {
        var rawStamp = session.ts || session.createdAt || session.date || 0;
        var stamp = typeof rawStamp === 'string' && !/^\d+$/.test(rawStamp)
          ? new Date(rawStamp).getTime()
          : Number(rawStamp);
        if (stamp && stamp < 100000000000) stamp *= 1000;
        if (stamp >= cutoff) {
          total += Number(session.minutes || session.mins || session.durationMin || session.duration || 0);
        }
      });
    }
    return Math.round(total) || focusMinutes();
  }

  function weeklyMetrics() {
    var cutoff = Date.now() - 7 * 86400000;
    var tasks = read(TASKS_KEY, []);
    var captures = read(INBOX_KEY, []).concat(read(ARCHIVE_KEY, []));
    var habits = habitMetrics();
    return {
      tasks: tasks.filter(function (task) { return task.done && Number(task.ts || 0) >= cutoff; }).length,
      focus: weeklyFocusMinutes(),
      habits: habits.weekly,
      captures: captures.filter(function (item) { return Number(item.createdAt || 0) >= cutoff; }).length
    };
  }

  function suggestedTask(energy) {
    var tasks = read(TASKS_KEY, []).filter(function (task) { return !task.done && task.text; });
    if (!tasks.length) return '';
    if (energy === 'low') {
      return tasks.slice().sort(function (a, b) { return a.text.length - b.text.length; })[0].text;
    }
    if (energy === 'high') {
      return tasks.slice().sort(function (a, b) { return b.text.length - a.text.length; })[0].text;
    }
    return tasks[0].text;
  }

  function refreshStats() {
    var tasks = read(TASKS_KEY, []);
    var habits = habitMetrics();
    var inbox = read(INBOX_KEY, []).filter(function (item) { return !item.processed; });
    var metrics = weeklyMetrics();
    var values = {
      'lp-focus-mins': focusMinutes(),
      'lp-open-tasks': tasks.filter(function (task) { return !task.done; }).length,
      'lp-habits': habits.doneToday + '/' + habits.total,
      'lp-inbox-count': inbox.length,
      'rw-tasks': metrics.tasks,
      'rw-focus': metrics.focus + 'm',
      'rw-habits': metrics.habits,
      'rw-captures': metrics.captures
    };
    Object.keys(values).forEach(function (id) {
      var element = document.getElementById(id);
      if (element) element.textContent = values[id];
    });
    var score = document.getElementById('rewind-score');
    if (score) {
      var activity = metrics.tasks + metrics.habits + Math.round(metrics.focus / 25);
      score.textContent = activity >= 14
        ? 'A full week. Protect some empty space before adding more.'
        : activity >= 6
          ? 'Steady progress across the things you chose to track.'
          : 'A lighter week. Pick one small thing to carry forward.';
    }
    renderEnergyAdvice();
  }

  function setContext(name) {
    var value = settings();
    value.context = name;
    saveSettings(value);
    document.body.dataset.context = name;
    document.querySelectorAll('[data-context]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.context === name);
      button.setAttribute('aria-pressed', button.dataset.context === name ? 'true' : 'false');
    });
    var placeholders = {
      personal: 'One outcome that would make today count',
      work: 'The work outcome that matters most',
      deep: 'The one thing to protect from interruption',
      car: 'Say or type something to remember later'
    };
    var input = document.getElementById('daily-focus-input');
    if (input) input.placeholder = placeholders[name] || placeholders.personal;
  }

  function setEnergy(name) {
    var value = settings();
    value.energy = name;
    saveSettings(value);
    document.querySelectorAll('[data-energy]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.energy === name);
      button.setAttribute('aria-pressed', button.dataset.energy === name ? 'true' : 'false');
    });
    renderEnergyAdvice();
  }

  function renderEnergyAdvice() {
    var value = settings();
    var task = suggestedTask(value.energy);
    var advice = document.getElementById('energy-advice');
    if (!advice) return;
    if (task) {
      var prefix = value.energy === 'low' ? 'Keep it small: ' : value.energy === 'high' ? 'Use the momentum: ' : 'A sensible next step: ';
      advice.textContent = prefix + task;
      advice.dataset.task = task;
    } else {
      advice.textContent = 'No open tasks yet. Capture one below or add it in Focus.';
      advice.dataset.task = '';
    }
  }

  function renderDailyFocus() {
    var value = settings();
    var key = todayKey();
    var input = document.getElementById('daily-focus-input');
    var suggestion = document.getElementById('focus-suggestion');
    if (input) input.value = value.focus[key] || '';
    if (suggestion) {
      suggestion.textContent = value.focus[key]
        ? 'This stays at the top of today. You can change it whenever the day changes.'
        : 'Keep it concrete and finishable.';
    }
  }

  function saveDailyFocus() {
    var input = document.getElementById('daily-focus-input');
    if (!input) return;
    var value = settings();
    value.focus[todayKey()] = input.value.trim();
    saveSettings(value);
    renderDailyFocus();
  }

  function renderWeeklyWin() {
    var input = document.getElementById('weekly-win');
    if (!input) return;
    var week = weekKey();
    input.value = settings().weeklyWins[week] || '';
  }

  function weekKey() {
    var now = new Date();
    var start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return todayKey(start);
  }

  var baseCommands = [
    { label: 'Open Home', meta: 'Navigation', run: function () { openTab('home'); } },
    { label: 'Open Focus timer', meta: 'Navigation', run: function () { openTab('pomodoro'); } },
    { label: 'Open Focus Lab', meta: 'Navigation', run: function () { openTab('focuslab'); } },
    { label: 'Open Daily Brief', meta: 'Navigation', run: function () { openTab('daily-brief'); } },
    { label: 'Open Vault', meta: 'Navigation', run: function () { openTab('vault'); } },
    { label: 'Open Tools', meta: 'Navigation', run: function () { openTab('tools'); } },
    { label: 'Switch to Home context', meta: 'Context', run: function () { setContext('personal'); } },
    { label: 'Switch to Work context', meta: 'Context', run: function () { setContext('work'); } },
    { label: 'Switch to Deep focus', meta: 'Context', run: function () { setContext('deep'); } },
    { label: 'Set low energy', meta: 'Planning', run: function () { setEnergy('low'); } },
    { label: 'Set steady energy', meta: 'Planning', run: function () { setEnergy('steady'); } },
    { label: 'Set high energy', meta: 'Planning', run: function () { setEnergy('high'); } }
  ];

  function openTab(name) {
    var nav = document.querySelector('.sb-item[data-tab="' + name + '"], .tab-btn[data-tab="' + name + '"]');
    if (nav) nav.click();
    else if (typeof window._homerShowTab === 'function') window._homerShowTab(name);
    closePalette();
  }

  function openPalette(initial) {
    var palette = document.getElementById('command-palette');
    var input = document.getElementById('command-palette-input');
    if (!palette || !input) return;
    palette.hidden = false;
    document.body.style.overflow = 'hidden';
    input.value = initial || '';
    state.paletteIndex = 0;
    renderCommands();
    setTimeout(function () { input.focus(); }, 0);
  }

  function closePalette() {
    var palette = document.getElementById('command-palette');
    if (!palette) return;
    palette.hidden = true;
    document.body.style.overflow = '';
  }

  function renderCommands() {
    var input = document.getElementById('command-palette-input');
    var root = document.getElementById('command-palette-results');
    if (!input || !root) return;
    var query = input.value.trim().toLowerCase();
    var items = baseCommands.filter(function (command) {
      return !query || (command.label + ' ' + command.meta).toLowerCase().indexOf(query) !== -1;
    });
    if (query) {
      items.push({
        label: 'Capture "' + input.value.trim() + '"',
        meta: classify(input.value.trim()),
        run: function () { capture(input.value.trim()); closePalette(); }
      });
    }
    state.paletteItems = items;
    if (state.paletteIndex >= items.length) state.paletteIndex = Math.max(0, items.length - 1);
    root.textContent = '';
    items.forEach(function (command, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'command-result' + (index === state.paletteIndex ? ' active' : '');
      button.innerHTML = '<strong></strong><span></span>';
      button.querySelector('strong').textContent = command.label;
      button.querySelector('span').textContent = command.meta;
      button.addEventListener('mouseenter', function () {
        state.paletteIndex = index;
        root.querySelectorAll('.command-result').forEach(function (result, resultIndex) {
          result.classList.toggle('active', resultIndex === index);
        });
      });
      button.addEventListener('click', function () { command.run(); closePalette(); });
      root.appendChild(button);
    });
  }

  function copyRewind() {
    var metrics = weeklyMetrics();
    var win = settings().weeklyWins[weekKey()] || '';
    var text = [
      'Weekly rewind',
      metrics.tasks + ' tasks finished',
      metrics.focus + ' focus minutes',
      metrics.habits + ' habit check-ins',
      metrics.captures + ' items captured',
      win ? 'Win: ' + win : ''
    ].filter(Boolean).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
  }

  function bind() {
    var date = document.getElementById('launchpad-date');
    if (date) date.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

    document.querySelectorAll('[data-context]').forEach(function (button) {
      button.addEventListener('click', function () { setContext(button.dataset.context); });
    });
    document.querySelectorAll('[data-energy]').forEach(function (button) {
      button.addEventListener('click', function () { setEnergy(button.dataset.energy); });
    });

    var focusSave = document.getElementById('daily-focus-save');
    var focusInput = document.getElementById('daily-focus-input');
    if (focusSave) focusSave.addEventListener('click', saveDailyFocus);
    if (focusInput) focusInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') saveDailyFocus();
    });

    var captureInput = document.getElementById('universal-capture-input');
    var captureAdd = document.getElementById('universal-capture-add');
    function submitCapture() {
      if (capture(captureInput && captureInput.value)) {
        captureInput.value = '';
        captureInput.focus();
      }
    }
    if (captureAdd) captureAdd.addEventListener('click', submitCapture);
    if (captureInput) captureInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') submitCapture();
    });

    var clear = document.getElementById('clear-processed-inbox');
    if (clear) clear.addEventListener('click', function () {
      write(INBOX_KEY, read(INBOX_KEY, []).filter(function (item) { return !item.processed; }));
      renderInbox();
    });

    var start = document.getElementById('start-suggested-task');
    if (start) start.addEventListener('click', function () {
      var advice = document.getElementById('energy-advice');
      var task = advice && advice.dataset.task;
      if (!task) return;
      var value = settings();
      value.focus[todayKey()] = task;
      saveSettings(value);
      renderDailyFocus();
      openTab('pomodoro');
      if (window._homerPomodoroAgent && typeof window._homerPomodoroAgent.start === 'function') {
        window._homerPomodoroAgent.start();
      }
    });

    var win = document.getElementById('weekly-win');
    if (win) win.addEventListener('input', function () {
      var value = settings();
      value.weeklyWins[weekKey()] = win.value.trim();
      saveSettings(value);
    });
    var copy = document.getElementById('copy-weekly-rewind');
    if (copy) copy.addEventListener('click', copyRewind);

    var paletteButton = document.getElementById('open-command-palette');
    var paletteInput = document.getElementById('command-palette-input');
    var palette = document.getElementById('command-palette');
    if (paletteButton) paletteButton.addEventListener('click', function () { openPalette(); });
    if (palette) palette.addEventListener('click', function (event) {
      if (event.target === palette) closePalette();
    });
    if (paletteInput) {
      paletteInput.addEventListener('input', function () { state.paletteIndex = 0; renderCommands(); });
      paletteInput.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          state.paletteIndex = Math.min(state.paletteItems.length - 1, state.paletteIndex + 1);
          renderCommands();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          state.paletteIndex = Math.max(0, state.paletteIndex - 1);
          renderCommands();
        } else if (event.key === 'Enter' && state.paletteItems[state.paletteIndex]) {
          event.preventDefault();
          state.paletteItems[state.paletteIndex].run();
          closePalette();
        }
      });
    }
    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        var isOpen = document.getElementById('command-palette') && !document.getElementById('command-palette').hidden;
        if (isOpen) closePalette(); else openPalette();
      } else if (event.key === 'Escape') {
        closePalette();
      }
    });

    window.addEventListener('storage', function (event) {
      if ([TASKS_KEY, HABITS_KEY, TODAY_KEY, INBOX_KEY, SESSIONS_KEY].indexOf(event.key) !== -1) {
        renderInbox();
        refreshStats();
      }
    });
    window.addEventListener('focus', refreshStats);

    var current = settings();
    setContext(current.context);
    setEnergy(current.energy);
    renderDailyFocus();
    renderWeeklyWin();
    renderInbox();
    refreshStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
