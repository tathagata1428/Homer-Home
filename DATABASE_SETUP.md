# Database setup

Homer stores synced data in its own PostgreSQL database (previously Supabase).
The browser and the Android app never connect to Postgres directly: they call
the Pages Functions (`/api/auth`, `/api/db`, `/api/sync`, `/api/joey`, …), which
connect through Cloudflare Hyperdrive.

```
browser / Android ──HTTPS──▶ Cloudflare Pages Functions ──Hyperdrive──▶ Cloudflare Tunnel ──▶ Postgres (Oracle VM)
```

Cross-device updates use polling: the browser asks `/api/db` for changed rows
every 10 s while the tab is visible, and Android does the same while the app is
in the foreground.

---

## 1 · Create the database (on the Oracle VM)

Use a separate database and role. Do not reuse the sync hub's own database.

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE homer LOGIN PASSWORD '<strong password>';
CREATE DATABASE homer OWNER homer;
SQL
```

## 2 · Apply the schema and create the owner account

From any machine that can reach the database (e.g. over an SSH tunnel):

```bash
# Reuse the old Supabase user id so migrated rows keep their owner.
DATABASE_URL=postgres://homer:<pw>@localhost:5432/homer \
HOMER_OWNER_ID=<old SUPABASE_OWNER_ID> \
npm run db:schema
```

This is safe to run again after schema changes.

## 3 · Copy the data from Supabase (one time, optional)

```bash
SUPABASE_URL=https://fwzxxrldxnlhcyulkwrg.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
SUPABASE_OWNER_ID=<uuid> \
DATABASE_URL=postgres://homer:<pw>@localhost:5432/homer \
npm run db:migrate-from-supabase -- --dry-run     # then without --dry-run
```

Rows that already exist are skipped, so re-running it is safe.

## 4 · Expose Postgres to Cloudflare without opening port 5432

On the Oracle VM, add a Cloudflare Tunnel public hostname, e.g.
`homer-db.b4it.ro → tcp://localhost:5432`. Then, in Zero Trust:

1. **Access → Applications → Add → Self-hosted** for `homer-db.b4it.ro`.
2. **Access → Service Auth → Create service token**, and allow it in the
   application's policy (action: *Service Auth*).

Then create the Hyperdrive config:

```bash
npx wrangler hyperdrive create homer-db \
  --host=homer-db.b4it.ro --user=homer --password='<pw>' --database=homer \
  --access-client-id=<service token id> --access-client-secret=<service token secret>
```

Uncomment the `[[hyperdrive]]` block in `wrangler.toml` and put the printed id in it.

(Alternatively, set `DATABASE_URL` as a Pages secret pointing at a TLS-enabled,
publicly reachable Postgres. Hyperdrive is still recommended for pooling.)

## 5 · Pages environment variables

| Name | Value |
|---|---|
| `AUTH_SECRET` | 32+ random characters (`openssl rand -hex 32`). Signs session tokens; rotating it signs everyone out. |
| `HOMER_ADMIN_HASH` | unchanged: `sha256(lower(username) + ':' + password)` |
| `HOMER_OWNER_ID` | optional; skips the owner lookup |
| `OPENCLAW_URL` | `https://openclaw.b4it.ro`: Joey chat goes to the OpenClaw agent on Unraid |
| `OPENCLAW_TOKEN` | the OpenClaw gateway token (`gateway.auth.token` in `openclaw.json`) |
| `OPENCLAW_AGENT` | optional: `main` (default), `fast` or `heavy` |

Remove the old `SUPABASE_*` variables. When OpenClaw is set and doesn't answer within
15 s, Joey falls back to the OpenRouter setup (`OC_GATEWAY_URL`, `OC_GATEWAY_TOKEN`, `OC_MODEL`).

## 6 · Android

In `homer-android/local.properties`:

```
SYNC_ENABLED=true
HOMER_SYNC_USERNAME=bogdan
HOMER_SYNC_PASSWORD=<Homer password>
HOMER_BASE_URL=https://b4it.ro
```

---

## How auth works

`POST /api/auth {action:"signIn", username, password}` hashes the credentials
the same way the website does and compares the result to `HOMER_ADMIN_HASH`. On a
match it returns a Supabase-shaped session: an HS256 `access_token` valid for
30 days and a `refresh_token` valid for 180 days. `assets/homer-db.*.js`
stores the session and refreshes it a day before it expires.

`/api/db` only accepts the tables in its allowlist and always adds
`user_id = <token subject>`, so a token can never read or write another
account's rows.
