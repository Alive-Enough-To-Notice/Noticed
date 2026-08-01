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
import { mcpPublicOrigin } from "@/lib/mcp/oauth/config";
import { attachExistingMedia, deleteAttachment } from "@/lib/services/attachments";

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
    include: { contentProject: true, attachments: true },
  });
  const imageUrls = draft.attachments.map((a) => `${mcpPublicOrigin()}/api/media/attachments/${a.id}/file`);

  try {
    const result = await publish(destination, {
      title: draft.contentProject.title,
      body: draft.body,
      imageUrls,
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

// Copies a ready cleaned export from this same project's Media Studio onto
// the draft as its own attachment (see attachments.ts for why it's a copy,
// not a reference). mediaExportId is trusted to belong to a recording in
// this project because the picker in the UI only ever lists this project's
// own ready exports — still worth a defensive check since a form post could
// be forged with an arbitrary id.
export async function attachRecordingToDraftAction(
  projectId: string,
  draftId: string,
  formData: FormData,
) {
  const mediaExportId = String(formData.get("mediaExportId") ?? "");
  if (!mediaExportId) throw new Error("Choose a cleaned recording to attach.");

  const mediaExport = await prisma.mediaExport.findUniqueOrThrow({
    where: { id: mediaExportId },
    include: { recording: true },
  });
  if (mediaExport.recording.contentProjectId !== projectId) {
    throw new Error("That recording doesn't belong to this project.");
  }
  if (mediaExport.status !== "READY" || !mediaExport.filePath) {
    throw new Error("That export isn't ready yet.");
  }

  await attachExistingMedia({
    contentDraftId: draftId,
    sourceFilePath: mediaExport.filePath,
    mimeType: mediaExport.mimeType ?? "video/mp4",
  });

  revalidatePath(`/studio/projects/${projectId}`);
}

export async function deleteAttachmentAction(projectId: string, attachmentId: string) {
  await deleteAttachment(attachmentId);
  revalidatePath(`/studio/projects/${projectId}`);
}
