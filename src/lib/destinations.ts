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
    key: "bluesky-narrareach",
    label: "Bluesky (via Narrareach)",
    capability: "DIRECT",
    built: true,
    notes:
      "Switched to Narrareach 2026-07-28 — the owner already has Bluesky (infranet-hr.com) connected there, no separate app password needed. Needs NARRAREACH_API_TOKEN. Scheduled ~1 min out, not instant.",
  },
  {
    key: "mastodon",
    label: "Mastodon",
    capability: "DIRECT",
    built: true,
    notes:
      "Per-instance self-serve app registration, open REST API, no review process. Built, but the owner doesn't have a Mastodon account and only raised it while thinking about a future mass-market version of Noticed — not offered in the active publish dropdown right now (see src/lib/publishers/index.ts). Needs MASTODON_INSTANCE_URL + MASTODON_ACCESS_TOKEN if it ever gets activated.",
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
    key: "facebook-narrareach",
    label: "Facebook (via Narrareach)",
    capability: "DIRECT",
    built: true,
    notes:
      "Corrected 2026-07-28: earlier assumed not connected on Narrareach based on the get_user_profile tool's summary, which turned out to be incomplete — the owner's actual Narrareach settings page shows Facebook genuinely connected (\"Connected as InfraNet-HR\"). Switched to Narrareach for the same reason as X/Bluesky/LinkedIn. Needs NARRAREACH_API_TOKEN. Scheduled ~1 min out, not instant.",
  },
  {
    key: "x-narrareach",
    label: "X (via Narrareach)",
    capability: "DIRECT",
    built: true,
    notes:
      "Switched to Narrareach 2026-07-28 — the owner already has X (@InfraNetHR) connected there, sidestepping X's own pay-per-use API pricing (Feb 2026) entirely. Needs NARRAREACH_API_TOKEN. Scheduled ~1 min out, not instant.",
  },
  {
    key: "linkedin-narrareach",
    label: "LinkedIn (personal, via Narrareach)",
    capability: "DIRECT",
    built: true,
    notes:
      "Switched to Narrareach 2026-07-28 — the owner already has LinkedIn connected there, no separate developer app/token needed. Needs NARRAREACH_API_TOKEN. Scheduled ~1 min out, not instant. Note: this is the short-form \"LinkedIn Social\" connection (used for LINKEDIN-channel drafts) — Narrareach separately shows \"LinkedIn Articles\" as \"Ready\" for full long-form LinkedIn articles via its schedule_article endpoint, not wired up yet since BLOG drafts currently only target WordPress/Ghost/Reddit/Substack.",
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
      "Corrected 2026-07-27: the same single-owner dev-mode bypass as Facebook applies to the App Review gate, but Instagram fundamentally requires an image or video for every post — no text-only posts — and the media must already be hosted at a public URL. Noticed doesn't generate images yet, so there's nothing to actually publish here regardless of credentials. Confirmed \"Not connected\" on the owner's actual Narrareach settings page too (2026-07-28) — same real blocker, image support, would need building first even if connected there instead.",
  },
  {
    key: "threads",
    label: "Threads",
    capability: "CONFIRM",
    built: false,
    notes:
      "Narrareach supports Threads as a notes destination, but it shows \"Not connected\" on the owner's account (confirmed 2026-07-28 via the actual settings page). Would just need connecting there, then the same scheduleNoteViaNarrareach path used for X/Bluesky/LinkedIn/Facebook would cover it.",
  },
  {
    key: "tiktok",
    label: "TikTok",
    capability: "EXPORT",
    built: false,
    notes:
      "Narrareach lists TikTok, but \"publishes video and photo posts\" — like Instagram, this needs real video/image content Noticed doesn't generate yet. Also \"Not connected\" on the owner's account.",
  },
  {
    key: "pinterest",
    label: "Pinterest",
    capability: "EXPORT",
    built: false,
    notes:
      "Narrareach lists Pinterest, but it publishes image/video pins — same media requirement as Instagram/TikTok. Also \"Not connected\" on the owner's account.",
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
    key: "substack-narrareach",
    label: "Substack (via Narrareach)",
    capability: "DIRECT",
    built: true,
    notes:
      "Corrected 2026-07-28: Substack itself still has no public publish API, BUT Narrareach (narrareach.com) already maintains a working Substack connection and exposes it through its own REST API — the owner already has an active account with @cortnilawson connected. Needs NARRAREACH_API_TOKEN. Schedules ~1 min out rather than instant-publishing (Narrareach's API is schedule-based) — recorded as \"scheduled,\" not confirmed-delivered; verifying actual delivery would mean polling Narrareach's operation-status endpoint, not built yet.",
  },
  {
    key: "medium",
    label: "Medium",
    capability: "UNAVAILABLE",
    built: false,
    notes:
      "Medium's own publish API was deprecated and archived in 2023 — \"currently unavailable,\" no new integrations allowed. Narrareach's article endpoint does list MEDIUM as a supported platform (same pattern as the Substack fix), but the owner hasn't connected a Medium account there yet — worth revisiting if that changes.",
  },
];
