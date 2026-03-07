import https from 'https';

function fetchURL(url) {
  return new Promise(function(resolve, reject) {
    const req = https.get(url, function(res) {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchURL(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve(data); });
    });
    req.on('error', reject);
    req.setTimeout(8000, function() { req.destroy(); reject(new Error('Timeout')); });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || !/^UC[\w-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid channel ID: ' + id });
  }

  try {
    const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + id;
    const xml = await fetchURL(feedUrl);

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

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ videos });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
