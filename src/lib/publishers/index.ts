import type { PublishResult } from "./types";
import { publishToBluesky } from "./bluesky";
import { publishToMastodon } from "./mastodon";
import { publishToGhost } from "./ghost";
import { publishToWordPress } from "./wordpress";
import { publishToReddit } from "./reddit";
import { publishToFacebook } from "./facebook";
import { publishToLinkedIn } from "./linkedin";
import { publishToX } from "./x";
import { publishToSubstackViaNarrareach } from "./narrareach";

export type PublishableDestinationKey =
  | "bluesky"
  | "mastodon"
  | "ghost"
  | "wordpress"
  | "reddit"
  | "facebook"
  | "linkedin-personal"
  | "x"
  | "substack-narrareach";

// Maps a destination + a draft's (title, body) onto the right publisher and
// argument shape for that platform's post format.
export async function publish(
  destinationKey: PublishableDestinationKey,
  args: { title: string; body: string },
): Promise<PublishResult> {
  switch (destinationKey) {
    case "bluesky":
      return publishToBluesky(args.body);
    case "mastodon":
      return publishToMastodon(args.body);
    case "x":
      return publishToX(args.body);
    case "ghost":
      return publishToGhost(args.title, args.body);
    case "wordpress":
      return publishToWordPress(args.title, args.body);
    case "reddit":
      return publishToReddit(args.title, args.body);
    case "facebook":
      return publishToFacebook(args.body);
    case "linkedin-personal":
      return publishToLinkedIn(args.body);
    case "substack-narrareach":
      return publishToSubstackViaNarrareach(args.title, args.body);
  }
}

// Which destinations make sense for each ContentDraft channel — BLOG drafts
// have a title + long body (blog-shaped platforms), LINKEDIN drafts are
// medium-length professional text, X drafts are short-form microblog text.
export const CHANNEL_DESTINATIONS: Record<string, PublishableDestinationKey[]> = {
  BLOG: ["wordpress", "ghost", "reddit", "substack-narrareach"],
  LINKEDIN: ["linkedin-personal", "facebook"],
  X: ["x", "bluesky", "mastodon"],
};
