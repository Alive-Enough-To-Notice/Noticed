"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { RequestPriority, RequestType } from "@/generated/prisma/client";

export async function createRequest(formData: FormData) {
  const type = String(formData.get("type") ?? "") as RequestType;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const requesterName = String(formData.get("requesterName") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const priority = String(formData.get("priority") ?? "NORMAL") as RequestPriority;
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (!type || !title || !requesterName) {
    throw new Error("Type, title, and requester name are required");
  }

  const request = await prisma.marketingRequest.create({
    data: {
      type,
      title,
      description: description || null,
      requesterName,
      department: department || null,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      activities: {
        create: { type: "CREATED", message: "Request submitted" },
      },
    },
  });

  redirect(`/requests/${request.id}`);
}
