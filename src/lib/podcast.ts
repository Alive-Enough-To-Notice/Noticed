// Ported from the owner's own "Alive Enough To Notice" site
// (~/CascadeProjects/alive-enough-to-notice/src/lib/podcast.ts) — a small,
// dependency-free RSS parser against their real Anchor.fm feed. Kept as a
// standalone copy rather than a shared package on purpose: Noticed stays
// fully standalone, no coupling to that (or any) other codebase.
export type PodcastEpisode = {
  title: string;
  date: string;
  description: string;
  link: string;
  audioUrl: string;
  image: string;
  duration: string;
};

function getTagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1]?.trim() ?? "");
}

function getAttributeValue(xml: string, tag: string, attribute: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attribute}="([^"]+)"[^>]*>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export async function getPodcastEpisodes(): Promise<PodcastEpisode[]> {
  const feedUrl = process.env.PODCAST_RSS_URL;
  if (!feedUrl) return [];

  try {
    const response = await fetch(feedUrl, { next: { revalidate: 3600 } });
    if (!response.ok) return [];

    const xml = await response.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

    return items.map((item) => ({
      title: getTagValue(item, "title"),
      date: getTagValue(item, "pubDate"),
      description: getTagValue(item, "description"),
      link: getTagValue(item, "link"),
      audioUrl: getAttributeValue(item, "enclosure", "url"),
      image: getAttributeValue(item, "itunes:image", "href"),
      duration: getTagValue(item, "itunes:duration"),
    }));
  } catch {
    return [];
  }
}
