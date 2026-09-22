import { supabase } from "../config/supabase";
import { DailyGoal } from "../types/accountability.types";
import {
  CreateDailyGoalInput,
  DailyGoalRow,
  DailyGoalServiceError,
  UpdateDailyGoalInput,
} from "../types/dailyGoal.types";

const DAILY_GOAL_COLUMNS =
  "id, room_id, user_id, description, goal_date, is_completed, created_at, updated_at";

const toDailyGoal = (row: DailyGoalRow): DailyGoal =>
  new DailyGoal(
    row.id,
    row.user_id,
    row.room_id,
    row.description,
    row.goal_date,
    row.is_completed
  );

const getToday = (): string => new Date().toISOString().slice(0, 10);

const validateDescription = (description: string): string => {
  const trimmedDescription = description.trim();

  if (trimmedDescription.length === 0) {
    throw new DailyGoalServiceError(
      400,
      "Daily goal description must not be empty"
    );
  }

  return trimmedDescription;
};

const requireRoomMembership = async (
  roomId: string,
  userId: string
): Promise<void> => {
  const { data, error } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new DailyGoalServiceError(
      403,
      "Room membership is required to manage a daily goal"
    );
  }
};

export const createTodayDailyGoal = async (
  input: CreateDailyGoalInput
): Promise<DailyGoal> => {
  const description = validateDescription(input.description);
  await requireRoomMembership(input.roomId, input.userId);

  const { data, error } = await supabase
    .from("daily_goals")
    .insert({
      room_id: input.roomId,
      user_id: input.userId,
      description,
      goal_date: getToday(),
    })
    .select(DAILY_GOAL_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new DailyGoalServiceError(
        409,
        "A daily goal already exists for today"
      );
    }

    throw error;
  }

  return toDailyGoal(data as DailyGoalRow);
};

export const updateTodayDailyGoal = async (
  roomId: string,
  userId: string,
  input: UpdateDailyGoalInput
): Promise<DailyGoal> => {
  const description = validateDescription(input.description);
  await requireRoomMembership(roomId, userId);

  const { data, error } = await supabase
    .from("daily_goals")
    .update({
      description,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("goal_date", getToday())
    .select(DAILY_GOAL_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new DailyGoalServiceError(
      404,
      "No daily goal exists for today"
    );
  }

  return toDailyGoal(data as DailyGoalRow);
};

export const completeTodayDailyGoal = async (
  roomId: string,
  userId: string
): Promise<DailyGoal> => {
  await requireRoomMembership(roomId, userId);

  const { data: existingGoal, error: lookupError } = await supabase
    .from("daily_goals")
    .select(DAILY_GOAL_COLUMNS)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("goal_date", getToday())
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!existingGoal) {
    throw new DailyGoalServiceError(
      404,
      "No daily goal exists for today"
    );
  }

  const goal = existingGoal as DailyGoalRow;

  if (goal.is_completed) {
    return toDailyGoal(goal);
  }

  const { data, error } = await supabase
    .from("daily_goals")
    .update({
      is_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", goal.id)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("goal_date", getToday())
    .select(DAILY_GOAL_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new DailyGoalServiceError(
      404,
      "No daily goal exists for today"
    );
  }

  return toDailyGoal(data as DailyGoalRow);
};
