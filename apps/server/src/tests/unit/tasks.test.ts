import { assert, describe, test, vi, beforeEach, afterEach, expect } from "vitest";
import { computeNextRun } from "../../modules/tasks/tasks.service.js";

// Top-level mock — vitest hoists vi.mock() calls so they must be at file scope.
vi.mock("../../modules/tasks/tasks.repository.js", () => ({
  countTasksByOrg: vi.fn(),
  createTask:      vi.fn(),
  findTaskById:    vi.fn(),
  updateTask:      vi.fn(),
  deleteTask:      vi.fn(),
  findTasksByOrg:  vi.fn(),
  findDueTasks:    vi.fn(),
}));

// ─── computeNextRun — valid expressions ──────────────────────────────────────

describe("computeNextRun — valid expressions", () => {
  test("daily 8am UTC → next Date has hour=8, minute=0", () => {
    const d = computeNextRun("0 8 * * *", "UTC");
    assert.ok(d instanceof Date);
    assert.equal(d!.getUTCHours(), 8);
    assert.equal(d!.getUTCMinutes(), 0);
    assert.equal(d!.getUTCSeconds(), 0);
  });

  test("daily 18:00 UTC → next Date has hour=18", () => {
    const d = computeNextRun("0 18 * * *", "UTC");
    assert.ok(d instanceof Date);
    assert.equal(d!.getUTCHours(), 18);
  });

  test("weekly Monday 9am UTC → result is always a Monday", () => {
    const d = computeNextRun("0 9 * * 1", "UTC");
    assert.ok(d instanceof Date);
    assert.equal(d!.getUTCDay(), 1);
    assert.equal(d!.getUTCHours(), 9);
  });

  test("weekly Sunday 9am UTC → result is a Sunday", () => {
    const d = computeNextRun("0 9 * * 0", "UTC");
    assert.ok(d instanceof Date);
    assert.equal(d!.getUTCDay(), 0);
  });

  test("monthly 1st midnight → result has date=1, hour=0", () => {
    const d = computeNextRun("0 0 1 * *", "UTC");
    assert.ok(d instanceof Date);
    assert.equal(d!.getUTCDate(), 1);
    assert.equal(d!.getUTCHours(), 0);
  });

  test("every 30 min → next run is within 30 minutes from now", () => {
    const d = computeNextRun("*/30 * * * *", "UTC");
    assert.ok(d instanceof Date);
    const diffMs = d!.getTime() - Date.now();
    assert.ok(diffMs > 0, "next run must be in the future");
    assert.ok(diffMs <= 30 * 60 * 1000, "next run must be within 30 min");
  });

  test("timezone-aware: 9am America/New_York maps to 13:00 or 14:00 UTC", () => {
    const d = computeNextRun("0 9 * * *", "America/New_York");
    assert.ok(d instanceof Date);
    const utcHour = d!.getUTCHours();
    assert.ok(utcHour === 13 || utcHour === 14, `Expected 13 or 14 UTC, got ${utcHour}`);
  });

  test("leap-year Feb 29 → next occurrence is on a real Feb 29", () => {
    const d = computeNextRun("0 0 29 2 *", "UTC");
    assert.ok(d instanceof Date);
    assert.equal(d!.getUTCMonth(), 1);  // February = 1
    assert.equal(d!.getUTCDate(), 29);
    assert.equal(d!.getUTCFullYear() % 4, 0, "should be a leap year");
  });

  test("all results are in the future", () => {
    const now = Date.now();
    const exprs = ["0 8 * * *", "0 9 * * 1", "*/15 * * * *", "0 0 1 * *", "0 18 * * 5"];
    for (const expr of exprs) {
      const d = computeNextRun(expr, "UTC");
      assert.ok(d instanceof Date, `Expected Date for "${expr}"`);
      assert.ok(d!.getTime() > now, `"${expr}" should produce a future date`);
    }
  });
});

// ─── computeNextRun — invalid inputs ─────────────────────────────────────────

describe("computeNextRun — invalid / rejected inputs", () => {
  test("empty string → null", () => {
    assert.equal(computeNextRun(""), null);
  });

  test("whitespace-only → null", () => {
    assert.equal(computeNextRun("   "), null);
  });

  test("4-part cron (missing a field) → null", () => {
    assert.equal(computeNextRun("0 9 * *"), null);
  });

  test("6-part cron (extra field) → null", () => {
    assert.equal(computeNextRun("0 9 * * 1 2026"), null);
  });

  test("1-word garbage → null", () => {
    assert.equal(computeNextRun("not-a-cron"), null);
  });

  test("hour out of range (25) → null", () => {
    assert.equal(computeNextRun("0 25 * * *"), null);
  });

  test("minute out of range (60) → null", () => {
    assert.equal(computeNextRun("60 9 * * *"), null);
  });

  test("weekday out of range (8) → null", () => {
    assert.equal(computeNextRun("0 9 * * 8"), null);
  });

  test("month out of range (13) → null", () => {
    assert.equal(computeNextRun("0 9 * 13 *"), null);
  });

  test("invalid timezone → null", () => {
    assert.equal(computeNextRun("0 9 * * 1", "Mars/Olympus"), null);
  });
});

// ─── DEFAULT_TASKS cron expressions ──────────────────────────────────────────

describe("computeNextRun — default task cron expressions", () => {
  const DEFAULT_CRONS = [
    { name: "Weekly Financial Digest", expr: "0 9 * * 1" },
    { name: "Morning Briefing",        expr: "0 8 * * *" },
    { name: "Evening Wrap-up",         expr: "0 18 * * *" },
    { name: "Weekly Content Ideas",    expr: "0 9 * * 1" },
    { name: "Weekly SEO Report",       expr: "0 9 * * 1" },
  ];

  for (const { name, expr } of DEFAULT_CRONS) {
    test(`${name} ("${expr}") → valid future Date`, () => {
      const d = computeNextRun(expr, "UTC");
      assert.ok(d instanceof Date, `Expected a Date for "${name}"`);
      assert.ok(d!.getTime() > Date.now(), `Expected future date for "${name}"`);
    });
  }
});

// ─── createTask — cron validation ────────────────────────────────────────────

describe("createTask — cron validation", () => {
  beforeEach(async () => {
    const repo = await import("../../modules/tasks/tasks.repository.js");
    vi.mocked(repo.countTasksByOrg).mockResolvedValue(0);
    vi.mocked(repo.createTask).mockResolvedValue({ id: "task_1" } as any);
  });

  afterEach(() => vi.clearAllMocks());

  test("no cronExpression → creates task with nextRunAt=null", async () => {
    const { createTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await createTask("org_1", { name: "My Task" });
    const call = vi.mocked(repo.createTask).mock.calls[0]![0];
    assert.equal(call.cronExpression, null);
    assert.equal(call.nextRunAt, null);
  });

  test("valid cronExpression → computes nextRunAt before saving", async () => {
    const { createTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await createTask("org_1", { name: "Daily Check", cronExpression: "0 9 * * *" });
    const call = vi.mocked(repo.createTask).mock.calls[0]![0];
    assert.ok(call.nextRunAt instanceof Date, "nextRunAt should be a Date");
    assert.equal(call.cronExpression, "0 9 * * *");
  });

  test("invalid cronExpression → throws before hitting repository", async () => {
    const { createTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await expect(createTask("org_1", { name: "Bad", cronExpression: "not-valid" }))
      .rejects.toThrow("Invalid cron expression");
    assert.equal(vi.mocked(repo.createTask).mock.calls.length, 0);
  });

  test("4-part cron → throws before hitting repository", async () => {
    const { createTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await expect(createTask("org_1", { name: "Bad", cronExpression: "0 9 * *" }))
      .rejects.toThrow("Invalid cron expression");
    assert.equal(vi.mocked(repo.createTask).mock.calls.length, 0);
  });

  test("type is always GENERAL for user-created tasks", async () => {
    const { createTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await createTask("org_1", { name: "My Task" });
    const call = vi.mocked(repo.createTask).mock.calls[0]![0];
    assert.equal(call.type, "GENERAL");
    assert.equal(call.isDefault, false);
  });
});

// ─── deleteTask — default task protection ────────────────────────────────────

describe("deleteTask — default task protection", () => {
  afterEach(() => vi.clearAllMocks());

  test("deleting a default task → throws BadRequestError", async () => {
    const repo = await import("../../modules/tasks/tasks.repository.js");
    vi.mocked(repo.findTaskById).mockResolvedValue({
      id: "task_1", organizationId: "org_1", isDefault: true, name: "Morning Briefing",
    } as any);
    const { deleteTask } = await import("../../modules/tasks/tasks.service.js");
    await expect(deleteTask("org_1", "task_1"))
      .rejects.toThrow("Default tasks cannot be deleted");
    assert.equal(vi.mocked(repo.deleteTask).mock.calls.length, 0);
  });

  test("deleting a non-default task → calls repository.deleteTask", async () => {
    const repo = await import("../../modules/tasks/tasks.repository.js");
    vi.mocked(repo.findTaskById).mockResolvedValue({
      id: "task_2", organizationId: "org_1", isDefault: false, name: "Custom Task",
    } as any);
    vi.mocked(repo.deleteTask).mockResolvedValue({} as any);
    const { deleteTask } = await import("../../modules/tasks/tasks.service.js");
    await deleteTask("org_1", "task_2");
    assert.equal(vi.mocked(repo.deleteTask).mock.calls.length, 1);
  });

  test("deleting non-existent task → throws Task not found", async () => {
    const repo = await import("../../modules/tasks/tasks.repository.js");
    vi.mocked(repo.findTaskById).mockResolvedValue(null);
    const { deleteTask } = await import("../../modules/tasks/tasks.service.js");
    await expect(deleteTask("org_1", "ghost_id"))
      .rejects.toThrow("Task not found");
  });
});

// ─── updateTask — nextRunAt recomputation ────────────────────────────────────

describe("updateTask — nextRunAt recomputation", () => {
  const baseTask = {
    id: "task_1", organizationId: "org_1", isDefault: false,
    name: "Check", cronExpression: "0 8 * * *", timezone: "UTC",
  };

  beforeEach(async () => {
    const repo = await import("../../modules/tasks/tasks.repository.js");
    vi.mocked(repo.findTaskById).mockResolvedValue(baseTask as any);
    vi.mocked(repo.updateTask).mockResolvedValue({ ...baseTask } as any);
  });

  afterEach(() => vi.clearAllMocks());

  test("changing cronExpression → nextRunAt recomputed to match new schedule", async () => {
    const { updateTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await updateTask("org_1", "task_1", { cronExpression: "0 18 * * *" });
    const call = vi.mocked(repo.updateTask).mock.calls[0]![2];
    assert.ok(call.nextRunAt instanceof Date, "nextRunAt should be a Date");
    assert.equal(call.nextRunAt!.getUTCHours(), 18);
  });

  test("setting cronExpression to null → nextRunAt set to null", async () => {
    const { updateTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await updateTask("org_1", "task_1", { cronExpression: null });
    const call = vi.mocked(repo.updateTask).mock.calls[0]![2];
    assert.equal(call.nextRunAt, null);
  });

  test("invalid new cronExpression → throws before hitting repository", async () => {
    const { updateTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await expect(updateTask("org_1", "task_1", { cronExpression: "bad cron string" }))
      .rejects.toThrow("Invalid cron expression");
    assert.equal(vi.mocked(repo.updateTask).mock.calls.length, 0);
  });

  test("changing only isEnabled → nextRunAt is not included in update", async () => {
    const { updateTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await updateTask("org_1", "task_1", { isEnabled: false });
    const call = vi.mocked(repo.updateTask).mock.calls[0]![2];
    assert.equal(call.nextRunAt, undefined);
    assert.equal(call.isEnabled, false);
  });

  test("changing timezone with existing cron → recomputes nextRunAt in new tz", async () => {
    const { updateTask } = await import("../../modules/tasks/tasks.service.js");
    const repo = await import("../../modules/tasks/tasks.repository.js");
    await updateTask("org_1", "task_1", { timezone: "America/New_York" });
    const call = vi.mocked(repo.updateTask).mock.calls[0]![2];
    // 0 8 * * * in NY = 12:00 or 13:00 UTC depending on DST
    assert.ok(call.nextRunAt instanceof Date);
    const utcHour = call.nextRunAt!.getUTCHours();
    assert.ok(utcHour === 12 || utcHour === 13, `Expected 12 or 13 UTC, got ${utcHour}`);
  });
});
