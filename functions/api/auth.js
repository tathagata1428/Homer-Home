/**
 * Supabase Auth endpoint — Cloudflare Pages Function version.
 *
 * POST /api/auth
 * GET  /api/auth?action=user
 */
import { createUserClient, isSupabaseClientConfigured, verifySupabaseJwt } from '../../lib/supabase-server.js';

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
