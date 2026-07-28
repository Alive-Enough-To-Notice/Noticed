"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { REQUEST_STATUS_LABELS } from "@/lib/requests";
import { getOrCreateProjectForRequest } from "@/lib/services/content-projects";
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

// Noticed no longer embeds a model provider — content gets written in
// whichever AI client the owner is already talking to (ChatGPT, Claude,
// etc.) and saved here via the create_content_draft/update_draft MCP
// tools (see src/mcp/server.ts, src/lib/services/content.ts). This action
// is the manual/local equivalent: start one empty draft per channel to
// write into directly in the browser, or to paste finished text into.
export async function createManualDraft(requestId: string, formData: FormData) {
  const channel = String(formData.get("channel") ?? "") as "BLOG" | "LINKEDIN" | "X";
  if (!channel) throw new Error("Channel is required");

  // Every ContentDraft belongs to a ContentProject, never the request
  // directly — this finds (or creates, on first use) the project this
  // request routes through.
  const project = await getOrCreateProjectForRequest(requestId);

  await prisma.contentDraft.create({
    data: { contentProjectId: project.id, channel, body: "" },
  });

  await prisma.activity.create({
    data: {
      marketingRequestId: requestId,
      type: "CONTENT_GENERATED",
      message: `${channel} manual draft started`,
    },
  });

  revalidatePath(`/requests/${requestId}`);
}

export async function editDraftBody(
  requestId: string,
  draftId: string,
  formData: FormData,
) {
  const body = String(formData.get("body") ?? "");

  await prisma.contentDraft.update({
    where: { id: draftId },
    data: { body },
  });

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
    include: { contentProject: true },
  });

  try {
    const result = await publish(destination, {
      title: draft.contentProject.title,
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
