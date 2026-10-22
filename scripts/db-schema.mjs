#!/usr/bin/env node
/**
 * Apply db/schema.sql and make sure the owner account exists.
 *
 *   DATABASE_URL=postgres://homer:...@host:5432/homer \
 *   HOMER_OWNER_ID=<uuid, optional — reuse the old Supabase user id to keep row ownership> \
 *   node scripts/db-schema.mjs
 *
 * Prints the owner id. Safe to run repeatedly.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL');
  process.exit(1);
}
const email = (process.env.HOMER_OWNER_EMAIL || 'bogdan.radu@b4it.ro').toLowerCase();
const ownerId = process.env.HOMER_OWNER_ID || null;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
  const { rows } = await client.query(
    `INSERT INTO users (id, email, username)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, 'bogdan')
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [ownerId, email]
  );
  console.log('Schema applied. Owner', email, '→', rows[0].id);
  if (ownerId && rows[0].id !== ownerId) {
    console.warn('Warning: owner row already existed with a different id; HOMER_OWNER_ID was ignored.');
  }
} finally {
  await client.end();
}
