import { prisma } from "../../config/prisma.js";
import { Agent, Prisma, Task, TaskType } from "../../../prisma/generated/prisma/client.js";

export function findTasksByOrg(organizationId: string, type?: TaskType) {
  return prisma.task.findMany({
    where: { organizationId, ...(type ? { type } : {}) },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export function findTaskById(id: string, organizationId: string) {
  return prisma.task.findFirst({ where: { id, organizationId } });
}

export function createTask(data: {
  organizationId: string;
  name: string;
  description?: string | null;
  type?: TaskType;
  agent?: Agent | null;
  cronExpression?: string | null;
  timezone?: string;
  isDefault?: boolean;
  payload?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  nextRunAt?: Date | null;
}) {
  return prisma.task.create({ data });
}

export function updateTask(
  id: string,
  organizationId: string,
  data: {
    name?: string;
    description?: string | null;
    cronExpression?: string | null;
    timezone?: string;
    isEnabled?: boolean;
    lastRunAt?: Date;
    nextRunAt?: Date | null;
  }
) {
  return prisma.task.update({ where: { id, organizationId }, data });
}

export function deleteTask(id: string, organizationId: string) {
  return prisma.task.delete({ where: { id, organizationId } });
}

export function findDueTasks() {
  return prisma.task.findMany({
    where: { isEnabled: true, nextRunAt: { lte: new Date() } },
  });
}

export function countTasksByOrg(organizationId: string) {
  return prisma.task.count({ where: { organizationId } });
}

export async function findDefaultTaskNames(organizationId: string): Promise<Set<string>> {
  const rows = await prisma.task.findMany({
    where: { organizationId, isDefault: true },
    select: { name: true },
  });
  return new Set(rows.map((r) => r.name));
}

export async function claimDueTasks(): Promise<Task[]> {
  return prisma.$queryRaw<Task[]>`
    UPDATE "task"
    SET "nextRunAt" = NULL, "updatedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "task"
      WHERE "isEnabled" = true AND "nextRunAt" <= NOW()
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}
