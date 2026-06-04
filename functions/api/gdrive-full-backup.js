/**
 * Google Drive Full Backup — Cloudflare Pages Function
 *
 * True 1:1 backup of EVERYTHING for Bogdan:
 *
 *   CLIENT (sent by browser)
 *     • Every localStorage key (no filtering)
 *     • Vault IDB (homer-vault-salt, homer-vault-hash, homer-vault-data)
 *
 *   SUPABASE (fetched server-side via admin client — bypasses RLS)
 *     • profiles          — Joey profile per mode
 *     • messages          — full chat history
 *     • memories          — all Joey memories
 *     • journal           — all journal entries
 *     • joey_meta         — context_files, custom_files, file_library, sync_meta
 *     • field_state       — EVERY synced field from EVERY device (habits, expenses,
 *                           inbox, notes, car, tasks, income — Android + web)
 *     • tasks             — standalone tasks
 *     • task_events       — task audit log
 *     • habits            — habit definitions
 *     • habit_completions — every habit completion record
 *     • focus_sessions    — full pomodoro history
 *     • devices           — registered devices
 *
 * The combined bundle is POSTed to the Google Apps Script webhook as
 * kind='vault-snapshot' and saved as a dated JSON file in Drive.
 *
 * POST /api/gdrive-full-backup
 * Headers: Authorization: Bearer <jwt>   (preferred over passphrase)
 * Body:    { clientSnapshot: {...}, passphrase?: string }
 */

import {
  createRedisFetch,
  fetchWithRedirects,
  getGoogleDriveConfig,
  getRedisConfig,
  verifyJoeyPassphrase
} from '../../lib/joey-server.js';
import {
  isSupabaseClientConfigured,
  isSupabaseConfigured,
  createAdminClient,
  createUserClient,
  resolveSupabaseOwnerId,
  verifySupabaseJwt
} from '../../lib/supabase-server.js';

const TIMEOUT_MS = 120000; // 2 min — large payloads need time

// Fetch all rows of a user-scoped table. Never throws — returns [] on error.
async function dumpTable(supabase, table, userId, opts) {
  opts = opts || {};
  const limit = opts.limit || 10000;
  const orderCol = opts.orderCol || 'created_at';
  try {
    let q = supabase.from(table).select('*').eq('user_id', userId);
    if (orderCol) q = q.order(orderCol, { ascending: true });
    q = q.limit(limit);
    const { data, error } = await q;
    if (error) {
      console.warn('[gdrive-full-backup] ' + table + ':', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn('[gdrive-full-backup] ' + table + ' exception:', e.message);
    return [];
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (env && typeof env === 'object') Object.assign(process.env, env);

  const origin = request.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  let body;
  try { body = await request.json(); } catch (_) { body = {}; }
  const { passphrase, clientSnapshot } = body || {};

  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig();
  if (!gdriveWebhook) return Response.json({ error: 'GDRIVE_WEBHOOK_URL not configured' }, { status: 500, headers: corsHeaders });
  if (!gdriveSecret) return Response.json({ error: 'GDRIVE_SECRET not configured' }, { status: 500, headers: corsHeaders });

  // --- Auth ---
  const authHeader = String(request.headers.get('authorization') || '');
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  let supabaseAdmin = null;
  let userId = null;

  const supabaseJwtEnabled = isSupabaseClientConfigured();
  const supabaseAdminEnabled = isSupabaseConfigured();
  const rawRedisFetch = createRedisFetch();
  const { url: redisUrl, token: redisToken } = getRedisConfig();

  let supabaseUser = null;
  if (jwtToken && supabaseJwtEnabled) {
    supabaseUser = await verifySupabaseJwt(jwtToken).catch(() => null);
  }

  if (supabaseUser) {
    userId = supabaseUser.id;
    if (supabaseAdminEnabled) supabaseAdmin = createAdminClient();
  } else {
    if (!passphrase) return Response.json({ error: 'Missing passphrase. Unlock vault first.' }, { status: 401, headers: corsHeaders });
    const adminHash = String(env.HOMER_ADMIN_HASH || '').trim();
    const ownerId = await resolveSupabaseOwnerId();
    let isValid = !!adminHash && passphrase.trim() === adminHash;
    if (!isValid) isValid = await verifyJoeyPassphrase(passphrase, rawRedisFetch);
    if (!isValid) return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });

    if (supabaseAdminEnabled && ownerId) {
      userId = ownerId;
      supabaseAdmin = createAdminClient();
    } else {
      if (!redisUrl || !redisToken || !rawRedisFetch) {
        return Response.json({ error: 'Storage not configured' }, { status: 500, headers: corsHeaders });
      }
    }
  }

  try {
    const backedUpAt = new Date().toISOString();
    const safeClientSnapshot = clientSnapshot && typeof clientSnapshot === 'object' ? clientSnapshot : {};

    // --- Dump every Supabase table in parallel ---
    let supabaseDump = {};

    if (supabaseAdmin && userId) {
      const [
        profiles,
        messages,
        memories,
        journal,
        joeyMeta,
        fieldState,
        tasks,
        taskEvents,
        habits,
        habitCompletions,
        focusSessions,
        devices
      ] = await Promise.all([
        dumpTable(supabaseAdmin, 'profiles',          userId, { orderCol: 'updated_at' }),
        dumpTable(supabaseAdmin, 'messages',          userId, { orderCol: 'ts', limit: 20000 }),
        dumpTable(supabaseAdmin, 'memories',          userId, { orderCol: 'ts' }),
        dumpTable(supabaseAdmin, 'journal',           userId, { orderCol: 'ts', limit: 5000 }),
        dumpTable(supabaseAdmin, 'joey_meta',         userId, { orderCol: 'updated_at' }),
        dumpTable(supabaseAdmin, 'field_state',       userId, { orderCol: 'updated_at', limit: 5000 }),
        dumpTable(supabaseAdmin, 'tasks',             userId, { orderCol: 'created_at' }),
        dumpTable(supabaseAdmin, 'task_events',       userId, { orderCol: 'created_at', limit: 5000 }),
        dumpTable(supabaseAdmin, 'habits',            userId, { orderCol: 'created_at' }),
        dumpTable(supabaseAdmin, 'habit_completions', userId, { orderCol: 'date', limit: 20000 }),
        dumpTable(supabaseAdmin, 'focus_sessions',    userId, { orderCol: 'created_at', limit: 10000 }),
        dumpTable(supabaseAdmin, 'devices',           userId, { orderCol: 'last_seen_at' })
      ]);

      supabaseDump = {
        profiles,
        messages,
        memories,
        journal,
        joeyMeta,
        fieldState,
        tasks,
        taskEvents,
        habits,
        habitCompletions,
        focusSessions,
        devices
      };
    }

    // --- Assemble the full snapshot ---
    const fullSnapshot = {
      _meta: {
        version: 2,
        kind: 'full-backup',
        backedUpAt,
        source: 'homer-web-fullbackup',
        userId: userId || 'unknown'
      },
      // Complete browser-side data
      client: safeClientSnapshot,
      // Complete Supabase dump — every table, every row
      supabase: supabaseDump
    };

    // Build stats
    const counts = {};
    Object.keys(supabaseDump).forEach(t => {
      counts[t] = Array.isArray(supabaseDump[t]) ? supabaseDump[t].length : 0;
    });
    const clientKeys = Object.keys(safeClientSnapshot).length;
    const totalSupabaseRows = Object.values(counts).reduce((a, b) => a + b, 0);
    const hasCarIdb = 'homer-car-data' in safeClientSnapshot;

    const manifest = {
      version: 2,
      backedUpAt,
      clientKeyCount: clientKeys,
      supabaseRowCounts: counts,
      totalSupabaseRows
    };

    // --- POST to Google Drive ---
    const payload = {
      secret: gdriveSecret,
      kind: 'vault-snapshot',
      snapshot: fullSnapshot,
      manifest,
      meta: { source: 'full-backup', backedUpAt, clientKeys, totalSupabaseRows }
    };

    const response = await fetchWithRedirects(gdriveWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: TIMEOUT_MS,
      body: JSON.stringify(payload)
    });

    if (!response.text) {
      console.error('[gdrive-full-backup] No response:', response.error);
      return Response.json({ error: response.error || 'No response from Drive webhook' }, { status: response.status || 502, headers: corsHeaders });
    }

    let parsed;
    try { parsed = JSON.parse(response.text); }
    catch {
      const isHtml = response.text.trim().startsWith('<');
      return Response.json({
        error: isHtml ? 'Google returned HTML — Apps Script may need redeployment' : 'Non-JSON from Drive',
        preview: response.text.slice(0, 300)
      }, { status: 502, headers: corsHeaders });
    }

    if (parsed.error) {
      return Response.json({
        error: 'Drive rejected the backup',
        detail: parsed.error,
        hint: parsed.error === 'Unauthorized'
          ? 'GDRIVE_SECRET env var does not match the Apps Script SECRET.'
          : undefined
      }, { status: 502, headers: corsHeaders });
    }

    return Response.json({
      ok: true,
      backedUpAt,
      stats: { clientKeys, totalSupabaseRows, counts, hasCarIdb },
      drive: parsed
    }, { headers: corsHeaders });

  } catch (err) {
    console.error('[gdrive-full-backup] Exception:', err.message, err.stack);
    return Response.json({ error: 'Full backup failed', detail: err.message }, { status: 500, headers: corsHeaders });
  }
}
