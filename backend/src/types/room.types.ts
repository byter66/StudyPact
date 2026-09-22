export interface Room {
  id: string;
  roomCode: string;
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

export interface JoinRoomResult {
  room: Room;
  alreadyMember: boolean;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  joinedAt: string;
}

export interface RoomRow {
  id: string;
  room_code: string;
  name: string;
  exam_category: string;
  description: string;
  creator_user_id: string;
  created_at: string;
  updated_at: string;
}
