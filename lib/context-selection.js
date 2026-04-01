function text(value) {
  return String(value || '').trim();
}

function normalizeQuery(query) {
  return text(query).toLowerCase();
}

function includesAny(query, patterns) {
  return patterns.some((pattern) => query.includes(pattern));
}

const FIXED_FILE_NAMES = new Set([
  'AgentContext.md', 'Today.md', 'OpenLoops.md', 'PinnedContext.md', 'FilesIndex.md',
  'Quotes.md',
  'Projects.md', 'Areas.md', 'People.md', 'Resources.md', 'Wins.md', 'Lessons.md',
  'WeeklyReview.md', 'Decisions.md', 'Archive.md', 'User.md', 'Memory.md',
  'Tasks.md', 'HistorySummary.md'
]);

export function selectContextFiles(files, query, options) {
  const bundle = files && typeof files === 'object' ? files : {};
  const q = normalizeQuery(query);
  const deep = !!(options && options.deep);
  const largeContext = !!(options && options.largeContext);
  const work = !!(options && options.work);
  const personal = options && options.personal !== false;
  const uploadKeys = Object.keys(bundle).filter((name) => /^Uploads\//.test(name)).sort().reverse();
  const customKeys = Object.keys(bundle).filter((name) => !FIXED_FILE_NAMES.has(name) && !/^Uploads\//i.test(name));
  const fileIntent = includesAny(q, ['file', 'files', 'upload', 'uploads', 'document', 'documents', 'pdf', 'drive', 'link', 'attachment', 'attached', 'doc']);
  const matchedUploads = uploadKeys.filter((name) => {
    if (!q) return false;
    const haystack = normalizeQuery(name + '\n' + String(bundle[name] || '').slice(0, 1200));
    return q.split(/\s+/).filter((token) => token.length >= 4).some((token) => haystack.includes(token));
  });

  const always = work
    ? ['AgentContext.md', 'Today.md', 'OpenLoops.md', 'PinnedContext.md', 'Projects.md', 'Tasks.md', 'Decisions.md', 'WeeklyReview.md', 'FilesIndex.md']
    : (largeContext
      ? ['AgentContext.md', 'Today.md', 'OpenLoops.md', 'PinnedContext.md', 'Projects.md', 'Areas.md', 'People.md', 'Wins.md', 'Lessons.md', 'Decisions.md', 'Tasks.md', 'FilesIndex.md']
      : ['AgentContext.md', 'Today.md', 'OpenLoops.md', 'PinnedContext.md']);
  const selected = new Set(always.filter((name) => bundle[name]));

  if (largeContext) {
    ['Quotes.md', 'Resources.md', 'WeeklyReview.md', 'User.md', 'Memory.md'].forEach((name) => bundle[name] && selected.add(name));
  }

  if (deep) {
    Object.keys(bundle).forEach((name) => selected.add(name));
  } else {
    if (work) {
      ['Projects.md', 'Tasks.md', 'Decisions.md', 'WeeklyReview.md', 'Resources.md', 'FilesIndex.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (personal) {
      ['Quotes.md', 'User.md', 'Memory.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (includesAny(q, ['task', 'project', 'board', 'todo', 'kanban', 'deadline', 'deliver', 'ship'])) {
      ['Projects.md', 'OpenLoops.md', 'Tasks.md', 'WeeklyReview.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (includesAny(q, ['people', 'person', 'friend', 'wife', 'girlfriend', 'boyfriend', 'mom', 'dad', 'family', 'team', 'client'])) {
      ['People.md', 'Areas.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (includesAny(q, ['learn', 'lesson', 'mistake', 'regret', 'bad', 'pain', 'hard'])) {
      ['Lessons.md', 'WeeklyReview.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (includesAny(q, ['win', 'proud', 'good', 'success', 'achievement', 'nice', 'great'])) {
      ['Wins.md', 'WeeklyReview.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (includesAny(q, ['resource', 'reference', 'note', 'how to', 'research', 'docs', 'document'])) {
      ['Resources.md', 'Archive.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (includesAny(q, ['quote', 'quotes', 'stoic', 'wisdom', 'philosophy', 'philosophical', 'mantra', 'motto', 'inspiration', 'inspire'])) {
      bundle['Quotes.md'] && selected.add('Quotes.md');
      ['Resources.md', 'PinnedContext.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (fileIntent) {
      ['FilesIndex.md', 'Resources.md'].forEach((name) => bundle[name] && selected.add(name));
      matchedUploads.slice(0, 4).forEach((name) => selected.add(name));
      if (!matchedUploads.length) uploadKeys.slice(0, 2).forEach((name) => selected.add(name));
    }
    if (includesAny(q, ['decide', 'decision', 'chose', 'choose', 'policy', 'rule'])) {
      ['Decisions.md', 'PinnedContext.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (includesAny(q, ['review', 'weekly', 'recap', 'summary'])) {
      ['WeeklyReview.md', 'Archive.md', 'Projects.md'].forEach((name) => bundle[name] && selected.add(name));
    }
    if (includesAny(q, ['archive', 'old', 'history', 'past', 'previous'])) {
      ['Archive.md', 'HistorySummary.md'].forEach((name) => bundle[name] && selected.add(name));
    }
  }

  // Custom files: include all in deep/large-context mode, or match by name/content
  customKeys.forEach((name) => {
    if (deep || largeContext) {
      selected.add(name);
    } else {
      const haystack = normalizeQuery(name + ' ' + String(bundle[name] || '').slice(0, 800));
      const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
      if (!tokens.length || tokens.some((t) => haystack.includes(t))) selected.add(name);
    }
  });

  const ordered = [
    'AgentContext.md',
    'Today.md',
    'OpenLoops.md',
    'PinnedContext.md',
    'Quotes.md',
    'FilesIndex.md',
    'Projects.md',
    'Areas.md',
    'People.md',
    'Resources.md',
    'Wins.md',
    'Lessons.md',
    'WeeklyReview.md',
    'Decisions.md',
    'Archive.md',
    'User.md',
    'Memory.md',
    'Tasks.md',
    'HistorySummary.md'
  ].concat(uploadKeys);

  return ordered
    .concat(customKeys)
    .filter((name) => selected.has(name) && bundle[name])
    .map((name) => '# ' + name + '\n' + String(bundle[name] || '').trim());
}
