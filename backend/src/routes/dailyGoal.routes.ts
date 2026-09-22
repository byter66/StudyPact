import { Router } from "express";
import {
  getDailyGoalStreak,
  patchDailyGoal,
  postCompleteDailyGoal,
  postDailyGoal,
} from "../controllers/dailyGoal.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/rooms/:roomId/daily-goal", postDailyGoal);
router.patch("/rooms/:roomId/daily-goal", patchDailyGoal);
router.post(
  "/rooms/:roomId/daily-goal/complete",
  requireAuth,
  postCompleteDailyGoal
);
router.get(
  "/rooms/:roomId/streak",
  requireAuth,
  getDailyGoalStreak
);

export default router;
