export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var { token, action, chatId, text, offset, limit, webhookUrl, update, botId, since } = req.body || {};
  if (!token && action !== 'forwardToWebhook' && action !== 'getMessages') {
    return res.status(400).json({ error: 'Missing bot token' });
  }

  var BASE = token ? 'https://api.telegram.org/bot' + token : '';

  // --- Redis helpers ---
  var REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  var REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  async function redis(cmd) {
    if (!REDIS_URL || !REDIS_TOKEN) return { result: null };
    var r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  }

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

    // --- Set up webhook proxy: intercept Telegram updates via telegram-hook.js ---
    if (action === 'setupProxy') {
      if (!botId) return res.status(400).json({ error: 'Missing botId' });
      if (!REDIS_URL || !REDIS_TOKEN) return res.json({ ok: false, error: 'Redis not configured' });

      // Build our interceptor URL
      var host = req.headers['x-forwarded-host'] || req.headers.host || '';
      var interceptorUrl = 'https://' + host + '/api/telegram-hook?bid=' + botId;

      // Get current webhook
      var whInfo = await tg('getWebhookInfo');
      var currentUrl = (whInfo.result && whInfo.result.url) || '';

      // If already pointing to our interceptor, read the original URL from Redis
      var originalUrl = currentUrl;
      if (currentUrl && currentUrl.includes('/api/telegram-hook')) {
        var existingCfg = await redis(['GET', 'homer:tgbot:' + botId + ':config']);
        var existing = existingCfg.result ? JSON.parse(existingCfg.result) : null;
        if (existing && existing.originalWebhookUrl) {
          originalUrl = existing.originalWebhookUrl;
        }
      }

      // Generate a secret token for webhook verification
      var secretToken = '';
      var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      for (var i = 0; i < 32; i++) secretToken += chars[Math.floor(Math.random() * chars.length)];

      // Store config in Redis so telegram-hook.js can read it
      var config = {
        botToken: token,
        originalWebhookUrl: originalUrl,
        secretToken: secretToken,
        chatId: chatId || ''
      };
      await redis(['SET', 'homer:tgbot:' + botId + ':config', JSON.stringify(config)]);

      // Register our interceptor as the bot's webhook (if not already set)
      var setRes = { ok: true };
      if (currentUrl !== interceptorUrl) {
        setRes = await tg('setWebhook', {
          url: interceptorUrl,
          secret_token: secretToken,
          allowed_updates: ['message']
        });
      }

      return res.json({
        ok: setRes.ok !== false,
        interceptorUrl: interceptorUrl,
        originalWebhookUrl: originalUrl,
        error: setRes.ok === false ? setRes.description : undefined
      });
    }

    // --- Read messages stored in Redis by telegram-hook.js ---
    if (action === 'getMessages') {
      if (!botId || !chatId) return res.json({ ok: true, messages: [] });
      if (!REDIS_URL || !REDIS_TOKEN) return res.json({ ok: true, messages: [] });

      var sinceIdx = parseInt(since) || 0;
      var key = 'homer:tgbot:' + botId + ':chat:' + chatId;
      var msgs = await redis(['LRANGE', key, sinceIdx, -1]);
      var parsed = (msgs.result || []).map(function(m) {
        try { return JSON.parse(m); } catch(e) { return null; }
      }).filter(Boolean);
      return res.json({ ok: true, messages: parsed, nextSince: sinceIdx + parsed.length });
    }

    // --- Remove webhook proxy, restore original ---
    if (action === 'removeProxy') {
      if (!botId) return res.status(400).json({ error: 'Missing botId' });
      if (REDIS_URL && REDIS_TOKEN) {
        var cfgRes = await redis(['GET', 'homer:tgbot:' + botId + ':config']);
        var cfgData = cfgRes.result ? JSON.parse(cfgRes.result) : null;
        if (cfgData && cfgData.originalWebhookUrl) {
          await tg('setWebhook', { url: cfgData.originalWebhookUrl });
        } else {
          await tg('deleteWebhook');
        }
      } else {
        await tg('deleteWebhook');
      }
      return res.json({ ok: true });
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

      // Also store the bot's inline response in Redis if available
      if (REDIS_URL && REDIS_TOKEN && botId && chatId && responseData) {
        var replyText = extractReply(responseData);
        if (replyText) {
          var rKey = 'homer:tgbot:' + botId + ':chat:' + chatId;
          await redis(['RPUSH', rKey, JSON.stringify({ dir: 'bot', text: replyText, ts: Date.now(), src: 'web' })]);
          await redis(['LTRIM', rKey, -500, -1]);
        }
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

function extractReply(wr) {
  if (!wr || typeof wr !== 'object') return null;
  if (wr.method === 'sendMessage' && wr.text) return wr.text;
  if (wr.text && !wr.method && !wr.ok) return wr.text;
  if (wr.result && wr.result.text) return wr.result.text;
  if (wr.message && typeof wr.message === 'object' && wr.message.text) return wr.message.text;
  if (wr.response && typeof wr.response === 'string') return wr.response;
  if (wr.reply && typeof wr.reply === 'string') return wr.reply;
  return null;
}
