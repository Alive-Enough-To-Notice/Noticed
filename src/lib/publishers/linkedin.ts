import { requireEnv, type PublishResult } from "./types";

// Personal posting (w_member_social + the self-serve "Share on LinkedIn"
// product) — LinkedIn's actual self-serve tier, distinct from company-page
// posting which needs Marketing Developer Platform partner approval.
// Uses the legacy-but-still-functional ugcPosts endpoint (LinkedIn's newer
// Posts API schema wasn't confirmable with enough certainty to implement
// safely — this one has a documented, stable request shape).
export async function publishToLinkedIn(text: string): Promise<PublishResult> {
  const accessToken = requireEnv("LINKEDIN_ACCESS_TOKEN");
  const personUrn = requireEnv("LINKEDIN_PERSON_URN");

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (!res.ok) {
    throw new Error(`LinkedIn post failed: ${await res.text()}`);
  }
  const id = res.headers.get("x-restli-id") ?? undefined;
  return { id, url: id ? `https://www.linkedin.com/feed/update/${id}/` : undefined };
}
