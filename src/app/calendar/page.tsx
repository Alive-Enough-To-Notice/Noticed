import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  buildMonthGrid,
  dateKey,
  MONTH_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/calendar";
import { CONTENT_CHANNEL_LABELS } from "@/lib/requests";
import { draftStatusBadgeClass } from "@/lib/badges";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getUTCFullYear();
  const month = params.month ? parseInt(params.month, 10) - 1 : now.getUTCMonth();

  const grid = buildMonthGrid(year, month);
  const gridStart = grid[0].date;
  const gridEnd = new Date(grid[41].date);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + 1);

  // ContentDraft's only parent is its ContentProject now. To keep linking
  // to the request page for Marketing-Operations-originated drafts (the
  // only case that page can render), also pull whichever MarketingRequest
  // (if any) that project happens to be linked to — a Creator Studio draft
  // with no linked request just won't have a click-through target yet.
  const draftInclude = {
    contentProject: {
      include: {
        marketingRequests: { take: 1 as const, select: { marketingRequestId: true } },
      },
    },
  };

  const [scheduled, unscheduled] = await Promise.all([
    prisma.contentDraft.findMany({
      where: { scheduledFor: { gte: gridStart, lt: gridEnd } },
      include: draftInclude,
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.contentDraft.findMany({
      where: { scheduledFor: null, status: { not: "APPROVED" } },
      include: draftInclude,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  function linkedRequestId(draft: (typeof scheduled)[number]) {
    return draft.contentProject.marketingRequests[0]?.marketingRequestId ?? null;
  }

  const byDay = new Map<string, typeof scheduled>();
  for (const draft of scheduled) {
    const key = dateKey(draft.scheduledFor as Date);
    const list = byDay.get(key) ?? [];
    list.push(draft);
    byDay.set(key, list);
  }

  const prevMonth = month === 0 ? { year: year - 1, month: 12 } : { year, month };
  const nextMonth = month === 11 ? { year: year + 1, month: 1 } : { year, month: month + 2 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {MONTH_LABELS[month]} {year}
          </h1>
          <p className="text-sm text-[var(--slate)]">
            Everything scheduled, so nothing depends on remembering it.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/calendar?year=${prevMonth.year}&month=${prevMonth.month}`}
            className="rounded border border-[var(--card-border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
          >
            ← Prev
          </Link>
          <Link
            href={`/calendar?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`}
            className="rounded border border-[var(--card-border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
          >
            Today
          </Link>
          <Link
            href={`/calendar?year=${nextMonth.year}&month=${nextMonth.month}`}
            className="rounded border border-[var(--card-border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--card-border)]">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-[var(--blue-frost)] px-2 py-1.5 text-center text-xs font-semibold text-[var(--slate)]"
          >
            {label}
          </div>
        ))}
        {grid.map((day) => {
          const key = dateKey(day.date);
          const items = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[6rem] bg-white p-1.5 ${
                day.isCurrentMonth ? "" : "bg-[var(--cold-white)] text-[var(--slate)]"
              }`}
            >
              <span
                className={`text-xs ${
                  day.isToday
                    ? "rounded-full bg-[var(--lime)] px-1.5 py-0.5 font-semibold text-[var(--midnight)]"
                    : "text-[var(--slate)]"
                }`}
              >
                {day.date.getUTCDate()}
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {items.slice(0, 3).map((item) => {
                  const title = item.title ?? item.contentProject.title;
                  const requestId = linkedRequestId(item);
                  const className = `truncate rounded px-1 py-0.5 text-[10px] font-medium ${draftStatusBadgeClass(item.status)}`;
                  return requestId ? (
                    <Link key={item.id} href={`/requests/${requestId}`} className={className} title={title}>
                      {CONTENT_CHANNEL_LABELS[item.channel]}: {title}
                    </Link>
                  ) : (
                    <span key={item.id} className={className} title={title}>
                      {CONTENT_CHANNEL_LABELS[item.channel]}: {title}
                    </span>
                  );
                })}
                {items.length > 3 && (
                  <span className="text-[10px] text-[var(--slate)]">
                    +{items.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {unscheduled.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--attention)]">
            Not scheduled yet ({unscheduled.length})
          </h2>
          <div className="flex flex-col gap-2">
            {unscheduled.map((draft) => {
              const title = draft.title ?? draft.contentProject.title;
              const requestId = linkedRequestId(draft);
              const className =
                "flex items-center justify-between rounded-lg border border-[var(--attention)] bg-[var(--attention-soft)] px-3 py-2 text-sm";
              const content = (
                <>
                  <span>
                    {CONTENT_CHANNEL_LABELS[draft.channel]}: {title}
                  </span>
                  <span className="text-xs text-[var(--attention)]">Needs a date</span>
                </>
              );
              return requestId ? (
                <Link key={draft.id} href={`/requests/${requestId}`} className={className}>
                  {content}
                </Link>
              ) : (
                <div key={draft.id} className={className}>
                  {content}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
