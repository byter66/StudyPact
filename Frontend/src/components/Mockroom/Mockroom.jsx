
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import './MockRoom.css';

const MOCK_PAPER = {
    title: 'UPSC Prelims — Polity Mock Paper 3',
    examTag: 'UPSC',
    durationMinutes: 30,
    question:
        "Q1. With reference to the Indian Constitution, consider the following statements:\n\n1. The Directive Principles of State Policy are non-justiciable.\n2. Fundamental Rights can be amended under Article 368.\n3. The Ninth Schedule places laws beyond judicial review in all cases.\n\nWhich of the statements given above is/are correct?\n\n(a) 1 and 2 only\n(b) 2 only\n(c) 1 and 3 only\n(d) 1, 2 and 3",
};

const UPLOAD_WINDOW_SECONDS = 5 * 60; // 5 min to upload after time's up, per wireframe

const MockRoom = () => {
    const { id } = useParams();

    const [phase, setPhase] = useState('idle'); // idle | running | uploadWindow | submitted
    const [secondsLeft, setSecondsLeft] = useState(MOCK_PAPER.durationMinutes * 60);
    const [uploadSecondsLeft, setUploadSecondsLeft] = useState(UPLOAD_WINDOW_SECONDS);
    const [answerText, setAnswerText] = useState('');
    const intervalRef = useRef(null);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Main exam timer
    useEffect(() => {
        if (phase !== 'running') return;
        intervalRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    setPhase('uploadWindow');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [phase]);

    // Upload grace window, once main timer hits zero
    useEffect(() => {
        if (phase !== 'uploadWindow') return;
        intervalRef.current = setInterval(() => {
            setUploadSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    setPhase('submitted');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [phase]);

    const handleGo = () => setPhase('running');

    const handleSubmit = (e) => {
        e.preventDefault();
        clearInterval(intervalRef.current);
        setPhase('submitted');
    };

    return (
        <div className="mr-page">

            <header className="mr-topbar">
                <div className="mr-room-info">
                    <span className="mr-badge">{MOCK_PAPER.examTag}</span>
                    <h1 className="mr-title">{MOCK_PAPER.title}</h1>
                </div>
                <Link to={`/study-room/${id || 'r1'}`} className="mr-link-btn">Back to room</Link>
            </header>

            <div className="mr-body">

                {/* Question paper panel */}
                <section className="mr-panel mr-question-panel">
                    <p className="mr-panel-label">Question paper</p>
                    <div className="mr-question-text">
                        {MOCK_PAPER.question.split('\n').map((line, i) => (
                            <p key={i}>{line || '\u00A0'}</p>
                        ))}
                    </div>
                </section>

                {/* Answer + timer panel */}
                <section className="mr-panel mr-answer-panel">

                    <div className="mr-timer-block">
                        <div className="mr-timer-ring-wrapper">
                            <svg className="mr-timer-ring" viewBox="0 0 100 100">
                                <circle className="mr-ring-bg" cx="50" cy="50" r="44" />
                                <circle
                                    className={`mr-ring-progress ${phase === 'uploadWindow' ? 'mr-ring-urgent' : ''}`}
                                    cx="50" cy="50" r="44"
                                    style={{
                                        strokeDashoffset:
                                            phase === 'uploadWindow'
                                                ? 276 - (276 * uploadSecondsLeft) / UPLOAD_WINDOW_SECONDS
                                                : 276 - (276 * secondsLeft) / (MOCK_PAPER.durationMinutes * 60),
                                    }}
                                />
                            </svg>
                            <div className="mr-timer-center">
                                <span className="mr-timer-value">
                                    {phase === 'uploadWindow' ? formatTime(uploadSecondsLeft) : formatTime(secondsLeft)}
                                </span>
                                <span className="mr-timer-caption">
                                    {phase === 'idle' && 'Not started'}
                                    {phase === 'running' && 'Time remaining'}
                                    {phase === 'uploadWindow' && 'Upload window'}
                                    {phase === 'submitted' && 'Submitted'}
                                </span>
                            </div>
                        </div>

                        {phase === 'idle' && (
                            <button className="mr-btn mr-btn-primary mr-go-btn" onClick={handleGo}>
                                Go
                            </button>
                        )}
                    </div>

                    <form className="mr-answer-form" onSubmit={handleSubmit}>
                        <label className="mr-field-label" htmlFor="answer">
                            Your answer
                        </label>
                        <textarea
                            id="answer"
                            className="mr-answer-input"
                            placeholder={phase === 'idle' ? 'Click Go to start the timer' : 'Write your answer here...'}
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            disabled={phase === 'idle' || phase === 'submitted'}
                            rows={8}
                        />

                        <div className="mr-answer-tabs">
                            <span className="mr-tab mr-tab-active">Written</span>
                            <span className="mr-tab">Attachments</span>
                        </div>

                        <button
                            type="submit"
                            className="mr-btn mr-btn-primary mr-submit-btn"
                            disabled={phase === 'idle' || phase === 'submitted'}
                        >
                            {phase === 'submitted' ? 'Submitted' : 'Submit'}
                        </button>
                    </form>

                    <div className="mr-note">
                        {phase === 'uploadWindow' && (
                            <p className="mr-note-urgent">
                                Time's up — you have {formatTime(uploadSecondsLeft)} left to upload your answer or exit now.
                            </p>
                        )}
                        <p className="mr-note-sub">
                            Feedback and rubric scores become visible only once all attempters' papers are reviewed.
                        </p>
                    </div>

                </section>
            </div>
        </div>
    );
};

export default MockRoom;