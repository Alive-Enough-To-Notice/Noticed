import { prisma } from "@/lib/prisma";

export const BRAND_KEYS = [
  "noticed",
  "infranet",
  "alive-enough-to-notice",
  "northbridge",
] as const;

// Single-owner, multiple brand voices — not multi-tenant. Every brand is
// equally "yours"; this just keeps voice/knowledge/requests from blending.
export async function listBrands() {
  return prisma.brand.findMany({ orderBy: { name: "asc" } });
}

export async function resolveBrand(brandKey?: string | null) {
  if (brandKey) {
    const brand = await prisma.brand.findUnique({ where: { key: brandKey } });
    if (!brand) throw new Error(`Unknown brand key: ${brandKey}`);
    return brand;
  }
  const fallback = await prisma.brand.findFirst({ where: { isDefault: true } });
  if (!fallback) throw new Error("No default brand configured");
  return fallback;
}
