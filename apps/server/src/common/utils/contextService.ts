import { aiService } from "./aiService.js"
import * as contextRepo from "../../modules/context/context.repository.js"
import { triggerSummarize } from "../../modules/context/context.service.js"
import { Agent } from "../../../prisma/generated/prisma/client.js"
import { CONTEXT_HISTORY_LIMIT, SUMMARIZE_THRESHOLD } from "../../config/constants.js"
import type { BuildContextResponse } from "../../modules/context/context.types.js"
import { z } from "zod"
import { prisma } from "../../config/prisma.js"
import { getConnectionsForAgent } from "../../modules/mcp/mcp.service.js"

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
  /** Spread at root of request body — use for action endpoints that expect params at top level */
  topLevelPayload?: Record<string, unknown>
}

const chatResponseSchema = z.object({
  response: z.string(),
  agent: z.string(),
  message_id: z.string(),
  tokens_used: z.number().int().nonnegative().default(0),
  model_used: z.string().default(""),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  image: z.unknown().nullable().optional(),
  action_id: z.string().nullable().optional(),
  action_result: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type AgentChatResponse = z.infer<typeof chatResponseSchema>

const agentRoles: Record<Agent, string> = {
  [Agent.MAYA]: "Maya: Social media content creation assistant",
  [Agent.SAGE]: "Sage: SEO and content strategy assistant",
  [Agent.LEX]: "Lex: Legal and compliance assistant",
  [Agent.REX]: "Rex: Data analytics and reporting assistant",
  [Agent.SCOUT]: "Scout: Competitive intelligence assistant",
  [Agent.VEGA]: "Vega: Executive assistant for email and calendar management",
}

const toAscHistory = (history: { role: string; content: string }[]) =>
  [...history].reverse().slice(0, CONTEXT_HISTORY_LIMIT)

const logContextFailure = (
  stage: string,
  data: { organizationId: string; agent: Agent; conversationId?: string },
  err: unknown,
) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error("[context]", stage, {
    organizationId: data.organizationId,
    agent: data.agent,
    conversationId: data.conversationId,
    error: message,
  })
}

export async function recordAgentTurnContext(opts: {
  organizationId: string
  agent: Agent
  agentRole?: string
  conversationId?: string
  userContent: string
  assistantContent: string
  recentMessages: { role: string; content: string }[]
  actionId?: string
  actionSummary?: string
}) {
  const agentRole = opts.agentRole ?? agentRoles[opts.agent]
  try {
    await aiService.post("/ai/context/store-turn", {
      org_id: opts.organizationId,
      agent: opts.agent.toLowerCase(),
      user_content: opts.userContent,
      assistant_content: opts.assistantContent,
    })

    if (opts.actionId) {
      await contextRepo.appendOrgFact(
        opts.organizationId,
        `[CONTEXT] ${agentRole} completed ${opts.actionId} on ${new Date().toISOString().slice(0, 10)}: ${opts.actionSummary ?? opts.assistantContent}`,
      )
    }

    const count = await contextRepo.incrementMessageCount(opts.organizationId, opts.agent)
    if (count >= SUMMARIZE_THRESHOLD) {
      const currentTurn = [
        { role: "user", content: opts.userContent },
        { role: "assistant", content: opts.assistantContent },
      ]
      await triggerSummarize(
        opts.organizationId,
        opts.agent,
        [...toAscHistory(opts.recentMessages), ...currentTurn],
        agentRole,
      )
    }
  } catch (err) {
    logContextFailure("record-turn", opts, err)
  }
}

export async function recordDirectActionContextForAssistantMessage(messageId: string) {
  try {
    const assistant = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        organizationId: true,
        agent: true,
        role: true,
        content: true,
        createdAt: true,
        customInput: true,
      },
    })
    if (!assistant || assistant.role !== "assistant") return

    const assistantInput = assistant.customInput as Record<string, unknown> | null
    const actionId = typeof assistantInput?.actionId === "string" ? assistantInput.actionId : null
    if (!actionId) return

    const userMessage = await prisma.message.findFirst({
      where: {
        organizationId: assistant.organizationId,
        agent: assistant.agent,
        role: "user",
        createdAt: { lte: assistant.createdAt },
      },
      orderBy: { createdAt: "desc" },
      select: { content: true, customInput: true },
    })

    if (!userMessage) return

    const userInput = userMessage.customInput as Record<string, unknown> | null
    if (userInput?.actionId !== actionId) return

    const recentMessages = await prisma.message.findMany({
      where: {
        organizationId: assistant.organizationId,
        agent: assistant.agent,
        createdAt: { lt: assistant.createdAt },
      },
      orderBy: { createdAt: "desc" },
      take: CONTEXT_HISTORY_LIMIT,
      select: { role: true, content: true },
    })

    await recordAgentTurnContext({
      organizationId: assistant.organizationId,
      agent: assistant.agent,
      agentRole: agentRoles[assistant.agent],
      conversationId: assistant.id,
      userContent: userMessage.content,
      assistantContent: assistant.content,
      recentMessages,
      actionId,
      actionSummary: assistant.content,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[context] direct-action-record", { messageId, error: message })
  }
}

export async function callAgentWithContext<T = AgentChatResponse>(opts: AgentCallOptions): Promise<T> {
  const {
    agentApiPath, agentEnum, agentRole, userId, organizationId,
    conversationId, userMessage, rawHistory, extraPayload = {}, topLevelPayload = {},
  } = opts

  // 1. Try to build optimized context — silently fall back on any error
  let built: BuildContextResponse | null = null
  try {
    const [agentMem, orgMem] = await Promise.all([
      contextRepo.findAgentMemory(organizationId, agentEnum),
      contextRepo.findOrgMemory(organizationId),
    ])
    // Reverse DESC→ASC so FastAPI's hot[-8:] returns the 8 NEWEST messages
    const ascHistory = toAscHistory(rawHistory)

    // Surface structured sharedMemory (goals, product, decisions) for all agents
    const sharedMem = (orgMem?.sharedMemory as Record<string, unknown>) ?? {}
    const sharedParts: string[] = []
    if (sharedMem.goals) sharedParts.push(`Goals: ${(sharedMem.goals as string[]).join(", ")}`)
    if (sharedMem.product) sharedParts.push(`Product: ${sharedMem.product as string}`)
    if (sharedMem.decisions) sharedParts.push(`Decisions: ${(sharedMem.decisions as string[]).slice(-3).join("; ")}`)
    if (sharedMem.userPreferences && (sharedMem.userPreferences as string[]).length > 0)
      sharedParts.push(`Preferences I've learned: ${(sharedMem.userPreferences as string[]).join("; ")}`)

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

  // 2.5. Resolve this org's connected MCP tools relevant to this agent.
  // Cheap no-op (no DB/provider call beyond one indexed query) for the
  // common case of an org with zero connections.
  let mcpMeta: Record<string, unknown> = {}
  try {
    const connections = await getConnectionsForAgent(organizationId, agentEnum)
    if (connections.length > 0) {
      mcpMeta = { mcp_connections: connections }
    }
  } catch (err) {
    console.error("[context] mcp connection resolution failed — continuing without MCP tools", err)
  }

  // 3. Call the agent
  const { data: response } = await aiService.post<T>(agentApiPath, {
    user_id: userId,
    organization_id: organizationId,
    conversation_id: conversationId,
    message: userMessage,
    history,
    ...topLevelPayload,
    metadata: {
      ...extraPayload,
      ...mcpMeta,
      ...(built?.memory_block ? { memory_context: built.memory_block } : {}),
    },
  })

  // 4. Monitored async context write for chat-shaped responses. Direct action
  // endpoints return action-specific schemas and are recorded by repositories.
  const chatResponse = chatResponseSchema.safeParse(response)
  if (chatResponse.success) {
    // Await so memory is reliably persisted before the response is returned.
    // On serverless runtimes that support waitUntil, migrate this there to
    // avoid adding latency; the durable fix (queue) is Phase 3.
    await recordAgentTurnContext({
      organizationId,
      agent: agentEnum,
      agentRole,
      conversationId,
      userContent: userMessage,
      assistantContent: chatResponse.data.response,
      recentMessages: rawHistory,
      actionId: chatResponse.data.action_id ?? undefined,
      actionSummary: chatResponse.data.response,
    })
  }

  return (chatResponse.success ? chatResponse.data : response) as T
}
