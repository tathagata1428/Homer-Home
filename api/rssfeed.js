import https from 'https';
import http from 'http';

function fetchURL(url, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 3;
  return new Promise(function(resolve, reject) {
    var mod = url.startsWith('https') ? https : http;
    var parsed = new URL(url);
    var opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    };
    var req = mod.get(opts, function(res) {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && maxRedirects > 0) {
        var loc = res.headers.location;
        if (loc.startsWith('/')) {
          var u = new URL(url);
          loc = u.protocol + '//' + u.host + loc;
        }
        fetchURL(loc, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks).toString('utf8')); });
    });
    req.on('error', reject);
    req.setTimeout(10000, function() { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseRSS(xml) {
  var items = [];
  var itemRx = /<item>([\s\S]*?)<\/item>/gi;
  var m;
  while ((m = itemRx.exec(xml)) !== null) {
    var block = m[1];
    var title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
    var link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    var pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    var desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || '';
    var thumb = (block.match(/<enclosure[^>]*url="([^"]*)"/) || [])[1] || '';
    if (!thumb) thumb = (block.match(/<media:thumbnail[^>]*url="([^"]*)"/) || [])[1] || '';
    if (!thumb) thumb = (block.match(/<media:content[^>]*url="([^"]*)"/) || [])[1] || '';
    // strip HTML from description
    desc = desc.replace(/<[^>]*>/g, '').trim().slice(0, 300);
    title = title.replace(/<[^>]*>/g, '').trim();
    link = link.replace(/<[^>]*>/g, '').trim();
    items.push({ title, link, pubDate, description: desc, thumbnail: thumb });
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var rssUrl = req.query.url;
  if (!rssUrl) return res.status(400).json({ error: 'Missing url param' });

  // Only allow known RSS domains
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
    var xml = await fetchURL(rssUrl);
    var items = parseRSS(xml);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ items });
  } catch(err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
