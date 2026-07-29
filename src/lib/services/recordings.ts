// Local audio capture + local transcription — no model API involved anywhere
// in this file. whisper.cpp runs entirely on this machine (see
// docs/media-studio-feasibility.md for why this doesn't reopen the "no
// embedded model provider" decision: transcription is mechanical audio
// analysis, not text generation).
import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);

// Overridable so production can point this at the persistent Fly volume
// (/data/recordings — see fly.toml) instead of the container's ephemeral
// filesystem, which gets wiped on every redeploy. Local dev is unaffected.
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(process.cwd(), "recordings");
const WHISPER_CPP_ROOT = path.join(
  process.cwd(),
  "node_modules/nodejs-whisper/cpp/whisper.cpp",
);
const WHISPER_CLI = path.join(WHISPER_CPP_ROOT, "build/bin/whisper-cli");
const WHISPER_MODEL = path.join(WHISPER_CPP_ROOT, "models/ggml-base.en.bin");
// Built directly rather than via `require("ffmpeg-static")` — Next.js's
// bundler rewrites that package's own internal __dirname-based path lookup
// to a fake "/ROOT/..." placeholder that doesn't exist at runtime. A plain
// path built from process.cwd() sidesteps the bundler entirely.
const FFMPEG_PATH = path.join(process.cwd(), "node_modules/ffmpeg-static/ffmpeg");

type WhisperSegment = { start: number; end: number; text: string };

// Greedy decoding (-bs 1 -bo 1) instead of whisper-cli's own default 5-beam
// search — measured ~44x faster on this machine (471ms vs 20.6s for a short
// clip) with no meaningful accuracy loss for this use case. Segment-level
// timestamps only, not word-level — a deliberate scope choice, see
// docs/media-studio-feasibility.md point 8.
async function runWhisper(wavPath: string, outBase: string): Promise<WhisperSegment[]> {
  await execFileAsync(WHISPER_CLI, [
    "-m", WHISPER_MODEL,
    "-f", wavPath,
    "-oj",
    "-of", outBase,
    "-bs", "1",
    "-bo", "1",
    "-t", "8",
    "-l", "en",
  ]);

  const raw = await fs.readFile(`${outBase}.json`, "utf-8");
  const parsed = JSON.parse(raw) as {
    transcription: Array<{ offsets: { from: number; to: number }; text: string }>;
  };

  return parsed.transcription.map((seg) => ({
    start: seg.offsets.from / 1000,
    end: seg.offsets.to / 1000,
    text: seg.text.trim(),
  }));
}

async function convertToWav16k(inputPath: string, outputPath: string) {
  await execFileAsync(FFMPEG_PATH, [
    "-y",
    "-i", inputPath,
    "-ar", "16000",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    outputPath,
  ]);
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "audio";
}

// Saves the raw upload immediately (so it's never lost even if transcription
// fails), then transcribes synchronously before returning. A real recording
// on this hardware transcribes in well under real-time with greedy decoding,
// so blocking the request is the smallest-coherent choice here rather than
// standing up a separate job queue/worker process for this first slice.
export async function createRecording(args: {
  contentProjectId: string;
  buffer: Buffer;
  mimeType: string;
}) {
  await fs.mkdir(RECORDINGS_DIR, { recursive: true });

  const recording = await prisma.recording.create({
    data: {
      contentProjectId: args.contentProjectId,
      filePath: "",
      mimeType: args.mimeType,
      status: "UPLOADED",
    },
  });

  const ext = extensionForMimeType(args.mimeType);
  const filePath = path.join(RECORDINGS_DIR, `${recording.id}.${ext}`);
  await fs.writeFile(filePath, args.buffer);
  await prisma.recording.update({ where: { id: recording.id }, data: { filePath } });

  return transcribeRecording(recording.id);
}

export async function transcribeRecording(recordingId: string) {
  const recording = await prisma.recording.update({
    where: { id: recordingId },
    data: { status: "TRANSCRIBING" },
  });

  const wavPath = path.join(RECORDINGS_DIR, `${recording.id}.16k.wav`);
  const outBase = path.join(RECORDINGS_DIR, `${recording.id}.transcript`);

  try {
    await convertToWav16k(recording.filePath, wavPath);
    const segments = await runWhisper(wavPath, outBase);
    const transcript = segments.map((s) => s.text).join(" ").trim();
    const durationSeconds = segments.length > 0 ? segments[segments.length - 1].end : null;

    return await prisma.recording.update({
      where: { id: recording.id },
      data: {
        status: "TRANSCRIBED",
        transcript,
        transcriptSegments: JSON.stringify(segments),
        transcriptError: null,
        durationSeconds,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return prisma.recording.update({
      where: { id: recording.id },
      data: { status: "FAILED", transcriptError: message },
    });
  } finally {
    // Intermediate WAV/JSON are disposable — the original upload and the
    // final transcript are the only things worth keeping.
    await fs.rm(wavPath, { force: true });
    await fs.rm(`${outBase}.json`, { force: true });
  }
}

export function recordingFilePath(recording: { filePath: string }) {
  return recording.filePath;
}
