import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(process.cwd(), "recordings");

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.mediaExport.findUnique({ where: { id } });
  if (!item?.filePath || item.status !== "READY") return Response.json({ error: "Export not ready" }, { status: 404 });
  // Only the generated basename is trusted from the database — see the
  // matching constraint in recordings/[id]/source/route.ts.
  const filePath = path.join(RECORDINGS_DIR, path.basename(item.filePath));
  try {
    const stat = await fsp.stat(filePath);
    return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, { headers: { "Content-Type": item.mimeType || "application/octet-stream", "Content-Length": String(stat.size), "Content-Disposition": `attachment; filename="noticed-clean-${id}.${item.mimeType === "video/mp4" ? "mp4" : "mp3"}"` } });
  } catch { return Response.json({ error: "Export file missing" }, { status: 404 }); }
}
