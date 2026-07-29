import { NextRequest, NextResponse } from "next/server";
import { createRecording } from "@/lib/services/recordings";

const MAX_RECORDING_BYTES = 50 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
]);

// Receives a recorded audio blob from the browser, saves it, and transcribes
// it locally (whisper.cpp) before responding — see
// src/lib/services/recordings.ts for why this is synchronous in this slice.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const contentProjectId = String(formData.get("contentProjectId") ?? "");
  const file = formData.get("audio") as File | null;

  if (!contentProjectId) {
    return NextResponse.json({ error: "contentProjectId is required" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_RECORDING_BYTES) {
    return NextResponse.json(
      { error: "Audio must be larger than 0 bytes and no larger than 50 MB." },
      { status: 413 },
    );
  }
  if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported audio type: ${file.type || "unknown"}` },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const recording = await createRecording({
    contentProjectId,
    buffer,
    mimeType: file.type || "audio/webm",
  });

  return NextResponse.json({ recording });
}
