// Local stdio MCP proof of concept — a dev/validation step, not the final
// product. Exposes exactly five tools over Noticed's existing service layer
// (src/lib/services/*). No raw database access, no duplicated business
// logic, no live publishing. Run with `npm run mcp`.
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { searchContent, updateDraft } from "../lib/services/content";
// createContentDraft is intentionally NOT imported here right now — the
// create_content_draft tool below is paused at the MCP boundary rather than
// wired to it, so the fake-MarketingRequest problem can't fire even by
// accident. The function itself is untouched in src/lib/services/content.ts.
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

// Deliberately NOT optional, unlike brandKeySchema above. Creating content
// is a write with real brand consequences — a conversational caller must
// name the brand explicitly rather than silently landing under whichever
// brand happens to be marked default.
const requiredBrandKeySchema = z
  .enum(BRAND_KEYS)
  .describe(
    "Which brand this draft belongs to — required, one of: " +
      BRAND_KEYS.join(", ") +
      ". Never inferred or defaulted — ask the user which brand if it isn't obvious from the conversation.",
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
  "create_content_draft",
  {
    title: "Create content draft",
    description:
      "PAUSED — do not call this expecting it to succeed. Every ContentDraft currently requires a MarketingRequest parent (a company-marketing-operations concept: an internal stakeholder requesting work from a marketing function). Saving a personal Creator Studio draft today would mean fabricating a fake MarketingRequest to satisfy that constraint — a semantically false record, not a harmless placeholder. This tool is disabled until a ContentProject parent model exists so Creator Studio content has a home that isn't a lie. See docs/content-project-decoupling-proposal.md.",
    inputSchema: {
      brandKey: requiredBrandKeySchema,
      title: z.string().describe("A short title for this piece of content / the request it belongs to."),
      channel: z.enum(["BLOG", "LINKEDIN", "X"]).describe("Which channel this content is written for."),
      body: z.string().describe("The complete, finished content to save exactly as-is — already written by you, not a brief for Noticed to expand on."),
      draftTitle: z.string().optional().describe("Optional distinct headline for this specific draft, if different from the overall title (e.g. a blog headline)."),
      description: z.string().optional().describe("Optional short note on what this content is / where the idea came from."),
      scheduledFor: z
        .string()
        .nullable()
        .optional()
        .describe("ISO date to schedule this for, or omit/null to leave unscheduled."),
    },
  },
  async () => {
    // Fails closed, on purpose, before touching the database at all.
    // createContentDraft() in src/lib/services/content.ts is untouched —
    // this is a deliberate pause at the MCP boundary, not a deletion of
    // prior work. Every ContentDraft today requires a MarketingRequest
    // (ContentDraft.requestId is a required, non-nullable FK) — and
    // MarketingRequest specifically represents an internal stakeholder
    // requesting work from a company marketing function, a different
    // product than this personal Creator Studio. Re-enabling this tool
    // means fabricating one of those company-marketing-operations
    // records for every personal idea, which is a false record, not a
    // convenience. See docs/content-project-decoupling-proposal.md for
    // the approved fix before this tool is turned back on.
    throw new Error(
      "create_content_draft is paused: Creator Studio persistence model not yet enabled. " +
        "Saving a draft today would require fabricating a MarketingRequest (a company-marketing-operations concept) " +
        "to satisfy ContentDraft's current required parent, which would be a false record. " +
        "This is disabled until a ContentProject model exists for Creator Studio content to belong to instead. " +
        "Read-only tools (search_content, get_brand_context, get_calendar) remain available.",
    );
  },
);

server.registerTool(
  "update_draft",
  {
    title: "Update draft",
    description:
      "Revise an existing content draft's body, title, or scheduled date. Saves the supplied text exactly as given — does not regenerate or rewrite it. Does not publish or change approval status. A draft's brand is fixed by its parent request and cannot be changed here.",
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
