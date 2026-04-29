/**
 * cf-vercel-adapter.js
 *
 * Creates mock Vercel-style req/res objects from a Cloudflare Pages Request,
 * so existing lib handlers that use the (req, res) pattern can run unchanged.
 *
 * Supports:
 *   - res.setHeader / res.status / res.json / res.send / res.end
 *   - res.write (streaming via TransformStream)
 *   - res.headersSent
 *   - req.method, req.headers, req.body, req.query
 */

export async function createVercelAdapter(request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);

  // Parse body once
  let body = null;
  const ct = request.headers.get('content-type') || '';
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (ct.includes('application/json')) {
      try { body = await request.json(); } catch (e) { body = {}; }
    } else {
      try { body = await request.text(); } catch (e) { body = ''; }
    }
  }

  // Build req object
  const req = {
    method: request.method,
    url: request.url,
    query,
    body,
    headers: new Proxy({}, {
      get(_, prop) {
        const key = typeof prop === 'string' ? prop.toLowerCase() : prop;
        return request.headers.get(key) || undefined;
      }
    })
  };

  // Streaming support
  let transformController = null;
  let isStream = false;
  let readableStream = null;

  // Response state
  const responseHeaders = new Headers();
  let statusCode = 200;
  let headersSent = false;
  let ended = false;

  // For non-streaming: collect body chunks
  const chunks = [];

  // Build res object
  const res = {
    get headersSent() { return headersSent; },

    setHeader(name, value) {
      responseHeaders.set(name, String(value));
      return res;
    },

    status(code) {
      statusCode = code;
      return res;
    },

    json(data) {
      if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', 'application/json');
      }
      const body = JSON.stringify(data);
      chunks.push(body);
      headersSent = true;
      ended = true;
      return res;
    },

    send(data) {
      if (data !== null && data !== undefined) {
        chunks.push(typeof data === 'string' ? data : String(data));
      }
      headersSent = true;
      ended = true;
      return res;
    },

    end(data) {
      if (data !== null && data !== undefined) {
        if (isStream && transformController) {
          const chunk = typeof data === 'string' ? new TextEncoder().encode(data) : data;
          try { transformController.enqueue(chunk); } catch (e) {}
        } else {
          chunks.push(typeof data === 'string' ? data : String(data));
        }
      }
      headersSent = true;
      ended = true;
      if (isStream && transformController) {
        try { transformController.terminate(); } catch (e) {}
      }
      return res;
    },

    write(data) {
      // On first write, switch to streaming mode
      if (!isStream) {
        isStream = true;
        const ts = new TransformStream();
        transformController = ts.writable.getWriter();
        readableStream = ts.readable;
      }
      headersSent = true;
      const chunk = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      try {
        transformController.write(chunk);
      } catch (e) {}
      return res;
    }
  };

  // getResponse waits for the handler to complete then returns a CF Response
  function getResponse() {
    if (isStream && readableStream) {
      // Streaming response — pipe the readable stream
      // Ensure stream is closed if end() wasn't called
      return new Response(readableStream, {
        status: statusCode,
        headers: responseHeaders
      });
    }

    // Non-streaming
    const body = chunks.join('');
    if (!responseHeaders.has('Content-Type') && body) {
      // Try to detect JSON
      const trimmed = body.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        responseHeaders.set('Content-Type', 'application/json');
      }
    }
    return new Response(body || null, {
      status: statusCode,
      headers: responseHeaders
    });
  }

  return { req, res, getResponse };
}
