import { bulkImport } from "./actions";
import { listBrands } from "@/lib/brands";

export default async function BulkUploadPage() {
  const brands = await listBrands();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Bulk upload</h1>
        <p className="max-w-2xl text-sm text-[var(--slate)]">
          Upload a whole content plan at once — hundreds of posts, scheduled
          across months — instead of having to remember to come back and add
          them one at a time. Every row becomes its own draft on the
          calendar.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--blue-frost)] p-4 text-sm">
        <p className="font-medium">CSV format</p>
        <p className="mt-1 text-[var(--slate)]">
          Four columns, header row optional:{" "}
          <code className="rounded bg-white px-1 py-0.5">
            date,channel,title,body
          </code>
        </p>
        <ul className="mt-2 list-disc pl-5 text-[var(--slate)]">
          <li>
            <code>date</code> — optional, e.g. 2026-08-15. Leave blank and
            it&apos;ll show up under &quot;Not scheduled yet&quot; on the
            calendar.
          </li>
          <li>
            <code>channel</code> — one of <code>BLOG</code>,{" "}
            <code>LINKEDIN</code>, or <code>X</code>.
          </li>
          <li>
            <code>title</code> — optional for LINKEDIN/X; used as the blog
            title for BLOG rows.
          </li>
          <li>
            <code>body</code> — the actual post content. Required.
          </li>
        </ul>
        <p className="mt-2 text-[var(--slate)]">
          Bad rows are skipped and counted, not fatal — a handful of typos
          won&apos;t block the other 599 posts.
        </p>
      </div>

      <form
        action={bulkImport}
        className="flex flex-col gap-4 rounded-lg border border-[var(--card-border)] bg-white p-6"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Brand</span>
          <select
            name="brandKey"
            required
            defaultValue={brands.find((b) => b.isDefault)?.key ?? ""}
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          >
            {brands.map((b) => (
              <option key={b.key} value={b.key}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Your name</span>
          <input
            name="requesterName"
            required
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">CSV file</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            ...or paste CSV text directly
          </span>
          <textarea
            name="csvText"
            rows={8}
            placeholder="date,channel,title,body&#10;2026-08-01,X,,First post text here&#10;2026-08-03,BLOG,My blog title,Full blog body here"
            className="rounded border border-[var(--card-border)] px-3 py-2 font-mono text-xs"
          />
        </label>

        <button
          type="submit"
          className="mt-2 self-start rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          Import
        </button>
      </form>
    </div>
  );
}
