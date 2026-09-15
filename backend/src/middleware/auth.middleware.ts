import { NextFunction, Request, Response } from "express";
import { getCurrentUser } from "../services/auth.service";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
    full_name?: string | null;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
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

  req.user = {
    id: data.user.id,
    email: data.user.email,
    phone: (data.user as any).phone ?? metadata.phone ?? null,
    full_name: metadata.full_name ?? metadata.name ?? null,
  };

  return next();
};
