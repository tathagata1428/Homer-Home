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

    // Auth — passphrase required
    const passphrase = request.headers.get('X-Sync-Key');
    if (!passphrase) {
      return Response.json({ error: 'Missing X-Sync-Key' }, { status: 401, headers: cors });
    }

    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase));
    const userHash = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
    const prefix = userHash + '/';

    const url = new URL(request.url);
    const path = url.pathname;

    try {
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
