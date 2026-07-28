import "dotenv/config";
import { ensureBrandsSeeded } from "../src/lib/ensure-brands";
import { prisma } from "../src/lib/prisma";

async function main() {
  await ensureBrandsSeeded();
  const brands = await prisma.brand.findMany({ orderBy: { key: "asc" } });
  console.log(
    "Brands:",
    brands.map((b) => ({ key: b.key, name: b.name, isDefault: b.isDefault })),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
