import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands";

export async function getCalendarEntries(args: {
  brandKey?: string;
  from: string;
  to: string;
}) {
  const brand = args.brandKey ? await resolveBrand(args.brandKey) : null;

  const drafts = await prisma.contentDraft.findMany({
    where: {
      scheduledFor: { gte: new Date(args.from), lt: new Date(args.to) },
      ...(brand ? { contentProject: { brandId: brand.id } } : {}),
    },
    include: { contentProject: { include: { brand: true } } },
    orderBy: { scheduledFor: "asc" },
  });

  return drafts.map((d) => ({
    id: d.id,
    contentProjectId: d.contentProjectId,
    title: d.title ?? d.contentProject.title,
    channel: d.channel,
    status: d.status,
    scheduledFor: d.scheduledFor?.toISOString() ?? null,
    brand: d.contentProject.brand.name,
  }));
}
