// ContentProject is the one shared parent every ContentDraft belongs to —
// never a MarketingRequest directly, never ambiguous. Idea (Creator Studio)
// and MarketingRequest (Marketing Operations) both reach a ContentProject
// only through their own relation table, never by impersonating each other.
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands";

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
