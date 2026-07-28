import Link from "next/link";
import { getPodcastEpisodes } from "@/lib/podcast";

export default async function PodcastPage() {
  const episodes = await getPodcastEpisodes();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Podcast</h1>
        <p className="max-w-2xl text-sm text-[var(--slate)]">
          Your real episode history, pulled live from your Anchor.fm feed —
          not a mockup. Turn any episode into a marketing request to generate
          a blog/social package from it.
        </p>
      </div>

      {episodes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-white p-8 text-center text-sm text-[var(--slate)]">
          No episodes found — check <code>PODCAST_RSS_URL</code> in{" "}
          <code>.env</code>.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {episodes.map((episode) => (
            <div
              key={episode.link || episode.title}
              className="flex items-start justify-between gap-4 rounded-lg border border-[var(--card-border)] bg-white p-4"
            >
              <div>
                <p className="text-xs text-[var(--slate)]">
                  {episode.date}
                  {episode.duration ? ` · ${episode.duration}` : ""}
                </p>
                <h2 className="font-medium">{episode.title}</h2>
                {episode.description && (
                  <p className="mt-1 max-w-xl text-sm text-[var(--slate)]">
                    {episode.description.slice(0, 220)}
                    {episode.description.length > 220 ? "…" : ""}
                  </p>
                )}
              </div>
              <Link
                href={`/requests/new?title=${encodeURIComponent(episode.title)}&description=${encodeURIComponent(episode.description)}`}
                className="shrink-0 rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
              >
                Create content from this
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
