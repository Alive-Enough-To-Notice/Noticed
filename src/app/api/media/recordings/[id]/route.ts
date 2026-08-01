import { prisma } from "@/lib/prisma";
import { deleteRecording } from "@/lib/services/recordings";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.recording.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Recording not found" }, { status: 404 });
  await deleteRecording(id);
  return Response.json({ ok: true });
}
