import { Response } from "express";
import {
  completePomodoroSession,
  createPomodoroSession,
  isPomodoroStatus,
  listPomodoroSessions,
  updatePomodoroSession,
} from "../services/pomodoro.service";
import {
  AuthenticatedRequest,
  CreatePomodoroSessionInput,
  UpdatePomodoroSessionInput,
} from "../types/pomodoro.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 86400;

const isValidDuration = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= MIN_DURATION_SECONDS &&
  value <= MAX_DURATION_SECONDS;

const isValidFocusedDuration = (
  value: unknown,
  plannedDurationSeconds?: number
): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  (plannedDurationSeconds === undefined ||
    value <= plannedDurationSeconds);

const requireUserId = (
  req: AuthenticatedRequest,
  res: Response
): string | null => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication is required for Pomodoro sessions",
    });
    return null;
  }

  return userId;
};

export const postPomodoroSession = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { roomId } = req.params;
  const { plannedDurationSeconds } =
    req.body as Partial<CreatePomodoroSessionInput>;

  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  if (!isValidDuration(plannedDurationSeconds)) {
    res.status(400).json({
      success: false,
      message: `plannedDurationSeconds must be an integer between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}`,
    });
    return;
  }

  const session = await createPomodoroSession({
    roomId,
    userId,
    plannedDurationSeconds,
  });

  res.status(201).json({ success: true, data: session });
};

export const patchPomodoroSession = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { sessionId } = req.params;
  const { status, focusedDurationSeconds } =
    req.body as Partial<UpdatePomodoroSessionInput>;

  if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) {
    res.status(400).json({ success: false, message: "Invalid session ID" });
    return;
  }

  if (status === undefined && focusedDurationSeconds === undefined) {
    res.status(400).json({
      success: false,
      message: "status or focusedDurationSeconds is required",
    });
    return;
  }

  if (status !== undefined && !isPomodoroStatus(status)) {
    res.status(400).json({
      success: false,
      message:
        "status must be active, paused, completed, or cancelled",
    });
    return;
  }

  if (
    focusedDurationSeconds !== undefined &&
    !isValidFocusedDuration(focusedDurationSeconds)
  ) {
    res.status(400).json({
      success: false,
      message:
        "focusedDurationSeconds must be a non-negative integer",
    });
    return;
  }

  const session = await updatePomodoroSession(sessionId, userId, {
    status,
    focusedDurationSeconds,
  });

  if (!session) {
    res.status(404).json({ success: false, message: "Pomodoro session not found" });
    return;
  }

  res.status(200).json({ success: true, data: session });
};

export const postCompletePomodoroSession = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { sessionId } = req.params;
  const { focusedDurationSeconds } =
    req.body as Partial<{ focusedDurationSeconds: number }>;

  if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) {
    res.status(400).json({ success: false, message: "Invalid session ID" });
    return;
  }

  if (!isValidFocusedDuration(focusedDurationSeconds)) {
    res.status(400).json({
      success: false,
      message:
        "focusedDurationSeconds must be a non-negative integer",
    });
    return;
  }

  const session = await completePomodoroSession(
    sessionId,
    userId,
    focusedDurationSeconds
  );

  if (!session) {
    res.status(404).json({ success: false, message: "Pomodoro session not found" });
    return;
  }

  res.status(200).json({ success: true, data: session });
};

export const getPomodoroSessions = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { roomId } = req.params;

  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  const sessions = await listPomodoroSessions(roomId, userId);
  res.status(200).json({ success: true, data: sessions });
};
