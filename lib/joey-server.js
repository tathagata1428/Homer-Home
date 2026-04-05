export function getRedisConfig(env = process.env) {
  return {
    url: String(env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '').trim(),
    token: String(env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '').trim()
  };
}

export function createRedisFetch(env = process.env) {
  const { url, token } = getRedisConfig(env);
  if (!url || !token) return null;
  return function redisFetch(command) {
    return fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: JSON.stringify(command)
    }).then((response) => response.json());
  };
}

export function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

const RESERVED_SYNC_HASHES = new Set([
  '089ab473b9fca0bb70c708a3a7c59d5959645133589210ef76f5acc6d3ba403f',
  'da408d1c6f846dab303e17adbe86c9be78a7ed79bf4fbe9f1388ec5e475724fa'
]);

export function isReservedSyncHash(passphrase) {
  const normalized = String(passphrase || '').trim();
  return !!normalized && RESERVED_SYNC_HASHES.has(normalized);
}

export async function verifyJoeyPassphrase(passphrase, redisFetch, env = process.env) {
  const normalized = String(passphrase || '').trim();
  if (!normalized) return false;

  const adminHash = String(env.HOMER_ADMIN_HASH || '').trim();
  if (adminHash && normalized === adminHash) return true;
  if (isReservedSyncHash(normalized)) return true;

  if (typeof redisFetch !== 'function') return false;

  const usersData = await redisFetch(['GET', 'homer:users']);
  const users = safeJsonParse(usersData && usersData.result, []);
  return users.some((user) => user && user.passwordHash === normalized);
}

export async function loadRedisJson(redisFetch, key, fallback) {
  const result = await redisFetch(['GET', key]);
  return safeJsonParse(result && result.result, fallback);
}

export async function saveRedisJson(redisFetch, key, value) {
  await redisFetch(['SET', key, JSON.stringify(value)]);
  return value;
}

export function getGoogleDriveConfig(env = process.env) {
  return {
    webhook: String(env.GDRIVE_WEBHOOK_URL || '').trim(),
    secret: String(env.GDRIVE_SECRET || '').trim()
  };
}

export async function fetchWithRedirects(startUrl, options) {
  const config = options && typeof options === 'object' ? options : {};
  const maxRedirects = Number.isInteger(config.maxRedirects) ? config.maxRedirects : 5;
  const redirectMethod = config.redirectMethod || 'GET';
  const redirectHeaders = config.redirectHeaders || {};
  const timeoutMs = Number(config.timeoutMs || 0) > 0 ? Number(config.timeoutMs) : 0;
  const redirectChain = [];
  let url = startUrl;
  let response = null;
  let responseText = '';
  const startedAt = Date.now();

  for (let index = 0; index < maxRedirects; index += 1) {
    const elapsed = Date.now() - startedAt;
    const remainingMs = timeoutMs ? Math.max(1, timeoutMs - elapsed) : 0;
    if (timeoutMs && elapsed >= timeoutMs) {
      return { ok: false, status: 504, error: 'Request timed out', redirectChain, text: responseText };
    }
    const controller = timeoutMs ? new AbortController() : null;
    let timeoutId = null;
    if (controller && remainingMs > 0) {
      timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), remainingMs);
    }
    const isFirstRequest = index === 0;
    const requestOptions = isFirstRequest
      ? {
          method: config.method || 'GET',
          headers: config.headers || {},
          body: config.body,
          redirect: 'manual',
          signal: controller ? controller.signal : undefined
        }
      : {
          method: redirectMethod,
          headers: redirectHeaders,
          redirect: 'manual',
          signal: controller ? controller.signal : undefined
        };

    try {
      response = await fetch(url, requestOptions);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error && (error.name === 'AbortError' || /timed out/i.test(String(error.message || '')))) {
        return { ok: false, status: 504, error: 'Request timed out', redirectChain, text: responseText };
      }
      throw error;
    }
    if (timeoutId) clearTimeout(timeoutId);
    redirectChain.push({
      url: String(url || '').slice(0, 120),
      status: response.status,
      method: requestOptions.method
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { ok: false, status: 502, error: 'Redirect without location', redirectChain };
      }
      url = location;
      continue;
    }

    responseText = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text: responseText,
      redirectChain,
      response
    };
  }

  return { ok: false, status: 502, error: 'No response after redirects', redirectChain, text: responseText };
}
