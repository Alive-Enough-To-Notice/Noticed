"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { KNOWLEDGE_STATUS_LABELS } from "@/lib/knowledge";
import type { KnowledgeType, KnowledgeStatus } from "@/generated/prisma/client";

export async function createKnowledgeRecord(formData: FormData) {
  const type = String(formData.get("type") ?? "") as KnowledgeType;
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  // Approving on creation is a deliberate choice, not a default — the form
  // makes the owner pick, rather than silently landing everything as
  // PROPOSED or, worse, APPROVED.
  const status = String(formData.get("status") ?? "PROPOSED") as KnowledgeStatus;

  if (!type || !title || !content) {
    throw new Error("Type, title, and content are required");
  }

  await prisma.knowledgeRecord.create({
    data: {
      type,
      title,
      content,
      source: source || null,
      status,
      activities: {
        create: { message: `Created (${KNOWLEDGE_STATUS_LABELS[status]})` },
      },
    },
  });

  revalidatePath("/brand");
}

export async function setKnowledgeStatus(
  recordId: string,
  formData: FormData,
) {
  const status = String(formData.get("status") ?? "") as KnowledgeStatus;
  if (!status) throw new Error("Status is required");

  const current = await prisma.knowledgeRecord.findUniqueOrThrow({
    where: { id: recordId },
  });

  if (current.status !== status) {
    await prisma.knowledgeRecord.update({
      where: { id: recordId },
      data: {
        status,
        activities: {
          create: {
            message: `Moved from ${KNOWLEDGE_STATUS_LABELS[current.status]} to ${KNOWLEDGE_STATUS_LABELS[status]}`,
          },
        },
      },
    });
  }

  revalidatePath("/brand");
}
