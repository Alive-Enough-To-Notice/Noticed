// Honest capability reference for every publishing destination the owner
// named (2026-07-27) — the product's own rule is "never imply a channel is
// more supported than it actually is," so this is deliberately researched,
// not guessed. `capability` is the CEILING Noticed could realistically reach
// if the integration were built (given each platform's actual API/access
// policy as of mid-2026); `built` is whether that integration exists yet —
// true only for RSS, which needs no external account at all.
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
    built: false,
    notes:
      "AT Protocol is fully open — an app password is enough, no developer app review. Easiest real integration to build next.",
  },
  {
    key: "mastodon",
    label: "Mastodon",
    capability: "DIRECT",
    built: false,
    notes:
      "Per-instance self-serve app registration, open REST API, no review process.",
  },
  {
    key: "ghost",
    label: "Ghost",
    capability: "DIRECT",
    built: false,
    notes:
      "Admin API key, self-serve on self-hosted or Ghost(Pro), no review process.",
  },
  {
    key: "wordpress",
    label: "WordPress",
    capability: "DIRECT",
    built: false,
    notes:
      "REST API with Application Passwords (self-hosted) or WordPress.com OAuth — self-serve, no review.",
  },
  {
    key: "reddit",
    label: "Reddit",
    capability: "CONFIRM",
    built: false,
    notes:
      "Self-serve OAuth app registration, but subreddit self-promotion/spam rules make human review before posting the responsible default.",
  },
  {
    key: "youtube",
    label: "YouTube",
    capability: "CONFIRM",
    built: false,
    notes:
      "Data API v3 via self-serve Google Cloud OAuth works for your own channel; broader use needs Google's sensitive-scope verification.",
  },
  {
    key: "google-business",
    label: "Google Business Profile",
    capability: "CONFIRM",
    built: false,
    notes:
      "Business Profile API requires a verified business and an API access request — gated, not instant, but not an enterprise-only program either.",
  },
  {
    key: "linkedin-personal",
    label: "LinkedIn (personal)",
    capability: "CONFIRM",
    built: false,
    notes:
      "w_member_social + the \"Share on LinkedIn\" product is LinkedIn's self-serve tier, well short of the Business gate below.",
  },
  {
    key: "linkedin-business",
    label: "LinkedIn (business page)",
    capability: "UNAVAILABLE",
    built: false,
    notes:
      "Posting as an organization needs LinkedIn's Marketing Developer Platform approval — reserved for enterprise partners, a real gate, not a self-serve API key.",
  },
  {
    key: "facebook",
    label: "Facebook",
    capability: "UNAVAILABLE",
    built: false,
    notes:
      "Posting to Pages needs a Meta Developer App, Business verification, and Meta App Review before it works past 25 test users (2-4 week review).",
  },
  {
    key: "instagram",
    label: "Instagram",
    capability: "UNAVAILABLE",
    built: false,
    notes:
      "Same Meta App Review gate as Facebook, plus a Business/Creator account linked to a Page, and posting requires media hosted at a public URL first — no direct file upload.",
  },
  {
    key: "x",
    label: "X",
    capability: "UNAVAILABLE",
    built: false,
    notes:
      "X moved to pay-per-use in Feb 2026 for new developer access (no meaningful free posting tier) — a real cost barrier, not just missing setup.",
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
