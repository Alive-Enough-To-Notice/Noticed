// Framework-agnostic service layer — no `revalidatePath`/`redirect` here on
// purpose. Both the Next.js server actions (which add those Next-specific
// calls on top) and the local MCP server import from here, so the two
// surfaces can never drift into duplicate logic.
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands";
import { getOwnerName } from "@/lib/owner";
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
    include: { brand: true, drafts: true },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const drafts = await prisma.contentDraft.findMany({
    where: {
      body: { contains: args.query },
      ...(brand ? { request: { brandId: brand.id } } : {}),
    },
    include: { request: { include: { brand: true } } },
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
      draftCount: r.drafts.length,
    })),
    drafts: drafts.map((d) => ({
      id: d.id,
      requestId: d.requestId,
      title: d.title ?? d.request.title,
      channel: d.channel,
      status: d.status,
      brand: d.request.brand.name,
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
export async function createContentDraft(args: {
  brandKey: string;
  title: string;
  channel: ContentChannel;
  body: string;
  draftTitle?: string;
  description?: string;
  scheduledFor?: string | null;
}) {
  // Deliberately not optional and not defaulted, unlike other brandKey
  // params in this file. A conversational caller (MCP) has no equivalent
  // of the web form's required <select> forcing a real choice — silently
  // falling back to the default brand here would let an ambiguous idea
  // ("that thing about admin burden") quietly land under the wrong brand
  // instead of failing loudly.
  if (!args.brandKey) {
    throw new Error(
      "brandKey is required to save a draft — creation must not silently fall back to a default brand.",
    );
  }
  const brand = await resolveBrand(args.brandKey);

  // Lineage only — which knowledge was APPROVED for this brand at save
  // time, so the draft shows what the connected client had available via
  // get_brand_context. This is bookkeeping, not a review: nothing here
  // reads or grades the body, and nothing blocks the save.
  const approvedKnowledge = await prisma.knowledgeRecord.findMany({
    where: { brandId: brand.id, status: "APPROVED" },
  });

  const request = await prisma.marketingRequest.create({
    data: {
      brandId: brand.id,
      type: "BLOG_OR_SOCIAL_CONTENT",
      title: args.title,
      description: args.description ?? null,
      // Identity comes from trusted local config, never from the MCP
      // caller — see src/lib/owner.ts.
      requesterName: getOwnerName(),
      status: "IN_PROGRESS",
      activities: {
        create: { type: "CREATED", message: "Captured from a conversation" },
      },
    },
  });

  const draft = await prisma.contentDraft.create({
    data: {
      requestId: request.id,
      channel: args.channel,
      title: args.draftTitle ?? null,
      body: args.body,
      scheduledFor: args.scheduledFor ? new Date(args.scheduledFor) : null,
      knowledgeLinks: {
        create: approvedKnowledge.map((k) => ({ knowledgeRecordId: k.id })),
      },
    },
  });

  await prisma.activity.create({
    data: {
      marketingRequestId: request.id,
      type: "CONTENT_GENERATED",
      message: `${args.channel} draft saved from a connected AI client`,
    },
  });

  return { request, draft };
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

  await prisma.activity.create({
    data: {
      marketingRequestId: (await prisma.contentDraft.findUniqueOrThrow({
        where: { id: args.draftId },
        select: { requestId: true },
      })).requestId,
      type: "DRAFT_REVISED",
      message: `${draft.channel} draft revised`,
    },
  });

  return draft;
}

export type { ContentChannel };
