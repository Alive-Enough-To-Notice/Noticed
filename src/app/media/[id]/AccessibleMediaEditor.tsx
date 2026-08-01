"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Word = { index: number; start: number; end: number; text: string };
type Decision = { id: string; startSeconds: number; endSeconds: number; label: string; source: string; status: string; createdAt: string; updatedAt: string };
type MediaExport = { id: string; status: string; durationSeconds: number | null; error: string | null; createdAt: string; updatedAt: string };
type Recording = {
  id: string;
  mediaKind: "AUDIO" | "VIDEO";
  status: string;
  transcript: string | null;
  transcriptWords: string | null;
  transcriptError: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  editDecisions: Decision[];
  exports: MediaExport[];
};

export function AccessibleMediaEditor({ projectId, initialKind, initialRecordings }: { projectId: string; initialKind: "AUDIO" | "VIDEO"; initialRecordings: Recording[] }) {
  const router = useRouter();
  const [kind, setKind] = useState(initialRecordings[0]?.mediaKind ?? initialKind);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "uploading">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selection, setSelection] = useState<{ anchor: number; end: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<HTMLMediaElement | null>(null);
  const latest = initialRecordings[0];

  useEffect(() => {
    if (!latest || !["UPLOADED", "TRANSCRIBING"].includes(latest.status)) return;
    const timer = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(timer);
  }, [latest, router]);

  const words = useMemo<Word[]>(() => {
    try { return latest?.transcriptWords ? JSON.parse(latest.transcriptWords) : []; }
    catch { return []; }
  }, [latest?.transcriptWords]);
  const applied = latest?.editDecisions.filter((decision) => decision.status === "APPLIED") ?? [];
  const proposals = latest?.editDecisions.filter((decision) => decision.status === "PROPOSED") ?? [];
  const selectedRange = selection ? { start: Math.min(selection.anchor, selection.end), end: Math.max(selection.anchor, selection.end) } : null;

  function preferredMimeType(mediaKind: "AUDIO" | "VIDEO") {
    const candidates = mediaKind === "VIDEO"
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["audio/webm;codecs=opus", "audio/webm"];
    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
  }

  async function startRecording() {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "VIDEO" });
      if (livePreviewRef.current && kind === "VIDEO") {
        livePreviewRef.current.srcObject = stream;
        await livePreviewRef.current.play();
      }
      const recorder = new MediaRecorder(stream, { mimeType: preferredMimeType(kind) || undefined });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecordingState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch {
      setMessage("I couldn't open the microphone or camera. Check the browser permission and try again.");
    }
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingState("uploading");
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || (kind === "VIDEO" ? "video/webm" : "audio/webm") }));
      };
      recorder.stop();
    });
    await uploadBlob(blob, kind === "VIDEO" ? "recording.webm" : "recording.webm");
  }

  async function uploadBlob(blob: Blob, name: string) {
    const formData = new FormData();
    formData.append("contentProjectId", projectId);
    formData.append("kind", kind);
    formData.append("media", blob, name);
    try {
      const response = await fetch("/api/media/recordings", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The recording could not be saved.");
      setMessage("Saved. The transcript is being prepared now—you can safely leave and return.");
      setRecordingState("idle");
      router.refresh();
    } catch (error) {
      setRecordingState("idle");
      setMessage(error instanceof Error ? error.message : "The recording could not be saved.");
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setKind(file.type.startsWith("video/") ? "VIDEO" : "AUDIO");
    setRecordingState("uploading");
    await uploadBlob(file, file.name);
  }

  function chooseWord(index: number) {
    setSelection((current) => current ? { anchor: current.anchor, end: index } : { anchor: index, end: index });
  }

  async function createRemoval() {
    if (!latest || !selectedRange) return;
    const first = words[selectedRange.start];
    const last = words[selectedRange.end];
    if (!first || !last) return;
    setBusy(true);
    await fetch(`/api/media/recordings/${latest.id}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startSeconds: Math.max(0, first.start - 0.04), endSeconds: last.end + 0.04, label: "Removed from transcript", source: "MANUAL", status: "APPLIED" }),
    });
    setSelection(null);
    setBusy(false);
    router.refresh();
  }

  async function updateDecision(id: string, status: "APPLIED" | "REJECTED") {
    setBusy(true);
    await fetch(`/api/media/recordings/${latest!.id}/decisions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setBusy(false);
    router.refresh();
  }

  function playRange(start: number, end?: number) {
    const player = playerRef.current;
    if (!player) return;
    player.currentTime = Math.max(0, start);
    void player.play();
    if (end) {
      const stop = () => { if (player.currentTime >= end) { player.pause(); player.removeEventListener("timeupdate", stop); } };
      player.addEventListener("timeupdate", stop);
    }
  }

  function skipRemoved() {
    const player = playerRef.current;
    if (!player) return;
    const cut = applied.find((decision) => player.currentTime >= decision.startSeconds && player.currentTime < decision.endSeconds);
    if (cut) player.currentTime = cut.endSeconds;
  }

  async function makeExport() {
    if (!latest) return;
    setBusy(true);
    setMessage("Making the cleaned file. Keep this page open for now.");
    const response = await fetch(`/api/media/recordings/${latest.id}/exports`, { method: "POST" });
    const result = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Your cleaned file and captions are ready." : result.error ?? "Export failed.");
    router.refresh();
  }

  async function deleteRecording() {
    if (!latest) return;
    if (!window.confirm("Delete this recording, its transcript, and any cleaned exports? This can't be undone.")) return;
    setBusy(true);
    const response = await fetch(`/api/media/recordings/${latest.id}`, { method: "DELETE" });
    setBusy(false);
    if (response.ok) {
      setSelection(null);
      router.refresh();
    } else {
      const result = await response.json().catch(() => ({}));
      setMessage(result.error ?? "Couldn't delete this recording.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border-2 border-[var(--accent)] bg-white p-5" aria-labelledby="record-heading">
        <h2 id="record-heading" className="text-xl font-semibold">1. Record naturally</h2>
        <p className="mt-1 text-sm text-[var(--slate)]">When you want another take, say <strong>scratch, scratch, meow</strong>, pause, and start the sentence again.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Recording type
            <select value={kind} onChange={(event) => setKind(event.target.value as "AUDIO" | "VIDEO")} disabled={recordingState !== "idle"} className="ml-2 rounded-lg border px-3 py-2">
              <option value="VIDEO">Video</option><option value="AUDIO">Audio</option>
            </select>
          </label>
          {recordingState === "recording" ? (
            <button onClick={stopRecording} className="min-h-12 rounded-lg bg-[var(--critical)] px-6 py-3 text-lg font-semibold text-white">■ Stop and save</button>
          ) : (
            <button onClick={startRecording} disabled={recordingState === "uploading"} className="min-h-12 rounded-lg bg-[var(--accent)] px-6 py-3 text-lg font-semibold text-white disabled:opacity-50">● Start recording</button>
          )}
          {recordingState === "recording" && <span role="timer" className="text-lg font-semibold">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>}
          <label className="min-h-12 cursor-pointer rounded-lg border border-[var(--card-border)] px-5 py-3 font-semibold">Upload an existing file<input type="file" accept="audio/*,video/*" className="sr-only" disabled={recordingState !== "idle"} onChange={(event) => uploadFile(event.target.files?.[0])} /></label>
        </div>
        {kind === "VIDEO" && <video ref={livePreviewRef} muted playsInline className="mt-4 max-h-72 w-full rounded-lg bg-black object-contain" aria-label="Live camera preview" />}
        {recordingState === "uploading" && <p className="mt-3 font-medium" role="status">Saving the original safely…</p>}
        {message && <p className="mt-3 rounded-lg bg-[var(--blue-frost)] p-3" role="status">{message}</p>}
      </section>

      {latest && (
        <section className="rounded-xl border border-[var(--card-border)] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">2. Read and remove what you don’t want</h2>
              <p className="mt-1 text-sm text-[var(--slate)]">The original recording never changes. Select words here to hide them from the cleaned copy.</p>
            </div>
            <button onClick={deleteRecording} disabled={busy} className="rounded-lg border border-[var(--critical)] px-3 py-2 text-sm font-semibold text-[var(--critical)] disabled:opacity-40">Delete recording</button>
          </div>
          {latest.status !== "TRANSCRIBED" ? (
            <div className="mt-4 rounded-lg bg-[var(--blue-frost)] p-4" role="status">
              <strong>{latest.status === "FAILED" ? "Transcription needs attention" : "Preparing your transcript…"}</strong>
              {latest.transcriptError && <p className="mt-1 text-sm text-[var(--critical)]">{latest.transcriptError}</p>}
            </div>
          ) : (
            <>
              {latest.mediaKind === "VIDEO" ? (
                <video ref={(node) => { playerRef.current = node; }} controls src={`/api/media/recordings/${latest.id}/source`} onTimeUpdate={skipRemoved} className="mt-4 max-h-96 w-full rounded-lg bg-black" />
              ) : (
                <audio ref={(node) => { playerRef.current = node; }} controls src={`/api/media/recordings/${latest.id}/source`} onTimeUpdate={skipRemoved} className="mt-4 w-full" />
              )}

              {proposals.length > 0 && <div className="mt-5 rounded-lg border-2 border-[var(--attention)] bg-[var(--attention-soft)] p-4">
                <h3 className="font-semibold">Review your “scratch, scratch, meow” markers ({proposals.length})</h3>
                <div className="mt-3 grid gap-3">{proposals.map((decision) => <div key={decision.id} className="rounded-lg bg-white p-3">
                  <p className="font-medium">You marked a new take here.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => playRange(Math.max(0, decision.startSeconds - 2), decision.endSeconds + 2)} className="rounded-lg border px-3 py-2">▶ Hear before and after</button>
                    <button disabled={busy} onClick={() => updateDecision(decision.id, "APPLIED")} className="rounded-lg bg-[var(--accent)] px-3 py-2 font-semibold text-white">Remove the marked attempt</button>
                    <button disabled={busy} onClick={() => updateDecision(decision.id, "REJECTED")} className="rounded-lg border px-3 py-2">Keep everything</button>
                  </div>
                </div>)}</div>
              </div>}

              <div className="mt-5 rounded-lg border border-[var(--card-border)] p-4">
                <p className="mb-3 text-sm"><strong>To remove words:</strong> click the first word, then the last word. Listen if you want, then press Remove selected words.</p>
                <div className="flex flex-wrap gap-x-1 gap-y-2 text-lg leading-8" aria-label="Editable transcript">
                  {words.map((word, index) => {
                    const removed = applied.some((decision) => word.start < decision.endSeconds && word.end > decision.startSeconds);
                    const selected = selectedRange && index >= selectedRange.start && index <= selectedRange.end;
                    return <button key={`${index}-${word.start}`} type="button" onDoubleClick={() => playRange(word.start, word.end + 0.5)} onClick={() => chooseWord(index)} className={`rounded px-1 text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${removed ? "bg-[var(--critical-soft)] text-[var(--slate)] line-through" : selected ? "bg-[var(--lime)] text-[var(--midnight)]" : "hover:bg-[var(--blue-frost)]"}`} aria-pressed={Boolean(selected)}>{word.text}</button>;
                  })}
                </div>
                <div className="sticky bottom-3 mt-4 flex flex-wrap gap-2 rounded-lg bg-white/95 p-2 shadow">
                  <button onClick={createRemoval} disabled={!selectedRange || busy} className="min-h-11 rounded-lg bg-[var(--critical)] px-4 py-2 font-semibold text-white disabled:opacity-40">Remove selected words</button>
                  <button onClick={() => setSelection(null)} disabled={!selection} className="rounded-lg border px-4 py-2">Clear selection</button>
                </div>
              </div>

              {applied.length > 0 && <div className="mt-4"><h3 className="font-semibold">Removed sections</h3><div className="mt-2 grid gap-2">{applied.map((decision) => <div key={decision.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--cold-white)] p-3"><span>{decision.label} · {decision.startSeconds.toFixed(1)}–{decision.endSeconds.toFixed(1)} seconds</span><button onClick={() => updateDecision(decision.id, "REJECTED")} className="rounded-lg border px-3 py-2">Undo and restore</button></div>)}</div></div>}
            </>
          )}
        </section>
      )}

      {latest?.status === "TRANSCRIBED" && (
        <section className="rounded-xl border border-[var(--card-border)] bg-white p-5">
          <h2 className="text-xl font-semibold">3. Make the cleaned file</h2>
          <p className="mt-1 text-sm text-[var(--slate)]">Preview above first. The exported copy skips removed words; your untouched original remains available.</p>
          <button onClick={makeExport} disabled={busy} className="mt-4 min-h-12 rounded-lg bg-[var(--lime)] px-6 py-3 text-lg font-semibold text-[var(--midnight)] disabled:opacity-50">Make cleaned {latest.mediaKind === "VIDEO" ? "video" : "episode"}</button>
          {latest.exports.filter((item) => item.status === "READY").map((item) => (
            <div key={item.id} className="mt-4 rounded-lg bg-[var(--success-soft)] p-4">
              {latest.mediaKind === "VIDEO" ? (
                <video controls src={`/api/media/exports/${item.id}/file`} className="max-h-96 w-full rounded-lg bg-black" />
              ) : (
                <audio controls src={`/api/media/exports/${item.id}/file`} className="w-full" />
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white" href={`/api/media/exports/${item.id}/file`}>Download cleaned {latest.mediaKind === "VIDEO" ? "video" : "audio"}</a>
                <a className="rounded-lg border px-4 py-2 font-semibold" href={`/api/media/exports/${item.id}/captions`}>Download captions</a>
                <span className="self-center text-sm">Clean duration: {Math.round(item.durationSeconds ?? 0)} seconds</span>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
