import { Router } from "express";
import {
  getRoom,
  getRooms,
  joinRoom,
  postRoom,
} from "../controllers/room.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", getRooms);
router.get("/:id", getRoom);
router.post("/", requireAuth, postRoom);
router.post("/:id/join", requireAuth, joinRoom);

export default router;
