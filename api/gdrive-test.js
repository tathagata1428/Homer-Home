// Test endpoint for Google Drive integration
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GDRIVE_WEBHOOK = (process.env.GDRIVE_WEBHOOK_URL || '').trim();
  const GDRIVE_SECRET = (process.env.GDRIVE_SECRET || '').trim();

  // Test POST to Google Script with simple payload
  const testPayload = {
    secret: GDRIVE_SECRET,
    test: true,
    timestamp: new Date().toISOString()
  };

  try {
    const gRes = await fetch(GDRIVE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    const gData = await gRes.text();
    
    return res.status(200).json({
      webhookUrl: GDRIVE_WEBHOOK.slice(0, 60) + '...',
      secretLength: GDRIVE_SECRET.length,
      secretFirst10: GDRIVE_SECRET.slice(0, 10),
      secretLast10: GDRIVE_SECRET.slice(-10),
      googleStatus: gRes.status,
      googleResponse: gData.slice(0, 500)
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      webhookUrl: GDRIVE_WEBHOOK.slice(0, 60) + '...',
      secretLength: GDRIVE_SECRET.length
    });
  }
}
