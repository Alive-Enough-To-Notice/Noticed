import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands";

export async function getCalendarEntries(args: {
  brandKey?: string;
  from: string;
  to: string;
}) {
  const brand = args.brandKey ? await resolveBrand(args.brandKey) : null;

  const entries = await prisma.scheduleEntry.findMany({
    where: {
      scheduledFor: { gte: new Date(args.from), lt: new Date(args.to) },
      ...(brand ? { draft: { contentProject: { brandId: brand.id } } } : {}),
    },
    include: { draft: { include: { contentProject: { include: { brand: true } } } } },
    orderBy: { scheduledFor: "asc" },
  });

  return entries.map((entry) => ({
    id: entry.id,
    draftId: entry.draftId,
    contentProjectId: entry.draft.contentProjectId,
    title: entry.draft.title ?? entry.draft.contentProject.title,
    channel: entry.draft.channel,
    destination: entry.destination,
    status: entry.status,
    scheduledFor: entry.scheduledFor.toISOString(),
    publishedUrl: entry.publishedUrl,
    brand: entry.draft.contentProject.brand.name,
  }));
}
