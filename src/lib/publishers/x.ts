import { TwitterApi } from "twitter-api-v2";
import { requireEnv, type PublishResult } from "./types";

// OAuth 1.0a user-context tokens, generated once in the X Developer Portal
// (Keys and Tokens tab, "Read and Write" app permissions) — all 4 values
// are static once created, no live OAuth redirect flow needed here. Uses
// twitter-api-v2 rather than hand-rolling OAuth 1.0a request signing, which
// is easy to get subtly wrong. Pay-per-use as of Feb 2026 — each call costs
// money, not just a rate-limit concern.
export async function publishToX(text: string): Promise<PublishResult> {
  const client = new TwitterApi({
    appKey: requireEnv("X_API_KEY"),
    appSecret: requireEnv("X_API_SECRET"),
    accessToken: requireEnv("X_ACCESS_TOKEN"),
    accessSecret: requireEnv("X_ACCESS_TOKEN_SECRET"),
  });

  const { data } = await client.v2.tweet(text);
  return { id: data.id, url: `https://x.com/i/web/status/${data.id}` };
}
