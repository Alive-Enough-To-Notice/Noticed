import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CONTENT_CHANNEL_LABELS } from "@/lib/requests";
import { NEUTRAL_BADGE_CLASS, draftStatusBadgeClass } from "@/lib/badges";
import { CHANNEL_DESTINATIONS } from "@/lib/publishers";
import { DESTINATIONS } from "@/lib/destinations";
import {
  createProjectDraftAction,
  editDraftBodyAction,
  setDraftScheduleAction,
  approveDraftAction,
  publishDraftAction,
} from "../../actions";

const DESTINATION_LABELS = Object.fromEntries(DESTINATIONS.map((d) => [d.key, d.label]));

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.contentProject.findUnique({
    where: { id },
    include: {
      brand: true,
      ideas: { include: { idea: true } },
      drafts: {
        orderBy: { createdAt: "asc" },
        include: {
          publishAttempts: { orderBy: { createdAt: "desc" } },
          knowledgeLinks: { include: { knowledgeRecord: true } },
        },
      },
    },
  });

  if (!project) notFound();

  const createDraftWithId = createProjectDraftAction.bind(null, project.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/studio" className="text-xs text-[var(--slate)] underline">
          ← Creator Studio
        </Link>
        <div className="mt-1 flex items-start justify-between">
          <div>
            <p className="text-sm text-[var(--slate)]">{project.brand.name}</p>
            <h1 className="text-xl font-semibold">{project.title}</h1>
            {project.premise && (
              <p className="mt-1 max-w-xl text-sm text-[var(--slate)]">{project.premise}</p>
            )}
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${NEUTRAL_BADGE_CLASS}`}>
            {project.status}
          </span>
        </div>
      </div>

      {project.ideas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate)]">
            Related ideas
          </h2>
          <div className="flex flex-col gap-2">
            {project.ideas.map((link) => (
              <p
                key={link.id}
                className="rounded-lg border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
              >
                {link.idea.content}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate)]">
            Content drafts
          </h2>
          <form action={createDraftWithId} className="flex gap-2">
            <select
              name="channel"
              required
              defaultValue=""
              className="rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
            >
              <option value="" disabled>
                Channel...
              </option>
              <option value="BLOG">Blog</option>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="X">X</option>
            </select>
            <button
              type="submit"
              className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Start blank draft
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--blue-frost)] p-3 text-sm text-[var(--slate)]">
          Draft this with whichever AI you&apos;re already talking to (ChatGPT,
          Claude, ...) using Noticed&apos;s MCP tools — save to this project
          and it&apos;ll show up here. Or start a blank draft above and write
          it directly.
        </div>

        {project.drafts.length === 0 ? (
          <p className="text-sm text-[var(--slate)]">No drafts yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {project.drafts.map((draft) => {
              const editBodyWithIds = editDraftBodyAction.bind(null, project.id, draft.id);
              const scheduleWithIds = setDraftScheduleAction.bind(null, project.id, draft.id);
              const approveWithIds = approveDraftAction.bind(null, project.id, draft.id);
              const publishWithIds = publishDraftAction.bind(null, project.id, draft.id);
              const destinationKeys = CHANNEL_DESTINATIONS[draft.channel] ?? [];

              return (
                <div
                  key={draft.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--card-border)] bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {CONTENT_CHANNEL_LABELS[draft.channel]}
                      {draft.title && draft.title !== project.title ? ` — ${draft.title}` : ""}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${draftStatusBadgeClass(draft.status)}`}
                    >
                      {draft.status === "APPROVED" ? "Approved" : "Draft"}
                    </span>
                  </div>

                  {draft.status === "APPROVED" ? (
                    <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">{draft.body}</p>
                  ) : (
                    <form action={editBodyWithIds} className="flex flex-col gap-1">
                      <textarea
                        key={draft.body}
                        name="body"
                        defaultValue={draft.body}
                        rows={6}
                        placeholder="Paste content from a connected AI client, or write it here directly..."
                        className="whitespace-pre-wrap rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
                      />
                      <button
                        type="submit"
                        className="self-start rounded border border-[var(--card-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--blue-frost)]"
                      >
                        Save text
                      </button>
                    </form>
                  )}

                  <form action={scheduleWithIds} className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--slate)]">Scheduled:</span>
                    <input
                      key={draft.scheduledFor?.toISOString()}
                      type="date"
                      name="scheduledFor"
                      defaultValue={draft.scheduledFor?.toISOString().slice(0, 10) ?? ""}
                      className="rounded border border-[var(--card-border)] px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
                    >
                      Save
                    </button>
                  </form>

                  {draft.knowledgeLinks.length > 0 && (
                    <p className="text-xs text-[var(--slate)]">
                      Informed by: {draft.knowledgeLinks.map((l) => l.knowledgeRecord.title).join(", ")}
                    </p>
                  )}

                  {draft.complianceFlag && (() => {
                    let violations: Array<{ channel: string; rule: string; quote: string }> = [];
                    try {
                      violations = JSON.parse(draft.complianceFlag);
                    } catch {
                      violations = [];
                    }
                    return (
                      <div className="rounded border border-[var(--attention)] bg-[var(--attention-soft)] p-2 text-xs text-[var(--attention)]">
                        <p className="font-semibold">Compliance check flagged this draft:</p>
                        {violations.length > 0 ? (
                          <ul className="mt-1 list-disc pl-4">
                            {violations.map((v, i) => (
                              <li key={i}>
                                {v.rule}: &quot;{v.quote}&quot; ({v.channel})
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>Details unavailable — treat as unverified.</p>
                        )}
                      </div>
                    );
                  })()}

                  {draft.status === "APPROVED" ? (
                    <p className="text-xs text-[var(--slate)]">Approved by {draft.approvedBy}</p>
                  ) : (
                    <form action={approveWithIds} className="flex flex-col gap-2">
                      <input
                        name="approvedBy"
                        placeholder="Your name"
                        required
                        className="rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
                      />
                      {draft.complianceFlag && (
                        <input
                          name="overrideReason"
                          placeholder="Required: why are you approving despite the flag?"
                          required
                          className="rounded border border-[var(--attention)] px-2 py-1.5 text-sm"
                        />
                      )}
                      <button
                        type="submit"
                        className="self-start rounded bg-[var(--lime)] px-3 py-1.5 text-sm font-medium text-[var(--midnight)] hover:bg-[var(--lime-dark)] hover:text-white"
                      >
                        {draft.complianceFlag ? "Approve anyway" : "Approve"}
                      </button>
                    </form>
                  )}

                  {draft.status === "APPROVED" && destinationKeys.length > 0 && (
                    <form action={publishWithIds} className="flex gap-2 border-t border-[var(--card-border)] pt-2">
                      <select
                        name="destination"
                        required
                        className="flex-1 rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
                      >
                        {destinationKeys.map((key) => (
                          <option key={key} value={key}>
                            {DESTINATION_LABELS[key] ?? key}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
                      >
                        Publish
                      </button>
                    </form>
                  )}

                  {draft.publishAttempts.length > 0 && (
                    <div className="flex flex-col gap-1 border-t border-[var(--card-border)] pt-2">
                      {draft.publishAttempts.map((attempt) => (
                        <div
                          key={attempt.id}
                          className={`rounded px-2 py-1 text-xs ${
                            attempt.success
                              ? "bg-[var(--success-soft)] text-[var(--success)]"
                              : "bg-[var(--critical-soft)] text-[var(--critical)]"
                          }`}
                        >
                          {DESTINATION_LABELS[attempt.destination] ?? attempt.destination}:{" "}
                          {attempt.success ? attempt.url ?? "published" : attempt.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
