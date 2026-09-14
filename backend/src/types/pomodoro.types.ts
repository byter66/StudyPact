import { Request } from "express";

export type PomodoroStatus =
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export interface PomodoroSession {
  id: string;
  roomId: string;
  userId: string;
  sessionType: "focus";
  plannedDurationSeconds: number;
  focusedDurationSeconds: number;
  status: PomodoroStatus;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface PomodoroSessionRow {
  id: string;
  room_id: string;
  user_id: string;
  session_type: "focus";
  planned_duration_seconds: number;
  focused_duration_seconds: number;
  status: PomodoroStatus;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface CreatePomodoroSessionInput {
  roomId: string;
  userId: string;
  plannedDurationSeconds: number;
}

export interface UpdatePomodoroSessionInput {
  status?: PomodoroStatus;
  focusedDurationSeconds?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}
