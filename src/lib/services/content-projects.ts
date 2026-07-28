// ContentProject is the one shared parent every ContentDraft belongs to —
// never a MarketingRequest directly, never ambiguous. Idea (Creator Studio)
// and MarketingRequest (Marketing Operations) both reach a ContentProject
// only through their own relation table, never by impersonating each other.
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands";
import type { ContentChannel } from "@/generated/prisma/client";

// Every Marketing Operations request routes its drafts through a
// ContentProject now. A request gets exactly one project the first time it
// needs one (checked via the relation table, never assumed by a direct FK);
// after that, the same project is reused. Brand consistency is verified
// here, not just trusted from the UI — a linked project that somehow
// belongs to a different brand than its request is a real bug, not a
// silently-accepted edge case.
export async function getOrCreateProjectForRequest(requestId: string) {
  const request = await prisma.marketingRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { contentProjects: { include: { contentProject: true } } },
  });

  const existingLink = request.contentProjects[0];
  if (existingLink) {
    if (existingLink.contentProject.brandId !== request.brandId) {
      throw new Error(
        `ContentProject ${existingLink.contentProject.id} belongs to a different brand than MarketingRequest ${requestId} — refusing to use it.`,
      );
    }
    return existingLink.contentProject;
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.contentProject.create({
      data: {
        brandId: request.brandId,
        title: request.title,
        premise: request.description,
      },
    });
    await tx.marketingRequestContentProject.create({
      data: { marketingRequestId: request.id, contentProjectId: project.id },
    });
    return project;
  });
}

// Verifies a ContentProject actually belongs to the brand a caller expects
// before letting anything attach to it — services must enforce this
// themselves rather than trusting a UI dropdown or an MCP client's own
// claim about which brand it means.
export async function assertProjectBrand(contentProjectId: string, brandKey: string) {
  const brand = await resolveBrand(brandKey);
  const project = await prisma.contentProject.findUnique({
    where: { id: contentProjectId },
  });
  if (!project) {
    throw new Error(`ContentProject not found: ${contentProjectId}`);
  }
  if (project.brandId !== brand.id) {
    throw new Error(
      `Brand mismatch: ContentProject ${contentProjectId} does not belong to brand "${brandKey}".`,
    );
  }
  return project;
}

// ---- Creator Studio: Idea capture and promotion ----
// Idea never requires a MarketingRequest, and never creates one — this is
// the Creator Studio's own, separate door into ContentProject.

export async function createIdea(args: {
  brandKey: string;
  content: string;
  workingTitle?: string;
}) {
  if (!args.brandKey) {
    throw new Error("brandKey is required to capture an idea.");
  }
  const brand = await resolveBrand(args.brandKey);
  return prisma.idea.create({
    data: {
      brandId: brand.id,
      content: args.content,
      source: args.workingTitle ? `Working title: ${args.workingTitle}` : null,
    },
  });
}

export type PromoteIdeaArgs =
  | { ideaId: string; mode: "new"; projectTitle: string; premise?: string }
  | { ideaId: string; mode: "existing"; contentProjectId: string };

// Turns "there's something here" into a real production parent. Brand is
// never asked again — an idea can only ever attach to a project sharing its
// own brand, checked here rather than trusted from whatever the UI happened
// to list.
export async function promoteIdea(args: PromoteIdeaArgs) {
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: args.ideaId } });

  return prisma.$transaction(async (tx) => {
    let projectId: string;

    if (args.mode === "existing") {
      const project = await tx.contentProject.findUniqueOrThrow({
        where: { id: args.contentProjectId },
      });
      if (project.brandId !== idea.brandId) {
        throw new Error(
          `ContentProject ${args.contentProjectId} belongs to a different brand than this idea — refusing to promote into it.`,
        );
      }
      projectId = project.id;
    } else {
      const project = await tx.contentProject.create({
        data: {
          brandId: idea.brandId,
          title: args.projectTitle,
          premise: args.premise ?? idea.content,
        },
      });
      projectId = project.id;
    }

    await tx.ideaContentProject.upsert({
      where: { ideaId_contentProjectId: { ideaId: idea.id, contentProjectId: projectId } },
      create: { ideaId: idea.id, contentProjectId: projectId },
      update: {},
    });

    await tx.idea.update({ where: { id: idea.id }, data: { status: "PROMOTED" } });

    return tx.contentProject.findUniqueOrThrow({ where: { id: projectId } });
  });
}

// A project can also be started directly, with no idea behind it — the
// schema never requires one.
export async function createProject(args: {
  brandKey: string;
  title: string;
  premise?: string;
}) {
  if (!args.brandKey) {
    throw new Error("brandKey is required to create a project.");
  }
  const brand = await resolveBrand(args.brandKey);
  return prisma.contentProject.create({
    data: { brandId: brand.id, title: args.title, premise: args.premise ?? null },
  });
}

export async function createBlankDraftInProject(
  contentProjectId: string,
  channel: ContentChannel,
) {
  return prisma.contentDraft.create({
    data: { contentProjectId, channel, body: "" },
  });
}
