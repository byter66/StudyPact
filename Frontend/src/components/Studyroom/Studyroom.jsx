import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    completePomodoroSession,
    createPomodoroSession,
    updatePomodoroSession,
} from '../../services/pomodoroApi';
import {
    getRoomById,
    getRoomMembers,
    joinRoom,
    leaveRoom,
} from '../../services/roomService';
import {
    createMockSessionForRoom,
    getActiveMockRooms,
    getAvailableMockPapers,
    joinMockRoom,
} from '../../services/mockExamService';
import { completeDailyGoal, getTodayDailyGoals } from '../../services/dailyGoalService';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import './StudyRoom.css';

const STATUS_LABEL = {
    studying: 'Studying',
    break: 'On Break',
    away: 'Away',
};

const STATUS_CYCLE = ['studying', 'break', 'away'];

const DEFAULT_FOCUS_MINUTES = 20;
const BREAK_MINUTES = 5;

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
    const [realtimeError, setRealtimeError] = useState('');
    const [memberError, setMemberError] = useState('');
    const [leaving, setLeaving] = useState(false);
    const [dailyGoals, setDailyGoals] = useState([]);
    const [dailyGoalsLoading, setDailyGoalsLoading] = useState(true);
    const [dailyGoalsError, setDailyGoalsError] = useState('');
    const [availablePapers, setAvailablePapers] = useState([]);
    const [activeMockRooms, setActiveMockRooms] = useState([]);
    const [activeMockRoomsLoading, setActiveMockRoomsLoading] = useState(true);
    const [activeMockRoomsError, setActiveMockRoomsError] = useState('');
    const [joiningMockSessionId, setJoiningMockSessionId] = useState('');
    const [paperSelectionLoading, setPaperSelectionLoading] = useState(false);
    const [selectedPaperId, setSelectedPaperId] = useState('');
    const [showPaperSelector, setShowPaperSelector] = useState(false);
    const [paperSelectionError, setPaperSelectionError] = useState('');
    const [creatingMockSession, setCreatingMockSession] = useState(false);
    const [paperSource, setPaperSource] = useState('dataset');
    const [paperSearch, setPaperSearch] = useState('');
    const [examDurationMinutes, setExamDurationMinutes] = useState('');
    const [customQuestionPaper, setCustomQuestionPaper] = useState(null);
    const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
    const [timerPhase, setTimerPhase] = useState('focus');

    const [myStatus, setMyStatus] = useState('studying');
    const [secondsLeft, setSecondsLeft] = useState(DEFAULT_FOCUS_MINUTES * 60);
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
    const chatMessagesRef = useRef(null);
    const chatWasNearBottomRef = useRef(true);
    const [isChatOpen, setIsChatOpen] = useState(false);

    useEffect(() => {
        const loadAvailablePapers = async () => {
            setPaperSelectionLoading(true);
            try {
                const papers = await getAvailableMockPapers();
                setAvailablePapers(Array.isArray(papers) ? papers : []);
                setSelectedPaperId((current) => current || '');
            } catch (error) {
                console.error('Unable to load mock papers:', error);
                setAvailablePapers([]);
                setPaperSelectionError(error.message || 'Unable to load available mock papers.');
            } finally {
                setPaperSelectionLoading(false);
            }
        };

        void loadAvailablePapers();
    }, []);

    useEffect(() => {
        if (!roomId || !userId) return undefined;

        let isCurrent = true;
        let requestInProgress = false;

        const refreshActiveMockRooms = async () => {
            if (requestInProgress) return;
            requestInProgress = true;
            try {
                const sessions = await getActiveMockRooms(roomId);
                if (!isCurrent) return;
                setActiveMockRooms(Array.isArray(sessions) ? sessions : []);
                setActiveMockRoomsError('');
            } catch (error) {
                if (!isCurrent) return;
                console.error('Unable to load active mock rooms:', error);
                setActiveMockRoomsError('Unable to load active mock rooms. Please try again.');
            } finally {
                requestInProgress = false;
                if (isCurrent) setActiveMockRoomsLoading(false);
            }
        };

        void refreshActiveMockRooms();
        const refreshInterval = window.setInterval(refreshActiveMockRooms, 5000);

        return () => {
            isCurrent = false;
            window.clearInterval(refreshInterval);
        };
    }, [roomId, userId]);

    useEffect(() => {
        if (!showPaperSelector) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !creatingMockSession) {
                setShowPaperSelector(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        document.body.classList.add('sr-modal-open');
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.classList.remove('sr-modal-open');
        };
    }, [showPaperSelector, creatingMockSession]);

    useEffect(() => {
        let isCurrent = true;
        let channel = null;
        let roomMembers = [];
        let memberRequestId = 0;
        let reconnectTimer = null;
        let reconnectAttempts = 0;
        let reconnecting = false;

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
                    console.error('Unable to load room members:', error);
                    setMemberError('Unable to load room members. Please try again.');
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

                const subscribeToRoom = () => {
                    if (!isCurrent || reconnecting) return;
                    reconnecting = true;
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
                            reconnectAttempts = 0;
                            reconnecting = false;
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
                                void refreshMembers();
                            }
                        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
                            presenceSubscribedRef.current = false;
                            reconnecting = false;
                            if (reconnectAttempts >= 3 || reconnectTimer) {
                                setRealtimeError('Realtime connection could not be restored. Please re-enter the room.');
                                return;
                            }
                            reconnectAttempts += 1;
                            setRealtimeError(`Realtime connection ${status.toLowerCase().replace('_', ' ')}. Reconnecting...`);
                            const failedChannel = channel;
                            reconnectTimer = window.setTimeout(async () => {
                                reconnectTimer = null;
                                if (!isCurrent) return;
                                await supabase.removeChannel(failedChannel);
                                if (channel === failedChannel) channel = null;
                                subscribeToRoom();
                            }, reconnectAttempts * 1000);
                        }
                    });
                };

                subscribeToRoom();
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
            if (reconnectTimer) window.clearTimeout(reconnectTimer);
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
        const element = chatMessagesRef.current;
        if (!element || !chatWasNearBottomRef.current) return;

        element.scrollTo({
            top: element.scrollHeight,
            behavior: messages.length > 1 ? 'smooth' : 'auto',
        });
    }, [messages]);

    useEffect(() => {
        let isCurrent = true;
        setDailyGoalsLoading(true);
        setDailyGoalsError('');

        getTodayDailyGoals()
            .then((goals) => {
                if (isCurrent) setDailyGoals(Array.isArray(goals) ? goals : []);
            })
            .catch((error) => {
                if (isCurrent) {
                    setDailyGoalsError("Unable to load today's goals.");
                    console.error('Unable to load daily goals in room:', error);
                }
            })
            .finally(() => {
                if (isCurrent) setDailyGoalsLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, []);

    const toggleDailyGoal = async (goal) => {
        setDailyGoalsError('');
        try {
            const updatedGoal = await completeDailyGoal(goal.id);
            setDailyGoals((currentGoals) =>
                currentGoals.map((currentGoal) =>
                    currentGoal.id === goal.id ? updatedGoal : currentGoal
                ),
            );
        } catch (error) {
            setDailyGoalsError("Unable to update today's goal. Please try again.");
            console.error('Unable to complete daily goal in room:', error);
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
            focusMinutes * 60,
            accumulatedFocusedSecondsRef.current + runningSeconds,
        );
    };

    useEffect(() => {
        if (!isRunning || (timerPhase === 'focus' && !startedAtRef.current)) {
            return undefined;
        }

        const updateCountdown = () => {
            if (timerPhase === 'break') {
                const remainingBreak = Math.max(0, secondsLeft - 1);
                setSecondsLeft(remainingBreak);
                if (remainingBreak === 0) {
                    setTimerPhase('focus');
                    setSecondsLeft(focusMinutes * 60);
                    setIsRunning(false);
                    startedAtRef.current = null;
                }
                return;
            }
            const elapsedSeconds = getFocusedDuration();
            const remainingSeconds = Math.max(
                0,
                focusMinutes * 60 - elapsedSeconds,
            );

            setSecondsLeft(remainingSeconds);

            if (remainingSeconds === 0) {
                clearInterval(intervalRef.current);
                startedAtRef.current = null;
                setTimerPhase('break');
                setSecondsLeft(BREAK_MINUTES * 60);
                setIsRunning(true);

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
                        focusMinutes * 60,
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
    }, [focusMinutes, isRunning, secondsLeft, timerPhase]);

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
                if (timerPhase === 'break') {
                    setIsRunning(false);
                    return;
                }
                const currentFocusedDuration = getFocusedDuration();
                setIsRunning(false);
                startedAtRef.current = null;
                setSecondsLeft(focusMinutes * 60 - currentFocusedDuration);
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
            if (timerPhase === 'break') {
                startedAtRef.current = Date.now();
                setIsRunning(true);
                return;
            }

            if (sessionStatus === 'paused' && currentSessionId) {
                await updatePomodoroSession(currentSessionId, {
                    status: 'active',
                    focusedDurationSeconds: currentFocusedDuration,
                });
            } else {
                const session = await createPomodoroSession(
                    roomId,
                    focusMinutes * 60,
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
            setSecondsLeft(focusMinutes * 60 - currentFocusedDuration);
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
            setTimerPhase('focus');
            setSecondsLeft(focusMinutes * 60);
        } catch (error) {
            setPomodoroError(error.message);
        } finally {
            operationInProgressRef.current = false;
        }
    };

    const handleCreateMockSession = async () => {
        if (!roomId) return;
        const duration = Number(examDurationMinutes);
        if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
            setPaperSelectionError('Enter an exam duration between 1 minute and 24 hours.');
            return;
        }
        if (paperSource === 'dataset' && !selectedPaperId) {
            setPaperSelectionError('Please select a dataset question paper.');
            return;
        }
        if (paperSource === 'custom' && !customQuestionPaper) {
            setPaperSelectionError('Please choose a PDF question paper to upload.');
            return;
        }

        setCreatingMockSession(true);
        setPaperSelectionError('');
        try {
            const response = await createMockSessionForRoom(
                roomId,
                paperSource === 'dataset' ? selectedPaperId : null,
                {
                    durationSeconds: duration * 60,
                    customPaper: paperSource === 'custom' ? customQuestionPaper : null,
                },
            );
            const sessionId = response?.session?.id || response?.data?.session?.id || response?.data?.id;
            if (!sessionId) {
                throw new Error('The mock session could not be created.');
            }
            setShowPaperSelector(false);
            navigate(`/mock-room/${sessionId}`);
        } catch (error) {
            console.error('Unable to create mock session:', error);
            setPaperSelectionError(error.message || 'Unable to create the mock session.');
        } finally {
            setCreatingMockSession(false);
        }
    };

    const handleJoinMockRoom = async (mockRoom) => {
        const sessionId = mockRoom?.session?.id;
        if (!roomId || !sessionId || joiningMockSessionId) return;

        setJoiningMockSessionId(sessionId);
        setActiveMockRoomsError('');
        try {
            await joinMockRoom(roomId, sessionId);
            navigate(`/mock-room/${sessionId}`);
        } catch (error) {
            console.error('Unable to join mock room:', error);
            setActiveMockRoomsError(error.message || 'Unable to join this mock room.');
            if (error.message?.includes('no longer joinable')) {
                setActiveMockRooms((current) => current.filter((item) => item.session.id !== sessionId));
            }
        } finally {
            setJoiningMockSessionId('');
        }
    };

    const handleCustomPaperChange = (event) => {
        const file = event.target.files?.[0] ?? null;
        setPaperSelectionError('');
        if (!file) {
            setCustomQuestionPaper(null);
            return;
        }
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            setCustomQuestionPaper(null);
            setPaperSelectionError('Question paper must be a PDF file.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setCustomQuestionPaper(null);
            setPaperSelectionError('Question paper PDF must be 10 MB or smaller.');
            return;
        }
        setCustomQuestionPaper(file);
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

    const completedGoals = dailyGoals.filter((goal) => goal.isCompleted).length;
    const progressPercent = (focusMinutes * 60 - secondsLeft) / (focusMinutes * 60) * 100;

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
                    <section className="sr-active-mock-rooms" aria-labelledby="sr-active-mock-rooms-title">
                        <h2 className="sr-panel-label" id="sr-active-mock-rooms-title">Active Mock Rooms</h2>
                        {activeMockRoomsError && (
                            <p className="sr-mock-rooms-error" role="alert">{activeMockRoomsError}</p>
                        )}
                        {activeMockRoomsLoading ? (
                            <p className="sr-mock-rooms-empty">Loading mock rooms...</p>
                        ) : activeMockRooms.length === 0 ? (
                            <p className="sr-mock-rooms-empty">No active mock rooms available.</p>
                        ) : (
                            <ul className="sr-mock-room-list">
                                {activeMockRooms.map((mockRoom) => (
                                    <li className="sr-mock-room-card" key={mockRoom.session.id}>
                                        <div className="sr-mock-room-details">
                                            <h3>{mockRoom.paper.title}</h3>
                                            <p>Created by: {mockRoom.creator.name}</p>
                                            <p>Paper: {mockRoom.paper.name}</p>
                                            <p>Status: Waiting to start</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="sr-mock-room-join"
                                            onClick={() => handleJoinMockRoom(mockRoom)}
                                            disabled={!mockRoom.joinable || Boolean(joiningMockSessionId)}
                                        >
                                            {joiningMockSessionId === mockRoom.session.id ? 'Joining...' : 'Join'}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
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
                            <span className="sr-timer-caption">{timerPhase === 'break' ? 'Break' : 'Focus session'}</span>
                        </div>
                    </div>

                    <div className="sr-timer-controls">
                        <label className="sr-focus-duration">
                            Focus
                            <input
                                type="number"
                                min="1"
                                max="120"
                                step="1"
                                value={focusMinutes}
                                onChange={(event) => {
                                    if (!isRunning && timerPhase === 'focus') {
                                        setFocusMinutes(Math.max(1, Math.min(120, Number(event.target.value) || DEFAULT_FOCUS_MINUTES)));
                                        setSecondsLeft(Math.max(1, Math.min(120, Number(event.target.value) || DEFAULT_FOCUS_MINUTES)) * 60);
                                    }
                                }}
                                disabled={isRunning || timerPhase === 'break'}
                            />
                            min
                        </label>
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
                        <button
                            type="button"
                            className="sr-quick-card sr-quick-button"
                            onClick={() => {
                                setPaperSelectionError('');
                                setSelectedPaperId('');
                                setPaperSource('dataset');
                                setPaperSearch('');
                                setExamDurationMinutes('');
                                setCustomQuestionPaper(null);
                                setShowPaperSelector(true);
                            }}
                        >
                            <span className="sr-quick-title">Create Mock Room</span>
                            <span className="sr-quick-sub">Timed practice + peer review</span>
                        </button>
                    </div>

                    <div className="sr-goal-strip">
                        <span className="sr-goal-strip-label">
                            My tasks — {completedGoals}/{dailyGoals.length} complete
                        </span>
                        {dailyGoalsError && <p className="sr-task-error" role="alert">{dailyGoalsError}</p>}
                        <div className="sr-goal-strip-items">
                            {dailyGoalsLoading ? (
                                <span className="sr-goal-chip">Loading goals...</span>
                            ) : dailyGoals.length === 0 ? (
                                <span className="sr-goal-chip">No daily goals set for today.</span>
                            ) : dailyGoals.map((goal) => (
                                <label
                                    key={goal.id}
                                    className={`sr-goal-chip sr-goal-task ${goal.isCompleted ? 'sr-goal-done' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={goal.isCompleted}
                                        onChange={() => toggleDailyGoal(goal)}
                                        disabled={goal.isCompleted}
                                    />
                                    {goal.description}
                                </label>
                            ))}
                        </div>
                    </div>
                </main>

                {/* Right: chat + doubt forum */}
                <aside className="sr-panel sr-side-panel">
                    <Link to={`/doubt-forum/${roomId}`} className="sr-doubt-entry sr-floating-forum" aria-label="Open Doubt Forum">
                        <span className="sr-doubt-icon">💬</span>
                        <div>
                            <span className="sr-doubt-title">Doubt Forum</span>
                            <span className="sr-doubt-sub">3 open threads</span>
                        </div>
                    </Link>

                    <button
                        type="button"
                        className="sr-chat-toggle"
                        aria-expanded={isChatOpen}
                        onClick={() => setIsChatOpen((open) => !open)}
                    >
                        <span aria-hidden="true">💬</span>
                        {isChatOpen ? 'Hide room chat' : 'Open room chat'}
                    </button>
                    {isChatOpen && <div className="sr-chat">
                        <div className="sr-chat-heading">
                            <p className="sr-panel-label">Room chat</p>
                            <button type="button" className="sr-chat-close" onClick={() => setIsChatOpen(false)} aria-label="Close room chat">×</button>
                        </div>
                        <div
                            ref={chatMessagesRef}
                            className="sr-chat-messages"
                            onScroll={(event) => {
                                const element = event.currentTarget;
                                const distanceFromBottom =
                                    element.scrollHeight
                                    - element.scrollTop
                                    - element.clientHeight;
                                chatWasNearBottomRef.current = distanceFromBottom <= 100;
                            }}
                        >
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
                    </div>}
                </aside>

            </div>

            {showPaperSelector && (
                <div
                    className="sr-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !creatingMockSession) {
                            setShowPaperSelector(false);
                        }
                    }}
                >
                    <section
                        className="sr-mock-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sr-mock-modal-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header className="sr-mock-modal-header">
                            <div>
                                <p className="sr-modal-eyebrow">Study room mock exam</p>
                                <h2 id="sr-mock-modal-title">Create Mock Exam</h2>
                            </div>
                            <button
                                type="button"
                                className="sr-modal-close"
                                aria-label="Close dialog"
                                onClick={() => setShowPaperSelector(false)}
                                disabled={creatingMockSession}
                            >
                                ×
                            </button>
                        </header>

                        <div className="sr-mock-modal-content">
                            <fieldset className="sr-source-choice">
                                <legend>Question paper source</legend>
                                <label>
                                    <input
                                        type="radio"
                                        name="paper-source"
                                        value="dataset"
                                        checked={paperSource === 'dataset'}
                                        onChange={() => {
                                            setPaperSource('dataset');
                                            setPaperSelectionError('');
                                        }}
                                        disabled={creatingMockSession}
                                    />
                                    Choose from Dataset
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="paper-source"
                                        value="custom"
                                        checked={paperSource === 'custom'}
                                        onChange={() => {
                                            setPaperSource('custom');
                                            setPaperSelectionError('');
                                        }}
                                        disabled={creatingMockSession}
                                    />
                                    Upload Custom Paper
                                </label>
                            </fieldset>

                            {paperSource === 'dataset' ? (
                                <div className="sr-dataset-picker">
                                    <label className="sr-paper-select-label" htmlFor="mock-paper-search">
                                        Choose Question Paper
                                        <input
                                            id="mock-paper-search"
                                            className="sr-paper-select"
                                            type="search"
                                            placeholder="Search exam, year, paper or subject"
                                            value={paperSearch}
                                            onChange={(event) => setPaperSearch(event.target.value)}
                                            disabled={creatingMockSession}
                                        />
                                    </label>
                                    {paperSelectionLoading ? (
                                        <p className="sr-paper-empty" role="status">Loading available papers...</p>
                                    ) : paperSelectionError ? null : availablePapers.length === 0 ? (
                                        <p className="sr-paper-empty">No question papers are currently available.</p>
                                    ) : (
                                        <div className="sr-dataset-paper-list" role="listbox" aria-label="Dataset question papers">
                                            {availablePapers
                                                .filter((paper) => `${paper.examTag} ${paper.examYear ?? ''} ${paper.paperName || paper.title} ${paper.subject} ${paper.evaluationType}`
                                                    .toLowerCase()
                                                    .includes(paperSearch.trim().toLowerCase()))
                                                .map((paper) => (
                                                    <button
                                                        key={paper.id}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={selectedPaperId === paper.id}
                                                        className={`sr-dataset-paper-option ${selectedPaperId === paper.id ? 'sr-dataset-paper-option-selected' : ''}`}
                                                        onClick={() => {
                                                            setSelectedPaperId(paper.id);
                                                            if (paper.durationMinutes) setExamDurationMinutes(String(paper.durationMinutes));
                                                        }}
                                                        disabled={creatingMockSession}
                                                    >
                                                        <span className="sr-dataset-paper-name">{paper.examTag} {paper.examYear ?? ''} · {paper.paperName || paper.title}</span>
                                                        <span className="sr-dataset-paper-meta">
                                                            {paper.subject || 'Subject not provided'} · {paper.questions?.length ?? 0} questions
                                                            {paper.evaluationType ? ` · ${paper.evaluationType}` : ''}
                                                        </span>
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                    {selectedPaperId && (() => {
                                        const paper = availablePapers.find((item) => item.id === selectedPaperId);
                                        if (!paper) return null;
                                        return (
                                            <div className="sr-selected-paper" aria-live="polite">
                                                <strong>{paper.examTag} {paper.examYear ?? ''}</strong>
                                                <span>{paper.paperName || paper.title} · {paper.subject || 'Subject not provided'}</span>
                                                <span>Evaluation: {paper.evaluationType || 'Not provided'}</span>
                                                <span>{paper.totalMarks ? `${paper.totalMarks} marks` : 'Total marks not provided by source'}</span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="sr-custom-paper-picker">
                                    <label className="sr-custom-paper-label" htmlFor="custom-question-paper">
                                        Upload Question Paper
                                        <input
                                            id="custom-question-paper"
                                            type="file"
                                            accept="application/pdf,.pdf"
                                            onChange={handleCustomPaperChange}
                                            disabled={creatingMockSession}
                                        />
                                    </label>
                                    <p>This PDF is the question paper shown to everyone in this mock room. It is not your answer script.</p>
                                    {customQuestionPaper && (
                                        <p className="sr-custom-paper-file" role="status">
                                            Selected: {customQuestionPaper.name} ({Math.ceil(customQuestionPaper.size / 1024)} KB)
                                        </p>
                                    )}
                                </div>
                            )}

                            <label className="sr-paper-select-label" htmlFor="mock-exam-duration">
                                Duration (minutes)
                                <select
                                    className="sr-paper-select"
                                    value={['15', '30', '45', '60', '90'].includes(examDurationMinutes) ? examDurationMinutes : 'custom'}
                                    onChange={(event) => {
                                        if (event.target.value !== 'custom') setExamDurationMinutes(event.target.value);
                                    }}
                                    disabled={creatingMockSession}
                                >
                                    <option value="15">15 minutes</option>
                                    <option value="30">30 minutes</option>
                                    <option value="45">45 minutes</option>
                                    <option value="60">60 minutes</option>
                                    <option value="90">90 minutes</option>
                                    <option value="custom">Custom</option>
                                </select>
                                <input
                                    id="mock-exam-duration"
                                    className="sr-paper-select sr-duration-input"
                                    type="number"
                                    min="1"
                                    max="1440"
                                    step="1"
                                    placeholder="Enter duration"
                                    value={examDurationMinutes}
                                    onChange={(event) => setExamDurationMinutes(event.target.value)}
                                    disabled={creatingMockSession}
                                />
                            </label>
                            <p className="sr-duration-note">The exam stays in draft until the creator clicks Start Exam.</p>
                            {paperSelectionError && <p className="sr-paper-error" role="alert">{paperSelectionError}</p>}
                        </div>

                        <footer className="sr-paper-actions sr-modal-actions">
                            <button
                                type="button"
                                className="sr-btn sr-btn-outline"
                                onClick={() => setShowPaperSelector(false)}
                                disabled={creatingMockSession}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="sr-btn sr-btn-primary"
                                disabled={
                                    creatingMockSession
                                    || paperSelectionLoading && paperSource === 'dataset'
                                    || !Number.isInteger(Number(examDurationMinutes))
                                    || Number(examDurationMinutes) < 1
                                    || Number(examDurationMinutes) > 1440
                                    || paperSource === 'dataset' && (!selectedPaperId || !availablePapers.some((paper) => paper.id === selectedPaperId))
                                    || paperSource === 'custom' && !customQuestionPaper
                                }
                                onClick={handleCreateMockSession}
                            >
                                {creatingMockSession ? 'Creating...' : 'Create Mock Exam'}
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </div>
    );
};

export default StudyRoom;