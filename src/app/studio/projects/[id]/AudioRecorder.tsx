"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Captures audio via the browser's own MediaRecorder — nothing leaves the
// machine except the finished recording, which is uploaded to Noticed's own
// /api/studio/recordings route and transcribed locally there.
export function AudioRecorder({ contentProjectId }: { contentProjectId: string }) {
  const [state, setState] = useState<"idle" | "recording" | "uploading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  async function startRecording() {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } catch {
      setErrorMessage("Couldn't access the microphone — check your browser/system permissions.");
      setState("error");
    }
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setState("uploading");

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
    });
    recorder.stop();
    const blob = await finished;

    const formData = new FormData();
    formData.append("contentProjectId", contentProjectId);
    formData.append("audio", blob, "recording.webm");

    try {
      const response = await fetch("/api/studio/recordings", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${response.status})`);
      }
      setState("idle");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      setState("error");
    }
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--card-border)] bg-white p-4">
      <div className="flex items-center gap-3">
        {state === "recording" ? (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded bg-[var(--critical)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            ■ Stop recording
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={state === "uploading"}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            ● Record audio
          </button>
        )}
        {state === "recording" && (
          <span className="text-sm text-[var(--slate)]">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        )}
        {state === "uploading" && (
          <span className="text-sm text-[var(--slate)]">Saving and transcribing locally...</span>
        )}
      </div>
      {errorMessage && <p className="text-xs text-[var(--critical)]">{errorMessage}</p>}
    </div>
  );
}
