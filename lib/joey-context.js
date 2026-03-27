function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeJoeyMode(value) {
  return normalizeText(value) === 'work' ? 'work' : 'personal';
}

export function getJoeyMode(req) {
  if (!req || typeof req !== 'object') return 'personal';
  const source = req.method === 'GET' ? req.query : req.body;
  return normalizeJoeyMode(source && source.mode);
}

export function getJoeyContextKeys(mode) {
  const normalized = normalizeJoeyMode(mode);
  const prefix = normalized === 'work' ? 'joey:work' : 'joey';
  return {
    mode: normalized,
    prefix,
    MEMORY_KEY: prefix + ':memories',
    HISTORY_KEY: prefix + ':history',
    PROFILE_KEY: prefix + ':profile',
    FILES_KEY: prefix + ':context_files',
    FILE_LIBRARY_KEY: prefix + ':file_library',
    CUSTOM_FILES_KEY: prefix + ':custom_files'
  };
}

export function getJoeyContextEnv(mode, env) {
  const vars = env && typeof env === 'object' ? env : process.env;
  if (normalizeJoeyMode(mode) === 'work') return '';
  return String(vars.JOEY_CONTEXT || '').trim();
}

export function getJoeyModeLabel(mode) {
  return normalizeJoeyMode(mode) === 'work' ? 'Work' : 'Personal';
}
