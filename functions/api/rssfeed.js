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
  const rssUrl = searchParams.get('url');
  if (!rssUrl) {
    return Response.json({ error: 'Missing url param' }, { status: 400, headers: corsHeaders });
  }

  let hostname;
  try { hostname = new URL(rssUrl).hostname; } catch (e) {
    return Response.json({ error: 'Invalid URL' }, { status: 400, headers: corsHeaders });
  }

  const allowed = [
    'www.profit.ro', 'profit.ro',
    'www.digi24.ro', 'digi24.ro',
    'www.hotnews.ro', 'hotnews.ro',
    'www.mediafax.ro', 'mediafax.ro',
    'www.zf.ro', 'zf.ro',
    'adevarul.ro', 'www.adevarul.ro',
    'www.libertatea.ro', 'libertatea.ro',
    'www.g4media.ro', 'g4media.ro',
    'www.wall-street.ro', 'wall-street.ro',
    'www.economica.net', 'economica.net',
    'stirileprotv.ro', 'www.stirileprotv.ro',
    'www.romania-insider.com', 'romania-insider.com',
    'www.bursa.ro', 'bursa.ro',
    'feeds.bbci.co.uk',
    'www.reutersagency.com', 'reutersagency.com',
    'rss.cnn.com',
    'www.aljazeera.com', 'aljazeera.com',
    'www.theguardian.com', 'theguardian.com',
    'www.france24.com', 'france24.com',
    'rss.dw.com',
    'feeds.npr.org',
    'techcrunch.com', 'www.techcrunch.com',
    'feeds.arstechnica.com',
    'www.investing.com', 'investing.com',
    'feeds.marketwatch.com',
    'finance.yahoo.com',
    'www.ft.com', 'ft.com',
    'www.cnbc.com', 'cnbc.com',
    'www.ecb.europa.eu', 'ecb.europa.eu',
    'www.euronews.com', 'euronews.com',
    'www.handelsblatt.com', 'handelsblatt.com',
    'www.lesechos.fr', 'lesechos.fr',
    'news.google.com'
  ];

  if (!allowed.includes(hostname)) {
    return Response.json({ error: 'Host not allowed: ' + hostname }, { status: 403, headers: corsHeaders });
  }

  try {
    const r = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9,ro;q=0.8',
      },
      redirect: 'follow',
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const xml = await r.text();
    const items = parseRSS(xml);
    return Response.json({ items }, {
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

function parseRSS(xml) {
  var items = [];
  var itemRx = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  var m;
  while ((m = itemRx.exec(xml)) !== null) {
    var block = m[1];
    var title = extract(block, 'title');
    var link = extract(block, 'link');
    var pubDate = extract(block, 'pubDate') || extract(block, 'dc:date');
    var desc = extract(block, 'description');
    var thumb = (block.match(/<enclosure[^>]*url="([^"]*)"/) || [])[1] || '';
    if (!thumb) thumb = (block.match(/<media:thumbnail[^>]*url="([^"]*)"/) || [])[1] || '';
    if (!thumb) thumb = (block.match(/<media:content[^>]*url="([^"]*)"/) || [])[1] || '';
    desc = desc.replace(/<[^>]*>/g, '').trim().slice(0, 300);
    items.push({ title, link, pubDate, description: desc, thumbnail: thumb });
  }
  return items;
}

function extract(block, tag) {
  var rx1 = new RegExp('<' + tag + '><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + tag + '>', 'i');
  var rx2 = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'i');
  var m = block.match(rx1) || block.match(rx2);
  var val = m ? m[1].trim() : '';
  return val.replace(/<[^>]*>/g, '').trim();
}
