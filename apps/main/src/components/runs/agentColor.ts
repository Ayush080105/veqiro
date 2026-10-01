import { getAgent } from "@/lib/config/agents"

/**
 * The colour of the employee a step belongs to.
 *
 * `fallback` covers an agent slug the config does not know, so a step is
 * never left uncoloured.
 */
export function agentColorFor(agent: string, fallback: string): string {
  const cfg = getAgent(agent.toLowerCase())
  return (cfg?.color as string | undefined) ?? fallback
}
