import { reindexLexContracts } from "../agents/lex/lex.workspace.js";
import {
  reindexMayaCampaigns,
  reindexMayaPosts,
} from "../agents/maya/maya.workspace.js";
import { WORK_OBJECT_KINDS } from "./work-objects.projector.js";

/**
 * Which function rebuilds which kind.
 *
 * The dispatch lives here rather than in the projector because each reindexer
 * has to read its agent's own typed table, and the projector importing every
 * agent would invert the dependency — the agents import it. This module sits
 * above both, so nothing becomes circular.
 *
 * Adding an agent means adding a line here and exporting a reindexer from its
 * own *.workspace.ts. Forgetting to is not silent: the endpoint says which
 * kinds it does know.
 */
const REINDEXERS: Record<
  string,
  (organizationId?: string) => Promise<{ kind: string; projected: number; removed: number }>
> = {
  [WORK_OBJECT_KINDS.lexContract]: reindexLexContracts,
  [WORK_OBJECT_KINDS.mayaPost]: reindexMayaPosts,
  [WORK_OBJECT_KINDS.mayaCampaign]: reindexMayaCampaigns,
};

export const REINDEXABLE_KINDS = Object.keys(REINDEXERS);

export async function reindexKind(kind: string, organizationId?: string) {
  const reindexer = REINDEXERS[kind];
  if (!reindexer) {
    throw new Error(
      `No reindexer for kind "${kind}". Known kinds: ${REINDEXABLE_KINDS.join(", ")}`,
    );
  }
  return reindexer(organizationId);
}

/** Rebuild everything. The blunt instrument, for when drift is suspected broadly. */
export async function reindexAll(organizationId?: string) {
  const results = [];
  for (const kind of REINDEXABLE_KINDS) {
    results.push(await reindexKind(kind, organizationId));
  }
  return results;
}
