import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    completePomodoroSession,
    createPomodoroSession,
    updatePomodoroSession,
} from '../../services/pomodoroApi';
import {
    getRoomById,
    getRoomLeaderboard,
    getRoomMembers,
    joinRoom,
    leaveRoom,
} from '../../services/roomService';
import { getUserTasks, updateUserTask } from '../../services/userTaskService';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import './StudyRoom.css';

const STATUS_LABEL = {
    studying: 'Studying',
    break: 'On Break',
    away: 'Away',
};

const STATUS_CYCLE = ['studying', 'break', 'away'];

const FOCUS_MINUTES = 25;

const createMessageId = () => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const StudyRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id;
    const presenceDisplayName = user?.full_name || user?.email || 'StudyPact member';
    const [room, setRoom] = useState(null);
    const [roomLoading, setRoomLoading] = useState(true);
    const [roomError, setRoomError] = useState('');
    const [members, setMembers] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [leaderboardLoading, setLeaderboardLoading] = useState(false);
    const [leaderboardError, setLeaderboardError] = useState('');
    const [realtimeError, setRealtimeError] = useState('');
    const [memberError, setMemberError] = useState('');
    const [leaving, setLeaving] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [tasksError, setTasksError] = useState('');

    const [myStatus, setMyStatus] = useState('studying');
    const [secondsLeft, setSecondsLeft] = useState(FOCUS_MINUTES * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [messages, setMessages] = useState([]);
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
    const presenceChannelRef = useRef(null);
    const presenceSubscribedRef = useRef(false);
    const myStatusRef = useRef(myStatus);
    myStatusRef.current = myStatus;

    useEffect(() => {
        let isCurrent = true;
        let channel = null;
        let roomMembers = [];
        let memberRequestId = 0;

        const syncPresence = () => {
            if (!isCurrent) return;

            const activeMembers = new Map();
            if (channel) {
                Object.values(channel.presenceState()).flat().forEach((presence) => {
                    if (!presence.user_id || activeMembers.has(presence.user_id)) return;
                    activeMembers.set(presence.user_id, {
                        id: presence.user_id,
                        name: presence.display_name || 'StudyPact member',
                        status: STATUS_CYCLE.includes(presence.status)
                            ? presence.status
                            : 'studying',
                    });
                });
            }

            const membersById = new Map(
                roomMembers.map((member) => [
                    member.id,
                    activeMembers.get(member.id) || member,
                ]),
            );
            activeMembers.forEach((member, id) => membersById.set(id, member));
            setMembers([...membersById.values()]);
        };

        const refreshMembers = async () => {
            if (!isCurrent) return;
            const requestId = ++memberRequestId;
            try {
                const fetchedMembers = await getRoomMembers(roomId);
                if (!isCurrent || requestId !== memberRequestId) return;

                setMemberError('');
                roomMembers = fetchedMembers.map((member) => ({
                    id: member.userId,
                    name: member.displayName,
                    status: 'away',
                }));
                syncPresence();
            } catch (error) {
                if (isCurrent) {
                    setMemberError(
                        error.message
                            ? `Unable to load room members: ${error.message}`
                            : 'Unable to load room members.',
                    );
                }
            }
        };

        const handlePresenceChange = () => {
            if (!isCurrent) return;
            syncPresence();
            void refreshMembers();
        };

        const loadRoom = async () => {
            setRoomLoading(true);
            setRoomError('');

            try {
                const fetchedRoom = await getRoomById(roomId);
                if (!isCurrent) return;
                await joinRoom(roomId);
                if (!isCurrent) return;

                setRoom({
                    ...fetchedRoom,
                    examTag: fetchedRoom.examCategory,
                    title: fetchedRoom.name,
                    isLive: true,
                });

                await refreshMembers();
                if (!isCurrent) return;

                if (!supabase || !userId) {
                    setRealtimeError('Realtime is not configured for this environment.');
                    return;
                }

                channel = supabase.channel(`room-presence:${roomId}`, {
                    config: { presence: { key: userId } },
                });
                presenceChannelRef.current = channel;
                presenceSubscribedRef.current = false;

                channel
                    .on('presence', { event: 'sync' }, handlePresenceChange)
                    .on('presence', { event: 'join' }, handlePresenceChange)
                    .on('presence', { event: 'leave' }, handlePresenceChange)
                    .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
                        if (
                            !isCurrent ||
                            !payload?.id ||
                            !payload.user_id ||
                            !payload.text
                        ) {
                            return;
                        }

                        setMessages((previousMessages) => {
                            if (previousMessages.some((message) => message.id === payload.id)) {
                                return previousMessages;
                            }

                            return [
                                ...previousMessages,
                                {
                                    id: payload.id,
                                    author: payload.user_id === userId
                                        ? 'You'
                                        : payload.display_name || 'StudyPact member',
                                    text: payload.text,
                                },
                            ];
                        });
                    });

                channel.subscribe(async (status) => {
                    if (!isCurrent) return;

                    if (status === 'SUBSCRIBED') {
                        setRealtimeError('');
                        presenceSubscribedRef.current = true;
                        const { error } = await channel.track({
                            user_id: userId,
                            display_name: presenceDisplayName,
                            status: myStatusRef.current,
                        });
                        if (!isCurrent) return;
                        if (error) {
                            setRealtimeError('Unable to announce your presence. Please retry.');
                        } else {
                            syncPresence();
                        }
                    } else if (
                        status === 'CHANNEL_ERROR' ||
                        status === 'TIMED_OUT' ||
                        status === 'CLOSED'
                    ) {
                        setRealtimeError(
                            status === 'CLOSED'
                                ? 'Realtime channel closed. Re-enter the room to reconnect.'
                                : `Realtime connection ${status.toLowerCase().replace('_', ' ')}. Waiting for automatic retry.`,
                        );
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
            presenceSubscribedRef.current = false;
            presenceChannelRef.current = null;
            if (channel) {
                supabase?.removeChannel(channel);
            }
        };
    }, [roomId, userId, presenceDisplayName]);

    useEffect(() => {
        const channel = presenceChannelRef.current;
        if (!channel || !presenceSubscribedRef.current) return undefined;

        let isCurrent = true;
        const updatePresenceStatus = async () => {
            try {
                const { error } = await channel.track({
                    user_id: userId,
                    display_name: presenceDisplayName,
                    status: myStatus,
                });
                if (isCurrent && error) {
                    setRealtimeError('Unable to update your presence status. Please retry.');
                }
            } catch (error) {
                if (isCurrent) {
                    setRealtimeError(error.message || 'Unable to update your presence status. Please retry.');
                }
            }
        };

        void updatePresenceStatus();

        return () => {
            isCurrent = false;
        };
    }, [myStatus, presenceDisplayName, userId]);

    useEffect(() => {
        if (!room) return undefined;

        let isCurrent = true;
        setLeaderboardLoading(true);
        setLeaderboardError('');

        getRoomLeaderboard(roomId)
            .then((entries) => {
                if (isCurrent) setLeaderboard(entries);
            })
            .catch((error) => {
                if (isCurrent) {
                    setLeaderboardError(error.message || 'Unable to load leaderboard.');
                }
            })
            .finally(() => {
                if (isCurrent) setLeaderboardLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [room, roomId]);

    useEffect(() => {
        if (!room) return undefined;

        let isCurrent = true;
        setTasksLoading(true);
        setTasksError('');

        getUserTasks()
            .then((userTasks) => {
                if (isCurrent) setTasks(userTasks);
            })
            .catch((error) => {
                if (isCurrent) {
                    setTasksError('Unable to load your tasks. Please retry from the dashboard.');
                    console.error('Unable to load user tasks in room:', error);
                }
            })
            .finally(() => {
                if (isCurrent) setTasksLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [room]);

    const toggleTask = async (task) => {
        setTasksError('');
        try {
            const updatedTask = await updateUserTask(task.id, {
                completed: !task.completed,
            });
            setTasks((currentTasks) =>
                currentTasks.map((currentTask) =>
                    currentTask.id === task.id ? updatedTask : currentTask
                ),
            );
        } catch (error) {
            setTasksError('Unable to update this task. Please try again.');
            console.error('Unable to update user task in room:', error);
        }
    };

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

    const sendMessage = async (e) => {
        e.preventDefault();
        const text = draft.trim();
        const channel = presenceChannelRef.current;
        if (!text || !channel || !presenceSubscribedRef.current) return;

        const message = {
            id: createMessageId(),
            user_id: userId,
            display_name: presenceDisplayName,
            text,
            created_at: new Date().toISOString(),
        };

        setMessages((previousMessages) => [
            ...previousMessages,
            { id: message.id, author: 'You', text: message.text },
        ]);
        setDraft('');

        try {
            const sendStatus = await channel.send({
                type: 'broadcast',
                event: 'chat-message',
                payload: message,
            });
            if (sendStatus !== 'ok') {
                console.error('Unable to send room chat message:', sendStatus);
            }
        } catch (error) {
            console.error('Unable to send room chat message:', error);
        }
    };

    const completedTasks = tasks.filter((task) => task.completed).length;
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
                    {memberError && <p className="sr-realtime-error" role="alert">{memberError}</p>}
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
                    <div className="sr-leaderboard">
                        <p className="sr-panel-label">Leaderboard</p>
                        {leaderboardLoading && (
                            <p className="sr-leaderboard-message">Loading leaderboard...</p>
                        )}
                        {leaderboardError && (
                            <p className="sr-leaderboard-message" role="alert">
                                {leaderboardError}
                            </p>
                        )}
                        {!leaderboardLoading && !leaderboardError && (
                            <ol className="sr-leaderboard-list">
                                {leaderboard.map((entry, index) => (
                                    <li
                                        key={entry.userId}
                                        className={`sr-leaderboard-item ${
                                            entry.userId === user?.id ? 'sr-leaderboard-you' : ''
                                        }`}
                                    >
                                        <span className="sr-leaderboard-rank">
                                            {index + 1}
                                        </span>
                                        <span className="sr-leaderboard-name">{entry.name}</span>
                                        <span className="sr-leaderboard-streak">
                                            🔥 {entry.streak}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
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
                        <span className="sr-goal-strip-label">
                            My tasks — {completedTasks}/{tasks.length} complete
                        </span>
                        {tasksError && <p className="sr-task-error" role="alert">{tasksError}</p>}
                        <div className="sr-goal-strip-items">
                            {tasksLoading ? (
                                <span className="sr-goal-chip">Loading tasks...</span>
                            ) : tasks.length === 0 ? (
                                <span className="sr-goal-chip">No tasks yet</span>
                            ) : tasks.map((task) => (
                                <label
                                    key={task.id}
                                    className={`sr-goal-chip sr-goal-task ${task.completed ? 'sr-goal-done' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={task.completed}
                                        onChange={() => toggleTask(task)}
                                    />
                                    {task.title}
                                </label>
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