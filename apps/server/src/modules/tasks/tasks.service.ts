import cronParser from "cron-parser";
import { BadRequestError } from "../../common/errors/badRequest.js";
import * as tasksRepository from "./tasks.repository.js";
import { Agent, Task, TaskType } from "../../../prisma/generated/prisma/client.js";

const DEFAULT_TASKS: Array<{
  name: string;
  description: string;
  agent: Agent;
  cronExpression: string;
  payload?: Record<string, unknown>;
}> = [
  {
    name: "Weekly Financial Digest",
    description: "Send a weekly summary of key financial metrics to your team.",
    agent: "REX",
    cronExpression: "0 9 * * 1",
  },
  {
    name: "Morning Briefing",
    description: "Daily morning email briefing covering inbox, calendar, and priorities.",
    agent: "VEGA",
    cronExpression: "0 8 * * *",
    payload: { vegaBriefingType: "MORNING" },
  },
  {
    name: "Evening Wrap-up",
    description: "Daily evening email summary of the day's key events and follow-ups.",
    agent: "VEGA",
    cronExpression: "0 18 * * *",
    payload: { vegaBriefingType: "EVENING" },
  },
  {
    name: "Content Ideas",
    description: "Generate fresh content ideas for the day ahead.",
    agent: "MAYA",
    cronExpression: "0 9 * * *",
  },
  {
    name: "Weekly SEO Report",
    description: "Summarise keyword performance and surface new SEO opportunities.",
    agent: "SAGE",
    cronExpression: "0 9 * * 1",
  },
];

export function computeNextRun(cronExpression: string, timezone = "UTC"): Date | null {
  if (!cronExpression || cronExpression.trim().split(/\s+/).length !== 5) return null;
  try {
    const interval = cronParser.parseExpression(cronExpression, { tz: timezone });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

export async function seedDefaultTasks(organizationId: string) {
  const existing = await tasksRepository.findDefaultTaskNames(organizationId);

  for (const task of DEFAULT_TASKS) {
    if (existing.has(task.name)) continue;
    const nextRunAt = computeNextRun(task.cronExpression);
    await tasksRepository.createTask({
      organizationId,
      name: task.name,
      description: task.description,
      type: "AGENT" as TaskType,
      agent: task.agent,
      cronExpression: task.cronExpression,
      timezone: "UTC",
      isDefault: true,
      payload: task.payload ?? null,
      nextRunAt,
    });
  }
}

export function listTasks(organizationId: string, type?: TaskType) {
  return tasksRepository.findTasksByOrg(organizationId, type);
}

export async function createTask(
  organizationId: string,
  data: { name: string; description?: string | null; cronExpression?: string | null; timezone?: string }
) {
  const timezone = data.timezone ?? "UTC";
  let nextRunAt: Date | null = null;

  if (data.cronExpression) {
    nextRunAt = computeNextRun(data.cronExpression, timezone);
    if (!nextRunAt) throw new BadRequestError("Invalid cron expression");
  }

  return tasksRepository.createTask({
    organizationId,
    name: data.name,
    description: data.description,
    type: "GENERAL" as TaskType,
    cronExpression: data.cronExpression ?? null,
    timezone,
    isDefault: false,
    nextRunAt,
  });
}

export async function updateTask(
  organizationId: string,
  id: string,
  data: { name?: string; description?: string | null; cronExpression?: string | null; timezone?: string; isEnabled?: boolean }
) {
  const existing = await tasksRepository.findTaskById(id, organizationId);
  if (!existing) throw new BadRequestError("Task not found");

  const timezone = data.timezone ?? existing.timezone;
  let nextRunAt: Date | null | undefined = undefined;

  if ("cronExpression" in data) {
    if (data.cronExpression) {
      nextRunAt = computeNextRun(data.cronExpression, timezone);
      if (!nextRunAt) throw new BadRequestError("Invalid cron expression");
    } else {
      nextRunAt = null;
    }
  } else if ("timezone" in data && existing.cronExpression) {
    nextRunAt = computeNextRun(existing.cronExpression, timezone);
  }

  return tasksRepository.updateTask(id, organizationId, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...("cronExpression" in data ? { cronExpression: data.cronExpression } : {}),
    ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
    ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
    ...(nextRunAt !== undefined ? { nextRunAt } : {}),
  });
}

export async function deleteTask(organizationId: string, id: string) {
  const existing = await tasksRepository.findTaskById(id, organizationId);
  if (!existing) throw new BadRequestError("Task not found");
  if (existing.isDefault) throw new BadRequestError("Default tasks cannot be deleted");
  return tasksRepository.deleteTask(id, organizationId);
}

export async function dispatchTask(task: Task) {
  if (task.type !== "AGENT" || !task.agent) return;

  if (task.agent === "REX") {
    const { runWeeklyDigestForOrg } = await import("../agents/rex/rex.cron.js");
    await runWeeklyDigestForOrg(task.organizationId);
    return;
  }

  if (task.agent === "VEGA") {
    const { runBriefingForOrg } = await import("../agents/vega/vega.cron.js");
    const p = task.payload as { vegaBriefingType?: string } | null;
    const nameLower = task.name.toLowerCase();
    const type = (p?.vegaBriefingType as "MORNING" | "EVENING" | "WEEKLY") ??
      (nameLower.includes("evening") || nameLower.includes("wrap") ? "EVENING"
       : nameLower.includes("weekly") || nameLower.includes("insight") ? "WEEKLY"
       : "MORNING");
    await runBriefingForOrg(task.organizationId, type);
    return;
  }

  if (task.agent === "MAYA") {
    const { runContentIdeasForOrg } = await import("../agents/maya/maya.cron.js");
    await runContentIdeasForOrg(task.organizationId);
    return;
  }

  if (task.agent === "SAGE") {
    const { runSeoReportForOrg } = await import("../agents/sage/sage.cron.js");
    await runSeoReportForOrg(task.organizationId);
    return;
  }
}
