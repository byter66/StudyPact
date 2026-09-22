import { Response } from "express";
import {
  completeTodayDailyGoal,
  createTodayDailyGoal,
  getCurrentStreak,
  updateTodayDailyGoal,
} from "../services/dailyGoal.service";
import {
  AuthenticatedDailyGoalRequest,
  CreateDailyGoalInput,
  DailyGoalServiceError,
  UpdateDailyGoalInput,
} from "../types/dailyGoal.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const requireUserId = (
  req: AuthenticatedDailyGoalRequest,
  res: Response
): string | null => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication is required for daily goals",
    });
    return null;
  }

  return userId;
};

const handleServiceError = (error: unknown, res: Response): boolean => {
  if (!(error instanceof DailyGoalServiceError)) {
    return false;
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
  });
  return true;
};

export const postDailyGoal = async (
  req: AuthenticatedDailyGoalRequest,
  res: Response
) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { roomId } = req.params;
  const { description } = req.body as Partial<CreateDailyGoalInput>;

  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  if (!isNonEmptyString(description)) {
    res.status(400).json({
      success: false,
      message: "description is required and must not be empty",
    });
    return;
  }

  try {
    const goal = await createTodayDailyGoal({
      roomId,
      userId,
      description,
    });
    res.status(201).json({ success: true, data: goal });
  } catch (error) {
    if (!handleServiceError(error, res)) {
      throw error;
    }
  }
};

export const patchDailyGoal = async (
  req: AuthenticatedDailyGoalRequest,
  res: Response
) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { roomId } = req.params;
  const { description } = req.body as Partial<UpdateDailyGoalInput>;

  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  if (!isNonEmptyString(description)) {
    res.status(400).json({
      success: false,
      message: "description is required and must not be empty",
    });
    return;
  }

  try {
    const goal = await updateTodayDailyGoal(roomId, userId, { description });
    res.status(200).json({ success: true, data: goal });
  } catch (error) {
    if (!handleServiceError(error, res)) {
      throw error;
    }
  }
};

export const postCompleteDailyGoal = async (
  req: AuthenticatedDailyGoalRequest,
  res: Response
) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { roomId } = req.params;

  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  try {
    const goal = await completeTodayDailyGoal(roomId, userId);
    res.status(200).json({ success: true, data: goal });
  } catch (error) {
    if (!handleServiceError(error, res)) {
      throw error;
    }
  }
};

export const getDailyGoalStreak = async (
  req: AuthenticatedDailyGoalRequest,
  res: Response
) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { roomId } = req.params;

  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  try {
    const streak = await getCurrentStreak(roomId, userId);
    res.status(200).json({
      success: true,
      data: { streak },
    });
  } catch (error) {
    if (!handleServiceError(error, res)) {
      throw error;
    }
  }
};
