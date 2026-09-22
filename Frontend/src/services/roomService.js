import { apiRequest } from "./apiClient";

export const getRoomById = async (roomId) => {
  const result = await apiRequest(
    `/api/rooms/${encodeURIComponent(roomId)}`,
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
