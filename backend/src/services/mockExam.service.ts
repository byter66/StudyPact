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

const parseMark = (value: unknown, label: string, { allowZero = true } = {}) => {
    const mark = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(mark) || mark < 0 || (!allowZero && mark === 0)) {
      throw new Error(`${label} must be a finite ${allowZero ? "non-negative" : "positive"} number.`);
    }
    return mark;
};

const getRubricMaximum = (markingScheme: unknown) => {
    if (!Array.isArray(markingScheme) || markingScheme.length === 0) return null;
    const marks = markingScheme.map((item: any, index) => (
      parseMark(item?.marks, `Marking criterion ${index + 1}`)
    ));
    return marks.reduce((sum, mark) => sum + mark, 0);
};

const getEvaluationQuestionMaximum = (question: MockExamQuestion) => {
    return parseMark(question.maxMarks, `Question ${question.id} maximum marks`, { allowZero: false });
};

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
        marks: parseMark(item?.marks, "Rubric marks"),
      }))
    : undefined;
  const rubricMaximum = getRubricMaximum(row.marking_scheme);
  const rawMaximum = row.max_marks === null || row.max_marks === undefined
    ? null
    : Number(row.max_marks);
  const configuredMaximum = rawMaximum === null || rawMaximum === 0
    ? rubricMaximum ?? 0
    : parseMark(rawMaximum, "Question maximum marks", { allowZero: false });
  const negativeMarks = row.negative_marks === null || row.negative_marks === undefined
    ? 0
    : parseMark(row.negative_marks, "Question negative marks");

  return {
    id: row.id,
    type: toQuestionType(row.question_type),
    subject: row.subject ?? row.metadata?.subject ?? "General",
    question: row.question_text ?? row.question ?? "",
    imageUrl: row.metadata?.image_url ?? undefined,
    options: optionList?.map((option: any) => String(option)),
    correctAnswer: row.correct_answer === null || row.correct_answer === undefined
      ? undefined
      : String(row.correct_answer),
    maxMarks: configuredMaximum,
    negativeMarks,
    rubric,
  };
};

const normalizeDbPaper = (row: any): MockExamPaper => {
  const questionRows = Array.isArray(row.mock_questions) ? row.mock_questions : [];
  const questions = questionRows
    .sort((left: any, right: any) => Number(left.question_number) - Number(right.question_number))
    .map((question: any) => normalizeDbQuestion(question));
  const paperName = row.paper_name || row.title || row.exam_name || "Mock Paper";
  const configuredTotal = row.total_marks === null || row.total_marks === undefined
    ? null
    : Number(row.total_marks);
  const totalMarks = configuredTotal && Number.isFinite(configuredTotal) && configuredTotal > 0
    ? configuredTotal
    : questions.reduce((sum: number, question: MockExamQuestion) => sum + question.maxMarks, 0);
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
    questions,
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

      const positiveMarks = parseMark(question.maxMarks, `Question ${question.id} maximum marks`, { allowZero: false });
      const negativeMarks = parseMark(question.negativeMarks ?? 0, `Question ${question.id} negative marks`);
      const awarded = isCorrect ? positiveMarks : normalizedValue ? -negativeMarks : 0;

      if (normalizedValue) {
        summary.objectiveMarks += awarded;
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

  summary.overall = summary.objectiveMarks + summary.writtenMarks;
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

const getPeerEvaluationContext = async (sessionId: string, participantId: string) => {
  const session = await getMockSession(sessionId);
  if (!session) {
    throw new Error("Mock session not found.");
  }

  const examEnded = Boolean(session.endsAt && Date.now() >= Date.parse(session.endsAt));
  if (!examEnded) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("room_members")
      .select("room_id")
      .eq("room_id", session.roomId)
      .eq("user_id", participantId)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) throw new Error("You must be a member of this Study Room.");
  }

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("id, session_id, participant_id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt) throw new Error("You must join the mock session before peer evaluation.");

  const { submissionDeadlineAt } = getMockSessionTiming(session);
  if (!submissionDeadlineAt) {
    throw new Error("The mock session has no exam deadline.");
  }

  return { session, attempt, submissionDeadlineAt };
};

const ensurePeerAssignments = async (sessionId: string) => {
  const session = await getMockSession(sessionId);
  const { submissionDeadlineAt } = session ? getMockSessionTiming(session) : { submissionDeadlineAt: null };
  if (!session || !submissionDeadlineAt || Date.now() < Date.parse(submissionDeadlineAt)) {
    return false;
  }

  const { data: sessionAttempts, error: attemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("id, participant_id")
    .eq("session_id", sessionId);
  if (attemptError) throw attemptError;
  if (!sessionAttempts?.length) {
    return true;
  }

  const { data: submissions, error: submissionsError } = await supabaseAdmin
    .from("mock_submissions")
    .select("id, attempt_id, participant_id, submitted_at")
    .in("status", ["SUBMITTED", "UNDER_EVALUATION", "EVALUATED"])
    .in("attempt_id", sessionAttempts.map((attempt) => attempt.id))
    .not("file_path", "is", null)
    .order("submitted_at", { ascending: true });

  if (submissionsError) throw submissionsError;
  const participantByAttemptId = new Map(
    sessionAttempts.map((attempt) => [attempt.id, attempt.participant_id])
  );
  const eligibleSubmissions = [...(submissions ?? [])]
    .filter((submission) => participantByAttemptId.get(submission.attempt_id) === submission.participant_id)
    .sort((left, right) => left.participant_id.localeCompare(right.participant_id));
  if (!eligibleSubmissions.length) {
    return true;
  }

  const submittedParticipantIds = [...new Set(
    eligibleSubmissions.map((submission) => submission.participant_id)
  )].sort();
  const { data: roomMembers, error: roomMembersError } = await supabaseAdmin
    .from("room_members")
    .select("user_id")
    .eq("room_id", session.roomId)
    .in("user_id", submittedParticipantIds);
  if (roomMembersError) throw roomMembersError;

  const currentMemberIds = new Set((roomMembers ?? []).map((member) => member.user_id));
  const participantIds = submittedParticipantIds.filter((participantId) => currentMemberIds.has(participantId));
  const evaluatorsPerSubmission = Math.min(3, Math.max(0, participantIds.length - 1));
  const assignments = eligibleSubmissions.flatMap((submission, submissionIndex) => {
    const eligibleEvaluators = participantIds.filter((id) => id !== submission.participant_id);
    if (!eligibleEvaluators.length) return [];
    const rotation = submissionIndex % eligibleEvaluators.length;
    const rotatedEvaluators = [
      ...eligibleEvaluators.slice(rotation),
      ...eligibleEvaluators.slice(0, rotation),
    ];
    return rotatedEvaluators.slice(0, evaluatorsPerSubmission).map((evaluatorId) => ({
      submission_id: submission.id,
      evaluator_id: evaluatorId,
      status: "assigned",
    }));
  });
  if (!assignments.length) {
    return true;
  }
  const { error: assignmentError } = await supabaseAdmin
    .from("evaluator_assignments")
    .upsert(assignments, {
      onConflict: "submission_id,evaluator_id",
      ignoreDuplicates: true,
    });
  if (assignmentError) throw assignmentError;

  const assignedSubmissionIds = [...new Set(assignments.map((assignment) => assignment.submission_id))];
  const { error: submissionStatusError } = await supabaseAdmin
    .from("mock_submissions")
    .update({ status: "UNDER_EVALUATION" })
    .in("id", assignedSubmissionIds)
    .eq("status", "SUBMITTED");
  if (submissionStatusError) throw submissionStatusError;

  return true;
};

const signedSubmissionUrl = async (filePath: string) => {
  const { data, error } = await supabaseAdmin.storage
    .from(MOCK_SUBMISSIONS_BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
};

const getParticipantNames = async (participantIds: string[]) => {
  const uniqueIds = [...new Set(participantIds)];
  const names = await Promise.all(uniqueIds.map(async (id) => {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    if (error) {
      console.warn("Unable to resolve peer evaluation participant name:", error.message);
      return [id, "StudyPact participant"] as const;
    }
    const metadata = data.user?.user_metadata ?? {};
    return [id, metadata.full_name ?? metadata.name ?? "StudyPact participant"] as const;
  }));
  return new Map(names);
};

export const getPeerEvaluationOverview = async (sessionId: string, participantId: string) => {
  const { session, attempt, submissionDeadlineAt } = await getPeerEvaluationContext(sessionId, participantId);
  const available = await ensurePeerAssignments(sessionId);
  const { data: assignments, error: assignmentError } = await supabaseAdmin
    .from("evaluator_assignments")
    .select("id, submission_id, evaluator_id, assigned_at, status")
    .eq("evaluator_id", participantId)
    .order("assigned_at", { ascending: true });
  if (assignmentError) throw assignmentError;

  const attemptIdsResult = await supabaseAdmin
    .from("participant_attempts")
    .select("id, participant_id")
    .eq("session_id", sessionId);
  if (attemptIdsResult.error) throw attemptIdsResult.error;
  const sessionAttemptIds = (attemptIdsResult.data ?? []).map((row) => row.id);

  const sessionSubmissionsResult = sessionAttemptIds.length
    ? await supabaseAdmin
        .from("mock_submissions")
        .select("id, attempt_id, participant_id, file_path, status, submitted_at")
        .in("attempt_id", sessionAttemptIds)
        .in("status", ["SUBMITTED", "UNDER_EVALUATION", "EVALUATED"])
    : { data: [], error: null };
  if (sessionSubmissionsResult.error) throw sessionSubmissionsResult.error;
  const submissions = sessionSubmissionsResult.data ?? [];
  const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
  const participantByAttemptId = new Map(
    (attemptIdsResult.data ?? []).map((row) => [row.id, row.participant_id])
  );
  const ownSubmission = submissions.find((submission) => submission.attempt_id === attempt.id) ?? null;
  const assignedRows = (assignments ?? []).filter((assignment) => {
    const submission = submissionById.get(assignment.submission_id);
    return Boolean(
      submission
      && submission.file_path
      && participantByAttemptId.get(submission.attempt_id) === submission.participant_id
      && submission.participant_id !== participantId
    );
  });
  const assignmentIds = assignedRows.map((assignment) => assignment.id);
  const ownEvaluationScoresResult = ownSubmission
    ? await supabaseAdmin
        .from("evaluator_assignments")
        .select("id, evaluator_id, status")
        .eq("submission_id", ownSubmission.id)
    : { data: [], error: null };
  if (ownEvaluationScoresResult.error) throw ownEvaluationScoresResult.error;

  const scoreIds = [...new Set([
    ...assignmentIds,
    ...(ownEvaluationScoresResult.data ?? []).map((assignment) => assignment.id),
  ])];
  const scoresResult = scoreIds.length
    ? await supabaseAdmin
        .from("evaluator_scores")
        .select("id, assignment_id, score, rubric_scores, comments, submitted_at")
        .in("assignment_id", scoreIds)
    : { data: [], error: null };
  if (scoresResult.error) throw scoresResult.error;
  const scoreByAssignment = new Map((scoresResult.data ?? []).map((score) => [score.assignment_id, score]));
  const names = await getParticipantNames([
    ...assignedRows.map((assignment) => submissionById.get(assignment.submission_id)!.participant_id),
    ...(ownEvaluationScoresResult.data ?? []).map((assignment) => assignment.evaluator_id),
  ]);
  const allEvaluationsComplete = assignedRows.length > 0 && assignedRows.every((assignment) =>
    assignment.status === "completed" && scoreByAssignment.has(assignment.id)
  );

  let ownResult = null;
  const receivedEvaluationRows = (ownEvaluationScoresResult.data ?? [])
    .map((assignment) => ({ assignment, score: scoreByAssignment.get(assignment.id) }))
    .filter((item) => item.assignment.status === "completed" && item.score);
  if (allEvaluationsComplete && ownSubmission) {
    const expectedEvaluationCount = (ownEvaluationScoresResult.data ?? []).length;
    const allEvaluatorsComplete = expectedEvaluationCount > 0
      && receivedEvaluationRows.length === ownEvaluationScoresResult.data!.length;
    const finalScore = receivedEvaluationRows.length
      ? Number((
          receivedEvaluationRows.reduce((sum, item) => sum + Number(item.score!.score), 0)
          / receivedEvaluationRows.length
        ).toFixed(2))
      : null;

    if (finalScore !== null) {
      const { error: resultError } = await supabaseAdmin
        .from("mock_results")
        .upsert({
          attempt_id: attempt.id,
          final_score: finalScore,
          evaluation_status: allEvaluatorsComplete ? "finalized" : "pending",
          finalized_at: allEvaluatorsComplete ? new Date().toISOString() : null,
        }, { onConflict: "attempt_id" });
      if (resultError) throw resultError;
    }

    if (allEvaluatorsComplete) {
      const { error: submissionUpdateError } = await supabaseAdmin
        .from("mock_submissions")
        .update({ status: "EVALUATED" })
        .eq("id", ownSubmission.id)
        .eq("status", "UNDER_EVALUATION");
      if (submissionUpdateError) throw submissionUpdateError;
    }

    ownResult = {
      downloadUrl: await signedSubmissionUrl(ownSubmission.file_path),
      finalScore: allEvaluatorsComplete ? finalScore : null,
      receivedEvaluationCount: receivedEvaluationRows.length,
      expectedEvaluationCount,
      finalMeanReady: allEvaluatorsComplete,
      evaluations: receivedEvaluationRows.map(({ assignment, score }) => ({
        assignmentId: assignment.id,
        evaluator: names.get(assignment.evaluator_id) || "StudyPact participant",
        score: Number(score!.score),
        rubricScores: score!.rubric_scores,
        comments: score!.comments,
        submittedAt: score!.submitted_at,
      })),
    };
  }

  return {
    available,
    serverNow: new Date().toISOString(),
    submissionDeadlineAt,
    assignments: await Promise.all(assignedRows.map(async (assignment) => {
      const submission = submissionById.get(assignment.submission_id)!;
      return {
        id: assignment.id,
        participantName: names.get(submission.participant_id) || "StudyPact participant",
        status: assignment.status,
        completed: assignment.status === "completed" && scoreByAssignment.has(assignment.id),
        score: scoreByAssignment.has(assignment.id) ? Number(scoreByAssignment.get(assignment.id)!.score) : null,
      };
    })),
    allEvaluationsComplete,
    ownResult,
  };
};

const getEvaluationDiscussionContext = async (
  sessionId: string,
  assignmentId: string,
  userId: string,
) => {
  const session = await getMockSession(sessionId);
  if (!session) throw new Error("Mock session not found.");

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("evaluator_assignments")
    .select("id, evaluator_id, submission_id, mock_submissions!inner(participant_id, attempt_id)")
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error("Peer evaluation assignment not found.");

  const submission = Array.isArray(assignment.mock_submissions)
    ? assignment.mock_submissions[0]
    : assignment.mock_submissions;
  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("session_id")
    .eq("id", submission.attempt_id)
    .maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt || attempt.session_id !== sessionId) {
    throw new Error("Peer evaluation assignment does not belong to this session.");
  }
  if (assignment.evaluator_id !== userId && submission.participant_id !== userId) {
    throw new Error("You are not authorized to access this evaluation discussion.");
  }

  return { assignment };
};

const getDiscussionParticipantName = async (userId: string) => {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) {
    console.warn("Unable to resolve evaluation discussion participant name:", error.message);
    return "StudyPact participant";
  }
  const metadata = data.user?.user_metadata ?? {};
  return metadata.full_name ?? metadata.name ?? "StudyPact participant";
};

export const getEvaluationDiscussionMessages = async (
  sessionId: string,
  assignmentId: string,
  userId: string,
) => {
  await getEvaluationDiscussionContext(sessionId, assignmentId, userId);
  const { data, error } = await supabaseAdmin
    .from("evaluation_discussion_messages")
    .select("id, assignment_id, sender_id, content, created_at")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const names = new Map<string, string>();
  await Promise.all((data ?? []).map(async (message) => {
    names.set(message.sender_id, await getDiscussionParticipantName(message.sender_id));
  }));
  return (data ?? []).map((message) => ({
    id: message.id,
    assignmentId: message.assignment_id,
    senderId: message.sender_id,
    senderName: names.get(message.sender_id) || "StudyPact participant",
    content: message.content,
    createdAt: message.created_at,
  }));
};

export const createEvaluationDiscussionMessage = async (
  sessionId: string,
  assignmentId: string,
  userId: string,
  content: string,
) => {
  await getEvaluationDiscussionContext(sessionId, assignmentId, userId);
  const normalizedContent = content.trim();
  if (normalizedContent.length < 1 || normalizedContent.length > 5000) {
    throw new Error("Discussion messages must be between 1 and 5000 characters.");
  }

  const { data, error } = await supabaseAdmin
    .from("evaluation_discussion_messages")
    .insert({
      assignment_id: assignmentId,
      sender_id: userId,
      content: normalizedContent,
    })
    .select("id, assignment_id, sender_id, content, created_at")
    .single();
  if (error || !data) throw error ?? new Error("Unable to create the discussion message.");

  return {
    id: data.id,
    assignmentId: data.assignment_id,
    senderId: data.sender_id,
    senderName: await getDiscussionParticipantName(data.sender_id),
    content: data.content,
    createdAt: data.created_at,
  };
};

export const getPeerEvaluationAssignment = async (
  sessionId: string,
  assignmentId: string,
  evaluatorId: string
) => {
  const { session } = await getPeerEvaluationContext(sessionId, evaluatorId);
  const available = await ensurePeerAssignments(sessionId);
  if (!available) throw new Error("Peer evaluation opens after the submission window closes.");

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("evaluator_assignments")
    .select("id, submission_id, evaluator_id, status")
    .eq("id", assignmentId)
    .eq("evaluator_id", evaluatorId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error("Assigned evaluation not found.");
  if (assignment.status === "completed") throw new Error("This evaluation has already been completed.");

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from("mock_submissions")
    .select("id, attempt_id, participant_id, file_path")
    .eq("id", assignment.submission_id)
    .maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission || submission.participant_id === evaluatorId) {
    throw new Error("You cannot evaluate your own answer script.");
  }

  const { data: targetAttempt, error: attemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("session_id")
    .eq("id", submission.attempt_id)
    .maybeSingle();
  if (attemptError) throw attemptError;
  if (!targetAttempt || targetAttempt.session_id !== sessionId) {
    throw new Error("Assigned submission does not belong to this session.");
  }

  const paper = await getMockPaperById(session.paperId);
  if (!paper) throw new Error("The evaluation rubric could not be loaded.");
  const questions = paper.questions.map((question) => ({
    id: question.id,
    subject: question.subject,
    question: question.question,
    maxMarks: getEvaluationQuestionMaximum(question),
    rubric: question.rubric ?? [],
  }));
  if (!questions.length || questions.some((question) => !Number.isFinite(question.maxMarks) || question.maxMarks < 0)) {
    throw new Error("This paper does not have a usable evaluation rubric.");
  }

  if (assignment.status === "assigned") {
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("evaluator_assignments")
      .update({ status: "in_progress" })
      .eq("id", assignmentId)
      .eq("evaluator_id", evaluatorId)
      .eq("status", "assigned")
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) {
      const { data: current, error: currentError } = await supabaseAdmin
        .from("evaluator_assignments")
        .select("status")
        .eq("id", assignmentId)
        .eq("evaluator_id", evaluatorId)
        .maybeSingle();
      if (currentError) throw currentError;
      if (current?.status !== "in_progress") {
        throw new Error("This evaluation is no longer available.");
      }
    }
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(submission.participant_id);
  if (userError) console.warn("Unable to resolve evaluated participant name:", userError.message);
  const metadata = userData?.user?.user_metadata ?? {};
  const { data: signedUrl, error: signedUrlError } = await supabaseAdmin.storage
    .from(MOCK_SUBMISSIONS_BUCKET)
    .createSignedUrl(submission.file_path, 60 * 60);
  if (signedUrlError) throw signedUrlError;
  const { data: draftScore, error: draftScoreError } = await supabaseAdmin
    .from("evaluator_scores")
    .select("rubric_scores, comments")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (draftScoreError) throw draftScoreError;

  return {
    assignmentId,
    participantName: metadata.full_name ?? metadata.name ?? "StudyPact participant",
    answerScriptUrl: signedUrl.signedUrl,
    questions,
    rubricScores: draftScore?.rubric_scores ?? [],
    comments: draftScore?.comments ?? "",
  };
};

export const savePeerEvaluationDraft = async (
  sessionId: string,
  assignmentId: string,
  evaluatorId: string,
  rubricScores: Array<{ questionId: string; score: number }>,
  comments: string
) => {
  const { session } = await getPeerEvaluationContext(sessionId, evaluatorId);
  const available = await ensurePeerAssignments(sessionId);
  if (!available) throw new Error("Peer evaluation opens after the submission window closes.");

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("evaluator_assignments")
    .select("id, submission_id, evaluator_id, status")
    .eq("id", assignmentId)
    .eq("evaluator_id", evaluatorId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error("Assigned evaluation not found.");
  if (assignment.status === "completed") throw new Error("This evaluation has already been completed.");
  if (assignment.status !== "in_progress") throw new Error("Open this assigned evaluation before saving.");

  const { data: targetSubmission, error: submissionError } = await supabaseAdmin
    .from("mock_submissions")
    .select("participant_id, attempt_id")
    .eq("id", assignment.submission_id)
    .maybeSingle();
  if (submissionError) throw submissionError;
  if (!targetSubmission || targetSubmission.participant_id === evaluatorId) {
    throw new Error("You cannot evaluate your own answer script.");
  }

  const { data: targetAttempt, error: targetAttemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("session_id")
    .eq("id", targetSubmission.attempt_id)
    .maybeSingle();
  if (targetAttemptError) throw targetAttemptError;
  if (!targetAttempt || targetAttempt.session_id !== sessionId) {
    throw new Error("Assigned submission does not belong to this session.");
  }

  const paper = await getMockPaperById(session.paperId);
  if (!paper) throw new Error("The evaluation rubric could not be loaded.");
  const questions = new Map(paper.questions.map((question) => [question.id, question]));
  const seenQuestionIds = new Set<string>();
  let totalScore = 0;
  const normalizedScores = rubricScores.map(({ questionId, score }) => {
    const question = questions.get(questionId);
    if (!question || seenQuestionIds.has(questionId)) {
      throw new Error("The evaluation contains an invalid rubric question.");
    }
    seenQuestionIds.add(questionId);
    const maxMarks = getEvaluationQuestionMaximum(question);
    if (
      !Number.isFinite(score)
      || score < 0
      || score > maxMarks
      || Math.abs(score * 100 - Math.round(score * 100)) > 1e-8
    ) {
      throw new Error(`Question scores must be between 0 and ${maxMarks} marks.`);
    }
    totalScore += score;
    return { questionId, score, maxMarks };
  });
  const maximumScore = [...questions.values()].reduce(
    (sum, question) => sum + getEvaluationQuestionMaximum(question),
    0,
  );
  if (totalScore > maximumScore) {
    throw new Error(`The evaluation score cannot exceed ${maximumScore} marks.`);
  }
  if (comments.length > 5000) {
    throw new Error("Evaluation comments cannot exceed 5000 characters.");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("evaluator_scores")
    .select("id")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  const query = existing
    ? supabaseAdmin
        .from("evaluator_scores")
        .update({ score: totalScore, rubric_scores: normalizedScores, comments })
        .eq("id", existing.id)
    : supabaseAdmin
        .from("evaluator_scores")
        .insert({
          assignment_id: assignmentId,
          score: totalScore,
          rubric_scores: normalizedScores,
          comments,
        });
  const { error: saveError } = await query;
  if (saveError) throw saveError;
};

export const submitPeerEvaluation = async (
  sessionId: string,
  assignmentId: string,
  evaluatorId: string,
  rubricScores: Array<{ questionId: string; score: number }>,
  comments: string
) => {
  const { session } = await getPeerEvaluationContext(sessionId, evaluatorId);
  const available = await ensurePeerAssignments(sessionId);
  if (!available) throw new Error("Peer evaluation opens after the submission window closes.");

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("evaluator_assignments")
    .select("id, submission_id, evaluator_id, status")
    .eq("id", assignmentId)
    .eq("evaluator_id", evaluatorId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error("Assigned evaluation not found.");
  if (assignment.status === "completed") throw new Error("This evaluation has already been completed.");
  if (assignment.status !== "in_progress") throw new Error("Open this assigned evaluation before submitting it.");

  const { data: targetSubmission, error: submissionError } = await supabaseAdmin
    .from("mock_submissions")
    .select("participant_id, attempt_id")
    .eq("id", assignment.submission_id)
    .maybeSingle();
  if (submissionError) throw submissionError;
  if (!targetSubmission || targetSubmission.participant_id === evaluatorId) {
    throw new Error("You cannot evaluate your own answer script.");
  }

  const { data: targetAttempt, error: targetAttemptError } = await supabaseAdmin
    .from("participant_attempts")
    .select("session_id")
    .eq("id", targetSubmission.attempt_id)
    .maybeSingle();
  if (targetAttemptError) throw targetAttemptError;
  if (!targetAttempt || targetAttempt.session_id !== sessionId) {
    throw new Error("Assigned submission does not belong to this session.");
  }

  const paper = await getMockPaperById(session.paperId);
  if (!paper) throw new Error("The evaluation rubric could not be loaded.");
  const questions = new Map(paper.questions.map((question) => [question.id, question]));
  if (!Array.isArray(rubricScores) || rubricScores.length !== questions.size) {
    throw new Error("A score is required for every rubric question.");
  }
  const seenQuestionIds = new Set<string>();
  let totalScore = 0;
  const normalizedScores = rubricScores.map(({ questionId, score }) => {
    const question = questions.get(questionId);
    if (!question || seenQuestionIds.has(questionId)) {
      throw new Error("The evaluation contains an invalid rubric question.");
    }
    seenQuestionIds.add(questionId);
    const maxMarks = getEvaluationQuestionMaximum(question);
    if (
      !Number.isFinite(score)
      || score < 0
      || score > maxMarks
      || Math.abs(score * 100 - Math.round(score * 100)) > 1e-8
    ) {
      throw new Error(`Question scores must be between 0 and ${maxMarks} marks.`);
    }
    totalScore += score;
    return { questionId, score, maxMarks };
  });
  const maximumScore = [...questions.values()].reduce(
    (sum, question) => sum + getEvaluationQuestionMaximum(question),
    0,
  );
  if (totalScore > maximumScore) {
    throw new Error(`The evaluation score cannot exceed ${maximumScore} marks.`);
  }
  if (comments.length > 5000) {
    throw new Error("Evaluation comments cannot exceed 5000 characters.");
  }

  const { data: completedAssignment, error: completeError } = await supabaseAdmin
    .from("evaluator_assignments")
    .update({ status: "completed" })
    .eq("id", assignmentId)
    .eq("evaluator_id", evaluatorId)
    .eq("status", "in_progress")
    .select("id")
    .maybeSingle();
  if (completeError) throw completeError;
  if (!completedAssignment) throw new Error("This evaluation has already been completed.");

  const { data: draftScore, error: draftError } = await supabaseAdmin
    .from("evaluator_scores")
    .select("id")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let score: {
    id: string;
    assignment_id: string;
    score: number;
    rubric_scores: unknown;
    comments: string | null;
    submitted_at: string;
  } | null = null;
  let scoreError = draftError;
  if (!scoreError && draftScore) {
    const result = await supabaseAdmin
      .from("evaluator_scores")
      .update({
        score: totalScore,
        rubric_scores: normalizedScores,
        comments,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", draftScore.id)
      .select("id, assignment_id, score, rubric_scores, comments, submitted_at")
      .single();
    score = result.data;
    scoreError = result.error;
  } else if (!scoreError) {
    const result = await supabaseAdmin
      .from("evaluator_scores")
      .insert({
        assignment_id: assignmentId,
        score: totalScore,
        rubric_scores: normalizedScores,
        comments,
      })
      .select("id, assignment_id, score, rubric_scores, comments, submitted_at")
      .single();
    score = result.data;
    scoreError = result.error;
  }
  if (scoreError || !score) {
    await supabaseAdmin
      .from("evaluator_assignments")
      .update({ status: "in_progress" })
      .eq("id", assignmentId)
      .eq("evaluator_id", evaluatorId)
      .eq("status", "completed");
    throw scoreError ?? new Error("Unable to save the evaluation.");
  }

  return {
    id: score.id,
    assignmentId: score.assignment_id,
    score: Number(score.score),
    rubricScores: score.rubric_scores,
    comments: score.comments,
    submittedAt: score.submitted_at,
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

  const finalScore = summary.overall;
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
