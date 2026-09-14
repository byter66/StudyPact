import { Request, Response } from "express";
import { createRoom, getRoomById, listRooms } from "../services/room.service";
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

export const postRoom = async (req: Request, res: Response) => {
  const { name, examCategory, description, creatorUserId } = req.body as Partial<CreateRoomInput>;

  if (!isNonEmptyString(name) || !isNonEmptyString(examCategory)) {
    res.status(400).json({
      success: false,
      message: "name and examCategory are required",
    });
    return;
  }

  if (!isNonEmptyString(creatorUserId) || !UUID_PATTERN.test(creatorUserId)) {
    res.status(400).json({
      success: false,
      message: "creatorUserId must be a valid user ID",
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
