"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createIdea,
  promoteIdea,
  createProject,
  createBlankDraftInProject,
} from "@/lib/services/content-projects";
import { publish, type PublishableDestinationKey } from "@/lib/publishers";
import type { ContentChannel, IdeaStatus } from "@/generated/prisma/client";
import { createHash } from "node:crypto";

export async function createIdeaAction(formData: FormData) {
  const brandKey = String(formData.get("brandKey") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const workingTitle = String(formData.get("workingTitle") ?? "").trim();
  if (!content) throw new Error("Idea content is required");

  await createIdea({ brandKey, content, workingTitle: workingTitle || undefined });
  revalidatePath("/studio");
}

export async function setIdeaStatusAction(ideaId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "") as IdeaStatus;
  if (!status) throw new Error("Status is required");

  await prisma.idea.update({ where: { id: ideaId }, data: { status } });
  revalidatePath("/studio");
}

// Never touches MarketingRequest — a promoted idea always becomes (or
// attaches to) a ContentProject directly.
export async function promoteIdeaAction(ideaId: string, formData: FormData) {
  const mode = String(formData.get("mode") ?? "");

  const project =
    mode === "existing"
      ? await promoteIdea({
          ideaId,
          mode: "existing",
          contentProjectId: String(formData.get("contentProjectId") ?? "").trim(),
        })
      : await promoteIdea({
          ideaId,
          mode: "new",
          projectTitle: String(formData.get("projectTitle") ?? "").trim(),
          premise: String(formData.get("premise") ?? "").trim() || undefined,
        });

  redirect(`/studio/projects/${project.id}`);
}

export async function createProjectAction(formData: FormData) {
  const brandKey = String(formData.get("brandKey") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const premise = String(formData.get("premise") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const project = await createProject({ brandKey, title, premise: premise || undefined });
  redirect(`/studio/projects/${project.id}`);
}

export async function createProjectDraftAction(projectId: string, formData: FormData) {
  const channel = String(formData.get("channel") ?? "") as ContentChannel;
  if (!channel) throw new Error("Channel is required");

  await createBlankDraftInProject(projectId, channel);
  revalidatePath(`/studio/projects/${projectId}`);
}

export async function editDraftBodyAction(
  projectId: string,
  draftId: string,
  formData: FormData,
) {
  const body = String(formData.get("body") ?? "");
  const existing = await prisma.contentDraft.findUniqueOrThrow({ where: { id: draftId } });
  await prisma.$transaction(async (tx) => {
    await tx.draftVersion.create({
      data: {
        draftId,
        title: existing.title,
        body: existing.body,
        reason: "Snapshot before manual edit",
      },
    });
    await tx.contentDraft.update({
      where: { id: draftId },
      data: {
        body,
        status: "DRAFT",
        approvedBy: null,
        approvedAt: null,
      },
    });
  });
  revalidatePath(`/studio/projects/${projectId}`);
}

export async function setDraftScheduleAction(
  projectId: string,
  draftId: string,
  formData: FormData,
) {
  const scheduledFor = String(formData.get("scheduledFor") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim();
  if (!destination) throw new Error("Destination is required");
  if (!scheduledFor) throw new Error("Date is required");
  await prisma.scheduleEntry.upsert({
    where: {
      draftId_destination_scheduledFor: {
        draftId,
        destination,
        scheduledFor: new Date(scheduledFor),
      },
    },
    create: { draftId, destination, scheduledFor: new Date(scheduledFor) },
    update: { status: "PLANNED" },
  });
  revalidatePath(`/studio/projects/${projectId}`);
  revalidatePath("/calendar");
}

export async function approveDraftAction(
  projectId: string,
  draftId: string,
  formData: FormData,
) {
  const approvedBy = String(formData.get("approvedBy") ?? "").trim();
  const overrideReason = String(formData.get("overrideReason") ?? "").trim();
  if (!approvedBy) throw new Error("Your name is required to approve a draft");

  const existing = await prisma.contentDraft.findUniqueOrThrow({ where: { id: draftId } });

  if (existing.complianceFlag && !overrideReason) {
    throw new Error(
      "This draft was flagged by the compliance check. You must provide an override reason to approve it anyway.",
    );
  }

  await prisma.contentDraft.update({
    where: { id: draftId },
    data: { status: "APPROVED", approvedBy, approvedAt: new Date() },
  });
  await prisma.draftApproval.create({
    data: {
      draftId,
      approvedBy,
      destination: String(formData.get("destination") ?? "INTERNAL_PREVIEW"),
      bodyHash: createHash("sha256").update(existing.body).digest("hex"),
      notes: overrideReason || null,
    },
  });

  revalidatePath(`/studio/projects/${projectId}`);
}

// Records a PublishAttempt either way, same honest-failure pattern as
// Marketing Operations' publishDraft.
export async function publishDraftAction(
  projectId: string,
  draftId: string,
  formData: FormData,
) {
  if (process.env.NOTICED_LIVE_PUBLISHING_ENABLED !== "true") {
    throw new Error(
      "Live publishing is locked. Prepare the destination preview and obtain explicit owner approval before enabling a live publication.",
    );
  }
  const destination = String(formData.get("destination") ?? "") as PublishableDestinationKey;
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
    await prisma.publishAttempt.create({
      data: { draftId, destination, success: true, url: result.url ?? result.id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.publishAttempt.create({
      data: { draftId, destination, success: false, error: message },
    });
  }

  revalidatePath(`/studio/projects/${projectId}`);
}
