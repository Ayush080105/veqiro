import { aiService } from "../../common/utils/aiService.js"
import * as repo from "./context.repository.js"
import { Agent } from "../../../prisma/generated/prisma/client.js"
import { SUMMARIZE_THRESHOLD } from "../../config/constants.js"

export const getAgentMemory = (organizationId: string, agent: Agent) =>
  repo.findAgentMemory(organizationId, agent)

export const getOrgMemory = (organizationId: string) =>
  repo.findOrgMemory(organizationId)

export const addAgentFact = (organizationId: string, agent: Agent, fact: string) =>
  repo.appendAgentFact(organizationId, agent, fact)

export const addOrgFact = (organizationId: string, fact: string) =>
  repo.appendOrgFact(organizationId, fact)

export const removeAgentFact = (organizationId: string, agent: Agent, index: number) =>
  repo.removeAgentFact(organizationId, agent, index)

export const removeOrgFact = (organizationId: string, index: number) =>
  repo.removeOrgFact(organizationId, index)

export const patchOrgMemory = async (
  organizationId: string,
  patch: {
    goals?: string[]
    product?: string
    decisions?: string[]
    userPreferences?: string[]
    runningSummary?: string
  }
) => {
  const { runningSummary, ...memPatch } = patch
  const existing = await repo.findOrgMemory(organizationId)
  const mergedSharedMemory = Object.keys(memPatch).length > 0
    ? { ...((existing?.sharedMemory as object) ?? {}), ...memPatch }
    : undefined
  return repo.upsertOrgMemory(organizationId, {
    ...(runningSummary !== undefined && { runningSummary }),
    ...(mergedSharedMemory !== undefined && { sharedMemory: mergedSharedMemory }),
  })
}

export const triggerSummarize = async (
  organizationId: string,
  agent: Agent,
  recentMessages: { role: string; content: string }[],
  agentRole: string
) => {
  const mem = await repo.findAgentMemory(organizationId, agent)
  const { data } = await aiService.post<{ updated_summary: string; extracted_facts: string[] }>(
    "/ai/context/summarize",
    {
      org_id: organizationId,
      agent: agent.toLowerCase(),
      recent_messages: recentMessages,
      existing_summary: mem?.runningSummary ?? "",
      agent_role: agentRole,
    }
  )
  const existingFacts: string[] = (mem?.longTermFacts as string[]) ?? []
  const incoming: string[] = data.extracted_facts ?? []
  // Deduplicate: skip incoming facts whose first 60 chars match an existing fact
  const trulyNew = incoming.filter(
    f => !existingFacts.some(e => e.slice(0, 60) === f.slice(0, 60))
  )
  // Cap at 60 total — drop oldest (head) to make room for newest (tail)
  const newFacts = [...existingFacts, ...trulyNew].slice(-60)
  await repo.upsertAgentMemory(organizationId, agent, {
    runningSummary: data.updated_summary,
    longTermFacts: newFacts,
    messageCount: 0,
    lastSummarizedAt: new Date(),
  })
}
