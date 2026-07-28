import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands";
import { KNOWLEDGE_TYPE_LABELS } from "@/lib/knowledge";

export async function getBrandContext(args: { brandKey?: string }) {
  const brand = await resolveBrand(args.brandKey);

  const records = await prisma.knowledgeRecord.findMany({
    where: { brandId: brand.id, status: "APPROVED" },
    orderBy: { type: "asc" },
  });

  return {
    brand: { key: brand.key, name: brand.name },
    knowledge: records.map((r) => ({
      type: KNOWLEDGE_TYPE_LABELS[r.type],
      title: r.title,
      content: r.content,
    })),
  };
}
