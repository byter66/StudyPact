import { Router } from "express";
import {
  getPomodoroSessions,
  patchPomodoroSession,
  postCompletePomodoroSession,
  postPomodoroSession,
} from "../controllers/pomodoro.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/rooms/:roomId/pomodoro-sessions",
  requireAuth,
  postPomodoroSession
);
router.get(
  "/rooms/:roomId/pomodoro-sessions",
  requireAuth,
  getPomodoroSessions
);
router.patch(
  "/pomodoro-sessions/:sessionId",
  requireAuth,
  patchPomodoroSession
);
router.post(
  "/pomodoro-sessions/:sessionId/complete",
  requireAuth,
  postCompletePomodoroSession
);

export default router;
