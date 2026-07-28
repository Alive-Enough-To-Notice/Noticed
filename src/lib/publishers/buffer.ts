import { requireEnv, type PublishResult } from "./types";

const ENDPOINT = "https://api.buffer.com";

// Buffer's createPost is a GraphQL union response — either PostActionSuccess
// (has `post`) or one of several MutationError types (has `message`). Google
// Business Profile's "What's New" post type is the one channel Buffer
// connects to that's genuinely usable today: plain text, no image/video
// required (unlike YouTube, which needs an actual video asset Noticed
// doesn't generate — see destinations.ts).
export async function publishToGoogleBusinessViaBuffer(
  text: string,
): Promise<PublishResult> {
  const token = requireEnv("BUFFER_API_TOKEN");
  const channelId = requireEnv("BUFFER_GOOGLE_BUSINESS_CHANNEL_ID");

  const query = `
    mutation CreateGoogleBusinessPost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id externalLink }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          channelId,
          text,
          mode: "shareNow",
          schedulingType: "automatic",
          metadata: {
            google: {
              type: "whats_new",
              detailsWhatsNew: { button: "none" },
            },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Buffer request failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    errors?: Array<{ message: string }>;
    data?: { createPost?: { message?: string; post?: { id: string; externalLink?: string } } };
  };

  if (data.errors?.length) {
    throw new Error(`Buffer GraphQL error: ${data.errors.map((e) => e.message).join("; ")}`);
  }
  const result = data.data?.createPost;
  if (!result || result.message) {
    throw new Error(`Buffer post failed: ${result?.message ?? "unknown error"}`);
  }

  return { id: result.post?.id, url: result.post?.externalLink };
}
