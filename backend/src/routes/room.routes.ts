import { Router } from "express";
import {
  getRoom,
  getRoomByJoinCode,
  getMembers,
  getRooms,
  leaveRoom,
  joinRoom,
  postRoom,
} from "../controllers/room.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", getRooms);
router.get("/code/:code", getRoomByJoinCode);
router.get("/:id", getRoom);
router.post("/", requireAuth, postRoom);
router.post("/:id/join", requireAuth, joinRoom);
router.get("/:id/members", requireAuth, getMembers);
router.delete("/:id/membership", requireAuth, leaveRoom);

export default router;
