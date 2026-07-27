import { requireEnv, type PublishResult } from "./types";

// Graph API to a Page you administer. Because Noticed is single-owner, this
// works in Meta's "Development Mode" with you as an app Admin/Tester — App
// Review is only required once people WITHOUT a role on the app use it.
// Get a long-lived Page access token via Graph API Explorer (developers.facebook.com/tools/explorer).
export async function publishToFacebook(message: string): Promise<PublishResult> {
  const pageId = requireEnv("FACEBOOK_PAGE_ID");
  const accessToken = requireEnv("FACEBOOK_PAGE_ACCESS_TOKEN");

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: accessToken }),
  });
  if (!res.ok) {
    throw new Error(`Facebook post failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}
