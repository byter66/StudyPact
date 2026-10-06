import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createMockSessionHandler,
  getMockExam,
  getMockSessionDetails,
  getMockSubmission,
  joinMockSessionHandler,
  listRoomMockSessions,
  listMockPapers,
  startMockSessionHandler,
  submitMockExam,
  submitMockPdf,
} from "../controllers/mockExam.controller";

const router = Router();

router.get("/papers", requireAuth, listMockPapers);
router.post("/sessions", requireAuth, createMockSessionHandler);
router.get("/rooms/:roomId/sessions", requireAuth, listRoomMockSessions);
router.post("/rooms/:roomId/sessions/:sessionId/join", requireAuth, joinMockSessionHandler);
router.post("/sessions/:sessionId/start", requireAuth, startMockSessionHandler);
router.get("/sessions/:sessionId", requireAuth, getMockSessionDetails);
router.get("/", getMockExam);
router.get("/:roomId", getMockExam);
router.post("/:roomId/submit", submitMockExam);
router.post("/submissions", requireAuth, submitMockPdf);
router.get("/submissions/:id", requireAuth, getMockSubmission);

export default router;
