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
import {
  updateStatus,
  assignOwner,
  setMissingInfo,
  addNote,
  generateContent,
  approveDraft,
} from "./actions";

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
      drafts: { orderBy: { createdAt: "asc" } },
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
                  {draft.status === "APPROVED" ? (
                    <p className="text-xs text-[var(--slate)]">
                      Approved by {draft.approvedBy}
                    </p>
                  ) : (
                    <form
                      action={approveDraftWithIds}
                      className="flex gap-2"
                    >
                      <input
                        name="approvedBy"
                        placeholder="Your name"
                        required
                        className="flex-1 rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded bg-[var(--lime)] px-3 py-1.5 text-sm font-medium text-[var(--midnight)] hover:bg-[var(--lime-dark)] hover:text-white"
                      >
                        Approve
                      </button>
                    </form>
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
