import { requireEnv, type PublishResult } from "./types";

// Per-instance self-serve app registration, open REST API, no review process.
export async function publishToMastodon(text: string): Promise<PublishResult> {
  const instanceUrl = requireEnv("MASTODON_INSTANCE_URL").replace(/\/$/, "");
  const accessToken = requireEnv("MASTODON_ACCESS_TOKEN");

  const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: text }),
  });
  if (!res.ok) {
    throw new Error(`Mastodon post failed: ${await res.text()}`);
  }
  const status = (await res.json()) as { url: string };
  return { url: status.url };
}
