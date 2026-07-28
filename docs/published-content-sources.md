# Published-content source map — documentation only, nothing built

This records where your *already-published* content actually lives,
per brand, so a future "what have I already published" feature doesn't
get designed around the wrong assumption. Per your correction earlier
in this project: Noticed's own database is not a complete record of
everything you've published, and Webflow is not the answer for every
brand either. Nothing here is implemented — no synchronization job, no
Webflow connector call, no read access to any of these systems. This is
only the map to build against later, once you approve that work.

## Alive Enough to Notice (personal writing/podcast site)

- **Source of truth:** your own git repo + Markdown content files,
  authored through Decap CMS, deployed via Netlify.
- **What "published" means here:** a Markdown file committed to that
  repo and built/deployed by Netlify — there is no separate database of
  record beyond the repo itself.
- **Canonical published URLs:** whatever Netlify serves the site at
  (the live AETN domain) — individual post URLs follow whatever path
  structure the Decap/Netlify site config uses.
- **What Noticed already reuses from this source today:** only the
  podcast RSS feed (`PODCAST_RSS_URL` in `.env`, pointed at the real
  Anchor.fm feed) — read-only, for listing episodes. Noticed does not
  read the blog/Markdown content from this repo, and there is no
  lineage between AETN posts and anything in Noticed's database.

## InfraNet

- **Source of truth:** the Webflow CMS/site content for
  infranet-hr.com — pages and collection items live in Webflow, not in
  InfraNet's own Next.js/Prisma app.
- **What "published" means here:** whatever is live in the Webflow
  site — draft vs. published state is Webflow's own concept, separate
  from anything Noticed tracks.
- **How this would be reached, if ever:** the Webflow MCP connector
  already available in this environment (`data_cms_tool`,
  `data_pages_tool`, etc.) or Webflow's own API — not built or called
  for this purpose yet.
- **Canonical published URLs:** whatever Webflow's live domain serves
  for infranet-hr.com.

## Social and newsletter (all brands, via Noticed itself)

- **Source of truth:** Noticed's own `PublishAttempt` records — every
  publish click through Noticed already writes one of these, success
  or failure, with a `destination`, a `success` flag, and a `url` when
  the provider returns one.
- **What "published" means here:** an `PublishAttempt` row with
  `success: true` — this is the one case where Noticed's own database
  genuinely is the record of truth, because Noticed is the thing doing
  the publishing.
- **Underlying providers, and where each destination's real state
  actually lives if you needed to double check:**
  - Narrareach-routed (Substack, X, Bluesky, LinkedIn, Facebook) — the
    canonical state is on Narrareach's own dashboard/API
    (`schedule_note`/`schedule_article`, `list_scheduled_posts`), since
    Narrareach is the thing actually posting to those platforms.
  - Buffer-routed (Google Business Profile) — canonical state is
    Buffer's own account (`list_channels`, post history), same reason.
  - Direct integrations (WordPress, Ghost, Reddit) — canonical state is
    that platform itself; Noticed's `PublishAttempt.url` is only as
    good as what that platform's API returned at publish time.
- **What this means for a future "sync published state" feature:**
  it would need to reconcile against three different upstreams
  (Narrareach, Buffer, and each direct platform's own API), not just
  read Noticed's own `PublishAttempt` table — a dropped connection or a
  provider-side edit could leave `PublishAttempt` stale without Noticed
  knowing.

## Explicit non-assumptions

- Noticed's content inventory (`MarketingRequest`/`ContentDraft`) is
  **not** a complete representation of anything actually live anywhere
  — it's the drafting/workflow layer, not a mirror of published state.
- Webflow is InfraNet's publishing surface specifically — it is **not**
  a stand-in for "wherever all your writing lives." AETN's real
  publishing surface is Netlify/Decap, a completely different system.
- There is currently **no lineage** connecting an AETN post to a
  Noticed record, or an InfraNet Webflow page to a Noticed record —
  each brand's already-published history lives where it always has,
  untouched by this project so far.
