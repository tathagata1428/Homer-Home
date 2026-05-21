import { getJoeyContextEnv } from '../../lib/joey-context.js';
import {
  buildActiveSystemPromptPart,
  buildSearchGroundingPart,
  buildSearchRulesPart,
  handleJoeyGatewayRequest
} from '../../lib/joey-chat-handler.js';
import { createVercelAdapter } from '../../lib/cf-vercel-adapter.js';
import {
  isSupabaseConfigured,
  isSupabaseClientConfigured,
  createAdminClient,
  resolveSupabaseOwnerId,
  verifySupabaseJwt
} from '../../lib/supabase-server.js';

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
    const parts = Array.isArray(candidate && candidate.content && candidate.content.parts) ? candidate.content.parts : [];
    const text = parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).filter(Boolean).join('\n').trim();
    if (text) return cleanTranscript(text);
  }
  return '';
}

async function handleTranscribe(request, env) {
  const origin = request.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  const geminiKey = String(env.GEMINI_API_KEY || '').trim();
  if (!geminiKey) {
    return Response.json({ ok: false, error: 'GEMINI_API_KEY not configured' }, { status: 500, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  const audioBase64 = String(body.audioBase64 || '').trim();
  const mimeType = String(body.mimeType || 'audio/webm').trim();
  const language = String(body.language || '').trim();
  if (!audioBase64) {
    return Response.json({ ok: false, error: 'Missing audio data' }, { status: 400, headers: corsHeaders });
  }
  if (audioBase64.length > 18 * 1024 * 1024) {
    return Response.json({ ok: false, error: 'Audio payload too large' }, { status: 413, headers: corsHeaders });
  }

  const model = String(env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.0-flash').trim();
  const prompt =
    'Transcribe the spoken words from this audio recording. ' +
    'Return only the transcript text, with normal punctuation. ' +
    'Do not add labels, speaker names, commentary, or markdown.' +
    (language ? (' The speaker language hint is: ' + language + '.') : '');

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(geminiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: audioBase64 } }] }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = (payload && payload.error && (payload.error.message || payload.error.status)) || ('HTTP ' + response.status);
      return Response.json({ ok: false, error: String(detail || 'Transcription failed') }, { status: response.status || 502, headers: corsHeaders });
    }

    const transcript = extractGeminiText(payload);
    if (!transcript) {
      return Response.json({ ok: true, transcript: '', model, warning: 'No transcript text returned' }, { status: 200, headers: corsHeaders });
    }
    return Response.json({ ok: true, transcript, model }, { status: 200, headers: corsHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error && error.message ? error.message : 'Transcription request failed' }, { status: 502, headers: corsHeaders });
  }
}

// Fetch live personal data from Supabase for every Joey request.
// Returns a concise markdown string injected into the system prompt.
// Never throws — returns '' on any error.
async function fetchLivePersonalContext(jwtToken) {
  try {
    if (!isSupabaseConfigured()) return '';

    let userId = null;
    if (jwtToken && isSupabaseClientConfigured()) {
      const user = await verifySupabaseJwt(jwtToken).catch(() => null);
      if (user) userId = user.id;
    }
    if (!userId) userId = await resolveSupabaseOwnerId().catch(() => null);
    if (!userId) return '';

    const supabase = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

    const [habitsRes, completionsRes, tasksRes, journalRes, focusRes, fieldsRes] = await Promise.all([
      supabase.from('habits').select('id,name,emoji,freq,archived').eq('user_id', userId).eq('archived', false).order('display_order', { ascending: true }).limit(30),
      supabase.from('habit_completions').select('habit_id,date').eq('user_id', userId).gte('date', sevenDaysAgo).limit(300),
      supabase.from('tasks').select('title,status,priority,due_at').eq('user_id', userId).not('status', 'in', '("done","cancelled")').order('created_at', { ascending: false }).limit(20),
      supabase.from('journal').select('ts,text').eq('user_id', userId).eq('type', 'entry').neq('text', '').order('ts', { ascending: false }).limit(5),
      supabase.from('focus_sessions').select('task_label,duration_secs,created_at').eq('user_id', userId).gte('created_at', twoDaysAgo).order('created_at', { ascending: false }).limit(10),
      supabase.from('field_state').select('field_id,value').eq('user_id', userId).in('field_id', ['homer-notes', 'homer-inbox', 'ls:homer-expenses']),
    ]);

    const parts = [];
    parts.push('=== LIVE PERSONAL DATA — ' + new Date().toISOString().slice(0, 16) + 'Z ===');
    parts.push('(Fetched live from your database on every message. Use this for personalized, context-aware responses.)');

    // Habits — today's completion status + streak
    const habits = habitsRes.data || [];
    const completions = completionsRes.data || [];
    if (habits.length) {
      const todayDone = new Set(completions.filter(c => c.date === today).map(c => c.habit_id));
      parts.push('\n[HABITS — ' + today + ']');
      for (const h of habits) {
        const done = todayDone.has(h.id);
        const habitDates = [...new Set(completions.filter(c => c.habit_id === h.id).map(c => c.date))].sort().reverse();
        let streak = 0, checkDate = today;
        while (habitDates.includes(checkDate)) {
          streak++;
          checkDate = new Date(new Date(checkDate).getTime() - 86400000).toISOString().slice(0, 10);
        }
        const freq = typeof h.freq === 'string' ? h.freq : (Array.isArray(h.freq) ? 'custom' : 'daily');
        parts.push('• ' + (h.emoji || '') + ' ' + h.name + ' (' + freq + ') — ' + (done ? '✓ done' : '✗ not done') + (streak > 1 ? ' [' + streak + 'd streak]' : ''));
      }
    }

    // Active tasks
    const tasks = tasksRes.data || [];
    if (tasks.length) {
      parts.push('\n[ACTIVE TASKS — ' + tasks.length + ' open]');
      for (const t of tasks.slice(0, 15)) {
        const due = t.due_at ? ' [due ' + t.due_at.slice(0, 10) + ']' : '';
        const prio = t.priority && t.priority !== 'medium' ? ' [' + t.priority + ']' : '';
        parts.push('• [' + (t.status || 'pending') + ']' + prio + ' ' + (t.title || '') + due);
      }
    }

    // Journal — recent entries
    const journal = journalRes.data || [];
    if (journal.length) {
      parts.push('\n[RECENT JOURNAL ENTRIES]');
      for (const e of journal) {
        const date = e.ts ? new Date(Number(e.ts)).toISOString().slice(0, 10) : '?';
        const excerpt = String(e.text || '').replace(/\n/g, ' ').slice(0, 160);
        parts.push('• ' + date + ': ' + excerpt + (e.text && e.text.length > 160 ? '…' : ''));
      }
    }

    // Focus sessions — last 48h
    const focus = focusRes.data || [];
    if (focus.length) {
      const totalMin = Math.round(focus.reduce((a, s) => a + (s.duration_secs || 0), 0) / 60);
      parts.push('\n[FOCUS — last 48h: ' + focus.length + ' sessions, ' + totalMin + 'min total]');
      for (const s of focus.slice(0, 5)) {
        const min = Math.round((s.duration_secs || 0) / 60);
        parts.push('• ' + (s.task_label || 'Focus') + ' — ' + min + 'min on ' + (s.created_at || '').slice(0, 10));
      }
    }

    // Notes & inbox from field_state
    const fields = fieldsRes.data || [];
    const notesField = fields.find(f => f.field_id === 'homer-notes');
    const inboxField = fields.find(f => f.field_id === 'homer-inbox');
    if (notesField && notesField.value) {
      try {
        const notes = JSON.parse(notesField.value);
        const list = Array.isArray(notes) ? notes : [];
        if (list.length) {
          parts.push('\n[NOTES — ' + list.length + ' total, last 3]');
          for (const n of list.slice(-3).reverse()) {
            parts.push('• ' + String(n.title || n.text || '').slice(0, 100));
          }
        }
      } catch (_) {}
    }
    if (inboxField && inboxField.value) {
      try {
        const inbox = JSON.parse(inboxField.value);
        const pending = (Array.isArray(inbox) ? inbox : []).filter(i => !i.done && !i.deleted);
        if (pending.length) {
          parts.push('\n[INBOX — ' + pending.length + ' pending]');
          for (const i of pending.slice(0, 5)) {
            parts.push('• ' + String(i.text || i.title || '').slice(0, 100));
          }
        }
      } catch (_) {}
    }

    return parts.join('\n');
  } catch (e) {
    console.warn('[openclaw] fetchLivePersonalContext error:', e.message);
    return '';
  }
}

function buildOpenClawSystemParts(context) {
  const {
    mode, largeContext, forceFullContext, forceWebSearch, needsSearch,
    systemPromptOverride, profileText, memoriesText, filesText,
    searchContext, searchState, searchProvider, clampText,
    liveDataText
  } = context;
  const systemParts = [];
  const joeyContext = getJoeyContextEnv(mode, process.env);

  systemParts.push(buildActiveSystemPromptPart(systemPromptOverride, forceFullContext));
  if (joeyContext) systemParts.push(clampText(joeyContext, forceFullContext ? (largeContext ? 22000 : 11000) : (largeContext ? 16000 : 6000)));
  if (profileText) systemParts.push(clampText(profileText, filesText ? (largeContext ? 2600 : 1800) : (largeContext ? 4200 : 2200)));
  if (memoriesText) systemParts.push(clampText(memoriesText, filesText ? (forceFullContext ? (largeContext ? 9000 : 4200) : (largeContext ? 4200 : 2200)) : (forceFullContext ? (largeContext ? 16000 : 6400) : (largeContext ? 9000 : 3200))));
  if (filesText) systemParts.push(clampText(filesText, forceFullContext ? (largeContext ? 68000 : 26000) : (largeContext ? 36000 : 12000)));
  if (liveDataText) systemParts.push(clampText(liveDataText, largeContext ? 4000 : 2500));
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

  const modelId = String(process.env.OC_MODEL || 'inclusionai/ring-2.6-1t:free').trim();
  systemParts.push(`=== MODEL IDENTITY ===\n- Your underlying model is: ${modelId}.\n- If the user asks what model or AI you are, answer naturally and honestly (e.g. "I'm running on Ring-2.6-1T by InclusionAI via OpenRouter"). Do not claim to be GPT, Claude, or any other model.`);

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

export async function onRequest(context) {
  const { request, env } = context;
  // Make CF env vars available via process.env for libs that read process.env directly
  if (env && typeof env === 'object') {
    Object.assign(process.env, env);
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('action') === 'transcribe') {
    return handleTranscribe(request, env);
  }
  if (searchParams.get('action') === 'debug') {
    const envGet = (k) => {
      if (env[k] != null) return String(env[k]).trim();
      const found = Object.entries(env || {}).find(([ek]) => ek.trim() === k);
      return found ? String(found[1]).trim() : '';
    };
    const rawPersonalUrl = envGet('OC_PERSONAL_GATEWAY_URL');
    const rawGatewayUrl  = envGet('OC_GATEWAY_URL');
    const model = (function(m) {
      m = String(m || '').trim();
      if (!m) m = 'inclusionai/ring-2.6-1t:free';
      if (/^kimi-k2\.5(:cloud)?$/i.test(m)) m = 'kimi-k2.6:cloud';
      return m;
    })(envGet('OC_MODEL') || 'inclusionai/ring-2.6-1t:free');
    let resolvedUrl = rawPersonalUrl || rawGatewayUrl || 'https://openrouter.ai/api/v1';
    const isNemotron = /nemotron/i.test(model);
    const isCloud = !isNemotron && /inclusionai|\/ring-|kimi|mistralai|google\//i.test(model);
    const isLocal  = !/openrouter\.ai/i.test(resolvedUrl);
    if (isNemotron) {
      resolvedUrl = envGet('NEMOCLAW_GATEWAY_URL') || resolvedUrl;
    } else if (isCloud && isLocal) {
      resolvedUrl = 'https://openrouter.ai/api/v1';
    }
    return Response.json({
      ok: true,
      resolvedGatewayUrl: resolvedUrl,
      rawPersonalUrl, rawGatewayUrl,
      model, isNemotron, isCloudModel: isCloud, wouldRedirect: isCloud && isLocal,
      hasToken: !!(envGet('OC_GATEWAY_TOKEN') || envGet('OC_PERSONAL_GATEWAY_TOKEN')),
      envKeys: Object.keys(env || {})
    });
  }

  // Extract JWT from Authorization header (doesn't consume the body)
  const authHeader = String(request.headers.get('authorization') || '');
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  // Fetch live Supabase context and create Vercel adapter in parallel
  const [{ req, res, getResponse }, liveDataText] = await Promise.all([
    createVercelAdapter(request),
    fetchLivePersonalContext(jwtToken)
  ]);

  await handleJoeyGatewayRequest(req, res, {
    getProviderConfig({ env: e }) {
      // Trim all env key lookups — OC_GATEWAY_URL has a trailing space in CF dashboard
      const envGet = (k) => String(e[k] || e[k.trim()] || Object.entries(e || {}).find(([ek]) => ek.trim() === k.trim())?.[1] || '').trim();
      const primaryModel = (function(m) {
        m = String(m || '').trim();
        if (!m) m = 'inclusionai/ring-2.6-1t:free';
        if (/^kimi-k2\.5(:cloud)?$/i.test(m)) m = 'kimi-k2.6:cloud';
        return m;
      })(envGet('OC_MODEL') || 'inclusionai/ring-2.6-1t:free');

      let gatewayUrl   = envGet('OC_PERSONAL_GATEWAY_URL') || envGet('OC_GATEWAY_URL') || 'https://openrouter.ai/api/v1';
      let gatewayToken = envGet('OC_PERSONAL_GATEWAY_TOKEN') || envGet('OC_GATEWAY_TOKEN');

      if (/nemotron/i.test(primaryModel)) {
        // Nemotron runs on Ollama — share the NemoClaw gateway
        gatewayUrl   = envGet('NEMOCLAW_GATEWAY_URL') || gatewayUrl;
        gatewayToken = envGet('NEMOCLAW_GATEWAY_TOKEN') || gatewayToken;
      } else {
        // Cloud models (ring, kimi, inclusionai, etc.) must go to OpenRouter, not a local tunnel
        const isCloudModel   = /inclusionai|\/ring-|kimi|mistralai|google\//i.test(primaryModel);
        const isLocalGateway = !/openrouter\.ai/i.test(gatewayUrl);
        if (isCloudModel && isLocalGateway) {
          gatewayUrl   = 'https://openrouter.ai/api/v1';
          gatewayToken = envGet('OC_GATEWAY_TOKEN') || envGet('OC_PERSONAL_GATEWAY_TOKEN');
        }
      }

      // Fallback model tried automatically on 429 / rate-limit
      const fallbackModel = /inclusionai|ring/i.test(primaryModel)
        ? 'meta-llama/llama-3.3-70b-instruct:free'
        : '';
      return { gatewayUrl, gatewayToken, primaryModel, fallbackModel, largeContext: true };
    },
    getFallbackGatewayConfig({ env: e }) {
      const localModel = String(e.OC_FALLBACK_MODEL || '').trim();
      // Reject empty, nemotron, or any cloud-only model as a local fallback
      if (!localModel || /nemotron|kimi|ring|inclusionai/i.test(localModel)) return null;
      return {
        gatewayUrl: String(e.OC_PERSONAL_GATEWAY_URL || e.OC_GATEWAY_URL || 'http://localhost:11434').trim(),
        gatewayToken: String(e.OC_PERSONAL_GATEWAY_TOKEN || e.OC_GATEWAY_TOKEN || '').trim(),
        primaryModel: localModel
      };
    },
    buildSystemParts(systemContext) {
      return buildOpenClawSystemParts({ ...systemContext, liveDataText });
    },
    getBackfillLimit({ forceFullContext, largeContext }) {
      return forceFullContext ? (largeContext ? 72 : 24) : (largeContext ? 48 : 12);
    },
    buildUpstreamBody({ modelName, finalMessages }) {
      return {
        model: modelName,
        messages: finalMessages,
        stream: true,
        max_tokens: 8000,
        temperature: 0.15
      };
    },
    gatewayErrorMessage: 'Cannot reach gateway'
  });
  return getResponse();
}
