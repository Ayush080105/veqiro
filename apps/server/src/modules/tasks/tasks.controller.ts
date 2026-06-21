import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { CreateTaskSchema, UpdateTaskSchema } from "./tasks.schema.js";
import { TaskType } from "../../../prisma/generated/prisma/client.js";
import * as tasksService from "./tasks.service.js";

const requireContext = (req: Request) => {
  if (!req.userId || !req.organizationId) throw new UnauthenticatedError("Missing auth context");
  return { userId: req.userId, organizationId: req.organizationId };
};

export const listTasks = async (req: Request, res: Response) => {
  const { organizationId } = requireContext(req);
  const type = req.query["type"] as TaskType | undefined;
  const tasks = await tasksService.listTasks(organizationId, type);
  res.status(StatusCodes.OK).json(tasks);
};

export const createTask = async (req: Request, res: Response) => {
  const { organizationId } = requireContext(req);
  const input = CreateTaskSchema.parse(req.body);
  const task = await tasksService.createTask(organizationId, input);
  res.status(StatusCodes.CREATED).json(task);
};

export const updateTask = async (req: Request, res: Response) => {
  const { organizationId } = requireContext(req);
  const id = req.params["id"] as string;
  const input = UpdateTaskSchema.parse(req.body);
  const task = await tasksService.updateTask(organizationId, id, input);
  res.status(StatusCodes.OK).json(task);
};

export const deleteTask = async (req: Request, res: Response) => {
  const { organizationId } = requireContext(req);
  const id = req.params["id"] as string;
  await tasksService.deleteTask(organizationId, id);
  res.status(StatusCodes.NO_CONTENT).send();
};

export const runTask = async (req: Request, res: Response) => {
  const { organizationId } = requireContext(req);
  const id = req.params["id"] as string;
  const { findTaskById, updateTask } = await import("./tasks.repository.js");
  const task = await findTaskById(id, organizationId);
  if (!task) {
    res.status(StatusCodes.NOT_FOUND).json({ message: "Task not found" });
    return;
  }
  await updateTask(id, organizationId, { lastRunAt: new Date() });
  void tasksService.dispatchTask(task).catch((err) =>
    console.error(`[tasks] manual trigger failed for task ${id}:`, err)
  );
  res.status(StatusCodes.ACCEPTED).json({ message: "Task triggered" });
};
