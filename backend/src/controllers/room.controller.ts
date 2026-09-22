import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  createRoom,
  getRoomByCode,
  getRoomById,
  isRoomMember,
  leaveRoom as leaveRoomService,
  listRoomMembers,
  joinRoom as joinRoomService,
  listRooms,
} from "../services/room.service";
import { CreateRoomInput } from "../types/room.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

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

  const room = await createRoom({
    name,
    examCategory,
    description,
    creatorUserId,
  });

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

  const result = await joinRoomService(id, userId);

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

  await leaveRoomService(roomId, userId);
  res.status(204).send();
};
