import { after, NextRequest, NextResponse } from "next/server";
import { createRecording, transcribeRecording } from "@/lib/services/recordings";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_MEDIA_BYTES = 250 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg",
  "video/webm", "video/mp4", "video/quicktime",
]);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const contentProjectId = String(formData.get("contentProjectId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "AUDIO") === "VIDEO" ? "VIDEO" : "AUDIO";
  const file = formData.get("media") as File | null;
  if (!contentProjectId) return NextResponse.json({ error: "This recording is missing its project." }, { status: 400 });
  if (!file) return NextResponse.json({ error: "Choose or record an audio or video file." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_MEDIA_BYTES) return NextResponse.json({ error: "The file must be between 1 byte and 250 MB." }, { status: 413 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: `That file type is not supported yet (${file.type || "unknown"}).` }, { status: 415 });

  const recording = await createRecording({
    contentProjectId,
    buffer: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type,
    originalFileName: file.name,
    mediaKind: kind,
    transcribeImmediately: false,
  });
  after(async () => { await transcribeRecording(recording.id); });
  return NextResponse.json({ recording }, { status: 202 });
}
