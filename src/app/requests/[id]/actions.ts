"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { REQUEST_STATUS_LABELS } from "@/lib/requests";
import { PROHIBITIVE_TYPES } from "@/lib/knowledge";
import { generateContentPackage, checkCompliance } from "@/lib/content-generator";
import { publish, type PublishableDestinationKey } from "@/lib/publishers";
import type { RequestStatus } from "@/generated/prisma/client";

export async function updateStatus(requestId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "") as RequestStatus;
  if (!status) throw new Error("Status is required");

  const current = await prisma.marketingRequest.findUniqueOrThrow({
    where: { id: requestId },
  });

  if (current.status !== status) {
    await prisma.marketingRequest.update({
      where: { id: requestId },
      data: {
        status,
        activities: {
          create: {
            type: "STATUS_CHANGE",
            message: `Moved from ${REQUEST_STATUS_LABELS[current.status]} to ${REQUEST_STATUS_LABELS[status]}`,
          },
        },
      },
    });
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/");
}

export async function assignOwner(requestId: string, formData: FormData) {
  const owner = String(formData.get("owner") ?? "").trim();
  if (!owner) throw new Error("Owner name is required");

  await prisma.marketingRequest.update({
    where: { id: requestId },
    data: {
      owner,
      activities: {
        create: { type: "OWNER_ASSIGNED", message: `Assigned to ${owner}` },
      },
    },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/");
}

export async function setMissingInfo(requestId: string, formData: FormData) {
  const missingInfo = String(formData.get("missingInfo") ?? "").trim();

  await prisma.marketingRequest.update({
    where: { id: requestId },
    data: {
      missingInfo: missingInfo || null,
      activities: {
        create: missingInfo
          ? { type: "MISSING_INFO", message: `Flagged missing info: ${missingInfo}` }
          : { type: "MISSING_INFO", message: "Missing info resolved" },
      },
    },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/");
}

export async function addNote(requestId: string, formData: FormData) {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) throw new Error("Note can't be empty");

  await prisma.activity.create({
    data: { marketingRequestId: requestId, type: "NOTE", message },
  });

  revalidatePath(`/requests/${requestId}`);
}

// Regenerating replaces any un-approved drafts (a fresh take on the brief)
// but leaves already-approved drafts alone — approval shouldn't get wiped
// out by someone clicking "Generate" again.
export async function generateContent(requestId: string) {
  const request = await prisma.marketingRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  const approvedKnowledge = await prisma.knowledgeRecord.findMany({
    where: { status: "APPROVED" },
  });

  const contentPackage = await generateContentPackage(
    {
      type: request.type,
      title: request.title,
      description: request.description,
      department: request.department,
    },
    approvedKnowledge,
  );

  const prohibitedRecords = approvedKnowledge.filter((r) =>
    PROHIBITIVE_TYPES.includes(r.type),
  );
  const compliance = await checkCompliance(contentPackage, prohibitedRecords);
  const complianceFlag = compliance.clean
    ? null
    : JSON.stringify(compliance.violations);

  await prisma.contentDraft.deleteMany({ where: { requestId, status: "DRAFT" } });

  const created = await Promise.all(
    (
      [
        ["BLOG", contentPackage.blog],
        ["LINKEDIN", contentPackage.linkedin],
        ["X", contentPackage.x],
      ] as const
    ).map(([channel, body]) =>
      prisma.contentDraft.create({
        data: {
          requestId,
          channel,
          body,
          complianceFlag,
          complianceCheckedAt: new Date(),
          knowledgeLinks: {
            create: approvedKnowledge.map((k) => ({ knowledgeRecordId: k.id })),
          },
        },
      }),
    ),
  );

  await prisma.activity.create({
    data: {
      marketingRequestId: requestId,
      type: "CONTENT_GENERATED",
      message: compliance.clean
        ? `Draft package generated (blog, LinkedIn, X) — compliance check clean, ${approvedKnowledge.length} knowledge record(s) in scope`
        : `Draft package generated (blog, LinkedIn, X) — compliance check flagged ${compliance.violations.length} possible issue(s), review required before approval`,
    },
  });

  void created;
  revalidatePath(`/requests/${requestId}`);
}

export async function approveDraft(
  requestId: string,
  draftId: string,
  formData: FormData,
) {
  const approvedBy = String(formData.get("approvedBy") ?? "").trim();
  const overrideReason = String(formData.get("overrideReason") ?? "").trim();
  if (!approvedBy) throw new Error("Your name is required to approve a draft");

  const existing = await prisma.contentDraft.findUniqueOrThrow({
    where: { id: draftId },
  });

  // A flagged draft can't be approved through the normal one-field path —
  // the approver must explicitly say why they're overriding the compliance
  // check, so the flag can't just be quietly clicked past.
  if (existing.complianceFlag && !overrideReason) {
    throw new Error(
      "This draft was flagged by the compliance check. You must provide an override reason to approve it anyway.",
    );
  }

  const draft = await prisma.contentDraft.update({
    where: { id: draftId },
    data: { status: "APPROVED", approvedBy, approvedAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      marketingRequestId: requestId,
      type: "DRAFT_APPROVED",
      message: existing.complianceFlag
        ? `${draft.channel} draft approved by ${approvedBy} OVERRIDING a compliance flag — reason: ${overrideReason}`
        : `${draft.channel} draft approved by ${approvedBy}`,
    },
  });

  revalidatePath(`/requests/${requestId}`);
}

export async function setDraftSchedule(
  requestId: string,
  draftId: string,
  formData: FormData,
) {
  const scheduledFor = String(formData.get("scheduledFor") ?? "").trim();

  const draft = await prisma.contentDraft.update({
    where: { id: draftId },
    data: { scheduledFor: scheduledFor ? new Date(scheduledFor) : null },
  });

  await prisma.activity.create({
    data: {
      marketingRequestId: requestId,
      type: "SCHEDULED",
      message: scheduledFor
        ? `${draft.channel} draft scheduled for ${new Date(scheduledFor).toLocaleDateString(undefined, { timeZone: "UTC" })}`
        : `${draft.channel} draft unscheduled`,
    },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/calendar");
}

// Records a PublishAttempt either way — success or failure — so a broken or
// missing credential shows up as an honest record, not a silent no-op.
export async function publishDraft(
  requestId: string,
  draftId: string,
  formData: FormData,
) {
  const destination = String(
    formData.get("destination") ?? "",
  ) as PublishableDestinationKey;
  if (!destination) throw new Error("Destination is required");

  const draft = await prisma.contentDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { request: true },
  });

  try {
    const result = await publish(destination, {
      title: draft.request.title,
      body: draft.body,
    });

    await prisma.$transaction([
      prisma.publishAttempt.create({
        data: { draftId, destination, success: true, url: result.url ?? result.id },
      }),
      prisma.activity.create({
        data: {
          marketingRequestId: requestId,
          type: "PUBLISHED",
          message: `Published ${draft.channel} draft to ${destination}${result.url ? ` — ${result.url}` : ""}`,
        },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$transaction([
      prisma.publishAttempt.create({
        data: { draftId, destination, success: false, error: message },
      }),
      prisma.activity.create({
        data: {
          marketingRequestId: requestId,
          type: "PUBLISH_FAILED",
          message: `Publishing ${draft.channel} draft to ${destination} failed: ${message}`,
        },
      }),
    ]);
  }

  revalidatePath(`/requests/${requestId}`);
}
