import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    completePomodoroSession,
    createPomodoroSession,
    getRoomPomodoroSessions,
    updatePomodoroSession,
} from '../../services/pomodoroApi';
import { getDoubts } from '../../services/doubtService';
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
import Clippy from '../common/Clippy';
import { X, Check } from 'lucide-react';
import './Studyroom.css';

const STATUS_LABEL = {
    studying: 'Studying',
    break: 'On Break',
    away: 'Away',
};

const STATUS_CYCLE = ['studying', 'break', 'away'];

const DEFAULT_STUDY_MINUTES = 20;
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
    const [copiedCode, setCopiedCode] = useState(false);

    const handleCopyCode = () => {
        if (!room?.roomCode) return;
        navigator.clipboard?.writeText(room.roomCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };
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
    const [customQuestionPaper, setCustomQuestionPaper] = useState(null);

    const [myStatus, setMyStatus] = useState('studying');
    const [studyMinutes, setStudyMinutes] = useState(DEFAULT_STUDY_MINUTES);
    const [timerPhase, setTimerPhase] = useState('study');
    const [secondsLeft, setSecondsLeft] = useState(DEFAULT_STUDY_MINUTES * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
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
    const [unreadReplyCount, setUnreadReplyCount] = useState(0);
    const myDoubtIdsRef = useRef(new Set());
    const seenReplyIdsRef = useRef(new Set());
    const studyRoomPageRef = useRef(null);

    const requestBrowserFullscreen = () => {
        try {
            const request = studyRoomPageRef.current?.requestFullscreen?.();
            request?.catch(() => {});
        } catch {
            // Focus Mode remains available through its page-scoped styles.
        }
    };

    const enterFocusMode = () => {
        setIsFocusMode(true);
    };

    const exitFocusMode = () => {
        setIsFocusMode(false);
        if (document.fullscreenElement && document.exitFullscreen) {
            try {
                document.exitFullscreen().catch(() => {});
            } catch {
                // Leaving the room's CSS focus view does not depend on browser fullscreen.
            }
        }
    };

    // Focus sessions always return to the regular room layout when the automatic break starts.
    useEffect(() => {
        if (timerPhase === 'break') exitFocusMode();
    }, [timerPhase]);

    // Restore active server-persisted Pomodoro session on mount / return to room
    useEffect(() => {
        if (!roomId || !userId) return undefined;
        let isCurrent = true;

        const restoreActivePomodoroSession = async () => {
            try {
                const sessions = await getRoomPomodoroSessions(roomId);
                if (!isCurrent || !Array.isArray(sessions) || !sessions.length) return;

                const activeSession = sessions.find((s) => s.status === 'active' || s.status === 'paused');
                if (!activeSession) return;

                const plannedSeconds = activeSession.plannedDurationSeconds || (DEFAULT_STUDY_MINUTES * 60);
                const plannedMins = Math.max(1, Math.round(plannedSeconds / 60));

                if (activeSession.status === 'active') {
                    const elapsed = Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000);
                    if (elapsed < plannedSeconds) {
                        const remaining = plannedSeconds - elapsed;
                        setStudyMinutes(plannedMins);
                        setSecondsLeft(remaining);
                        setSessionId(activeSession.id);
                        sessionIdRef.current = activeSession.id;
                        setSessionStatus('active');
                        startedAtRef.current = new Date(activeSession.startedAt).getTime() - ((activeSession.focusedDurationSeconds || 0) * 1000);
                        accumulatedFocusedSecondsRef.current = activeSession.focusedDurationSeconds || 0;
                        setIsRunning(true);
                    }
                } else if (activeSession.status === 'paused') {
                    const focused = activeSession.focusedDurationSeconds || 0;
                    const remaining = Math.max(0, plannedSeconds - focused);
                    setStudyMinutes(plannedMins);
                    setSecondsLeft(remaining);
                    setSessionId(activeSession.id);
                    sessionIdRef.current = activeSession.id;
                    setSessionStatus('paused');
                    accumulatedFocusedSecondsRef.current = focused;
                    setIsRunning(false);
                }
            } catch (error) {
                console.error('Unable to restore pomodoro session:', error);
            }
        };

        void restoreActivePomodoroSession();

        return () => {
            isCurrent = false;
        };
    }, [roomId, userId]);

    // Check for unread replies to the current user's doubts
    useEffect(() => {
        if (!roomId || !userId) return undefined;
        let isCurrent = true;

        const checkUnreadReplies = async () => {
            try {
                const doubts = await getDoubts(roomId);
                if (!isCurrent || !Array.isArray(doubts)) return;

                const myDoubts = doubts.filter((d) => d.userId === userId);
                myDoubtIdsRef.current = new Set(myDoubts.map((d) => d.id));

                const lastReadStr = localStorage.getItem(`doubt_last_read_${userId}_${roomId}`);
                const lastReadTime = lastReadStr ? new Date(lastReadStr).getTime() : 0;

                let unread = 0;
                for (const doubt of myDoubts) {
                    for (const reply of doubt.replies || []) {
                        if (reply.id) seenReplyIdsRef.current.add(reply.id);
                        if (reply.userId !== userId && new Date(reply.createdAt).getTime() > lastReadTime) {
                            unread += 1;
                        }
                    }
                }

                if (isCurrent) {
                    setUnreadReplyCount(unread);
                }
            } catch {
                // Non-fatal
            }
        };

        void checkUnreadReplies();

        return () => {
            isCurrent = false;
        };
    }, [roomId, userId]);

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
        let knownMemberNames = new Map();
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
                        name: presence.display_name || knownMemberNames.get(presence.user_id) || 'StudyPact member',
                        status: STATUS_CYCLE.includes(presence.status)
                            ? presence.status
                            : 'studying',
                    });
                });
            }

            if (userId && !activeMembers.has(userId) && presenceSubscribedRef.current) {
                activeMembers.set(userId, {
                    id: userId,
                    name: presenceDisplayName,
                    status: myStatusRef.current || 'studying',
                });
            }

            setMembers([...activeMembers.values()]);
        };

        const refreshMembers = async () => {
            if (!isCurrent) return;
            const requestId = ++memberRequestId;
            try {
                const fetchedMembers = await getRoomMembers(roomId);
                if (!isCurrent || requestId !== memberRequestId) return;

                setMemberError('');
                knownMemberNames = new Map(
                    fetchedMembers.map((member) => [member.userId, member.displayName]),
                );
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
                        })
                        .on(
                            'postgres_changes',
                            {
                                event: 'INSERT',
                                schema: 'public',
                                table: 'doubt_replies',
                            },
                            ({ new: newReply }) => {
                                if (!isCurrent || !newReply?.id || newReply.user_id === userId) return;
                                if (seenReplyIdsRef.current.has(newReply.id)) return;
                                seenReplyIdsRef.current.add(newReply.id);
                                if (myDoubtIdsRef.current.has(newReply.doubt_id)) {
                                    setUnreadReplyCount((prev) => prev + 1);
                                }
                            },
                        );

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
            if (reconnectTimer) clearTimeout(reconnectTimer);
            presenceSubscribedRef.current = false;
            presenceChannelRef.current = null;
            if (channel) {
                void channel.untrack().catch(() => {});
                void supabase?.removeChannel(channel);
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
            if (presenceChannelRef.current) {
                try {
                    await presenceChannelRef.current.untrack();
                } catch (untrackErr) {
                    console.error('Unable to untrack presence on leave:', untrackErr);
                }
                try {
                    await supabase?.removeChannel(presenceChannelRef.current);
                } catch (removeErr) {
                    console.error('Unable to remove channel on leave:', removeErr);
                }
                presenceChannelRef.current = null;
                presenceSubscribedRef.current = false;
            }
            setMembers((current) => current.filter((m) => m.id !== userId));
            await leaveRoom(roomId);
            navigate('/dashboard');
        } catch (error) {
            setRoomError(error.message || 'Unable to leave this room. Please try again.');
            setLeaving(false);
        }
    };

    const getFocusedDuration = useCallback(() => {
        const runningSeconds = startedAtRef.current
            ? Math.floor((Date.now() - startedAtRef.current) / 1000)
            : 0;

        return Math.min(
            studyMinutes * 60,
            accumulatedFocusedSecondsRef.current + runningSeconds,
        );
    }, [studyMinutes]);

    const handleStudyDurationChange = (minutes) => {
        const val = Math.max(1, Math.min(180, Number(minutes) || DEFAULT_STUDY_MINUTES));
        setStudyMinutes(val);
        if (!isRunning && timerPhase === 'study') {
            setSecondsLeft(val * 60);
        }
    };

    useEffect(() => {
        if (!isRunning || !startedAtRef.current) {
            return undefined;
        }

        const updateCountdown = () => {
            if (timerPhase === 'study') {
                const elapsedSeconds = getFocusedDuration();
                const remainingSeconds = Math.max(
                    0,
                    studyMinutes * 60 - elapsedSeconds,
                );

                setSecondsLeft(remainingSeconds);

                if (remainingSeconds === 0) {
                    clearInterval(intervalRef.current);
                    startedAtRef.current = null;

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
                            studyMinutes * 60,
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

                    // Switch to 5-minute fixed break
                    setTimerPhase('break');
                    setSecondsLeft(BREAK_MINUTES * 60);
                    startedAtRef.current = Date.now();
                    accumulatedFocusedSecondsRef.current = 0;
                }
            } else {
                // Break countdown (fixed 5 minutes)
                const runningBreakSeconds = startedAtRef.current
                    ? Math.floor((Date.now() - startedAtRef.current) / 1000)
                    : 0;
                const remainingBreakSeconds = Math.max(
                    0,
                    BREAK_MINUTES * 60 - runningBreakSeconds,
                );

                setSecondsLeft(remainingBreakSeconds);

                if (remainingBreakSeconds === 0) {
                    clearInterval(intervalRef.current);
                    startedAtRef.current = null;
                    // Return to study state with user's selected study duration
                    setTimerPhase('study');
                    setSecondsLeft(studyMinutes * 60);
                    setIsRunning(false);
                    setSessionId(null);
                    sessionIdRef.current = null;
                    setSessionStatus(null);
                    accumulatedFocusedSecondsRef.current = 0;
                    completionAttemptedRef.current = false;
                }
            }
        };

        updateCountdown();
        intervalRef.current = setInterval(updateCountdown, 1000);

        return () => clearInterval(intervalRef.current);
    }, [isRunning, timerPhase, studyMinutes, getFocusedDuration]);

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

        const startingStudySession = !isRunning && timerPhase === 'study';
        if (startingStudySession && studyRoomPageRef.current && !document.fullscreenElement) {
            // Invoke from the click before awaiting session persistence so browsers retain the gesture.
            requestBrowserFullscreen();
        }

        operationInProgressRef.current = true;
        setPomodoroError('');

        try {
            if (isRunning) {
                if (timerPhase === 'study') exitFocusMode();
                if (timerPhase === 'study') {
                    const currentFocusedDuration = getFocusedDuration();
                    setIsRunning(false);
                    startedAtRef.current = null;
                    setSecondsLeft(studyMinutes * 60 - currentFocusedDuration);
                    setSessionStatus('paused');

                    if (sessionIdRef.current) {
                        await updatePomodoroSession(sessionIdRef.current, {
                            status: 'paused',
                            focusedDurationSeconds: currentFocusedDuration,
                        });
                    }

                    accumulatedFocusedSecondsRef.current = currentFocusedDuration;
                } else {
                    // Pausing during break
                    setIsRunning(false);
                    startedAtRef.current = null;
                }
                return;
            }

            if (timerPhase === 'study') {
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
                        studyMinutes * 60,
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
                setSecondsLeft(studyMinutes * 60 - currentFocusedDuration);
                setSessionStatus('active');
                setIsRunning(true);
                enterFocusMode();
            } else {
                // Starting or resuming 5-minute break
                startedAtRef.current = Date.now() - (BREAK_MINUTES * 60 - secondsLeft) * 1000;
                setIsRunning(true);
            }
        } catch (error) {
            setPomodoroError(error.message);
        } finally {
            operationInProgressRef.current = false;
        }
    };

    const handleReset = async () => {
        if (operationInProgressRef.current) return;

        exitFocusMode();

        operationInProgressRef.current = true;
        setPomodoroError('');
        setIsRunning(false);
        clearInterval(intervalRef.current);
        const currentFocusedDuration = getFocusedDuration();
        startedAtRef.current = null;

        try {
            const currentSessionId = sessionIdRef.current || sessionId;
            if (currentSessionId && timerPhase === 'study') {
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
            setTimerPhase('study');
            setSecondsLeft(studyMinutes * 60);
        } catch (error) {
            setPomodoroError(error.message);
        } finally {
            operationInProgressRef.current = false;
        }
    };

    const handleCreateMockSession = async () => {
        if (!roomId) return;
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
                    durationSeconds: 60 * 60,
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

    const totalPhaseSeconds = timerPhase === 'break' ? BREAK_MINUTES * 60 : studyMinutes * 60;
    const progressPercent = totalPhaseSeconds > 0
        ? Math.max(0, Math.min(100, ((totalPhaseSeconds - secondsLeft) / totalPhaseSeconds) * 100))
        : 0;

    const completedGoals = dailyGoals.filter((goal) => goal.isCompleted).length;

    if (roomLoading) {
        return (
            <div className="sr-page sr-page-loading">
                <div className="sr-loading-spinner"></div>
                <p role="status">Loading room...</p>
            </div>
        );
    }

    if (roomError || !room) {
        return (
            <div className="sr-page sr-page-loading">
                <div className="sr-error-card">
                    <p role="alert">{roomError || 'Room not found.'}</p>
                    <Link to="/dashboard" className="sr-btn sr-btn-outline" style={{ textDecoration: 'none' }}>
                        Back to dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div ref={studyRoomPageRef} className={`sr-page${isFocusMode ? ' sr-focus-mode' : ''}`}>
            {/* Top bar */}
            <header className="sr-topbar">
                <div className="sr-room-info">
                    <span className="sr-badge">{room.examTag || 'Study'}</span>
                    <h1 className="sr-room-title">{room.title}</h1>
                    <span
                        className="sr-room-code"
                        onClick={handleCopyCode}
                        style={{ cursor: 'pointer' }}
                        title="Click to copy room code"
                    >
                        Code: {room.roomCode} {copiedCode && <span style={{ color: '#5c8a52', fontWeight: 600 }}> (Copied!)</span>}
                    </span>
                    {room.isLive && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="sr-live-dot" aria-hidden="true"></span>
                            <span className="sr-live-text">Live</span>
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Link to="/dashboard" className="sr-link-btn" style={{ textDecoration: 'none' }}>
                        Dashboard
                    </Link>
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

            {/* Body grid */}
            <div className="sr-body">
                {/* Left: presence + active mock rooms */}
                <aside className="sr-panel sr-presence-panel" data-clippy-target="study-members">
                    <button
                        className="sr-my-status"
                        onClick={cycleStatus}
                        title="Click to cycle status: Studying / Break / Away"
                    >
                        <span className={`sr-status-dot sr-status-${myStatus}`}></span>
                        <span>You - {STATUS_LABEL[myStatus]}</span>
                    </button>

                    <p className="sr-panel-label">
                        Members ({members.length}/{room?.maxMembers})
                    </p>
                    {memberError && <p className="sr-realtime-error" role="alert">{memberError}</p>}
                    {realtimeError && <p className="sr-realtime-error" role="alert">{realtimeError}</p>}
                    <ul className="sr-member-list">
                        {members.map((m) => {
                            const isMe = m.id === user?.id;
                            return (
                                <li key={m.id} className="sr-member">
                                    <span className="sr-avatar">{m.name.charAt(0).toUpperCase()}</span>
                                    <div className="sr-member-meta">
                                        <span className="sr-member-name">
                                            {m.name}{isMe ? ' (You)' : ''}
                                        </span>
                                        <span className="sr-member-status">
                                            <span className={`sr-status-dot sr-status-${m.status}`}></span>
                                            {STATUS_LABEL[m.status]}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <section className="sr-active-mock-rooms" aria-labelledby="sr-active-mock-rooms-title">
                        <h2 className="sr-panel-label" id="sr-active-mock-rooms-title">Active Mock Rooms</h2>
                        {activeMockRoomsError && <p className="sr-mock-rooms-error" role="alert">{activeMockRoomsError}</p>}
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
                                            <p>Status: Ready to start</p>
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
                                className={`sr-ring-progress ${timerPhase === 'break' ? 'is-break-ring' : ''}`}
                                cx="60"
                                cy="60"
                                r="52"
                                style={{ strokeDashoffset: 327 - (327 * progressPercent) / 100 }}
                            />
                        </svg>
                        <div className="sr-timer-center">
                            <span className="sr-timer-value">{formatTime(secondsLeft)}</span>
                            <span className={`sr-timer-caption ${timerPhase === 'break' ? 'is-break-caption' : ''}`}>
                                {timerPhase === 'break' ? 'Break (5:00)' : 'Study Session'}
                            </span>
                        </div>
                    </div>

                    <div className="sr-timer-duration-config" data-clippy-target="study-timer">
                        {timerPhase === 'study' ? (
                            <>
                                <label className="sr-duration-label-wrap">
                                    <span className="sr-duration-label">Study Duration</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="180"
                                        value={studyMinutes}
                                        onChange={(e) => handleStudyDurationChange(e.target.value)}
                                        disabled={isRunning}
                                        className="sr-duration-number-input"
                                        aria-label="Set study duration in minutes"
                                    />
                                    <span className="sr-duration-unit">min</span>
                                </label>
                                <div className="sr-duration-presets-row">
                                    {[15, 20, 25, 30, 45, 60].map((mins) => (
                                        <button
                                            key={mins}
                                            type="button"
                                            className={`sr-duration-preset-chip ${studyMinutes === mins ? 'is-selected' : ''}`}
                                            onClick={() => handleStudyDurationChange(mins)}
                                            disabled={isRunning}
                                        >
                                            {mins}m
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="sr-break-indicator-badge">
                                <span>Break: 5:00 (Fixed)</span>
                            </div>
                        )}
                    </div>

                    <div className="sr-timer-controls">
                        <button
                            type="button"
                            className="sr-btn sr-btn-outline"
                            onClick={handleReset}
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            className="sr-btn sr-btn-primary"
                            onClick={handleStartPause}
                        >
                            {isRunning ? 'Pause' : (timerPhase === 'break' ? 'Start Break' : 'Start')}
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
                            className="sr-quick-card sr-quick-button sr-create-mock-btn"
                            onClick={() => {
                                setPaperSelectionError('');
                                setSelectedPaperId('');
                                setPaperSource('dataset');
                                setPaperSearch('');
                                setCustomQuestionPaper(null);
                                setShowPaperSelector(true);
                            }}
                        >
                            <span className="sr-quick-title">CREATE MOCK ROOM</span>
                            <span className="sr-quick-sub">Timed exam practice with peer evaluations</span>
                        </button>
                    </div>

                    <div className="sr-goal-strip" data-clippy-target="study-tasks">
                        <div className="sr-goal-strip-header">
                            <span className="sr-goal-strip-title">My tasks</span>
                            <span className="sr-goal-strip-count">
                                {completedGoals}/{dailyGoals.length} completed
                            </span>
                        </div>

                        {dailyGoalsError && <p className="sr-task-error" role="alert">{dailyGoalsError}</p>}

                        <div className="sr-goal-strip-items">
                            {dailyGoalsLoading ? (
                                <span className="sr-goal-chip sr-goal-loading">Loading goals...</span>
                            ) : dailyGoals.length === 0 ? (
                                <span className="sr-goal-chip sr-goal-empty">No daily goals set for today yet.</span>
                            ) : (
                                dailyGoals.map((goal) => (
                                    <label
                                        key={goal.id}
                                        className={`sr-goal-chip sr-goal-task ${goal.isCompleted ? 'sr-goal-done' : ''}`}
                                    >
                                        {goal.isCompleted ? (
                                            <Check size={12} className="sr-goal-check-icon" />
                                        ) : (
                                            <input
                                                type="checkbox"
                                                checked={false}
                                                onChange={() => toggleDailyGoal(goal)}
                                                className="sr-goal-checkbox"
                                            />
                                        )}
                                        <span className="sr-goal-text">{goal.description}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Floating corner controls: Doubt Forum (?) and Room Chat (💬) */}
            <div className="sr-floating-corner-controls" role="region" aria-label="Room quick actions">
                <Link
                    to={`/doubt-forum/${roomId}`}
                    className="sr-floating-btn sr-floating-doubt-btn"
                    data-clippy-target="study-doubt-forum"
                    aria-label="Open Doubt Forum"
                    title="Open Doubt Forum (?)"
                    onClick={() => {
                        if (userId && roomId) {
                            localStorage.setItem(`doubt_last_read_${userId}_${roomId}`, new Date().toISOString());
                            setUnreadReplyCount(0);
                        }
                    }}
                >
                    <span className="sr-floating-btn-text" aria-hidden="true">?</span>
                    {unreadReplyCount > 0 && (
                        <span className="sr-doubt-badge" aria-label={`${unreadReplyCount} unread replies`}>
                            {unreadReplyCount > 99 ? '99+' : unreadReplyCount}
                        </span>
                    )}
                </Link>

                <button
                    type="button"
                    className={`sr-floating-btn sr-floating-chat-btn ${isChatOpen ? 'is-active' : ''}`}
                    data-clippy-target="study-chat"
                    aria-label={isChatOpen ? 'Hide room chat' : 'Open room chat'}
                    aria-expanded={isChatOpen}
                    title={isChatOpen ? 'Hide room chat' : 'Open room chat (💬)'}
                    onClick={() => setIsChatOpen((open) => !open)}
                >
                    <span className="sr-floating-btn-icon" aria-hidden="true">💬</span>
                </button>
            </div>
            {isChatOpen && (
                <div className="sr-chat">
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
                        {messages.length === 0 ? (
                            <div style={{ color: '#8a8474', fontSize: '12px', textAlign: 'center', margin: 'auto 0' }}>
                                Say hello to your study partners!
                            </div>
                        ) : (
                            messages.map((m) => (
                                <div
                                    key={m.id}
                                    className={`sr-chat-message ${m.author === 'You' ? 'sr-chat-mine' : ''}`}
                                >
                                    <span className="sr-chat-author">{m.author}</span>
                                    <span className="sr-chat-text">{m.text}</span>
                                </div>
                            ))
                        )}
                    </div>
                    <form className="sr-chat-form" onSubmit={sendMessage}>
                        <input
                            type="text"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Message the room..."
                            className="sr-chat-input"
                            maxLength={500}
                        />
                        <button
                            type="submit"
                            className="sr-chat-send"
                            disabled={!draft.trim()}
                            aria-label="Send message"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}

            {showPaperSelector && (
                <div className="sr-modal-overlay" onClick={() => !creatingMockSession && setShowPaperSelector(false)}>
                    <section
                        className="sr-mock-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sr-mock-modal-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <header className="sr-mock-modal-header">
                            <div>
                                <span className="sr-modal-eyebrow">PRACTICE EXAM</span>
                                <h2 id="sr-mock-modal-title">Create Mock Test</h2>
                            </div>
                            <button
                                type="button"
                                className="sr-modal-close"
                                aria-label="Close dialog"
                                onClick={() => !creatingMockSession && setShowPaperSelector(false)}
                            >
                                <X size={18} />
                            </button>
                        </header>

                        <div className="sr-mock-modal-body">
                            <div className="sr-source-choice-row">
                                <label className="sr-source-choice">
                                    <input
                                        type="radio"
                                        name="mock-paper-source"
                                        value="dataset"
                                        checked={paperSource === 'dataset'}
                                        onChange={() => setPaperSource('dataset')}
                                        disabled={creatingMockSession}
                                    />
                                    <span>Question Paper Library</span>
                                </label>
                                <label className="sr-source-choice">
                                    <input
                                        type="radio"
                                        name="mock-paper-source"
                                        value="custom"
                                        checked={paperSource === 'custom'}
                                        onChange={() => setPaperSource('custom')}
                                        disabled={creatingMockSession}
                                    />
                                    <span>Upload Custom PDF</span>
                                </label>
                            </div>

                            {paperSource === 'dataset' ? (
                                <div className="sr-dataset-picker">
                                    <input
                                        type="search"
                                        className="sr-dataset-search"
                                        placeholder="Search papers by exam, subject, or year..."
                                        value={paperSearch}
                                        onChange={(event) => setPaperSearch(event.target.value)}
                                        disabled={creatingMockSession || paperSelectionLoading}
                                    />

                                    {paperSelectionLoading ? (
                                        <p className="sr-paper-loading">Loading question papers...</p>
                                    ) : paperSelectionError ? null : availablePapers.length === 0 ? (
                                        <p className="sr-paper-empty">No question papers currently available.</p>
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
                                                        }}
                                                        disabled={creatingMockSession}
                                                    >
                                                        <span className="sr-dataset-paper-name">
                                                            {paper.examTag} {paper.examYear ?? ''} • {paper.paperName || paper.title}
                                                        </span>
                                                        <span className="sr-dataset-paper-meta">
                                                            {paper.subject || 'Subject not specified'} • {paper.questions?.length ?? 0} questions
                                                            {paper.evaluationType ? ` • ${paper.evaluationType}` : ''}
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
                                                <span>{paper.paperName || paper.title} • {paper.subject || 'Subject'}</span>
                                                <span>Evaluation: {paper.evaluationType || 'Peer reviewed'}</span>
                                                <span>{paper.totalMarks ? `${paper.totalMarks} marks` : 'Total marks according to source'}</span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="sr-custom-paper-picker">
                                    <label className="sr-custom-paper-label" htmlFor="custom-question-paper">
                                        Choose PDF Question Paper
                                        <input
                                            id="custom-question-paper"
                                            type="file"
                                            accept="application/pdf,.pdf"
                                            onChange={handleCustomPaperChange}
                                            disabled={creatingMockSession}
                                        />
                                    </label>
                                    <p className="sr-custom-paper-hint">This PDF is the question paper shown to everyone in this mock room during the test.</p>
                                    {customQuestionPaper && (
                                        <p className="sr-custom-paper-file" role="status">
                                            Selected: {customQuestionPaper.name} ({Math.ceil(customQuestionPaper.size / 1024)} KB)
                                        </p>
                                    )}
                                </div>
                            )}

                            {paperSelectionError && <p className="sr-paper-error" role="alert">{paperSelectionError}</p>}
                        </div>

                        <footer className="sr-modal-actions sr-paper-actions">
                            <button
                                type="button"
                                className="sr-btn sr-btn-ghost"
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
                                    || (paperSelectionLoading && paperSource === 'dataset')
                                    || (paperSource === 'dataset' && (!selectedPaperId || !availablePapers.some((paper) => paper.id === selectedPaperId)))
                                    || (paperSource === 'custom' && !customQuestionPaper)
                                }
                                onClick={handleCreateMockSession}
                            >
                                {creatingMockSession ? 'Creating...' : 'Create Mock Test'}
                            </button>
                        </footer>
                    </section>
                </div>
            )}
            <Clippy context="studyRoom" />
        </div>
    );
};

export default StudyRoom;

