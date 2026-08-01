import type { PublishResult } from "./types";
import { publishToMastodon } from "./mastodon";
import { publishToGhost } from "./ghost";
import { publishToWordPress } from "./wordpress";
import { publishToReddit } from "./reddit";
import {
  publishToSubstackViaNarrareach,
  publishToXViaNarrareach,
  publishToBlueskyViaNarrareach,
  publishToLinkedInViaNarrareach,
  publishToFacebookViaNarrareach,
  publishToInstagramViaNarrareach,
  publishToTikTokViaNarrareach,
  publishToPinterestViaNarrareach,
} from "./narrareach";
import { publishToGoogleBusinessViaBuffer } from "./buffer";

export type PublishableDestinationKey =
  | "bluesky-narrareach"
  | "mastodon"
  | "ghost"
  | "wordpress"
  | "reddit"
  | "facebook-narrareach"
  | "linkedin-narrareach"
  | "x-narrareach"
  | "substack-narrareach"
  | "google-business-buffer"
  | "instagram-narrareach"
  | "tiktok-narrareach"
  | "pinterest-narrareach";

// Maps a destination + a draft's (title, body) onto the right publisher and
// argument shape for that platform's post format. X, Bluesky, LinkedIn, and
// Facebook all route through Narrareach (already-connected, already-paid-for)
// rather than direct per-platform integrations — see project memory for why.
// Google Business routes through Buffer, connected separately.
export async function publish(
  destinationKey: PublishableDestinationKey,
  args: { title: string; body: string; imageUrls?: string[] },
): Promise<PublishResult> {
  switch (destinationKey) {
    case "bluesky-narrareach":
      return publishToBlueskyViaNarrareach(args.body);
    case "mastodon":
      return publishToMastodon(args.body);
    case "x-narrareach":
      return publishToXViaNarrareach(args.body);
    case "ghost":
      return publishToGhost(args.title, args.body);
    case "wordpress":
      return publishToWordPress(args.title, args.body);
    case "reddit":
      return publishToReddit(args.title, args.body);
    case "facebook-narrareach":
      return publishToFacebookViaNarrareach(args.body);
    case "linkedin-narrareach":
      return publishToLinkedInViaNarrareach(args.body);
    case "substack-narrareach":
      return publishToSubstackViaNarrareach(args.title, args.body);
    case "google-business-buffer":
      return publishToGoogleBusinessViaBuffer(args.body);
    case "instagram-narrareach":
      return publishToInstagramViaNarrareach(args.body, args.imageUrls);
    case "tiktok-narrareach":
      return publishToTikTokViaNarrareach(args.body, args.imageUrls);
    case "pinterest-narrareach":
      return publishToPinterestViaNarrareach(args.body, args.imageUrls);
  }
}

// Which destinations make sense for each ContentDraft channel — BLOG drafts
// have a title + long body (blog-shaped platforms), LINKEDIN drafts are
// medium-length professional text, X drafts are short-form microblog text.
// Google Business's "What's New" post type is a short business update, same
// shape as the BLOG channel's medium-length announcements.
//
// Mastodon is built (see ./mastodon.ts) but deliberately left out of this
// active list — the owner doesn't have a Mastodon account; it only came up
// while thinking about a future mass-market version of Noticed, not
// something to surface in a single-user dropdown right now.
// Instagram/TikTok/Pinterest are listed under X (short caption + media is
// the closest existing shape to how those platforms actually post) rather
// than getting their own ContentChannel — they're always offered here even
// on a draft with no attachment yet; publish() itself fails closed with a
// clear "requires at least one image or video" error if none is attached,
// same fail-closed pattern as a missing credential.
export const CHANNEL_DESTINATIONS: Record<string, PublishableDestinationKey[]> = {
  BLOG: ["wordpress", "ghost", "reddit", "substack-narrareach", "google-business-buffer"],
  LINKEDIN: ["linkedin-narrareach", "facebook-narrareach"],
  X: ["x-narrareach", "bluesky-narrareach", "instagram-narrareach", "tiktok-narrareach", "pinterest-narrareach"],
};
