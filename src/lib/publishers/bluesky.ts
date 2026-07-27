import { requireEnv, type PublishResult } from "./types";

// AT Protocol — fully open, no developer app or review. An app password
// (not the account password) is generated at bsky.app/settings/app-passwords.
export async function publishToBluesky(text: string): Promise<PublishResult> {
  const identifier = requireEnv("BLUESKY_IDENTIFIER");
  const password = requireEnv("BLUESKY_APP_PASSWORD");

  const sessionRes = await fetch(
    "https://bsky.social/xrpc/com.atproto.server.createSession",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    },
  );
  if (!sessionRes.ok) {
    throw new Error(`Bluesky login failed: ${await sessionRes.text()}`);
  }
  const session = (await sessionRes.json()) as { accessJwt: string; did: string };

  const postRes = await fetch(
    "https://bsky.social/xrpc/com.atproto.repo.createRecord",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text,
          createdAt: new Date().toISOString(),
        },
      }),
    },
  );
  if (!postRes.ok) {
    throw new Error(`Bluesky post failed: ${await postRes.text()}`);
  }
  const post = (await postRes.json()) as { uri: string };
  const rkey = post.uri.split("/").pop();

  return { url: `https://bsky.app/profile/${session.did}/post/${rkey}` };
}
