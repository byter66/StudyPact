import { apiRequest } from "./apiClient";

export const getUserTasks = async () => {
  const result = await apiRequest("/api/tasks");
  return result.data;
};

export const createUserTask = async (title) => {
  const result = await apiRequest("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return result.data;
};

export const updateUserTask = async (taskId, updates) => {
  const result = await apiRequest(
    `/api/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    },
  );
  return result.data;
};
