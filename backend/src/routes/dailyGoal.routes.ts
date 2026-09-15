import { Router } from "express";
import {
  patchDailyGoal,
  postDailyGoal,
} from "../controllers/dailyGoal.controller";

const router = Router();

router.post("/rooms/:roomId/daily-goal", postDailyGoal);
router.patch("/rooms/:roomId/daily-goal", patchDailyGoal);

export default router;
