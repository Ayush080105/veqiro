import { aiService } from "./aiService.js"
import * as contextRepo from "../../modules/context/context.repository.js"
import { triggerSummarize } from "../../modules/context/context.service.js"
import { Agent } from "../../../prisma/generated/prisma/client.js"
import { CONTEXT_HISTORY_LIMIT, SUMMARIZE_THRESHOLD } from "../../config/constants.js"
import type { BuildContextResponse } from "../../modules/context/context.types.js"

interface AgentCallOptions {
  agentApiPath: string            // e.g. "/ai/sage/chat"
  agentEnum: Agent
  agentRole: string               // e.g. "Sage: SEO and content strategy assistant"
  userId: string
  organizationId: string
  conversationId: string
  userMessage: string
  rawHistory: { role: string; content: string }[]
  extraPayload?: Record<string, unknown>
}

export async function callAgentWithContext(opts: AgentCallOptions): Promise<unknown> {
  const {
    agentApiPath, agentEnum, agentRole, userId, organizationId,
    conversationId, userMessage, rawHistory, extraPayload = {},
  } = opts

  // 1. Try to build optimized context — silently fall back on any error
  let built: BuildContextResponse | null = null
  try {
    const [agentMem, orgMem] = await Promise.all([
      contextRepo.findAgentMemory(organizationId, agentEnum),
      contextRepo.findOrgMemory(organizationId),
    ])
    const { data } = await aiService.post<BuildContextResponse>("/ai/context/build", {
      user_message: userMessage,
      hot_history: rawHistory.slice(-CONTEXT_HISTORY_LIMIT),
      running_summary: agentMem?.runningSummary ?? "",
      org_summary: orgMem?.runningSummary ?? "",
      long_term_facts: [
        ...((agentMem?.longTermFacts as string[]) ?? []),
        ...((orgMem?.longTermFacts as string[]) ?? []),
      ],
      org_id: organizationId,
      agent: agentEnum.toLowerCase(),
    })
    built = data
  } catch {
    // context build failed — use raw history
  }

  // 2. Assemble history: hot + semantic (already deduped by FastAPI)
  const history = built
    ? [...built.hot_messages, ...built.semantic_messages]
    : rawHistory

  // 3. Call the agent
  const { data: response } = await aiService.post(agentApiPath, {
    user_id: userId,
    organization_id: organizationId,
    conversation_id: conversationId,
    message: userMessage,
    history,
    metadata: {
      ...extraPayload,
      ...(built?.memory_block ? { memory_context: built.memory_block } : {}),
    },
  })

  // 4. Fire-and-forget: store turn + maybe summarize
  void (async () => {
    try {
      await aiService.post("/ai/context/store-turn", {
        org_id: organizationId,
        agent: agentEnum.toLowerCase(),
        user_content: userMessage,
        assistant_content: (response as { response: string }).response,
      })
      const count = await contextRepo.incrementMessageCount(organizationId, agentEnum)
      if (count >= SUMMARIZE_THRESHOLD) {
        await triggerSummarize(organizationId, agentEnum, rawHistory, agentRole)
      }
    } catch {
      // non-fatal
    }
  })()

  return response
}
