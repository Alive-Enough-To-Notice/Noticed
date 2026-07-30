import path from "path";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(process.cwd(), "recordings");

// Streams a recording's raw audio file back for playback — files live on
// disk (see Recording.filePath), never in the database. Only the
// generated basename is trusted from the DB — see the matching
// constraint in recordings/[id]/source/route.ts.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const recording = await prisma.recording.findUnique({ where: { id } });

  if (!recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  const filePath = path.join(RECORDINGS_DIR, path.basename(recording.filePath));
  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": recording.mimeType },
    });
  } catch {
    return NextResponse.json({ error: "The original media file is missing." }, { status: 404 });
  }
}
