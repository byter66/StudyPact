import crypto from "node:crypto";
import { supabaseAdmin } from "../config/supabase";
import {
  Doubt,
  DoubtImage,
  DoubtImageInput,
  DoubtImageRow,
  DoubtReply,
  DoubtReplyRow,
  DoubtRow,
} from "../types/doubt.types";

const DOUBT_IMAGES_BUCKET = "doubt-images";
export const MAX_DOUBT_IMAGE_COUNT = 3;
const DOUBT_COLUMNS =
  "id, room_id, user_id, content, created_at, updated_at";

const toDoubt = (row: DoubtRow): Doubt => ({
  id: row.id,
  roomId: row.room_id,
  userId: row.user_id,
  authorName: "StudyPact member",
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  images: [],
  replies: [],
});

export const createDoubt = async (
  roomId: string,
  userId: string,
  content: string
): Promise<Doubt> => {
  const { data, error } = await supabaseAdmin
    .from("doubts")
    .insert({
      room_id: roomId,
      user_id: userId,
      content: content.trim(),
    })
    .select(DOUBT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return toDoubt(data as DoubtRow);
};

const toImage = (row: DoubtImageRow, url: string): DoubtImage => ({
  id: row.id,
  storagePath: row.storage_path,
  url,
  createdAt: row.created_at,
});

const getSignedImageUrl = async (storagePath: string) => {
  const { data, error } = await supabaseAdmin.storage
    .from(DOUBT_IMAGES_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
};

const getImagesByDoubtId = async (doubtIds: string[]) => {
  if (doubtIds.length === 0) {
    return new Map<string, DoubtImage[]>();
  }

  const { data, error } = await supabaseAdmin
    .from("doubt_images")
    .select("id, doubt_id, storage_path, created_at")
    .in("doubt_id", doubtIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const imagesByDoubtId = new Map<string, DoubtImage[]>();
  for (const row of (data ?? []) as DoubtImageRow[]) {
    const image = toImage(row, await getSignedImageUrl(row.storage_path));
    const images = imagesByDoubtId.get(row.doubt_id) ?? [];
    images.push(image);
    imagesByDoubtId.set(row.doubt_id, images);
  }

  return imagesByDoubtId;
};

const toReply = (
  row: DoubtReplyRow,
  namesByUserId: Map<string, string>
): DoubtReply => ({
  id: row.id,
  doubtId: row.doubt_id,
  userId: row.user_id,
  authorName: namesByUserId.get(row.user_id) || "StudyPact member",
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listDoubtsForRoom = async (
  roomId: string
): Promise<Doubt[]> => {
  const { data, error } = await supabaseAdmin
    .from("doubts")
    .select(DOUBT_COLUMNS)
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as DoubtRow[];
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds)
    : { data: [], error: null };

  if (profilesError) {
    throw profilesError;
  }

  const namesByUserId = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.full_name || "StudyPact member",
    ])
  );

  const imagesByDoubtId = await getImagesByDoubtId(rows.map((row) => row.id));
  const { data: replyRows, error: repliesError } = rows.length
    ? await supabaseAdmin
        .from("doubt_replies")
        .select("id, doubt_id, user_id, content, created_at, updated_at")
        .in("doubt_id", rows.map((row) => row.id))
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (repliesError) {
    throw repliesError;
  }

  const replies = (replyRows ?? []) as DoubtReplyRow[];
  const replyUserIds = [...new Set(replies.map((reply) => reply.user_id))];
  const { data: replyProfiles, error: replyProfilesError } = replyUserIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", replyUserIds)
    : { data: [], error: null };

  if (replyProfilesError) {
    throw replyProfilesError;
  }

  const replyNamesByUserId = new Map(
    (replyProfiles ?? []).map((profile) => [
      profile.id,
      profile.full_name || "StudyPact member",
    ])
  );
  const repliesByDoubtId = new Map<string, DoubtReply[]>();
  replies.forEach((reply) => {
    const existing = repliesByDoubtId.get(reply.doubt_id) ?? [];
    existing.push(toReply(reply, replyNamesByUserId));
    repliesByDoubtId.set(reply.doubt_id, existing);
  });

  return rows.map((row) => ({
    ...toDoubt(row),
    authorName: namesByUserId.get(row.user_id) || "StudyPact member",
    images: imagesByDoubtId.get(row.id) ?? [],
    replies: repliesByDoubtId.get(row.id) ?? [],
  }));
};

export const createDoubtReply = async (
  roomId: string,
  doubtId: string,
  userId: string,
  content: string
): Promise<DoubtReply | null> => {
  const { data: doubt, error: doubtError } = await supabaseAdmin
    .from("doubts")
    .select("id, room_id")
    .eq("id", doubtId)
    .maybeSingle();

  if (doubtError) {
    throw doubtError;
  }

  if (!doubt || doubt.room_id !== roomId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("doubt_replies")
    .insert({
      doubt_id: doubtId,
      user_id: userId,
      content: content.trim(),
    })
    .select("id, doubt_id, user_id, content, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return toReply(
    data as DoubtReplyRow,
    new Map([[userId, profile?.full_name || "StudyPact member"]])
  );
};

export const uploadDoubtImages = async (
  roomId: string,
  doubtId: string,
  userId: string,
  images: DoubtImageInput[]
): Promise<DoubtImage[]> => {
  const { data: doubt, error: doubtError } = await supabaseAdmin
    .from("doubts")
    .select("id, room_id, user_id")
    .eq("id", doubtId)
    .maybeSingle();

  if (doubtError) {
    throw doubtError;
  }

  if (!doubt || doubt.room_id !== roomId || doubt.user_id !== userId) {
    return [];
  }

  const { count, error: countError } = await supabaseAdmin
    .from("doubt_images")
    .select("id", { count: "exact", head: true })
    .eq("doubt_id", doubtId);

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) + images.length > MAX_DOUBT_IMAGE_COUNT) {
    throw new Error(
      `A doubt can have at most ${MAX_DOUBT_IMAGE_COUNT} images.`
    );
  }

  const uploadedPaths: string[] = [];
  let insertedImageIds: string[] = [];
  try {
    for (const image of images) {
      const extension = image.mimeType.split("/")[1] || "bin";
      const storagePath =
        `${roomId}/${doubtId}/${userId}/${crypto.randomUUID()}.${extension}`;
      const buffer = Buffer.from(image.data, "base64");
      const { error: uploadError } = await supabaseAdmin.storage
        .from(DOUBT_IMAGES_BUCKET)
        .upload(storagePath, buffer, {
          contentType: image.mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }
      uploadedPaths.push(storagePath);
    }

    const { data, error: insertError } = await supabaseAdmin
      .from("doubt_images")
      .insert(
        uploadedPaths.map((storagePath) => ({
          doubt_id: doubtId,
          storage_path: storagePath,
        }))
      )
      .select("id, doubt_id, storage_path, created_at");

    if (insertError) {
      throw insertError;
    }

    const insertedRows = (data ?? []) as DoubtImageRow[];
    insertedImageIds = insertedRows.map((row) => row.id);
    return Promise.all(
      insertedRows.map(async (row) =>
        toImage(row, await getSignedImageUrl(row.storage_path))
      )
    );
  } catch (error) {
    if (insertedImageIds.length > 0) {
      await supabaseAdmin
        .from("doubt_images")
        .delete()
        .in("id", insertedImageIds);
    }
    if (uploadedPaths.length > 0) {
      await supabaseAdmin.storage
        .from(DOUBT_IMAGES_BUCKET)
        .remove(uploadedPaths);
    }
    throw error;
  }
};
