/**
 * Auth endpoint — Cloudflare Pages Function.
 *
 * Homer has one owner account. Credentials are the Homer username + password,
 * checked as sha256(lower(username) + ':' + password) against HOMER_ADMIN_HASH
 * (or a reserved sync hash). A valid login gets a signed session from lib/db.js.
 *
 * POST /api/auth { action: 'signIn' | 'exchangeToken', username, password }
 * POST /api/auth { action: 'refresh', refreshToken }
 * POST /api/auth { action: 'verifyHash', hash }
 * POST /api/auth { action: 'signOut' }            (stateless; client drops tokens)
 * GET  /api/auth?action=user                      (Authorization: Bearer <token>)
 */
import { issueSession, refreshSession, verifySessionToken, resolveOwnerId, ownerEmail, isDbConfigured } from '../../lib/db.js';
import { isReservedSyncHash } from '../../lib/joey-server.js';
import crypto from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

function isValidHash(hash, env) {
  const adminHash = String(env.HOMER_ADMIN_HASH || '').trim();
  const h = String(hash || '').trim();
  return !!h && ((adminHash && h === adminHash) || isReservedSyncHash(h));
}

export async function onRequest(context) {
  const { request, env } = context;
  if (env && typeof env === "object") Object.assign(process.env, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
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
    // ── verifyHash — reserved hash check (no session issued) ──
    if (action === 'verifyHash') {
      if (!body.hash || typeof body.hash !== 'string') return json({ error: 'Missing hash' }, 400);
      return isValidHash(body.hash, env) ? json({ ok: true }) : json({ error: 'Invalid credentials' }, 401);
    }

    // ── signIn / exchangeToken — Homer credentials → session ──
    // exchangeToken keeps the flat response shape the Android app expects.
    if (action === 'signIn' || action === 'exchangeToken') {
      const { username, password } = body;
      if (!username || !password) return json({ error: 'Missing credentials' }, 400);
      if (!isDbConfigured()) return json({ error: 'Database not configured' }, 503);

      const passHash = crypto.createHash('sha256')
        .update(String(username).toLowerCase().trim() + ':' + password)
        .digest('hex');
      if (!isValidHash(passHash, env)) return json({ error: 'Invalid credentials' }, 401);

      const ownerId = await resolveOwnerId();
      if (!ownerId) return json({ error: 'Owner account not found — run db/schema.sql and insert the users row' }, 500);
      const session = await issueSession({ id: ownerId, email: ownerEmail() });

      if (action === 'exchangeToken') {
        return json({
          ok: true,
          access_token:  session.access_token,
          refresh_token: session.refresh_token,
          expires_in:    session.expires_in,
          user_id:       ownerId
        });
      }
      return json({ ok: true, session, user: session.user });
    }

    // ── refresh ─────────────────────────────────────────────
    if (action === 'refresh') {
      if (!body.refreshToken) return json({ error: 'Missing refreshToken' }, 400);
      const session = await refreshSession(body.refreshToken);
      return session ? json({ ok: true, session }) : json({ error: 'Invalid or expired refresh token' }, 401);
    }

    // ── user ────────────────────────────────────────────────
    if (action === 'user') {
      if (!jwtToken) return json({ error: 'Missing token' }, 401);
      const user = await verifySessionToken(jwtToken);
      return user ? json({ ok: true, user }) : json({ error: 'Invalid or expired token' }, 401);
    }

    // ── signOut — tokens are stateless; the client discards them ──
    if (action === 'signOut') return json({ ok: true });

    return json({ error: 'Unknown action' }, 400);

  } catch (err) {
    console.error('[auth]', err);
    return json({ error: err.message || 'Internal error' }, 500);
  }
}
