function text(value) {
  return String(value || '').trim();
}

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => text(item)).filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([k, v]) => text(k + (v ? ': ' + v : ''))).filter(Boolean);
  }
  return text(value) ? [text(value)] : [];
}

function bulletLines(items) {
  return (items || []).filter(Boolean).map((item) => '- ' + item);
}

function section(title, lines) {
  const clean = (lines || []).filter(Boolean);
  if (!clean.length) return '';
  return '## ' + title + '\n' + clean.join('\n') + '\n';
}

function mdSection(title, bodyLines) {
  const clean = (bodyLines || []).filter(Boolean);
  if (!clean.length) return '';
  return '## ' + title + '\n' + clean.join('\n') + '\n';
}

function compareTs(a, b) {
  return new Date(a || 0).getTime() - new Date(b || 0).getTime();
}

function recent(items, count) {
  return (items || []).slice(Math.max(0, (items || []).length - count));
}

function memoryCategory(memory) {
  return text(memory && memory.category).toLowerCase() || 'general';
}

function memorySource(memory) {
  return text(memory && memory.source) || (memory && memory.auto ? 'auto-learn' : 'manual');
}

function memoryConfidence(memory) {
  const value = Number(memory && memory.confidence);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

function withMeta(textValue, meta) {
  const bits = (meta || []).filter(Boolean);
  return bits.length ? textValue + ' [' + bits.join(' | ') + ']' : textValue;
}

function formatMemory(memory) {
  const body = text(memory && memory.text);
  if (!body) return '';
  const meta = [];
  if (memorySource(memory)) meta.push('source: ' + memorySource(memory));
  if (memoryConfidence(memory) != null) meta.push('confidence: ' + memoryConfidence(memory).toFixed(2));
  if (memory && memory.pinned) meta.push('pinned');
  return withMeta(body, meta);
}

function formatPeople(people) {
  if (!people) return [];
  if (Array.isArray(people)) {
    return people.map((person) => {
      if (!person) return '';
      if (typeof person === 'string') return person;
      const name = text(person.name || person.label || person.id);
      const rel = text(person.relationship);
      const notes = text(person.notes);
      return withMeta(name + (rel ? ' (' + rel + ')' : ''), notes ? ['notes: ' + notes] : []);
    }).filter(Boolean);
  }
  return Object.entries(people).map(([name, rel]) => text(name + (rel ? ' (' + rel + ')' : ''))).filter(Boolean);
}

function safeSlug(value, fallback) {
  const slug = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return slug || fallback || 'file';
}

function formatBytes(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
  return (value / (1024 * 1024)).toFixed(2) + ' MB';
}

function normalizeFileRecord(file) {
  const uploadedAt = text(file && (file.uploadedAt || file.ts || file.processedAt)) || new Date(0).toISOString();
  const id = text(file && file.id) || safeSlug(text(file && file.name), 'file');
  const name = text(file && file.name) || 'Untitled file';
  const driveUrl = text(file && (file.driveUrl || file.webViewLink || file.url));
  const downloadUrl = text(file && (file.downloadUrl || file.webContentLink));
  const extractedText = String(file && (file.extractedText || file.content || '') || '').trim();
  const uploadedKey = uploadedAt.replace(/[^0-9TZ]/g, '').replace(/[:.-]/g, '');
  const docKey = 'Uploads/' + uploadedKey + '--' + safeSlug(name, id) + '.md';
  return {
    id,
    name,
    mimeType: text(file && (file.mimeType || file.type)),
    size: Number(file && file.size) || 0,
    sha256: text(file && file.sha256),
    uploadedAt,
    processedAt: text(file && file.processedAt),
    driveUrl,
    downloadUrl,
    driveFileId: text(file && file.driveFileId),
    notes: text(file && file.notes),
    excerpt: text(file && file.excerpt),
    extractedText,
    docKey
  };
}

function buildFilesIndexMd(fileLibrary, generatedAt) {
  const files = Array.isArray(fileLibrary) ? fileLibrary.map(normalizeFileRecord).sort((a, b) => compareTs(a.uploadedAt, b.uploadedAt)) : [];
  const lines = fileHeader('FilesIndex.md', generatedAt, ['Uploaded files remembered for future agent use', 'Use this file to find Drive links and the matching extracted-text documents']);
  if (!files.length) {
    lines.push('_No uploaded files remembered yet._', '');
    return lines.join('\n');
  }
  lines.push('## Remembered Files');
  files.slice(-30).reverse().forEach((file) => {
    lines.push('- ' + withMeta(file.name, [
      file.mimeType ? 'type: ' + file.mimeType : '',
      file.size ? 'size: ' + formatBytes(file.size) : '',
      file.uploadedAt ? 'uploaded: ' + file.uploadedAt : '',
      file.processedAt ? 'processed: ' + file.processedAt : '',
      file.driveUrl ? 'drive: ' + file.driveUrl : ''
    ]));
    lines.push('  - Doc key: ' + file.docKey);
    if (file.downloadUrl) lines.push('  - Download: ' + file.downloadUrl);
    if (file.excerpt) lines.push('  - Excerpt: ' + file.excerpt);
  });
  lines.push('');
  return lines.join('\n').trim() + '\n';
}

function buildUploadDocs(fileLibrary, generatedAt) {
  const files = Array.isArray(fileLibrary) ? fileLibrary.map(normalizeFileRecord).sort((a, b) => compareTs(a.uploadedAt, b.uploadedAt)) : [];
  const out = {};
  files.slice(-20).forEach((file) => {
    const lines = fileHeader(file.docKey, generatedAt, ['Remembered uploaded file for agent reuse']);
    lines.push(mdSection('Metadata', bulletLines([
      'Name: ' + file.name,
      file.mimeType ? 'Type: ' + file.mimeType : '',
      file.size ? 'Size: ' + formatBytes(file.size) : '',
      file.uploadedAt ? 'Uploaded: ' + file.uploadedAt : '',
      file.processedAt ? 'Processed: ' + file.processedAt : '',
      file.sha256 ? 'SHA256: ' + file.sha256 : '',
      file.driveUrl ? 'Drive URL: ' + file.driveUrl : '',
      file.downloadUrl ? 'Download URL: ' + file.downloadUrl : '',
      file.notes ? 'Notes: ' + file.notes : ''
    ])));
    lines.push(mdSection('Excerpt', file.excerpt ? [file.excerpt] : []));
    lines.push(mdSection('Extracted Text', file.extractedText ? [file.extractedText.slice(0, 40000)] : ['_No extracted text stored._']));
    out[file.docKey] = lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  });
  return out;
}

function fileHeader(name, generatedAt, summaryLines) {
  const lines = ['# ' + name, ''];
  lines.push('> Last updated: ' + generatedAt);
  if ((summaryLines || []).length) {
    summaryLines.filter(Boolean).forEach((line) => lines.push('> ' + line));
  }
  lines.push('');
  return lines;
}

function normalizeTask(task) {
  const labels = Array.isArray(task && task.labels) ? task.labels.filter(Boolean).map((item) => text(item)).filter(Boolean) : [];
  return {
    summary: text(task && (task.summary || task.title)) || 'Untitled task',
    notes: text(task && (task.notes || task.description || task.desc)),
    due: text(task && task.due),
    priority: text(task && task.priority),
    col: text(task && (task.col || task.status || 'todo')).toLowerCase(),
    labels,
    project: text(task && task.project),
    subtasks: Array.isArray(task && task.subtasks) ? task.subtasks : []
  };
}

function taskProjectKey(task) {
  const explicit = text(task.project);
  if (explicit) return explicit;
  if (task.labels && task.labels.length) return task.labels[0];
  const summary = text(task.summary);
  if (summary.includes(':')) return text(summary.split(':')[0]);
  if (summary.includes(' - ')) return text(summary.split(' - ')[0]);
  return 'General';
}

function formatTaskLine(task) {
  return withMeta(task.summary, [
    task.col ? 'status: ' + task.col : '',
    task.priority ? 'priority: ' + task.priority : '',
    task.due ? 'due: ' + task.due : ''
  ]);
}

function formatSubtaskLine(parent, subtask) {
  const st = typeof subtask === 'string' ? { text: subtask } : (subtask || {});
  const label = text(st.text || st.summary || st.title || 'Subtask');
  return withMeta(parent.summary + ' -> ' + label, [
    st.done ? 'done' : 'open',
    text(st.due) ? 'due: ' + text(st.due) : '',
    text(st.notes || st.description || st.desc) ? 'notes: ' + text(st.notes || st.description || st.desc) : ''
  ]);
}

function formatTasks(taskSnapshot, generatedAt) {
  const tasks = Array.isArray(taskSnapshot) ? taskSnapshot.map(normalizeTask) : [];
  if (!tasks.length) {
    return fileHeader('Tasks.md', generatedAt, ['Shared task snapshot']).join('\n') + '_No task snapshot available._\n';
  }

  const lines = fileHeader('Tasks.md', generatedAt, ['Shared task snapshot']);
  tasks.forEach((task) => {
    lines.push('## ' + task.summary);
    lines.push('- Status: ' + (task.col || 'todo').toUpperCase());
    if (task.priority) lines.push('- Priority: ' + task.priority);
    if (task.due) lines.push('- Due: ' + task.due);
    if (task.project || (task.labels && task.labels.length)) {
      lines.push('- Project: ' + taskProjectKey(task));
    }
    if (task.notes) lines.push('- Notes: ' + task.notes);
    if (task.subtasks.length) {
      lines.push('- Subtasks:');
      task.subtasks.forEach((subtask) => {
        const st = typeof subtask === 'string' ? { text: subtask } : (subtask || {});
        lines.push('  - [' + (st.done ? 'x' : ' ') + '] ' + text(st.text || st.summary || st.title || 'Subtask'));
      });
    }
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}

function buildProjectsMd(tasks, generatedAt) {
  const normalized = tasks.map(normalizeTask);
  const active = normalized.filter((task) => !['done', 'archive', 'archived'].includes(task.col));
  const groups = {};
  active.forEach((task) => {
    const key = taskProjectKey(task);
    if (!groups[key]) groups[key] = [];
    groups[key].push(task);
  });
  const completed = normalized.filter((task) => ['done', 'archive', 'archived'].includes(task.col));
  const lines = fileHeader('Projects.md', generatedAt, ['PARA: active outcomes and next actions', 'Source: shared Kanban snapshot']);

  if (!active.length) {
    lines.push('_No active projects._', '');
  } else {
    Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([group, projectTasks]) => {
      lines.push('## ' + group);
      projectTasks.forEach((task) => {
        lines.push('- ' + formatTaskLine(task));
        if (task.notes) lines.push('  - Notes: ' + task.notes);
        recent(task.subtasks, 6).forEach((subtask) => lines.push('  - ' + formatSubtaskLine(task, subtask)));
      });
      lines.push('');
    });
  }

  if (completed.length) {
    lines.push('## Recently Completed');
    completed.slice(-12).forEach((task) => lines.push('- ' + formatTaskLine(task)));
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

function buildAreasMd(profile, tasks, generatedAt) {
  const normalized = tasks.map(normalizeTask);
  const activeAreas = list(profile.active_goals);
  const dueSoon = normalized.filter((task) => task.due && !['done', 'archive', 'archived'].includes(task.col)).slice(0, 8);
  const lines = fileHeader('Areas.md', generatedAt, ['PARA: ongoing responsibilities and standards']);
  lines.push(mdSection('Identity', bulletLines([
    text(profile.name) ? 'Name: ' + text(profile.name) : '',
    text(profile.nickname) ? 'Preferred name: ' + text(profile.nickname) : '',
    text(profile.location) ? 'Location: ' + text(profile.location) : '',
    text(profile.timezone) ? 'Timezone: ' + text(profile.timezone) : '',
    text(profile.profession) ? 'Profession: ' + text(profile.profession) : ''
  ])));
  lines.push(mdSection('Communication', bulletLines([
    text(profile.communication_style) ? 'Style: ' + text(profile.communication_style) : '',
    text(profile.current_mood) ? 'Current mood: ' + text(profile.current_mood) : ''
  ])));
  lines.push(mdSection('Areas To Maintain', bulletLines(activeAreas)));
  lines.push(mdSection('Upcoming Responsibilities', bulletLines(dueSoon.map((task) => formatTaskLine(task)))));
  lines.push(mdSection('Important Dates', bulletLines(list(profile.important_dates))));
  lines.push(mdSection('People Nearby', bulletLines(formatPeople(profile.people))));
  return lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function buildResourcesMd(profile, memories, generatedAt) {
  const lines = fileHeader('Resources.md', generatedAt, ['PARA: reference material, interests, notes, reusable knowledge']);
  lines.push(mdSection('Interests', bulletLines(list(profile.interests))));
  lines.push(mdSection('Languages', bulletLines(list(profile.languages))));
  lines.push(mdSection('Recent Topics', bulletLines(list(profile.recent_topics))));

  const resourceMemories = memories.filter((memory) => ['resource', 'fact', 'work', 'health', 'general'].includes(memoryCategory(memory)));
  lines.push(mdSection('Reference Notes', bulletLines(resourceMemories.slice(-25).map(formatMemory))));
  return lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function buildArchiveMd(tasks, history, memories, generatedAt) {
  const normalized = tasks.map(normalizeTask);
  const done = normalized.filter((task) => ['done', 'archive', 'archived'].includes(task.col));
  const olderHistory = history.slice(-16);
  const archivedMemories = memories.filter((memory) => {
    const category = memoryCategory(memory);
    return category === 'archive' || category === 'event';
  });
  const lines = fileHeader('Archive.md', generatedAt, ['PARA: completed or inactive material']);

  if (done.length) {
    lines.push('## Completed Work');
    done.slice(-20).forEach((task) => lines.push('- ' + formatTaskLine(task)));
    lines.push('');
  }

  if (archivedMemories.length) {
    lines.push('## Archived Notes');
    archivedMemories.slice(-20).forEach((memory) => lines.push('- ' + formatMemory(memory)));
    lines.push('');
  }

  if (olderHistory.length) {
    lines.push('## Conversation Archive');
    olderHistory.forEach((msg) => lines.push('- ' + (msg.role === 'assistant' ? 'Assistant' : 'User') + ': ' + text(msg.content).slice(0, 220)));
    lines.push('');
  }

  if (lines.length === 4) lines.push('_Nothing archived yet._', '');
  return lines.join('\n').trim() + '\n';
}

function buildWinsMd(memories, generatedAt) {
  const wins = memories.filter((memory) => memoryCategory(memory) === 'win');
  const lines = fileHeader('Wins.md', generatedAt, ['Proud moments, progress, praise, breakthroughs']);
  if (!wins.length) {
    lines.push('_No wins recorded yet._', '');
    return lines.join('\n');
  }
  lines.push('## Proud Moments');
  wins.slice(-50).forEach((memory) => lines.push('- ' + formatMemory(memory)));
  lines.push('');
  return lines.join('\n').trim() + '\n';
}

function buildLessonsMd(memories, generatedAt) {
  const lessons = memories.filter((memory) => {
    const category = memoryCategory(memory);
    return category === 'lesson' || category === 'event';
  });
  const lines = fileHeader('Lessons.md', generatedAt, ['Hard-earned lessons and painful corrections']);
  if (!lessons.length) {
    lines.push('_No lessons recorded yet._', '');
    return lines.join('\n');
  }
  lines.push('## Hard-Learned Lessons');
  lessons.slice(-50).forEach((memory) => lines.push('- ' + formatMemory(memory)));
  lines.push('');
  return lines.join('\n').trim() + '\n';
}

function buildOpenLoopsMd(tasks, generatedAt) {
  const normalized = tasks.map(normalizeTask);
  const active = normalized.filter((task) => !['done', 'archive', 'archived'].includes(task.col));
  const loops = [];
  active.forEach((task) => {
    loops.push(formatTaskLine(task));
    task.subtasks.filter((subtask) => !(subtask && subtask.done)).slice(0, 4).forEach((subtask) => {
      loops.push(formatSubtaskLine(task, subtask));
    });
  });
  const lines = fileHeader('OpenLoops.md', generatedAt, ['Unfinished commitments and unresolved next steps']);
  if (!loops.length) {
    lines.push('_No open loops detected._', '');
    return lines.join('\n');
  }
  lines.push('## Open Loops');
  loops.slice(0, 40).forEach((line) => lines.push('- ' + line));
  lines.push('');
  return lines.join('\n').trim() + '\n';
}

function buildPeopleMd(profile, memories, generatedAt) {
  const personMemories = memories.filter((memory) => memoryCategory(memory) === 'person');
  const lines = fileHeader('People.md', generatedAt, ['Important people, relationships, and recurring context']);
  lines.push(mdSection('Known People', bulletLines(formatPeople(profile.people))));
  lines.push(mdSection('Relationship Notes', bulletLines(personMemories.slice(-40).map(formatMemory))));
  return lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function buildTodayMd(profile, tasks, history, generatedAt) {
  const normalized = tasks.map(normalizeTask);
  const active = normalized.filter((task) => !['done', 'archive', 'archived'].includes(task.col));
  const dueSoon = active.filter((task) => task.due).slice(0, 6);
  const focus = active.slice(0, 5);
  const recentPromises = history.filter((msg) => msg.role === 'user').slice(-4).map((msg) => text(msg.content).slice(0, 180));
  const lines = fileHeader('Today.md', generatedAt, ['Short operational view for the current day']);
  lines.push(mdSection('Current Focus', bulletLines(focus.map((task) => formatTaskLine(task)))));
  lines.push(mdSection('Due Soon', bulletLines(dueSoon.map((task) => formatTaskLine(task)))));
  lines.push(mdSection('User Stated Priorities', bulletLines(recentPromises)));
  lines.push(mdSection('Operating Context', bulletLines([
    text(profile.current_mood) ? 'Mood: ' + text(profile.current_mood) : '',
    text(profile.communication_style) ? 'Best response style: ' + text(profile.communication_style) : '',
    text(profile.timezone) ? 'Timezone: ' + text(profile.timezone) : ''
  ])));
  return lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function buildWeeklyReviewMd(tasks, memories, history, generatedAt) {
  const normalized = tasks.map(normalizeTask);
  const done = normalized.filter((task) => ['done', 'archive', 'archived'].includes(task.col)).slice(-10);
  const wins = memories.filter((memory) => memoryCategory(memory) === 'win').slice(-8);
  const lessons = memories.filter((memory) => memoryCategory(memory) === 'lesson').slice(-8);
  const recentTopics = history.filter((msg) => msg.role === 'user').slice(-6).map((msg) => text(msg.content).slice(0, 140));
  const lines = fileHeader('WeeklyReview.md', generatedAt, ['Review artifact: wins, lessons, completed work, and next priorities']);
  lines.push(mdSection('Wins', bulletLines(wins.map(formatMemory))));
  lines.push(mdSection('Lessons', bulletLines(lessons.map(formatMemory))));
  lines.push(mdSection('Completed Work', bulletLines(done.map((task) => formatTaskLine(task)))));
  lines.push(mdSection('Themes From Conversation', bulletLines(recentTopics)));
  lines.push(mdSection('Suggested Next Priorities', bulletLines(
    normalized.filter((task) => !['done', 'archive', 'archived'].includes(task.col)).slice(0, 5).map((task) => formatTaskLine(task))
  )));
  return lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function buildDecisionsMd(memories, generatedAt) {
  const decisions = memories.filter((memory) => memoryCategory(memory) === 'decision');
  const lines = fileHeader('Decisions.md', generatedAt, ['Decision log: what changed and why it matters']);
  if (!decisions.length) {
    lines.push('_No decisions recorded yet._', '');
    return lines.join('\n');
  }
  lines.push('## Decisions');
  decisions.slice(-40).forEach((memory) => lines.push('- ' + formatMemory(memory)));
  lines.push('');
  return lines.join('\n').trim() + '\n';
}

function buildPinnedContextMd(memories, generatedAt) {
  const pinned = memories.filter((memory) => memoryCategory(memory) === 'pin' || memory.pinned);
  const lines = fileHeader('PinnedContext.md', generatedAt, ['Always-relevant context the agent should bias toward']);
  if (!pinned.length) {
    lines.push('_No pinned context yet._', '');
    return lines.join('\n');
  }
  lines.push('## Pinned Context');
  pinned.slice(-40).forEach((memory) => lines.push('- ' + formatMemory(memory)));
  lines.push('');
  return lines.join('\n').trim() + '\n';
}

function buildAgentContextMd(profile, memories, history, tasks, fileLibrary, generatedAt, scope) {
  const workScope = text(scope).toLowerCase() === 'work';
  const normalizedTasks = tasks.map(normalizeTask);
  const activeTasks = normalizedTasks.filter((task) => !['done', 'archive', 'archived'].includes(task.col)).slice(0, 8);
  const openLoops = [];
  activeTasks.forEach((task) => {
    openLoops.push(formatTaskLine(task));
    task.subtasks.filter((subtask) => !(subtask && subtask.done)).slice(0, 2).forEach((subtask) => {
      openLoops.push(formatSubtaskLine(task, subtask));
    });
  });

  const wins = memories.filter((memory) => memoryCategory(memory) === 'win').slice(-5).map(formatMemory);
  const lessons = memories.filter((memory) => memoryCategory(memory) === 'lesson').slice(-6).map(formatMemory);
  const decisions = memories.filter((memory) => memoryCategory(memory) === 'decision').slice(-5).map(formatMemory);
  const pinned = memories.filter((memory) => memoryCategory(memory) === 'pin' || memory.pinned).slice(-6).map(formatMemory);
  const preferences = memories
    .filter((memory) => {
      const category = memoryCategory(memory);
      return category === 'preference' || category === 'habit' || category === 'routine' || category === 'opinion';
    })
    .slice(-8)
    .map(formatMemory);
  const recentHistory = history.slice(-6).map((msg) => {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    return role + ': ' + text(msg.content).slice(0, 180);
  });
  const recentFiles = (Array.isArray(fileLibrary) ? fileLibrary : [])
    .map(normalizeFileRecord)
    .sort((a, b) => compareTs(a.uploadedAt, b.uploadedAt))
    .slice(-5)
    .reverse()
    .map((file) => withMeta(file.name, [
      file.uploadedAt ? 'uploaded: ' + file.uploadedAt : '',
      file.driveUrl ? 'drive: ' + file.driveUrl : '',
      'doc: ' + file.docKey
    ]));

  const lines = fileHeader(
    'AgentContext.md',
    generatedAt,
    workScope
      ? ['Compact work operating context for Joey Work', 'Bias toward tasks, deadlines, blockers, decisions, and follow-ups']
      : ['Compact operational context for Joey and Joey Nemo', 'Read this first before deeper PARA files']
  );
  lines.push(mdSection('Current Focus', bulletLines(activeTasks.map((task) => formatTaskLine(task)))));
  lines.push(mdSection('Open Loops', bulletLines(openLoops)));
  if (workScope) {
    lines.push(mdSection('Work Priorities', bulletLines(
      normalizedTasks
        .filter((task) => !['done', 'archive', 'archived'].includes(task.col))
        .slice(0, 10)
        .map((task) => formatTaskLine(task))
    )));
  }
  lines.push(mdSection('Pinned Context', bulletLines(pinned)));
  lines.push(mdSection('People', bulletLines(formatPeople(profile.people))));
  lines.push(mdSection('Preferences', bulletLines(preferences)));
  lines.push(mdSection('Goals', bulletLines(list(profile.active_goals))));
  lines.push(mdSection('Constraints', bulletLines([
    text(profile.communication_style) ? 'Communication style: ' + text(profile.communication_style) : '',
    text(profile.current_mood) ? 'Current mood: ' + text(profile.current_mood) : '',
    text(profile.location) ? 'Location: ' + text(profile.location) : '',
    text(profile.timezone) ? 'Timezone: ' + text(profile.timezone) : ''
  ])));
  lines.push(mdSection('Recent Wins', bulletLines(wins)));
  lines.push(mdSection('Lessons', bulletLines(lessons)));
  lines.push(mdSection('Decisions', bulletLines(decisions)));
  lines.push(mdSection('Remembered Files', bulletLines(recentFiles)));
  lines.push(mdSection('Recent Conversation Summary', bulletLines(recentHistory)));
  return lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const SYSTEM_FILE_NAMES = new Set([
  'AgentContext.md', 'Projects.md', 'Areas.md', 'Resources.md', 'Archive.md',
  'Wins.md', 'Lessons.md', 'OpenLoops.md', 'People.md', 'Today.md',
  'WeeklyReview.md', 'Decisions.md', 'PinnedContext.md', 'FilesIndex.md',
  'User.md', 'Memory.md', 'Tasks.md', 'HistorySummary.md'
]);

export function buildContextFiles(data) {
  const profile = data && data.profile && typeof data.profile === 'object' ? data.profile : {};
  const memories = Array.isArray(data && data.memories) ? [...data.memories].sort((a, b) => compareTs(a.ts, b.ts)) : [];
  const history = Array.isArray(data && data.history) ? data.history : [];
  const tasks = Array.isArray(data && data.tasks) ? data.tasks : [];
  const fileLibrary = Array.isArray(data && data.fileLibrary) ? data.fileLibrary : [];
  const scope = text(data && data.scope).toLowerCase() === 'work' ? 'work' : 'personal';
  const rawCustomFiles = (data && data.customFiles && typeof data.customFiles === 'object') ? data.customFiles : {};
  const customFileEntries = {};
  for (const [name, content] of Object.entries(rawCustomFiles)) {
    const safeName = String(name || '').trim();
    if (safeName && !SYSTEM_FILE_NAMES.has(safeName) && !/^Uploads\//i.test(safeName) && typeof content === 'string' && content.trim()) {
      customFileEntries[safeName] = content.trim();
    }
  }
  const generatedAt = new Date().toISOString();

  const userLines = fileHeader('User.md', generatedAt, ['Legacy compatibility profile file']);
  userLines.push(section('Identity', bulletLines([
    text(profile.name) ? 'Name: ' + text(profile.name) : '',
    text(profile.nickname) ? 'Preferred name: ' + text(profile.nickname) : '',
    text(profile.location) ? 'Location: ' + text(profile.location) : '',
    text(profile.timezone) ? 'Timezone: ' + text(profile.timezone) : '',
    text(profile.profession) ? 'Profession: ' + text(profile.profession) : ''
  ])));
  userLines.push(section('Style', bulletLines([
    text(profile.communication_style) ? 'Communication style: ' + text(profile.communication_style) : '',
    text(profile.current_mood) ? 'Current mood: ' + text(profile.current_mood) : '',
    ...list(profile.languages).map((item) => 'Language: ' + item)
  ])));
  userLines.push(section('Interests', bulletLines(list(profile.interests))));
  userLines.push(section('People', bulletLines(formatPeople(profile.people))));
  userLines.push(section('Goals', bulletLines(list(profile.active_goals))));
  userLines.push(section('Important Dates', bulletLines(list(profile.important_dates))));
  userLines.push(section('Recent Topics', bulletLines(list(profile.recent_topics))));
  const userMd = userLines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';

  const memoryLines = fileHeader('Memory.md', generatedAt, ['Legacy compatibility memory file']);
  if (memories.length) {
    const groups = {};
    memories.forEach((memory) => {
      const category = memoryCategory(memory);
      if (!groups[category]) groups[category] = [];
      groups[category].push(formatMemory(memory));
    });
    Object.entries(groups).forEach(([category, items]) => {
      memoryLines.push('## ' + category.charAt(0).toUpperCase() + category.slice(1));
      bulletLines(items).forEach((line) => memoryLines.push(line));
      memoryLines.push('');
    });
  } else {
    memoryLines.push('_No stored memories._', '');
  }
  const memoryMd = memoryLines.join('\n').trim() + '\n';

  const recentTurns = history.slice(-20);
  const summaryLines = fileHeader('HistorySummary.md', generatedAt, ['Legacy compatibility conversation summary']);
  if (recentTurns.length) {
    recentTurns.forEach((msg) => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      summaryLines.push('## ' + role);
      summaryLines.push(text(msg.content || '').slice(0, 1200));
      summaryLines.push('');
    });
  } else {
    summaryLines.push('_No recent history available._', '');
  }
  const historySummaryMd = summaryLines.join('\n').trim() + '\n';

  return {
    'AgentContext.md': buildAgentContextMd(profile, memories, history, tasks, fileLibrary, generatedAt, scope),
    'Projects.md': buildProjectsMd(tasks, generatedAt),
    'Areas.md': buildAreasMd(profile, tasks, generatedAt),
    'Resources.md': buildResourcesMd(profile, memories, generatedAt),
    'Archive.md': buildArchiveMd(tasks, history, memories, generatedAt),
    'Wins.md': buildWinsMd(memories, generatedAt),
    'Lessons.md': buildLessonsMd(memories, generatedAt),
    'OpenLoops.md': buildOpenLoopsMd(tasks, generatedAt),
    'People.md': buildPeopleMd(profile, memories, generatedAt),
    'Today.md': buildTodayMd(profile, tasks, history, generatedAt),
    'WeeklyReview.md': buildWeeklyReviewMd(tasks, memories, history, generatedAt),
    'Decisions.md': buildDecisionsMd(memories, generatedAt),
    'PinnedContext.md': buildPinnedContextMd(memories, generatedAt),
    'FilesIndex.md': buildFilesIndexMd(fileLibrary, generatedAt),
    'User.md': userMd,
    'Memory.md': memoryMd,
    'Tasks.md': formatTasks(tasks, generatedAt),
    'HistorySummary.md': historySummaryMd,
    ...buildUploadDocs(fileLibrary, generatedAt),
    ...customFileEntries
  };
}
