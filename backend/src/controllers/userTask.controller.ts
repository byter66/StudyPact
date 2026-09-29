import { Response } from "express";
import { AuthenticatedUserTaskRequest } from "../types/userTask.types";
import {
  createUserTask,
  listUserTasks,
  updateUserTask,
} from "../services/userTask.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getAuthenticatedUserId = (
  req: AuthenticatedUserTaskRequest,
  res: Response
): string | null => {
  const userId = req.user?.id;
  if (!userId || !UUID_PATTERN.test(userId)) {
    res.status(401).json({
      success: false,
      message: "Authentication is required for tasks.",
    });
    return null;
  }
  return userId;
};

export const getUserTasks = async (
  req: AuthenticatedUserTaskRequest,
  res: Response
) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const tasks = await listUserTasks(userId);
  res.status(200).json({ success: true, data: tasks });
};

export const postUserTask = async (
  req: AuthenticatedUserTaskRequest,
  res: Response
) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const { title } = req.body as { title?: unknown };
  if (typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: "Task title is required and must not be empty.",
    });
    return;
  }

  const task = await createUserTask(userId, title);
  res.status(201).json({ success: true, data: task });
};

export const patchUserTask = async (
  req: AuthenticatedUserTaskRequest,
  res: Response
) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const taskId = req.params.id;
  if (typeof taskId !== "string" || !UUID_PATTERN.test(taskId)) {
    res.status(400).json({ success: false, message: "Invalid task ID." });
    return;
  }

  const { title, completed } = req.body as {
    title?: unknown;
    completed?: unknown;
  };
  const updates: { title?: string; completed?: boolean } = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Task title must not be empty.",
      });
      return;
    }
    updates.title = title.trim();
  }

  if (completed !== undefined) {
    if (typeof completed !== "boolean") {
      res.status(400).json({
        success: false,
        message: "completed must be a boolean.",
      });
      return;
    }
    updates.completed = completed;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({
      success: false,
      message: "At least one task field must be provided.",
    });
    return;
  }

  const task = await updateUserTask(userId, taskId, updates);
  if (!task) {
    res.status(404).json({ success: false, message: "Task not found." });
    return;
  }

  res.status(200).json({ success: true, data: task });
};
