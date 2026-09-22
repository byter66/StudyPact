import { supabase, supabaseAdmin } from "../config/supabase";
import {
  CreateRoomInput,
  JoinRoomResult,
  Room,
  RoomRow,
} from "../types/room.types";

const ROOM_COLUMNS =
  "id, name, exam_category, description, creator_user_id, created_at, updated_at";

const toRoom = (row: RoomRow): Room => ({
  id: row.id,
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
