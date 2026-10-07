import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  createMockSession,
  createCustomPaperMockSession,
  createOrUpdateSubmission,
  getMockPaperById,
  getMockPapers,
  getPeerEvaluationAssignment,
  getEvaluationDiscussionMessages,
  createEvaluationDiscussionMessage,
  getPeerEvaluationOverview,
  getMockSessionTiming,
  getOrCreateAttempt,
  getSessionWithPaper,
  getSubmissionById,
  joinMockSession,
  listJoinableMockSessions,
  savePeerEvaluationDraft,
  startMockSession,
  submitPeerEvaluation,
  uploadAndStoreMockSubmission,
} from "../services/mockExam.service";

export const getEvaluationDiscussionMessagesHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rawSessionId = req.params.sessionId;
    const rawAssignmentId = req.params.assignmentId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    const assignmentId = Array.isArray(rawAssignmentId) ? rawAssignmentId[0] : rawAssignmentId;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!sessionId || !assignmentId) {
      return res.status(400).json({ success: false, message: "sessionId and assignmentId are required." });
    }
    const messages = await getEvaluationDiscussionMessages(sessionId, assignmentId, userId);
    return res.status(200).json({ success: true, data: messages });
  } catch (error: any) {
    const message = error?.message || "Unable to load the evaluation discussion.";
    const status = message.includes("not authorized") ? 403 : message.includes("not found") ? 404 : 500;
    if (status === 500) console.error("Unable to load evaluation discussion:", error);
    return res.status(status).json({ success: false, message: status === 500 ? "Unable to load the evaluation discussion." : message });
  }
};

export const createEvaluationDiscussionMessageHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rawSessionId = req.params.sessionId;
    const rawAssignmentId = req.params.assignmentId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    const assignmentId = Array.isArray(rawAssignmentId) ? rawAssignmentId[0] : rawAssignmentId;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!sessionId || !assignmentId || typeof req.body?.content !== "string") {
      return res.status(400).json({ success: false, message: "sessionId, assignmentId, and content are required." });
    }
    const message = await createEvaluationDiscussionMessage(sessionId, assignmentId, userId, req.body.content);
    return res.status(201).json({ success: true, data: message });
  } catch (error: any) {
    const message = error?.message || "Unable to send the evaluation discussion message.";
    const status = message.includes("not authorized") ? 403
      : message.includes("between 1 and 5000") ? 400
        : message.includes("not found") || message.includes("does not belong") ? 404 : 500;
    if (status === 500) console.error("Unable to create evaluation discussion message:", error);
    return res.status(status).json({ success: false, message: status === 500 ? "Unable to send the evaluation discussion message." : message });
  }
};

export const getMockExam = async (_req: Request, res: Response) => {
  const papers = await getMockPapers();
  res.status(200).json({
    success: true,
    data: papers,
  });
};

export const listMockPapers = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const papers = await getMockPapers();
    return res.status(200).json({ success: true, data: papers });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Unable to load available question papers.",
    });
  }
};

export const createMockSessionHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const { roomId, paperId, durationSeconds, customPaper } = req.body as {
      roomId?: string;
      paperId?: string;
      durationSeconds?: number;
      customPaper?: { name?: string; type?: string; size?: number; data?: string };
    };
    if (!roomId) {
      return res.status(400).json({ success: false, message: "roomId is required." });
    }
    if (typeof durationSeconds !== "number") {
      return res.status(400).json({ success: false, message: "durationSeconds is required." });
    }

    let session;
    if (customPaper) {
      if (!customPaper.data) {
        return res.status(400).json({ success: false, message: "The custom question paper PDF is empty." });
      }
      const base64 = customPaper.data.includes(",") ? customPaper.data.split(",")[1] : customPaper.data;
      const fileBuffer = Buffer.from(base64, "base64");
      session = await createCustomPaperMockSession({
        roomId,
        createdBy: userId,
        durationSeconds,
        fileName: customPaper.name ?? "question-paper.pdf",
        fileType: customPaper.type ?? "application/pdf",
        fileSize: Number(customPaper.size ?? fileBuffer.length),
        fileBuffer,
      });
    } else {
      if (!paperId) {
        return res.status(400).json({ success: false, message: "A question paper must be selected before creating a mock exam." });
      }
      session = await createMockSession(roomId, paperId, userId, durationSeconds);
    }

    const attempt = await getOrCreateAttempt(session.id, userId);
    const paper = await getMockPaperById(session.paperId);
    if (!paper) {
      throw new Error("The selected mock paper could not be loaded.");
    }

    return res.status(200).json({
      success: true,
      data: {
        session,
        attempt,
        paper,
      },
    });
  } catch (error: any) {
    const message = error?.message || "Unable to create the mock session.";
    const status = message.includes("not found") ? 404
      : message.includes("member of this Study Room") ? 403
        : message.includes("paperId") || message.includes("must be selected") || message.includes("duration") || message.includes("PDF") || message.includes("empty") || message.includes("too large") ? 400
          : 500;
    return res.status(status).json({ success: false, message });
  }
};

export const startMockSessionHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const { durationSeconds } = req.body as { durationSeconds?: number };
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required." });
    }
    if (typeof durationSeconds !== "number") {
      return res.status(400).json({ success: false, message: "durationSeconds is required." });
    }

    const session = await startMockSession(sessionId, userId, durationSeconds);
    return res.status(200).json({
      success: true,
      data: { session, ...getMockSessionTiming(session) },
    });
  } catch (error: any) {
    const message = error?.message || "Unable to start the mock exam.";
    const status = message.includes("not found") ? 404
      : message.includes("Only the session creator") ? 403
        : message.includes("member of this Study Room") ? 403
        : message.includes("duration") || message.includes("state") || message.includes("no longer") ? 400
          : 500;
    return res.status(status).json({ success: false, message });
  }
};

export const getMockSessionDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const rawSessionId = req.params.sessionId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required." });
    }

    const sessionData = await getSessionWithPaper(sessionId, userId);

    if (!sessionData) {
      return res.status(404).json({ success: false, message: "Mock session not found." });
    }

    return res.status(200).json({ success: true, data: sessionData });
  } catch (error: any) {
    const message = error?.message || "Unable to load the mock session.";
    const status = message.includes("no longer joinable") ? 409 : 500;
    return res.status(status).json({ success: false, message });
  }
};

export const getPeerEvaluationOverviewHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const rawSessionId = req.params.sessionId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required." });
    }

    const overview = await getPeerEvaluationOverview(sessionId, userId);
    return res.status(200).json({ success: true, data: overview });
  } catch (error: any) {
    const message = error?.message || "Unable to load peer evaluations.";
    const status = message.includes("must be a member") || message.includes("must join") ? 403
      : message.includes("not found") ? 404
        : 500;
    if (status === 500) console.error("Unable to load peer evaluations:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Unable to load peer evaluations. Please try again." : message,
    });
  }
};

export const getPeerEvaluationAssignmentHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const rawSessionId = req.params.sessionId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    const rawAssignmentId = req.params.assignmentId;
    const assignmentId = Array.isArray(rawAssignmentId) ? rawAssignmentId[0] : rawAssignmentId;
    if (!sessionId || !assignmentId) {
      return res.status(400).json({ success: false, message: "sessionId and assignmentId are required." });
    }

    const assignment = await getPeerEvaluationAssignment(sessionId, assignmentId, userId);
    return res.status(200).json({ success: true, data: assignment });
  } catch (error: any) {
    const message = error?.message || "Unable to load this peer evaluation.";
    const status = message.includes("cannot evaluate")
      || message.includes("must be a member of this Study Room") ? 403
      : message.includes("not found") ? 404
        : message.includes("already been completed") || message.includes("opens after") ? 409
          : message.includes("rubric") ? 422
            : 500;
    if (status === 500) console.error("Unable to load peer evaluation assignment:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Unable to load this peer evaluation. Please try again." : message,
    });
  }
};

export const submitPeerEvaluationHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const rawSessionId = req.params.sessionId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    const rawAssignmentId = req.params.assignmentId;
    const assignmentId = Array.isArray(rawAssignmentId) ? rawAssignmentId[0] : rawAssignmentId;
    if (!sessionId || !assignmentId) {
      return res.status(400).json({ success: false, message: "sessionId and assignmentId are required." });
    }

    const { rubricScores: inputScores, comments: inputComments } = req.body as {
      rubricScores?: unknown;
      comments?: unknown;
    };
    const isValidRubricScore = (item: unknown): item is { questionId: string; score: number } => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as { questionId?: unknown; score?: unknown };
      return typeof candidate.questionId === "string" && typeof candidate.score === "number";
    };
    const rubricScores = Array.isArray(inputScores) ? inputScores : null;
    const comments = typeof inputComments === "string" ? inputComments : null;
    if (
      !rubricScores
      || !rubricScores.every(isValidRubricScore)
      || comments === null
    ) {
      return res.status(400).json({ success: false, message: "Rubric scores and comments are required." });
    }

    const score = await submitPeerEvaluation(
      sessionId,
      assignmentId,
      userId,
      rubricScores,
      comments,
    );
    return res.status(200).json({ success: true, data: score });
  } catch (error: any) {
    const message = error?.message || "Unable to submit this evaluation.";
    const status = message.includes("cannot evaluate") ? 403
      : message.includes("not found") ? 404
        : message.includes("already been completed") || message.includes("already been submitted")
          || message.includes("opens after") || message.includes("no longer available") ? 409
          : message.includes("score") || message.includes("rubric") || message.includes("comments")
            || message.includes("Open this assigned") ? 400
            : 500;
    if (status === 500) console.error("Unable to submit peer evaluation:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Unable to submit this evaluation. Please try again." : message,
    });
  }
};

export const savePeerEvaluationDraftHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const rawSessionId = req.params.sessionId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    const rawAssignmentId = req.params.assignmentId;
    const assignmentId = Array.isArray(rawAssignmentId) ? rawAssignmentId[0] : rawAssignmentId;
    if (!sessionId || !assignmentId) {
      return res.status(400).json({ success: false, message: "sessionId and assignmentId are required." });
    }

    const { rubricScores: inputScores, comments: inputComments } = req.body as {
      rubricScores?: unknown;
      comments?: unknown;
    };
    const isValidRubricScore = (item: unknown): item is { questionId: string; score: number } => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as { questionId?: unknown; score?: unknown };
      return typeof candidate.questionId === "string" && typeof candidate.score === "number";
    };
    const rubricScores = Array.isArray(inputScores) ? inputScores : null;
    const comments = typeof inputComments === "string" ? inputComments : null;
    if (!rubricScores || !rubricScores.every(isValidRubricScore) || comments === null) {
      return res.status(400).json({ success: false, message: "Rubric scores and comments are required." });
    }

    await savePeerEvaluationDraft(sessionId, assignmentId, userId, rubricScores, comments);
    return res.status(200).json({ success: true, data: { saved: true } });
  } catch (error: any) {
    const message = error?.message || "Unable to save this evaluation draft.";
    const status = message.includes("cannot evaluate") ? 403
      : message.includes("not found") ? 404
        : message.includes("already been completed") || message.includes("opens after")
          || message.includes("no longer available") ? 409
          : message.includes("score") || message.includes("rubric") || message.includes("comments")
            || message.includes("Open this assigned") ? 400
            : 500;
    if (status === 500) console.error("Unable to save peer evaluation draft:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Unable to save this evaluation draft. Please try again." : message,
    });
  }
};

export const listRoomMockSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const rawRoomId = req.params.roomId;
    const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;
    if (!roomId) {
      return res.status(400).json({ success: false, message: "roomId is required." });
    }

    const sessions = await listJoinableMockSessions(roomId, userId);
    return res.status(200).json({ success: true, data: sessions });
  } catch (error: any) {
    const message = error?.message || "Unable to load active mock rooms.";
    console.error("Unable to load active mock rooms:", error);
    const status = message.includes("member of this Study Room") ? 403 : 500;
    return res.status(status).json({
      success: false,
      message: status === 403 ? message : "Unable to load active mock rooms. Please try again.",
    });
  }
};

export const joinMockSessionHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const rawRoomId = req.params.roomId;
    const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;
    const rawSessionId = req.params.sessionId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    if (!roomId || !sessionId) {
      return res.status(400).json({ success: false, message: "roomId and sessionId are required." });
    }

    const result = await joinMockSession(roomId, sessionId, userId);
    if (!result) {
      return res.status(404).json({ success: false, message: "Mock session not found in this Study Room." });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    const message = error?.message || "Unable to join the mock room.";
    console.error("Unable to join mock room:", error);
    const status = message.includes("member of this Study Room") ? 403
      : message.includes("no longer joinable") ? 409
        : message.includes("not found") ? 404
          : 500;
    const responseMessage = status === 403 || status === 404 || status === 409
      ? message
      : "Unable to join this mock room. Please try again.";
    return res.status(status).json({ success: false, message: responseMessage });
  }
};

export const submitMockExam = async (req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    message: "Submit your completed answer script as a PDF after the mock exam ends.",
  });
};

export const submitMockPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const { attemptId, sessionId, file } = req.body as {
      attemptId?: string;
      sessionId?: string;
      file?: { name?: string; type?: string; size?: number; data?: string };
    };

    if (!attemptId || !sessionId || !file) {
      return res.status(400).json({
        success: false,
        message: "Missing attemptId, sessionId, or PDF file.",
      });
    }

    if (!file.data) {
      return res.status(400).json({ success: false, message: "The selected PDF file is empty." });
    }

    let buffer: Buffer;
    try {
      const base64 = file.data.includes(",") ? file.data.split(",")[1] : file.data;
      buffer = Buffer.from(base64, "base64");
    } catch {
      return res.status(400).json({ success: false, message: "The uploaded PDF could not be processed." });
    }

    const record = await uploadAndStoreMockSubmission({
      attemptId,
      participantId: userId,
      sessionId,
      fileBuffer: buffer,
      fileName: file.name ?? "answer-script.pdf",
      fileType: file.type ?? "application/pdf",
      fileSize: Number(file.size ?? buffer.length),
    });

    return res.status(200).json({
      success: true,
      data: {
        id: record.id,
        status: record.status,
        submittedAt: record.submittedAt,
        filePath: record.filePath,
        fileType: record.fileType,
        fileSize: record.fileSize,
      },
    });
  } catch (error: any) {
    const message = error?.message || "Unable to upload the answer script.";
    const statusCode = message.includes("Only PDF")
      || message.includes("valid PDF")
      || message.includes("too large")
      || message.includes("empty")
      || message.includes("file size")
      ? 400
      : message.includes("submission window") || message.includes("already been submitted")
        ? 409
        : message.includes("not found") || message.includes("does not belong")
          ? 403
          : 500;
    if (statusCode === 500) {
      console.error("Unable to upload the answer script:", error);
    }

    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Unable to upload the answer script. Please try again." : message,
    });
  }
};

export const getMockSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      return res.status(400).json({ success: false, message: "Submission id is required." });
    }

    const submission = await getSubmissionById(id);

    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found." });
    }

    if (submission.participantId !== userId) {
      return res.status(403).json({ success: false, message: "You cannot access another student's submission." });
    }

    return res.status(200).json({ success: true, data: submission });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || "Unable to load the submission." });
  }
};
