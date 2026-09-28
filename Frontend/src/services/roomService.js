import { apiRequest } from "./apiClient";

export const getRooms = async () => {
  const result = await apiRequest("/api/rooms");
  return result.data;
};

export const getRoomById = async (roomId) => {
  const result = await apiRequest(
    `/api/rooms/${encodeURIComponent(roomId)}`,
  );

  return result.data;
};

export const getRoomByCode = async (roomCode) => {
  const result = await apiRequest(
    `/api/rooms/code/${encodeURIComponent(roomCode.trim())}`,
  );
  return result.data;
};

export const joinRoom = async (roomId) => {
  const result = await apiRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/join`,
    {
      method: "POST",
    },
  );

  return result;
};

export const leaveRoom = async (roomId) =>
  apiRequest(`/api/rooms/${encodeURIComponent(roomId)}/membership`, {
    method: "DELETE",
  });

export const getRoomMembers = async (roomId) => {
  const result = await apiRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/members`,
  );
  return result.data;
};

export const getRoomLeaderboard = async (roomId) => {
  const result = await apiRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/leaderboard`,
  );
  return result.data;
};
