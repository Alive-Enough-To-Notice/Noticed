import { requireEnv, type PublishResult } from "./types";

// REST API with an Application Password (Users -> Profile -> Application
// Passwords in wp-admin) — self-serve on self-hosted WordPress, no review.
export async function publishToWordPress(
  title: string,
  content: string,
): Promise<PublishResult> {
  const siteUrl = requireEnv("WORDPRESS_SITE_URL").replace(/\/$/, "");
  const username = requireEnv("WORDPRESS_USERNAME");
  const appPassword = requireEnv("WORDPRESS_APPLICATION_PASSWORD");
  const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");

  const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ title, content, status: "publish" }),
  });
  if (!res.ok) {
    throw new Error(`WordPress post failed: ${await res.text()}`);
  }
  const post = (await res.json()) as { link: string };
  return { url: post.link };
}
