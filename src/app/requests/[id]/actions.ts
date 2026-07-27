"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { REQUEST_STATUS_LABELS } from "@/lib/requests";
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
