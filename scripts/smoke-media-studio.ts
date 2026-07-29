import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "../src/lib/prisma";
import { createMarkerSuggestions, type WhisperWord } from "../src/lib/services/recordings";
import { renderRecording } from "../src/lib/services/media-exports";

const execFileAsync = promisify(execFile);
const ffmpeg = path.join(process.cwd(), "node_modules/ffmpeg-static/ffmpeg");
const mediaDir = process.env.RECORDINGS_DIR || path.join(process.cwd(), "recordings");
const testSource = path.join(mediaDir, `smoke-source-${Date.now()}.wav`);
const testVideo = path.join(mediaDir, `smoke-video-${Date.now()}.mp4`);
let projectId: string | undefined;
const recordingIds: string[] = [];
const generatedPaths: string[] = [testSource, testVideo];

async function main() {
  console.log("media-smoke: creating source");
  await fs.mkdir(mediaDir, { recursive: true });
  await execFileAsync(ffmpeg, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:a", "pcm_s16le", testSource], { timeout: 30_000 });
  await execFileAsync(ffmpeg, ["-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=24:duration=6", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", testVideo], { timeout: 30_000 });
  console.log("media-smoke: creating records");
  const brand = await prisma.brand.findFirstOrThrow();
  const project = await prisma.contentProject.create({ data: { brandId: brand.id, title: "Temporary accessible media smoke test" } });
  projectId = project.id;
  const words: WhisperWord[] = [
    { index: 0, start: 0.2, end: 0.8, text: "first" },
    { index: 1, start: 1.0, end: 1.5, text: "attempt." },
    { index: 2, start: 1.7, end: 2.1, text: "scratch" },
    { index: 3, start: 2.15, end: 2.55, text: "scratch" },
    { index: 4, start: 2.6, end: 3.0, text: "meow" },
    { index: 5, start: 3.3, end: 3.8, text: "better" },
    { index: 6, start: 4.0, end: 4.6, text: "attempt." },
  ];
  const recording = await prisma.recording.create({ data: { contentProjectId: project.id, filePath: testSource, mimeType: "audio/wav", mediaKind: "AUDIO", status: "TRANSCRIBED", durationSeconds: 6, transcript: words.map((word) => word.text).join(" "), transcriptWords: JSON.stringify(words), transcriptSegments: "[]" } });
  recordingIds.push(recording.id);
  await createMarkerSuggestions(recording.id, words);
  console.log("media-smoke: checking marker");
  const marker = await prisma.editDecision.findFirst({ where: { recordingId: recording.id, source: "MARKER", status: "PROPOSED" } });
  if (!marker) throw new Error("Marker phrase did not create a proposed edit.");
  await prisma.editDecision.update({ where: { id: marker.id }, data: { status: "APPLIED" } });
  console.log("media-smoke: rendering clean export");
  const exported = await renderRecording(recording.id);
  if (exported.status !== "READY" || !exported.filePath || !exported.captionsPath) throw new Error("Clean media export was not produced.");
  generatedPaths.push(exported.filePath, exported.captionsPath);
  const [fileStat, captions] = await Promise.all([fs.stat(exported.filePath), fs.readFile(exported.captionsPath, "utf8")]);
  if (fileStat.size < 1000) throw new Error("Clean export is unexpectedly small.");
  if (!captions.startsWith("WEBVTT")) throw new Error("Caption export is invalid.");

  console.log("media-smoke: rendering video with embedded captions");
  const videoRecording = await prisma.recording.create({ data: { contentProjectId: project.id, filePath: testVideo, mimeType: "video/mp4", mediaKind: "VIDEO", status: "TRANSCRIBED", durationSeconds: 6, transcript: words.map((word) => word.text).join(" "), transcriptWords: JSON.stringify(words), transcriptSegments: "[]" } });
  recordingIds.push(videoRecording.id);
  await prisma.editDecision.create({ data: { recordingId: videoRecording.id, startSeconds: 1.5, endSeconds: 3.1, label: "Video retake", source: "MARKER", status: "APPLIED" } });
  const videoExport = await renderRecording(videoRecording.id);
  if (videoExport.status !== "READY" || videoExport.mimeType !== "video/mp4" || !videoExport.filePath || !videoExport.captionsPath) throw new Error("Clean video export was not produced.");
  generatedPaths.push(videoExport.filePath, videoExport.captionsPath);
  const videoStat = await fs.stat(videoExport.filePath);
  if (videoStat.size < 10_000) throw new Error("Clean video export is unexpectedly small.");
  console.log(JSON.stringify({ markerDetected: true, cleanedAudioBytes: fileStat.size, cleanedAudioDuration: exported.durationSeconds, cleanedVideoBytes: videoStat.size, cleanedVideoDuration: videoExport.durationSeconds, captions: true }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  console.log("media-smoke: cleaning up");
  for (const recordingId of recordingIds) {
    await prisma.mediaExport.deleteMany({ where: { recordingId } });
    await prisma.editDecision.deleteMany({ where: { recordingId } });
    await prisma.recording.deleteMany({ where: { id: recordingId } });
  }
  if (projectId) await prisma.contentProject.deleteMany({ where: { id: projectId } });
  await Promise.all(generatedPaths.map((file) => fs.rm(file, { force: true })));
  await prisma.$disconnect();
});
