import { supabase } from "../config/supabase";
import {
  CreatePomodoroSessionInput,
  PomodoroSession,
  PomodoroSessionRow,
  PomodoroStatus,
  UpdatePomodoroSessionInput,
} from "../types/pomodoro.types";

const POMODORO_COLUMNS =
  "id, room_id, user_id, session_type, planned_duration_seconds, focused_duration_seconds, status, started_at, completed_at, updated_at";

const toPomodoroSession = (row: PomodoroSessionRow): PomodoroSession => ({
  id: row.id,
  roomId: row.room_id,
  userId: row.user_id,
  sessionType: row.session_type,
  plannedDurationSeconds: row.planned_duration_seconds,
  focusedDurationSeconds: row.focused_duration_seconds,
  status: row.status,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  updatedAt: row.updated_at,
});

export const createPomodoroSession = async (
  input: CreatePomodoroSessionInput
): Promise<PomodoroSession> => {
  const { data, error } = await supabase
    .from("pomodoro_sessions")
    .insert({
      room_id: input.roomId,
      user_id: input.userId,
      session_type: "focus",
      planned_duration_seconds: input.plannedDurationSeconds,
      focused_duration_seconds: 0,
      status: "active",
    })
    .select(POMODORO_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return toPomodoroSession(data as PomodoroSessionRow);
};

export const updatePomodoroSession = async (
  id: string,
  userId: string,
  input: UpdatePomodoroSessionInput
): Promise<PomodoroSession | null> => {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.status !== undefined) {
    updates.status = input.status;
    updates.completed_at =
      input.status === "completed" || input.status === "cancelled"
        ? new Date().toISOString()
        : null;
  }

  if (input.focusedDurationSeconds !== undefined) {
    updates.focused_duration_seconds = input.focusedDurationSeconds;
  }

  const { data, error } = await supabase
    .from("pomodoro_sessions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select(POMODORO_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toPomodoroSession(data as PomodoroSessionRow) : null;
};

export const completePomodoroSession = async (
  id: string,
  userId: string,
  focusedDurationSeconds: number
): Promise<PomodoroSession | null> =>
  updatePomodoroSession(id, userId, {
    status: "completed",
    focusedDurationSeconds,
  });

export const listPomodoroSessions = async (
  roomId: string,
  userId: string
): Promise<PomodoroSession[]> => {
  const { data, error } = await supabase
    .from("pomodoro_sessions")
    .select(POMODORO_COLUMNS)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as PomodoroSessionRow[]).map(toPomodoroSession);
};

export const isPomodoroStatus = (
  value: unknown
): value is PomodoroStatus =>
  value === "active" ||
  value === "paused" ||
  value === "completed" ||
  value === "cancelled";
