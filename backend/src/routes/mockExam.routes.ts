import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createMockSessionHandler,
  getMockExam,
  getPeerEvaluationAssignmentHandler,
  getEvaluationDiscussionMessagesHandler,
  createEvaluationDiscussionMessageHandler,
  getPeerEvaluationOverviewHandler,
  getMockSessionDetails,
  getMockSubmission,
  joinMockSessionHandler,
  listRoomMockSessions,
  listMockPapers,
  savePeerEvaluationDraftHandler,
  startMockSessionHandler,
  submitMockExam,
  submitPeerEvaluationHandler,
  submitMockPdf,
} from "../controllers/mockExam.controller";

const router = Router();

router.get("/papers", requireAuth, listMockPapers);
router.post("/sessions", requireAuth, createMockSessionHandler);
router.get("/rooms/:roomId/sessions", requireAuth, listRoomMockSessions);
router.post("/rooms/:roomId/sessions/:sessionId/join", requireAuth, joinMockSessionHandler);
router.post("/sessions/:sessionId/start", requireAuth, startMockSessionHandler);
router.get("/sessions/:sessionId/peer-evaluations", requireAuth, getPeerEvaluationOverviewHandler);
router.get("/sessions/:sessionId/peer-evaluations/:assignmentId", requireAuth, getPeerEvaluationAssignmentHandler);
router.get("/sessions/:sessionId/peer-evaluations/:assignmentId/discussion", requireAuth, getEvaluationDiscussionMessagesHandler);
router.post("/sessions/:sessionId/peer-evaluations/:assignmentId/discussion", requireAuth, createEvaluationDiscussionMessageHandler);
router.put("/sessions/:sessionId/peer-evaluations/:assignmentId/draft", requireAuth, savePeerEvaluationDraftHandler);
router.post("/sessions/:sessionId/peer-evaluations/:assignmentId", requireAuth, submitPeerEvaluationHandler);
router.get("/sessions/:sessionId", requireAuth, getMockSessionDetails);
router.get("/", getMockExam);
router.get("/:roomId", getMockExam);
router.post("/:roomId/submit", submitMockExam);
router.post("/submissions", requireAuth, submitMockPdf);
router.get("/submissions/:id", requireAuth, getMockSubmission);

export default router;
