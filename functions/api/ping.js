export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) {
    return Response.json({ error: 'Missing url param' }, { status: 400, headers: corsHeaders });
  }

  try {
    const r = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000)
    });
    return Response.json({ ok: r.ok, status: r.status }, { status: 200, headers: corsHeaders });
  } catch (err) {
    return Response.json({ ok: false, error: err.message || 'Request failed' }, { status: 200, headers: corsHeaders });
  }
}
