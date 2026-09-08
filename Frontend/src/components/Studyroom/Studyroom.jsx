import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import './StudyRoom.css';

// Should match the same rooms your Dashboard renders.
// Swap for a real fetch (Supabase) once backend is ready.
const ROOMS_BY_ID = {
    r1: { examTag: 'UPSC', title: 'Prelims Revision Pact', isLive: true },
    r2: { examTag: 'GATE', title: 'CS Core Subjects', isLive: false },
    r3: { examTag: 'NEET', title: 'Biology Daily Grind', isLive: true },
    r4: { examTag: 'JEE', title: 'Physics Problem Set', isLive: false },
};

const MEMBERS = [
    { id: 1, initial: 'R', name: 'Rahul', status: 'studying' },
    { id: 2, initial: 'K', name: 'Kavya', status: 'studying' },
    { id: 3, initial: 'S', name: 'Sanjay', status: 'break' },
    { id: 4, initial: 'A', name: 'Anu', status: 'away' },
    { id: 5, initial: 'D', name: 'Divya', status: 'studying' },
];

const STATUS_LABEL = {
    studying: 'Studying',
    break: 'On Break',
    away: 'Away',
};

const STATUS_CYCLE = ['studying', 'break', 'away'];

const INITIAL_MESSAGES = [
    { id: 1, author: 'Kavya', text: 'Anyone started Polity ch.4 yet?' },
    { id: 2, author: 'Rahul', text: 'Yeah, halfway through. Notes in the doubt forum.' },
    { id: 3, author: 'You', text: 'On it after this pomodoro 🍅' },
];

const GOALS = [
    { id: 1, label: '2 hours — Prelims revision', done: true },
    { id: 2, label: 'Solve 1 mock doubt', done: false },
    { id: 3, label: '30 min current affairs', done: false },
];

const FOCUS_MINUTES = 25;

const StudyRoom = () => {
    const { id } = useParams();
    const room = ROOMS_BY_ID[id] || { examTag: 'UPSC', title: 'Study Room', isLive: false };

    const [myStatus, setMyStatus] = useState('studying');
    const [secondsLeft, setSecondsLeft] = useState(FOCUS_MINUTES * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [draft, setDraft] = useState('');
    const intervalRef = useRef(null);

    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setSecondsLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current);
                        setIsRunning(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const cycleStatus = () => {
        const nextIndex = (STATUS_CYCLE.indexOf(myStatus) + 1) % STATUS_CYCLE.length;
        setMyStatus(STATUS_CYCLE[nextIndex]);
    };

    const handleReset = () => {
        setIsRunning(false);
        setSecondsLeft(FOCUS_MINUTES * 60);
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        setMessages((prev) => [...prev, { id: Date.now(), author: 'You', text: draft.trim() }]);
        setDraft('');
    };

    const completedGoals = GOALS.filter((g) => g.done).length;
    const progressPercent = (FOCUS_MINUTES * 60 - secondsLeft) / (FOCUS_MINUTES * 60) * 100;

    return (
        <div className="sr-page">

            {/* Top bar */}
            <header className="sr-topbar">
                <div className="sr-room-info">
                    <span className="sr-badge">{room.examTag}</span>
                    <h1 className="sr-room-title">{room.title}</h1>
                    {room.isLive && (
                        <>
                            <span className="sr-live-dot" aria-hidden="true"></span>
                            <span className="sr-live-text">Live</span>
                        </>
                    )}
                </div>
                <div className="sr-topbar-actions">
                    <Link to="/dashboard" className="sr-link-btn">Leave room</Link>
                </div>
            </header>

            <div className="sr-body">

                {/* Left: presence panel */}
                <aside className="sr-panel sr-presence-panel">
                    <button className="sr-my-status" onClick={cycleStatus}>
                        <span className={`sr-status-dot sr-status-${myStatus}`}></span>
                        <span>You — {STATUS_LABEL[myStatus]}</span>
                    </button>

                    <p className="sr-panel-label">Members ({MEMBERS.length})</p>
                    <ul className="sr-member-list">
                        {MEMBERS.map((m) => (
                            <li key={m.id} className="sr-member">
                                <span className="sr-avatar">{m.initial}</span>
                                <div className="sr-member-meta">
                                    <span className="sr-member-name">{m.name}</span>
                                    <span className="sr-member-status">
                                        <span className={`sr-status-dot sr-status-${m.status}`}></span>
                                        {STATUS_LABEL[m.status]}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* Center: timer + goal + mock room */}
                <main className="sr-panel sr-focus-panel">
                    <div className="sr-timer-wrapper">
                        <svg className="sr-timer-ring" viewBox="0 0 120 120">
                            <circle className="sr-ring-bg" cx="60" cy="60" r="52" />
                            <circle
                                className="sr-ring-progress"
                                cx="60" cy="60" r="52"
                                style={{ strokeDashoffset: 327 - (327 * progressPercent) / 100 }}
                            />
                        </svg>
                        <div className="sr-timer-center">
                            <span className="sr-timer-value">{formatTime(secondsLeft)}</span>
                            <span className="sr-timer-caption">Focus session</span>
                        </div>
                    </div>

                    <div className="sr-timer-controls">
                        <button className="sr-btn sr-btn-outline" onClick={handleReset}>Reset</button>
                        <button
                            className="sr-btn sr-btn-primary"
                            onClick={() => setIsRunning((r) => !r)}
                        >
                            {isRunning ? 'Pause' : 'Start'}
                        </button>
                    </div>

                    <div className="sr-quick-row">
                        <Link to="/mock-room" className="sr-quick-card">
                            <span className="sr-quick-title">Create Mock Room</span>
                            <span className="sr-quick-sub">Timed practice + peer review</span>
                        </Link>
                        <div className="sr-quick-card sr-quick-status">
                            <span className="sr-quick-title">Active submissions</span>
                            <span className="sr-quick-sub">2 in progress</span>
                        </div>
                    </div>

                    <div className="sr-goal-strip">
                        <span className="sr-goal-strip-label">Today's goal — {completedGoals}/{GOALS.length}</span>
                        <div className="sr-goal-strip-items">
                            {GOALS.map((g) => (
                                <span key={g.id} className={`sr-goal-chip ${g.done ? 'sr-goal-done' : ''}`}>
                                    {g.done ? '✓' : '○'} {g.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </main>

                {/* Right: chat + doubt forum */}
                <aside className="sr-panel sr-side-panel">
                    <Link to="/doubt-forum" className="sr-doubt-entry">
                        <span className="sr-doubt-icon">💬</span>
                        <div>
                            <span className="sr-doubt-title">Doubt Forum</span>
                            <span className="sr-doubt-sub">3 open threads</span>
                        </div>
                    </Link>

                    <div className="sr-chat">
                        <p className="sr-panel-label">Room chat</p>
                        <div className="sr-chat-messages">
                            {messages.map((m) => (
                                <div
                                    key={m.id}
                                    className={`sr-chat-message ${m.author === 'You' ? 'sr-chat-mine' : ''}`}
                                >
                                    <span className="sr-chat-author">{m.author}</span>
                                    <span className="sr-chat-text">{m.text}</span>
                                </div>
                            ))}
                        </div>
                        <form className="sr-chat-form" onSubmit={sendMessage}>
                            <input
                                type="text"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Message the room..."
                                className="sr-chat-input"
                            />
                            <button type="submit" className="sr-chat-send">Send</button>
                        </form>
                    </div>
                </aside>

            </div>
        </div>
    );
};

export default StudyRoom;