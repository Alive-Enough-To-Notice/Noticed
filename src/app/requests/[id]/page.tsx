import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  CONTENT_CHANNEL_LABELS,
  isOverdue,
} from "@/lib/requests";
import {
  statusBadgeClass,
  priorityBadgeClass,
  draftStatusBadgeClass,
  CRITICAL_BADGE_CLASS,
  NEUTRAL_BADGE_CLASS,
} from "@/lib/badges";
import { CHANNEL_DESTINATIONS } from "@/lib/publishers";
import { DESTINATIONS } from "@/lib/destinations";
import {
  updateStatus,
  assignOwner,
  setMissingInfo,
  addNote,
  generateContent,
  approveDraft,
  publishDraft,
} from "./actions";

const DESTINATION_LABELS = Object.fromEntries(
  DESTINATIONS.map((d) => [d.key, d.label]),
);

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const request = await prisma.marketingRequest.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      drafts: {
        orderBy: { createdAt: "asc" },
        include: {
          publishAttempts: { orderBy: { createdAt: "desc" } },
          knowledgeLinks: { include: { knowledgeRecord: true } },
        },
      },
    },
  });

  if (!request) notFound();

  const updateStatusWithId = updateStatus.bind(null, request.id);
  const assignOwnerWithId = assignOwner.bind(null, request.id);
  const setMissingInfoWithId = setMissingInfo.bind(null, request.id);
  const addNoteWithId = addNote.bind(null, request.id);
  const generateContentWithId = generateContent.bind(null, request.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--slate)]">
            {REQUEST_TYPE_LABELS[request.type]} · {request.requesterName}
            {request.department ? ` · ${request.department}` : ""}
          </p>
          <h1 className="text-xl font-semibold">{request.title}</h1>
          {request.description && (
            <p className="mt-1 max-w-xl text-sm text-[var(--slate)]">
              {request.description}
            </p>
          )}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(request.status)}`}
        >
          {REQUEST_STATUS_LABELS[request.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 ${priorityBadgeClass(request.priority)}`}>
          {REQUEST_PRIORITY_LABELS[request.priority]} priority
        </span>
        {request.dueDate && (
          <span
            className={`rounded px-2 py-0.5 ${
              isOverdue(request) ? CRITICAL_BADGE_CLASS : NEUTRAL_BADGE_CLASS
            }`}
          >
            Due{" "}
            {request.dueDate.toLocaleDateString(undefined, {
              timeZone: "UTC",
            })}
          </span>
        )}
        {request.owner && (
          <span className={`rounded px-2 py-0.5 ${NEUTRAL_BADGE_CLASS}`}>
            Owner: {request.owner}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="flex flex-col gap-2 rounded-lg border border-[var(--card-border)] bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
            Status
          </h2>
          <form action={updateStatusWithId} className="flex gap-2">
            <select
              key={request.status}
              name="status"
              defaultValue={request.status}
              className="flex-1 rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
            >
              {REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {REQUEST_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Save
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-[var(--card-border)] bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
            Owner
          </h2>
          <form action={assignOwnerWithId} className="flex gap-2">
            <input
              key={request.owner}
              name="owner"
              defaultValue={request.owner ?? ""}
              placeholder="Assign to..."
              className="flex-1 rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Save
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-[var(--card-border)] bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
            Missing info
          </h2>
          <form action={setMissingInfoWithId} className="flex gap-2">
            <input
              key={request.missingInfo}
              name="missingInfo"
              defaultValue={request.missingInfo ?? ""}
              placeholder="What's blocking this?"
              className="flex-1 rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Save
            </button>
          </form>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate)]">
            Content drafts
          </h2>
          <form action={generateContentWithId}>
            <button
              type="submit"
              className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              {request.drafts.length === 0 ? "Generate content" : "Regenerate drafts"}
            </button>
          </form>
        </div>

        {request.drafts.length === 0 ? (
          <p className="text-sm text-[var(--slate)]">
            No drafts yet — generate a blog post and channel-adapted social
            posts from this request&apos;s brief. Requires the owner&apos;s
            own Anthropic API key in <code>.env</code>.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {request.drafts.map((draft) => {
              const approveDraftWithIds = approveDraft.bind(
                null,
                request.id,
                draft.id,
              );
              const publishDraftWithIds = publishDraft.bind(
                null,
                request.id,
                draft.id,
              );
              const destinationKeys = CHANNEL_DESTINATIONS[draft.channel] ?? [];
              return (
                <div
                  key={draft.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--card-border)] bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {CONTENT_CHANNEL_LABELS[draft.channel]}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${draftStatusBadgeClass(draft.status)}`}
                    >
                      {draft.status === "APPROVED" ? "Approved" : "Draft"}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                    {draft.body}
                  </p>

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
                    <p className="text-xs text-[var(--slate)]">
                      Approved by {draft.approvedBy}
                    </p>
                  ) : (
                    <form
                      action={approveDraftWithIds}
                      className="flex flex-col gap-2"
                    >
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
                    <form action={publishDraftWithIds} className="flex gap-2 border-t border-[var(--card-border)] pt-2">
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
                          {attempt.success
                            ? attempt.url ?? "published"
                            : attempt.error}
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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate)]">
          Activity
        </h2>

        <form
          action={addNoteWithId}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--card-border)] bg-white p-3"
        >
          <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-xs">
            <span>Add a note</span>
            <input
              name="message"
              required
              className="rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Add
          </button>
        </form>

        <div className="flex flex-col gap-2">
          {request.activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-baseline justify-between rounded-lg border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            >
              <span>{activity.message}</span>
              <span className="text-xs text-[var(--slate)]">
                {activity.createdAt.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
