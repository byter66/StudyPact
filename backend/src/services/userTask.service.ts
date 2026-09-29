import { supabaseAdmin } from "../config/supabase";
import { TaskRequirementError, UserTask, UserTaskRow } from "../types/userTask.types";

const USER_TASK_COLUMNS =
  "id, user_id, title, completed, created_at, updated_at";

const toUserTask = (row: UserTaskRow): UserTask => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  completed: row.completed,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listUserTasks = async (userId: string): Promise<UserTask[]> => {
  const { data, error } = await supabaseAdmin
    .from("user_tasks")
    .select(USER_TASK_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as UserTaskRow[]).map(toUserTask);
};

export const createUserTask = async (
  userId: string,
  title: string
): Promise<UserTask> => {
  const { data, error } = await supabaseAdmin
    .from("user_tasks")
    .insert({ user_id: userId, title: title.trim() })
    .select(USER_TASK_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return toUserTask(data as UserTaskRow);
};

export const updateUserTask = async (
  userId: string,
  taskId: string,
  updates: { title?: string; completed?: boolean }
): Promise<UserTask | null> => {
  const { data, error } = await supabaseAdmin
    .from("user_tasks")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select(USER_TASK_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toUserTask(data as UserTaskRow) : null;
};

export const userHasTasks = async (userId: string): Promise<boolean> => {
  const { count, error } = await supabaseAdmin
    .from("user_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
};

export const requireUserHasTasks = async (userId: string): Promise<void> => {
  if (!(await userHasTasks(userId))) {
    throw new TaskRequirementError();
  }
};
