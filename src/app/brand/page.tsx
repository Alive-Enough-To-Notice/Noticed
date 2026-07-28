import { prisma } from "@/lib/prisma";
import {
  KNOWLEDGE_TYPES,
  KNOWLEDGE_TYPE_LABELS,
  KNOWLEDGE_STATUS_LABELS,
} from "@/lib/knowledge";
import { knowledgeStatusBadgeClass } from "@/lib/badges";
import { createKnowledgeRecord, setKnowledgeStatus } from "./actions";
import type { KnowledgeStatus } from "@/generated/prisma/client";

const STATUS_SORT: KnowledgeStatus[] = ["PROPOSED", "APPROVED", "DEPRECATED"];

export default async function BrandPage() {
  const records = await prisma.knowledgeRecord.findMany({
    orderBy: { createdAt: "desc" },
  });
  const sorted = [...records].sort(
    (a, b) => STATUS_SORT.indexOf(a.status) - STATUS_SORT.indexOf(b.status),
  );
  const proposedCount = records.filter((r) => r.status === "PROPOSED").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Organizational knowledge</h1>
        <p className="max-w-2xl text-sm text-[var(--slate)]">
          The shared source of truth every generation call draws from —
          company facts, audiences, voice, and explicitly approved or
          prohibited claims. Only APPROVED records reach a generation
          prompt. Nothing here becomes approved truth just because it was
          typed or uploaded — a status change is a deliberate action.
        </p>
      </div>

      <form
        action={createKnowledgeRecord}
        className="flex flex-col gap-4 rounded-lg border border-[var(--card-border)] bg-white p-6"
      >
        <p className="text-sm font-medium">Add a record</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Type</span>
            <select
              name="type"
              required
              defaultValue=""
              className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Choose one
              </option>
              {KNOWLEDGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {KNOWLEDGE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Status</span>
            <select
              name="status"
              defaultValue="PROPOSED"
              className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
            >
              <option value="PROPOSED">Proposed</option>
              <option value="APPROVED">Approved</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input
            name="title"
            required
            placeholder="e.g. Never claim litigation-ready"
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Content</span>
          <textarea
            name="content"
            rows={3}
            required
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Source (optional)</span>
          <input
            name="source"
            placeholder="Where this came from — a person, a doc, a decision"
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          className="mt-2 self-start rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          Add record
        </button>
      </form>

      {proposedCount > 0 && (
        <p className="text-sm text-[var(--attention)]">
          {proposedCount} proposed record{proposedCount === 1 ? "" : "s"}{" "}
          waiting for a status decision — proposed records never reach a
          generation prompt.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {sorted.map((record) => {
          const setStatusWithId = setKnowledgeStatus.bind(null, record.id);
          return (
            <div
              key={record.id}
              className="rounded-lg border border-[var(--card-border)] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--slate)]">
                    {KNOWLEDGE_TYPE_LABELS[record.type]}
                    {record.source ? ` · ${record.source}` : ""}
                  </p>
                  <h2 className="font-medium">{record.title}</h2>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${knowledgeStatusBadgeClass(record.status)}`}
                >
                  {KNOWLEDGE_STATUS_LABELS[record.status]}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink)]">
                {record.content}
              </p>
              <form action={setStatusWithId} className="mt-3 flex gap-2">
                <select
                  key={record.status}
                  name="status"
                  defaultValue={record.status}
                  className="rounded border border-[var(--card-border)] px-2 py-1.5 text-sm"
                >
                  <option value="PROPOSED">Proposed</option>
                  <option value="APPROVED">Approved</option>
                  <option value="DEPRECATED">Deprecated</option>
                </select>
                <button
                  type="submit"
                  className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
                >
                  Save
                </button>
              </form>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-sm text-[var(--slate)]">
            No knowledge records yet — add the first one above.
          </p>
        )}
      </div>
    </div>
  );
}
