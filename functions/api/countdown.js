/**
 * /api/countdown  — auth-free AI commentary for the Countdown gadget.
 * Calls the AI gateway server-side; no user JWT required.
 */

const SYSTEM =
  'You are a sharp, concise writer for a personal dashboard widget. ' +
  'Follow the tone instruction exactly. No disclaimers, no preamble, no labels. ' +
  'Output only the comment itself.';

const TONES = {
  sarcastic:
    'dry, sarcastic, slightly nihilistic. Mock the absurdity of counting down days. Be witty but not cruel.',
  motivational:
    'warm, healing, and genuinely motivational. Acknowledge the wait and reframe it as growth.',
  drama:
    'a full-blown drama queen — theatrical, over the top, soap-opera intense. Make it hilariously extra.',
  stoic:
    'a stoic philosopher. Brief, profound, detached. Marcus Aurelius energy. Quote-worthy.',
  chaotic:
    'chaotic and unhinged. Random tangents, weird energy, fourth-wall breaks. Funny and unpredictable.',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  if (request.method !== 'POST')
    return Response.json({ error: 'POST only' }, { status: 405, headers: CORS });

  let body;
  try { body = await request.json(); } catch (_) { body = {}; }

  const name   = String(body.name   || 'an upcoming event').slice(0, 120);
  const days   = Math.max(0, parseInt(body.days)  || 0);
  const hours  = Math.max(0, parseInt(body.hours) || 0);
  const mins   = Math.max(0, parseInt(body.mins)  || 0);
  const past   = body.past === true;
  const modeId = String(body.mode || 'sarcastic');
  const tone   = TONES[modeId] || TONES.sarcastic;

  const timeStr = past
    ? 'it has already passed'
    : `${days} days, ${hours} hours, ${mins} minutes`;

  const prompt =
    `Someone is counting down to "${name}". Time remaining: ${timeStr}. ` +
    `Write one punchy comment (1–3 sentences, max 50 words) in the voice of ${tone}`;

  const envGet = (k) =>
    String(env[k] || Object.entries(env || {}).find(([ek]) => ek.trim() === k)?.[1] || '').trim();

  const rawModel = envGet('OC_MODEL') || 'nemotron-3-super:cloud';
  const model = /^kimi-k2\.5(:cloud)?$/i.test(rawModel) ? 'kimi-k2.6:cloud' : rawModel;

  const isNemotron = /nemotron/i.test(model);
  const isCloud    = !isNemotron && /inclusionai|\/ring-|kimi|mistralai|google\//i.test(model);

  let gatewayUrl   = envGet('OC_GATEWAY_URL') || 'https://openrouter.ai/api/v1';
  let gatewayToken = envGet('OC_GATEWAY_TOKEN');

  if (isNemotron) {
    gatewayUrl   = envGet('NEMOCLAW_GATEWAY_URL') || gatewayUrl;
    gatewayToken = envGet('NEMOCLAW_GATEWAY_TOKEN') || gatewayToken;
  } else if (isCloud && !/openrouter\.ai/i.test(gatewayUrl)) {
    gatewayUrl   = 'https://openrouter.ai/api/v1';
    gatewayToken = envGet('OC_GATEWAY_TOKEN');
  }

  if (!gatewayToken && !isNemotron) {
    return Response.json({ error: 'Gateway not configured' }, { status: 503, headers: CORS });
  }

  let upstream;
  try {
    upstream = await fetch(`${gatewayUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken || 'ollama'}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 120,
        temperature: 0.85,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: prompt  },
        ],
      }),
    });
  } catch (e) {
    return Response.json({ error: 'Gateway unreachable', detail: String(e.message || '') }, { status: 502, headers: CORS });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return Response.json(
      { error: `Gateway error ${upstream.status}`, detail: detail.slice(0, 200) },
      { status: 502, headers: CORS },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
