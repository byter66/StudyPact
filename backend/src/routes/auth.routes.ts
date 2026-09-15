import { Router } from "express";
import {
  getCurrentUserController,
  loginController,
  registerController,
  requestOtpController,
  signOutController,
  verifyOtpController,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/send-otp", requestOtpController);
router.post("/request-otp", requestOtpController);
router.post("/register", registerController);
router.post("/login", loginController);
router.post("/verify-otp", verifyOtpController);
router.get("/me", requireAuth, getCurrentUserController);
router.post("/signout", requireAuth, signOutController);

export default router;
