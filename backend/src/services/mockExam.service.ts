import { supabase, supabaseAdmin } from "../config/supabase";

export type MockExamQuestionType = "objective" | "written";

export interface MockExamRubricItem {
  criterion: string;
  marks: number;
}

export interface MockExamQuestion {
  id: string;
  type: MockExamQuestionType;
  subject: string;
  question: string;
  imageUrl?: string;
  options?: string[];
  correctAnswer?: string;
  maxMarks: number;
  negativeMarks?: number;
  rubric?: MockExamRubricItem[];
}

export interface MockExamPaper {
  id: string;
  title: string;
  paperName?: string;
  examTag: string;
  examYear?: number | null;
  subject?: string;
  durationMinutes: number | null;
  totalMarks?: number;
  evaluationType?: string;
  sourceReference?: string | null;
  documentUrl?: string | null;
  questions: MockExamQuestion[];
}

export interface MockSession {
  id: string;
  roomId: string;
  paperId: string;
  createdBy: string | null;
  startedAt: string | null;
  endsAt: string | null;
  durationSeconds: number | null;
  status: "draft" | "live" | "expired" | "completed";
}

export interface ActiveMockRoom {
  session: MockSession;
  creator: { id: string | null; name: string };
  paper: { id: string; name: string; title: string };
  joinable: boolean;
}

export interface MockSubmissionRecord {
  id: string;
  attemptId: string;
  participantId: string;
  sessionId: string;
  filePath: string;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  status: "DRAFT" | "SUBMITTED" | "UNDER_EVALUATION" | "EVALUATED" | "FINALIZED";
  submittedAt?: string | null;
  createdAt: string;
  downloadUrl?: string | null;
}

const MOCK_SUBMISSIONS_BUCKET = "mock-submissions";
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
export const MOCK_SUBMISSION_WINDOW_SECONDS = 5 * 60;

export const getMockSessionTiming = (session: MockSession, now = new Date()) => ({
  serverNow: now.toISOString(),
  submissionDeadlineAt: session.endsAt
    ? new Date(new Date(session.endsAt).getTime() + MOCK_SUBMISSION_WINDOW_SECONDS * 1000).toISOString()
    : null,
});

export const mockSubmissionLimits = {
  maxPdfSizeBytes: MAX_PDF_SIZE_BYTES,
};

const toQuestionType = (value?: string): MockExamQuestionType => {
  if (!value) {
    return "objective";
  }

  return value === "SUBJECTIVE" ? "written" : "objective";
};

const normalizeDbQuestion = (row: any): MockExamQuestion => {
  const optionList = Array.isArray(row.options) ? row.options : undefined;
  const rubric = Array.isArray(row.marking_scheme)
    ? row.marking_scheme.map((item: any) => ({
        criterion: item?.criterion ?? "Criterion",
        marks: Number(item?.marks ?? 0),
      }))
    : undefined;

  return {
    id: row.id,
    type: toQuestionType(row.question_type),
    subject: row.subject ?? row.metadata?.subject ?? "General",
    question: row.question_text ?? row.question ?? "",
    imageUrl: row.metadata?.image_url ?? undefined,
    options: optionList?.map((option: any) => String(option)),
    correctAnswer: undefined,
    maxMarks: Number(row.max_marks ?? 0),
    negativeMarks: Number(row.negative_marks ?? 0),
    rubric,
  };
};

const normalizeDbPaper = (row: any): MockExamPaper => {
  const questionRows = Array.isArray(row.mock_questions) ? row.mock_questions : [];
  const paperName = row.paper_name || row.title || row.exam_name || "Mock Paper";
  const totalMarks = Number(row.total_marks ?? questionRows.reduce((sum: number, question: any) => sum + Number(question.max_marks ?? 0), 0));
  const durationSeconds = Number(row.duration_seconds ?? 0);

  return {
    id: row.id,
    title: paperName,
    paperName,
    examTag: row.exam_name || "Mock",
    examYear: row.exam_year ?? null,
    subject: row.subject || questionRows[0]?.metadata?.subject || "General",
    durationMinutes: durationSeconds > 0 ? Math.round(durationSeconds / 60) : null,
    totalMarks,
    evaluationType: row.evaluation_type || "objective",
    sourceReference: row.source_reference ?? null,
    questions: questionRows
      .sort((left: any, right: any) => Number(left.question_number) - Number(right.question_number))
      .map((question: any) => normalizeDbQuestion(question)),
  };
};

export interface MockAttemptSummary {
  totalPossible: number;
  objectiveMarks: number;
  writtenMarks: number;
  overall: number;
  objectiveResults: Array<{
    id: string;
    subject: string;
    correct: boolean;
    awarded: number;
    answer: string;
    correctAnswer?: string;
  }>;
  writtenResults: Array<{
    id: string;
    subject: string;
    answered: boolean;
    rubric: MockExamRubricItem[];
    answer: string;
  }>;
}

export const evaluateMockAttempt = (
  paper: MockExamPaper,
  answers: Record<string, string> = {}
): MockAttemptSummary => {
  const summary: MockAttemptSummary = {
    totalPossible: 0,
    objectiveMarks: 0,
    writtenMarks: 0,
    overall: 0,
    objectiveResults: [],
    writtenResults: [],
  };

  for (const question of paper.questions) {
    const normalizedValue = typeof answers[question.id] === "string"
      ? answers[question.id].trim()
      : "";
    summary.totalPossible += Number(question.maxMarks || 0);

    if (question.type === "objective") {
      const chosenOption = question.options?.find(
        (option) => option.toLowerCase() === normalizedValue.toLowerCase()
      );
      const isCorrect = Boolean(chosenOption) && Boolean(question.correctAnswer)
        ? chosenOption!.toLowerCase() === question.correctAnswer!.toLowerCase()
        : false;

      const awarded = isCorrect ? Number(question.maxMarks || 0) : 0;

      if (normalizedValue) {
        summary.objectiveMarks += isCorrect ? Number(question.maxMarks || 0) : -Number(question.negativeMarks || 0);
      }

      summary.objectiveResults.push({
        id: question.id,
        subject: question.subject,
        correct: isCorrect,
        awarded,
        answer: normalizedValue,
        correctAnswer: question.correctAnswer,
      });
    }

    if (question.type === "written") {
      summary.writtenResults.push({
        id: question.id,
        subject: question.subject,
        answered: normalizedValue.length > 0,
        rubric: question.rubric || [],
        answer: normalizedValue,
      });
    }
  }

  summary.overall = Math.max(summary.objectiveMarks + summary.writtenMarks, 0);
  return summary;
};

export const getMockPapers = async (): Promise<MockExamPaper[]> => {
  const { data, error } = await supabaseAdmin
    .from("mock_papers")
    .select("*, mock_questions(*)")
    .not("source_reference", "is", null)
    .order("exam_year", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row) => row.source !== "system-default" && Array.isArray(row.mock_questions) && row.mock_questions.length > 0)
    .map((row) => normalizeDbPaper(row));
};

export const getMockPaperById = async (paperId: string): Promise<MockExamPaper | null> => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paperId);
  if (!isUuid) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("mock_papers")
    .select("*")
    .eq("id", paperId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { data: questionRows, error: questionsError } = await supabaseAdmin
    .from("mock_questions")
    .select("*")
    .eq("paper_id", paperId)
    .order("question_number", { ascending: true });

  if (questionsError) {
    throw questionsError;
  }

  const paper = normalizeDbPaper({ ...data, mock_questions: questionRows ?? [] });
  if (typeof data.source_reference === "string" && data.source_reference.startsWith("custom-upload:")) {
    const storagePath = data.source_reference.slice("custom-upload:".length);
    const { data: signedUrl, error: signedUrlError } = await supabaseAdmin.storage
      .from("mock-question-papers")
      .createSignedUrl(storagePath, 60 * 60);

    if (signedUrlError) {
      throw signedUrlError;
    }
    paper.documentUrl = signedUrl.signedUrl;
  }

  return paper;
};

export const createMockSession = async (
  roomId: string,
  paperId: string,
  createdBy: string,
  durationSeconds: number
): Promise<MockSession> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paperId)) {
    throw new Error("paperId must be a mock_papers UUID.");
  }

  const paper = await getMockPaperById(paperId);
  if (!paper || !paper.sourceReference || (paper.questions.length === 0 && !paper.documentUrl)) {
    throw new Error("Selected mock paper not found.");
  }
  if (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 24 * 60 * 60) {
    throw new Error("Exam duration must be between 1 minute and 24 hours.");
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", createdBy)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }
  if (!membership) {
    throw new Error("You must be a member of this Study Room to create a mock exam.");
  }

  const { data, error } = await supabaseAdmin
    .from("mock_sessions")
    .insert({
      room_id: roomId,
      paper_id: paper.id,
      created_by: createdBy,
      started_at: null,
      ends_at: null,
      duration_seconds: durationSeconds,
      status: "draft",
    })
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create the mock session.");
  }

  return {
    id: data.id,
    roomId: data.room_id,
    paperId: data.paper_id,
    createdBy: data.created_by,
    startedAt: data.started_at,
    endsAt: data.ends_at,
    durationSeconds: data.duration_seconds === null ? null : Number(data.duration_seconds),
    status: data.status,
  };
};

const ensurePrivateQuestionPaperBucket = async () => {
  const bucketName = "mock-question-papers";
  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(bucketName);
  if (bucketError && bucketError.statusCode !== "404") {
    throw bucketError;
  }
  if (!bucket) {
    const { error } = await supabaseAdmin.storage.createBucket(bucketName, { public: false });
    if (error) throw error;
  } else if (bucket.public) {
    const { error } = await supabaseAdmin.storage.updateBucket(bucketName, { public: false });
    if (error) throw error;
  }
};

export const createCustomPaperMockSession = async ({
  roomId,
  createdBy,
  durationSeconds,
  fileName,
  fileType,
  fileSize,
  fileBuffer,
}: {
  roomId: string;
  createdBy: string;
  durationSeconds: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileBuffer: Buffer;
}): Promise<MockSession> => {
  validatePdfSubmission({ name: fileName, type: fileType, size: fileSize });
  if (fileBuffer.length < 5 || fileBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("The uploaded question paper is not a valid PDF.");
  }
  if (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 24 * 60 * 60) {
    throw new Error("Exam duration must be between 1 minute and 24 hours.");
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", createdBy)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) {
    throw new Error("You must be a member of this Study Room to create a mock exam.");
  }

  await ensurePrivateQuestionPaperBucket();
  const paperKey = crypto.randomUUID();
  const storagePath = `${roomId}/${paperKey}.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("mock-question-papers")
    .upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const paperName = fileName.replace(/[\\/]/g, "").trim().slice(0, 200) || "Custom question paper.pdf";
  const { data: paper, error: paperError } = await supabaseAdmin
    .from("mock_papers")
    .insert({
      exam_name: "Custom",
      paper_name: paperName,
      subject: "All subjects",
      duration_seconds: durationSeconds,
      total_marks: 0,
      evaluation_type: "subjective",
      source: "custom-upload",
      source_reference: `custom-upload:${storagePath}`,
    })
    .select("id")
    .single();

  if (paperError || !paper) {
    await supabaseAdmin.storage.from("mock-question-papers").remove([storagePath]);
    throw paperError ?? new Error("Unable to register the uploaded question paper.");
  }

  try {
    return await createMockSession(roomId, paper.id, createdBy, durationSeconds);
  } catch (error) {
    const { error: deletePaperError } = await supabaseAdmin
      .from("mock_papers")
      .delete()
      .eq("id", paper.id);
    const { error: deleteFileError } = await supabaseAdmin.storage
      .from("mock-question-papers")
      .remove([storagePath]);
    if (deletePaperError || deleteFileError) {
      throw new Error(
        `Unable to create the mock session; cleanup failed: ${deletePaperError?.message ?? deleteFileError?.message}`,
      );
    }
    throw error;
  }
};

export const getMockSession = async (sessionId: string): Promise<MockSession | null> => {
  const { data, error } = await supabaseAdmin
    .from("mock_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    id: data.id,
    roomId: data.room_id,
    paperId: data.paper_id,
    createdBy: data.created_by ?? null,
    startedAt: data.started_at,
    endsAt: data.ends_at,
    durationSeconds: data.duration_seconds === null ? null : Number(data.duration_seconds),
    status: data.status,
  };
};

export const listJoinableMockSessions = async (
  roomId: string,
  participantId: string
): Promise<ActiveMockRoom[]> => {
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", participantId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }
  if (!membership) {
    throw new Error("You must be a member of this Study Room to view mock exams.");
  }

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("mock_sessions")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (sessionsError) {
    throw sessionsError;
  }
  if (!sessions?.length) {
    return [];
  }

  const creatorIds = [...new Set(
    sessions.map((session) => session.created_by).filter((id): id is string => Boolean(id))
  )];
  const paperIds = [...new Set(sessions.map((session) => session.paper_id))];
  const [{ data: papers, error: papersError }, creatorUsers] = await Promise.all([
    supabaseAdmin.from("mock_papers").select("id, exam_name, paper_name").in("id", paperIds),
    Promise.all(creatorIds.map(async (creatorId) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(creatorId);
      if (error) {
        console.warn("Unable to resolve mock room creator name:", error.message);
        return [creatorId, null] as const;
      }

      const metadata = data.user?.user_metadata ?? {};
      return [creatorId, metadata.full_name ?? metadata.name ?? null] as const;
    })),
  ]);

  if (papersError) {
    throw papersError;
  }

  const creatorNames = new Map(creatorUsers);
  const paperNames = new Map((papers ?? []).map((paper) => [
    paper.id,
    {
      name: paper.paper_name || "Mock Paper",
      title: [paper.exam_name, paper.paper_name].filter(Boolean).join(" — ") || "Mock Paper",
    },
  ]));

  return sessions.map((row) => ({
    session: {
      id: row.id,
      roomId: row.room_id,
      paperId: row.paper_id,
      createdBy: row.created_by ?? null,
      startedAt: row.started_at,
      endsAt: row.ends_at,
      durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
      status: row.status,
    },
    creator: {
      id: row.created_by ?? null,
      name: (row.created_by && creatorNames.get(row.created_by)) || "StudyPact member",
    },
    paper: {
      id: row.paper_id,
      ...(paperNames.get(row.paper_id) || { name: "Mock Paper", title: "Mock Paper" }),
    },
    joinable: row.status === "draft",
  }));
};

export const joinMockSession = async (
  roomId: string,
  sessionId: string,
  participantId: string
) => {
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", participantId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }
  if (!membership) {
    throw new Error("You must be a member of this Study Room to join a mock exam.");
  }

  const session = await getMockSession(sessionId);
  if (!session || session.roomId !== roomId) {
    return null;
  }
  if (session.status !== "draft") {
    throw new Error("This mock exam is no longer joinable.");
  }

  const attempt = await getOrCreateAttempt(sessionId, participantId);
  const latestSession = await getMockSession(sessionId);
  if (!latestSession) {
    return null;
  }
  const paper = await getMockPaperById(latestSession.paperId);
  if (!paper) {
    throw new Error("The selected mock paper for this session could not be found.");
  }

  return { session: latestSession, attempt, paper };
};

export const startMockSession = async (
  sessionId: string,
  participantId: string,
  durationSeconds: number
): Promise<MockSession> => {
  if (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 24 * 60 * 60) {
    throw new Error("Exam duration must be between 1 minute and 24 hours.");
  }

  const session = await getMockSession(sessionId);
  if (!session) {
    throw new Error("Mock session not found.");
  }

  if (session.createdBy !== participantId) {
    throw new Error("Only the session creator can start this mock exam.");
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("room_members")
    .select("room_id")
    .eq("room_id", session.roomId)
    .eq("user_id", participantId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) {
    throw new Error("You must remain a member of this Study Room to start the mock exam.");
  }

  if (session.status === "live") {
    return session;
  }
  if (session.status !== "draft") {
    throw new Error("This mock exam can no longer be started.");
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);
  const { data, error } = await supabaseAdmin
    .from("mock_sessions")
    .update({
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
      duration_seconds: durationSeconds,
      status: "live",
    })
    .eq("id", sessionId)
    .eq("status", "draft")
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    const latestSession = await getMockSession(sessionId);
    if (latestSession?.status === "live") {
      return latestSession;
    }
    throw new Error("The mock exam could not be started because its state changed.");
  }

  const { error: attemptError } = await supabaseAdmin
    .from("participant_attempts")
    .update({ status: "in_progress", started_at: startedAt.toISOString() })
    .eq("session_id", sessionId)
    .eq("status", "draft");

  if (attemptError) {
    throw attemptError;
  }

  return {
    id: data.id,
    roomId: data.room_id,
    paperId: data.paper_id,
    createdBy: data.created_by ?? null,
    startedAt: data.started_at,
    endsAt: data.ends_at,
    durationSeconds: Number(data.duration_seconds),
    status: data.status,
  };
};

export const getSessionWithPaper = async (sessionId: string, participantId: string) => {
  const session = await getMockSession(sessionId);
  if (!session) {
    return null;
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("room_members")
    .select("room_id")
    .eq("room_id", session.roomId)
    .eq("user_id", participantId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }
  if (!membership) {
    return null;
  }

  const paper = await getMockPaperById(session.paperId);
  if (!paper) {
    throw new Error("The selected mock paper for this session could not be found.");
  }

  const attempt = await getOrCreateAttempt(session.id, participantId);
  const existingSubmission = attempt?.id ? await getSubmissionByAttempt(attempt.id, participantId) : null;

  return {
    session,
    paper,
    attempt,
    submission: existingSubmission,
    ...getMockSessionTiming(session),
  };
};

export const getOrCreateAttempt = async (sessionId: string, participantId: string) => {
  const session = await getMockSession(sessionId);
  if (!session) {
    throw new Error("Mock session not found.");
  }

  const { data: existing, error: findError } = await supabaseAdmin
    .from("participant_attempts")
    .select("*")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    if (session.status === "live" && existing.status === "draft") {
      const { data, error } = await supabaseAdmin
        .from("participant_attempts")
        .update({ status: "in_progress", started_at: session.startedAt })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) {
        throw error;
      }
      return data;
    }
    return existing;
  }

  if (session.status !== "draft") {
    throw new Error("This mock exam is no longer joinable.");
  }

  const { data, error } = await supabaseAdmin
    .from("participant_attempts")
    .insert({
      session_id: sessionId,
      participant_id: participantId,
      status: "draft",
      started_at: session.startedAt ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create the participant attempt.");
  }

  const latestSession = await getMockSession(sessionId);
  if (!latestSession) {
    throw new Error("Mock session not found.");
  }
  if (latestSession.status === "live") {
    const { data: startedAttempt, error: startError } = await supabaseAdmin
      .from("participant_attempts")
      .update({ status: "in_progress", started_at: latestSession.startedAt })
      .eq("id", data.id)
      .eq("status", "draft")
      .select()
      .maybeSingle();
    if (startError) {
      throw startError;
    }
    if (startedAttempt) {
      return startedAttempt;
    }

    const { data: existingAttempt, error: attemptError } = await supabaseAdmin
      .from("participant_attempts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (attemptError) {
      throw attemptError;
    }
    return existingAttempt;
  }
  if (latestSession.status !== "draft") {
    const { error: cleanupError } = await supabaseAdmin
      .from("participant_attempts")
      .delete()
      .eq("id", data.id);
    if (cleanupError) {
      throw cleanupError;
    }
    throw new Error("This mock exam is no longer joinable.");
  }

  return data;
};

export const getAttemptAnswers = async (attemptId: string): Promise<Record<string, unknown>> => {
  const { data, error } = await supabaseAdmin
    .from("mock_answers")
    .select("question_id, answer")
    .eq("attempt_id", attemptId);

  if (error || !data) {
    return {};
  }

  return data.reduce((accumulator: Record<string, unknown>, row: any) => {
    accumulator[row.question_id] = row.answer;
    return accumulator;
  }, {});
};

export const saveAttemptAnswers = async (
  attemptId: string,
  participantId: string,
  answers: Record<string, unknown>
): Promise<void> => {
  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("id, participant_id")
    .eq("id", attemptId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (attemptError || !attempt) {
    throw new Error("Attempt not found for this participant.");
  }

  const records = Object.entries(answers).map(([questionId, answer]) => ({
    attempt_id: attemptId,
    question_id: questionId,
    answer,
    answered_at: new Date().toISOString(),
  }));

  if (records.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("mock_answers")
    .upsert(records, { onConflict: "attempt_id,question_id" });

  if (error) {
    throw error;
  }

  await supabaseAdmin
    .from("participant_attempts")
    .update({ status: "in_progress" })
    .eq("id", attemptId);
};

export const submitAttempt = async (
  attemptId: string,
  participantId: string,
  answers: Record<string, unknown> = {}
): Promise<{ status: string; submittedAt: string; finalScore: number }> => {
  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (attemptError || !attempt) {
    throw new Error("Attempt not found for this participant.");
  }

  await saveAttemptAnswers(attemptId, participantId, answers);

  const session = await getMockSession(attempt.session_id);
  const paper = session ? await getMockPaperById(session.paperId) : null;
  if (!paper) {
    throw new Error("The selected mock paper could not be loaded.");
  }

  const summary = evaluateMockAttempt(paper, Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")])
  ));

  const finalScore = Math.max(summary.overall, 0);
  const submittedAt = new Date().toISOString();

  await supabaseAdmin
    .from("participant_attempts")
    .update({ status: "submitted", submitted_at: submittedAt })
    .eq("id", attemptId);

  await supabaseAdmin
    .from("mock_results")
    .upsert({
      attempt_id: attemptId,
      final_score: finalScore,
      evaluation_status: "objective_complete",
      finalized_at: submittedAt,
    }, { onConflict: "attempt_id" });

  return {
    status: "submitted",
    submittedAt,
    finalScore,
  };
};

export const validatePdfSubmission = (file: { name?: string; type?: string; size?: number } | null | undefined) => {
  if (!file) {
    throw new Error("A PDF file is required.");
  }

  if (!file.name || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are allowed for answer scripts.");
  }

  if (file.type && file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed for answer scripts.");
  }

  const size = Number(file.size ?? 0);
  if (size <= 0) {
    throw new Error("The selected file is empty.");
  }

  if (size > MAX_PDF_SIZE_BYTES) {
    throw new Error(`The selected PDF is too large. Maximum size is ${Math.round(MAX_PDF_SIZE_BYTES / (1024 * 1024))} MB.`);
  }
};

const normalizeSubmissionRow = (row: any): MockSubmissionRecord => ({
  id: row.id,
  attemptId: row.attempt_id,
  participantId: row.participant_id,
  sessionId: row.session_id ?? row.attempt?.session_id ?? "",
  filePath: row.file_path ?? "",
  fileName: row.file_name ?? null,
  fileType: row.file_type ?? null,
  fileSize: row.file_size ?? null,
  status: row.status ?? "DRAFT",
  submittedAt: row.submitted_at ?? null,
  createdAt: row.created_at,
  downloadUrl: row.download_url ?? null,
});

export const getSubmissionById = async (submissionId: string) => {
  const { data, error } = await supabaseAdmin
    .from("mock_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeSubmissionRow(data);
};

export const getSubmissionByAttempt = async (attemptId: string, participantId: string) => {
  const { data, error } = await supabaseAdmin
    .from("mock_submissions")
    .select("*")
    .eq("attempt_id", attemptId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeSubmissionRow(data);
};

export const getSubmissionForAttempt = async (attemptId: string, participantId: string) => {
  const { data, error } = await supabaseAdmin
    .from("mock_submissions")
    .select("*")
    .eq("attempt_id", attemptId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeSubmissionRow(data);
};

export const createOrUpdateSubmission = async ({
  attemptId,
  participantId,
  sessionId,
  filePath,
  fileType,
}: {
  attemptId: string;
  participantId: string;
  sessionId: string;
  filePath: string;
  fileType?: string | null;
}): Promise<MockSubmissionRecord> => {
  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("id, session_id, participant_id, status")
    .eq("id", attemptId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (attemptError || !attempt) {
    throw new Error("Attempt not found for this participant.");
  }

  if (attempt.session_id !== sessionId) {
    throw new Error("This submission does not belong to the current session.");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("mock_submissions")
    .select("*")
    .eq("attempt_id", attemptId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const submittedAt = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("mock_submissions")
      .update({
        file_path: filePath,
        file_type: fileType ?? existing.file_type ?? "application/pdf",
        status: "SUBMITTED",
        submitted_at: submittedAt,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error || !data) {
      throw error ?? new Error("Unable to update the submission record.");
    }

    return normalizeSubmissionRow(data);
  }

  const { data, error } = await supabaseAdmin
    .from("mock_submissions")
    .insert({
      attempt_id: attemptId,
      participant_id: participantId,
      file_path: filePath,
      file_type: fileType ?? "application/pdf",
      status: "SUBMITTED",
      submitted_at: submittedAt,
    })
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create the submission record.");
  }

  return normalizeSubmissionRow(data);
};

export const uploadAndStoreMockSubmission = async ({
  attemptId,
  participantId,
  sessionId,
  fileBuffer,
  fileName,
  fileType,
  fileSize,
}: {
  attemptId: string;
  participantId: string;
  sessionId: string;
  fileBuffer: Buffer;
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<MockSubmissionRecord> => {
  validatePdfSubmission({ name: fileName, type: fileType, size: fileBuffer.length });
  if (Number(fileSize) !== fileBuffer.length) {
    throw new Error("The uploaded file size could not be verified.");
  }
  if (!fileBuffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    throw new Error("The selected file is not a valid PDF.");
  }

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("id, session_id, participant_id, status, submitted_at")
    .eq("id", attemptId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (attemptError || !attempt) {
    throw new Error("Attempt not found for this participant.");
  }

  if (attempt.session_id !== sessionId) {
    throw new Error("This attempt does not belong to the current session.");
  }
  if (attempt.status === "submitted" || attempt.submitted_at) {
    throw new Error("An answer script has already been submitted for this attempt.");
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("mock_sessions")
    .select("id, ends_at, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    throw new Error("The mock session could not be verified.");
  }

  const endsAt = session.ends_at ? new Date(session.ends_at).getTime() : NaN;
  if (session.status === "draft" || !Number.isFinite(endsAt)) {
    throw new Error("The submission window is not open yet.");
  }
  const submissionDeadline = endsAt + MOCK_SUBMISSION_WINDOW_SECONDS * 1000;
  const now = Date.now();
  if (now < endsAt) {
    throw new Error("The submission window opens when the exam ends.");
  }
  if (now >= submissionDeadline) {
    throw new Error("The submission window is closed.");
  }

  const { data: existingSubmission, error: existingSubmissionError } = await supabaseAdmin
    .from("mock_submissions")
    .select("id, status")
    .eq("attempt_id", attemptId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingSubmissionError) {
    throw existingSubmissionError;
  }
  if (existingSubmission?.status === "SUBMITTED") {
    throw new Error("An answer script has already been submitted for this attempt.");
  }

  const storagePath = `${MOCK_SUBMISSIONS_BUCKET}/${sessionId}/${participantId}/${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(MOCK_SUBMISSIONS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      duplex: "half",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "The PDF could not be uploaded.");
  }

  if (Date.now() >= submissionDeadline) {
    const { error: cleanupError } = await supabaseAdmin.storage
      .from(MOCK_SUBMISSIONS_BUCKET)
      .remove([storagePath]);
    if (cleanupError) {
      console.error("Unable to remove an answer PDF uploaded after its submission deadline:", cleanupError);
    }
    throw new Error("The submission window is closed.");
  }

  const record = await createOrUpdateSubmission({
    attemptId,
    participantId,
    sessionId,
    filePath: storagePath,
    fileType,
  });

  const { error: attemptUpdateError } = await supabaseAdmin
    .from("participant_attempts")
    .update({ status: "submitted", submitted_at: record.submittedAt })
    .eq("id", attemptId)
    .eq("participant_id", participantId);
  if (attemptUpdateError) {
    throw attemptUpdateError;
  }

  return record;
};
