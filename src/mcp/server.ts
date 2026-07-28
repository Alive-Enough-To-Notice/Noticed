// Local stdio MCP proof of concept — a dev/validation step, not the final
// product. Exposes exactly five tools over Noticed's existing service layer
// (src/lib/services/*). No raw database access, no duplicated business
// logic, no live publishing. Run with `npm run mcp`.
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { searchContent, createDraftFromIdea, updateDraft } from "../lib/services/content";
import { getBrandContext } from "../lib/services/brand-context";
import { getCalendarEntries } from "../lib/services/calendar";
import { BRAND_KEYS } from "../lib/brands";

const brandKeySchema = z
  .enum(BRAND_KEYS)
  .optional()
  .describe(
    "Which brand to scope this to — one of: " +
      BRAND_KEYS.join(", ") +
      ". Omit to use the owner's default brand.",
  );

const server = new McpServer({
  name: "noticed",
  version: "0.1.0",
});

server.registerTool(
  "search_content",
  {
    title: "Search content",
    description:
      "Search existing marketing requests and content drafts by keyword, optionally scoped to one brand.",
    inputSchema: {
      query: z.string().describe("Keyword or phrase to search for in titles, descriptions, and draft bodies."),
      brandKey: brandKeySchema,
    },
  },
  async ({ query, brandKey }) => {
    const result = await searchContent({ query, brandKey });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "get_brand_context",
  {
    title: "Get brand context",
    description:
      "Fetch a brand's approved knowledge — voice rules, positioning, approved/prohibited terms and claims. Only APPROVED records are returned, since that's all a generation call is allowed to draw from.",
    inputSchema: {
      brandKey: brandKeySchema,
    },
  },
  async ({ brandKey }) => {
    const result = await getBrandContext({ brandKey });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "create_draft_from_idea",
  {
    title: "Create draft from idea",
    description:
      "Turn a rough idea into a new request plus a generated package of drafts (blog, LinkedIn, X), scoped to one brand's approved knowledge. This creates DRAFTS only — nothing is published. Requires the owner's own ANTHROPIC_API_KEY to be set in .env.",
    inputSchema: {
      brandKey: brandKeySchema,
      requesterName: z.string().describe("Name to attribute this request to."),
      title: z.string().describe("A short title for the idea."),
      description: z.string().optional().describe("More detail on the idea — the brief the drafts are generated from."),
      type: z
        .enum([
          "CAMPAIGN",
          "WEBSITE_CHANGE",
          "BLOG_OR_SOCIAL_CONTENT",
          "CUSTOMER_EMAIL",
          "ADVERTISEMENT",
          "LOGO_OR_CREATIVE_ASSET",
          "PRINT_COLLATERAL",
          "RECRUITING_SUPPORT",
          "JOB_FAIR_OR_EVENT",
          "PROMOTIONAL_PRODUCT",
          "PHOTO_OR_VIDEO",
          "SPONSORSHIP",
        ])
        .optional()
        .describe("Request type — defaults to CAMPAIGN if omitted."),
    },
  },
  async ({ brandKey, requesterName, title, description, type }) => {
    const result = await createDraftFromIdea({ brandKey, requesterName, title, description, type });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "update_draft",
  {
    title: "Update draft",
    description:
      "Revise an existing content draft's body, title, or scheduled date. Does not publish or change approval status.",
    inputSchema: {
      draftId: z.string().describe("The ID of the draft to update."),
      body: z.string().optional().describe("New draft body text."),
      title: z.string().optional().describe("New draft title."),
      scheduledFor: z
        .string()
        .nullable()
        .optional()
        .describe("ISO date to schedule for, or null to unschedule."),
    },
  },
  async ({ draftId, body, title, scheduledFor }) => {
    const result = await updateDraft({ draftId, body, title, scheduledFor });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "get_calendar",
  {
    title: "Get calendar",
    description: "List scheduled content drafts within a date range, optionally scoped to one brand.",
    inputSchema: {
      from: z.string().describe("ISO date, inclusive start of range."),
      to: z.string().describe("ISO date, exclusive end of range."),
      brandKey: brandKeySchema,
    },
  },
  async ({ from, to, brandKey }) => {
    const result = await getCalendarEntries({ from, to, brandKey });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Noticed MCP server failed to start:", error);
  process.exit(1);
});
