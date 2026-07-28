import { prisma } from "@/lib/prisma";
import { BRAND_KEYS } from "@/lib/brands";

const BRAND_NAMES: Record<(typeof BRAND_KEYS)[number], string> = {
  noticed: "Noticed",
  infranet: "InfraNet",
  "alive-enough-to-notice": "Alive Enough to Notice",
  northbridge: "NorthBridge",
};

/**
 * Ensure the four known brands exist. Safe to call repeatedly.
 * Sets `noticed` as the default when no default is configured.
 */
export async function ensureBrandsSeeded() {
  for (const key of BRAND_KEYS) {
    await prisma.brand.upsert({
      where: { key },
      create: {
        key,
        name: BRAND_NAMES[key],
        isDefault: key === "noticed",
      },
      update: {
        name: BRAND_NAMES[key],
      },
    });
  }

  const defaultCount = await prisma.brand.count({ where: { isDefault: true } });
  if (defaultCount === 0) {
    await prisma.brand.update({
      where: { key: "noticed" },
      data: { isDefault: true },
    });
  } else if (defaultCount > 1) {
    // Keep only noticed as default if somehow multiple were marked.
    await prisma.brand.updateMany({
      where: { isDefault: true, NOT: { key: "noticed" } },
      data: { isDefault: false },
    });
    await prisma.brand.update({
      where: { key: "noticed" },
      data: { isDefault: true },
    });
  }
}
