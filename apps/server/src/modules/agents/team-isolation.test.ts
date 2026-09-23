import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("../../config/prisma.js", () => ({
  prisma: { message: { findMany } },
}));

import { findAllLexMessages } from "./lex/lex.repository.js";
import { findAllMayaMessages } from "./maya/maya.repository.js";
import { findAllRexMessages } from "./rex/rex.repository.js";
import { findAllSageMessages } from "./sage/sage.repository.js";
import { findAllScoutMessages } from "./scout/scout.repository.js";
import { findAllVegaMessages } from "./vega/vega.repository.js";

/**
 * The team room stores its messages in the same table as each agent's chat,
 * behind `isTeam`. Every query that feeds an agent's own chat window must
 * exclude them, or a team run shows up inside whichever employee led it —
 * which is exactly what happened to Vega before these were pinned.
 */
describe("an agent's own chat never contains team-room messages", () => {
  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
  });

  const lists = {
    lex: findAllLexMessages,
    maya: findAllMayaMessages,
    rex: findAllRexMessages,
    sage: findAllSageMessages,
    scout: findAllScoutMessages,
    vega: findAllVegaMessages,
  } as const;

  for (const [name, list] of Object.entries(lists)) {
    it(`${name}: the chat window query filters isTeam`, async () => {
      await (list as (org: string, opts?: object) => Promise<unknown>)("org-1", {});
      expect(findMany.mock.calls[0][0].where.isTeam).toBe(false);
    });

    it(`${name}: so does the paginated (before) query`, async () => {
      await (list as (org: string, opts?: object) => Promise<unknown>)("org-1", {
        before: new Date().toISOString(),
      });
      expect(findMany.mock.calls[0][0].where.isTeam).toBe(false);
    });
  }
});
