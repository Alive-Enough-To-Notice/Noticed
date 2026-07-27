import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  isAging,
  isOverdue,
  needsInfo,
  workbenchSort,
} from "@/lib/requests";

export default async function WorkbenchPage() {
  const requests = await prisma.marketingRequest.findMany();
  const sorted = [...requests].sort(workbenchSort);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Workbench</h1>
          <p className="text-sm text-zinc-500">
            Every open request, what it needs, and what&apos;s aging.
          </p>
        </div>
        <Link
          href="/requests/new"
          className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          New request
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-white p-8 text-center text-sm text-zinc-500">
          No requests yet.{" "}
          <Link href="/requests/new" className="font-medium underline">
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
                  <h2 className="font-medium">{request.title}</h2>
                  <p className="text-sm text-zinc-500">
                    {REQUEST_TYPE_LABELS[request.type]} · {request.requesterName}
                    {request.department ? ` · ${request.department}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
                  {REQUEST_STATUS_LABELS[request.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded border border-[var(--card-border)] px-2 py-0.5 text-zinc-500">
                  {REQUEST_PRIORITY_LABELS[request.priority]} priority
                </span>
                {request.dueDate && (
                  <span
                    className={`rounded border px-2 py-0.5 ${
                      isOverdue(request)
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-[var(--card-border)] text-zinc-500"
                    }`}
                  >
                    Due {request.dueDate.toLocaleDateString(undefined, { timeZone: "UTC" })}
                  </span>
                )}
                {needsInfo(request) && (
                  <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                    Missing info
                  </span>
                )}
                {isAging(request) && (
                  <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">
                    Aging
                  </span>
                )}
                {request.owner && (
                  <span className="rounded border border-[var(--card-border)] px-2 py-0.5 text-zinc-500">
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
