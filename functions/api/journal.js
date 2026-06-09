/**
 * Journal AI API — generates writing prompts and entry reflections.
 * POST /api/journal  { action: 'prompt' | 'reflect', entry?: string }
 * Uses OC_GATEWAY_URL / OC_GATEWAY_TOKEN / OC_MODEL env vars (OpenRouter).
 */
export async function onRequest(context) {
  const { request, env } = context;
  if (env && typeof env === 'object') Object.assign(process.env, env);

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });

  const model        = String(env.OC_MODEL          || process.env.OC_MODEL         || 'inclusionai/ring-2.6-1t:free').trim();
  const isNemotron   = /nemotron/i.test(model);

  const gatewayUrl   = isNemotron
    ? String(env.NEMOCLAW_GATEWAY_URL   || process.env.NEMOCLAW_GATEWAY_URL   || env.OC_GATEWAY_URL || process.env.OC_GATEWAY_URL || '').trim()
    : String(env.OC_GATEWAY_URL         || process.env.OC_GATEWAY_URL         || '').trim();
  // For nemotron (Ollama), token is optional — Ollama accepts any Bearer value
  const gatewayToken = isNemotron
    ? String(env.NEMOCLAW_GATEWAY_TOKEN || process.env.NEMOCLAW_GATEWAY_TOKEN || 'none').trim()
    : String(env.OC_GATEWAY_TOKEN       || process.env.OC_GATEWAY_TOKEN       || '').trim();

  if (!gatewayUrl || (!isNemotron && !gatewayToken)) {
    return Response.json({ error: 'AI gateway not configured' }, { status: 503, headers: cors });
  }

  let body;
  try { body = await request.json(); } catch (_) { body = {}; }
  const action = String(body.action || '').trim();

  let systemPrompt, userPrompt;

  if (action === 'prompt') {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    systemPrompt = 'You are a thoughtful journaling coach. Generate a single, engaging, personal journal writing prompt appropriate for the ' + timeOfDay + '. The prompt should encourage self-reflection and deeper thinking. Respond with ONLY the prompt text — no quotes, no preamble, no explanation.';
    userPrompt   = 'Give me a journal prompt for this ' + timeOfDay + '.';

  } else if (action === 'reflect') {
    const entry = String(body.entry || '').trim();
    if (entry.length < 20) return Response.json({ error: 'Entry too short' }, { status: 400, headers: cors });
    systemPrompt = `You are an empathetic journaling coach. Analyze the journal entry and respond ONLY with a JSON object with these exact keys:
{"mood": "one of Happy/Excited/Reflective/Sad/Anxious/Frustrated",
 "themes": "2-4 key themes as comma-separated words",
 "insight": "one thoughtful observation in 1-2 sentences",
 "affirmation": "one warm, personal affirmation in 1 sentence"}`;
    userPrompt = entry;

  } else {
    return Response.json({ error: 'Unknown action' }, { status: 400, headers: cors });
  }

  try {
    const aiRes = await fetch(gatewayUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + gatewayToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens: action === 'prompt' ? 120 : 400,
        temperature: 0.8,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '');
      return Response.json({ error: 'AI gateway error: ' + aiRes.status, detail: errText }, { status: 502, headers: cors });
    }

    const aiData  = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content?.trim() || '';

    if (action === 'prompt') {
      return Response.json({ ok: true, prompt: content }, { headers: cors });
    }

    // reflect: extract JSON from possible markdown fences
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ ok: true, reflection: { insight: content, affirmation: '', mood: '', themes: '' } }, { headers: cors });
    let reflection;
    try { reflection = JSON.parse(jsonMatch[0]); } catch (_) { reflection = { insight: content, affirmation: '', mood: '', themes: '' }; }
    return Response.json({ ok: true, reflection }, { headers: cors });

  } catch (err) {
    return Response.json({ error: err.message || 'Unknown error' }, { status: 500, headers: cors });
  }
}
