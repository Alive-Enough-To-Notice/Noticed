"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function saveBrandProfile(formData: FormData) {
  const voice = String(formData.get("voice") ?? "").trim();
  const audiences = String(formData.get("audiences") ?? "").trim();
  const positioning = String(formData.get("positioning") ?? "").trim();
  const approvedLanguage = String(formData.get("approvedLanguage") ?? "").trim();
  const prohibitedLanguage = String(formData.get("prohibitedLanguage") ?? "").trim();

  const data = {
    voice: voice || null,
    audiences: audiences || null,
    positioning: positioning || null,
    approvedLanguage: approvedLanguage || null,
    prohibitedLanguage: prohibitedLanguage || null,
  };

  await prisma.brandProfile.upsert({
    where: { id: "brand" },
    create: { id: "brand", ...data },
    update: data,
  });

  revalidatePath("/brand");
}
