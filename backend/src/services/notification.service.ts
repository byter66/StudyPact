import { supabaseAdmin } from "../config/supabase";

export const listNotifications = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, doubt_id, room_id, message, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};
