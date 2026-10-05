import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getMockSession,
  startMockSession,
  submitAnswerScript,
} from '../../services/mockExamService';
import './Mockroom.css';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

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
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [submission, setSubmission] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [phase, setPhase] = useState('loading');
  const [examDurationMinutes, setExamDurationMinutes] = useState('');
  const [isStartingExam, setIsStartingExam] = useState(false);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

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

        setSessionData({ ...session, attempt: payload.attempt ?? null });
        setPaper(nextPaper);
        setSubmission(nextSubmission);

        const sessionEndsAt = session?.endsAt || payload?.endsAt || null;
        const now = Date.now();
        const secondsLeft = sessionEndsAt ? Math.max(0, Math.ceil((new Date(sessionEndsAt).getTime() - now) / 1000)) : 0;
        setTimeRemaining(secondsLeft);
        setExamDurationMinutes(session?.durationSeconds
          ? String(Math.ceil(session.durationSeconds / 60))
          : '');

        if (session?.status === 'expired' || session?.status === 'completed') {
          setPhase('expired');
        } else if (session?.status === 'draft') {
          setPhase('draft');
        } else if (session?.status === 'live' && secondsLeft <= 0) {
          setPhase('expired');
        } else if (session?.status === 'live') {
          setPhase('live');
        } else {
          throw new Error('The mock session has an unsupported state.');
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
    if (!sessionData || phase !== 'live') return undefined;

    const updateTimer = () => {
      const endsAt = sessionData?.endsAt || sessionData?.session?.endsAt || null;
      if (!endsAt) return;

      const remaining = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        setPhase('expired');
      }
    };

    updateTimer();
    timerRef.current = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timerRef.current);
  }, [sessionData, phase]);

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

      setSessionData((current) => ({ ...current, ...startedSession }));
      setTimeRemaining(Math.max(0, Math.ceil((new Date(startedSession.endsAt).getTime() - Date.now()) / 1000)));
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
    setStatusMessage('Uploading...');

    try {
      const response = await submitAnswerScript({
        attemptId: sessionData.attempt.id,
        sessionId: sessionData.id || sessionId,
        file: selectedFile,
      });

      if (response?.status === 'SUBMITTED' || response?.data?.status === 'SUBMITTED' || response?.id) {
        setSubmission(response?.data || response || null);
        setPhase('submitted');
        setStatusMessage('✓ Answer script submitted');
      } else {
        throw new Error(response?.message || 'Upload failed.');
      }
    } catch (submitError) {
      setError(submitError?.message || 'Upload failed. Please try again.');
      setStatusMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDuration = sessionData?.durationSeconds || 1800;
  const showUploadPanel = phase === 'expired' || phase === 'submitted';

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
          Back to room
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
              <p className="mr-upload-title">Answer submission</p>
              <p className="mr-upload-text">Upload your completed answer script as a PDF.</p>

              <label className="mr-upload-input-label">
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} />
                <span>[ Choose PDF ]</span>
              </label>

              {selectedFile ? (
                <div className="mr-file-info">
                  <p>Selected: {selectedFile.name}</p>
                  <p>{formatFileSize(selectedFile.size)}</p>
                </div>
              ) : null}

              {error ? <div className="mr-error-box" role="alert">{error}</div> : null}

              {statusMessage ? <div className="mr-success-box">{statusMessage}</div> : null}

              {submission ? (
                <div className="mr-submission-box">
                  <p>Submission ID: {submission.id || submission.data?.id}</p>
                  <p>Status: {submission.status || submission.data?.status || 'SUBMITTED'}</p>
                </div>
              ) : null}

              <button
                type="button"
                className="mr-btn mr-btn-primary"
                onClick={handleSubmitPdf}
                disabled={!selectedFile || isSubmitting}
              >
                {isSubmitting ? 'Uploading...' : 'Submit Answer Script'}
              </button>
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