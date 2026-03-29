const DATA_KEYS = [
  'motivator.savedQuotes.v1', 'homer-quotes-seen', 'homer-quotes-cache',
  'pom.settings.v1', 'pom.tasks.v1', 'pom.state.v1',
  'homer-brain-dump', 'homer-links', 'homer-zen-goal',
  'homer-cal-events', 'homer-cal-ics',
  'homer-cal-events:personal', 'homer-cal-events:work',
  'homer-cal-ics:personal', 'homer-cal-ics:work',
];

const ESSENTIAL_KEYS = ['homer-cal-events', 'homer-cal-events:personal', 'homer-cal-events:work', 'homer-brain-dump', 'homer-links', 'pom.tasks.v1'];

function buildBackupMeta(data) {
  const meta = { dataKeyCount: 0, essentialCount: 0 };
  for (const key of DATA_KEYS) {
    if (data && data[key]) meta.dataKeyCount++;
  }
  for (const key of ESSENTIAL_KEYS) {
    if (data && data[key]) meta.essentialCount++;
  }
  return meta;
}

export default {
  async fetch(request, env) {
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key, X-Filename, X-Mimetype, X-Goal-Idx, X-Subtask-Idx',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-Filename, X-Mimetype' };

    // Auth — passphrase from header or JSON body (sendBeacon can't set headers)
    let passphrase = request.headers.get('X-Sync-Key');
    let parsedBody = null;

    const url = new URL(request.url);
    const path = url.pathname;

    // For POST /sync: parse body early so we can extract auth key if needed
    if (!passphrase && request.method === 'POST' && path === '/sync') {
      try {
        parsedBody = await request.clone().json();
        passphrase = parsedBody.key || null;
      } catch (e) {}
    }

    if (!passphrase) {
      return Response.json({ error: 'Missing X-Sync-Key' }, { status: 401, headers: cors });
    }

    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase));
    const userHash = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
    const prefix = userHash + '/';

    try {
      // === BACKUP/SYNC ENDPOINTS ===

      // GET /sync/ts — lightweight timestamp check (no data download)
      if (request.method === 'GET' && path === '/sync/ts') {
        const backupData = await env.BACKUPS.get(userHash);
        if (!backupData) {
          return Response.json({ ts: 0, keyCount: 0, dataKeyCount: 0, essentialCount: 0 }, { headers: cors });
        }
        const backup = JSON.parse(backupData);
        const meta = backup.meta || buildBackupMeta(backup.data || {});
        return Response.json({
          ts: backup.ts || 0,
          keyCount: backup.data ? Object.keys(backup.data).length : 0,
          dataKeyCount: meta.dataKeyCount || 0,
          essentialCount: meta.essentialCount || 0,
        }, { headers: cors });
      }

      // GET /sync or /versions — retrieve backup or list versions
      if (request.method === 'GET' && (path === '/sync' || path === '/versions')) {
        const backupData = await env.BACKUPS.get(userHash);
        if (!backupData) {
          return Response.json({ error: 'No backup found' }, { status: 404, headers: cors });
        }
        const backup = JSON.parse(backupData);
        
        // Return different format for /sync vs legacy /api/sync compatibility
        if (path === '/versions') {
          // Return version history
          const versionList = backup.versions || [{ts: backup.ts, size: JSON.stringify(backup.data).length}];
          // Backfill keyCount for older versions that don't have it
          if (backup.data) {
            const kc = Object.keys(backup.data).length;
            for (const v of versionList) {
              if (!v.keyCount) v.keyCount = kc;
            }
          }
          return Response.json({ versions: versionList }, { headers: cors });
        }
        
        // /sync returns full data in same format as old API
        return Response.json({
          data: backup.data,
          ts: backup.ts,
          versionCount: backup.versions?.length || 1
        }, { headers: cors });
      }

      // GET /restore — restore specific version (returns latest for now)
      if (request.method === 'GET' && path === '/restore') {
        const backupData = await env.BACKUPS.get(userHash);
        if (!backupData) {
          return Response.json({ error: 'No backup found' }, { status: 404, headers: cors });
        }
        const backup = JSON.parse(backupData);
        return Response.json({
          data: backup.data,
          ts: backup.ts
        }, { headers: cors });
      }

      // POST /sync — save backup
      if (request.method === 'POST' && path === '/sync') {
        let body;
        try {
          body = parsedBody || await request.json();
        } catch (e) {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: cors });
        }
        
        if (!body.data) {
          return Response.json({ error: 'Missing data' }, { status: 400, headers: cors });
        }
        
        // Get existing backup for versioning
        const existing = await env.BACKUPS.get(userHash);
        let versions = [];
        if (existing) {
          try {
            const parsed = JSON.parse(existing);
            versions = parsed.versions || [{ts: parsed.ts, size: JSON.stringify(parsed.data).length}];
          } catch (e) {}
        }
        
        // Add new version
        const now = Date.now();
        versions.push({
          ts: now,
          size: JSON.stringify(body.data).length,
          keyCount: Object.keys(body.data).length
        });
        
        // Keep only last 10 versions
        if (versions.length > 10) {
          versions = versions.slice(-10);
        }
        
        const backup = {
          data: body.data,
          ts: now,
          versions: versions,
          meta: buildBackupMeta(body.data),
        };
        
        await env.BACKUPS.put(userHash, JSON.stringify(backup));
        return Response.json({ 
          ok: true, 
          ts: now,
          versionCount: versions.length
        }, { headers: cors });
      }

      // === ATTACHMENT ENDPOINTS (existing) ===

      // POST /upload — store encrypted blob in R2
      if (request.method === 'POST' && path === '/upload') {
        const len = parseInt(request.headers.get('content-length') || '0');
        if (len > 26214400) {
          return Response.json({ error: 'File too large (max 25MB)' }, { status: 413, headers: cors });
        }

        const id = crypto.randomUUID();
        const body = await request.arrayBuffer();

        await env.ATTACHMENTS.put(prefix + id, body, {
          customMetadata: {
            filename: request.headers.get('X-Filename') || 'unknown',
            mimetype: request.headers.get('X-Mimetype') || 'application/octet-stream',
            uploaded: new Date().toISOString(),
            goalIdx: request.headers.get('X-Goal-Idx') || '',
            subtaskIdx: request.headers.get('X-Subtask-Idx') || '',
          },
        });

        return Response.json({ ok: true, id }, { headers: cors });
      }

      // GET /download/:id — retrieve encrypted blob
      if (request.method === 'GET' && path.startsWith('/download/')) {
        const id = path.slice('/download/'.length);
        if (!id) return Response.json({ error: 'Missing id' }, { status: 400, headers: cors });

        const obj = await env.ATTACHMENTS.get(prefix + id);
        if (!obj) return Response.json({ error: 'Not found' }, { status: 404, headers: cors });

        return new Response(obj.body, {
          headers: {
            ...cors,
            'Content-Type': 'application/octet-stream',
            'X-Filename': obj.customMetadata?.filename || '',
            'X-Mimetype': obj.customMetadata?.mimetype || '',
          },
        });
      }

      // GET /list — list all user's attachments
      if (request.method === 'GET' && path === '/list') {
        const listed = await env.ATTACHMENTS.list({ prefix, limit: 1000 });
        const items = listed.objects.map(obj => ({
          id: obj.key.replace(prefix, ''),
          size: obj.size,
          uploaded: obj.uploaded,
          filename: obj.customMetadata?.filename || '',
          mimetype: obj.customMetadata?.mimetype || '',
          goalIdx: obj.customMetadata?.goalIdx || '',
          subtaskIdx: obj.customMetadata?.subtaskIdx || '',
        }));
        return Response.json({ ok: true, items }, { headers: cors });
      }

      // DELETE /delete/:id — remove an attachment
      if (request.method === 'DELETE' && path.startsWith('/delete/')) {
        const id = path.slice('/delete/'.length);
        if (!id) return Response.json({ error: 'Missing id' }, { status: 400, headers: cors });

        await env.ATTACHMENTS.delete(prefix + id);
        return Response.json({ ok: true }, { headers: cors });
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: cors });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: cors });
    }
  },
};
