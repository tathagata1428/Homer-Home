/**
 * GET /api/config
 *
 * Returns public (browser-safe) configuration values needed by the frontend.
 * Only the ANON key is exposed here — NEVER the service-role key.
 *
 * The response is injected into the page via a <script> tag that sets
 * window.__SUPABASE_URL__ and window.__SUPABASE_ANON_KEY__.
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url     = String(process.env.SUPABASE_URL      || '').trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();

  if (req.query && req.query.format === 'js') {
    // Return as an inline script snippet for use in <script> tags
    res.setHeader('Content-Type', 'application/javascript');
    return res.status(200).send(
      `window.__SUPABASE_URL__="${url.replace(/"/g, '')}";` +
      `window.__SUPABASE_ANON_KEY__="${anonKey.replace(/"/g, '')}";`
    );
  }

  return res.status(200).json({
    supabaseUrl:     url,
    supabaseAnonKey: anonKey
  });
}
