const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const request = async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new Error(`Pomodoro request failed with status ${response.status}`);
    }

    if (!response.ok || payload.success !== true) {
        throw new Error(
            payload.message || `Pomodoro request failed with status ${response.status}`,
        );
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
