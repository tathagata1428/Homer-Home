import { getJoeyContextEnv } from '../lib/joey-context.js';
import {
  buildActiveSystemPromptPart,
  buildSearchGroundingPart,
  buildSearchRulesPart,
  handleJoeyGatewayRequest
} from '../lib/joey-chat-handler.js';

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
    systemParts.push(clampText(joeyContext, forceFullContext ? (largeContext ? 12000 : 6000) : (largeContext ? 8000 : 3000)));
  }
  if (profileText && (largeContext || !filesText)) systemParts.push(clampText(profileText, largeContext ? 2400 : 1200));
  if (memoriesText && (largeContext || !filesText)) {
    systemParts.push(clampText(memoriesText, forceFullContext ? (largeContext ? 8000 : 3200) : (largeContext ? 4000 : 1800)));
  }
  if (filesText) systemParts.push(clampText(filesText, forceFullContext ? (largeContext ? 44000 : 18000) : (largeContext ? 22000 : 8000)));
  if (searchContext) systemParts.push(clampText(searchContext, largeContext ? 3600 : 2000));

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
- If context points to an ongoing thread, continue it proactively instead of restarting from zero.`);

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
=== MIMO LARGE-CONTEXT MODE ===
- MiMo-V2-Pro has enough context to synthesize across files, memories, profile, and prior conversation. Use that advantage.
- Read across AgentContext, Today, OpenLoops, Projects, Areas, People, Wins, Lessons, Decisions, Tasks, User, and Memory when relevant.
- Prioritize high-signal personal continuity: what matters now, who matters, what is blocked, what recently worked, and what they are trying to become.
- When giving advice or drafting something, anchor it in the user's actual context before general knowledge.`);
  }

  systemParts.push(buildSearchRulesPart(searchState, searchProvider, forceWebSearch, forceFullContext));
  systemParts.push(buildSearchGroundingPart(needsSearch));
  return systemParts.filter(Boolean);
}

export default async function handler(req, res) {
  return handleJoeyGatewayRequest(req, res, {
    getProviderConfig({ env }) {
      const primaryModel = String(env.OC_MODEL || 'xiaomi/mimo-v2-pro:free').trim();
      const fallbackModel = 'llama-3.1-8b-instant';
      return {
        gatewayUrl: String(env.OC_GATEWAY_URL || 'https://api.kilo.ai/api/gateway').trim(),
        gatewayToken: String(env.OC_GATEWAY_TOKEN || '').trim(),
        primaryModel,
        fallbackModel,
        largeContext: /mimo-v2-pro/i.test(primaryModel) || /mimo-v2-pro/i.test(fallbackModel)
      };
    },
    buildSystemParts: buildOpenClawSystemParts,
    getBackfillLimit({ forceFullContext, largeContext }) {
      return forceFullContext ? (largeContext ? 40 : 16) : (largeContext ? 24 : 8);
    },
    buildUpstreamBody({ modelName, finalMessages }) {
      const isMimo = /mimo-v2-pro/i.test(modelName);
      return {
        model: modelName,
        messages: finalMessages,
        stream: true,
        max_tokens: isMimo ? 3200 : 1400,
        temperature: isMimo ? 0.2 : 0.15
      };
    },
    gatewayErrorMessage: 'Cannot reach gateway'
  });
}
