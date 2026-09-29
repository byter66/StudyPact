import { Router } from "express";
import {
  getUserTasks,
  patchUserTask,
  postUserTask,
} from "../controllers/userTask.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/tasks", requireAuth, getUserTasks);
router.post("/tasks", requireAuth, postUserTask);
router.patch("/tasks/:id", requireAuth, patchUserTask);

export default router;
