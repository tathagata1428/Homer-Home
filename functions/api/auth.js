/**
 * Supabase Auth endpoint — Cloudflare Pages Function version.
 *
 * POST /api/auth
 * GET  /api/auth?action=user
 */
import { createUserClient, createAdminClient, isSupabaseClientConfigured, verifySupabaseJwt, isSupabaseConfigured, resolveSupabaseOwnerId } from '../../lib/supabase-server.js';
import { isReservedSyncHash } from '../../lib/joey-server.js';
import crypto from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function onRequest(context) {
  const { request, env } = context;
  if (env && typeof env === "object") Object.assign(process.env, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }

  if (!isSupabaseClientConfigured()) {
    return Response.json({ error: 'Supabase not configured' }, { status: 503, headers: CORS });
  }

  const { searchParams } = new URL(request.url);

  let body = {};
  if (request.method === 'POST') {
    try { body = await request.json(); } catch (e) { body = {}; }
  }

  const action = String(
    (request.method === 'GET' ? searchParams.get('action') : body.action) || ''
  ).trim();

  const authHeader = String(request.headers.get('authorization') || '');
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  try {
    // ── signIn ──────────────────────────────────────────────
    if (action === 'signIn') {
      const { email, password } = body;
      if (!email || !password) {
        return Response.json({ error: 'Missing email or password' }, { status: 400, headers: CORS });
      }
      const client = createUserClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return Response.json({ error: error.message }, { status: 401, headers: CORS });
      return Response.json({ ok: true, session: data.session, user: sanitiseUser(data.user) }, { status: 200, headers: CORS });
    }

    // ── signUp ──────────────────────────────────────────────
    if (action === 'signUp') {
      const { email, password, username } = body;
      if (!email || !password) {
        return Response.json({ error: 'Missing email or password' }, { status: 400, headers: CORS });
      }
      const client = createUserClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { username: username || email.split('@')[0] } }
      });
      if (error) return Response.json({ error: error.message }, { status: 400, headers: CORS });
      return Response.json({ ok: true, session: data.session, user: sanitiseUser(data.user) }, { status: 200, headers: CORS });
    }

    // ── signOut ─────────────────────────────────────────────
    if (action === 'signOut') {
      if (!jwtToken) return Response.json({ error: 'Missing token' }, { status: 401, headers: CORS });
      const client = createUserClient(jwtToken);
      await client.auth.signOut();
      return Response.json({ ok: true }, { status: 200, headers: CORS });
    }

    // ── refresh ─────────────────────────────────────────────
    if (action === 'refresh') {
      const { refreshToken } = body;
      if (!refreshToken) return Response.json({ error: 'Missing refreshToken' }, { status: 400, headers: CORS });
      const client = createUserClient();
      const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
      if (error) return Response.json({ error: error.message }, { status: 401, headers: CORS });
      return Response.json({ ok: true, session: data.session }, { status: 200, headers: CORS });
    }

    // ── user ─────────────────────────────────────────────────
    if (action === 'user') {
      if (!jwtToken) return Response.json({ error: 'Missing token' }, { status: 401, headers: CORS });
      const user = await verifySupabaseJwt(jwtToken);
      if (!user) return Response.json({ error: 'Invalid or expired token' }, { status: 401, headers: CORS });
      return Response.json({ ok: true, user: sanitiseUser(user) }, { status: 200, headers: CORS });
    }

    // ── resetPassword ────────────────────────────────────────
    if (action === 'resetPassword') {
      const { email } = body;
      if (!email) return Response.json({ error: 'Missing email' }, { status: 400, headers: CORS });
      const client = createUserClient();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: String(env.AUTH_REDIRECT_URL || '').trim() || undefined
      });
      if (error) return Response.json({ error: error.message }, { status: 400, headers: CORS });
      return Response.json({ ok: true }, { status: 200, headers: CORS });
    }

    // ── verifyHash — reserved hash check (no Supabase user needed) ──────────
    if (action === 'verifyHash') {
      const { hash } = body;
      if (!hash || typeof hash !== 'string') {
        return Response.json({ error: 'Missing hash' }, { status: 400, headers: CORS });
      }
      const adminHash = String(env.HOMER_ADMIN_HASH || '').trim();
      if ((adminHash && hash.trim() === adminHash) || isReservedSyncHash(hash.trim())) {
        return Response.json({ ok: true }, { status: 200, headers: CORS });
      }
      return Response.json({ error: 'Invalid credentials' }, { status: 401, headers: CORS });
    }

    // ── exchangeToken — Homer credentials → Supabase JWT (for Android) ──────
    if (action === 'exchangeToken') {
      const { username, password } = body;
      if (!username || !password) {
        return Response.json({ error: 'Missing credentials' }, { status: 400, headers: CORS });
      }
      if (!isSupabaseConfigured()) {
        return Response.json({ error: 'Supabase not configured' }, { status: 503, headers: CORS });
      }

      // Validate Homer credentials via HOMER_ADMIN_HASH (no Redis dependency)
      const adminHash = String(env.HOMER_ADMIN_HASH || '').trim();
      const passHash = crypto.createHash('sha256')
        .update(username.toLowerCase().trim() + ':' + password)
        .digest('hex');
      if (!adminHash || (passHash !== adminHash && !isReservedSyncHash(passHash))) {
        return Response.json({ error: 'Invalid credentials' }, { status: 401, headers: CORS });
      }

      // Exchange for a Supabase session.
      // Use SUPABASE_SYNC_PASSWORD env var if set; otherwise fall back to the
      // Homer password the user just proved they know.
      const syncEmail = String(env.SUPABASE_SYNC_EMAIL || 'bogdan.radu@b4it.ro').trim();
      const syncPass  = String(env.SUPABASE_SYNC_PASSWORD || password).trim();

      // Force-set the Supabase Auth password so sign-in always works,
      // even if the account was created without a password (magic-link / OAuth).
      const admin   = createAdminClient();
      const ownerId = await resolveSupabaseOwnerId();
      if (!ownerId) return Response.json({ error: 'Supabase owner not found' }, { status: 500, headers: CORS });
      await admin.auth.admin.updateUserById(ownerId, { password: syncPass });

      const client = createUserClient();
      const { data, error } = await client.auth.signInWithPassword({ email: syncEmail, password: syncPass });
      if (error) return Response.json({ error: error.message }, { status: 401, headers: CORS });

      return Response.json({
        ok: true,
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in:    data.session.expires_in,
        user_id:       data.user.id,
      }, { status: 200, headers: CORS });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400, headers: CORS });

  } catch (err) {
    console.error('[auth]', err);
    return Response.json({ error: err.message || 'Internal error' }, { status: 500, headers: CORS });
  }
}

function sanitiseUser(user) {
  if (!user) return null;
  return {
    id:         user.id,
    email:      user.email,
    username:   user.user_metadata && user.user_metadata.username,
    created_at: user.created_at
  };
}
