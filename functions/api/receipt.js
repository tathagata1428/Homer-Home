import { getGoogleDriveConfig } from '../../lib/joey-server.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (env && typeof env === 'object') Object.assign(process.env, env);

  const origin = request.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const { fileName, mimeType, size, base64Data } = body;
  if (!fileName || !base64Data) return Response.json({ error: 'Missing file data' }, { status: 400, headers: corsHeaders });

  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig(env);
  if (!gdriveWebhook) return Response.json({ error: 'GDRIVE_WEBHOOK_URL not configured' }, { status: 500, headers: corsHeaders });
  if (!gdriveSecret) return Response.json({ error: 'GDRIVE_SECRET not configured' }, { status: 500, headers: corsHeaders });

  function sanitizeFileName(name) {
    return String(name || 'receipt.jpg').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 180) || 'receipt.jpg';
  }

  const id = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  const uploadedAt = new Date().toISOString();
  const safeName = sanitizeFileName(fileName);

  const payload = {
    action: 'upload_file',
    secret: gdriveSecret,
    mode: 'personal',
    file: {
      id,
      name: safeName,
      mimeType: String(mimeType || 'image/jpeg'),
      size: Number(size) || 0,
      uploadedAt,
      base64Data: String(base64Data),
      extractedText: ''
    }
  };

  let rawResponse;
  try {
    // Google Apps Script Web Apps redirect POST → follow manually keeping POST+body
    rawResponse = await fetch(gdriveWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
  } catch (err) {
    return Response.json({ error: 'Webhook fetch failed', detail: err.message }, { status: 502, headers: corsHeaders });
  }

  let responseText;
  try { responseText = await rawResponse.text(); } catch { responseText = ''; }

  let parsed;
  try { parsed = JSON.parse(responseText); } catch {
    return Response.json({
      error: 'Non-JSON from Drive webhook',
      httpStatus: rawResponse.status,
      responsePreview: responseText.slice(0, 300)
    }, { status: 502, headers: corsHeaders });
  }

  if (!parsed || parsed.error) {
    return Response.json({
      error: 'Drive webhook error',
      detail: (parsed && parsed.error) || 'Unknown error',
      hint: parsed && parsed.hint
    }, { status: 502, headers: corsHeaders });
  }

  return Response.json({ ok: true, file: { id, name: safeName }, drive: parsed }, { status: 200, headers: corsHeaders });
}
