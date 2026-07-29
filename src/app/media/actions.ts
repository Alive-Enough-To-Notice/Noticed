"use server";

import { redirect } from "next/navigation";
import { resolveBrand } from "@/lib/brands";
import { prisma } from "@/lib/prisma";

export async function createMediaProjectAction(formData: FormData) {
  const brandKey = String(formData.get("brandKey") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "AUDIO") === "VIDEO" ? "video" : "podcast";
  if (!title) throw new Error("Give this recording a name.");
  const brand = await resolveBrand(brandKey);
  const project = await prisma.contentProject.create({
    data: {
      brandId: brand.id,
      title,
      premise: kind === "video" ? "Accessible video recording and transcript editing" : "Accessible podcast recording and transcript editing",
    },
  });
  redirect(`/media/${project.id}?kind=${kind}`);
}
