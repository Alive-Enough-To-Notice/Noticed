import { createRequest } from "../actions";
import {
  REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  REQUEST_PRIORITIES,
  REQUEST_PRIORITY_LABELS,
} from "@/lib/requests";

export default function NewRequestPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Submit a marketing request</h1>
        <p className="text-sm text-[var(--slate)]">
          This is the link (or QR code) that goes out to anyone who needs
          something from Marketing. It lands on the workbench, and Marketing
          assigns who picks it up. One shared form for now — per-type
          question sets aren&apos;t built yet.
        </p>
      </div>

      <form
        action={createRequest}
        className="flex flex-col gap-4 rounded-lg border border-[var(--card-border)] bg-white p-6"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Request type</span>
          <select
            name="type"
            required
            defaultValue=""
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose one
            </option>
            {REQUEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {REQUEST_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input
            name="title"
            required
            placeholder="Spring open-house campaign"
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Description (optional)</span>
          <textarea
            name="description"
            rows={4}
            placeholder="What's the business need behind this? What should come out the other end?"
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Your name</span>
            <input
              name="requesterName"
              required
              className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Department (optional)</span>
            <input
              name="department"
              placeholder="Sales"
              className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Priority</span>
            <select
              name="priority"
              defaultValue="NORMAL"
              className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
            >
              {REQUEST_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {REQUEST_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Needed by (optional)</span>
            <input
              name="dueDate"
              type="date"
              className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-2 self-start rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          Submit request
        </button>
      </form>
    </div>
  );
}
