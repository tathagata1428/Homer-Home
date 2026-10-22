#!/usr/bin/env node
/**
 * One-time copy of the owner's rows from Supabase into the new Postgres.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_OWNER_ID=<uuid> \
 *   DATABASE_URL=postgres://... \
 *   node scripts/migrate-from-supabase.mjs [--dry-run]
 *
 * Run scripts/db-schema.mjs first. Rows are re-owned by the local owner account
 * (users row for HOMER_OWNER_EMAIL), so its id does not need to match Supabase.
 * Existing rows (same primary key) are left alone, so re-running is safe.
 */
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_OWNER_ID, DATABASE_URL } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_OWNER_ID, DATABASE_URL })) {
  if (!v) { console.error('Missing env var ' + k); process.exit(1); }
}

// Parents before children (foreign keys).
const TABLES = [
  'profiles', 'messages', 'memories', 'tasks', 'task_events', 'journal', 'devices',
  'sync_cursors', 'joey_meta', 'field_state', 'habits', 'habit_completions', 'focus_sessions'
];
const PAGE = 1000;

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=*&user_id=eq.${SUPABASE_OWNER_ID}&order=id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
          Range: `${from}-${from + PAGE - 1}`
        }
      }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

function toParam(v) {
  return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
}

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();
try {
  const ownerEmail = (process.env.HOMER_OWNER_EMAIL || 'bogdan.radu@b4it.ro').toLowerCase();
  const owner = await db.query('SELECT id FROM users WHERE lower(email) = $1', [ownerEmail]);
  if (!owner.rows.length) throw new Error('No users row for ' + ownerEmail + ' — run scripts/db-schema.mjs first');
  const localOwnerId = owner.rows[0].id;
  console.log('Supabase owner', SUPABASE_OWNER_ID, '→ local owner', localOwnerId);
  const colsRes = await db.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
  );
  const columns = {};
  for (const r of colsRes.rows) (columns[r.table_name] ||= new Set()).add(r.column_name);

  for (const table of TABLES) {
    const rows = await fetchAll(table);
    if (rows === null) { console.log(`${table}: not in Supabase, skipped`); continue; }
    if (!columns[table]) { console.log(`${table}: not in target schema, skipped (${rows.length} rows)`); continue; }
    let inserted = 0;
    if (!dryRun) {
      await db.query('BEGIN');
      // Keep the copied updated_at values instead of stamping NOW().
      await db.query(`ALTER TABLE "${table}" DISABLE TRIGGER USER`);
      for (const row of rows) {
        if ('user_id' in row) row.user_id = localOwnerId;
        const cols = Object.keys(row).filter((c) => columns[table].has(c));
        const res = await db.query(
          `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')})
           VALUES (${cols.map((_, i) => '$' + (i + 1)).join(', ')})
           ON CONFLICT DO NOTHING`,
          cols.map((c) => toParam(row[c]))
        );
        inserted += res.rowCount;
      }
      await db.query(`ALTER TABLE "${table}" ENABLE TRIGGER USER`);
      await db.query('COMMIT');
    }
    console.log(`${table}: ${rows.length} rows in Supabase, ${dryRun ? 'dry run' : inserted + ' inserted'}`);
  }
} catch (err) {
  await db.query('ROLLBACK').catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
