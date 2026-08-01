import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import type { WhisperWord } from "@/lib/services/recordings";

const execFileAsync = promisify(execFile);
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(process.cwd(), "recordings");
const FFMPEG_PATH = path.join(process.cwd(), "node_modules/ffmpeg-static/ffmpeg");

type Range = { start: number; end: number };

export function mergeRemovedRanges(ranges: Range[], duration: number): Range[] {
  const sorted = ranges
    .map((range) => ({ start: Math.max(0, range.start), end: Math.min(duration, range.end) }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start <= last.end + 0.04) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export function keptRanges(removed: Range[], duration: number): Range[] {
  const kept: Range[] = [];
  let cursor = 0;
  for (const range of removed) {
    if (range.start > cursor) kept.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < duration) kept.push({ start: cursor, end: duration });
  return kept.filter((range) => range.end - range.start >= 0.04);
}

function removedBefore(time: number, removed: Range[]) {
  return removed.reduce((total, range) => total + Math.max(0, Math.min(time, range.end) - range.start), 0);
}

function formatVttTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function buildVtt(words: WhisperWord[], removed: Range[]) {
  const remaining = words.filter((word) => !removed.some((range) => word.start < range.end && word.end > range.start));
  const cues: string[] = [];
  for (let index = 0; index < remaining.length; index += 8) {
    const group = remaining.slice(index, index + 8);
    if (group.length === 0) continue;
    const start = group[0].start - removedBefore(group[0].start, removed);
    const end = group.at(-1)!.end - removedBefore(group.at(-1)!.end, removed);
    cues.push(`${formatVttTime(start)} --> ${formatVttTime(end)}\n${group.map((word) => word.text).join(" ")}`);
  }
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

export async function renderRecording(recordingId: string) {
  const recording = await prisma.recording.findUniqueOrThrow({
    where: { id: recordingId },
    include: { editDecisions: { where: { status: "APPLIED" } } },
  });
  if (!recording.durationSeconds) throw new Error("Recording has no usable duration yet.");

  await fs.mkdir(RECORDINGS_DIR, { recursive: true });
  const mediaExport = await prisma.mediaExport.create({ data: { recordingId } });
  const isVideo = recording.mediaKind === "VIDEO";
  const outputPath = path.join(RECORDINGS_DIR, `${mediaExport.id}.clean.${isVideo ? "mp4" : "mp3"}`);
  const captionsPath = path.join(RECORDINGS_DIR, `${mediaExport.id}.vtt`);
  const removed = mergeRemovedRanges(
    recording.editDecisions.map((decision) => ({ start: decision.startSeconds, end: decision.endSeconds })),
    recording.durationSeconds,
  );
  const kept = keptRanges(removed, recording.durationSeconds);

  try {
    if (kept.length === 0) throw new Error("Every part of the recording is marked for removal.");
    const words = recording.transcriptWords ? JSON.parse(recording.transcriptWords) as WhisperWord[] : [];
    await fs.writeFile(captionsPath, buildVtt(words, removed), "utf8");
    const filters: string[] = [];
    const concatInputs: string[] = [];
    // A plain trim+concat is a hard splice — the waveform jumps
    // discontinuously at every cut, which reads as an audible pop/jump.
    // A short fade-in/out on each kept segment (not a true crossfade
    // between segments, which would need a different filter graph — this
    // is cheaper and just as effective for eliminating the click) removes
    // that. 20ms is short enough to be inaudible as an actual fade, long
    // enough to kill the discontinuity; clamped to half the segment's own
    // duration so a very short kept segment can't get a fade-in and
    // fade-out that overlap each other.
    kept.forEach((range, index) => {
      const duration = range.end - range.start;
      const fade = Math.min(0.02, duration / 2);
      const audioFade = `afade=t=in:st=0:d=${fade},afade=t=out:st=${duration - fade}:d=${fade}`;
      if (isVideo) {
        filters.push(`[0:v]trim=start=${range.start}:end=${range.end},setpts=PTS-STARTPTS[v${index}]`);
        filters.push(`[0:a]atrim=start=${range.start}:end=${range.end},asetpts=PTS-STARTPTS,${audioFade}[a${index}]`);
        concatInputs.push(`[v${index}][a${index}]`);
      } else {
        filters.push(`[0:a]atrim=start=${range.start}:end=${range.end},asetpts=PTS-STARTPTS,${audioFade}[a${index}]`);
        concatInputs.push(`[a${index}]`);
      }
    });
    filters.push(`${concatInputs.join("")}concat=n=${kept.length}:v=${isVideo ? 1 : 0}:a=1${isVideo ? "[vout][aout]" : "[aout]"}`);

    const args = ["-y", "-i", recording.filePath];
    if (isVideo) args.push("-i", captionsPath);
    args.push("-filter_complex", filters.join(";"));
    if (isVideo) {
      args.push("-map", "[vout]", "-map", "[aout]", "-map", "1:0", "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-c:a", "aac", "-b:a", "160k", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-movflags", "+faststart");
    } else {
      args.push("-map", "[aout]", "-c:a", "libmp3lame", "-b:a", "160k");
    }
    args.push(outputPath);
    await execFileAsync(FFMPEG_PATH, args, { maxBuffer: 10 * 1024 * 1024, timeout: 120_000 });

    const durationSeconds = kept.reduce((total, range) => total + range.end - range.start, 0);
    return prisma.mediaExport.update({
      where: { id: mediaExport.id },
      data: {
        status: "READY",
        filePath: outputPath,
        captionsPath,
        mimeType: isVideo ? "video/mp4" : "audio/mpeg",
        durationSeconds,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.mediaExport.update({ where: { id: mediaExport.id }, data: { status: "FAILED", error: message } });
    throw error;
  }
}
