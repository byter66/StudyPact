import { apiRequest } from './apiClient';

const request = async (path, options = {}) => {
    const payload = await apiRequest(`/api${path}`, options);

    if (payload.success !== true) {
        throw new Error(payload.message || 'Pomodoro request failed.');
    }

    return payload.data;
};

export const createPomodoroSession = (roomId, plannedDurationSeconds) =>
    request(`/rooms/${encodeURIComponent(roomId)}/pomodoro-sessions`, {
        method: 'POST',
        body: JSON.stringify({ plannedDurationSeconds }),
    });

export const updatePomodoroSession = (sessionId, updates) =>
    request(`/pomodoro-sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
    });

export const completePomodoroSession = (
    sessionId,
    focusedDurationSeconds,
) =>
    request(`/pomodoro-sessions/${encodeURIComponent(sessionId)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ focusedDurationSeconds }),
    });

export const getRoomPomodoroSessions = (roomId) =>
    request(`/rooms/${encodeURIComponent(roomId)}/pomodoro-sessions`);
