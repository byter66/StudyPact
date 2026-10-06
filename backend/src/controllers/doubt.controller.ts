import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { isRoomMember } from "../services/room.service";
import {
  createDoubt,
  listDoubtsForRoom,
  createDoubtReply,
  uploadDoubtImages,
} from "../services/doubt.service";
import { DoubtImageInput } from "../types/doubt.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DOUBT_LENGTH = 5000;
const MAX_IMAGE_COUNT = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const isValidUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

export const postDoubt = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const { roomId } = req.params;
  const userId = req.user?.id;
  const content =
    typeof req.body?.content === "string" ? req.body.content.trim() : "";

  if (!isValidUuid(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  if (!userId || !isValidUuid(userId)) {
    res.status(401).json({
      success: false,
      message: "Authenticated user ID must be a valid UUID",
    });
    return;
  }

  if (!content || content.length > MAX_DOUBT_LENGTH) {
    res.status(400).json({
      success: false,
      message: "content must be between 1 and 5000 characters",
    });
    return;
  }

  if (!(await isRoomMember(roomId, userId))) {
    res.status(403).json({
      success: false,
      message: "Join this room before posting a doubt.",
    });
    return;
  }

  const doubt = await createDoubt(roomId, userId, content);
  res.status(201).json({ success: true, data: doubt });
};

export const getDoubts = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const { roomId } = req.params;
  const userId = req.user?.id;

  if (!isValidUuid(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room ID" });
    return;
  }

  if (!userId || !isValidUuid(userId)) {
    res.status(401).json({
      success: false,
      message: "Authenticated user ID must be a valid UUID",
    });
    return;
  }

  if (!(await isRoomMember(roomId, userId))) {
    res.status(403).json({
      success: false,
      message: "Join this room before viewing its doubts.",
    });
    return;
  }

  const doubts = await listDoubtsForRoom(roomId);
  res.status(200).json({ success: true, data: doubts });
};

export const postDoubtImages = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const { roomId, doubtId } = req.params;
  const userId = req.user?.id;
  const images = req.body?.images;

  if (!isValidUuid(roomId) || !isValidUuid(doubtId)) {
    res.status(400).json({ success: false, message: "Invalid room or doubt ID" });
    return;
  }

  if (!userId || !isValidUuid(userId)) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return;
  }

  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGE_COUNT) {
    res.status(400).json({
      success: false,
      message: `Attach between 1 and ${MAX_IMAGE_COUNT} images.`,
    });
    return;
  }

  const validatedImages: DoubtImageInput[] = [];
  for (const image of images) {
    if (
      !image ||
      typeof image.data !== "string" ||
      typeof image.mimeType !== "string" ||
      !ALLOWED_IMAGE_TYPES.has(image.mimeType) ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)
    ) {
      res.status(400).json({
        success: false,
        message: "Only JPEG, PNG, WebP, and GIF images are supported.",
      });
      return;
    }

    const buffer = Buffer.from(image.data, "base64");
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      res.status(400).json({
        success: false,
        message: "Each image must be 3 MB or smaller.",
      });
      return;
    }
    validatedImages.push({ data: image.data, mimeType: image.mimeType });
  }

  if (!(await isRoomMember(roomId, userId))) {
    res.status(403).json({
      success: false,
      message: "Join this room before uploading doubt images.",
    });
    return;
  }

  let uploadedImages: Awaited<ReturnType<typeof uploadDoubtImages>>;
  try {
    uploadedImages = await uploadDoubtImages(
      roomId,
      doubtId,
      userId,
      validatedImages
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("A doubt can have at most")
    ) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    throw error;
  }

  if (uploadedImages.length !== validatedImages.length) {
    res.status(403).json({
      success: false,
      message: "You can only upload images to your own doubt in this room.",
    });
    return;
  }

  res.status(201).json({ success: true, data: uploadedImages });
};

export const postDoubtReply = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const { roomId, doubtId } = req.params;
  const userId = req.user?.id;
  const content =
    typeof req.body?.content === "string" ? req.body.content.trim() : "";

  if (!isValidUuid(roomId) || !isValidUuid(doubtId)) {
    res.status(400).json({ success: false, message: "Invalid room or doubt ID" });
    return;
  }

  if (!userId || !isValidUuid(userId)) {
    res.status(401).json({
      success: false,
      message: "Authenticated user ID must be a valid UUID",
    });
    return;
  }

  if (!content || content.length > MAX_DOUBT_LENGTH) {
    res.status(400).json({
      success: false,
      message: "content must be between 1 and 5000 characters",
    });
    return;
  }

  if (!(await isRoomMember(roomId, userId))) {
    res.status(403).json({
      success: false,
      message: "Join this room before replying to a doubt.",
    });
    return;
  }

  const reply = await createDoubtReply(roomId, doubtId, userId, content);
  if (!reply) {
    res.status(404).json({
      success: false,
      message: "Doubt not found in this room.",
    });
    return;
  }

  res.status(201).json({ success: true, data: reply });
};
