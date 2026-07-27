import { requireEnv, type PublishResult } from "./types";

// Reddit's "script" app type supports the resource-owner password grant —
// self-serve OAuth app registration at reddit.com/prefs/apps, no partner
// review. Posts as a self-post (title + body) to one configured subreddit.
export async function publishToReddit(
  title: string,
  text: string,
): Promise<PublishResult> {
  const clientId = requireEnv("REDDIT_CLIENT_ID");
  const clientSecret = requireEnv("REDDIT_CLIENT_SECRET");
  const username = requireEnv("REDDIT_USERNAME");
  const password = requireEnv("REDDIT_PASSWORD");
  const subreddit = requireEnv("REDDIT_SUBREDDIT");
  const userAgent = requireEnv("REDDIT_USER_AGENT");

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: new URLSearchParams({ grant_type: "password", username, password }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Reddit login failed: ${await tokenRes.text()}`);
  }
  const { access_token: accessToken } = (await tokenRes.json()) as {
    access_token: string;
  };

  const submitRes = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: new URLSearchParams({
      sr: subreddit,
      kind: "self",
      title,
      text,
      api_type: "json",
    }),
  });
  if (!submitRes.ok) {
    throw new Error(`Reddit post failed: ${await submitRes.text()}`);
  }
  const result = (await submitRes.json()) as {
    json: { errors: unknown[][]; data?: { url: string } };
  };
  if (result.json.errors?.length) {
    throw new Error(`Reddit rejected the post: ${JSON.stringify(result.json.errors)}`);
  }
  return { url: result.json.data?.url };
}
