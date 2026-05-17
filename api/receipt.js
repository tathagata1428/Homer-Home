import crypto from 'crypto';
import { fetchWithRedirects, getGoogleDriveConfig } from '../lib/joey-server.js';

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fileName, mimeType, size, base64Data } = req.body || {};
  if (!fileName || !base64Data) return res.status(400).json({ error: 'Missing file data' });

  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig();
  if (!gdriveWebhook) return res.status(500).json({ error: 'GDRIVE_WEBHOOK_URL not configured' });
  if (!gdriveSecret) return res.status(500).json({ error: 'GDRIVE_SECRET not configured' });

  function sanitizeFileName(name) {
    return String(name || 'receipt.jpg').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 180) || 'receipt.jpg';
  }

  try {
    const binary = Buffer.from(String(base64Data || ''), 'base64');
    const id = 'file_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
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
        size: Number(size) || binary.length,
        uploadedAt,
        base64Data: binary.toString('base64'),
        extractedText: ''
      }
    };

    const response = await fetchWithRedirects(gdriveWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.text) {
      return res.status(response.status || 502).json({ error: response.error || 'No response from Drive webhook' });
    }

    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      return res.status(502).json({
        error: 'Non-JSON response from Google',
        status: response.status,
        responsePreview: response.text.slice(0, 300)
      });
    }

    if (parsed.error) {
      return res.status(502).json({ error: 'Google Script rejected the request', detail: parsed.error });
    }

    return res.status(200).json({ ok: true, file: { id, name: safeName }, drive: parsed });
  } catch (err) {
    return res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
}
