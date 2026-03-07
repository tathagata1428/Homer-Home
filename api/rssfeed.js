export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var rssUrl = req.query.url;
  if (!rssUrl) return res.status(400).json({ error: 'Missing url param' });

  var hostname;
  try { hostname = new URL(rssUrl).hostname; } catch(e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  var allowed = [
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
    'www.lesechos.fr', 'lesechos.fr'
  ];

  if (!allowed.includes(hostname)) {
    return res.status(403).json({ error: 'Host not allowed: ' + hostname });
  }

  try {
    var r = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9,ro;q=0.8',
      },
      redirect: 'follow',
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var xml = await r.text();
    var items = parseRSS(xml);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ items });
  } catch(err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

function parseRSS(xml) {
  var items = [];
  var itemRx = /<item>([\s\S]*?)<\/item>/gi;
  var m;
  while ((m = itemRx.exec(xml)) !== null) {
    var block = m[1];
    var title = extract(block, 'title');
    var link = extract(block, 'link');
    var pubDate = extract(block, 'pubDate');
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
  // Try CDATA first, then plain
  var rx1 = new RegExp('<' + tag + '><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + tag + '>', 'i');
  var rx2 = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'i');
  var m = block.match(rx1) || block.match(rx2);
  var val = m ? m[1].trim() : '';
  return val.replace(/<[^>]*>/g, '').trim();
}
