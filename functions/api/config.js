/**
 * GET /api/config
 *
 * Returns public (browser-safe) configuration values needed by the frontend.
 * Only the ANON key is exposed here — NEVER the service-role key.
 */
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = String(env.SUPABASE_URL || '').trim();
  const anonKey = String(env.SUPABASE_ANON_KEY || '').trim();

  const { searchParams } = new URL(request.url);

  if (searchParams.get('format') === 'js') {
    return new Response(
      `window.__SUPABASE_URL__="${url.replace(/"/g, '')}";` +
      `window.__SUPABASE_ANON_KEY__="${anonKey.replace(/"/g, '')}";`,
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/javascript'
        }
      }
    );
  }

  return Response.json({ supabaseUrl: url, supabaseAnonKey: anonKey }, {
    status: 200,
    headers: corsHeaders
  });
}
