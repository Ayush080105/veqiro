import { prisma } from "../../config/prisma.js";
import { Agent } from "../../../prisma/generated/prisma/client.js";

// AgentMemory

export const findAgentMemory = (organizationId: string, agent: Agent) =>
  prisma.agentMemory.findUnique({
    where: { organizationId_agent: { organizationId, agent } }
  })

export const upsertAgentMemory = (
  organizationId: string,
  agent: Agent,
  data: {
    runningSummary?: string
    longTermFacts?: string[]
    messageCount?: number
    lastSummarizedAt?: Date
  }
) =>
  prisma.agentMemory.upsert({
    where: { organizationId_agent: { organizationId, agent } },
    create: { organizationId, agent, ...data },
    update: data,
  })

export const incrementMessageCount = async (organizationId: string, agent: Agent): Promise<number> => {
  const record = await prisma.agentMemory.upsert({
    where: { organizationId_agent: { organizationId, agent } },
    create: { organizationId, agent, messageCount: 1 },
    update: { messageCount: { increment: 1 } },
    select: { messageCount: true },
  })
  return record.messageCount
}

export const appendAgentFact = async (organizationId: string, agent: Agent, fact: string) => {
  const mem = await findAgentMemory(organizationId, agent)
  const facts = ((mem?.longTermFacts as string[]) ?? []).concat(fact)
  return upsertAgentMemory(organizationId, agent, { longTermFacts: facts })
}

export const removeAgentFact = async (organizationId: string, agent: Agent, index: number) => {
  const mem = await findAgentMemory(organizationId, agent)
  const facts = ((mem?.longTermFacts as string[]) ?? []).filter((_, i) => i !== index)
  return upsertAgentMemory(organizationId, agent, { longTermFacts: facts })
}

// OrgMemory

export const findOrgMemory = (organizationId: string) =>
  prisma.orgMemory.findUnique({ where: { organizationId } })

export const upsertOrgMemory = (
  organizationId: string,
  data: {
    runningSummary?: string
    longTermFacts?: string[]
    sharedMemory?: object
  }
) =>
  prisma.orgMemory.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  })

export const appendOrgFact = async (organizationId: string, fact: string) => {
  const mem = await findOrgMemory(organizationId)
  const facts = ((mem?.longTermFacts as string[]) ?? []).concat(fact)
  return upsertOrgMemory(organizationId, { longTermFacts: facts })
}

export const removeOrgFact = async (organizationId: string, index: number) => {
  const mem = await findOrgMemory(organizationId)
  const facts = ((mem?.longTermFacts as string[]) ?? []).filter((_, i) => i !== index)
  return upsertOrgMemory(organizationId, { longTermFacts: facts })
}
