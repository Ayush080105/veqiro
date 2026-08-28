import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The write authorisation boundary.
 *
 * apps/ai asks Node to perform writes; Node decides. These tests pin the
 * refusals, because a wrong answer here means a provider write the user never
 * agreed to — and unlike a bad plan, it cannot be undone.
 */

const mocks = vi.hoisted(() => ({
  findUniqueRun: vi.fn(),
  updateAction: vi.fn(),
  updateMessage: vi.fn(),
  findByConnectionId: vi.fn(),
  createPendingActions: vi.fn(),
  updatePendingActionStatus: vi.fn(),
  resolveApprovalMode: vi.fn(),
  callTool: vi.fn(),
  updateRun: vi.fn(),
  updateStep: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    agentRun: { findUnique: mocks.findUniqueRun },
    mcpPendingAction: { update: mocks.updateAction },
    message: { update: mocks.updateMessage },
  },
}));

vi.mock("../mcp/mcp.repository.js", () => ({
  findByConnectionId: mocks.findByConnectionId,
  createPendingActions: mocks.createPendingActions,
  updatePendingActionStatus: mocks.updatePendingActionStatus,
}));

vi.mock("../mcp/mcp.service.js", () => ({
  resolveApprovalMode: mocks.resolveApprovalMode,
  callTool: mocks.callTool,
}));

vi.mock("./agent-runs.repository.js", () => ({
  updateRun: mocks.updateRun,
  updateStep: mocks.updateStep,
}));

const RUN = {
  id: "run-1",
  organizationId: "org-1",
  userId: "user-1",
  status: "RUNNING",
  approvedAt: new Date(),
  approvedWrites: ["vega|gmail"],
  messageId: "msg-1",
  trigger: "CHAT",
  steps: [{ id: "step-row-1", key: "s1", agent: "vega" }],
};

const CALL = {
  connectionId: "conn-1",
  toolName: "GMAIL_SEND_EMAIL",
  arguments: { to: "a@b.com" },
  summary: "Send an email",
};

const load = async () => import("./agent-runs.internal.service.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUniqueRun.mockResolvedValue({ ...RUN });
  mocks.findByConnectionId.mockResolvedValue({
    organizationId: "org-1",
    integrationSlug: "gmail",
  });
  mocks.resolveApprovalMode.mockResolvedValue("AUTO_RUN");
  mocks.callTool.mockResolvedValue({ ok: true });
  mocks.createPendingActions.mockResolvedValue({});
  mocks.updateAction.mockResolvedValue({});
});

describe("executeWrite", () => {
  it("executes a write the approved plan covers", async () => {
    const svc = await load();
    const res = await svc.executeWrite("run-1", "s1", CALL);

    expect(res.executed).toBe(true);
    expect(mocks.callTool).toHaveBeenCalledOnce();
  });

  it("creates NO action row for a write outside the approved set", async () => {
    mocks.findByConnectionId.mockResolvedValue({
      organizationId: "org-1",
      integrationSlug: "linear", // approved set only covers vega|gmail
    });
    const svc = await load();
    const res = await svc.executeWrite("run-1", "s1", CALL);

    expect(res.requiresApproval).toBe(true);
    expect(res.executed).toBe(false);
    // The row itself is the audit trail; an unapproved attempt must not leave
    // one behind that looks authorised.
    expect(mocks.createPendingActions).not.toHaveBeenCalled();
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("lets an explicit NEVER policy beat plan approval", async () => {
    mocks.resolveApprovalMode.mockResolvedValue("NEVER");
    const svc = await load();
    const res = await svc.executeWrite("run-1", "s1", CALL);

    expect(res.executed).toBe(false);
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("refuses a connection belonging to another organization", async () => {
    mocks.findByConnectionId.mockResolvedValue({
      organizationId: "org-2",
      integrationSlug: "gmail",
    });
    const svc = await load();

    await expect(svc.executeWrite("run-1", "s1", CALL)).rejects.toThrow();
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("refuses to write for a run that was never approved", async () => {
    mocks.findUniqueRun.mockResolvedValue({ ...RUN, approvedAt: null });
    const svc = await load();

    await expect(svc.executeWrite("run-1", "s1", CALL)).rejects.toThrow();
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("refuses to write for a cancelled run", async () => {
    mocks.findUniqueRun.mockResolvedValue({ ...RUN, status: "CANCELLED" });
    const svc = await load();

    await expect(svc.executeWrite("run-1", "s1", CALL)).rejects.toThrow();
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("records the action as CONFIRMED, never PENDING", async () => {
    const svc = await load();
    await svc.executeWrite("run-1", "s1", CALL);

    // PENDING keeps meaning "a human still has to click this", which is what
    // stops a stray approval card double-executing a plan-approved write.
    const [update] = mocks.updateAction.mock.calls[0];
    expect(update.data.status).toBe("CONFIRMED");
    expect(update.data.runStepId).toBe("step-row-1");
  });

  it("marks the action FAILED and reports the error when the tool throws", async () => {
    mocks.callTool.mockRejectedValue(new Error("provider down"));
    const svc = await load();
    const res = await svc.executeWrite("run-1", "s1", CALL);

    expect(res.executed).toBe(false);
    expect(res.error).toContain("provider down");
    expect(mocks.updatePendingActionStatus).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "FAILED" }),
    );
  });
});

describe("heartbeat", () => {
  it("reports cancellation so the executor can stop cooperatively", async () => {
    mocks.findUniqueRun.mockResolvedValue({ status: "CANCELLED" });
    const svc = await load();

    expect((await svc.heartbeat("run-1", 5)).cancelled).toBe(true);
  });

  it("does not report a running run as cancelled", async () => {
    mocks.findUniqueRun.mockResolvedValue({ status: "RUNNING" });
    const svc = await load();

    expect((await svc.heartbeat("run-1", 5)).cancelled).toBe(false);
  });
});

describe("finishRun", () => {
  it("does not resurrect a run the user already cancelled", async () => {
    mocks.findUniqueRun.mockResolvedValue({ status: "CANCELLED", messageId: "msg-1" });
    const svc = await load();
    await svc.finishRun("run-1", "COMPLETED", "all done");

    expect(mocks.updateRun).not.toHaveBeenCalled();
    expect(mocks.updateMessage).not.toHaveBeenCalled();
  });

  it("falls back to FAILED for a status it does not recognise", async () => {
    mocks.findUniqueRun.mockResolvedValue({ status: "RUNNING", messageId: null });
    const svc = await load();
    await svc.finishRun("run-1", "NONSENSE", "");

    expect(mocks.updateRun.mock.calls[0][1].status).toBe("FAILED");
  });
});
