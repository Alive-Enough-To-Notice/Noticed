import { renderRecording } from "@/lib/services/media-exports";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { return Response.json({ mediaExport: await renderRecording(id) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 }); }
}
