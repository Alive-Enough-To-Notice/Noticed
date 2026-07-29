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

export type WhisperSegment = { start: number; end: number; text: string };
export type WhisperWord = { index: number; start: number; end: number; text: string };

// Greedy decoding (-bs 1 -bo 1) instead of whisper-cli's own default 5-beam
// search — measured ~44x faster on this machine (471ms vs 20.6s for a short
// clip) with no meaningful accuracy loss for this use case. Segment-level
// timestamps only, not word-level — a deliberate scope choice, see
// docs/media-studio-feasibility.md point 8.
async function runWhisper(wavPath: string, outBase: string): Promise<{ segments: WhisperSegment[]; words: WhisperWord[] }> {
  const args = [
    "-m", WHISPER_MODEL,
    "-f", wavPath,
    "-ojf",
    "-of", outBase,
    "-dtw", "base.en",
    "-sow",
    "-bs", "1",
    "-bo", "1",
    "-t", "8",
    "-l", "en",
  ];
  try {
    await execFileAsync(WHISPER_CLI, args);
  } catch {
    // Metal can fail to allocate on a busy Mac. CPU is slower but dependable,
    // and is also the normal path on the Fly Linux machine.
    await execFileAsync(WHISPER_CLI, [...args, "-ng"]);
  }

  const raw = await fs.readFile(`${outBase}.json`, "utf-8");
  const parsed = JSON.parse(raw) as {
    transcription: Array<{
      offsets: { from: number; to: number };
      text: string;
      tokens?: Array<{ text: string; offsets?: { from: number; to: number } }>;
    }>;
  };

  const segments = parsed.transcription.map((seg) => ({
    start: seg.offsets.from / 1000,
    end: seg.offsets.to / 1000,
    text: seg.text.trim(),
  }));
  const words: WhisperWord[] = [];
  for (const segment of parsed.transcription) {
    for (const token of segment.tokens ?? []) {
      const text = token.text.trim();
      if (!text || !token.offsets || /^<\|.*\|>$/.test(text)) continue;
      words.push({
        index: words.length,
        start: token.offsets.from / 1000,
        end: token.offsets.to / 1000,
        text,
      });
    }
  }
  return { segments, words };
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
  originalFileName?: string;
  mediaKind?: "AUDIO" | "VIDEO";
  transcribeImmediately?: boolean;
}) {
  await fs.mkdir(RECORDINGS_DIR, { recursive: true });

  const recording = await prisma.recording.create({
    data: {
      contentProjectId: args.contentProjectId,
      filePath: "",
      mimeType: args.mimeType,
      originalFileName: args.originalFileName,
      mediaKind: args.mediaKind ?? "AUDIO",
      status: "UPLOADED",
    },
  });

  const ext = extensionForMimeType(args.mimeType);
  const filePath = path.join(RECORDINGS_DIR, `${recording.id}.${ext}`);
  await fs.writeFile(filePath, args.buffer);
  await prisma.recording.update({ where: { id: recording.id }, data: { filePath } });

  if (args.transcribeImmediately === false) {
    return prisma.recording.findUniqueOrThrow({ where: { id: recording.id } });
  }
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
    const { segments, words } = await runWhisper(wavPath, outBase);
    const transcript = segments.map((s) => s.text).join(" ").trim();
    const durationSeconds = segments.length > 0 ? segments[segments.length - 1].end : null;

    await prisma.recording.update({
      where: { id: recording.id },
      data: {
        status: "TRANSCRIBED",
        transcript,
        transcriptSegments: JSON.stringify(segments),
        transcriptWords: JSON.stringify(words),
        transcriptError: null,
        durationSeconds,
      },
    });
    await createMarkerSuggestions(recording.id, words);
    return prisma.recording.findUniqueOrThrow({ where: { id: recording.id } });
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

function normalizeMarkerWord(text: string) {
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

export async function createMarkerSuggestions(recordingId: string, words: WhisperWord[]) {
  const recording = await prisma.recording.findUniqueOrThrow({ where: { id: recordingId } });
  const markerParts = recording.markerPhrase.split(/\s+/).map(normalizeMarkerWord).filter(Boolean);
  if (markerParts.length === 0) return;

  for (let index = 0; index <= words.length - markerParts.length; index += 1) {
    const candidate = words.slice(index, index + markerParts.length).map((word) => normalizeMarkerWord(word.text));
    const matches = candidate.every((word, partIndex) =>
      word === markerParts[partIndex] ||
      (partIndex === markerParts.length - 1 && markerParts[partIndex] === "meow" && ["now", "miao", "meo"].includes(word)),
    );
    if (!matches) continue;

    const markerStart = words[index].start;
    const markerEnd = words[index + markerParts.length - 1].end;
    let attemptStart = Math.max(0, markerStart - 30);
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (/[.!?]$/.test(words[cursor].text) || markerStart - words[cursor].end > 2) {
        attemptStart = words[cursor].end;
        break;
      }
    }
    const duplicate = await prisma.editDecision.findFirst({
      where: { recordingId, source: "MARKER", startSeconds: attemptStart, endSeconds: markerEnd },
    });
    if (!duplicate) {
      await prisma.editDecision.create({
        data: {
          recordingId,
          startSeconds: attemptStart,
          endSeconds: markerEnd,
          label: "Marked retake: review the attempt before scratch, scratch, meow",
          source: "MARKER",
          status: "PROPOSED",
        },
      });
    }
  }
}

export function recordingFilePath(recording: { filePath: string }) {
  return recording.filePath;
}
