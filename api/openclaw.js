import { getJoeyContextEnv } from '../lib/joey-context.js';
import {
  buildActiveSystemPromptPart,
  buildSearchGroundingPart,
  buildSearchRulesPart,
  handleJoeyGatewayRequest
} from '../lib/joey-chat-handler.js';

function cleanTranscript(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/, '');
  }
  text = text.replace(/^Transcript:\s*/i, '').trim();
  return text;
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload && payload.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate && candidate.content && candidate.content.parts)
      ? candidate.content.parts
      : [];
    const text = parts
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) return cleanTranscript(text);
  }
  return '';
}

async function handleTranscribe(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!geminiKey) {
    return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY not configured' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const audioBase64 = String(body.audioBase64 || '').trim();
  const mimeType = String(body.mimeType || 'audio/webm').trim();
  const language = String(body.language || '').trim();
  if (!audioBase64) {
    return res.status(400).json({ ok: false, error: 'Missing audio data' });
  }
  if (audioBase64.length > 18 * 1024 * 1024) {
    return res.status(413).json({ ok: false, error: 'Audio payload too large' });
  }

  const model = String(process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.0-flash').trim();
  const prompt =
    'Transcribe the spoken words from this audio recording. ' +
    'Return only the transcript text, with normal punctuation. ' +
    'Do not add labels, speaker names, commentary, or markdown.' +
    (language ? (' The speaker language hint is: ' + language + '.') : '');

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) +
        ':generateContent?key=' +
        encodeURIComponent(geminiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1
          }
        })
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        (payload && payload.error && (payload.error.message || payload.error.status)) ||
        ('HTTP ' + response.status);
      return res.status(response.status || 502).json({ ok: false, error: String(detail || 'Transcription failed') });
    }

    const transcript = extractGeminiText(payload);
    if (!transcript) {
      return res.status(200).json({ ok: true, transcript: '', model, warning: 'No transcript text returned' });
    }

    return res.status(200).json({ ok: true, transcript, model });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error && error.message ? error.message : 'Transcription request failed'
    });
  }
}

function buildOpenClawSystemParts(context) {
  const {
    mode,
    largeContext,
    forceFullContext,
    forceWebSearch,
    needsSearch,
    systemPromptOverride,
    profileText,
    memoriesText,
    filesText,
    searchContext,
    searchState,
    searchProvider,
    clampText
  } = context;
  const systemParts = [];
  const joeyContext = getJoeyContextEnv(mode, process.env);

  systemParts.push(buildActiveSystemPromptPart(systemPromptOverride, forceFullContext));
  if (joeyContext) {
    systemParts.push(clampText(joeyContext, forceFullContext ? (largeContext ? 22000 : 11000) : (largeContext ? 16000 : 6000)));
  }
  if (profileText) {
    systemParts.push(clampText(
      profileText,
      filesText
        ? (largeContext ? 2600 : 1800)
        : (largeContext ? 4200 : 2200)
    ));
  }
  if (memoriesText) {
    systemParts.push(clampText(
      memoriesText,
      filesText
        ? (forceFullContext ? (largeContext ? 9000 : 4200) : (largeContext ? 4200 : 2200))
        : (forceFullContext ? (largeContext ? 16000 : 6400) : (largeContext ? 9000 : 3200))
    ));
  }
  if (filesText) systemParts.push(clampText(filesText, forceFullContext ? (largeContext ? 68000 : 26000) : (largeContext ? 36000 : 12000)));
  if (searchContext) systemParts.push(clampText(searchContext, largeContext ? 6000 : 2800));

  systemParts.push(`
=== PERSONALIZATION INSTRUCTIONS ===
- You have a profile and memories about this person. USE THEM NATURALLY.
- Treat the CANONICAL PROFILE FILES as your working memory and source of truth for this person.
- Reference things you know: ask about their goals, mention their people by name, recall past conversations.
- Adapt your tone to their communication_style and current_mood.
- If they seem stressed, be supportive. If they're in a good mood, match their energy.
- Don't announce "I remember that..." - just naturally use what you know, like a real friend would.
- Track the time: it's currently ${new Date().toISOString()}. Greet appropriately (morning/afternoon/evening) for their timezone.
- If they mention something new about themselves, you'll automatically remember it (your memory system handles this).
- Build on previous conversations - reference what you discussed before when relevant.
- Be concrete, not generic: tie suggestions to their current projects, open loops, wins, lessons, decisions, and relationships when relevant.
- Prefer using one or two highly relevant personal details well instead of dumping broad memory.
- If context points to an ongoing thread, continue it proactively instead of restarting from zero.
- Act like this person's long-term operator: learn their defaults, standards, people, and recurring patterns so your help feels specific to them rather than generic.`);

  systemParts.push(`
=== MODE ISOLATION ===
- Personal mode and Work mode are separate memory domains.
- Use only the context, memories, files, profile, and history supplied for the current mode.
- Never reveal, summarize, hint at, or rely on information from the other mode.
- If the user asks for information that belongs to the other mode, refuse briefly and tell them to switch modes.`);

  if (mode === 'work') {
    systemParts.push(`
=== WORK MODE ===
- You are in Joey Work mode.
- Treat the supplied context as a work operating system: tasks, deadlines, blockers, follow-ups, owners, meetings, decisions, docs, and reusable procedures.
- Optimize for recall and execution: surface the next action, name blockers, keep deadlines concrete, and preserve continuity across projects.
- When the user asks to save something, strongly prefer work-oriented memory categories such as work, decision, resource, win, lesson, or pin.
- Keep responses sharp and operational. Be more like a strong chief of staff than a general companion.
- Do not answer from personal-only assumptions unless that detail exists inside the current work context.`);
  } else {
    systemParts.push(`
=== PERSONAL MODE ===
- You are in Joey Personal mode.
- Do not infer or import work-only tasks, stakeholders, deadlines, or private work facts unless they exist inside the current personal context.`);
  }

  if (largeContext) {
    systemParts.push(`
=== LARGE-CONTEXT MODE ===
- You have enough context to synthesize across files, memories, profile, and prior conversation. Use that advantage.
- Read across AgentContext, Today, OpenLoops, Projects, Areas, People, Wins, Lessons, Decisions, Tasks, User, and Memory when relevant.
- Prioritize high-signal personal continuity: what matters now, who matters, what is blocked, what recently worked, and what they are trying to become.
- When giving advice or drafting something, anchor it in the user's actual context before general knowledge.`);
  }

  systemParts.push(buildSearchRulesPart(searchState, searchProvider, forceWebSearch, forceFullContext));
  systemParts.push(buildSearchGroundingPart(needsSearch));
  return systemParts.filter(Boolean);
}

export default async function handler(req, res) {
  if (req.query && req.query.action === 'transcribe') {
    return handleTranscribe(req, res);
  }
  return handleJoeyGatewayRequest(req, res, {
    getProviderConfig({ mode, env, providerHint }) {
      if (providerHint === 'alicloud') {
        const primaryModel = String(env.OC_ALICLOUD_MODEL || 'qwen3-coder:480b-cloud').trim();
        return {
          gatewayUrl: String(env.OC_ALICLOUD_GATEWAY_URL || env.OC_GATEWAY_URL || '').trim(),
          gatewayToken: String(env.OC_ALICLOUD_GATEWAY_TOKEN || env.OC_ALICLOUD_TOKEN || env.OC_GATEWAY_TOKEN || '').trim(),
          primaryModel,
          fallbackModel: '',
          largeContext: true
        };
      }
      const isWork = mode === 'work';
      const primaryModel = String(
        isWork
          ? (env.OC_WORK_MODEL || 'minimax-m2.7:cloud')
          : (env.OC_PERSONAL_MODEL || env.KIMI_MODEL || env.OC_MODEL || 'kimi-k2.5:cloud')
      ).trim();
      const fallbackModel = '';
      const isLargeCtx = /minimax-m2\.7:cloud/i.test(primaryModel) || /kimi(?:-k)?2?\.?5/i.test(primaryModel);
      return {
        gatewayUrl: String(
          isWork
            ? (env.OC_WORK_GATEWAY_URL || env.OC_GATEWAY_URL || 'https://api.kilo.ai/api/gateway')
            : (env.OC_PERSONAL_GATEWAY_URL || env.NEMOCLAW_GATEWAY_URL || env.OC_GATEWAY_URL || 'http://localhost:11434')
        ).trim(),
        gatewayToken: String(
          isWork
            ? (env.OC_WORK_GATEWAY_TOKEN || env.OC_GATEWAY_TOKEN || '')
            : (env.OC_PERSONAL_GATEWAY_TOKEN || env.NEMOCLAW_GATEWAY_TOKEN || env.OC_GATEWAY_TOKEN || '')
        ).trim(),
        primaryModel,
        fallbackModel,
        largeContext: isLargeCtx
      };
    },
    buildSystemParts: buildOpenClawSystemParts,
    getBackfillLimit({ forceFullContext, largeContext }) {
      return forceFullContext ? (largeContext ? 72 : 24) : (largeContext ? 48 : 12);
    },
    buildUpstreamBody({ modelName, finalMessages }) {
      const isKimi = /kimi(?:-k)?2?\.?5/i.test(modelName);
      const isMiniMax = /minimax-m2\.7:cloud/i.test(modelName);
      const isQwen = /qwen/i.test(modelName);
      return {
        model: modelName,
        messages: finalMessages,
        stream: true,
        max_tokens: isKimi ? 8000 : isMiniMax ? 4600 : isQwen ? 6000 : 1800,
        temperature: isMiniMax ? 0.2 : isQwen ? 0.1 : 0.15
      };
    },
    gatewayErrorMessage: 'Cannot reach gateway'
  });
}
