/**
 * Homer-Home full Supabase setup script.
 * Usage: node setup-supabase.mjs  (with .env.production sourced)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// ── Config ────────────────────────────────────────────────────
const SUPA_HOST   = process.env.SUPABASE_HOST   || 'db.fwzxxrldxnlhcyulkwrg.supabase.co';
const SUPA_URL    = process.env.SUPABASE_URL    || 'https://fwzxxrldxnlhcyulkwrg.supabase.co';
const ANON_KEY    = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY_DIRECT = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DB_PASS     = process.env.SUPABASE_DB_PASS  || process.env.DB_PASSWORD || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'bogdan.radu@b4it.ro';
const OWNER_PASS  = process.env.OWNER_PASS  || DB_PASS;

const PROJECT_DIR = 'D:\\Git\\Homer-Home';

// Parse .env.production manually (strips surrounding quotes, handles CRLF)
function loadEnvFile(path) {
  try {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {}
}
loadEnvFile(PROJECT_DIR + '/.env.production');

const REDIS_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL   || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN || '';

// ── Helpers ───────────────────────────────────────────────────
const log = (m) => console.log('[setup]', m);

function b64url(buf) {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
    .toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function makeJwt(secret, payload) {
  const header = b64url(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const body   = b64url(JSON.stringify(payload));
  const sig    = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}
async function redisFetch(cmd) {
  const r = await fetch(REDIS_URL, {
    method:'POST', headers:{ Authorization:'Bearer '+REDIS_TOKEN }, body:JSON.stringify(cmd)
  });
  return r.json();
}
function safeJson(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function vercelEnvSet(key, value) {
  try {
    execSync(`vercel env rm ${key} production --yes`, { cwd: PROJECT_DIR, stdio:'pipe' });
  } catch {}
  const escaped = value.replace(/"/g, '\\"');
  execSync(`printf '%s' "${escaped}" | vercel env add ${key} production`, { cwd: PROJECT_DIR, stdio:'pipe' });
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  // Connect to Supabase Postgres
  const db = new Client({
    host: SUPA_HOST, port: 5432, database: 'postgres',
    user: 'postgres', password: DB_PASS,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();
  log('✓ Connected to Supabase Postgres');

  // 1. Check schema
  const { rows: tbl } = await db.query(
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='messages'`
  );
  if (tbl[0].count === '0') {
    log('Running schema.sql ...');
    const schema = readFileSync(PROJECT_DIR + '/supabase/schema.sql', 'utf8');
    await db.query(schema);
    log('✓ Schema created');
  } else {
    log('✓ Schema already in place');
  }

  // Ensure field_state table exists (idempotent — safe to re-run)
  const { rows: fsTbl } = await db.query(
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='field_state'`
  );
  if (fsTbl[0].count === '0') {
    log('Creating field_state table ...');
    const fsSchema = `
CREATE TABLE IF NOT EXISTS public.field_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  value TEXT NOT NULL DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  client_ts BIGINT NOT NULL DEFAULT 0,
  client_seq INTEGER NOT NULL DEFAULT 0,
  device_id TEXT NOT NULL DEFAULT '',
  server_ts BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, field_id)
);
CREATE INDEX IF NOT EXISTS field_state_user_ts ON public.field_state (user_id, server_ts);
ALTER TABLE public.field_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_state_select" ON public.field_state FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "field_state_insert" ON public.field_state FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "field_state_update" ON public.field_state FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "field_state_delete" ON public.field_state FOR DELETE USING (user_id = auth.uid());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='field_state')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.field_state; END IF;
END $$;`;
    await db.query(fsSchema);
    log('✓ field_state table created with RLS + Realtime');
  } else {
    log('✓ field_state table already in place');
  }

  // 2. Get JWT secret
  log('Reading JWT secret ...');
  let jwtSecret = null;
  for (const q of [
    `SELECT current_setting('app.settings.jwt_secret', true) AS s`,
    `SELECT decrypted_secret AS s FROM vault.decrypted_secrets WHERE name='jwt_secret' LIMIT 1`
  ]) {
    try { const { rows } = await db.query(q); if (rows[0]?.s) { jwtSecret = rows[0].s; break; } } catch {}
  }
  // Use the directly provided service role key
  const SERVICE_KEY = SERVICE_KEY_DIRECT;
  log('✓ Service role key ready (provided directly)');

  // 3. Create/find auth user
  log('Setting up Supabase auth user ...');
  let ownerId;
  const { rows: eu } = await db.query(`SELECT id FROM auth.users WHERE email=$1`, [OWNER_EMAIL]);
  if (eu.length > 0) {
    ownerId = eu[0].id;
    log(`✓ Auth user exists: ${ownerId}`);
  } else {
    const { rows: nu } = await db.query(`
      INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,
        email_confirmed_at,created_at,updated_at,raw_user_meta_data,is_super_admin,confirmation_token)
      VALUES('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated',
        $1,crypt($2,gen_salt('bf')),NOW(),NOW(),NOW(),'{"username":"bogdan"}',FALSE,'')
      RETURNING id`, [OWNER_EMAIL, OWNER_PASS]);
    ownerId = nu[0].id;
    log(`✓ Auth user created: ${ownerId}`);
  }

  // 4. Migrate Redis → Supabase
  if (!REDIS_URL || !REDIS_TOKEN) {
    log('WARN: No Redis env vars — skipping data migration');
  } else {
    log('Migrating Redis data ...');
    const BATCH = 100;
    for (const mode of ['personal','work']) {
      const pfx = mode === 'work' ? 'joey:work' : 'joey';
      log(`  [${mode}]`);
      const [hR,mR,pR,jR,fR,lR,cR,sR] = await Promise.all([
        redisFetch(['GET',`${pfx}:history`]),   redisFetch(['GET',`${pfx}:memories`]),
        redisFetch(['GET',`${pfx}:profile`]),   redisFetch(['GET',`${pfx}:journal`]),
        redisFetch(['GET',`${pfx}:context_files`]), redisFetch(['GET',`${pfx}:file_library`]),
        redisFetch(['GET',`${pfx}:custom_files`]),  redisFetch(['GET',`${pfx}:sync_meta`])
      ]);
      const history=safeJson(hR.result,[]), memories=safeJson(mR.result,[]),
            profile=safeJson(pR.result,null), journal=safeJson(jR.result,[]);

      // Messages
      if (history.length) {
        await db.query(`DELETE FROM public.messages WHERE user_id=$1 AND mode=$2`,[ownerId,mode]);
        for (let i=0;i<history.length;i+=BATCH) {
          const b=history.slice(i,i+BATCH);
          const vals=b.map((_,j)=>`($1,$2,$${j*3+3},$${j*3+4},$${j*3+5})`).join(',');
          const args=[ownerId,mode]; b.forEach(m=>args.push(m.role,m.content,Number(m.ts)||Date.now()));
          await db.query(`INSERT INTO public.messages(user_id,mode,role,content,ts) VALUES ${vals}`,args);
        }
        log(`    ${history.length} messages`);
      }
      // Memories
      if (memories.length) {
        await db.query(`DELETE FROM public.memories WHERE user_id=$1 AND mode=$2`,[ownerId,mode]);
        for (let i=0;i<memories.length;i+=BATCH) {
          const b=memories.slice(i,i+BATCH);
          const vals=b.map((_,j)=>{const o=j*7;return `($1,$2,$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9})`;}).join(',');
          const args=[ownerId,mode];
          b.forEach(m=>args.push(String(m.id||''),String(m.text||''),String(m.category||'general'),
            Number(m.ts)||Date.now(),!!m.auto,typeof m.confidence==='number'?m.confidence:null,!!m.pinned));
          await db.query(`INSERT INTO public.memories(user_id,mode,mem_id,text,category,ts,auto,confidence,pinned) VALUES ${vals}`,args);
        }
        log(`    ${memories.length} memories`);
      }
      // Profile
      if (profile) {
        await db.query(
          `INSERT INTO public.profiles(user_id,mode,data,updated_at) VALUES($1,$2,$3,NOW())
           ON CONFLICT(user_id,mode) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`,
          [ownerId,mode,JSON.stringify(profile)]);
        log(`    profile saved`);
      }
      // Journal
      if (journal.length) {
        await db.query(`DELETE FROM public.journal WHERE user_id=$1 AND mode=$2`,[ownerId,mode]);
        for (let i=0;i<journal.length;i+=BATCH) {
          const b=journal.slice(i,i+BATCH);
          const vals=b.map((_,j)=>{const o=j*6;return `($1,$2,$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8})`;}).join(',');
          const args=[ownerId,mode];
          b.forEach(e=>args.push(e.type||'entry',e.role||'',String(e.text||'').slice(0,2000),e.category||'',e.source||'system',Number(e.ts)||Date.now()));
          await db.query(`INSERT INTO public.journal(user_id,mode,type,role,text,category,source,ts) VALUES ${vals}`,args);
        }
        log(`    ${journal.length} journal entries`);
      }
      // Blobs
      for (const [k,r] of [['context_files',fR],['file_library',lR],['custom_files',cR],['sync_meta',sR]]) {
        const v=safeJson(r.result,null); if (!v) continue;
        await db.query(
          `INSERT INTO public.joey_meta(user_id,mode,key,value,updated_at) VALUES($1,$2,$3,$4,NOW())
           ON CONFLICT(user_id,mode,key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,
          [ownerId,mode,k,JSON.stringify(v)]);
      }
      log(`    blobs saved`);
    }
    log('✓ Migration complete');
  }

  await db.end();

  // 5. Set Vercel env vars
  log('Setting Vercel env vars ...');
  const vars = {
    SUPABASE_URL: SUPA_URL,
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    SUPABASE_OWNER_ID: ownerId
  };
  for (const [k,v] of Object.entries(vars)) {
    try {
      vercelEnvSet(k, v);
      log(`  ✓ ${k}`);
    } catch(e) {
      log(`  ✗ ${k}: ${e.message.split('\n')[0]}`);
    }
  }

  log('');
  log('=== ALL DONE ===');
  log(`Owner UUID : ${ownerId}`);
  log(`Login with : ${OWNER_EMAIL} / ${OWNER_PASS}`);
  log('Deploying to production ...');

  try {
    execSync('vercel --prod --yes', { cwd: PROJECT_DIR, stdio:'inherit' });
  } catch(e) {
    log('Deploy via git push instead');
  }
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
