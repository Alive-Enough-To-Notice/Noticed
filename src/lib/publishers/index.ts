import type { PublishResult } from "./types";
import { publishToMastodon } from "./mastodon";
import { publishToGhost } from "./ghost";
import { publishToWordPress } from "./wordpress";
import { publishToReddit } from "./reddit";
import { publishToFacebook } from "./facebook";
import {
  publishToSubstackViaNarrareach,
  publishToXViaNarrareach,
  publishToBlueskyViaNarrareach,
  publishToLinkedInViaNarrareach,
} from "./narrareach";

export type PublishableDestinationKey =
  | "bluesky-narrareach"
  | "mastodon"
  | "ghost"
  | "wordpress"
  | "reddit"
  | "facebook"
  | "linkedin-narrareach"
  | "x-narrareach"
  | "substack-narrareach";

// Maps a destination + a draft's (title, body) onto the right publisher and
// argument shape for that platform's post format. X, Bluesky, and LinkedIn
// route through Narrareach (already-connected, already-paid-for) rather than
// direct per-platform integrations — see project memory for why.
export async function publish(
  destinationKey: PublishableDestinationKey,
  args: { title: string; body: string },
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
    case "facebook":
      return publishToFacebook(args.body);
    case "linkedin-narrareach":
      return publishToLinkedInViaNarrareach(args.body);
    case "substack-narrareach":
      return publishToSubstackViaNarrareach(args.title, args.body);
  }
}

// Which destinations make sense for each ContentDraft channel — BLOG drafts
// have a title + long body (blog-shaped platforms), LINKEDIN drafts are
// medium-length professional text, X drafts are short-form microblog text.
//
// Mastodon is built (see ./mastodon.ts) but deliberately left out of this
// active list — the owner doesn't have a Mastodon account; it only came up
// while thinking about a future mass-market version of Noticed, not
// something to surface in a single-user dropdown right now.
export const CHANNEL_DESTINATIONS: Record<string, PublishableDestinationKey[]> = {
  BLOG: ["wordpress", "ghost", "reddit", "substack-narrareach"],
  LINKEDIN: ["linkedin-narrareach", "facebook"],
  X: ["x-narrareach", "bluesky-narrareach"],
};
