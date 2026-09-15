import { NextFunction, Request, Response } from "express";
import { getCurrentUser, loginUser, registerUser, requestOtp, signOut, verifyOtp } from "../services/auth.service";

export const requestOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone, fullName } = req.body ?? {};

    const { data, error } = await requestOtp(phone, fullName);

    if (error || !data) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Unable to send OTP.",
      });
    }

    return res.status(200).json({
      success: true,
      message: data.message,
      phone: data.phone,
      otp: data.otp,
      devMode: data.devMode,
    });
  } catch (error) {
    return next(error);
  }
};

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone, fullName } = req.body ?? {};

    const { data, error } = await registerUser(phone, fullName);

    if (error || !data) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Unable to register user.",
      });
    }

    return res.status(200).json({
      success: true,
      message: data.message,
      phone: data.phone,
      otp: data.otp,
      devMode: data.devMode,
    });
  } catch (error) {
    return next(error);
  }
};

export const loginController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone, token, fullName } = req.body ?? {};

    if (!phone || !token) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required.",
      });
    }

    const { data, error } = await loginUser(phone, token, fullName);

    if (error || !data) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Login failed.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Phone authentication successful.",
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone, token, fullName } = req.body ?? {};

    if (!phone || !token) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required.",
      });
    }

    const { data, error } = await verifyOtp(phone, token, fullName);

    if (error || !data) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "OTP verification failed.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Phone authentication successful.",
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    return next(error);
  }
};

export const getCurrentUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const { data, error } = await getCurrentUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        message: "Your session is invalid or expired.",
      });
    }

    const metadata = (data.user.user_metadata ?? {}) as Record<string, any>;

    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        phone: (data.user as any).phone ?? metadata.phone ?? null,
        full_name: metadata.full_name ?? metadata.name ?? null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const signOutController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const { error } = await signOut(token);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Signed out successfully.",
    });
  } catch (error) {
    return next(error);
  }
};
