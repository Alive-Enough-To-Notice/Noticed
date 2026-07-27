"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { REQUEST_STATUS_LABELS } from "@/lib/requests";
import { generateContentPackage } from "@/lib/content-generator";
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

  const contentPackage = await generateContentPackage({
    type: request.type,
    title: request.title,
    description: request.description,
    department: request.department,
  });

  await prisma.$transaction([
    prisma.contentDraft.deleteMany({
      where: { requestId, status: "DRAFT" },
    }),
    prisma.contentDraft.createMany({
      data: [
        { requestId, channel: "BLOG", body: contentPackage.blog },
        { requestId, channel: "LINKEDIN", body: contentPackage.linkedin },
        { requestId, channel: "X", body: contentPackage.x },
      ],
    }),
    prisma.activity.create({
      data: {
        marketingRequestId: requestId,
        type: "CONTENT_GENERATED",
        message: "Draft package generated (blog, LinkedIn, X)",
      },
    }),
  ]);

  revalidatePath(`/requests/${requestId}`);
}

export async function approveDraft(
  requestId: string,
  draftId: string,
  formData: FormData,
) {
  const approvedBy = String(formData.get("approvedBy") ?? "").trim();
  if (!approvedBy) throw new Error("Your name is required to approve a draft");

  const draft = await prisma.contentDraft.update({
    where: { id: draftId },
    data: { status: "APPROVED", approvedBy, approvedAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      marketingRequestId: requestId,
      type: "DRAFT_APPROVED",
      message: `${draft.channel} draft approved by ${approvedBy}`,
    },
  });

  revalidatePath(`/requests/${requestId}`);
}
