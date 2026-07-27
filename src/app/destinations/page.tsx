import {
  DESTINATIONS,
  CAPABILITY_LABELS,
  type PublishCapability,
} from "@/lib/destinations";
import { capabilityBadgeClass } from "@/lib/badges";

const ORDER: PublishCapability[] = ["DIRECT", "CONFIRM", "EXPORT", "UNAVAILABLE"];

export default function DestinationsPage() {
  const sorted = [...DESTINATIONS].sort(
    (a, b) => ORDER.indexOf(a.capability) - ORDER.indexOf(b.capability),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Destinations</h1>
        <p className="max-w-2xl text-sm text-[var(--slate)]">
          What each channel can actually do today, not what a logo implies.
          Capability reflects each platform&apos;s real API/access policy as
          of mid-2026 — never treat a channel as more supported than what&apos;s
          listed here.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map((destination) => (
          <div
            key={destination.key}
            className="rounded-lg border border-[var(--card-border)] bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{destination.label}</h2>
              <div className="flex items-center gap-2">
                {destination.built && (
                  <span className="rounded-full bg-[var(--lime)] px-2.5 py-1 text-xs font-medium text-[var(--midnight)]">
                    Built
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${capabilityBadgeClass(destination.capability)}`}
                >
                  {CAPABILITY_LABELS[destination.capability]}
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-[var(--slate)]">{destination.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
