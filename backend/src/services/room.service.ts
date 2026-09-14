import { supabase } from "../config/supabase";
import { CreateRoomInput, Room, RoomRow } from "../types/room.types";

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
  const { data, error } = await supabase
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

  return toRoom(data as RoomRow);
};
