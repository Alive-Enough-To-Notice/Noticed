import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";

// Streams a recording's raw audio file back for playback — files live on
// disk (see Recording.filePath), never in the database.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const recording = await prisma.recording.findUnique({ where: { id } });

  if (!recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  const buffer = await fs.readFile(recording.filePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": recording.mimeType },
  });
}
