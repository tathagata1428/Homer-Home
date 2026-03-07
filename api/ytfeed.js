export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || !/^UC[\w-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid channel ID' });
  }

  try {
    const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + id;
    const r = await fetch(feedUrl);
    if (!r.ok) throw new Error('YouTube returned ' + r.status);
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

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ videos });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
