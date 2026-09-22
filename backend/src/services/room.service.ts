import { supabase, supabaseAdmin } from "../config/supabase";
import {
  CreateRoomInput,
  JoinRoomResult,
  Room,
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

export const leaveRoom = async (roomId: string, userId: string): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
};
