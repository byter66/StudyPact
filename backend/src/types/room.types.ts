export interface Room {
  id: string;
  name: string;
  examCategory: string;
  description: string;
  creatorUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomInput {
  name: string;
  examCategory: string;
  description?: string;
  creatorUserId: string;
}

export interface RoomRow {
  id: string;
  name: string;
  exam_category: string;
  description: string;
  creator_user_id: string;
  created_at: string;
  updated_at: string;
}
