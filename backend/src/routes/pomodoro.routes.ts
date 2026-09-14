import { Router } from "express";
import {
  getPomodoroSessions,
  patchPomodoroSession,
  postCompletePomodoroSession,
  postPomodoroSession,
} from "../controllers/pomodoro.controller";

const router = Router();

router.post("/rooms/:roomId/pomodoro-sessions", postPomodoroSession);
router.get("/rooms/:roomId/pomodoro-sessions", getPomodoroSessions);
router.patch("/pomodoro-sessions/:sessionId", patchPomodoroSession);
router.post(
  "/pomodoro-sessions/:sessionId/complete",
  postCompletePomodoroSession
);

export default router;
