import type {
  RequestType,
  RequestPriority,
  RequestStatus,
  ContentChannel,
  MarketingRequest,
} from "@/generated/prisma/client";

export const CONTENT_CHANNEL_LABELS: Record<ContentChannel, string> = {
  BLOG: "Blog",
  LINKEDIN: "LinkedIn",
  X: "X",
};

export const REQUEST_TYPES: RequestType[] = [
  "CAMPAIGN",
  "WEBSITE_CHANGE",
  "BLOG_OR_SOCIAL_CONTENT",
  "CUSTOMER_EMAIL",
  "ADVERTISEMENT",
  "LOGO_OR_CREATIVE_ASSET",
  "PRINT_COLLATERAL",
  "RECRUITING_SUPPORT",
  "JOB_FAIR_OR_EVENT",
  "PROMOTIONAL_PRODUCT",
  "PHOTO_OR_VIDEO",
  "SPONSORSHIP",
];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  CAMPAIGN: "Campaign",
  WEBSITE_CHANGE: "Website change",
  BLOG_OR_SOCIAL_CONTENT: "Blog or social content",
  CUSTOMER_EMAIL: "Customer email",
  ADVERTISEMENT: "Advertisement",
  LOGO_OR_CREATIVE_ASSET: "Logo or creative asset",
  PRINT_COLLATERAL: "Print collateral",
  RECRUITING_SUPPORT: "Recruiting support",
  JOB_FAIR_OR_EVENT: "Job fair or event",
  PROMOTIONAL_PRODUCT: "Promotional product",
  PHOTO_OR_VIDEO: "Photo or video",
  SPONSORSHIP: "Sponsorship",
};

export const REQUEST_PRIORITIES: RequestPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

const PRIORITY_WEIGHT: Record<RequestPriority, number> = {
  URGENT: 3,
  HIGH: 2,
  NORMAL: 1,
  LOW: 0,
};

export const REQUEST_STATUSES: RequestStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_APPROVAL",
  "COMPLETED",
  "REJECTED",
];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  IN_APPROVAL: "In approval",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

export const TERMINAL_STATUSES: RequestStatus[] = ["COMPLETED", "REJECTED"];

export function isTerminalStatus(status: RequestStatus) {
  return TERMINAL_STATUSES.includes(status);
}

const AGING_THRESHOLD_DAYS = 7;

export function isAging(request: Pick<MarketingRequest, "status" | "createdAt">) {
  if (isTerminalStatus(request.status)) return false;
  const ageMs = Date.now() - request.createdAt.getTime();
  return ageMs > AGING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}

export function isOverdue(
  request: Pick<MarketingRequest, "status" | "dueDate">,
) {
  if (isTerminalStatus(request.status) || !request.dueDate) return false;
  return request.dueDate.getTime() < Date.now();
}

export function needsInfo(request: Pick<MarketingRequest, "status" | "missingInfo">) {
  return !isTerminalStatus(request.status) && !!request.missingInfo?.trim();
}

// Workbench sort: active work first (urgent/overdue/blocked surfaced early),
// terminal requests sink to the bottom — same "completed sinks" convention
// used across this product family.
export function workbenchSort(
  a: Pick<MarketingRequest, "status" | "priority" | "dueDate" | "createdAt">,
  b: Pick<MarketingRequest, "status" | "priority" | "dueDate" | "createdAt">,
) {
  const aTerminal = isTerminalStatus(a.status);
  const bTerminal = isTerminalStatus(b.status);
  if (aTerminal !== bTerminal) return aTerminal ? 1 : -1;

  const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (priorityDiff !== 0) return priorityDiff;

  if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;

  return b.createdAt.getTime() - a.createdAt.getTime();
}
