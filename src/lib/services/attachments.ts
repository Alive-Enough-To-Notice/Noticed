// Image/video/audio attached to a ContentDraft — see the DraftAttachment
// model comment in schema.prisma. Two entry points, one storage shape:
// saveAttachmentFromBase64 for an AI-generated image arriving via MCP,
// attachExistingMedia for copying in an already-recorded/cleaned file from
// the Media Studio (Recording/MediaExport). Both always end up as this
// service's own file on disk, so the publish layer only has one shape to
// deal with regardless of where the media came from.
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";

const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR || path.join(process.cwd(), "attachments");

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "bin";
}

function kindForMimeType(mimeType: string): "IMAGE" | "VIDEO" | "AUDIO" {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  return "AUDIO";
}

export async function saveAttachmentFromBase64(args: {
  contentDraftId: string;
  base64: string;
  mimeType: string;
}) {
  await fs.mkdir(ATTACHMENTS_DIR, { recursive: true });
  const attachment = await prisma.draftAttachment.create({
    data: {
      contentDraftId: args.contentDraftId,
      kind: kindForMimeType(args.mimeType),
      mimeType: args.mimeType,
      filePath: "",
    },
  });
  const filePath = path.join(ATTACHMENTS_DIR, `${attachment.id}.${extensionForMimeType(args.mimeType)}`);
  await fs.writeFile(filePath, Buffer.from(args.base64, "base64"));
  return prisma.draftAttachment.update({ where: { id: attachment.id }, data: { filePath } });
}

export async function attachExistingMedia(args: {
  contentDraftId: string;
  sourceFilePath: string;
  mimeType: string;
}) {
  await fs.mkdir(ATTACHMENTS_DIR, { recursive: true });
  const attachment = await prisma.draftAttachment.create({
    data: {
      contentDraftId: args.contentDraftId,
      kind: kindForMimeType(args.mimeType),
      mimeType: args.mimeType,
      filePath: "",
    },
  });
  const filePath = path.join(ATTACHMENTS_DIR, `${attachment.id}.${extensionForMimeType(args.mimeType)}`);
  await fs.copyFile(args.sourceFilePath, filePath);
  return prisma.draftAttachment.update({ where: { id: attachment.id }, data: { filePath } });
}

export async function deleteAttachment(id: string) {
  const attachment = await prisma.draftAttachment.findUniqueOrThrow({ where: { id } });
  await prisma.draftAttachment.delete({ where: { id } });
  if (attachment.filePath) await fs.rm(attachment.filePath, { force: true });
}
