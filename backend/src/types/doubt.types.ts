export interface Doubt {
  id: string;
  roomId: string;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  images: DoubtImage[];
  replies: DoubtReply[];
}

export interface DoubtReply {
  id: string;
  doubtId: string;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoubtReplyRow {
  id: string;
  doubt_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DoubtImage {
  id: string;
  storagePath: string;
  url: string;
  createdAt: string;
}

export interface DoubtImageRow {
  id: string;
  doubt_id: string;
  storage_path: string;
  created_at: string;
}

export interface DoubtImageInput {
  data: string;
  mimeType: string;
}

export interface DoubtRow {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}
