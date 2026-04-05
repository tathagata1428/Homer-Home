/**
 * Supabase server-side client factory.
 *
 * Two clients are exported:
 *   createAdminClient()      — service-role key, bypasses RLS, for API routes
 *   createUserClient(token)  — anon key + user JWT, respects RLS
 *
 * Requires env vars:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';

const RESERVED_SYNC_EMAIL = 'bogdan.radu@b4it.ro';
let cachedOwnerId = '';

function getEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error('Missing env var: ' + name);
  return value;
}

/**
 * Returns true when all required Supabase env vars are present.
 */
export function isSupabaseConfigured() {
  return !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Returns true when the public Supabase client can be used.
 * This is enough for browser sign-in flows and JWT validation.
 */
export function isSupabaseClientConfigured() {
  return !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY
  );
}

/**
 * Service-role client — use only on the server side.
 * Bypasses Row Level Security.  Never expose to the browser.
 */
export function createAdminClient() {
  return createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

/**
 * User-scoped client.  Pass the Supabase JWT obtained from the browser.
 * Respects Row Level Security policies.
 */
export function createUserClient(accessToken) {
  const client = createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: accessToken
          ? { Authorization: 'Bearer ' + accessToken }
          : {}
      }
    }
  );
  return client;
}

/**
 * Verify a Supabase JWT and return the user object.
 * Returns null if the token is invalid or expired.
 */
export async function verifySupabaseJwt(accessToken) {
  if (!accessToken || !isSupabaseClientConfigured()) return null;
  try {
    const client = createUserClient();
    const { data: { user }, error } = await client.auth.getUser(accessToken);
    if (error || !user) return null;
    return user;
  } catch (_err) {
    return null;
  }
}

export async function resolveSupabaseOwnerId() {
  const explicit = String(process.env.SUPABASE_OWNER_ID || '').trim();
  if (explicit) return explicit;
  if (cachedOwnerId) return cachedOwnerId;
  if (!isSupabaseConfigured()) return '';
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return '';
    const users = Array.isArray(data && data.users) ? data.users : [];
    const match = users.find((user) => String(user && user.email || '').trim().toLowerCase() === RESERVED_SYNC_EMAIL);
    cachedOwnerId = match && match.id ? String(match.id).trim() : '';
    return cachedOwnerId;
  } catch (_err) {
    return '';
  }
}
