export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(200).end();

  var REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  var REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(200).end();

  async function redis(cmd) {
    var r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  }

  var botId = req.query.bid;
  if (!botId) return res.status(200).end();

  try {
    var cfgRes = await redis(['GET', 'homer:tgbot:' + botId + ':config']);
    var config = cfgRes.result ? JSON.parse(cfgRes.result) : null;
    if (!config) return res.status(200).end();

    // Verify Telegram secret token
    var secret = req.headers['x-telegram-bot-api-secret-token'];
    if (config.secretToken && secret !== config.secretToken) {
      return res.status(403).end();
    }

    var update = req.body;
    if (!update) return res.status(200).end();

    // Non-message updates: forward to original webhook, pass through inline response
    if (!update.message) {
      if (config.originalWebhookUrl) {
        var fwd = await fetch(config.originalWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update)
        });
        try {
          var ct = fwd.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            var rd = await fwd.json();
            if (rd && rd.method) return res.status(200).json(rd);
          }
        } catch(e) {}
      }
      return res.status(200).end();
    }

    var msg = update.message;
    if (!msg.text) {
      // Non-text message: forward but don't store
      if (config.originalWebhookUrl) {
        await fetch(config.originalWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update)
        });
      }
      return res.status(200).end();
    }

    var chatId = String(msg.chat.id);
    var msgKey = 'homer:tgbot:' + botId + ':chat:' + chatId;

    // Store incoming user message
    var userMsg = {
      dir: 'user',
      text: msg.text,
      ts: msg.date ? msg.date * 1000 : Date.now()
    };
    await redis(['RPUSH', msgKey, JSON.stringify(userMsg)]);
    await redis(['LTRIM', msgKey, -500, -1]);

    // Forward to original webhook
    if (!config.originalWebhookUrl) return res.status(200).end();

    var fwdRes = await fetch(config.originalWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });

    // Capture inline response
    var responseData = null;
    try {
      var ct2 = fwdRes.headers.get('content-type') || '';
      if (ct2.includes('application/json')) {
        responseData = await fwdRes.json();
      } else {
        var txt = await fwdRes.text();
        try { responseData = JSON.parse(txt); } catch(e) {}
      }
    } catch(e) {}

    if (responseData) {
      var replyText = extractReply(responseData);
      if (replyText) {
        await redis(['RPUSH', msgKey, JSON.stringify({ dir: 'bot', text: replyText, ts: Date.now() })]);
      }
      // Return inline method call to Telegram for execution
      if (responseData.method) {
        return res.status(200).json(responseData);
      }
    }

    return res.status(200).end();
  } catch (err) {
    return res.status(200).end(); // Always 200 for Telegram
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
