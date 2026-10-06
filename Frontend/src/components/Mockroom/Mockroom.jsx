import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getEvaluationDiscussion,
  getPeerEvaluation,
  getPeerEvaluations,
  getMockSession,
  postEvaluationDiscussionMessage,
  savePeerEvaluationDraft,
  startMockSession,
  submitPeerEvaluation,
  submitAnswerScript,
} from '../../services/mockExamService';
import { supabase } from '../../services/supabaseClient';
import './Mockroom.css';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
const SUBMISSION_WINDOW_SECONDS = 5 * 60;

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
};

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};

const MockRoom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const sessionId = id;

  const [sessionData, setSessionData] = useState(null);
  const [paper, setPaper] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [peerEvaluation, setPeerEvaluation] = useState(null);
  const [peerEvaluationLoading, setPeerEvaluationLoading] = useState(false);
  const [peerEvaluationError, setPeerEvaluationError] = useState('');
  const [activePeerAssignment, setActivePeerAssignment] = useState(null);
  const [evaluationScores, setEvaluationScores] = useState({});
  const [evaluationComments, setEvaluationComments] = useState('');
  const [isSubmittingEvaluation, setIsSubmittingEvaluation] = useState(false);
  const [discussionAssignment, setDiscussionAssignment] = useState(null);
  const [discussionMessages, setDiscussionMessages] = useState([]);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [discussionSending, setDiscussionSending] = useState(false);
  const [discussionDraft, setDiscussionDraft] = useState('');
  const [discussionError, setDiscussionError] = useState('');
  const discussionRetryTimerRef = useRef(null);
  const discussionRetryCountRef = useRef(0);
  const [submission, setSubmission] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [phase, setPhase] = useState('loading');
  const [examDurationMinutes, setExamDurationMinutes] = useState('');
  const [isStartingExam, setIsStartingExam] = useState(false);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const serverTimeOffsetRef = useRef(0);
  const draftSaveTimerRef = useRef(null);
  const draftSaveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      if (!sessionId) {
        if (isMounted) {
          setSessionLoading(false);
          setError('Mock session not found.');
        }
        return;
      }

      try {
        const response = await getMockSession(sessionId);
        const payload = response?.data ?? response;
        const session = payload?.session;
        const nextPaper = payload?.paper;
        const nextSubmission = payload?.submission ?? null;
        if (!session || !nextPaper || !Array.isArray(nextPaper.questions)) {
          throw new Error('Mock session response is missing its selected paper or question list.');
        }
        if (!nextPaper.documentUrl && nextPaper.questions.length === 0) {
          throw new Error('The selected paper response contains no questions or question-paper PDF.');
        }

        if (!isMounted) return;

        setPaper(nextPaper);
        setSubmission(nextSubmission);

        const serverNow = payload?.serverNow ? Date.parse(payload.serverNow) : Date.now();
        serverTimeOffsetRef.current = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
        const currentServerTime = Date.now() + serverTimeOffsetRef.current;
        const sessionEndsAt = session?.endsAt || payload?.endsAt || null;
        const endsAtMs = sessionEndsAt ? Date.parse(sessionEndsAt) : NaN;
        const submissionDeadlineAt = payload?.submissionDeadlineAt
          || (Number.isFinite(endsAtMs)
            ? new Date(endsAtMs + SUBMISSION_WINDOW_SECONDS * 1000).toISOString()
            : null);
        const submissionDeadlineMs = submissionDeadlineAt ? Date.parse(submissionDeadlineAt) : NaN;
        const secondsLeft = Number.isFinite(endsAtMs)
          ? Math.max(0, Math.ceil((endsAtMs - currentServerTime) / 1000))
          : 0;
        const submissionSecondsLeft = Number.isFinite(submissionDeadlineMs)
          ? Math.max(0, Math.ceil((submissionDeadlineMs - currentServerTime) / 1000))
          : 0;
        setTimeRemaining(secondsLeft);
        setExamDurationMinutes(session?.durationSeconds
          ? String(Math.ceil(session.durationSeconds / 60))
          : '');
        const sessionView = {
          ...session,
          attempt: payload.attempt ?? null,
          submissionDeadlineAt,
        };
        setSessionData(sessionView);

        if (session?.status === 'draft') {
          setPhase('draft');
        } else if (Number.isFinite(endsAtMs) && currentServerTime >= endsAtMs) {
          setTimeRemaining(submissionSecondsLeft);
          setPhase(submissionSecondsLeft > 0 ? 'submission-window' : 'closed');
        } else if (session?.status === 'live') {
          setPhase('live');
        } else {
          setPhase('closed');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError?.message || 'Unable to load the mock session.');
        }
      } finally {
        if (isMounted) {
          setSessionLoading(false);
        }
      }
    };

    loadSession();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionData || (phase !== 'live' && phase !== 'submission-window')) return undefined;

    const updateTimer = () => {
      const endsAt = sessionData?.endsAt || sessionData?.session?.endsAt || null;
      if (!endsAt || !Number.isFinite(Date.parse(endsAt))) {
        setTimeRemaining(0);
        setPhase('closed');
        return;
      }

      const serverNow = Date.now() + serverTimeOffsetRef.current;
      const endsAtMs = Date.parse(endsAt);
      if (phase === 'live') {
        const remaining = Math.max(0, Math.ceil((endsAtMs - serverNow) / 1000));
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          const deadlineAt = sessionData.submissionDeadlineAt
            || new Date(endsAtMs + SUBMISSION_WINDOW_SECONDS * 1000).toISOString();
          const submissionRemaining = Math.max(
            0,
            Math.ceil((Date.parse(deadlineAt) - serverNow) / 1000),
          );
          setTimeRemaining(submissionRemaining);
          setPhase(submissionRemaining > 0 ? 'submission-window' : 'closed');
        }
      } else {
        const deadlineAt = sessionData.submissionDeadlineAt
          || new Date(endsAtMs + SUBMISSION_WINDOW_SECONDS * 1000).toISOString();
        const remaining = Math.max(0, Math.ceil((Date.parse(deadlineAt) - serverNow) / 1000));
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          setPhase('closed');
        }
      }
    };

    updateTimer();
    timerRef.current = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timerRef.current);
  }, [sessionData, phase]);

  useEffect(() => {
    if (!sessionId || !sessionData || phase !== 'closed') return undefined;

    let isCurrent = true;
    setPeerEvaluationLoading(true);
    setPeerEvaluationError('');
    getPeerEvaluations(sessionId)
      .then((overview) => {
        if (isCurrent) setPeerEvaluation(overview);
      })
      .catch((loadError) => {
        if (!isCurrent) return;
        console.error('Unable to load peer evaluations:', loadError);
        setPeerEvaluationError(loadError?.message || 'Unable to load peer evaluations.');
      })
      .finally(() => {
        if (isCurrent) setPeerEvaluationLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [sessionId, sessionData, phase]);

  useEffect(() => {
    const assignmentId = discussionAssignment?.assignmentId;
    if (!assignmentId || !sessionId) return undefined;

    let isCurrent = true;
    let channel = null;
    const loadDiscussion = async () => {
      setDiscussionLoading(true);
      setDiscussionError('');
      try {
        const messages = await getEvaluationDiscussion(sessionId, assignmentId);
        if (isCurrent) setDiscussionMessages(messages);
      } catch (loadError) {
        if (isCurrent) setDiscussionError(loadError?.message || 'Unable to load the discussion.');
      } finally {
        if (isCurrent) setDiscussionLoading(false);
      }
    };
    const refreshDiscussion = async () => {
      try {
        const messages = await getEvaluationDiscussion(sessionId, assignmentId);
        if (isCurrent) {
          setDiscussionMessages((current) => {
            const byId = new Map(current.map((message) => [message.id, message]));
            messages.forEach((message) => byId.set(message.id, message));
            return [...byId.values()].sort((left, right) => (
              new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
            ));
          });
          setDiscussionError('');
        }
      } catch (loadError) {
        if (isCurrent) setDiscussionError(loadError?.message || 'Unable to refresh the discussion.');
      }
    };
    const subscribeToDiscussion = () => {
      if (!isCurrent || !supabase) return;
      const subscribedChannel = supabase
        .channel(`evaluation-discussion:${assignmentId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'evaluation_discussion_messages',
          filter: `assignment_id=eq.${assignmentId}`,
        }, () => {
          void refreshDiscussion();
        });
      channel = subscribedChannel;
      subscribedChannel.subscribe((status) => {
        if (!isCurrent || status === 'SUBSCRIBED') return;
        if (!['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)
          || discussionRetryCountRef.current >= 3
          || discussionRetryTimerRef.current) return;
        discussionRetryCountRef.current += 1;
        discussionRetryTimerRef.current = window.setTimeout(async () => {
          discussionRetryTimerRef.current = null;
          if (!isCurrent) return;
          await supabase.removeChannel(subscribedChannel);
          await refreshDiscussion();
          subscribeToDiscussion();
        }, discussionRetryCountRef.current * 1000);
      });
    };

    void loadDiscussion().then(() => subscribeToDiscussion());
    return () => {
      isCurrent = false;
      if (discussionRetryTimerRef.current) window.clearTimeout(discussionRetryTimerRef.current);
      discussionRetryTimerRef.current = null;
      discussionRetryCountRef.current = 0;
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [discussionAssignment, sessionId]);

  useEffect(() => {
    if (!activePeerAssignment || isSubmittingEvaluation) return undefined;
    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
    }

    const rubricScores = Object.entries(evaluationScores)
      .filter(([, value]) => value !== '' && Number.isFinite(Number(value)))
      .map(([questionId, value]) => ({ questionId, score: Number(value) }));
    const { assignmentId } = activePeerAssignment;
    const comments = evaluationComments;
    draftSaveTimerRef.current = window.setTimeout(() => {
      draftSaveQueueRef.current = draftSaveQueueRef.current
        .catch(() => {})
        .then(async () => {
          await savePeerEvaluationDraft(sessionId, assignmentId, rubricScores, comments);
          setPeerEvaluationError('');
        });
      draftSaveQueueRef.current.catch((saveError) => {
        console.error('Unable to save peer evaluation draft:', saveError);
        setPeerEvaluationError(saveError?.message || 'Unable to save evaluation progress.');
      });
    }, 500);

    return () => {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [
    activePeerAssignment,
    evaluationScores,
    evaluationComments,
    isSubmittingEvaluation,
    sessionId,
  ]);

  const handleStartExam = async () => {
    const durationMinutes = Number(examDurationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      setError('Enter an exam duration between 1 minute and 24 hours.');
      return;
    }

    setError('');
    setIsStartingExam(true);
    try {
      const response = await startMockSession(sessionId, durationMinutes * 60);
      const startedSession = response?.session || response;
      if (!startedSession?.id || !startedSession?.endsAt) {
        throw new Error('The server did not return the started mock session.');
      }

      const serverNow = response?.serverNow ? Date.parse(response.serverNow) : Date.now();
      serverTimeOffsetRef.current = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
      const submissionDeadlineAt = response?.submissionDeadlineAt
        || new Date(Date.parse(startedSession.endsAt) + SUBMISSION_WINDOW_SECONDS * 1000).toISOString();
      setSessionData((current) => ({ ...current, ...startedSession, submissionDeadlineAt }));
      setTimeRemaining(Math.max(0, Math.ceil((
        Date.parse(startedSession.endsAt) - Date.now() - serverTimeOffsetRef.current
      ) / 1000)));
      setPhase('live');
    } catch (startError) {
      setError(startError?.message || 'Unable to start the mock exam.');
    } finally {
      setIsStartingExam(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.type !== 'application/pdf') {
      setSelectedFile(null);
      setError('Wrong file type. Please upload a PDF answer script.');
      return;
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      setSelectedFile(null);
      setError('File too large. Please upload a PDF under 10 MB.');
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmitPdf = async () => {
    if (!selectedFile || !sessionData || !sessionData.attempt || !sessionData.attempt.id) {
      setError('The current session is not ready for PDF submission.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await submitAnswerScript({
        attemptId: sessionData.attempt.id,
        sessionId: sessionData.id || sessionId,
        file: selectedFile,
      });

      if (response?.status === 'SUBMITTED' || response?.data?.status === 'SUBMITTED' || response?.id) {
        setSubmission(response?.data || response || null);
      } else {
        throw new Error(response?.message || 'Upload failed.');
      }
    } catch (submitError) {
      setError(submitError?.message || 'Upload failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPeerAssignment = async (assignment) => {
    setPeerEvaluationError('');
    try {
      const evaluation = await getPeerEvaluation(sessionId, assignment.id);
      setActivePeerAssignment(evaluation);
      const savedScores = Object.fromEntries(
        evaluation.questions.map((question) => [question.id, '']),
      );
      evaluation.rubricScores.forEach((score) => {
        if (Object.hasOwn(savedScores, score.questionId)) {
          savedScores[score.questionId] = String(score.score);
        }
      });
      setEvaluationScores(savedScores);
      setEvaluationComments(evaluation.comments || '');
      setDiscussionAssignment({
        assignmentId: evaluation.assignmentId,
        participantName: evaluation.participantName,
      });
    } catch (loadError) {
      console.error('Unable to open peer evaluation:', loadError);
      setPeerEvaluationError(loadError?.message || 'Unable to open this peer evaluation.');
    }
  };

  const handleOpenAuthorDiscussion = (evaluation) => {
    setDiscussionError('');
    setDiscussionAssignment({
      assignmentId: evaluation.assignmentId,
      participantName: evaluation.evaluator,
    });
  };

  const handleSendDiscussionMessage = async (event) => {
    event.preventDefault();
    const content = discussionDraft.trim();
    if (!content || discussionSending || !discussionAssignment) return;
    setDiscussionSending(true);
    setDiscussionError('');
    try {
      const message = await postEvaluationDiscussionMessage(
        sessionId,
        discussionAssignment.assignmentId,
        content,
      );
      setDiscussionMessages((current) => (
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message].sort((left, right) => (
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          ))
      ));
      setDiscussionDraft('');
    } catch (sendError) {
      setDiscussionError(sendError?.message || 'Unable to send the discussion message.');
    } finally {
      setDiscussionSending(false);
    }
  };

  const handleSubmitPeerEvaluation = async (event) => {
    event.preventDefault();
    if (!activePeerAssignment || isSubmittingEvaluation) return;
    setPeerEvaluationError('');
    setIsSubmittingEvaluation(true);
    try {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      await draftSaveQueueRef.current.catch(() => {});
      const rubricScores = activePeerAssignment.questions.map((question) => ({
        questionId: question.id,
        score: Number(evaluationScores[question.id]),
      }));
      await savePeerEvaluationDraft(
        sessionId,
        activePeerAssignment.assignmentId,
        rubricScores,
        evaluationComments,
      );
      await submitPeerEvaluation(
        sessionId,
        activePeerAssignment.assignmentId,
        rubricScores,
        evaluationComments,
      );
      setActivePeerAssignment(null);
      setPeerEvaluationLoading(true);
      const overview = await getPeerEvaluations(sessionId);
      setPeerEvaluation(overview);
    } catch (submitError) {
      console.error('Unable to submit peer evaluation:', submitError);
      setPeerEvaluationError(submitError?.message || 'Unable to submit this evaluation.');
    } finally {
      setIsSubmittingEvaluation(false);
      setPeerEvaluationLoading(false);
    }
  };

  const totalDuration = sessionData?.durationSeconds || 1800;
  const showUploadPanel = phase === 'submission-window' || phase === 'closed';
  const submissionComplete = submission?.status?.toUpperCase() === 'SUBMITTED';
  const canSubmit = phase === 'submission-window' && !submissionComplete;

  if (sessionLoading) {
    return (
      <div className="mr-page">
        <div className="mr-loading">Loading mock session…</div>
      </div>
    );
  }

  if (!sessionData && !paper) {
    return (
      <div className="mr-page">
        <div className="mr-loading" role={error ? 'alert' : 'status'}>
          {error || 'Mock session not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="mr-page">
      <header className="mr-topbar">
        <div className="mr-room-info">
          <span className="mr-badge">{paper?.examTag || 'Mock'}</span>
          <h1 className="mr-title">
            {paper ? `${paper.examTag} ${paper.examYear ?? ''} · ${paper.paperName || paper.title}` : 'Mock Exam'}
          </h1>
        </div>
        <Link to={sessionData?.roomId ? `/study-room/${sessionData.roomId}` : '/dashboard'} className="mr-link-btn">
          {showUploadPanel ? 'Leave Mock Room' : 'Back to room'}
        </Link>
      </header>

      <div className={`mr-body ${phase === 'draft' || showUploadPanel ? 'mr-body-single' : ''}`}>
        <section className="mr-panel mr-paper-panel">
          <div className="mr-panel-header">
            <p className="mr-panel-label">Question paper</p>
            <span className="mr-progress-badge">
              {showUploadPanel ? 'Answer submission' : 'Question paper'}
            </span>
          </div>

          {showUploadPanel ? (
            <div className="mr-upload-panel">
              <h2 className="mr-upload-title">ANSWER SCRIPT SUBMISSION</h2>
              {phase === 'submission-window' ? (
                <>
                  <div className="mr-submission-countdown" role="timer" aria-live="off">
                    <span>Submission window:</span>
                    <strong>{formatTime(timeRemaining)}</strong>
                  </div>
                  {!submissionComplete ? (
                    <>
                      <p className="mr-upload-text">Upload your completed answer script.</p>

                      <label className={`mr-upload-input-label ${isSubmitting ? 'mr-upload-input-disabled' : ''}`}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={handleFileChange}
                          disabled={!canSubmit || isSubmitting}
                        />
                        <span>[ Choose PDF ]</span>
                      </label>

                      {selectedFile ? (
                        <div className="mr-file-info">
                          <p>Selected: {selectedFile.name}</p>
                          <p>{formatFileSize(selectedFile.size)}</p>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}

              {error ? <div className="mr-error-box" role="alert">{error}</div> : null}
              {submissionComplete ? (
                <div className="mr-success-box" role="status">Answer script submitted.</div>
              ) : null}
              {phase === 'closed' ? (
                <div className="mr-error-box" role="status">Submission window closed.</div>
              ) : null}
              {canSubmit && !submissionComplete ? (
                <button
                  type="button"
                  className="mr-btn mr-btn-primary"
                  onClick={handleSubmitPdf}
                  disabled={!selectedFile || isSubmitting}
                >
                  {isSubmitting ? 'Uploading...' : 'Submit Answer Script'}
                </button>
              ) : null}
              {phase === 'closed' && !submissionComplete ? (
                <div className="mr-submission-closed-note">
                  Return to the StudyRoom when you are ready.
                </div>
              ) : null}
              {phase === 'closed' ? (
                <section className="mr-peer-evaluation" aria-labelledby="mr-peer-evaluation-title">
                  <h2 id="mr-peer-evaluation-title">PEER EVALUATION</h2>
                  {peerEvaluationLoading ? <p>Loading peer evaluations...</p> : null}
                  {peerEvaluationError ? <p className="mr-peer-error" role="alert">{peerEvaluationError}</p> : null}
                  {!peerEvaluationLoading && peerEvaluation && !peerEvaluation.available ? (
                    <p>Peer evaluation will be available after the submission stage is complete.</p>
                  ) : null}
                  {!peerEvaluationLoading && peerEvaluation?.available ? (
                    <>
                      {peerEvaluation.assignments.length ? (
                        <>
                          <p className="mr-peer-progress">
                            Assigned submissions: {peerEvaluation.assignments.filter((item) => item.completed).length}/{peerEvaluation.assignments.length} complete
                          </p>
                          <ol className="mr-peer-assignment-list">
                            {peerEvaluation.assignments.map((assignment) => (
                              <li key={assignment.id}>
                                <span>{assignment.participantName}</span>
                                {assignment.completed ? (
                                  <span className="mr-peer-complete">Completed</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="mr-btn mr-btn-secondary"
                                    onClick={() => handleOpenPeerAssignment(assignment)}
                                  >
                                    {assignment.status === 'in_progress' ? 'Continue' : 'Evaluate'}
                                  </button>
                                )}
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : (
                        <p>No peer submissions are available for evaluation.</p>
                      )}
                      {!peerEvaluation.allEvaluationsComplete ? (
                        <p className="mr-peer-locked">
                          Complete all assigned peer evaluations to unlock your result.
                        </p>
                      ) : null}
                      {peerEvaluation.ownResult ? (
                        <div className="mr-peer-result">
                          <h3>Your evaluated answer script</h3>
                          <a href={peerEvaluation.ownResult.downloadUrl} target="_blank" rel="noreferrer">
                            View your answer script
                          </a>
                          {peerEvaluation.ownResult.finalMeanReady ? (
                            <p>Final mean score: {peerEvaluation.ownResult.finalScore}</p>
                          ) : (
                            <p>
                              Peer evaluations received: {peerEvaluation.ownResult.receivedEvaluationCount}/
                              {peerEvaluation.ownResult.expectedEvaluationCount}
                            </p>
                          )}
                          <ul>
                            {peerEvaluation.ownResult.evaluations.map((evaluation, index) => (
                              <li key={`${evaluation.submittedAt}-${index}`}>
                                <strong>{evaluation.evaluator}:</strong> {evaluation.score} marks
                                {evaluation.comments ? <p>{evaluation.comments}</p> : null}
                                {Array.isArray(evaluation.rubricScores) && evaluation.rubricScores.length ? (
                                  <ul>
                                    {evaluation.rubricScores.map((rubricScore) => (
                                      <li key={rubricScore.questionId}>
                                        Question score: {rubricScore.score}/{rubricScore.maxMarks}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                                <button
                                  type="button"
                                  className="mr-btn mr-btn-secondary mr-peer-discussion-open"
                                  onClick={() => handleOpenAuthorDiscussion(evaluation)}
                                >
                                  Discuss this feedback
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {activePeerAssignment ? (
                    <form className="mr-peer-evaluation-form" onSubmit={handleSubmitPeerEvaluation}>
                      <h3>Evaluate {activePeerAssignment.participantName}'s answer script</h3>
                      <a href={activePeerAssignment.answerScriptUrl} target="_blank" rel="noreferrer">
                        View / download answer script
                      </a>
                      {activePeerAssignment.questions.map((question, index) => (
                        <label className="mr-peer-score-row" key={question.id}>
                          <span>
                            Question {index + 1}: {question.subject} (max {question.maxMarks})
                            {question.rubric.length
                              ? ` — ${question.rubric.map((criterion) => `${criterion.criterion} (${criterion.marks})`).join(', ')}`
                              : ''}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max={question.maxMarks}
                            step="0.01"
                            value={evaluationScores[question.id] ?? ''}
                            onChange={(event) => setEvaluationScores((current) => ({
                              ...current,
                              [question.id]: event.target.value,
                            }))}
                            required
                            disabled={isSubmittingEvaluation}
                          />
                        </label>
                      ))}
                      <label className="mr-peer-comments">
                        Comments
                        <textarea
                          value={evaluationComments}
                          maxLength={5000}
                          onChange={(event) => setEvaluationComments(event.target.value)}
                          disabled={isSubmittingEvaluation}
                        />
                      </label>
                      <button
                        type="submit"
                        className="mr-btn mr-btn-primary"
                        disabled={isSubmittingEvaluation}
                      >
                        {isSubmittingEvaluation ? 'Submitting...' : 'Submit Evaluation'}
                      </button>
                    </form>
                  ) : null}
                  {discussionAssignment ? (
                    <section className="mr-peer-discussion" aria-labelledby="mr-peer-discussion-title">
                      <h3 id="mr-peer-discussion-title">
                        Discussion about {discussionAssignment.participantName}'s evaluation
                      </h3>
                      {discussionLoading ? <p>Loading discussion...</p> : null}
                      {discussionError ? <p className="mr-peer-error" role="alert">{discussionError}</p> : null}
                      {!discussionLoading && !discussionMessages.length ? (
                        <p>No messages yet. Start the discussion about this evaluation.</p>
                      ) : null}
                      <div className="mr-peer-discussion-messages" aria-live="polite">
                        {discussionMessages.map((message) => (
                          <article
                            key={message.id}
                            className={`mr-peer-discussion-message ${message.senderId === user?.id ? 'mr-peer-discussion-message-own' : ''}`}
                          >
                            <div>
                              <strong>{message.senderId === user?.id ? 'You' : message.senderName}</strong>
                              <time dateTime={message.createdAt}>
                                {new Date(message.createdAt).toLocaleString()}
                              </time>
                            </div>
                            <p>{message.content}</p>
                          </article>
                        ))}
                      </div>
                      <form className="mr-peer-discussion-form" onSubmit={handleSendDiscussionMessage}>
                        <textarea
                          value={discussionDraft}
                          maxLength={5000}
                          onChange={(event) => setDiscussionDraft(event.target.value)}
                          placeholder="Discuss this evaluation feedback..."
                          disabled={discussionSending}
                        />
                        <button
                          type="submit"
                          className="mr-btn mr-btn-primary"
                          disabled={!discussionDraft.trim() || discussionSending}
                        >
                          {discussionSending ? 'Sending...' : 'Send'}
                        </button>
                      </form>
                    </section>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : paper?.documentUrl ? (
            <iframe
              className="mr-question-paper-pdf"
              title={`Question paper: ${paper.paperName || paper.title}`}
              src={paper.documentUrl}
            />
          ) : paper?.questions?.length ? (
            <div className="mr-paper-display">
              {phase === 'draft' && (
                <div className="mr-draft-notice" role="status">
                  Exam not started yet. This is the selected question paper.
                </div>
              )}
              {paper.questions.map((question, index) => (
                <div key={question.id || index} className="mr-paper-question">
                  <p className="mr-question-number">Q{index + 1}</p>
                  <p className="mr-question-subject">{question.subject}</p>
                  {question.imageUrl ? (
                    <img
                      className="mr-source-question-image"
                      src={question.imageUrl}
                      alt={`Source question ${question.question}`}
                      loading="lazy"
                    />
                  ) : (
                    <p className="mr-question-text-block">{question.question}</p>
                  )}
                  {!question.imageUrl && question.options?.length ? (
                    <ul className="mr-options-list-paper">
                      {question.options.map((option) => (
                        <li key={option}>{option}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mr-draft-notice" role="alert">
              The selected paper response did not include its questions or PDF. Reload the session or contact support.
            </p>
          )}
        </section>

        {phase === 'draft' && (
          <section className="mr-panel mr-start-panel">
            <p className="mr-panel-label">Ready to begin?</p>
            {sessionData?.createdBy === user?.id ? (
              <>
                <label className="mr-duration-label" htmlFor="exam-duration-minutes">
                  Exam duration (minutes)
                  <input
                    id="exam-duration-minutes"
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    value={examDurationMinutes}
                    onChange={(event) => setExamDurationMinutes(event.target.value)}
                    disabled={isStartingExam}
                  />
                </label>
                <p className="mr-duration-help">
                  The source dataset does not specify a duration. Set the shared exam timer before starting.
                </p>
                {error ? <div className="mr-error-box" role="alert">{error}</div> : null}
                <button
                  type="button"
                  className="mr-btn mr-btn-primary"
                  onClick={handleStartExam}
                  disabled={isStartingExam || !examDurationMinutes}
                >
                  {isStartingExam ? 'Starting...' : 'Start Exam'}
                </button>
              </>
            ) : (
              <p className="mr-draft-notice" role="status">
                The session creator will choose the duration and start the exam.
              </p>
            )}
          </section>
        )}

        {phase === 'live' && (
          <section className="mr-panel mr-timer-panel">
            <div className="mr-timer-card">
              <div className="mr-timer-ring-wrapper">
                <svg className="mr-timer-ring" viewBox="0 0 100 100">
                  <circle className="mr-ring-bg" cx="50" cy="50" r="44" />
                  <circle
                    className="mr-ring-progress"
                    cx="50"
                    cy="50"
                    r="44"
                    style={{
                      strokeDashoffset: 276 - (276 * Math.min(timeRemaining, totalDuration)) / totalDuration,
                    }}
                  />
                </svg>
                <div className="mr-timer-center">
                  <span className="mr-timer-value">{formatTime(timeRemaining)}</span>
                  <span className="mr-timer-caption">Time remaining</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default MockRoom;