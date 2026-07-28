import { prisma } from "@/lib/prisma";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// The one publish destination Noticed actually implements — no external
// account, no API key, just a standard RSS 2.0 feed of approved blog drafts.
// Any reader (or another platform's own RSS import, e.g. Ghost/WordPress
// syndication) can pull from this today.
export async function GET(request: Request) {
  const drafts = await prisma.contentDraft.findMany({
    where: { channel: "BLOG", status: "APPROVED" },
    include: {
      contentProject: {
        include: {
          marketingRequests: { take: 1, select: { marketingRequestId: true } },
        },
      },
    },
    orderBy: { approvedAt: "desc" },
    take: 50,
  });

  const siteUrl = new URL(request.url).origin;

  const items = drafts
    .map((draft) => {
      // A draft's project may not be linked to any MarketingRequest (a
      // Creator Studio piece) — there's no request page to send readers to
      // yet, so fall back to the calendar rather than a broken link.
      const linkedRequestId = draft.contentProject.marketingRequests[0]?.marketingRequestId;
      const link = linkedRequestId
        ? `${siteUrl}/requests/${linkedRequestId}`
        : `${siteUrl}/calendar`;
      const pubDate = (draft.approvedAt ?? draft.createdAt).toUTCString();
      return `    <item>
      <title>${escapeXml(draft.contentProject.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${draft.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${draft.body}]]></description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Noticed</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Approved blog content from Noticed's marketing workbench.</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
