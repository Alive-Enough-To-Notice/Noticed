import { NextRequest, NextResponse } from "next/server";
import { createRecording } from "@/lib/services/recordings";

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

  const buffer = Buffer.from(await file.arrayBuffer());
  const recording = await createRecording({
    contentProjectId,
    buffer,
    mimeType: file.type || "audio/webm",
  });

  return NextResponse.json({ recording });
}
