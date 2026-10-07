import { supabase, supabaseAdmin } from "../config/supabase";
import {
  getRoomCurrentStreaks,
  requireDailyGoalForToday,
} from "./dailyGoal.service";
import {
  CreateRoomInput,
  JoinRoomResult,
  Room,
  RoomLeaderboardEntry,
  RoomMember,
  RoomRow,
} from "../types/room.types";

const ROOM_COLUMNS =
  "id, room_code, name, exam_category, description, creator_user_id, created_at, updated_at";

const toRoom = (row: RoomRow): Room => ({
  id: row.id,
  roomCode: row.room_code,
  name: row.name,
  examCategory: row.exam_category,
  description: row.description,
  creatorUserId: row.creator_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listRooms = async (): Promise<Room[]> => {
  const { data, error } = await supabase
    .from("rooms")
    .select(ROOM_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as RoomRow[]).map(toRoom);
};

export const getRoomById = async (id: string): Promise<Room | null> => {
  const { data, error } = await supabase
    .from("rooms")
    .select(ROOM_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toRoom(data as RoomRow) : null;
};

export const getRoomByCode = async (roomCode: string): Promise<Room | null> => {
  const { data, error } = await supabase
    .from("rooms")
    .select(ROOM_COLUMNS)
    .ilike("room_code", roomCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toRoom(data as RoomRow) : null;
};

export const createRoom = async (input: CreateRoomInput): Promise<Room> => {
  await requireDailyGoalForToday(
    input.creatorUserId,
    "Add at least one daily goal before creating a room."
  );

  const { data, error } = await supabaseAdmin
    .from("rooms")
    .insert({
      name: input.name.trim(),
      exam_category: input.examCategory.trim(),
      description: input.description?.trim() ?? "",
      creator_user_id: input.creatorUserId,
    })
    .select(ROOM_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const room = toRoom(data as RoomRow);

  const { error: membershipError } = await supabaseAdmin
    .from("room_members")
    .insert({
      room_id: room.id,
      user_id: input.creatorUserId,
    });

  if (membershipError) {
    throw membershipError;
  }

  return room;
};

export const joinRoom = async (
  roomId: string,
  userId: string
): Promise<JoinRoomResult | null> => {
  await requireDailyGoalForToday(
    userId,
    "Add at least one daily goal before joining a room."
  );

  const room = await getRoomById(roomId);

  if (!room) {
    return null;
  }

  const { data: existingMembership, error: membershipLookupError } =
    await supabaseAdmin
      .from("room_members")
      .select("room_id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

  if (membershipLookupError) {
    throw membershipLookupError;
  }

  if (existingMembership) {
    return {
      room,
      alreadyMember: true,
    };
  }

  const { error: membershipError } = await supabaseAdmin
    .from("room_members")
    .insert({
      room_id: roomId,
      user_id: userId,
    });

  if (membershipError) {
    if (membershipError.code === "23505") {
      return {
        room,
        alreadyMember: true,
      };
    }

    throw membershipError;
  }

  return {
    room,
    alreadyMember: false,
  };
};

export const listRoomMembers = async (
  roomId: string
): Promise<RoomMember[]> => {
  const { data, error } = await supabaseAdmin
    .from("room_members")
    .select("user_id, joined_at")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  const userIds = (data ?? []).map((member) => member.user_id);
  const { data: profiles, error: profileError } = userIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds)
    : { data: [], error: null };

  if (profileError) {
    throw profileError;
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name])
  );

  return (data ?? []).map((member) => ({
    userId: member.user_id,
    displayName: profileById.get(member.user_id) || "StudyPact member",
    joinedAt: member.joined_at,
  }));
};

export const listRoomLeaderboard = async (
  roomId: string
): Promise<RoomLeaderboardEntry[]> => {
  const members = await listRoomMembers(roomId);
  const streaks = await getRoomCurrentStreaks(
    roomId,
    members.map((member) => member.userId)
  );

  return members
    .map((member) => ({
      userId: member.userId,
      name: member.displayName,
      streak: streaks.get(member.userId) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.streak - left.streak ||
        left.name.localeCompare(right.name) ||
        left.userId.localeCompare(right.userId)
    );
};

export const isRoomMember = async (
  roomId: string,
  userId: string
): Promise<boolean> => {
  const { data, error } = await supabaseAdmin
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
};

export class MockExamLifecycleActiveError extends Error {
  statusCode = 409;

  constructor() {
    super("You cannot leave this Study Room while your mock-exam evaluation is still in progress.");
    this.name = "MockExamLifecycleActiveError";
  }
}

const hasActiveMockExamLifecycle = async (roomId: string, userId: string) => {
  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("mock_sessions")
    .select("id, ends_at, status")
    .eq("room_id", roomId);
  if (sessionsError) throw sessionsError;

  const activeSessions = (sessions ?? []).filter((session) => (
    session.status === "live"
    && session.ends_at
    && Date.now() < Date.parse(session.ends_at)
  ));
  const sessionIds = activeSessions.map((session) => session.id);
  if (!sessionIds.length) return false;

  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from("participant_attempts")
    .select("id, status")
    .in("session_id", sessionIds)
    .eq("participant_id", userId);
  if (attemptsError) throw attemptsError;

  return (attempts ?? []).some((attempt) => attempt.status === "in_progress");
};

export const leaveRoom = async (roomId: string, userId: string): Promise<void> => {
  if (await hasActiveMockExamLifecycle(roomId, userId)) {
    throw new MockExamLifecycleActiveError();
  }

  const { error } = await supabaseAdmin
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
};
