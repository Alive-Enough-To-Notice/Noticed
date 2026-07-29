import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json() as { startSeconds?: number; endSeconds?: number; label?: string; source?: string; status?: string };
  const startSeconds = Number(body.startSeconds);
  const endSeconds = Number(body.endSeconds);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0 || endSeconds <= startSeconds) return Response.json({ error: "Choose a valid transcript range." }, { status: 400 });
  const recording = await prisma.recording.findUnique({ where: { id } });
  if (!recording) return Response.json({ error: "Recording not found" }, { status: 404 });
  if (recording.durationSeconds && endSeconds > recording.durationSeconds + 0.25) return Response.json({ error: "The selection extends beyond the recording." }, { status: 400 });
  const decision = await prisma.editDecision.create({ data: { recordingId: id, startSeconds, endSeconds, label: String(body.label || "Removed from cleaned copy"), source: body.source === "MARKER" ? "MARKER" : "MANUAL", status: body.status === "APPLIED" ? "APPLIED" : "PROPOSED" } });
  return Response.json({ decision });
}
