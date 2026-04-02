/**
 * Supabase-backed Redis-compatible fetch adapter.
 *
 * Exposes `createSupabaseRedisFetch(supabase, userId)` which returns a
 * function with the same call signature as the Upstash Redis REST wrapper
 * used throughout the codebase:
 *
 *   const redis = createSupabaseRedisFetch(supabase, userId);
 *   const { result } = await redis(['GET', 'joey:history']);
 *   await redis(['SET', 'joey:memories', JSON.stringify(arr)]);
 *
 * Supported key namespaces
 * ─────────────────────────
 *   joey:history          → messages table
 *   joey:memories         → memories table
 *   joey:profile          → profiles table
 *   joey:journal          → journal table
 *   joey:context_files    → joey_meta table  (blob)
 *   joey:file_library     → joey_meta table  (blob)
 *   joey:custom_files     → joey_meta table  (blob)
 *   joey:sync_meta        → joey_meta table  (blob)
 *
 *   joey:work:*           → same tables, mode = 'work'
 *
 * The homer:users key is intentionally NOT handled here — auth still
 * goes through the legacy Redis path during the transition period.
 */

const BLOB_FIELDS = new Set([
  'context_files',
  'file_library',
  'custom_files',
  'sync_meta'
]);

const BATCH_SIZE = 100;   // rows per Supabase insert call

// ── Key parser ────────────────────────────────────────────────

function parseKey(key) {
  const k = String(key || '');
  const workPrefix  = 'joey:work:';
  const basePrefix  = 'joey:';

  if (k.startsWith(workPrefix)) {
    return { mode: 'work',     field: k.slice(workPrefix.length) };
  }
  if (k.startsWith(basePrefix)) {
    return { mode: 'personal', field: k.slice(basePrefix.length) };
  }
  return null;
}

// ── GET helpers ───────────────────────────────────────────────

async function getHistory(supabase, userId, mode) {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content, ts')
    .eq('user_id', userId)
    .eq('mode', mode)
    .order('ts', { ascending: true })
    .limit(100);
  if (error) { console.error('[supa-compat] getHistory:', error.message); return null; }
  return data || [];
}

async function getMemories(supabase, userId, mode) {
  const { data, error } = await supabase
    .from('memories')
    .select('mem_id, text, category, ts, auto, source, confidence, pinned')
    .eq('user_id', userId)
    .eq('mode', mode)
    .order('ts', { ascending: true });
  if (error) { console.error('[supa-compat] getMemories:', error.message); return null; }
  if (!data) return [];
  return data.map(row => ({
    id:         row.mem_id,
    text:       row.text,
    category:   row.category,
    ts:         row.ts,
    auto:       row.auto,
    source:     row.source,
    confidence: row.confidence,
    pinned:     row.pinned
  }));
}

async function getProfile(supabase, userId, mode) {
  const { data, error } = await supabase
    .from('profiles')
    .select('data')
    .eq('user_id', userId)
    .eq('mode', mode)
    .maybeSingle();
  if (error) { console.error('[supa-compat] getProfile:', error.message); return null; }
  return data ? data.data : null;
}

async function getJournal(supabase, userId, mode) {
  const { data, error } = await supabase
    .from('journal')
    .select('type, role, text, category, source, ts')
    .eq('user_id', userId)
    .eq('mode', mode)
    .order('ts', { ascending: true })
    .limit(1800);
  if (error) { console.error('[supa-compat] getJournal:', error.message); return null; }
  return data || [];
}

async function getBlob(supabase, userId, mode, key) {
  const { data, error } = await supabase
    .from('joey_meta')
    .select('value')
    .eq('user_id', userId)
    .eq('mode', mode)
    .eq('key', key)
    .maybeSingle();
  if (error) { console.error('[supa-compat] getBlob', key, ':', error.message); return null; }
  return data ? data.value : null;
}

// ── SET helpers ───────────────────────────────────────────────

async function setHistory(supabase, userId, mode, value) {
  const messages = Array.isArray(value) ? value : [];
  const { error: delErr } = await supabase
    .from('messages')
    .delete()
    .eq('user_id', userId)
    .eq('mode', mode);
  if (delErr) throw new Error('setHistory delete: ' + delErr.message);
  if (messages.length === 0) return;

  const rows = messages.map(msg => ({
    user_id: userId,
    mode,
    role:    msg.role,
    content: msg.content,
    ts:      Number(msg.ts) || Date.now()
  }));
  const { error: insErr } = await supabase.from('messages').insert(rows);
  if (insErr) throw new Error('setHistory insert: ' + insErr.message);
}

async function setMemories(supabase, userId, mode, value) {
  const mems = Array.isArray(value) ? value : [];
  const { error: delErr } = await supabase
    .from('memories')
    .delete()
    .eq('user_id', userId)
    .eq('mode', mode);
  if (delErr) throw new Error('setMemories delete: ' + delErr.message);
  if (mems.length === 0) return;

  for (let i = 0; i < mems.length; i += BATCH_SIZE) {
    const batch = mems.slice(i, i + BATCH_SIZE).map(mem => ({
      user_id:    userId,
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
    if (error) throw new Error('setMemories insert: ' + error.message);
  }
}

async function setProfile(supabase, userId, mode, value) {
  const profileData = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { user_id: userId, mode, data: profileData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,mode' }
    );
  if (error) throw new Error('setProfile upsert: ' + error.message);
}

async function setJournal(supabase, userId, mode, value) {
  const entries = Array.isArray(value) ? value : [];
  const { error: delErr } = await supabase
    .from('journal')
    .delete()
    .eq('user_id', userId)
    .eq('mode', mode);
  if (delErr) throw new Error('setJournal delete: ' + delErr.message);
  if (entries.length === 0) return;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map(entry => ({
      user_id:  userId,
      mode,
      type:     entry.type     || 'entry',
      role:     entry.role     || '',
      text:     String(entry.text || '').slice(0, 2000),
      category: entry.category || '',
      source:   entry.source   || 'system',
      ts:       Number(entry.ts) || Date.now()
    }));
    const { error } = await supabase.from('journal').insert(batch);
    if (error) throw new Error('setJournal insert: ' + error.message);
  }
}

async function setBlob(supabase, userId, mode, key, value) {
  const { error } = await supabase
    .from('joey_meta')
    .upsert(
      { user_id: userId, mode, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,mode,key' }
    );
  if (error) throw new Error('setBlob(' + key + ') upsert: ' + error.message);
}

// ── Public factory ────────────────────────────────────────────

/**
 * Returns a Redis-compatible async function that routes GET/SET
 * commands to the appropriate Supabase tables.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId  - Supabase auth.users UUID
 */
export function createSupabaseRedisFetch(supabase, userId) {
  return async function supabaseRedisFetch(command) {
    const cmd   = String((command && command[0]) || '').toUpperCase();
    const key   = String((command && command[1]) || '');
    const raw   = command && command[2];
    const parsed = parseKey(key);

    if (!parsed) return { result: null };

    const { mode, field } = parsed;

    try {
      // ── GET ──────────────────────────────────────────────
      if (cmd === 'GET') {
        let data;
        switch (field) {
          case 'history':      data = await getHistory (supabase, userId, mode); break;
          case 'memories':     data = await getMemories(supabase, userId, mode); break;
          case 'profile':      data = await getProfile (supabase, userId, mode); break;
          case 'journal':      data = await getJournal (supabase, userId, mode); break;
          default:
            if (BLOB_FIELDS.has(field)) {
              data = await getBlob(supabase, userId, mode, field);
            } else {
              return { result: null };
            }
        }
        return {
          result: data !== null && data !== undefined ? JSON.stringify(data) : null
        };
      }

      // ── SET ──────────────────────────────────────────────
      if (cmd === 'SET') {
        let value;
        try {
          value = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (_) {
          value = raw;
        }

        switch (field) {
          case 'history':  await setHistory (supabase, userId, mode, value); break;
          case 'memories': await setMemories(supabase, userId, mode, value); break;
          case 'profile':  await setProfile (supabase, userId, mode, value); break;
          case 'journal':  await setJournal (supabase, userId, mode, value); break;
          default:
            if (BLOB_FIELDS.has(field)) {
              await setBlob(supabase, userId, mode, field, value);
            }
        }
        return { result: 'OK' };
      }

    } catch (err) {
      console.error('[supa-compat] Error for', cmd, key, ':', err.message);
      return { result: null, error: err.message };
    }

    return { result: null };
  };
}
