import { apiRequest } from "./apiClient";

export const createDoubt = async (roomId, content) => {
    const result = await apiRequest(
        `/api/rooms/${encodeURIComponent(roomId)}/doubts`,
        {
            method: "POST",
            body: JSON.stringify({ content }),
        },
    );

    return result.data;
};

export const getDoubts = async (roomId) => {
    const result = await apiRequest(
        `/api/rooms/${encodeURIComponent(roomId)}/doubts`,
    );

    return result.data;
};

export const uploadDoubtImages = async (roomId, doubtId, images) => {
    const result = await apiRequest(
        `/api/rooms/${encodeURIComponent(roomId)}/doubts/${encodeURIComponent(doubtId)}/images`,
        {
            method: "POST",
            body: JSON.stringify({ images }),
        },
    );

    return result.data;
};

export const createDoubtReply = async (roomId, doubtId, content) => {
    const result = await apiRequest(
        `/api/rooms/${encodeURIComponent(roomId)}/doubts/${encodeURIComponent(doubtId)}/replies`,
        {
            method: "POST",
            body: JSON.stringify({ content }),
        },
    );

    return result.data;
};
