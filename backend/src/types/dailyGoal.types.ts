import { Request } from "express";

export interface DailyGoalRow {
  id: string;
  room_id: string;
  user_id: string;
  description: string;
  goal_date: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDailyGoalInput {
  roomId: string;
  userId: string;
  description: string;
}

export interface UpdateDailyGoalInput {
  description: string;
}

export interface AuthenticatedDailyGoalRequest extends Request {
  user?: {
    id: string;
  };
}

export class DailyGoalServiceError extends Error {
  public constructor(
    public readonly statusCode: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message);
    this.name = "DailyGoalServiceError";
  }
}
