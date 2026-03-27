import { getJoeyContextEnv } from '../lib/joey-context.js';
import {
  buildActiveSystemPromptPart,
  buildSearchGroundingPart,
  buildSearchRulesPart,
  handleJoeyGatewayRequest
} from '../lib/joey-chat-handler.js';

function buildNemoClawSystemParts(context) {
  const {
    mode,
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
  if (joeyContext) systemParts.push(clampText(joeyContext, forceFullContext ? 24000 : 14000));
  if (filesText) {
    systemParts.push(clampText(filesText, forceFullContext ? 80000 : 38000));
  } else {
    if (profileText) systemParts.push(clampText(profileText, 6000));
    if (memoriesText) systemParts.push(clampText(memoriesText, 12000));
  }
  if (searchContext) systemParts.push(clampText(searchContext, 8000));

  systemParts.push(`
=== PERSONALIZATION INSTRUCTIONS ===
- You have a profile and memories about this person. USE THEM NATURALLY.
- Reference things you know: ask about their goals, mention their people by name, recall past conversations.
- Adapt your tone to their communication_style and current_mood.
- If they seem stressed, be supportive. If they're in a good mood, match their energy.
- Don't announce "I remember that..." - just naturally use what you know, like a real friend would.
- Track the time: it's currently ${new Date().toISOString()}. Greet appropriately (morning/afternoon/evening) for their timezone.
- If they mention something new about themselves, you'll automatically remember it (your memory system handles this).
- Build on previous conversations - reference what you discussed before when relevant.`);

  if (mode === 'work') {
    systemParts.push(`
=== WORK MODE ===
- You are in Joey Work mode.
- Treat the supplied context as a work operating system: tasks, deadlines, blockers, follow-ups, owners, meetings, decisions, docs, and reusable procedures.
- Optimize for recall and execution: surface the next action, name blockers, keep deadlines concrete, and preserve continuity across projects.
- When the user asks to save something, strongly prefer work-oriented memory categories such as work, decision, resource, win, lesson, or pin.
- Keep responses sharp and operational. Be more like a strong chief of staff than a general companion.`);
  }

  systemParts.push(buildSearchRulesPart(searchState, searchProvider, forceWebSearch, forceFullContext));
  systemParts.push(buildSearchGroundingPart(needsSearch));
  return systemParts.filter(Boolean);
}

export default async function handler(req, res) {
  return handleJoeyGatewayRequest(req, res, {
    getProviderConfig({ mode, env }) {
      return {
        gatewayUrl: String(env.NEMOCLAW_GATEWAY_URL || 'http://localhost:11434').trim(),
        gatewayToken: String(env.NEMOCLAW_GATEWAY_TOKEN || '').trim(),
        primaryModel: mode === 'work'
          ? String(env.NEMOCLAW_WORK_MODEL || env.NEMOCLAW_MODEL || 'minimax-m2.7:cloud').trim()
          : String(env.NEMOCLAW_PERSONAL_MODEL || 'nemotron-3-super:cloud').trim(),
        fallbackModel: 'llama-3.1-8b-instant',
        largeContext: true
      };
    },
    buildSystemParts: buildNemoClawSystemParts,
    getBackfillLimit({ forceFullContext }) {
      return forceFullContext ? 60 : 32;
    },
    buildUpstreamBody({ modelName, finalMessages }) {
      return {
        model: modelName,
        messages: finalMessages,
        stream: true,
        max_tokens: 2500
      };
    },
    gatewayErrorMessage: 'Cannot reach NemoClaw gateway'
  });
}
