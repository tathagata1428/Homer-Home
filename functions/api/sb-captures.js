/**
 * POST /api/sb-captures — Inbox ⇄ secondbrain Captures, for the Inbox panel
 * (assets/homer-sb-captures.v20261022a.js).
 *
 * The inbox itself travels like every bridged field (ls:homer-inbox, see
 * lib/hub-bridge.js). This adds what the blob can't carry or can't wait for:
 *
 *   { action: 'refresh' }                       pull the hub now (not throttled) → { value }, the rebuilt inbox
 *   { action: 'image-get', id }                 → { image } (null when the capture has none)
 *   { action: 'image-put', id, image|null }     set/remove the picture → { ok } | 409 { notYet } before the item reached the hub
 *   { action: 'delete', ids }                   delete these items' captures (the inbox field never deletes by omission)
 *
 * Auth: Authorization: Bearer <access_token from /api/auth>, owner only (the
 * hub is reached as Homer's device, HUB_TOKEN, so these are the owner's).
 * Called only on Sync and to show a picture; nothing here runs on its own.
 */
import { verifySessionToken, resolveOwnerId } from '../../lib/db.js';
import { pullHub, inboxValue, captureImage, setCaptureImage, deleteCaptures, isHubConfigured } from '../../lib/hub-bridge.js';

// Same ceiling as secondbrain's clients (base64 of a 22 MB picture).
const MAX_IMAGE_CHARS = Math.ceil((22 * 1024 * 1024) / 3) * 4;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

// A failure upstream (the hub, the database) is answered with 200 and
// { error, upstream: true }: Cloudflare replaces a function's 502/503 body
// with its own error page, and the panel needs the reason to show it.
function upstream(message) {
  console.error('[sb-captures]', message);
  return json({ error: String(message).slice(0, 500), upstream: true });
}

export async function onRequestPost(context) {
  const { request } = context;
  if (!isHubConfigured()) return json({ error: 'Second Brain is not connected (HUB_TOKEN is not set).' }, 503);

  const authHeader = String(request.headers.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const user = await verifySessionToken(token);
  if (!user) return json({ error: 'Invalid or expired token' }, 401);
  const ownerId = await resolveOwnerId();
  if (!ownerId || String(user.id) !== ownerId) return json({ error: 'The inbox is only shared with Second Brain for the owner account.' }, 403);

  let body;
  try { body = await request.json(); } catch (_err) { return json({ error: 'Invalid JSON' }, 400); }
  const action = body && body.action;
  const id = body && body.id != null ? String(body.id) : '';

  try {
    if (action === 'refresh') {
      const result = await pullHub(ownerId, { force: true });
      if (result && result.error) return upstream('Second Brain: ' + result.error);
      return json({ value: await inboxValue(ownerId) });
    }
    if (action === 'image-get') {
      if (!id) return json({ error: 'Missing id' }, 400);
      return json({ image: await captureImage(ownerId, id) });
    }
    if (action === 'image-put') {
      if (!id) return json({ error: 'Missing id' }, 400);
      const img = body.image;
      if (img && (typeof img.image_data !== 'string' || !String(img.image_type || '').startsWith('image/'))) return json({ error: 'Not a picture' }, 400);
      if (img && img.image_data.length > MAX_IMAGE_CHARS) return json({ error: 'Picture over 22 MB' }, 413);
      const res = await setCaptureImage(ownerId, id, img || null);
      if (res.notYet) return json({ notYet: true }, 409);
      if (res.error) return upstream('Second Brain: ' + res.error);
      return json({ ok: true });
    }
    if (action === 'delete') {
      const ids = Array.isArray(body.ids) ? body.ids.slice(0, 200).map(String) : [];
      const res = await deleteCaptures(ownerId, ids);
      if (res.error) return upstream('Second Brain: ' + res.error);
      return json(res);
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return upstream((err && err.message) || 'Second Brain could not be reached');
  }
}
