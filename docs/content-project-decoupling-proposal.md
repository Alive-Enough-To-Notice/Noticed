# ContentProject decoupling proposal

> **Status: implemented** (commit `5605c20`, same day). The owner
> approved this direction with one structural amendment before
> implementation: **`ContentDraft.requestId` was removed entirely,
> not left nullable alongside `contentProjectId`.** The dual-nullable
> shape originally proposed in point 7 below would have technically
> permitted a draft with no parent at all and preserved two competing
> ways to determine ownership — both explicitly rejected. Since the
> database had zero real rows in every affected table, there was no
> data to migrate, so `requestId` was dropped outright in a single
> migration rather than phased. Everything else below — the relation
> tables, `Restrict` on project deletion, the transactional MCP tool,
> brand-consistency checks — was implemented as proposed. See the
> commit message on `5605c20` for the full verification account (all
> 14 required checks demonstrated live before re-enabling
> `create_content_draft`).

This was the exact proposal requested before implementation began; the
body below is preserved as written at the time, for the record.

---

**No schema has been touched.** `create_content_draft` was paused at
the MCP boundary in a separate commit (see `src/mcp/server.ts`) so it
can't fabricate a false `MarketingRequest` in the meantime — that pause
is a safety action, not part of this proposal, and doesn't depend on
anything below being approved.

Confirmed directly before writing this (point 9, first, since
everything else depends on the answer): **the database currently
contains zero `MarketingRequest`, zero `ContentDraft`, zero `Activity`,
and zero `PublishAttempt` rows.** Only `Brand` (4) and `KnowledgeRecord`
(8) exist, both real InfraNet setup from earlier, not test debris. This
is the cheapest possible moment to fix the parent relationship — there
is nothing to migrate yet, which simplifies several answers below.

## 1. Proposed `ContentProject` columns, constraints, relations

```prisma
model ContentProject {
  id        String   @id @default(cuid())
  brandId   String
  brand     Brand    @relation(fields: [brandId], references: [id])
  title     String
  premise   String?
  status    ContentProjectStatus @default(ACTIVE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  drafts            ContentDraft[]
  marketingRequests MarketingRequestContentProject[]
  // ideas: Idea[] — only if Idea ships in this same slice; see point 2
}

enum ContentProjectStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  ARCHIVED
}
```

`brandId` is required, direct — same pattern already used for
`MarketingRequest`/`KnowledgeRecord` (the two other "entry point"
models that get a direct `brandId`, with everything hanging off them
deriving brand through the relation instead of duplicating the
column). No constraint requires an `Idea` or a `MarketingRequest` to
exist — a `ContentProject` can be created directly.

## 2. Minimum `Idea` columns — and whether it's needed immediately

```prisma
model Idea {
  id               String          @id @default(cuid())
  brandId          String
  brand            Brand           @relation(fields: [brandId], references: [id])
  content          String
  source           String?
  contentProjectId String?
  contentProject   ContentProject? @relation(fields: [contentProjectId], references: [id])
  createdAt        DateTime        @default(now())
}
```

**Recommend: not required for this slice.** The actual bug being fixed
is `ContentDraft`'s parent, not idea capture. `Idea`/"Idea Garden" is a
genuinely good low-friction feature, but it's additive polish, not
load-bearing for correctness — a `ContentProject` can and should be
creatable directly (via a future `create_content_project` tool, point
11) without first passing through an `Idea` row. Defer `Idea` to a
follow-on slice once `ContentProject` itself is proven.

## 3. How Brand relates to ContentProject and ContentDraft

`Brand → ContentProject` — direct `brandId`, as shown above.
`ContentProject → ContentDraft` — `ContentDraft` does **not** get its
own `brandId`; it derives brand through `contentProjectId →
ContentProject.brandId`, consistent with how `ContentDraft` already
derives brand through `requestId → MarketingRequest.brandId` today.
No new pattern introduced here — the same "only true entry-point
models get a direct `brandId`" rule from the existing multi-brand work
applies unchanged.

## 4. Does MarketingRequest link directly to ContentProject, or through a relation table?

**Relation table, not a direct foreign key on either side:**

```prisma
model MarketingRequestContentProject {
  id                 String           @id @default(cuid())
  marketingRequestId String
  marketingRequest   MarketingRequest @relation(fields: [marketingRequestId], references: [id], onDelete: Cascade)
  contentProjectId   String
  contentProject     ContentProject   @relation(fields: [contentProjectId], references: [id])
  createdAt          DateTime         @default(now())

  @@unique([marketingRequestId, contentProjectId])
}
```

A direct FK on either model would force a 1:1 or 1:many-from-one-side
shape. The real-world diagram already drawn (`MarketingRequest →
triage/acceptance → ContentProject`) implies a triage step that can
reasonably fan out or consolidate — see points 5 and 6. A relation
table costs almost nothing extra and doesn't foreclose either
direction later.

## 5. Can one MarketingRequest create multiple ContentProjects?

Yes — should be allowed structurally. Example: one campaign request
("promote the new safety training") could reasonably spin off a
separate blog project and a separate social-only project. The relation
table in point 4 supports this with no special-casing.

## 6. Can one ContentProject respond to multiple MarketingRequests?

Also yes, structurally — e.g. two different stakeholders independently
requesting "something about the new policy" could both be satisfied by
one underlying project. This will likely be rare in practice; the
recommendation is to allow it in the data model without building any
UI that assumes it's common. Don't over-design around the rare case.

## 7. How is `ContentDraft.requestId` migrated, deprecated, or removed?

`requestId` is today a **required**, non-nullable FK. The safe path,
matching the same nullable→backfill→required *(here, inverted:
required→nullable)* two-phase style already used for the `Brand`
rollout:

- **Phase 1 (additive, zero risk):** add `ContentProject`, add
  `MarketingRequestContentProject`, add a **nullable**
  `ContentDraft.contentProjectId`. `requestId` stays required and
  unchanged — nothing about existing behavior moves yet.
- **Phase 2:** make `ContentDraft.requestId` **nullable**. Enforce "at
  least one of `requestId` / `contentProjectId` must be set" at the
  application layer (SQLite/Prisma don't make a clean multi-column
  `CHECK` constraint ergonomic here — application-level enforcement,
  same as several other invariants in this codebase already).
- **Not part of this slice, a later cleanup:** actually dropping
  `requestId` from the schema once nothing reads it directly anymore.
  Keeping it as a nullable, increasingly-vestigial column is safer than
  a hard removal migration, and there's no urgency to remove it — see
  point 12 for why it may stay useful even longer-term.

## 8. How would existing ContentDraft rows be backfilled?

Given point 9's answer (zero real rows exist), **backfill is moot for
this database right now** — there is nothing to migrate. Recorded for
completeness in case this is ever run against a database that does
have real data: for each existing `ContentDraft.requestId`, create one
`ContentProject` per distinct `MarketingRequest` (copying
`title`/`brandId`), link it via `MarketingRequestContentProject`, then
set `contentProjectId` on that request's drafts.

## 9. Does the current database contain any real requests or drafts?

**No.** Checked directly before writing this proposal:
`MarketingRequest` = 0, `ContentDraft` = 0, `Activity` = 0,
`PublishAttempt` = 0. Only `Brand` (4, real) and `KnowledgeRecord` (8,
real InfraNet voice/positioning records) exist. This is the cheapest
possible moment to make this change, exactly as observed.

## 10. How should `create_content_draft` behave once corrected?

**Both, via one optional parameter — not an either/or:** accept an
optional `contentProjectId`. If provided, attach the new draft to that
existing project. If omitted, atomically create a new lightweight
`ContentProject` (title derived from the draft's own title) **and**
the draft, in one transaction — preserving today's low-friction "just
save what I wrote" conversational flow for the common case, while
still letting a client attach follow-up content to a project it
already started. This mirrors what `create_content_draft` already does
today (always creates a wrapper), just pointed at the correct parent
model.

## 11. Is a separate `create_content_project` tool cleaner?

Yes, recommended as a **follow-on**, not part of this slice: a tool to
establish a project's premise/context before any content exists in it
("start a project about administrative burden") — useful once a
client wants to develop an idea across multiple turns before writing
the first piece. Not required to fix the current bug; `create_content_
draft`'s auto-create-a-project-if-none-given behavior (point 10)
already covers the immediate need.

## 12. How does the existing Marketing Operations UI keep working?

Unaffected in Phase 1 (purely additive). In Phase 2, once `requestId`
becomes nullable, the existing request-detail page's queries
(`prisma.marketingRequest.findUnique({ include: { drafts: ... } })`)
still work unchanged **as long as `MarketingRequest`-originated drafts
keep `requestId` set** — which they will, since Marketing Operations
drafts aren't going through the new Creator Studio path at all. The
only drafts that will have `requestId = null` are ones created through
the new `ContentProject`-only path, which the existing Marketing
Operations UI was never displaying anyway. No code change to the
existing request pages is required by this slice.

## 13. How does Creator Studio avoid surfacing MarketingRequest?

By construction: Creator Studio's own future routes/MCP tools
(`create_content_project`, a future `/studio` UI, etc.) only ever read
or write `Idea`/`ContentProject`/`ContentDraft`-via-`contentProjectId`.
They never query or reference `MarketingRequest`. The existing
`/requests` pages remain the Marketing Operations surface,
untouched and not reused for Creator Studio.

## 14. RLS or single-owner access implications

None. This stays single-owner, no auth boundary, no tenant concept —
SQLite has no RLS mechanism regardless (that's a Postgres/Supabase
feature this project deliberately doesn't need). The new relation
table introduces no access-control surface; there is still exactly one
person who can read or write anything here.

## 15. Revision and delete behavior

- **`ContentProject` deletion should NOT cascade to its drafts** by
  default — unlike `MarketingRequest`'s current `onDelete: Cascade` to
  its drafts. A project may hold real, approved, possibly-published
  content; an accidental project delete silently wiping that content
  is a worse failure mode than InfraNet's current ticket-style
  cascade. Recommend `onDelete: Restrict` (deleting a project with
  drafts attached fails until they're reassigned or explicitly
  removed first) rather than copying the existing cascade pattern
  without reconsidering it.
- **Idea → ContentProject promotion is non-destructive** — the `Idea`
  row stays after `contentProjectId` is set; ideas are never deleted
  automatically.
- **Unlinking a `MarketingRequestContentProject` relation row** should
  never delete the `ContentProject` or its drafts — the relation table
  only records that a link existed; removing the link is independent
  of the project's own lifecycle.

## 16. The smallest safe implementation slice

Because `create_content_draft` can't actually be re-enabled until
drafts can point somewhere other than a fabricated `MarketingRequest`,
Phase 1 and the `requestId`-nullable half of Phase 2 have to land
together for the fix to be real — a purely additive `ContentProject`
model with `requestId` still required wouldn't let the paused tool
resume safely. The smallest slice that actually closes the gap:

1. Add `ContentProject` (point 1).
2. Add `MarketingRequestContentProject` (point 4).
3. Add nullable `ContentDraft.contentProjectId`.
4. Make `ContentDraft.requestId` nullable, with the application-level
   "at least one parent" invariant (point 7).
5. Update `create_content_draft` (point 10) to create-or-attach a
   `ContentProject` instead of a `MarketingRequest`, and un-pause it.
6. Verify live, the same way every prior MCP change in this project
   has been verified: call `create_content_draft` for real, confirm no
   `MarketingRequest` row appears, confirm the draft is reachable via
   `search_content`, confirm the existing `/requests` pages are
   unaffected (still 0 real rows there, still render correctly).

Everything else in this proposal — `Idea`, `create_content_project`,
deletion-cascade policy refinements, dropping `requestId` entirely — is
real future work, but not required to stop `create_content_draft` from
lying about where content came from.

---

**Update:** the plan above was approved (with the amendment noted at
the top of this document) and implemented in commit `5605c20`. The
wider media studio, media dependencies, and anything beyond the
existing publishing behavior remain explicitly out of scope and were
not touched.
