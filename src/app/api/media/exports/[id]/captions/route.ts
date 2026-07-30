import path from "node:path";
import fsp from "node:fs/promises";
import { prisma } from "@/lib/prisma";

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(process.cwd(), "recordings");

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.mediaExport.findUnique({ where: { id } });
  if (!item?.captionsPath || item.status !== "READY") return Response.json({ error: "Captions not ready" }, { status: 404 });
  const captionsPath = path.join(RECORDINGS_DIR, path.basename(item.captionsPath));
  try { return new Response(await fsp.readFile(captionsPath), { headers: { "Content-Type": "text/vtt; charset=utf-8", "Content-Disposition": `attachment; filename="noticed-captions-${id}.vtt"` } }); }
  catch { return Response.json({ error: "Caption file missing" }, { status: 404 }); }
}
