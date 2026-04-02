/**
 * One-time migration: Redis → Supabase.
 *
 * POST /api/migrate
 * Body: { passphrase, mode?, dryRun? }
 *
 * Reads all Joey state from Redis for the given mode (default: both) and
 * writes it into the Supabase tables under the owner user (SUPABASE_OWNER_ID).
 *
 * Set dryRun: true to see what would be migrated without writing anything.
 *
 * This endpoint is protected by the admin passphrase (HOMER_ADMIN_HASH or Redis users).
 * Only the owner account is migrated — one call per mode.
 */
import crypto from 'crypto';
import { createAdminClient, isSupabaseConfigured } from '../lib/supabase-server.js';
import { getJoeyContextKeys } from '../lib/joey-context.js';
import { safeJsonParse } from '../lib/joey-server.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function setHeaders(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { passphrase, dryRun = false } = body;
  const modes = body.mode ? [String(body.mode)] : ['personal', 'work'];

  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });

  // ── Verify admin credentials ──────────────────────────────
  const REDIS_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Redis not configured' });
  if (!isSupabaseConfigured())    return res.status(500).json({ error: 'Supabase not configured' });

  const OWNER_ID = String(process.env.SUPABASE_OWNER_ID || '').trim();
  if (!OWNER_ID) return res.status(500).json({ error: 'SUPABASE_OWNER_ID not configured. Set it to your Supabase user UUID.' });

  const redis = async (cmd) => {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  };

  // Verify passphrase
  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  let valid = ADMIN_HASH && passphrase.trim() === ADMIN_HASH;
  if (!valid) {
    const usersData = await redis(['GET', 'homer:users']);
    const users = safeJsonParse(usersData && usersData.result, []);
    valid = users.some(u => u && u.passwordHash === passphrase.trim());
  }
  if (!valid) return res.status(403).json({ error: 'Forbidden' });

  const supabase = createAdminClient();
  const report = { dryRun: !!dryRun, modes: {}, errors: [] };

  for (const mode of modes) {
    const keys = getJoeyContextKeys(mode);
    const modeReport = {
      history:      0,
      memories:     0,
      profile:      false,
      journal:      0,
      context_files: false,
      file_library: false,
      custom_files: false,
      sync_meta:    false
    };

    try {
      // ── Fetch all keys from Redis in parallel ─────────────
      const [histRaw, memRaw, profileRaw, journalRaw,
             filesRaw, libRaw, customRaw, syncMetaRaw] = await Promise.all([
        redis(['GET', keys.HISTORY_KEY]),
        redis(['GET', keys.MEMORY_KEY]),
        redis(['GET', keys.PROFILE_KEY]),
        redis(['GET', keys.JOURNAL_KEY]),
        redis(['GET', keys.FILES_KEY]),
        redis(['GET', keys.FILE_LIBRARY_KEY]),
        redis(['GET', keys.CUSTOM_FILES_KEY]),
        redis(['GET', keys.SYNC_META_KEY])
      ]);

      const history  = safeJsonParse(histRaw && histRaw.result, []);
      const memories = safeJsonParse(memRaw  && memRaw.result,  []);
      const profile  = safeJsonParse(profileRaw && profileRaw.result, null);
      const journal  = safeJsonParse(journalRaw && journalRaw.result, []);
      const contextFiles = safeJsonParse(filesRaw   && filesRaw.result,   null);
      const fileLibrary  = safeJsonParse(libRaw     && libRaw.result,     null);
      const customFiles  = safeJsonParse(customRaw  && customRaw.result,  null);
      const syncMeta     = safeJsonParse(syncMetaRaw && syncMetaRaw.result, null);

      if (dryRun) {
        modeReport.history      = history.length;
        modeReport.memories     = memories.length;
        modeReport.profile      = !!profile;
        modeReport.journal      = journal.length;
        modeReport.context_files = !!contextFiles;
        modeReport.file_library  = !!fileLibrary;
        modeReport.custom_files  = !!customFiles;
        modeReport.sync_meta     = !!syncMeta;
        report.modes[mode] = modeReport;
        continue;
      }

      // ── MESSAGES (history) ─────────────────────────────────
      if (history.length > 0) {
        const { error: delErr } = await supabase
          .from('messages')
          .delete()
          .eq('user_id', OWNER_ID)
          .eq('mode', mode);
        if (delErr) throw new Error('messages delete: ' + delErr.message);

        const msgRows = history.map(msg => ({
          user_id: OWNER_ID,
          mode,
          role:    msg.role,
          content: msg.content,
          ts:      Number(msg.ts) || Date.now()
        }));
        const { error: insErr } = await supabase.from('messages').insert(msgRows);
        if (insErr) throw new Error('messages insert: ' + insErr.message);
        modeReport.history = history.length;
      }

      // ── MEMORIES ──────────────────────────────────────────
      if (memories.length > 0) {
        const { error: delErr } = await supabase
          .from('memories')
          .delete()
          .eq('user_id', OWNER_ID)
          .eq('mode', mode);
        if (delErr) throw new Error('memories delete: ' + delErr.message);

        const BATCH = 100;
        for (let i = 0; i < memories.length; i += BATCH) {
          const batch = memories.slice(i, i + BATCH).map(mem => ({
            user_id:    OWNER_ID,
            mode,
            mem_id:     String(mem.id || ''),
            text:       String(mem.text || ''),
            category:   String(mem.category || 'general'),
            ts:         Number(mem.ts) || Date.now(),
            auto:       !!mem.auto,
            source:     mem.source || null,
            confidence: typeof mem.confidence === 'number' ? mem.confidence : null,
            pinned:     !!mem.pinned
          }));
          const { error } = await supabase.from('memories').insert(batch);
          if (error) throw new Error('memories insert: ' + error.message);
        }
        modeReport.memories = memories.length;
      }

      // ── PROFILE ───────────────────────────────────────────
      if (profile) {
        const { error } = await supabase
          .from('profiles')
          .upsert(
            { user_id: OWNER_ID, mode, data: profile, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,mode' }
          );
        if (error) throw new Error('profiles upsert: ' + error.message);
        modeReport.profile = true;
      }

      // ── JOURNAL ───────────────────────────────────────────
      if (journal.length > 0) {
        const { error: delErr } = await supabase
          .from('journal')
          .delete()
          .eq('user_id', OWNER_ID)
          .eq('mode', mode);
        if (delErr) throw new Error('journal delete: ' + delErr.message);

        const BATCH = 100;
        for (let i = 0; i < journal.length; i += BATCH) {
          const batch = journal.slice(i, i + BATCH).map(entry => ({
            user_id:  OWNER_ID,
            mode,
            type:     entry.type     || 'entry',
            role:     entry.role     || '',
            text:     String(entry.text || '').slice(0, 2000),
            category: entry.category || '',
            source:   entry.source   || 'system',
            ts:       Number(entry.ts) || Date.now()
          }));
          const { error } = await supabase.from('journal').insert(batch);
          if (error) throw new Error('journal insert: ' + error.message);
        }
        modeReport.journal = journal.length;
      }

      // ── BLOBS (context_files, file_library, custom_files, sync_meta) ──
      const blobs = [
        ['context_files', contextFiles],
        ['file_library',  fileLibrary],
        ['custom_files',  customFiles],
        ['sync_meta',     syncMeta]
      ];
      for (const [blobKey, blobValue] of blobs) {
        if (blobValue === null) continue;
        const { error } = await supabase
          .from('joey_meta')
          .upsert(
            { user_id: OWNER_ID, mode, key: blobKey, value: blobValue, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,mode,key' }
          );
        if (error) throw new Error(blobKey + ' upsert: ' + error.message);
        modeReport[blobKey] = true;
      }

    } catch (err) {
      report.errors.push({ mode, error: err.message });
    }

    report.modes[mode] = modeReport;
  }

  const ok = report.errors.length === 0;
  return res.status(ok ? 200 : 207).json({ ok, ...report });
}
