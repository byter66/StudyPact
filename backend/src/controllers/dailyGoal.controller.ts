import { Response } from "express";
import {
  completeDailyGoal,
  createTodayDailyGoal,
  getDailyGoalLeaderboard as getGlobalDailyGoalLeaderboard,
  getDailyGoalStreak as getUserDailyGoalStreak,
  getTodayDailyGoals,
  updateDailyGoal,
} from "../services/dailyGoal.service";
import { AuthenticatedDailyGoalRequest, DailyGoalServiceError } from "../types/dailyGoal.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const handleError = (error: unknown, res: Response) => {
  if (error instanceof DailyGoalServiceError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return true;
  }
  return false;
};

const requireDescription = (value: unknown, res: Response): value is string => {
  if (typeof value !== "string" || !value.trim()) {
    res.status(400).json({
      success: false,
      message: "description is required and must not be empty",
    });
    return false;
  }
  return true;
};

const toResponse = (goal: {
  id: string;
  userId: string;
  description: string;
  date: string;
  isCompleted: () => boolean;
}) => ({
  id: goal.id,
  userId: goal.userId,
  description: goal.description,
  date: goal.date,
  isCompleted: goal.isCompleted(),
});

export const getDailyGoals = async (req: AuthenticatedDailyGoalRequest, res: Response) => {
  try {
    const goals = await getTodayDailyGoals(req);
    return res.status(200).json({
      success: true,
      data: goals.map((goal) => ({
        id: goal.id,
        userId: goal.userId,
        description: goal.description,
        date: goal.date,
        isCompleted: goal.isCompleted(),
      })),
    });
  } catch (error) {
    if (!handleError(error, res)) throw error;
  }
};

export const postDailyGoal = async (req: AuthenticatedDailyGoalRequest, res: Response) => {
  if (!requireDescription(req.body?.description, res)) return;
  try {
    const goal = await createTodayDailyGoal(req, req.body.description);
    return res.status(201).json({ success: true, data: toResponse(goal) });
  } catch (error) {
    if (!handleError(error, res)) throw error;
  }
};

export const patchDailyGoal = async (req: AuthenticatedDailyGoalRequest, res: Response) => {
  const goalId = Array.isArray(req.params.goalId) ? req.params.goalId[0] : req.params.goalId;
  if (!UUID_PATTERN.test(goalId || "")) {
    return res.status(400).json({ success: false, message: "Invalid daily goal ID" });
  }
  if (!requireDescription(req.body?.description, res)) return;
  try {
    const goal = await updateDailyGoal(req, goalId, req.body.description);
    return res.status(200).json({ success: true, data: toResponse(goal) });
  } catch (error) {
    if (!handleError(error, res)) throw error;
  }
};

export const postCompleteDailyGoal = async (req: AuthenticatedDailyGoalRequest, res: Response) => {
  const goalId = Array.isArray(req.params.goalId) ? req.params.goalId[0] : req.params.goalId;
  if (!UUID_PATTERN.test(goalId || "")) {
    return res.status(400).json({ success: false, message: "Invalid daily goal ID" });
  }
  try {
    const goal = await completeDailyGoal(req, goalId);
    return res.status(200).json({ success: true, data: toResponse(goal) });
  } catch (error) {
    if (!handleError(error, res)) throw error;
  }
};

export const getDailyGoalStreak = async (req: AuthenticatedDailyGoalRequest, res: Response) => {
  try {
    const streak = await getUserDailyGoalStreak(req);
    return res.status(200).json({ success: true, data: { streak } });
  } catch (error) {
    if (!handleError(error, res)) throw error;
  }
};

export const getDailyGoalLeaderboard = async (
  _req: AuthenticatedDailyGoalRequest,
  res: Response
) => {
  try {
    const leaderboard = await getGlobalDailyGoalLeaderboard();
    return res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    if (!handleError(error, res)) throw error;
  }
};
