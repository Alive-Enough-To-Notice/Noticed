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
  brandKey?: string;
  requesterName: string;
  title: string;
  description?: string;
  type?: RequestType;
}) {
  const brand = await resolveBrand(args.brandKey);

  const request = await prisma.marketingRequest.create({
    data: {
      brandId: brand.id,
      type: args.type ?? "CAMPAIGN",
      title: args.title,
      description: args.description ?? null,
      requesterName: args.requesterName,
      status: "IN_PROGRESS",
      activities: {
        create: { type: "CREATED", message: "Captured from a conversation" },
      },
    },
  });

  // Brand-scoped on purpose — this is the whole point of the brand layer.
  // InfraNet's voice/prohibited-claims must never bleed into a draft
  // written for Alive Enough to Notice, or vice versa.
  const approvedKnowledge = await prisma.knowledgeRecord.findMany({
    where: { brandId: brand.id, status: "APPROVED" },
  });

  const contentPackage = await generateContentPackage(
    {
      type: request.type,
      title: request.title,
      description: request.description,
      department: null,
    },
    approvedKnowledge,
  );

  const prohibitedRecords = approvedKnowledge.filter((r) =>
    PROHIBITIVE_TYPES.includes(r.type),
  );
  const compliance = await checkCompliance(contentPackage, prohibitedRecords);
  const complianceFlag = compliance.clean ? null : JSON.stringify(compliance.violations);

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
