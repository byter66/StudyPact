import { Router } from "express";
import {
  getDoubts,
  postDoubt,
  postDoubtImages,
  postDoubtReply,
} from "../controllers/doubt.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/rooms/:roomId/doubts", requireAuth, postDoubt);
router.get("/rooms/:roomId/doubts", requireAuth, getDoubts);
router.post(
  "/rooms/:roomId/doubts/:doubtId/images",
  requireAuth,
  postDoubtImages
);
router.post(
  "/rooms/:roomId/doubts/:doubtId/replies",
  requireAuth,
  postDoubtReply
);

export default router;
