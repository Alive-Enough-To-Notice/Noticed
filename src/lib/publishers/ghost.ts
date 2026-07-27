import { createHmac } from "node:crypto";
import { requireEnv, type PublishResult } from "./types";

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Ghost auths with a short-lived (max 5 min) JWT signed HS256, hand-built
// here rather than pulling in a JWT library for one call site. Admin API
// key format is "{id}:{secret}" where the secret is hex-encoded.
function buildGhostToken(adminApiKey: string): string {
  const [id, secret] = adminApiKey.split(":");
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({ iat: now, exp: now + 5 * 60, aud: "/admin/" }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = base64url(
    createHmac("sha256", Buffer.from(secret, "hex")).update(signingInput).digest(),
  );
  return `${signingInput}.${signature}`;
}

export async function publishToGhost(
  title: string,
  html: string,
): Promise<PublishResult> {
  const adminUrl = requireEnv("GHOST_ADMIN_API_URL").replace(/\/$/, "");
  const adminApiKey = requireEnv("GHOST_ADMIN_API_KEY");
  const token = buildGhostToken(adminApiKey);

  const res = await fetch(`${adminUrl}/ghost/api/admin/posts/?source=html`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Ghost ${token}`,
    },
    body: JSON.stringify({ posts: [{ title, html, status: "published" }] }),
  });
  if (!res.ok) {
    throw new Error(`Ghost post failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { posts: Array<{ url: string }> };
  return { url: data.posts[0]?.url };
}
