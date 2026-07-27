import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  isAging,
  isOverdue,
  needsInfo,
  isTerminalStatus,
  workbenchSort,
} from "@/lib/requests";
import {
  statusBadgeClass,
  priorityBadgeClass,
  ATTENTION_BADGE_CLASS,
  CRITICAL_BADGE_CLASS,
  NEUTRAL_BADGE_CLASS,
} from "@/lib/badges";

export default async function WorkbenchPage() {
  const requests = await prisma.marketingRequest.findMany();
  const sorted = [...requests].sort(workbenchSort);
  const openCount = requests.filter((r) => !isTerminalStatus(r.status)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold">Workbench</h1>
            <p className="text-sm text-[var(--slate)]">
              Every open request, what it needs, and what&apos;s aging.
            </p>
          </div>
          {openCount > 0 && (
            <span className="rounded-full bg-[var(--lime)] px-2.5 py-1 text-xs font-semibold text-[var(--midnight)]">
              {openCount} open
            </span>
          )}
        </div>
        <Link
          href="/requests/new"
          className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          New request
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-white p-8 text-center text-sm text-[var(--slate)]">
          No requests yet.{" "}
          <Link href="/requests/new" className="font-medium text-[var(--accent)] underline">
            Submit the first one
          </Link>
          .
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((request) => (
            <Link
              key={request.id}
              href={`/requests/${request.id}`}
              className="rounded-lg border border-[var(--card-border)] bg-white p-4 transition hover:border-[var(--accent)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-[var(--ink)]">{request.title}</h2>
                  <p className="text-sm text-[var(--slate)]">
                    {REQUEST_TYPE_LABELS[request.type]} · {request.requesterName}
                    {request.department ? ` · ${request.department}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(request.status)}`}
                >
                  {REQUEST_STATUS_LABELS[request.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 ${priorityBadgeClass(request.priority)}`}>
                  {REQUEST_PRIORITY_LABELS[request.priority]} priority
                </span>
                {request.dueDate && (
                  <span
                    className={`rounded px-2 py-0.5 ${
                      isOverdue(request) ? CRITICAL_BADGE_CLASS : NEUTRAL_BADGE_CLASS
                    }`}
                  >
                    Due {request.dueDate.toLocaleDateString(undefined, { timeZone: "UTC" })}
                  </span>
                )}
                {needsInfo(request) && (
                  <span className={`rounded px-2 py-0.5 ${ATTENTION_BADGE_CLASS}`}>
                    Missing info
                  </span>
                )}
                {isAging(request) && (
                  <span className={`rounded px-2 py-0.5 ${ATTENTION_BADGE_CLASS}`}>
                    Aging
                  </span>
                )}
                {request.owner && (
                  <span className={`rounded px-2 py-0.5 ${NEUTRAL_BADGE_CLASS}`}>
                    Owner: {request.owner}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
