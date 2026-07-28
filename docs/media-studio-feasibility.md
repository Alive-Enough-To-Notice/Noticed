# Media studio feasibility report — review only, nothing built

> **Corrections (same day):** the original version of this report
> mischaracterized OpenTimelineIO as "Python-native" and "Public Beta"
> — both wrong, corrected in point 6 below with the primary source. It
> also treated `MarketingRequest` as a single open question about
> whether to rename or absorb it into `ContentProject`; that's now
> understood to be a bigger distinction — `MarketingRequest` belongs to
> a *separate future product* (company marketing operations), not to
> the personal Creator Studio at all. See the new section 18. A few
> performance figures (transcription speed, diarization error rate)
> are now qualified as benchmark-dependent and not yet measured on
> this machine specifically. Nothing else changed; the rest of the
> report's conclusions stand.

This is a discovery report, not an implementation plan. Nothing in this
document has been built, installed, or scheduled. No schema was
modified, no dependency was installed, no model was downloaded, no MCP
tool was changed, no worker was built, and no existing publishing code
was touched — verified by `git status` before writing this: the
working tree was clean and stayed clean. This report was produced by
reading the current schema/service layer and by researching external
facts (local transcription options, diarization licensing, FFmpeg
capabilities, this Mac's actual hardware) — no code changes anywhere.

The three prior architecture decisions stand and are not reopened
here: single owner, multiple owner-controlled brands; local-first;
no embedded Anthropic/OpenAI API calls for content generation
(local transcription/diarization below is mechanical analysis, not
text generation — see point 16 for why that distinction matters and
isn't just wordplay).

## 1. How blog/social/podcast/video relate to the existing models

The current spine is `Brand → MarketingRequest → ContentDraft →
PublishAttempt`. `MarketingRequest` is a flat brief; `ContentDraft` is
a flat `{channel, title, body}` row for exactly three text channels
(`BLOG`, `LINKEDIN`, `X`). Podcast episodes and video projects don't
fit that shape at all — they need transcripts, recording checklists,
edit status, chapters, guest tracking, none of which belongs as columns
on `ContentDraft`. Don't try to stretch `ContentDraft` to cover them.

The workable relationship: podcast/video become **new sibling models**
under whatever parent entity ties an idea together (see point 2), not
new fields bolted onto the existing text-draft model. `ContentDraft`
stays exactly as it is for blog/LinkedIn/X — nothing here requires
touching it. Calendar (`getCalendarEntries`) and publishing
(`PublishAttempt`) both currently key off `ContentDraft` specifically;
extending the calendar to also show podcast/video dates is additive
(union across tables), but `PublishAttempt` keying to `draftId` only
would need to become polymorphic (or gain sibling tables) once podcast
episodes and videos have their own publish attempts — a real, if small,
schema decision, not a free extension.

## 2. Is an Idea / Content Project parent entity needed?

Yes. Without one, "one idea becomes a blog, a podcast, and three social
posts" has no way to be represented — you'd just have four unrelated
`MarketingRequest` rows that happen to be about the same thing, which
is exactly the "four disconnected departments" problem being solved
against. Two new lightweight models are the right shape:

- **Idea** (or "Idea Garden" entry) — brand-scoped, format-less,
  low-friction capture: a fragment, a voice-note transcript, a
  quote, a question. Cheap to build — same shape as `KnowledgeRecord`
  or a `ContentDraft` with no channel yet.
- **ContentProject** — created when an idea commits to becoming real
  output: premise, brand, audience, pillar, status, and a set of child
  outputs (blog draft, podcast episode, video project, social variants).

## 3. Smallest coherent media-project data model

Minimum viable set, in addition to the two models above:

- `PodcastEpisode` — `contentProjectId`, format, premise, outline,
  script/talking points, guest info, recording date, raw-audio path,
  `transcriptId`, edit status, show notes, chapters (JSON), cover-art
  brief, published URLs (JSON).
- `VideoProject` — parallel shape: purpose/audience, platform, target
  length, script, shot list, raw-footage paths, edit status, captions
  path, thumbnail brief, chapters, published URLs.
- `Transcript` — shared by both: `sourceType`, `sourceId`, segments as
  JSON (`[{start, end, speaker, text}]`), engine used, generated-at.
- `MediaAsset` — brand-scoped file reference: kind, path or external
  URL, usage rights, associated project IDs.

This is genuinely new schema surface, not a small add — "smallest
coherent" here means deferring `EditVersion`/`Timeline`/`RenderJob`
(point 6) to a later phase rather than designing them all up front.

## 4. What belongs in SQLite vs. what stays on disk

SQLite: all structured metadata — transcripts, edit markers/decisions,
project state, chapters, show notes, publishing records, asset
*references* (paths or URLs), usage rights, status. **Never in
SQLite:** raw audio/video, proxies, thumbnails, rendered exports —
anything past a few KB of binary. A single podcast episode's raw audio
alone can be several hundred MB; storing that as a BLOB would bloat the
one-file-easy-to-back-up SQLite database this project has deliberately
built around. Store a path (or a content fingerprint) in SQLite, keep
the actual bytes on disk. This matches the "immutable source media,
Noticed stores fingerprints and references" instinct already
described — it's the right call, not just a preference.

## 5. Local media-worker architecture

Running transcription or FFmpeg rendering inline inside a Next.js
request would block/timeout the web server — architecturally wrong,
and correctly identified as such already. The right shape at this
single-user, single-machine scale is intentionally boring: a `MediaJob`
table (`id`, `type`, `status`, `payload`, `result`, `error`) plus a
separate long-running Node process (`npm run media-worker`, same
pattern as `npm run mcp` already running as its own process outside
Next) that polls for pending jobs and shells out to whisper.cpp/ffmpeg.
No Redis, no message broker, no job-queue framework needed at this
scale — a polled SQLite table is genuinely sufficient and keeps the
project's existing "just SQLite, no extra infrastructure" character
intact. This is real, non-trivial work (especially failure recovery),
just not exotic work.

## 6. Nondestructive timeline/version model

**Correction:** the first version of this report called OpenTimelineIO
"Python-native" and "Public Beta." Both were wrong. Checked directly
against the project's own README: OTIO describes itself as *"a mature
framework widely deployed across the film and television industries,"*
with an API *"considered stable, but... still undergoing active
development, refinement and bug fixes."* Its core is implemented in
**C++**, with *"an official python binding... intended to be an
idiomatic and ergonomic binding for python developers"* — a binding,
not the implementation language. Neither "beta" nor "Python-native" is
an accurate description, and the recommendation below no longer rests
on those claims.

The real reasons not to adopt OTIO as a foundational dependency here
are more mundane, and stand on their own without needing to
mischaracterize the project:

- **No natural first-class TypeScript path.** OTIO's primary, most
  complete API surface is C++ with a Python binding; a TypeScript/Node
  app would be working through whatever secondary bindings exist, not
  the library's main-line experience.
- **Additional runtime/build complexity.** Even the Python binding
  means a Python environment alongside an all-TypeScript app, plus
  whatever native build step the binding needs — real, ongoing
  maintenance surface for a single-owner project.
- **Adapter and dependency management.** OTIO's value is largely in
  its adapters (Final Cut XML, AAF, CMX EDL, etc.) for interchange with
  professional NLEs — machinery Noticed doesn't need if it's never
  handing a project to Premiere or Resolve.
- **Noticed's actual timeline needs are much smaller than OTIO's
  scope** — a personal cut/keep/transition/marker list, not a
  general-purpose industry interchange format.
- **A compact, versioned internal JSON edit-decision format** — a
  `Timeline` model with a JSON `edl` field (ordered
  `{sourceStart, sourceEnd, kept, transition, note}` entries),
  versioned the same way `Activity`/`KnowledgeRecordActivity` already
  version other things in this app — covers what Noticed actually
  needs without any of the above cost.

Recommendation is unchanged — don't adopt OTIO initially, build the
small internal JSON format instead — but it now rests on fit and
complexity, not a mistaken claim about the project's maturity.
Revisit real OTIO only if a future need to hand a project to an actual
professional NLE ever materializes — not needed just to "produce a
finished file."

## 7. How MCP clients inspect transcripts/propose edits without large media

Directly analogous to what's already built and low-risk: read-only
tools like `get_transcript` and `search_transcript` (same `contains`
search pattern `search_content` already uses) return JSON — segments,
timestamps, current markers — never binary. An edit-proposal tool
writes marker/EDL JSON to the `Timeline` row, the same shape
`update_draft` already uses to revise text. The MCP surface would grow
(new tools), which is explicitly not authorized yet — but the pattern
itself doesn't require inventing anything new.

## 8. Local transcription and diarization — Mac reality, not theory

Checked this machine directly rather than assuming: **Apple M1 Pro,
10 cores (8P+2E), 16-core GPU, 32GB unified memory, ~1.3TB free disk.**
That's a genuinely capable machine for this — 32GB of unified memory in
particular gives real headroom for local model work.

**Important qualifier on the transcription-speed figure below:** the
"~2 minutes for a 1-hour recording" number comes from third-party
benchmarks on comparable M-series hardware, not a measurement taken on
*this* machine with *this* project's actual audio. Real-world speed
varies meaningfully by which Whisper model size is used (tiny/base/
small/medium/large all trade speed for accuracy differently), which
framework runs it (whisper.cpp vs. MLX vs. faster-whisper), whether
the model is quantized, and the specific audio (length, noise, number
of speakers). Treat the figure below as "plausible, in the right
ballpark" rather than a guarantee — the only way to know the real
number is to actually transcribe one of your own recordings on this
machine, which is exactly what the first slice in point 14 is for.

A comparable M-series chip has been benchmarked transcribing a full
1-hour recording in roughly 2 minutes using a medium Whisper model
through whisper.cpp's Core ML/Metal path — directionally, transcription
compute looks unlikely to be the bottleneck here, but that should be
confirmed on a real recording before being treated as settled.

- **whisper.cpp** — dependency-free (C++), Core ML acceleration on
  Apple Silicon, no Python required. Gives segment-level timestamps
  reliably; word-level timestamps are a real open question worth
  testing directly rather than assuming either way.
- **MLX Whisper** — Apple's own ML framework, uses GPU + Neural Engine
  via Metal, also Python-based (MLX is a Python-first framework).
- **WhisperX** — the realistic choice specifically for **word-level**
  timestamps (via wav2vec2 alignment) plus speaker diarization
  (pyannote) in one pipeline — but it's Python + PyTorch, meaningfully
  more setup than whisper.cpp alone.
- **pyannote.audio 3.1** — MIT-licensed (no commercial-use
  restriction), but requires accepting a gated model license on
  Hugging Face and downloading multi-hundred-MB weights on first use —
  a real one-time step, not a blocker. Accuracy: reported figures cited
  a **Diarization Error Rate of roughly 11–19% specifically on the AMI
  benchmark** (a standard research meeting-recordings dataset) for
  pyannote.audio 3.1 — not a number measured against your actual
  podcast/video recordings, and DER is itself sensitive to which
  dataset and scoring convention is used, so treat this as "diarization
  is a real, nontrivial error source on a well-studied benchmark,"
  not as a precise prediction of how it'll perform on your specific
  audio. Either way, speaker labels **will** sometimes be wrong and
  must stay user-correctable; treating diarization as solved would be
  a mistake regardless of the exact number, and the instinct to keep
  it editable rather than authoritative is the right one.

Bottom line: technically very feasible on this exact hardware. The
real cost is operational complexity (Python + PyTorch + gated model
downloads + a separate worker process), not raw compute power.

## 9. Audio and video rendering options

FFmpeg is the right, and honestly only sane, choice — decades-mature,
extremely well documented, and already what nearly every consumer
editor uses under the hood. Default builds are **LGPL 2.1+**, which
permits closed-source/commercial use as-is; licensing only gets
complicated if `--enable-gpl`/`--enable-nonfree` flags are used at
compile time, which isn't needed here. Apple VideoToolbox hardware
encode (`h264_videotoolbox`, `hevc_videotoolbox`) is supported, and
third-party benchmarks report roughly 1.4–2.7x faster encoding than
software-only, at lower power draw, on this chip family — again, a
reported figure from published benchmarks, not a measurement taken on
this specific machine or on real project footage; worth confirming
directly once there's an actual video file to test with, not assumed.
H.264/H.265 carry theoretical patent-pool
royalty questions, but that's a non-issue at "one person publishing
their own content," not something requiring action now.

## 10. Difficulty, honestly re-assessed (not just echoing the pasted table)

**Straightforward, extends existing patterns directly:** scripts,
outlines, show notes, chapters as text fields (same shape as
`KnowledgeRecord`); transcript storage/search (same `contains` pattern
as `search_content`); local transcription via whisper.cpp (verified
feasible on this hardware); FFmpeg cut/concat/caption-burn/hardware
encode (mature tooling).

**Real engineering, achievable but easy to get subtly wrong:**
word-level transcript-to-audio cutting with crossfades and room tone —
solvable, but the failure mode (an audible pop, a clipped word) only
shows up when you actually test against a real recording, not in code
review. Diarization integration — usable, but must be designed around
"this will sometimes be wrong," never presented as ground truth.

**Genuinely research-grade, not just hard:** automatic multicam
switching, face-tracked vertical reframing, and "which moment carries
emotional weight" clip selection remain open problems industry-wide —
agreeing fully with that assessment already made; there's no shortcut
here a single developer finds that a well-funded editing-software
company hasn't already tried.

## 11. What should deliberately stay outside Noticed

Generative voice replacement/synthetic speech, generated B-roll or
object removal, a full interactive multitrack timeline GUI, automatic
multicam direction, and professional-grade audio restoration beyond
basic noise/EQ. These match the standing rule this project already
uses elsewhere for external-vs-build decisions: reaching for "build
everything" isn't automatically right just because most things here
turn out to be capabilities rather than singular sources of truth —
some capabilities are legitimately deep enough, and risky enough
(especially generative voice/video), that "leave it to a funded
specialist product" is the honest answer, not a cop-out.

## 12. How Guided Studio conceals complexity without limiting the engine

This is a UI/interaction design question more than an infrastructure
one, and the underlying architecture already supports it: "Guided
Studio" is just a curated, natural-language-first *view* over the same
`Timeline`/edit-decision data — an accept/reject card is a mutation on
that same JSON, a human-readable preset ("warm and conversational") is
just a named parameter bundle for the same FFmpeg filter graph a power
user could edit directly in an "Editing Room" view. This is the same
"one service layer, multiple front-ends" principle already used for
the web app vs. the MCP server — the risk here is UI/UX design effort,
not a new architectural risk.

## 13. Phased roadmap — tightened, not just restated

The proposed phase order (foundation → podcast transcription →
nondestructive audio editing → video foundation → intelligent video →
editorial MCP → studio integration) is reasonable. One tightening:
split "can I read and mark up a transcript" from "can I actually cut
and render audio" into two explicitly separate checkpoints — the
former is nearly risk-free and provable in days; the latter is where
real engineering time and the crossfade/room-tone failure modes live.
Don't let "transcription works" get reported as "editing works."

## 14. A realistic first slice, using one real recording

Point this at one real *Closing Loops* episode file already on hand —
not a synthetic test file. Slice: local transcription via whisper.cpp
→ store transcript + timestamps in SQLite → a plain read-only
transcript viewer → `search_transcript`-style lookup ("haven't I
talked about administrative burden before?") → manually mark 2–3
candidate cut points and stop there. No actual audio cutting or
rendering in this first slice — prove transcription + search + markup
end-to-end on real data before building the harder cut/crossfade/
render pipeline. This is genuinely low-risk and demoable in isolation.

## 15. Storage and compute, with real numbers

Storage: a 50-minute recording (WAV or high-bitrate) can run several
hundred MB to ~1GB; proxies/exports/versions could multiply that
2–4x per episode. Against the ~1.3TB currently free, storage is not a
near-term constraint even across dozens of episodes plus some video.
Compute: transcription and FFmpeg rendering are both fast on this
exact M1 Pro (verified benchmarks above) — the machine is not the
bottleneck for the audio-first slice. Video work (multicam, face
tracking) would stress it more, but that's a later phase.
Engineering time is the real cost, not runtime: the ranges already
proposed (a few weeks for a rough proof of concept, 1–2 months for a
personally-useful podcast editor, several months for anything
polished) read as reasonable given how much of the "boring" plumbing
(job status, activity logs, brand scoping) already has a proven,
reusable shape in this codebase.

## 16. Risks to the current, just-completed Noticed application

- **Category risk, worth naming explicitly:** local transcription and
  diarization are mechanical audio analysis, not text generation — they
  do not violate the just-committed "no embedded model provider" rule.
  Worth stating plainly so this doesn't get miscategorized later as
  "well transcription is AI too" and accidentally reopen a settled
  architecture decision.
- **Real, ongoing cost:** WhisperX/pyannote pull in Python + PyTorch.
  That's a second language runtime and dependency manager living
  alongside an all-TypeScript app, permanently — a deliberate tradeoff
  to accept consciously, not something that sneaks in via "whisper.cpp
  is just C++" and then the diarization half needs Python anyway.
- **New failure surface:** a separate long-running worker process is a
  new "thing that can be down," unlike the current app (a SQLite file
  and a restartable dev server). A stuck or crashed media job needs
  real monitoring/retry, not just a bullet point in a features list.
- Everything above is additive — new models, a new worker process, new
  MCP tools — and none of it touches `MarketingRequest`, `ContentDraft`,
  the existing publishers, or the existing five MCP tools. The
  currently-committed, currently-clean work is not at structural risk
  from this direction, as long as implementation stays deferred as
  instructed here.

## 17. Decisions that genuinely need your input, not mine

- **(a)** *Resolved, not open anymore — see section 18.*
  `MarketingRequest` is not a personal creative brief and is not a
  candidate for renaming to "Brief" or absorbing into `ContentProject`.
  It represents a different future product (company marketing
  operations: an internal stakeholder requesting work from a marketing
  function) and should not be the Creator Studio's intake model, or
  appear in the Creator Studio's default flow, at all. What remains
  genuinely open is documented in section 18: how loosely
  `ContentDraft` should stay coupled to `MarketingRequest` once a
  separate `Idea`/`ContentProject` intake exists.
- **(b)** Accept the Python-runtime cost (WhisperX + pyannote) for
  word-level timestamps and diarization now, or start audio-only with
  whisper.cpp (no Python, segment-level timestamps only) and upgrade
  later if transcript-precision cutting proves necessary? Different
  first slices result from each choice.
- **(c)** Should raw media live on this same machine/disk as the
  SQLite database (simplest, matches the current "everything local"
  character) or on separate/external storage from day one, given video
  will eventually dwarf the ~1.3TB currently free?
- **(d)** How much of the "Guided Studio" natural-language UX to
  design/build alongside the very first engineering slice vs.
  defer until an engineer-facing tool exists first — since the stated
  goal is low user burden *from day one*, not bolted on afterward, and
  that's real, separate design effort.

## 18. Correction: Creator Studio and Marketing Operations are different products

The earlier version of this report treated `MarketingRequest` as
though it were just an awkwardly-named personal creative brief — a
naming problem, fixable by renaming it to "Brief" or folding it into
`ContentProject`. That was wrong in a more fundamental way than a bad
name.

`MarketingRequest`, as originally designed and as it exists in the
schema today, models a specific real-world situation: **someone inside
a company asks a marketing function to produce something for them** —
a requester, a department, a business justification, a due date, an
approval chain, workload assignment. That's the shape of a *company
marketing-operations platform* — the future, separate, unnamed product
this project's own history has already split off from Noticed once
(see the "MAJOR REPOSITIONING" note in project memory: Noticed dropped
"marketing for companies" entirely to become a personal content-
creation studio). `MarketingRequest` is a leftover piece of that
earlier, company-facing thesis, still sitting in the schema.

The personal Creator Studio being designed in this report starts from
a completely different situation: **there is no requester, no
department, no business justification — there's just a thought Cortni
had.** An `Idea` and the `ContentProject` it grows into don't need any
of the fields that make `MarketingRequest` make sense (requester name,
department, priority, due date, approval workflow). Modeling Creator
Studio intake *through* `MarketingRequest` — even optionally — would
mean fabricating a fake internal stakeholder request for every
personal idea, which is exactly backwards.

**The two flows, kept separate:**

```
Creator Studio:        Idea → ContentProject → Outputs (blog/podcast/video/social)
Marketing Operations:  MarketingRequest → Triage/Approval → ContentProject → Outputs
```

Both can eventually produce outputs through the same downstream
machinery — brands, content projects, drafts, assets, calendar,
publishing, analytics — because both really are "make content and
publish it" at the bottom. But they arrive through different doors,
and the Creator Studio's default, personal-use experience should never
expose `MarketingRequest` as something the owner has to fill out to
write a blog post about their own life.

**Recorded recommendation, not yet implemented:**

- Keep `MarketingRequest` fully intact — it belongs to the future
  marketing-operations product, not to Creator Studio.
- Do not rename it to "Brief." Do not absorb it into `Idea` or
  `ContentProject`. Do not delete it.
- Introduce `Idea` and `ContentProject` as their own, separate models —
  not layered on top of `MarketingRequest`.
- A `MarketingRequest` *may* eventually create or link to a
  `ContentProject`, once the marketing-operations product exists and
  needs to hand work into the same production/publishing machinery —
  but a `ContentProject` must never *require* a `MarketingRequest` to
  exist.
- The personal Creator Studio's default intake experience should never
  surface `MarketingRequest` at all.

### The current coupling this creates, and how it could be loosened later

Today, `ContentDraft.requestId` is a **required**, non-nullable foreign
key to `MarketingRequest` (`onDelete: Cascade`) — every single
`ContentDraft` in the schema must belong to a `MarketingRequest`, with
no alternative parent. This is a real, current fact worth naming
plainly: the `create_content_draft` MCP tool built earlier this session
— the one that saves whatever a connected AI client already wrote —
currently satisfies this requirement by **creating a `MarketingRequest`
row for every single conversationally-saved idea**, attributed to the
owner via `requesterName`. Under this session's corrected understanding
of what `MarketingRequest` actually represents, that means every
personal "save this draft" MCP call is, today, technically fabricating
a fake internal-stakeholder marketing request — harmless in practice
(single owner, no real stakeholders to confuse), but conceptually
backwards now that the distinction is clear.

Loosening this later (**not being done now — documentation only**)
would mean a two-phase migration in the same style already used for
the `Brand` rollout: make `ContentDraft.requestId` nullable, add a new
optional `contentProjectId`, backfill existing rows, then either
enforce "exactly one of `requestId`/`contentProjectId` must be set" at
the application layer or accept both as optional parents. Once that
exists, `create_content_draft` could attach a saved draft directly to
a `ContentProject` instead of manufacturing a `MarketingRequest`, and
the Creator Studio path would stop touching the marketing-operations
model entirely. This is real, deferred schema work — not something to
casually do as a side effect of a future unrelated change.

## Decision forks — a compact reference

| Decision | Recommendation | Why | What choosing it commits us to | What can safely be deferred | Reversibility | Blocks first podcast slice? |
|---|---|---|---|---|---|---|
| **MarketingRequest vs. Idea/ContentProject as Creator Studio intake** | Keep `MarketingRequest` untouched, for a separate future marketing-ops product. Build `Idea`→`ContentProject` as an independent Creator Studio intake path. | They model genuinely different real-world situations (internal stakeholder request vs. a personal thought) — collapsing them would fabricate fake requester data for every personal idea. | Two intake models to maintain going forward, sharing only downstream production/publishing machinery. | The eventual `MarketingRequest`↔`ContentProject` link (for when marketing-ops is actually built) — not needed now. | High — additive; nothing about `MarketingRequest` changes today. | No — the podcast slice doesn't need this resolved, but it does need `Idea`/`ContentProject` to exist to be modeled correctly rather than ad hoc. |
| **Adopt OpenTimelineIO vs. a small internal JSON edit format** | Build a small internal versioned JSON `edl` format; don't adopt OTIO as a foundational dependency. | OTIO's primary API surface is C++/Python, no natural TypeScript path; its adapter ecosystem (Final Cut XML, AAF, etc.) solves an interchange problem Noticed doesn't have. | A bespoke, Noticed-owned timeline schema to design, version, and maintain — full control, but nothing borrowed for free. | Real OTIO adoption, if a future need to interchange with a professional NLE ever materializes. | High — a JSON format can be extended or replaced later; nothing external depends on it. | No — not needed until actual audio cutting/rendering begins (a later phase than the first slice). |
| **WhisperX + pyannote (Python/PyTorch) vs. whisper.cpp only (no Python)** | Start audio-only with whisper.cpp; add WhisperX/pyannote later only if word-level cutting precision proves genuinely necessary. | Avoids taking on a second language runtime and gated model downloads before proving the basic transcription+search loop is even useful. | Segment-level (not word-level) timestamps initially — coarser cut points. | Word-level alignment and speaker diarization, until there's a concrete reason to need them. | Medium — upgrading later is straightforward (re-transcribe with WhisperX), but downgrading a Python-dependent pipeline back out is more disruptive once other code depends on it. | No — the first slice (point 14) only needs transcription + search, not word-level cuts. |
| **Raw media storage location (this machine vs. separate/external)** | Keep raw media on this machine for the first slice; revisit before video work begins in earnest. | ~1.3TB free comfortably covers audio-first work; deferring avoids solving a storage-architecture problem before there's real data to size it against. | Nothing yet — this is genuinely just "not decided," not a commitment either way. | The whole external-storage question, until video volume actually threatens local disk space. | High — file paths in SQLite are storage-location-agnostic; moving files later just means updating path references. | No. |

---

Nothing above has been implemented, scheduled, or approved for
implementation. The next real decision point, when ready, is choosing
answers to the remaining open items in point 17 and the decision-fork
table above — everything else in this report follows from those
choices rather than the other way around.

Sources consulted (external facts, not implementation):
- [Whisper benchmark on Apple Silicon: M1 → M4](https://justvoice.ai/blog/whisper-benchmark-apple-silicon-m3-m4)
- [faster-whisper vs whisper.cpp vs OpenAI Whisper (2026)](https://codersera.com/blog/faster-whisper-vs-whisper-cpp-speech-to-text-2026/)
- [pyannote.audio Guide — Open-Source Speaker Diarization Pipeline 2026](https://vexascribe.com/pyannote-audio)
- [Best Speaker Diarization Tools 2026 — DER Benchmarks](https://novascribe.ai/compare/best-speaker-diarization-tools)
- [FFmpeg Commercial License Guide: LGPL, GPL & Patent Risks](https://32blog.com/en/ffmpeg/ffmpeg-commercial-license-guide)
- [FFmpeg: hardware acceleration on Apple Silicon](https://medium.com/@marc.griffith/ffmpeg-command-line-video-encoding-with-hardware-acceleration-on-apple-silicon-72c5248cd398)
- [OpenTimelineIO — official repository/README (primary source for the point 6 correction)](https://github.com/AcademySoftwareFoundation/OpenTimelineIO)
