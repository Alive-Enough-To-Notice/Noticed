import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";

const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR || path.join(process.cwd(), "attachments");

// Deliberately public (see proxy.ts's passthrough list) — Narrareach's own
// servers, acting on behalf of Instagram/TikTok/Pinterest, have to fetch
// this without an owner session cookie. Protected only by the attachment
// id being an unguessable cuid, same posture as feed.xml.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await prisma.draftAttachment.findUnique({ where: { id } });
  if (!attachment?.filePath) return Response.json({ error: "Attachment not found" }, { status: 404 });
  // Only the generated basename is trusted from the database — same
  // constraint as the other file-serving routes in this app.
  const filePath = path.join(ATTACHMENTS_DIR, path.basename(attachment.filePath));
  try {
    const stat = await fsp.stat(filePath);
    return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, {
      headers: { "Content-Type": attachment.mimeType, "Content-Length": String(stat.size) },
    });
  } catch {
    return Response.json({ error: "Attachment file missing" }, { status: 404 });
  }
}
