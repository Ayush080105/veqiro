import { aiService } from "./aiService.js"
import * as contextRepo from "../../modules/context/context.repository.js"
import { loadPromptFacts } from "../../modules/workspace/memory-items.service.js"
import { triggerSummarize } from "../../modules/context/context.service.js"
import { Agent } from "../../../prisma/generated/prisma/client.js"
import { CONTEXT_HISTORY_LIMIT, SUMMARIZE_THRESHOLD } from "../../config/constants.js"
import type { BuildContextResponse } from "../../modules/context/context.types.js"
import { z } from "zod"
import { prisma } from "../../config/prisma.js"
import { getConnectionsForAgent, getToolPreference, getCatalogForAgent } from "../../modules/mcp/mcp.service.js"
import { type AgentSlug } from "@repo/integrations-catalog"

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
  /**
   * Skip writing this turn into the agent's conversational memory.
   *
   * For unattended runs (triggers, plays). Those are not conversation: the
   * "user message" is a raw provider payload, and recording it would both fill
   * long-term memory with email and calendar JSON — degrading the agent's real
   * conversations — and cost ~17 KB of embeddings per event, which at the
   * trigger rate cap is tens of MB a day.
   */
  skipMemory?: boolean
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
  // What the agent actually did this turn, for the chat UI's visible trace.
  // Built by apps/ai's _build_tool_trace; kept permissive here so adding a
  // field on the Python side never fails validation for the whole response.
  tool_trace: z
    .array(
      z.object({
        label: z.string(),
        integration: z.string().nullable().optional(),
        status: z.enum(["ok", "error", "pending"]).catch("ok"),
        detail: z.string().optional(),
        durationMs: z.number().nullable().optional(),
        // Set when the call happened inside a delegated agent's turn, so the
        // UI can attribute it. zod strips unknown keys, so it must be declared.
        viaAgent: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
})

export type AgentChatResponse = z.infer<typeof chatResponseSchema>

export const agentRoles: Record<Agent, string> = {
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
        isTeam: false,
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

/** One parsed SSE frame, e.g. `{ event: "token", data: '{"text":"Hi","agent":"lex"}' }`. */
export interface SseEvent {
  event: string
  data: string
}

/**
 * Splits a raw Node.js readable stream of `event: X\ndata: Y\n\n`-shaped SSE
 * text (apps/ai's wire format — see core/streaming.py's `sse_format`) into
 * parsed frames. A read/parse failure (network drop, malformed frame) yields
 * a synthetic `error` frame instead of throwing, so a caller relaying frames
 * straight to an HTTP response can always close the SSE stream cleanly.
 */
async function* parseSseStream(stream: NodeJS.ReadableStream): AsyncGenerator<SseEvent, void, unknown> {
  let buffer = ""
  try {
    for await (const chunk of stream) {
      buffer += (chunk as Buffer).toString("utf8")
      let sepIndex: number
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawFrame = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + 2)
        const lines = rawFrame.split("\n")
        const eventLine = lines.find((l) => l.startsWith("event:"))
        const dataLine = lines.find((l) => l.startsWith("data:"))
        if (!eventLine || !dataLine) continue
        yield {
          event: eventLine.slice("event:".length).trim(),
          data: dataLine.slice("data:".length).trim(),
        }
      }
    }
  } catch (err) {
    yield {
      event: "error",
      data: JSON.stringify({
        message: err instanceof Error ? err.message : String(err),
        code: "stream_read_error",
      }),
    }
  }
}

/**
 * Streaming sibling of `callAgentWithContext`: same context-build (steps 1,
 * 2, 2.5) and the same final memory write (step 4), but calls the agent's
 * `/chat/stream` route instead of `/chat` and relays each SSE frame as it
 * arrives instead of waiting for one JSON response.
 *
 * Yields every frame apps/ai sends (`tool_call`, `tool_result`, `token`,
 * `metadata`, `error`, `done`) — the caller is responsible for writing these
 * to its own client-facing stream. Once the underlying stream ends, returns
 * the reconstructed `AgentChatResponse` (accumulated token text + the `done`
 * frame's fields) so the caller can persist it exactly as it would the
 * return value of `callAgentWithContext` — or `null` if the stream ended
 * without a `done` frame (i.e. an `error` frame was seen instead).
 */
export async function* streamAgentWithContext(
  opts: AgentCallOptions,
): AsyncGenerator<SseEvent, AgentChatResponse | null, unknown> {
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
    const ascHistory = toAscHistory(rawHistory)

    const promptFacts = await loadPromptFacts(
      organizationId,
      agentEnum,
      (agentMem?.longTermFacts as string[]) ?? [],
    )
    const sharedMem = (orgMem?.sharedMemory as Record<string, unknown>) ?? {}
    const sharedParts: string[] = []
    if (sharedMem.goals) sharedParts.push(`Goals: ${(sharedMem.goals as string[]).join(", ")}`)
    if (sharedMem.product) sharedParts.push(`Product: ${sharedMem.product as string}`)
    if (sharedMem.decisions) sharedParts.push(`Decisions: ${(sharedMem.decisions as string[]).slice(-3).join("; ")}`)
    // Preferences now come through promptFacts, so forgetting one in Memory
    // actually stops the agent using it. The old list is only the fallback.
    if (!promptFacts.fromItems && sharedMem.userPreferences && (sharedMem.userPreferences as string[]).length > 0)
      sharedParts.push(`Preferences I've learned: ${(sharedMem.userPreferences as string[]).join("; ")}`)

    const { data } = await aiService.post<BuildContextResponse>("/ai/context/build", {
      user_message: userMessage,
      hot_history: ascHistory,
      running_summary: agentMem?.runningSummary ?? "",
      org_summary: orgMem?.runningSummary ?? "",
      long_term_facts: [...promptFacts.facts, ...((orgMem?.longTermFacts as string[]) ?? [])],
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
    : [...rawHistory].reverse()

  // 2.5. Resolve this org's connected MCP tools relevant to this agent, plus
  // the agent's full connectable catalog — see callAgentWithContext for why.
  let mcpMeta: Record<string, unknown> = {}
  try {
    const connections = await getConnectionsForAgent(organizationId, agentEnum)
    const agentSlug = agentEnum.toLowerCase() as AgentSlug
    const catalog = getCatalogForAgent(agentEnum, connections)
    const { preferredIntegrationSlug } = await getToolPreference(organizationId, agentSlug)
    mcpMeta = {
      ...(connections.length > 0 ? { mcp_connections: connections } : {}),
      ...(catalog.length > 0 ? { mcp_catalog: catalog } : {}),
      ...(preferredIntegrationSlug ? { mcp_tool_preference: preferredIntegrationSlug } : {}),
    }
  } catch (err) {
    console.error("[context] mcp connection resolution failed — continuing without MCP tools", err)
  }

  // 3. Call the agent's streaming sibling route (see agents/*/routes.py).
  const response = await aiService.post(
    `${agentApiPath}/stream`,
    {
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
    },
    { responseType: "stream" },
  )

  let accumulatedText = ""
  let doneData: Record<string, unknown> | null = null
  let sawError = false

  for await (const evt of parseSseStream(response.data)) {
    if (evt.event === "token") {
      try {
        accumulatedText += (JSON.parse(evt.data) as { text: string }).text ?? ""
      } catch {
        // malformed token frame — still relay it below, just don't count its text
      }
    } else if (evt.event === "done") {
      try {
        doneData = JSON.parse(evt.data) as Record<string, unknown>
      } catch {
        sawError = true
      }
    } else if (evt.event === "error") {
      sawError = true
    }
    yield evt
  }

  if (!doneData || sawError) return null

  const reconstructed: AgentChatResponse = {
    response: accumulatedText,
    agent: agentEnum.toLowerCase(),
    message_id: String(doneData.message_id ?? ""),
    tokens_used: Number(doneData.tokens_used ?? 0),
    model_used: String(doneData.model_used ?? ""),
    metadata: (doneData.metadata as Record<string, unknown>) ?? {},
    image: doneData.image ?? null,
    action_id: (doneData.action_id as string | null) ?? null,
    action_result: (doneData.action_result as Record<string, unknown> | null) ?? null,
    tool_trace: (doneData.tool_trace as AgentChatResponse["tool_trace"]) ?? [],
  }

  // 4. Same monitored context write callAgentWithContext does for chat-shaped
  // responses (see its step 4 for the latency/durability note).
  if (!opts.skipMemory) {
    await recordAgentTurnContext({
      organizationId,
      agent: agentEnum,
      agentRole,
      conversationId,
      userContent: userMessage,
      assistantContent: reconstructed.response,
      recentMessages: rawHistory,
      actionId: reconstructed.action_id ?? undefined,
      actionSummary: reconstructed.response,
    })
  }

  return reconstructed
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
    const promptFacts = await loadPromptFacts(
      organizationId,
      agentEnum,
      (agentMem?.longTermFacts as string[]) ?? [],
    )
    const sharedMem = (orgMem?.sharedMemory as Record<string, unknown>) ?? {}
    const sharedParts: string[] = []
    if (sharedMem.goals) sharedParts.push(`Goals: ${(sharedMem.goals as string[]).join(", ")}`)
    if (sharedMem.product) sharedParts.push(`Product: ${sharedMem.product as string}`)
    if (sharedMem.decisions) sharedParts.push(`Decisions: ${(sharedMem.decisions as string[]).slice(-3).join("; ")}`)
    // Preferences now come through promptFacts, so forgetting one in Memory
    // actually stops the agent using it. The old list is only the fallback.
    if (!promptFacts.fromItems && sharedMem.userPreferences && (sharedMem.userPreferences as string[]).length > 0)
      sharedParts.push(`Preferences I've learned: ${(sharedMem.userPreferences as string[]).join("; ")}`)

    const { data } = await aiService.post<BuildContextResponse>("/ai/context/build", {
      user_message: userMessage,
      hot_history: ascHistory,
      running_summary: agentMem?.runningSummary ?? "",
      org_summary: orgMem?.runningSummary ?? "",
      long_term_facts: [...promptFacts.facts, ...((orgMem?.longTermFacts as string[]) ?? [])],
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

  // 2.5. Resolve this org's connected MCP tools relevant to this agent, plus
  // the agent's full connectable catalog (each entry tagged connected:
  // true/false) so it can accurately answer "what can you connect to" even
  // when nothing — or only some things — are connected yet. Cheap no-op (no
  // extra DB/provider call beyond one indexed query) for the common case of
  // an org with zero connections.
  let mcpMeta: Record<string, unknown> = {}
  try {
    const connections = await getConnectionsForAgent(organizationId, agentEnum)
    const agentSlug = agentEnum.toLowerCase() as AgentSlug
    const catalog = getCatalogForAgent(agentEnum, connections)
    // Deterministic override for agents whose native tools can't reliably be
    // prompted to "prefer" a connected MCP tool (see agents/base.py's
    // SUPERSEDABLE_BY_MCP) — which integration, if any, should replace this
    // agent's default data source entirely.
    const { preferredIntegrationSlug } = await getToolPreference(organizationId, agentSlug)
    mcpMeta = {
      ...(connections.length > 0 ? { mcp_connections: connections } : {}),
      ...(catalog.length > 0 ? { mcp_catalog: catalog } : {}),
      ...(preferredIntegrationSlug ? { mcp_tool_preference: preferredIntegrationSlug } : {}),
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
  if (chatResponse.success && !opts.skipMemory) {
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
