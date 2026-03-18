import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  var REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  var MAX_VERSIONS = 10;

  function hashKey(passphrase) {
    return 'homer:' + crypto.createHash('sha256').update(passphrase).digest('hex');
  }

  function dataHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  async function redis(cmd) {
    var r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  }

  try {
    if (req.method === 'GET') {
      var key = req.query.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });

      var action = req.query.action || 'latest';
      var hk = hashKey(key);

      if (action === 'versions') {
        // Return version history metadata
        var metaResult = await redis(['GET', hk + ':meta']);
        var meta = metaResult.result ? JSON.parse(metaResult.result) : null;
        if (!meta) return res.status(200).json({ versions: [] });
        return res.status(200).json({ versions: meta.versions || [] });
      }

      if (action === 'restore-version') {
        // Restore a specific version by timestamp
        var ts = req.query.ts;
        if (!ts) return res.status(400).json({ error: 'Missing ts parameter' });
        var vResult = await redis(['GET', hk + ':v:' + ts]);
        if (!vResult.result) {
          return res.status(404).json({ error: 'Version not found' });
        }
        return res.status(200).json({ data: JSON.parse(vResult.result), ts: parseInt(ts) });
      }

      // Default: return latest backup
      var result = await redis(['GET', hk]);
      if (!result.result) {
        return res.status(404).json({ error: 'No backup found for this passphrase' });
      }

      // Also get metadata for timestamp info
      var metaRes = await redis(['GET', hk + ':meta']);
      var metaData = metaRes.result ? JSON.parse(metaRes.result) : {};

      return res.status(200).json({
        data: JSON.parse(result.result),
        ts: metaData.lastTs || null,
        dataHash: metaData.lastDataHash || null,
        versionCount: metaData.versions ? metaData.versions.length : 0
      });
    }

    if (req.method === 'POST') {
      var body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body.key || !body.data) return res.status(400).json({ error: 'Missing key or data' });

      var hk = hashKey(body.key);
      var now = Date.now();
      var newDataHash = dataHash(body.data);

      // Get current metadata
      var metaRes = await redis(['GET', hk + ':meta']);
      var meta = metaRes.result ? JSON.parse(metaRes.result) : { versions: [] };

      // Check if data actually changed
      if (meta.lastDataHash === newDataHash) {
        // Data hasn't changed - update timestamp but skip full backup
        meta.lastTs = now;
        await redis(['SET', hk + ':meta', JSON.stringify(meta)]);
        return res.status(200).json({
          ok: true,
          ts: now,
          skipped: true,
          reason: 'Data unchanged',
          dataHash: newDataHash,
          versionCount: meta.versions.length
        });
      }

      // Data changed - perform full versioned backup
      var dataStr = JSON.stringify(body.data);

      // 1. Save current backup to latest
      await redis(['SET', hk, dataStr]);

      // 2. Save versioned snapshot
      await redis(['SET', hk + ':v:' + now, dataStr]);

      // 3. Update metadata with new version
      meta.versions.push({
        ts: now,
        dataHash: newDataHash,
        size: dataStr.length,
        keyCount: Object.keys(body.data).length
      });

      // 4. Trim old versions - keep only last MAX_VERSIONS
      if (meta.versions.length > MAX_VERSIONS) {
        var toRemove = meta.versions.splice(0, meta.versions.length - MAX_VERSIONS);
        // Delete old version snapshots from Redis
        for (var i = 0; i < toRemove.length; i++) {
          await redis(['DEL', hk + ':v:' + toRemove[i].ts]);
        }
      }

      meta.lastTs = now;
      meta.lastDataHash = newDataHash;

      // 5. Save updated metadata
      await redis(['SET', hk + ':meta', JSON.stringify(meta)]);

      return res.status(200).json({
        ok: true,
        ts: now,
        dataHash: newDataHash,
        versionCount: meta.versions.length
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
