"use server";

import { redirect } from "next/navigation";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands";
import { getOrCreateProjectForRequest } from "@/lib/services/content-projects";
import type { ContentChannel } from "@/generated/prisma/client";

const VALID_CHANNELS: ContentChannel[] = ["BLOG", "LINKEDIN", "X"];

type ParsedRow = {
  scheduledFor: Date | null;
  channel: ContentChannel;
  title: string;
  body: string;
};

// Deliberately forgiving — this exists specifically so a large batch doesn't
// get rejected wholesale over a few bad rows (the whole point is "upload 600
// posts and don't have to babysit it"). Bad rows are skipped and counted,
// not fatal.
function parseRows(csvText: string): { rows: ParsedRow[]; skipped: number } {
  const records = parse(csvText, {
    columns: ["date", "channel", "title", "body"],
    skip_empty_lines: true,
    from_line: csvText.trim().toLowerCase().startsWith("date,") ? 2 : 1,
    relax_column_count: true,
  }) as Array<{ date?: string; channel?: string; title?: string; body?: string }>;

  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (const record of records) {
    const channel = (record.channel ?? "").trim().toUpperCase() as ContentChannel;
    const body = (record.body ?? "").trim();
    if (!VALID_CHANNELS.includes(channel) || !body) {
      skipped++;
      continue;
    }
    const dateStr = (record.date ?? "").trim();
    const scheduledFor = dateStr ? new Date(dateStr) : null;
    if (dateStr && Number.isNaN(scheduledFor?.getTime())) {
      skipped++;
      continue;
    }
    rows.push({
      scheduledFor,
      channel,
      title: (record.title ?? "").trim() || body.slice(0, 60),
      body,
    });
  }

  return { rows, skipped };
}

export async function bulkImport(formData: FormData) {
  const brandKey = String(formData.get("brandKey") ?? "").trim();
  const requesterName = String(formData.get("requesterName") ?? "").trim();
  const file = formData.get("file") as File | null;
  const pastedText = String(formData.get("csvText") ?? "").trim();

  if (!requesterName) throw new Error("Your name is required");

  const csvText = file && file.size > 0 ? await file.text() : pastedText;
  if (!csvText) throw new Error("Provide a CSV file or paste CSV text");

  const { rows, skipped } = parseRows(csvText);
  if (rows.length === 0) {
    throw new Error(
      "No valid rows found. Expected columns: date,channel,title,body (channel is BLOG, LINKEDIN, or X).",
    );
  }

  const brand = await resolveBrand(brandKey || null);

  const request = await prisma.marketingRequest.create({
    data: {
      brandId: brand.id,
      type: "CAMPAIGN",
      title: `Bulk import — ${rows.length} post${rows.length === 1 ? "" : "s"} (${new Date().toLocaleDateString(undefined, { timeZone: "UTC" })})`,
      requesterName,
      status: "IN_PROGRESS",
      activities: {
        create: {
          type: "BULK_IMPORT",
          message: `Bulk-imported ${rows.length} post(s)${skipped > 0 ? `, skipped ${skipped} invalid row(s)` : ""}`,
        },
      },
    },
  });

  // Every ContentDraft belongs to a ContentProject, never the request
  // directly — a fresh request has no existing link yet, so this creates
  // one wrapping project for the whole batch.
  const project = await getOrCreateProjectForRequest(request.id);

  await prisma.contentDraft.createMany({
    data: rows.map((row) => ({
      contentProjectId: project.id,
      channel: row.channel,
      title: row.title,
      body: row.body,
      scheduledFor: row.scheduledFor,
    })),
  });

  redirect(`/requests/${request.id}?imported=${rows.length}&skipped=${skipped}`);
}
