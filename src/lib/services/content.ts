// Framework-agnostic service layer — no `revalidatePath`/`redirect` here on
// purpose. Both the Next.js server actions (which add those Next-specific
// calls on top) and the local MCP server import from here, so the two
// surfaces can never drift into duplicate logic.
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands";
import { assertProjectBrand } from "@/lib/services/content-projects";
import type { ContentChannel } from "@/generated/prisma/client";

export async function searchContent(args: { query: string; brandKey?: string }) {
  const brand = args.brandKey ? await resolveBrand(args.brandKey) : null;

  const requests = await prisma.marketingRequest.findMany({
    where: {
      ...(brand ? { brandId: brand.id } : {}),
      OR: [
        { title: { contains: args.query } },
        { description: { contains: args.query } },
      ],
    },
    include: {
      brand: true,
      contentProjects: { include: { contentProject: { include: { drafts: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const drafts = await prisma.contentDraft.findMany({
    where: {
      body: { contains: args.query },
      ...(brand ? { contentProject: { brandId: brand.id } } : {}),
    },
    include: { contentProject: { include: { brand: true } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return {
    requests: requests.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      brand: r.brand.name,
      status: r.status,
      // Reached through the request's linked ContentProject(s), never a
      // direct drafts relation — MarketingRequest doesn't parent drafts.
      draftCount: r.contentProjects.reduce(
        (sum, link) => sum + link.contentProject.drafts.length,
        0,
      ),
    })),
    drafts: drafts.map((d) => ({
      id: d.id,
      contentProjectId: d.contentProjectId,
      title: d.title ?? d.contentProject.title,
      channel: d.channel,
      status: d.status,
      brand: d.contentProject.brand.name,
      excerpt: d.body.slice(0, 200),
    })),
  };
}

// Saves content a connected AI client (ChatGPT, Claude, whichever the owner
// is talking to) already wrote in the conversation. Deliberately does NOT
// generate or rewrite anything — Noticed is the filing system, not a second
// model. The brief goes in exactly as given; no Anthropic/OpenAI call, no
// AI-based compliance re-check (that was a second model call and is exactly
// the pattern this architecture removes).
//
// A discriminated union on purpose — "start something new" and "add to
// something that already exists" are genuinely different operations with
// different required fields, and must not be combinable into one ambiguous
// shape. Every ContentDraft belongs to exactly one ContentProject; there is
// no fabricated MarketingRequest anywhere in this path.
export type CreateContentDraftArgs =
  | {
      target: "new_project";
      brandKey: string;
      projectTitle: string;
      premise?: string;
      ideaContent?: string;
      channel: ContentChannel;
      draftTitle?: string;
      body: string;
      scheduledFor?: string | null;
    }
  | {
      target: "existing_project";
      contentProjectId: string;
      brandKey: string;
      channel: ContentChannel;
      draftTitle?: string;
      body: string;
      scheduledFor?: string | null;
    };

export async function createContentDraft(args: CreateContentDraftArgs) {
  if (!args.brandKey) {
    throw new Error(
      "brandKey is required to save a draft — creation must not silently fall back to a default brand.",
    );
  }

  if (args.target === "existing_project") {
    // Brand match is verified here, not assumed from the caller's own
    // claim — "Actor has access" reduces to this check in a single-owner
    // app with no further identity boundary to enforce.
    await assertProjectBrand(args.contentProjectId, args.brandKey);

    const draft = await prisma.contentDraft.create({
      data: {
        contentProjectId: args.contentProjectId,
        channel: args.channel,
        title: args.draftTitle ?? null,
        body: args.body,
        scheduledFor: args.scheduledFor ? new Date(args.scheduledFor) : null,
      },
    });
    return { project: await prisma.contentProject.findUniqueOrThrow({ where: { id: args.contentProjectId } }), draft };
  }

  const brand = await resolveBrand(args.brandKey);

  // Lineage only — which knowledge was APPROVED for this brand at save
  // time, so the draft shows what the connected client had available via
  // get_brand_context. This is bookkeeping, not a review: nothing here
  // reads or grades the body, and nothing blocks the save.
  const approvedKnowledge = await prisma.knowledgeRecord.findMany({
    where: { brandId: brand.id, status: "APPROVED" },
  });

  // All four writes succeed together or not at all — a failure partway
  // through (e.g. a bad scheduledFor date) must not leave a dangling Idea
  // or ContentProject with no draft, the same bug fixed earlier for the
  // old create_draft_from_idea.
  return prisma.$transaction(async (tx) => {
    const idea = await tx.idea.create({
      data: {
        brandId: brand.id,
        content: args.ideaContent ?? args.projectTitle,
        source: "Captured from a conversation",
      },
    });

    const project = await tx.contentProject.create({
      data: {
        brandId: brand.id,
        title: args.projectTitle,
        premise: args.premise ?? null,
      },
    });

    await tx.ideaContentProject.create({
      data: { ideaId: idea.id, contentProjectId: project.id },
    });

    const draft = await tx.contentDraft.create({
      data: {
        contentProjectId: project.id,
        channel: args.channel,
        title: args.draftTitle ?? null,
        body: args.body,
        scheduledFor: args.scheduledFor ? new Date(args.scheduledFor) : null,
        knowledgeLinks: {
          create: approvedKnowledge.map((k) => ({ knowledgeRecordId: k.id })),
        },
      },
    });

    return { idea, project, draft };
  });
}

export async function updateDraft(args: {
  draftId: string;
  body?: string;
  title?: string;
  scheduledFor?: string | null;
}) {
  const data: Record<string, unknown> = {};
  if (args.body !== undefined) data.body = args.body;
  if (args.title !== undefined) data.title = args.title;
  if (args.scheduledFor !== undefined) {
    data.scheduledFor = args.scheduledFor ? new Date(args.scheduledFor) : null;
  }

  const draft = await prisma.contentDraft.update({
    where: { id: args.draftId },
    data,
  });

  // Best-effort activity logging against a linked MarketingRequest, if one
  // exists. A pure Creator Studio project (no linked request) simply
  // doesn't get an Activity row yet — there's nothing to log it against,
  // and giving Activity a second, nullable parent just to cover this case
  // would be exactly the ambiguous-ownership pattern removed from
  // ContentDraft itself. This is a real, acknowledged gap, not an oversight.
  const link = await prisma.marketingRequestContentProject.findFirst({
    where: { contentProjectId: draft.contentProjectId },
    select: { marketingRequestId: true },
  });
  if (link) {
    await prisma.activity.create({
      data: {
        marketingRequestId: link.marketingRequestId,
        type: "DRAFT_REVISED",
        message: `${draft.channel} draft revised`,
      },
    });
  }

  return draft;
}

export type { ContentChannel };
