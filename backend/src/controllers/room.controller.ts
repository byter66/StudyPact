import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  createRoom,
  getRoomByCode,
  getRoomById,
  isRoomMember,
  leaveRoom as leaveRoomService,
  MockExamLifecycleActiveError,
  listRoomLeaderboard,
  listRoomMembers,
  joinRoom as joinRoomService,
  listRooms,
} from "../services/room.service";
import { CreateRoomInput, JoinRoomResult, Room } from "../types/room.types";
import { TaskRequirementError } from "../types/userTask.types";
import { getRoomMemberDailyGoals } from "../services/dailyGoal.service";
import {
  DailyGoalRequirementError,
  DailyGoalServiceError,
} from "../types/dailyGoal.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const handleTaskRequirementError = (
  error: unknown,
  res: Response
): boolean => {
  if (!(error instanceof TaskRequirementError)) {
    return false;
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
  });
  return true;
};

const handleRoomEligibilityError = (error: unknown, res: Response): boolean => {
  if (error instanceof DailyGoalRequirementError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return true;
  }
  return handleTaskRequirementError(error, res);
};

export const getRooms = async (_req: Request, res: Response) => {
  const rooms = await listRooms();
  res.status(200).json({ success: true, data: rooms });
};

export const getRoom = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  const room = await getRoomById(id);

  if (!room) {
    res.status(404).json({ success: false, message: "Room not found" });
    return;
  }

  res.status(200).json({ success: true, data: room });
};

export const getRoomByJoinCode = async (req: Request, res: Response) => {
  const roomCodeParam = req.params.code;
  const roomCode = typeof roomCodeParam === "string" ? roomCodeParam.trim() : "";
  if (!roomCode || !/^[A-Za-z0-9]{6}$/.test(roomCode)) {
    res.status(400).json({ success: false, message: "Invalid room code" });
    return;
  }

  const room = await getRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ success: false, message: "Room not found" });
    return;
  }

  res.status(200).json({ success: true, data: room });
};

export const postRoom = async (req: AuthenticatedRequest, res: Response) => {
  const { name, examCategory, description } = req.body as Partial<CreateRoomInput>;

  if (!isNonEmptyString(name) || !isNonEmptyString(examCategory)) {
    res.status(400).json({
      success: false,
      message: "name and examCategory are required",
    });
    return;
  }

  const creatorUserId = req.user?.id;

  if (!creatorUserId || !UUID_PATTERN.test(creatorUserId)) {
    res.status(400).json({
      success: false,
      message: "Authenticated user ID must be a valid UUID",
    });
    return;
  }

  if (description !== undefined && typeof description !== "string") {
    res.status(400).json({
      success: false,
      message: "description must be a string",
    });
    return;
  }

  let room: Room;
  try {
    room = await createRoom({
      name,
      examCategory,
      description,
      creatorUserId,
    });
  } catch (error) {
    if (!handleRoomEligibilityError(error, res)) {
      throw error;
    }
    return;
  }

  res.status(201).json({ success: true, data: room });
};

export const joinRoom = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  if (!userId || !UUID_PATTERN.test(userId)) {
    res.status(400).json({
      success: false,
      message: "Authenticated user ID must be a valid UUID",
    });
    return;
  }

  let result: JoinRoomResult | null;
  try {
    result = await joinRoomService(id, userId);
  } catch (error) {
    if (!handleRoomEligibilityError(error, res)) {
      throw error;
    }
    return;
  }

  if (!result) {
    res.status(404).json({ success: false, message: "Room not found" });
    return;
  }

  res.status(200).json({
    success: true,
    message: result.alreadyMember
      ? "You are already a member of this room."
      : "Joined room successfully.",
    data: result,
  });
};

export const getMembers = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const roomId = req.params.id;
  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  const room = await getRoomById(roomId);
  if (!room) {
    res.status(404).json({ success: false, message: "Room not found" });
    return;
  }

  if (!req.user?.id || !(await isRoomMember(roomId, req.user.id))) {
    res.status(403).json({
      success: false,
      message: "Join this room before viewing its members.",
    });
    return;
  }

  const members = await listRoomMembers(roomId);
  res.status(200).json({ success: true, data: members });
};

export const getRoomDailyGoals = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const roomId = req.params.roomId;
  const userId = req.user?.id;

  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }
  if (!userId) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return;
  }

  try {
    const goals = await getRoomMemberDailyGoals(roomId, userId);
    res.status(200).json({ success: true, data: goals });
  } catch (error) {
    if (error instanceof DailyGoalServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    throw error;
  }
};

export const getRoomLeaderboard = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const roomId = req.params.roomId;
  const userId = req.user?.id;

  if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  if (!userId || !(await isRoomMember(roomId, userId))) {
    res.status(403).json({
      success: false,
      message: "Join this room before viewing its leaderboard.",
    });
    return;
  }

  const leaderboard = await listRoomLeaderboard(roomId);
  res.status(200).json({ success: true, data: leaderboard });
};

export const leaveRoom = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const roomId = req.params.id;
  const userId = req.user?.id;
  if (
    typeof roomId !== "string" ||
    !UUID_PATTERN.test(roomId) ||
    !userId ||
    !UUID_PATTERN.test(userId)
  ) {
    res.status(400).json({ success: false, message: "Invalid room membership request" });
    return;
  }

  const room = await getRoomById(roomId);
  if (!room) {
    res.status(404).json({ success: false, message: "Room not found" });
    return;
  }

  try {
    await leaveRoomService(roomId, userId);
  } catch (error) {
    if (error instanceof MockExamLifecycleActiveError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    throw error;
  }
  res.status(204).send();
};
