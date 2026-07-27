import type { RequestStatus, RequestPriority, DraftStatus } from "@/generated/prisma/client";

// Centralized so the workbench list and request detail page never drift —
// maps each status/priority onto the brand's functional colors (lime marks
// "new," coral/crimson are reserved for attention/critical, not decoration).
export function statusBadgeClass(status: RequestStatus): string {
  switch (status) {
    case "NEW":
      return "bg-[var(--lime)] text-[var(--midnight)]";
    case "IN_PROGRESS":
      return "bg-[var(--accent-soft)] text-[var(--accent)]";
    case "BLOCKED":
      return "bg-[var(--attention-soft)] text-[var(--attention)]";
    case "IN_APPROVAL":
      return "bg-[var(--info-soft)] text-[var(--info)]";
    case "COMPLETED":
      return "bg-[var(--success-soft)] text-[var(--success)]";
    case "REJECTED":
      return "bg-[var(--critical-soft)] text-[var(--critical)]";
  }
}

export function priorityBadgeClass(priority: RequestPriority): string {
  if (priority === "URGENT") {
    return "border border-[var(--attention)] text-[var(--attention)]";
  }
  return "border border-[var(--card-border)] text-[var(--slate)]";
}

export const ATTENTION_BADGE_CLASS = "bg-[var(--attention-soft)] text-[var(--attention)]";
export const CRITICAL_BADGE_CLASS = "bg-[var(--critical-soft)] text-[var(--critical)]";
export const NEUTRAL_BADGE_CLASS = "border border-[var(--card-border)] text-[var(--slate)]";

// APPROVED uses lime — "completed creative approvals" is one of the brand's
// explicit named lime moments, not just another success state.
export function draftStatusBadgeClass(status: DraftStatus): string {
  if (status === "APPROVED") return "bg-[var(--lime)] text-[var(--midnight)]";
  return "bg-[var(--accent-soft)] text-[var(--accent)]";
}
