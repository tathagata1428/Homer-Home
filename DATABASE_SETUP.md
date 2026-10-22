# Database setup

Homer stores synced data in its own PostgreSQL database (previously Supabase).
The browser and the Android app never connect to Postgres directly: they call
the Pages Functions (`/api/auth`, `/api/db`, `/api/sync`, `/api/joey`, …), which
connect through Cloudflare Hyperdrive.

```
browser / Android ──HTTPS──▶ Pages Functions ──Hyperdrive──▶ Workers VPC service ──▶ Unraid tunnel (cloudflared) ──▶ postgresql16
```

Cross-device updates use polling: the browser asks `/api/db` for changed rows
every 10 s while the tab is visible, and Android does the same while the app is
in the foreground.

Current setup (all on the Cloudflare account that owns `b4it.ro`):

| Piece | Value |
|---|---|
| Database | `homer` on the Unraid `postgresql16` container (role `homer`), password in `/mnt/user/appdata/homer-home/setup.env` |
| TLS | self-signed `server.crt`/`server.key` in the container's data dir, `ssl = on` |
| Workers VPC service | `homer-postgres` (`01a161e4-eb18-7df3-b987-1fe5891f9239`): tcp `postgresql16:5432` via tunnel `9272bf37-…` (the Unraid `cloudflared`), cert verification off |
| Hyperdrive | `homer-db` (`3e57700378e843a2b281783a0bc5ecc0`), **caching disabled** so polling sees fresh rows |

Port 5432 is not exposed to the internet; Cloudflare reaches the container only
through the tunnel (`cloudflared` and `postgresql16` share the `proxynet` network).
If Unraid or its internet connection is down, sync and Joey history are unavailable.

---

## 1 · Create the database

Use a separate database and role (the container also hosts Nextcloud and EspoCRM):

```bash
docker exec -i postgresql16 psql -U bogdan -d postgres <<'SQL'
CREATE ROLE homer LOGIN PASSWORD '<strong password>';
CREATE DATABASE homer OWNER homer;
SQL
```

## 2 · Apply the schema and create the owner account

```bash
set -a; . /mnt/user/appdata/homer-home/setup.env; set +a
npm run db:schema
```

This is safe to run again after schema changes.

## 3 · Copy the data from Supabase (one time, optional)

```bash
SUPABASE_URL=https://fwzxxrldxnlhcyulkwrg.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
SUPABASE_OWNER_ID=<uuid> \
DATABASE_URL=postgres://homer:<pw>@127.0.0.1:5432/homer \
npm run db:migrate-from-supabase -- --dry-run     # then without --dry-run
```

Rows are re-owned by the local owner account, and rows that already exist are
skipped, so re-running it is safe.

## 4 · Connect Cloudflare to the database

Hyperdrive requires TLS on the origin. Enable it once with a self-signed cert:

```bash
docker exec -u postgres postgresql16 sh -c 'cd /var/lib/postgresql/data && openssl req -new -x509 -days 3650 -nodes -subj "/CN=postgresql16" -keyout server.key -out server.crt && chmod 600 server.key'
docker exec postgresql16 psql -U bogdan -d postgres -c "ALTER SYSTEM SET ssl = on" -c "SELECT pg_reload_conf()"
```

Then (logged in with `npx wrangler login`):

```bash
npx wrangler vpc service create homer-postgres --type tcp --tunnel-id <unraid tunnel id> \
  --hostname postgresql16 --tcp-port 5432 --app-protocol postgresql --cert-verification-mode disabled
npx wrangler hyperdrive create homer-db --service-id <vpc service id> \
  --database homer --user homer --password '<pw>' --caching-disabled
```

Put the Hyperdrive id in the `[[hyperdrive]]` block of `wrangler.toml`.

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
