import { requireEnv, type PublishResult } from "./types";

const BASE_URL = "https://www.narrareach.com/api/v1";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Blog drafts are plain text with blank-line paragraph breaks — Narrareach's
// article endpoint wants HTML.
function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

// Narrareach schedules rather than instant-publishes (scheduledFor is
// required) — scheduling ~1 minute out is the closest honest equivalent to
// "publish now" without the app needing its own scheduling UI. Success here
// means "successfully scheduled," not "confirmed live" — verifying actual
// delivery would mean polling GET /operations/:id, not built yet.
export async function publishToSubstackViaNarrareach(
  title: string,
  body: string,
): Promise<PublishResult> {
  const token = requireEnv("NARRAREACH_API_TOKEN");
  const scheduledFor = new Date(Date.now() + 60_000).toISOString();

  const res = await fetch(`${BASE_URL}/articles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title,
      contentHtml: textToHtml(body),
      platforms: ["SUBSTACK"],
      scheduledFor,
      sendToNewsletter: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Narrareach article scheduling failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { operationId?: string; id?: string; url?: string };
  return { id: data.operationId ?? data.id, url: data.url };
}

// Short-form note scheduling — covers X, Bluesky, and LinkedIn, all of which
// the owner already has connected on their existing Narrareach account, so
// this replaces the direct per-platform integrations for those three rather
// than running alongside them (one paid connection already covers it).
async function scheduleNoteViaNarrareach(
  content: string,
  platforms: string[],
): Promise<PublishResult> {
  const token = requireEnv("NARRAREACH_API_TOKEN");
  const scheduledFor = new Date(Date.now() + 60_000).toISOString();

  const res = await fetch(`${BASE_URL}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content, platforms, scheduledFor }),
  });
  if (!res.ok) {
    throw new Error(`Narrareach note scheduling failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { operationId?: string; id?: string; url?: string };
  return { id: data.operationId ?? data.id, url: data.url };
}

export function publishToXViaNarrareach(text: string): Promise<PublishResult> {
  return scheduleNoteViaNarrareach(text, ["X"]);
}

export function publishToBlueskyViaNarrareach(text: string): Promise<PublishResult> {
  return scheduleNoteViaNarrareach(text, ["BLUESKY"]);
}

export function publishToLinkedInViaNarrareach(text: string): Promise<PublishResult> {
  return scheduleNoteViaNarrareach(text, ["LINKEDIN"]);
}

export function publishToFacebookViaNarrareach(text: string): Promise<PublishResult> {
  return scheduleNoteViaNarrareach(text, ["FACEBOOK"]);
}
