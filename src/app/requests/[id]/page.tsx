import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  isOverdue,
} from "@/lib/requests";
import {
  statusBadgeClass,
  priorityBadgeClass,
  CRITICAL_BADGE_CLASS,
  NEUTRAL_BADGE_CLASS,
} from "@/lib/badges";
import { updateStatus, assignOwner, setMissingInfo, addNote } from "./actions";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const request = await prisma.marketingRequest.findUnique({
    where: { id },
    include: { activities: { orderBy: { createdAt: "desc" } } },
  });

  if (!request) notFound();

  const updateStatusWithId = updateStatus.bind(null, request.id);
  const assignOwnerWithId = assignOwner.bind(null, request.id);
  const setMissingInfoWithId = setMissingInfo.bind(null, request.id);
  const addNoteWithId = addNote.bind(null, request.id);

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
