import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    completePomodoroSession,
    createPomodoroSession,
    updatePomodoroSession,
} from '../../services/pomodoroApi';
import { getRoomById, joinRoom, leaveRoom } from '../../services/roomService';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import './StudyRoom.css';

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
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [room, setRoom] = useState(null);
    const [roomLoading, setRoomLoading] = useState(true);
    const [roomError, setRoomError] = useState('');
    const [members, setMembers] = useState([]);
    const [realtimeError, setRealtimeError] = useState('');
    const [leaving, setLeaving] = useState(false);

    const [myStatus, setMyStatus] = useState('studying');
    const [secondsLeft, setSecondsLeft] = useState(FOCUS_MINUTES * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [draft, setDraft] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [sessionStatus, setSessionStatus] = useState(null);
    const [pomodoroError, setPomodoroError] = useState('');
    const intervalRef = useRef(null);
    const sessionIdRef = useRef(null);
    const accumulatedFocusedSecondsRef = useRef(0);
    const startedAtRef = useRef(null);
    const operationInProgressRef = useRef(false);
    const completionAttemptedRef = useRef(false);

    useEffect(() => {
        let isCurrent = true;
        let channel = null;

        const loadRoom = async () => {
            setRoomLoading(true);
            setRoomError('');

            try {
                const fetchedRoom = await getRoomById(roomId);
                await joinRoom(roomId);
                if (!isCurrent) return;

                setRoom({
                    ...fetchedRoom,
                    examTag: fetchedRoom.examCategory,
                    title: fetchedRoom.name,
                    isLive: true,
                });

                if (!supabase || !user?.id) {
                    setRealtimeError('Realtime is not configured for this environment.');
                    return;
                }

                channel = supabase.channel(`room-presence:${roomId}`, {
                    config: { presence: { key: user.id } },
                });

                const syncPresence = () => {
                    const seen = new Set();
                    const activeMembers = [];
                    Object.values(channel.presenceState()).flat().forEach((presence) => {
                        if (!presence.user_id || seen.has(presence.user_id)) return;
                        seen.add(presence.user_id);
                        activeMembers.push({
                            id: presence.user_id,
                            name: presence.display_name || 'StudyPact member',
                            status: 'studying',
                        });
                    });
                    setMembers(activeMembers);
                };

                channel
                    .on('presence', { event: 'sync' }, syncPresence)
                    .on('presence', { event: 'join' }, syncPresence)
                    .on('presence', { event: 'leave' }, syncPresence);

                channel.subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        const { error } = await channel.track({
                            user_id: user.id,
                            display_name: user.full_name || user.email || 'StudyPact member',
                        });
                        if (error && isCurrent) {
                            setRealtimeError('Unable to announce your presence. Please retry.');
                        }
                        syncPresence();
                    } else if (status === 'CHANNEL_ERROR' && isCurrent) {
                        setRealtimeError('Realtime connection failed. Refresh to retry.');
                    }
                });
            } catch (error) {
                if (isCurrent) {
                    setRoomError(error.message || 'Unable to load this room.');
                }
            } finally {
                if (isCurrent) {
                    setRoomLoading(false);
                }
            }
        };

        if (!roomId) {
            setRoomError('A room ID is required.');
            setRoomLoading(false);
        } else {
            loadRoom();
        }

        return () => {
            isCurrent = false;
            if (channel) {
                supabase?.removeChannel(channel);
            }
        };
    }, [roomId, user]);

    const handleLeaveRoom = async () => {
        if (leaving) return;
        setLeaving(true);
        try {
            await leaveRoom(roomId);
            navigate('/dashboard');
        } catch (error) {
            setRoomError(error.message || 'Unable to leave this room. Please try again.');
            setLeaving(false);
        }
    };

    const getFocusedDuration = () => {
        const runningSeconds = startedAtRef.current
            ? Math.floor((Date.now() - startedAtRef.current) / 1000)
            : 0;

        return Math.min(
            FOCUS_MINUTES * 60,
            accumulatedFocusedSecondsRef.current + runningSeconds,
        );
    };

    useEffect(() => {
        if (!isRunning || !startedAtRef.current) {
            return undefined;
        }

        const updateCountdown = () => {
            const elapsedSeconds = getFocusedDuration();
            const remainingSeconds = Math.max(
                0,
                FOCUS_MINUTES * 60 - elapsedSeconds,
            );

            setSecondsLeft(remainingSeconds);

            if (remainingSeconds === 0) {
                clearInterval(intervalRef.current);
                startedAtRef.current = null;
                setIsRunning(false);

                const currentSessionId = sessionIdRef.current;
                if (
                    currentSessionId &&
                    !completionAttemptedRef.current &&
                    !operationInProgressRef.current
                ) {
                    completionAttemptedRef.current = true;
                    operationInProgressRef.current = true;
                    completePomodoroSession(
                        currentSessionId,
                        FOCUS_MINUTES * 60,
                    )
                        .then(() => {
                            setSessionStatus('completed');
                        })
                        .catch((error) => {
                            completionAttemptedRef.current = false;
                            setPomodoroError(error.message);
                        })
                        .finally(() => {
                            operationInProgressRef.current = false;
                        });
                }
            }
        };

        updateCountdown();
        intervalRef.current = setInterval(updateCountdown, 1000);

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

    const handleStartPause = async () => {
        if (operationInProgressRef.current) return;

        operationInProgressRef.current = true;
        setPomodoroError('');

        try {
            if (isRunning) {
                const currentFocusedDuration = getFocusedDuration();
                setIsRunning(false);
                startedAtRef.current = null;
                setSecondsLeft(FOCUS_MINUTES * 60 - currentFocusedDuration);
                setSessionStatus('paused');

                await updatePomodoroSession(sessionIdRef.current, {
                    status: 'paused',
                    focusedDurationSeconds: currentFocusedDuration,
                });

                accumulatedFocusedSecondsRef.current = currentFocusedDuration;
                return;
            }

            let currentSessionId = sessionIdRef.current;
            let currentFocusedDuration = accumulatedFocusedSecondsRef.current;

            if (sessionStatus === 'paused' && currentSessionId) {
                await updatePomodoroSession(currentSessionId, {
                    status: 'active',
                    focusedDurationSeconds: currentFocusedDuration,
                });
            } else {
                const session = await createPomodoroSession(
                    roomId,
                    FOCUS_MINUTES * 60,
                );
                currentSessionId = session.id;
                setSessionId(currentSessionId);
                sessionIdRef.current = currentSessionId;
                currentFocusedDuration = 0;
                accumulatedFocusedSecondsRef.current = 0;
                completionAttemptedRef.current = false;
            }

            startedAtRef.current = Date.now();
            accumulatedFocusedSecondsRef.current = currentFocusedDuration;
            setSecondsLeft(FOCUS_MINUTES * 60 - currentFocusedDuration);
            setSessionStatus('active');
            setIsRunning(true);
        } catch (error) {
            setPomodoroError(error.message);
        } finally {
            operationInProgressRef.current = false;
        }
    };

    const handleReset = async () => {
        if (operationInProgressRef.current) return;

        operationInProgressRef.current = true;
        setPomodoroError('');
        setIsRunning(false);
        clearInterval(intervalRef.current);
        const currentFocusedDuration = getFocusedDuration();
        startedAtRef.current = null;

        try {
            const currentSessionId = sessionIdRef.current || sessionId;
            if (currentSessionId) {
                await updatePomodoroSession(currentSessionId, {
                    status: 'cancelled',
                    focusedDurationSeconds: currentFocusedDuration,
                });
            }

            setSessionId(null);
            sessionIdRef.current = null;
            setSessionStatus(null);
            accumulatedFocusedSecondsRef.current = 0;
            completionAttemptedRef.current = false;
            setSecondsLeft(FOCUS_MINUTES * 60);
        } catch (error) {
            setPomodoroError(error.message);
        } finally {
            operationInProgressRef.current = false;
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        setMessages((prev) => [...prev, { id: Date.now(), author: 'You', text: draft.trim() }]);
        setDraft('');
    };

    const completedGoals = GOALS.filter((g) => g.done).length;
    const progressPercent = (FOCUS_MINUTES * 60 - secondsLeft) / (FOCUS_MINUTES * 60) * 100;

    if (roomLoading) {
        return (
            <div className="sr-page">
                <p role="status">Loading room...</p>
            </div>
        );
    }

    if (roomError || !room) {
        return (
            <div className="sr-page">
                <p role="alert">{roomError || 'Room not found.'}</p>
                <Link to="/dashboard" className="sr-link-btn">Back to dashboard</Link>
            </div>
        );
    }

    return (
        <div className="sr-page">

            {/* Top bar */}
            <header className="sr-topbar">
                <div className="sr-room-info">
                    <span className="sr-badge">{room.examTag}</span>
                    <h1 className="sr-room-title">{room.title}</h1>
                    <span className="sr-room-code">Code: {room.roomCode}</span>
                    {room.isLive && (
                        <>
                            <span className="sr-live-dot" aria-hidden="true"></span>
                            <span className="sr-live-text">Live</span>
                        </>
                    )}
                </div>
                <div className="sr-topbar-actions">
                    <button
                        type="button"
                        className="sr-link-btn"
                        onClick={handleLeaveRoom}
                        disabled={leaving}
                    >
                        {leaving ? 'Leaving...' : 'Leave room'}
                    </button>
                </div>
            </header>

            <div className="sr-body">

                {/* Left: presence panel */}
                <aside className="sr-panel sr-presence-panel">
                    <button className="sr-my-status" onClick={cycleStatus}>
                        <span className={`sr-status-dot sr-status-${myStatus}`}></span>
                        <span>You — {STATUS_LABEL[myStatus]}</span>
                    </button>

                    <p className="sr-panel-label">Members ({members.length})</p>
                    {realtimeError && <p className="sr-realtime-error" role="alert">{realtimeError}</p>}
                    <ul className="sr-member-list">
                        {members.map((m) => (
                            <li key={m.id} className="sr-member">
                                <span className="sr-avatar">{m.name.charAt(0).toUpperCase()}</span>
                                <div className="sr-member-meta">
                                    <span className="sr-member-name">
                                        {m.name}{m.id === user?.id ? ' (You)' : ''}
                                    </span>
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
                            onClick={handleStartPause}
                        >
                            {isRunning ? 'Pause' : 'Start'}
                        </button>
                    </div>
                    {pomodoroError && (
                        <span
                            role="alert"
                            style={{ color: '#a8511f', fontSize: '12px', marginBottom: '12px' }}
                        >
                            {pomodoroError}
                        </span>
                    )}

                    <div className="sr-quick-row">
                        <Link to={`/mock-room/${roomId}`} className="sr-quick-card">
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
                    <Link to={`/doubt-forum/${roomId}`} className="sr-doubt-entry">
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