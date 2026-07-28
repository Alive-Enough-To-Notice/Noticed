// Framework-agnostic service layer — no `revalidatePath`/`redirect` here on
// purpose. Both the Next.js server actions (which add those Next-specific
// calls on top) and the local MCP server import from here, so the two
// surfaces can never drift into duplicate logic.
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands";
import { PROHIBITIVE_TYPES } from "@/lib/knowledge";
import { generateContentPackage, checkCompliance } from "@/lib/content-generator";
import type { ContentChannel, RequestType } from "@/generated/prisma/client";

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

export async function createDraftFromIdea(args: {
  brandKey: string;
  requesterName: string;
  title: string;
  description?: string;
  type?: RequestType;
}) {
  // Deliberately not optional and not defaulted, unlike other brandKey
  // params in this file. A conversational caller (MCP) has no equivalent
  // of the web form's required <select> forcing a real choice — silently
  // falling back to the default brand here would let an ambiguous idea
  // ("that thing about admin burden") quietly land under the wrong brand
  // instead of failing loudly.
  if (!args.brandKey) {
    throw new Error(
      "brandKey is required to create a draft — creation must not silently fall back to a default brand.",
    );
  }
  const brand = await resolveBrand(args.brandKey);
  const type = args.type ?? "CAMPAIGN";

  // Brand-scoped on purpose — this is the whole point of the brand layer.
  // InfraNet's voice/prohibited-claims must never bleed into a draft
  // written for Alive Enough to Notice, or vice versa.
  const approvedKnowledge = await prisma.knowledgeRecord.findMany({
    where: { brandId: brand.id, status: "APPROVED" },
  });

  // Generate BEFORE writing anything to the database. A caller with no
  // ANTHROPIC_API_KEY configured (or any other generation failure) must not
  // leave a dangling MarketingRequest with zero drafts behind — found by
  // actually testing this tool end to end, not by inspection.
  const contentPackage = await generateContentPackage(
    {
      type,
      title: args.title,
      description: args.description ?? null,
      department: null,
    },
    approvedKnowledge,
  );

  const prohibitedRecords = approvedKnowledge.filter((r) =>
    PROHIBITIVE_TYPES.includes(r.type),
  );
  const compliance = await checkCompliance(contentPackage, prohibitedRecords);
  const complianceFlag = compliance.clean ? null : JSON.stringify(compliance.violations);

  const request = await prisma.marketingRequest.create({
    data: {
      brandId: brand.id,
      type,
      title: args.title,
      description: args.description ?? null,
      requesterName: args.requesterName,
      status: "IN_PROGRESS",
      activities: {
        create: { type: "CREATED", message: "Captured from a conversation" },
      },
    },
  });

  const drafts = await Promise.all(
    (
      [
        ["BLOG", contentPackage.blog],
        ["LINKEDIN", contentPackage.linkedin],
        ["X", contentPackage.x],
      ] as const
    ).map(([channel, body]) =>
      prisma.contentDraft.create({
        data: {
          requestId: request.id,
          channel,
          body,
          complianceFlag,
          complianceCheckedAt: new Date(),
          knowledgeLinks: {
            create: approvedKnowledge.map((k) => ({ knowledgeRecordId: k.id })),
          },
        },
      }),
    ),
  );

  await prisma.activity.create({
    data: {
      marketingRequestId: request.id,
      type: "CONTENT_GENERATED",
      message: compliance.clean
        ? `Draft package generated (blog, LinkedIn, X) — compliance check clean`
        : `Draft package generated — compliance check flagged ${compliance.violations.length} possible issue(s)`,
    },
  });

  return { request, drafts, complianceClean: compliance.clean };
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
