import { apiRequest } from "./apiClient";

export const getTodayDailyGoals = async () => {
  const result = await apiRequest("/api/daily-goals/today");
  return result.data;
};

export const createDailyGoal = async (description) => {
  const result = await apiRequest("/api/daily-goals", {
    method: "POST",
    body: JSON.stringify({ description }),
  });
  return result.data;
};

export const updateDailyGoal = async (goalId, description) => {
  const result = await apiRequest(`/api/daily-goals/${encodeURIComponent(goalId)}`, {
    method: "PATCH",
    body: JSON.stringify({ description }),
  });
  return result.data;
};

export const completeDailyGoal = async (goalId) => {
  const result = await apiRequest(
    `/api/daily-goals/${encodeURIComponent(goalId)}/complete`,
    { method: "POST" },
  );
  return result.data;
};

export const getDailyGoalStreak = async () => {
  const result = await apiRequest("/api/daily-goals/streak");
  return result.data;
};

export const getDailyGoalLeaderboard = async () => {
  const result = await apiRequest("/api/daily-goals/leaderboard");
  return result.data;
};

export const getRoomMemberDailyGoals = async (roomId) => {
  const result = await apiRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/daily-goals`,
  );
  return result.data;
};
