import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recording = await prisma.recording.findUnique({ where: { id } });
  if (!recording) return Response.json({ error: "Recording not found" }, { status: 404 });
  const storageRoot = process.env.RECORDINGS_DIR || path.join(process.cwd(), "recordings");
  // Only the generated basename is trusted from the database. Constraining
  // the final path to this known directory also keeps standalone tracing
  // from treating an arbitrary absolute path as an application dependency.
  const filePath = path.join(storageRoot, path.basename(recording.filePath));
  let stat;
  try { stat = await fsp.stat(filePath); } catch { return Response.json({ error: "The original media file is missing." }, { status: 404 }); }

  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers: { "Content-Type": recording.mimeType, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, { headers: { "Content-Type": recording.mimeType, "Accept-Ranges": "bytes", "Content-Length": String(stat.size) } });
}
