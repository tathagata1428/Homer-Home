export async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id || !/^UC[\w-]{22}$/.test(id)) {
    return Response.json({ error: 'Invalid channel ID: ' + id }, { status: 400, headers: corsHeaders });
  }

  try {
    const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + id;
    const r = await fetch(feedUrl, {
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const xml = await r.text();

    const videos = [];
    const entryRx = /<entry>([\s\S]*?)<\/entry>/g;
    let m;
    while ((m = entryRx.exec(xml)) !== null) {
      const block = m[1];
      const vidId = (block.match(/<yt:videoId>([^<]+)/) || [])[1] || '';
      const title = (block.match(/<media:title>([^<]+)/) || [])[1] || '';
      const published = (block.match(/<published>([^<]+)/) || [])[1] || '';
      if (vidId) videos.push({ vidId, title, date: published.split('T')[0] });
    }

    return Response.json({ videos }, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Unknown error' }, { status: 500, headers: corsHeaders });
  }
}
