import { apiRequest } from "./apiClient";

export function buildAttemptStorageKey(roomId, userId) {
  const roomKey = roomId || "mock-room";
  const userKey = userId || "guest";
  return `studypact:mock-attempt:${roomKey}:${userKey}`;
}

export function loadMockAttempt(roomId, userId) {
  try {
    const raw = localStorage.getItem(buildAttemptStorageKey(roomId, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistMockAttempt(roomId, userId, state) {
  try {
    localStorage.setItem(
      buildAttemptStorageKey(roomId, userId),
      JSON.stringify(state),
    );
  } catch {
    // Ignore storage errors in private browsing or restricted environments.
  }
}

export function evaluateMockAttempt(paper, answers = {}) {
  const result = {
    totalPossible: 0,
    objectiveMarks: 0,
    writtenMarks: 0,
    objectiveResults: [],
    writtenResults: [],
  };

  for (const question of paper.questions || []) {
    const value = answers[question.id];
    const normalizedValue = typeof value === "string" ? value.trim() : "";
    result.totalPossible += Number(question.maxMarks || 0);

    if (question.type === "objective") {
      const choice = question.options?.find(
        (option) => option.toLowerCase() === normalizedValue.toLowerCase(),
      );
      const isCorrect = Boolean(choice) && question.correctAnswer
        ? choice.toLowerCase() === question.correctAnswer.toLowerCase()
        : false;

      const awarded = isCorrect ? Number(question.maxMarks || 0) : 0;
      if (normalizedValue) {
        result.objectiveMarks += isCorrect ? Number(question.maxMarks || 0) : -Number(question.negativeMarks || 0);
      }

      result.objectiveResults.push({
        id: question.id,
        subject: question.subject,
        correct: isCorrect,
        awarded,
        answer: normalizedValue,
        correctAnswer: question.correctAnswer,
      });
    }

    if (question.type === "written") {
      const hasAnswer = normalizedValue.length > 0;
      result.writtenResults.push({
        id: question.id,
        subject: question.subject,
        answered: hasAnswer,
        rubric: question.rubric || [],
        answer: normalizedValue,
      });
    }
  }

  result.overall = Math.max(result.objectiveMarks + result.writtenMarks, 0);
  return result;
}

export const getAvailableMockPapers = async () => {
  const response = await apiRequest("/api/mock-exams/papers");
  return response?.data ?? [];
};

export const createMockSessionForRoom = async (roomId, paperId, { durationSeconds, customPaper } = {}) => {
  if (!paperId && !customPaper) {
    throw new Error("A question paper must be selected before creating a mock exam.");
  }

  const requestPaper = customPaper
    ? {
      name: customPaper.name,
      type: customPaper.type || "application/pdf",
      size: customPaper.size,
      data: await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Unable to read the selected question paper PDF."));
        reader.readAsDataURL(customPaper);
      }),
    }
    : undefined;

  const response = await apiRequest("/api/mock/sessions", {
    method: "POST",
    body: JSON.stringify({ roomId, paperId, durationSeconds, customPaper: requestPaper }),
  });

  return response?.data ?? response;
};

export const getActiveMockRooms = async (roomId) => {
  const response = await apiRequest(`/api/mock/rooms/${encodeURIComponent(roomId)}/sessions`);
  return response?.data ?? [];
};

export const joinMockRoom = async (roomId, sessionId) => {
  const response = await apiRequest(
    `/api/mock/rooms/${encodeURIComponent(roomId)}/sessions/${encodeURIComponent(sessionId)}/join`,
    { method: "POST" },
  );
  return response?.data ?? response;
};

export const startMockSession = async (sessionId, durationSeconds) => {
  const response = await apiRequest(`/api/mock/sessions/${encodeURIComponent(sessionId)}/start`, {
    method: "POST",
    body: JSON.stringify({ durationSeconds }),
  });

  return response?.data ?? response;
};

export const getMockSession = async (sessionId) => {
  const response = await apiRequest(`/api/mock/sessions/${encodeURIComponent(sessionId)}`);
  const payload = response?.data ?? response;

  if (payload?.session) {
    return payload;
  }

  if (payload?.paper || payload?.attempt || payload?.submission) {
    return payload;
  }

  return { session: payload };
};

export const submitAnswerScript = async ({ attemptId, sessionId, file }) => {
  const reader = new FileReader();
  const payload = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read the selected PDF file."));
    reader.readAsDataURL(file);
  });

  const response = await apiRequest("/api/mock/submissions", {
    method: "POST",
    body: JSON.stringify({
      attemptId,
      sessionId,
      file: {
        name: file.name,
        type: file.type || "application/pdf",
        size: file.size,
        data: payload,
      },
    }),
  });

  return response.data ?? response;
};

export const submitMockAttempt = async (roomId, answers, meta = {}) => {
  const response = await apiRequest(`/api/mock-exams/${encodeURIComponent(roomId || "mock-room")}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers, meta }),
  });
  return response?.data ?? response;
};
