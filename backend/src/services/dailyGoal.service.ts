import { supabaseAdmin } from "../config/supabase";
import { CommitmentPlan, DailyGoal } from "../types/accountability.types";
import {
  AuthenticatedDailyGoalRequest,
  DailyGoalRow,
  DailyGoalServiceError,
} from "../types/dailyGoal.types";

const DAILY_GOAL_COLUMNS =
  "id, user_id, description, goal_date, is_completed, created_at, updated_at";

const toDailyGoal = (row: DailyGoalRow): DailyGoal =>
  new DailyGoal(
    row.id,
    row.user_id,
    row.description,
    row.goal_date,
    row.is_completed
  );

const getToday = (): string => new Date().toISOString().slice(0, 10);

const validateDescription = (description: string): string => {
  const trimmedDescription = description.trim();
  if (!trimmedDescription) {
    throw new DailyGoalServiceError(400, "Daily goal description must not be empty");
  }
  return trimmedDescription;
};

const requireUser = (req: AuthenticatedDailyGoalRequest): string => {
  if (!req.user?.id) {
    throw new DailyGoalServiceError(401, "Authentication is required for daily goals");
  }
  return req.user.id;
};

const getGoalsForDate = async (userId: string, goalDate: string) => {
  const { data, error } = await supabaseAdmin
    .from("daily_goals")
    .select(DAILY_GOAL_COLUMNS)
    .eq("user_id", userId)
    .eq("goal_date", goalDate)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyGoalRow[];
};

export const getTodayDailyGoals = async (req: AuthenticatedDailyGoalRequest) => {
  const userId = requireUser(req);
  return (await getGoalsForDate(userId, getToday())).map(toDailyGoal);
};

export const createTodayDailyGoal = async (
  req: AuthenticatedDailyGoalRequest,
  description: string
) => {
  const userId = requireUser(req);
  const normalizedDescription = validateDescription(description);
  const { data, error } = await supabaseAdmin
    .from("daily_goals")
    .insert({
      user_id: userId,
      description: normalizedDescription,
      goal_date: getToday(),
    })
    .select(DAILY_GOAL_COLUMNS)
    .single();
  if (error || !data) throw error ?? new Error("Unable to create the daily goal.");
  return toDailyGoal(data as DailyGoalRow);
};

export const updateDailyGoal = async (
  req: AuthenticatedDailyGoalRequest,
  goalId: string,
  description: string
) => {
  const userId = requireUser(req);
  const normalizedDescription = validateDescription(description);
  const { data, error } = await supabaseAdmin
    .from("daily_goals")
    .update({ description: normalizedDescription, updated_at: new Date().toISOString() })
    .eq("id", goalId)
    .eq("user_id", userId)
    .eq("goal_date", getToday())
    .select(DAILY_GOAL_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new DailyGoalServiceError(404, "Daily goal not found");
  return toDailyGoal(data as DailyGoalRow);
};

export const completeDailyGoal = async (
  req: AuthenticatedDailyGoalRequest,
  goalId: string
) => {
  const userId = requireUser(req);
  const { data, error } = await supabaseAdmin
    .from("daily_goals")
    .update({ is_completed: true, updated_at: new Date().toISOString() })
    .eq("id", goalId)
    .eq("user_id", userId)
    .eq("goal_date", getToday())
    .select(DAILY_GOAL_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new DailyGoalServiceError(404, "Daily goal not found");
  return toDailyGoal(data as DailyGoalRow);
};

const getPreviousDate = (date: string): string => {
  const previousDate = new Date(`${date}T00:00:00.000Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  return previousDate.toISOString().slice(0, 10);
};

const isCompletedDay = (userId: string, goals: DailyGoalRow[]): boolean => {
  if (!goals.length) return false;
  const domainGoals = goals.map(toDailyGoal);
  const commitmentPlan = new CommitmentPlan(userId, domainGoals);
  return commitmentPlan.getProgress() === 1;
};

const calculateCurrentStreak = (userId: string, rows: DailyGoalRow[]): number => {
  const goalsByDate = new Map<string, DailyGoalRow[]>();
  for (const row of rows) {
    const goals = goalsByDate.get(row.goal_date) ?? [];
    goals.push(row);
    goalsByDate.set(row.goal_date, goals);
  }

  let currentDate = getToday();
  let streak = 0;
  while (isCompletedDay(userId, goalsByDate.get(currentDate) ?? [])) {
    streak += 1;
    currentDate = getPreviousDate(currentDate);
  }
  return streak;
};

export const getDailyGoalStreak = async (req: AuthenticatedDailyGoalRequest) => {
  const userId = requireUser(req);
  const { data, error } = await supabaseAdmin
    .from("daily_goals")
    .select(DAILY_GOAL_COLUMNS)
    .eq("user_id", userId)
    .lte("goal_date", getToday())
    .order("goal_date", { ascending: false });
  if (error) throw error;
  return calculateCurrentStreak(userId, (data ?? []) as DailyGoalRow[]);
};

export interface DailyGoalLeaderboardEntry {
  userId: string;
  name: string;
  streak: number;
  rank: number;
}

export interface RoomMemberDailyGoals {
  userId: string;
  name: string;
  goals: Array<{
    id: string;
    description: string;
    isCompleted: boolean;
  }>;
}

export const getRoomMemberDailyGoals = async (
  roomId: string,
  requesterId: string
): Promise<RoomMemberDailyGoals[]> => {
  const { data: requesterMembership, error: membershipError } = await supabaseAdmin
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", requesterId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!requesterMembership) {
    throw new DailyGoalServiceError(403, "Join this room before viewing daily goals.");
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from("room_members")
    .select("user_id, joined_at")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (membersError) throw membersError;

  const userIds = (members ?? []).map((member) => member.user_id);
  if (!userIds.length) return [];

  const [{ data: profiles, error: profilesError }, { data: goals, error: goalsError }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds),
      supabaseAdmin
        .from("daily_goals")
        .select("id, user_id, description, is_completed")
        .in("user_id", userIds)
        .eq("goal_date", getToday())
        .order("created_at", { ascending: true }),
    ]);
  if (profilesError) throw profilesError;
  if (goalsError) throw goalsError;

  const namesByUserId = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name || "StudyPact member"])
  );
  const goalsByUserId = new Map<string, RoomMemberDailyGoals["goals"]>();
  for (const goal of goals ?? []) {
    const memberGoals = goalsByUserId.get(goal.user_id) ?? [];
    memberGoals.push({
      id: goal.id,
      description: goal.description,
      isCompleted: goal.is_completed,
    });
    goalsByUserId.set(goal.user_id, memberGoals);
  }

  return userIds.map((userId) => ({
    userId,
    name: namesByUserId.get(userId) || "StudyPact member",
    goals: goalsByUserId.get(userId) ?? [],
  }));
};

export const getDailyGoalLeaderboard = async (): Promise<DailyGoalLeaderboardEntry[]> => {
  const { data, error } = await supabaseAdmin
    .from("daily_goals")
    .select(DAILY_GOAL_COLUMNS)
    .lte("goal_date", getToday())
    .order("goal_date", { ascending: false });
  if (error) throw error;

  const goalsByUser = new Map<string, DailyGoalRow[]>();
  for (const row of (data ?? []) as DailyGoalRow[]) {
    const goals = goalsByUser.get(row.user_id) ?? [];
    goals.push(row);
    goalsByUser.set(row.user_id, goals);
  }

  const userIds = [...goalsByUser.keys()];
  const { data: profiles, error: profileError } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [], error: null };
  if (profileError) throw profileError;

  const namesByUserId = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name || "StudyPact member"])
  );

  return userIds
    .map((userId) => ({
      userId,
      name: namesByUserId.get(userId) || "StudyPact member",
      streak: calculateCurrentStreak(userId, goalsByUser.get(userId) ?? []),
      rank: 0,
    }))
    .sort(
      (left, right) =>
        right.streak - left.streak ||
        left.name.localeCompare(right.name) ||
        left.userId.localeCompare(right.userId)
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};

// Kept for the existing room leaderboard service until room goal display is migrated.
export const getRoomCurrentStreaks = async (
  _roomId: string,
  userIds: string[]
): Promise<Map<string, number>> => {
  const streaks = new Map(userIds.map((userId) => [userId, 0]));
  for (const userId of userIds) {
    const { data, error } = await supabaseAdmin
      .from("daily_goals")
      .select(DAILY_GOAL_COLUMNS)
      .eq("user_id", userId)
      .lte("goal_date", getToday())
      .order("goal_date", { ascending: false });
    if (error) throw error;

    streaks.set(userId, calculateCurrentStreak(userId, (data ?? []) as DailyGoalRow[]));
  }
  return streaks;
};
