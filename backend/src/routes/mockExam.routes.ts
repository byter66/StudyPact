import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createMockSessionHandler,
  getMockExam,
  getMockSessionDetails,
  getMockSubmission,
  listMockPapers,
  startMockSessionHandler,
  submitMockExam,
  submitMockPdf,
} from "../controllers/mockExam.controller";

const router = Router();

router.get("/papers", requireAuth, listMockPapers);
router.post("/sessions", requireAuth, createMockSessionHandler);
router.post("/sessions/:sessionId/start", requireAuth, startMockSessionHandler);
router.get("/sessions/:sessionId", requireAuth, getMockSessionDetails);
router.get("/", getMockExam);
router.get("/:roomId", getMockExam);
router.post("/:roomId/submit", submitMockExam);
router.post("/submissions", requireAuth, submitMockPdf);
router.get("/submissions/:id", requireAuth, getMockSubmission);

export default router;
