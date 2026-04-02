/**
 * Supabase Auth endpoint.
 *
 * POST /api/auth
 *
 * Actions
 * ───────
 *   signIn   { email, password }                → { ok, session, user }
 *   signUp   { email, password, username? }     → { ok, session?, user }
 *   signOut  { }   (requires Authorization: Bearer <token>)  → { ok }
 *   refresh  { refreshToken }                   → { ok, session }
 *   user     { }   (requires Authorization: Bearer <token>)  → { ok, user }
 *   resetPassword { email }                     → { ok }
 *
 * GET /api/auth?action=user   (requires Authorization: Bearer <token>)
 */
import { createAdminClient, createUserClient, isSupabaseConfigured, verifySupabaseJwt } from '../lib/supabase-server.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function setHeaders(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const body   = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const action = String(
    (req.method === 'GET' ? req.query && req.query.action : body.action) || ''
  ).trim();

  const authHeader = String(req.headers.authorization || '');
  const jwtToken   = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  try {
    // ── signIn ──────────────────────────────────────────────
    if (action === 'signIn') {
      const { email, password } = body;
      if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

      const client = createUserClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return res.status(401).json({ error: error.message });

      return res.status(200).json({
        ok:      true,
        session: data.session,
        user:    sanitiseUser(data.user)
      });
    }

    // ── signUp ──────────────────────────────────────────────
    if (action === 'signUp') {
      const { email, password, username } = body;
      if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

      const client = createUserClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { username: username || email.split('@')[0] } }
      });
      if (error) return res.status(400).json({ error: error.message });

      return res.status(200).json({
        ok:      true,
        session: data.session,
        user:    sanitiseUser(data.user)
      });
    }

    // ── signOut ─────────────────────────────────────────────
    if (action === 'signOut') {
      if (!jwtToken) return res.status(401).json({ error: 'Missing token' });
      const client = createUserClient(jwtToken);
      await client.auth.signOut();
      return res.status(200).json({ ok: true });
    }

    // ── refresh ─────────────────────────────────────────────
    if (action === 'refresh') {
      const { refreshToken } = body;
      if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });

      const client = createUserClient();
      const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
      if (error) return res.status(401).json({ error: error.message });

      return res.status(200).json({ ok: true, session: data.session });
    }

    // ── user ─────────────────────────────────────────────────
    if (action === 'user') {
      if (!jwtToken) return res.status(401).json({ error: 'Missing token' });
      const user = await verifySupabaseJwt(jwtToken);
      if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
      return res.status(200).json({ ok: true, user: sanitiseUser(user) });
    }

    // ── resetPassword ────────────────────────────────────────
    if (action === 'resetPassword') {
      const { email } = body;
      if (!email) return res.status(400).json({ error: 'Missing email' });

      const client = createUserClient();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: String(process.env.AUTH_REDIRECT_URL || '').trim() || undefined
      });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('[auth]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
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
