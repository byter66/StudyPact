import { Request } from "express";

export interface UserTaskRow {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserTask {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedUserTaskRequest extends Request {
  user?: {
    id: string;
  };
}

export class TaskRequirementError extends Error {
  public readonly statusCode = 403;

  public constructor() {
    super("Add at least one task on your dashboard before joining a room.");
    this.name = "TaskRequirementError";
  }
}
