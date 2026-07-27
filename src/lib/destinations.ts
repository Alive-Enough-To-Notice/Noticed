// Honest capability reference for every publishing destination the owner
// named (2026-07-27) — the product's own rule is "never imply a channel is
// more supported than it actually is," so this is deliberately researched,
// not guessed. `capability` is the CEILING Noticed could realistically reach
// given each platform's actual API/access policy as of mid-2026; `built` is
// whether that integration actually exists in code yet (see
// src/lib/publishers/). Built does NOT mean verified with real credentials —
// none of these have been tested against a real account yet.
export type PublishCapability = "DIRECT" | "CONFIRM" | "EXPORT" | "UNAVAILABLE";

export type Destination = {
  key: string;
  label: string;
  capability: PublishCapability;
  built: boolean;
  notes: string;
};

export const CAPABILITY_LABELS: Record<PublishCapability, string> = {
  DIRECT: "Direct publish",
  CONFIRM: "Human confirm required",
  EXPORT: "Prepared export only",
  UNAVAILABLE: "Unavailable",
};

export const DESTINATIONS: Destination[] = [
  {
    key: "rss",
    label: "RSS feed",
    capability: "DIRECT",
    built: true,
    notes:
      "Noticed serves this itself at /feed.xml — no external account, no API key. Approved blog drafts publish the moment they're approved.",
  },
  {
    key: "bluesky",
    label: "Bluesky",
    capability: "DIRECT",
    built: true,
    notes:
      "AT Protocol is fully open — an app password is enough, no developer app review. Needs BLUESKY_IDENTIFIER + BLUESKY_APP_PASSWORD in .env.",
  },
  {
    key: "mastodon",
    label: "Mastodon",
    capability: "DIRECT",
    built: true,
    notes:
      "Per-instance self-serve app registration, open REST API, no review process. Needs MASTODON_INSTANCE_URL + MASTODON_ACCESS_TOKEN.",
  },
  {
    key: "ghost",
    label: "Ghost",
    capability: "DIRECT",
    built: true,
    notes:
      "Admin API key, self-serve on self-hosted or Ghost(Pro), no review process. Needs GHOST_ADMIN_API_URL + GHOST_ADMIN_API_KEY.",
  },
  {
    key: "wordpress",
    label: "WordPress",
    capability: "DIRECT",
    built: true,
    notes:
      "REST API with an Application Password (self-hosted) — self-serve, no review. Needs WORDPRESS_SITE_URL + WORDPRESS_USERNAME + WORDPRESS_APPLICATION_PASSWORD.",
  },
  {
    key: "facebook",
    label: "Facebook",
    capability: "DIRECT",
    built: true,
    notes:
      "Corrected 2026-07-27: Meta's App Review gate only applies once people WITHOUT a role on your app use it. Since Noticed is single-owner, adding yourself as Admin on your own Meta app skips App Review entirely for Pages you administer. Needs FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN.",
  },
  {
    key: "x",
    label: "X",
    capability: "CONFIRM",
    built: true,
    notes:
      "Corrected 2026-07-27: not blocked, just not free — X moved to pay-per-use in Feb 2026 (~$0.01/post). Real per-post cost, not a setup gap. Needs X_API_KEY + X_API_SECRET + X_ACCESS_TOKEN + X_ACCESS_TOKEN_SECRET (OAuth 1.0a, static once generated in the dev portal).",
  },
  {
    key: "linkedin-personal",
    label: "LinkedIn (personal)",
    capability: "CONFIRM",
    built: true,
    notes:
      "w_member_social + the self-serve \"Share on LinkedIn\" product — LinkedIn's actual self-serve tier, well short of the Business gate below. Needs LINKEDIN_ACCESS_TOKEN + LINKEDIN_PERSON_URN. Uses the legacy-but-functional ugcPosts endpoint (LinkedIn's newer Posts API schema wasn't confirmable with enough certainty to implement safely).",
  },
  {
    key: "reddit",
    label: "Reddit",
    capability: "CONFIRM",
    built: true,
    notes:
      "Self-serve OAuth \"script\" app registration, but subreddit self-promotion/spam rules make human review before posting the responsible default. Needs REDDIT_CLIENT_ID/SECRET, REDDIT_USERNAME/PASSWORD, REDDIT_SUBREDDIT, REDDIT_USER_AGENT.",
  },
  {
    key: "youtube",
    label: "YouTube",
    capability: "CONFIRM",
    built: false,
    notes:
      "Data API v3 via self-serve Google Cloud OAuth works for your own channel; broader use needs Google's sensitive-scope verification. Not yet built.",
  },
  {
    key: "google-business",
    label: "Google Business Profile",
    capability: "CONFIRM",
    built: false,
    notes:
      "Business Profile API requires a verified business and an API access request — gated, not instant, but not an enterprise-only program either. Not yet built.",
  },
  {
    key: "instagram",
    label: "Instagram",
    capability: "EXPORT",
    built: false,
    notes:
      "Corrected 2026-07-27: the same single-owner dev-mode bypass as Facebook applies to the App Review gate, but Instagram fundamentally requires an image or video for every post — no text-only posts — and the media must already be hosted at a public URL. Noticed doesn't generate images yet, so there's nothing to actually publish here regardless of credentials.",
  },
  {
    key: "linkedin-business",
    label: "LinkedIn (business page)",
    capability: "UNAVAILABLE",
    built: false,
    notes:
      "Posting as an organization needs LinkedIn's Marketing Developer Platform approval — reserved for enterprise partners, a real gate with no single-owner bypass (unlike Meta's dev-mode/tester model).",
  },
  {
    key: "substack",
    label: "Substack",
    capability: "EXPORT",
    built: false,
    notes:
      "Substack has no public publishing API — its 2026 Developer API only covers profile lookup. Best honest option is a prepared draft for manual copy/paste, not a real integration.",
  },
  {
    key: "medium",
    label: "Medium",
    capability: "UNAVAILABLE",
    built: false,
    notes:
      "Medium's publish API was deprecated and archived in 2023 — \"currently unavailable,\" no new integrations allowed. There's no real path here right now.",
  },
];
