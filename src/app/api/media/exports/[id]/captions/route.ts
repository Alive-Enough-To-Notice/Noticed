import fsp from "node:fs/promises";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.mediaExport.findUnique({ where: { id } });
  if (!item?.captionsPath || item.status !== "READY") return Response.json({ error: "Captions not ready" }, { status: 404 });
  try { return new Response(await fsp.readFile(item.captionsPath), { headers: { "Content-Type": "text/vtt; charset=utf-8", "Content-Disposition": `attachment; filename="noticed-captions-${id}.vtt"` } }); }
  catch { return Response.json({ error: "Caption file missing" }, { status: 404 }); }
}
