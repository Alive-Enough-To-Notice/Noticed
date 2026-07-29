import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; decisionId: string }> }) {
  const { id, decisionId } = await params;
  const body = await request.json() as { status?: string };
  if (!body.status || !["APPLIED", "REJECTED", "PROPOSED"].includes(body.status)) return Response.json({ error: "Invalid decision status." }, { status: 400 });
  const existing = await prisma.editDecision.findFirst({ where: { id: decisionId, recordingId: id } });
  if (!existing) return Response.json({ error: "Edit decision not found" }, { status: 404 });
  const decision = await prisma.editDecision.update({ where: { id: decisionId }, data: { status: body.status as "APPLIED" | "REJECTED" | "PROPOSED" } });
  return Response.json({ decision });
}
