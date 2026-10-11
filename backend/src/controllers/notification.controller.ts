import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { listNotifications, markNotificationRead } from "../services/notification.service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });
    const notifications = await listNotifications(userId);
    return res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error("Unable to load notifications:", error);
    return res.status(500).json({ success: false, message: "Unable to load notifications." });
  }
};

export const readNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rawNotificationId = req.params.notificationId;
    const notificationId = Array.isArray(rawNotificationId) ? rawNotificationId[0] : rawNotificationId;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!UUID_PATTERN.test(notificationId)) return res.status(400).json({ success: false, message: "Invalid notification ID." });
    const updated = await markNotificationRead(userId, notificationId);
    if (!updated) return res.status(404).json({ success: false, message: "Notification not found." });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Unable to update notification:", error);
    return res.status(500).json({ success: false, message: "Unable to update notification." });
  }
};
