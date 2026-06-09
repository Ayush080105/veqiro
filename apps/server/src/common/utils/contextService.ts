import { aiService } from "./aiService.js"
import * as contextRepo from "../../modules/context/context.repository.js"
import { triggerSummarize } from "../../modules/context/context.service.js"
import { Agent } from "../../../prisma/generated/prisma/client.js"
import { CONTEXT_HISTORY_LIMIT, SUMMARIZE_THRESHOLD } from "../../config/constants.js"
import type { BuildContextResponse } from "../../modules/context/context.types.js"

// Build a memory block from DB without calling FastAPI — used to enrich action endpoints
export async function buildMemoryBlock(
  organizationId: string,
  agentEnum: Agent
): Promise<string | null> {
  try {
    const [agentMem, orgMem] = await Promise.all([
      contextRepo.findAgentMemory(organizationId, agentEnum),
      contextRepo.findOrgMemory(organizationId),
    ])
    const parts: string[] = []
    if (agentMem?.runningSummary) {
      parts.push(`## What I Remember About This Client\n${agentMem.runningSummary}`)
    }
    if (orgMem?.runningSummary) {
      parts.push(`## Organisation Context\n${orgMem.runningSummary}`)
    }
    const sharedMem = (orgMem?.sharedMemory as Record<string, unknown>) ?? {}
    const sharedParts: string[] = []
    if (sharedMem.goals) sharedParts.push(`Goals: ${(sharedMem.goals as string[]).join(", ")}`)
    if (sharedMem.product) sharedParts.push(`Product: ${sharedMem.product as string}`)
    if (sharedMem.decisions) sharedParts.push(`Decisions: ${(sharedMem.decisions as string[]).slice(-3).join("; ")}`)
    if (sharedParts.length) parts.push(`## Organisation Goals & Decisions\n${sharedParts.join(" | ")}`)
    const facts = [
      ...((agentMem?.longTermFacts as string[]) ?? []),
      ...((orgMem?.longTermFacts as string[]) ?? []),
    ]
    if (facts.length) parts.push(`## Established Facts\n${facts.slice(-12).join("\n")}`)
    return parts.length ? parts.join("\n\n") : null
  } catch {
    return null
  }
}

// Store an action turn in the vector store and increment message count
export async function storeActionTurn(opts: {
  agentEnum: Agent
  agentRole: string
  organizationId: string
  userContent: string
  assistantContent: string
  rawHistory: { role: string; content: string }[]
}): Promise<void> {
  const { agentEnum, agentRole, organizationId, userContent, assistantContent, rawHistory } = opts
  try {
    await aiService.post("/ai/context/store-turn", {
      org_id: organizationId,
      agent: agentEnum.toLowerCase(),
      user_content: userContent,
      assistant_content: assistantContent,
    })
    const count = await contextRepo.incrementMessageCount(organizationId, agentEnum)
    if (count >= SUMMARIZE_THRESHOLD) {
      await triggerSummarize(organizationId, agentEnum, rawHistory, agentRole)
    }
  } catch {
    // non-fatal
  }
}

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
    // Reverse DESC→ASC so FastAPI's hot[-8:] returns the 8 NEWEST messages
    const ascHistory = [...rawHistory].reverse().slice(0, CONTEXT_HISTORY_LIMIT)

    // Surface structured sharedMemory (goals, product, decisions) for all agents
    const sharedMem = (orgMem?.sharedMemory as Record<string, unknown>) ?? {}
    const sharedParts: string[] = []
    if (sharedMem.goals) sharedParts.push(`Goals: ${(sharedMem.goals as string[]).join(", ")}`)
    if (sharedMem.product) sharedParts.push(`Product: ${sharedMem.product as string}`)
    if (sharedMem.decisions) sharedParts.push(`Decisions: ${(sharedMem.decisions as string[]).slice(-3).join("; ")}`)

    const { data } = await aiService.post<BuildContextResponse>("/ai/context/build", {
      user_message: userMessage,
      hot_history: ascHistory,
      running_summary: agentMem?.runningSummary ?? "",
      org_summary: orgMem?.runningSummary ?? "",
      long_term_facts: [
        ...((agentMem?.longTermFacts as string[]) ?? []),
        ...((orgMem?.longTermFacts as string[]) ?? []),
      ],
      org_shared_context: sharedParts.join(" | "),
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
    : [...rawHistory].reverse()  // fallback: also reverse to ASC

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

  // 4. If a rich action was completed, record it in OrgMemory so other agents know
  const responseData = response as { response: string; action_id?: string }
  if (responseData.action_id) {
    void contextRepo.appendOrgFact(
      organizationId,
      `[CONTEXT] ${agentRole} completed ${responseData.action_id} on ${new Date().toISOString().slice(0, 10)}: ${responseData.response.slice(0, 120)}`
    ).catch(() => {})
  }

  // 5. Fire-and-forget: store turn + maybe summarize
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
