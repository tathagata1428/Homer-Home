# Supabase Setup Guide

Zero-cost, fully-persistent backend for Homer-Home.

---

## 1 · Create the Supabase project

1. Go to <https://supabase.com> → **New project**
2. Choose the free plan, pick the region closest to you
3. Note down:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY`
   (Settings → API)

---

## 2 · Run the schema

Open the Supabase **SQL Editor** and paste the full contents of
`supabase/schema.sql`, then click **Run**.

This creates all tables with Row Level Security enabled.

---

## 3 · Create your Supabase Auth user

In the Supabase dashboard → **Authentication → Users → Add user**.

- Use your regular email (`bogdan.radu@b4it.ro` or any email you prefer)
- Set a strong password
- After creation, copy the **User UUID** (you'll need it as `SUPABASE_OWNER_ID`)

---

## 4 · Set environment variables

Add these to your Vercel project settings (or `.env.local` for local dev):

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...          # public / anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... # secret — never expose to browser
SUPABASE_OWNER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # your user UUID
```

Keep the existing Redis vars (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) in
place during the migration period — they are used as the auth fallback and
for the commit handler.

---

## 5 · Migrate existing data (one-time)

After deploying with the new env vars, run the migration from the browser
console or any HTTP client:

```bash
curl -X POST https://your-app.vercel.app/api/migrate \
  -H 'Content-Type: application/json' \
  -d '{"passphrase":"<your_password_hash>", "dryRun": true}'
```

`dryRun: true` shows what would be migrated without writing.
Remove `dryRun` (or set it to `false`) to execute the real migration.

The migration copies:
- Chat history → `messages` table
- Memories → `memories` table
- Profile → `profiles` table
- Journal → `journal` table
- Context files, file library, custom files, sync meta → `joey_meta` table

---

## 6 · Sign in with Supabase Auth (new devices)

```js
// Browser – sign in once, then store the session
const { data } = await fetch('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'signIn', email: '...', password: '...' })
}).then(r => r.json());

localStorage.setItem('sb_session', JSON.stringify(data.session));
```

Then send requests to Joey with:
```
Authorization: Bearer <data.session.access_token>
```

The old `passphrase` field still works during the transition.

---

## 7 · Enable Realtime subscriptions (frontend)

Load the Supabase JS library (CDN — add once to `index.html` before your bundle):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script>
  const sbClient = supabase.createClient(
    'https://xxxxxxxxxxxx.supabase.co',
    'your_anon_key'
  );

  // Restore session from storage
  const savedSession = JSON.parse(localStorage.getItem('sb_session') || 'null');
  if (savedSession) {
    sbClient.auth.setSession(savedSession);
  }

  // Subscribe to new messages
  sbClient
    .channel('messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: 'mode=eq.personal'
    }, payload => {
      console.log('New message:', payload.new);
      // Update UI here
    })
    .subscribe();

  // Subscribe to memory changes
  sbClient
    .channel('memories')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'memories'
    }, payload => {
      console.log('Memory change:', payload);
    })
    .subscribe();

  window.__supabase = sbClient;  // expose for the app bundle
</script>
```

---

## 8 · Cutover order

Follow this order to stay safe:

1. ✅ Supabase project created (steps 1-3)
2. ✅ Env vars added + deployed (step 4)
3. ✅ Data migrated from Redis (step 5)
4. ✅ Test Joey from a fresh browser tab — all history/memories should load
5. ✅ Add Supabase SDK to `index.html`, sign in, subscribe to Realtime
6. ⬜ Once verified, set `DISABLE_REDIS_WRITE=true` to stop writing to Redis
7. ⬜ Add Telegram client (calls the same `/api/joey` endpoint with JWT auth)

---

## 9 · Final architecture

```
Browser / Telegram / Any client
        │
        │  HTTPS  (JWT or passphrase)
        ▼
   Vercel Serverless Functions  (/api/joey, /api/auth, …)
        │
        │  @supabase/supabase-js  (service-role key)
        ▼
   Supabase Postgres
   ├── messages     (chat history — Realtime enabled)
   ├── memories     (learned facts — Realtime enabled)
   ├── profiles     (Joey profile per mode)
   ├── tasks        (task list — Realtime enabled)
   ├── journal      (change log)
   └── joey_meta    (files, library, sync_meta blobs)
```

Redis is kept only as a short-term auth fallback and for the GDrive backup paths.
Once step 6 is done, Redis can be removed entirely.

---

## Free tier limits (Supabase)

| Resource         | Free limit          |
|------------------|---------------------|
| Database size    | 500 MB              |
| Rows             | Unlimited           |
| API calls        | Unlimited           |
| Realtime msgs    | 200 concurrent      |
| Auth users       | Unlimited           |
| Edge Functions   | 500K invocations/mo |

For a personal assistant with one user and a few hundred messages/memories,
the free tier is more than enough.
