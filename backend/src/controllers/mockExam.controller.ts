import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  createMockSession,
  createCustomPaperMockSession,
  createOrUpdateSubmission,
  getMockPaperById,
  getMockPapers,
  getOrCreateAttempt,
  getSessionWithPaper,
  getSubmissionById,
  startMockSession,
  uploadAndStoreMockSubmission,
} from "../services/mockExam.service";

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
    return res.status(200).json({ success: true, data: { session } });
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
    return res.status(500).json({ success: false, message: error?.message || "Unable to load the mock session." });
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
    const statusCode = message.includes("Only PDF") || message.includes("too large") || message.includes("empty") || message.includes("expired")
      ? 400
      : message.includes("not found") || message.includes("does not belong") || message.includes("current session")
        ? 403
        : 500;

    return res.status(statusCode).json({ success: false, message });
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
