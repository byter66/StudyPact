import { Router } from "express";
import { getNotifications, readNotification } from "../controllers/notification.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.get("/notifications", requireAuth, getNotifications);
router.patch("/notifications/:notificationId/read", requireAuth, readNotification);
export default router;
