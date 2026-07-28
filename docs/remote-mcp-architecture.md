This is documentation of the remote MCP design and hosting tradeoffs.

**Implementation status:** Streamable HTTP MCP + single-owner OAuth + Fly deploy
artifacts are in the codebase. Operational connect/deploy steps:
[CHATGPT-MCP.md](./CHATGPT-MCP.md).

The sections below remain useful context (why Fly + SQLite, why OAuth for
ChatGPT Connect, what stayed out of scope). They were written before
implementation; prefer CHATGPT-MCP.md for “how do I turn this on.”

---

# Remote MCP architecture

Today, Noticed is: Next.js 16 + SQLite (`dev.db`, currently ~100KB) +
    env-file secrets, running only on your own machine when undeployed, with no auth layer
    because there's never been a second user to authenticate against. The
    local stdio MCP server (`src/mcp/server.ts`) talks to that same local
    SQLite file directly — that only works because the MCP client (ChatGPT
    Desktop, or whatever spawns it) and the server are on the same machine.
    A *remote* MCP connection — ChatGPT's servers reaching a Noticed
    instance that runs continuously somewhere — is a different shape of
    problem. The points below are the pieces of that problem.

## 1. Hosting options for this single-owner app

Three realistic shapes, in order of how much they change:

- **A single small VM/box you control** (Fly.io, a $5–6/mo DigitalOcean
  droplet, Railway, a Raspberry Pi on your own network with a tunnel).
  Closest to what you have now — you still own the filesystem, so
  SQLite keeps working as-is. Lowest behavior change, but you're the
  one who patches the OS and restarts it if it crashes.
- **A managed app platform** (Vercel, Render, Fly's managed layer).
  Next.js deploys here with almost no code change, but these platforms
  run your app as ephemeral/serverless functions with *no persistent
  local disk* — which is the one fact that forces the SQLite question
  below.
- **A managed container + managed database**, i.e. the app on Fly/Render
  and the database on a separate managed Postgres. More moving parts,
  but the standard shape for "small app, needs to survive restarts and
  redeploys."

For a single owner with no uptime SLA to anyone else, the first option
(a small persistent VM) is the least disruptive starting point — it's
the only one of the three where "replace SQLite" isn't forced on you
immediately.

## 2. What changes if Noticed moves beyond local SQLite

Right now the whole trust model is "if you can reach the file, you're
the owner" — there's no login screen because there's never needed to
be one. The moment Noticed runs somewhere reachable over the network
(even just by you, remotely), that assumption breaks: anyone who can
reach the port can reach the app, unless something in front of it
checks who's asking. That's what points 5–8 below are actually about —
they're not optional extras, they're the direct consequence of "not on
my own machine anymore."

## 3. Does SQLite survive the move?

Depends entirely on the hosting choice in point 1:

- On a persistent VM with a real disk (option 1) — yes, unchanged.
  SQLite doesn't care that the disk is remote instead of your laptop's.
- On a serverless/ephemeral platform (option 2, e.g. Vercel) — no.
  The filesystem resets between invocations/deploys, so anything
  written to `dev.db` disappears. This is a hard blocker on that
  platform shape specifically, not a SQLite limitation in general.
- With a mounted persistent volume on a container platform — yes, with
  caveats: SQLite assumes a single writer, and most managed volumes
  don't guarantee that if you ever scale to more than one instance.
  For a single-owner app that will never need to scale horizontally,
  this caveat mostly doesn't bite — but it's the reason SQLite-in-
  production advice usually says "fine until you need more than one
  app process."

## 4. Managed database alternatives, if SQLite doesn't survive

If the hosting choice forces the issue (i.e. you pick an ephemeral
platform), the standard swap is a managed Postgres — Neon, Supabase,
or the hosting platform's own offering (e.g. Vercel Postgres). Prisma
already abstracts most of this: swapping the datasource provider and
adapter is a real migration (schema, data, and the `@prisma/adapter-
better-sqlite3` import specifically), but it's not a rewrite of
Noticed's logic. This is real work, not a checkbox — but it's
mechanical work, not a redesign.

## 5. Private remote MCP transport

Local stdio (what exists today) only works because the MCP client and
server share a machine. Reaching Noticed from ChatGPT's own servers
requires MCP's other transport: **Streamable HTTP** — an HTTP(S)
endpoint the remote client connects to, instead of a spawned local
process. This is a protocol-level swap (the SDK supports both), not a
rewrite of the five tools themselves — the tool handlers you already
built stay the same; only the transport wrapper around them changes.

## 6. Authentication for one authorized owner

Once the endpoint is reachable over the internet, something has to
answer "is this really you." For exactly one owner (not a multi-tenant
signup flow), the realistic options are:

- A single long-lived bearer token you generate once and paste into
  ChatGPT's MCP connector config — simplest, and arguably sufficient
  for a one-person system, as long as it's treated like a password.
- A proper OAuth flow (what ChatGPT's connector UI is built to expect
  for hosted MCP servers) — more setup (you'd be standing up an OAuth
  provider, or using one), but it's what lets ChatGPT show a normal
  "Connect" button instead of you hand-copying a token.

For a single owner, a bearer token is the honestly-sufficient answer;
OAuth is the "look like a real hosted product" answer. Neither is
implemented — this is the fork in the road, not a recommendation to
take one path yet.

## 7. Token revocation

Whichever auth method above, you need a way to kill access without
redeploying the whole app — e.g. if a laptop with the token saved gets
lost. Concretely: store the active token(s) in the database (not just
in an env var), check incoming requests against that table, and give
yourself one action ("revoke") that deletes the row. Not implemented;
noted because "how do I turn this off" is a real operational question,
not a hypothetical.

## 8. Secret storage

Right now, every credential lives in a local `.env` file that never
leaves your machine — that's the whole security model today. Remote
hosting removes "it never leaves my machine" as a given. The
replacement is the host's own secret manager (Fly secrets, Render
environment groups, a `.env` uploaded once through the platform's
dashboard rather than committed to git) — the credentials move from a
file you can see to a vault you configure through the host's UI. This
doesn't change what Noticed's code does with the secrets, just where
they're read from.

## 9. Audit logging

Locally, "who did this" has never mattered — it's always been you.
Remotely, even with just one authorized owner, you gain a new failure
mode: a leaked token being used by someone who isn't you. Worth logging
(request timestamp, which MCP tool was called, success/failure) so a
compromised token is at least visible after the fact, even though
there's no multi-user access-control problem to solve. `Activity` and
`PublishAttempt` already give you this pattern for in-app actions;
extending it to MCP tool calls specifically is additive, not a new
concept.

## 10. Deployment and backup requirements

Whatever host you pick, you take on jobs that didn't exist when
Noticed only ran on your laptop: keeping the process alive across
crashes/reboots, applying Prisma migrations against a database that
now has real content in it (not a throwaway dev copy), and backing up
whichever database ends up holding it — a nightly SQLite file copy if
you stay on SQLite, or the managed provider's built-in backups if you
move to Postgres. None of this is hard, but none of it is automatic
either — it has to be someone's explicit job (yours), where locally it
was nobody's job because nothing could be lost that mattered.

## 11. Reusing the local MCP tool handlers remotely

The good news from how this was built: the five tool handlers in
`src/mcp/server.ts` already call into the framework-agnostic service
layer (`src/lib/services/*`), not directly into Prisma or into
Next-request-scoped code. That separation is exactly what makes a
future remote transport cheap — the *transport* (stdio vs. Streamable
HTTP) changes, but `searchContent`, `getBrandContext`,
`createDraftFromIdea`, `updateDraft`, and `getCalendarEntries` don't
need to change at all. This was a deliberate choice made now
specifically to make this later step smaller.

## 12. Smallest realistic path from local POC to hosted-in-ChatGPT

In order, each step buildable and testable on its own:

1. Deploy Noticed to a single persistent VM (point 1) with SQLite
   unchanged — prove the app itself survives being remote before
   touching MCP at all.
2. Swap the MCP server's transport from stdio to Streamable HTTP,
   reusing the same five tool handlers unchanged, and add the bearer-
   token check (point 6) in front of it.
3. Point ChatGPT's MCP connector config at that endpoint and verify
   the same five tools behave identically to the local POC.
4. Only after that's proven stable, revisit whether Postgres/OAuth/
   audit logging are worth the added complexity for a single owner.

## 13. What stays local vs. what goes remote

- **Stays local, indefinitely, regardless of any of the above:** your
  `.env` file with third-party publishing credentials (Narrareach,
  Buffer, WordPress, etc.) never needs to move anywhere — those calls
  originate from wherever Noticed's server process runs, which would
  be the remote host, but the *values* only need to exist in that
  host's secret store, not anywhere else.
- **Goes remote, if you take this step at all:** the Noticed app
  process itself, its database (SQLite or Postgres), and the MCP
  endpoint ChatGPT connects to.
- **Never remote under this plan:** a client-facing signup flow, a
  multi-tenant admin surface, or anything resembling the marketing-
  ops-for-companies product you already split off from Noticed.

## 14. Ongoing cost and operational burden

Rough honest numbers for a single-owner setup, not a companies-scale
deployment:

- A small VM (option 1): roughly $5–10/month, plus your own time to
  apply OS updates and restart it if it wedges.
- A managed Postgres, if point 3/4 forces that swap: free tier is
  realistic at this scale (a few hundred KB to low MB of data), but
  free tiers on Neon/Supabase-style hosts typically pause the database
  after inactivity — the first request after a pause is slow, not
  broken, but worth knowing.
- Time cost is the real line item: someone (you) now owns "is it up,"
  where locally the answer was always trivially yes. That's a genuine
  ongoing responsibility, not a one-time setup cost.

---

Nothing above has been implemented. The next real decision point, when
you're ready, is point 12's step 1 — hosting the app itself, before any
MCP transport or auth work begins.
