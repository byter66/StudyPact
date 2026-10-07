import { Router } from "express";
import {
  getDailyGoals,
  getDailyGoalLeaderboard,
  getDailyGoalStreak,
  postResetDailyGoalStreak,
  patchDailyGoal,
  postCompleteDailyGoal,
  postDailyGoal,
} from "../controllers/dailyGoal.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/daily-goals/today", requireAuth, getDailyGoals);
router.post("/daily-goals", requireAuth, postDailyGoal);
router.patch("/daily-goals/:goalId", requireAuth, patchDailyGoal);
router.post("/daily-goals/:goalId/complete", requireAuth, postCompleteDailyGoal);
router.get("/daily-goals/streak", requireAuth, getDailyGoalStreak);
router.post("/daily-goals/streak/reset", requireAuth, postResetDailyGoalStreak);
router.get("/daily-goals/leaderboard", requireAuth, getDailyGoalLeaderboard);

export default router;
