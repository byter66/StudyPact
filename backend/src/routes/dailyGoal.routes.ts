import { Router } from "express";
import {
  getDailyGoal,
  getDailyGoalStreak,
  patchDailyGoal,
  postCompleteDailyGoal,
  postDailyGoal,
} from "../controllers/dailyGoal.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/rooms/:roomId/daily-goal", requireAuth, postDailyGoal);
router.patch("/rooms/:roomId/daily-goal", requireAuth, patchDailyGoal);
router.get("/rooms/:roomId/daily-goal", requireAuth, getDailyGoal);
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
