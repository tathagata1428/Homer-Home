export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var { token, action, chatId, text, offset, limit, webhookUrl, update } = req.body || {};
  if (!token && action !== 'forwardToWebhook') return res.status(400).json({ error: 'Missing bot token' });

  var BASE = token ? 'https://api.telegram.org/bot' + token : '';

  async function tg(method, body) {
    var r = await fetch(BASE + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return r.json();
  }

  try {
    if (action === 'getMe') {
      return res.json(await tg('getMe'));
    }

    if (action === 'sendMessage') {
      if (!chatId || !text) return res.status(400).json({ error: 'Missing chatId or text' });
      return res.json(await tg('sendMessage', {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      }));
    }

    if (action === 'getUpdates') {
      var params = { timeout: 0, allowed_updates: ['message'] };
      if (offset) params.offset = offset;
      if (limit) params.limit = limit;
      return res.json(await tg('getUpdates', params));
    }

    if (action === 'getWebhookInfo') {
      return res.json(await tg('getWebhookInfo'));
    }

    if (action === 'deleteWebhook') {
      return res.json(await tg('deleteWebhook'));
    }

    // Forward a fake update to the bot's webhook URL and capture the response
    if (action === 'forwardToWebhook') {
      if (!webhookUrl || !update) {
        return res.status(400).json({ error: 'Missing webhookUrl or update' });
      }

      var r = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });

      // The bot's webhook may return an inline method call (e.g. sendMessage)
      var contentType = r.headers.get('content-type') || '';
      var responseData = null;

      if (contentType.includes('application/json')) {
        responseData = await r.json();
      } else {
        var txt = await r.text();
        // Some bots return JSON without proper content-type
        try { responseData = JSON.parse(txt); } catch(e) { responseData = txt; }
      }

      return res.json({
        ok: true,
        status: r.status,
        webhookResponse: responseData
      });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
