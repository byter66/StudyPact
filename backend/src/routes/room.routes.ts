import { Router } from "express";
import { getRoom, getRooms, postRoom } from "../controllers/room.controller";

const router = Router();

router.get("/", getRooms);
router.get("/:id", getRoom);
router.post("/", postRoom);

export default router;
