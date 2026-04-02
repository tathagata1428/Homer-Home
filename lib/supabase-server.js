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
    process.env.SUPABASE_SERVICE_ROLE_KEY
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
  if (!accessToken || !isSupabaseConfigured()) return null;
  try {
    const admin = createAdminClient();
    const { data: { user }, error } = await admin.auth.getUser(accessToken);
    if (error || !user) return null;
    return user;
  } catch (_err) {
    return null;
  }
}
