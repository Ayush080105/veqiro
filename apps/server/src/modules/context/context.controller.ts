import { Request, Response } from "express"
import { agentParamSchema, addFactSchema, removeFactSchema, patchOrgMemorySchema } from "./context.schema.js"
import * as contextService from "./context.service.js"
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js"

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context")
  }
  return { userId: req.userId, organizationId: req.organizationId }
}

export const getContext = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req)
  const { agent } = agentParamSchema.parse(req.params)
  const [agentMemory, orgMemory] = await Promise.all([
    contextService.getAgentMemory(organizationId, agent),
    contextService.getOrgMemory(organizationId),
  ])
  res.json({ agentMemory, orgMemory })
}

export const addFact = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req)
  const { agent } = agentParamSchema.parse(req.params)
  const { fact, scope } = addFactSchema.parse(req.body)
  let result
  if (scope === "agent") {
    result = await contextService.addAgentFact(organizationId, agent, fact)
  } else {
    result = await contextService.addOrgFact(organizationId, fact)
  }
  res.json(result)
}

export const removeFact = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req)
  const { agent } = agentParamSchema.parse(req.params)
  const { index } = removeFactSchema.parse(req.params)
  let result
  if (req.query.scope === "org") {
    result = await contextService.removeOrgFact(organizationId, index)
  } else {
    result = await contextService.removeAgentFact(organizationId, agent, index)
  }
  res.json(result)
}

export const patchOrgMemory = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req)
  agentParamSchema.parse(req.params)
  const body = patchOrgMemorySchema.parse(req.body)
  const result = await contextService.patchOrgMemory(organizationId, body)
  res.json(result)
}
