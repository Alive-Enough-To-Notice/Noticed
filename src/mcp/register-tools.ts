import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { searchContent, createContentDraft, updateDraft } from "../lib/services/content";
import { getBrandContext } from "../lib/services/brand-context";
import { getCalendarEntries } from "../lib/services/calendar";
import { saveAttachmentFromBase64 } from "../lib/services/attachments";
import { prisma } from "../lib/prisma";
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

const contentChannelSchema = z.enum(["BLOG", "LINKEDIN", "X"]);

function requireScope(
  extra: { authInfo?: { scopes?: string[] } },
  required: "mcp:content:read" | "mcp:content:write",
) {
  if (!extra.authInfo?.scopes?.includes(required)) {
    throw new Error(`Missing required OAuth scope: ${required}`);
  }
}

const createContentDraftSchema = z.discriminatedUnion("target", [
  z.object({
    target: z
      .literal("new_project")
      .describe("Start a brand-new ContentProject (and its originating Idea) for this draft."),
    brandKey: requiredBrandKeySchema,
    projectTitle: z
      .string()
      .describe("A short title for the new content project this draft starts."),
    premise: z
      .string()
      .optional()
      .describe("Optional longer description of what this project is about."),
    ideaContent: z
      .string()
      .optional()
      .describe(
        "The raw idea/fragment this came from, in your own words. Defaults to projectTitle if omitted.",
      ),
    channel: contentChannelSchema.describe("Which channel this content is written for."),
    draftTitle: z
      .string()
      .optional()
      .describe(
        "Optional distinct headline for this specific draft, if different from the project title (e.g. a blog headline).",
      ),
    body: z
      .string()
      .describe(
        "The complete, finished content to save exactly as-is — already written by you, not a brief for Noticed to expand on.",
      ),
    scheduledFor: z
      .string()
      .nullable()
      .optional()
      .describe("ISO date to schedule this for, or omit/null to leave unscheduled."),
  }),
  z.object({
    target: z
      .literal("existing_project")
      .describe("Add this draft to a ContentProject that already exists."),
    contentProjectId: z
      .string()
      .describe("The ID of the existing ContentProject to add this draft to."),
    brandKey: requiredBrandKeySchema.describe(
      "Must match the project's actual brand — verified, not assumed. The call fails if it doesn't match.",
    ),
    channel: contentChannelSchema.describe("Which channel this content is written for."),
    draftTitle: z
      .string()
      .optional()
      .describe("Optional distinct headline for this specific draft."),
    body: z.string().describe("The complete, finished content to save exactly as-is."),
    scheduledFor: z
      .string()
      .nullable()
      .optional()
      .describe("ISO date to schedule this for, or omit/null to leave unscheduled."),
  }),
]);

/** Register the five Noticed draft tools on any MCP server (stdio or HTTP). */
export function registerNoticedTools(server: McpServer) {
  server.registerTool(
    "search_content",
    {
      title: "Search content",
      description:
        "Search existing marketing requests and content drafts by keyword, optionally scoped to one brand.",
      inputSchema: {
        query: z
          .string()
          .describe("Keyword or phrase to search for in titles, descriptions, and draft bodies."),
        brandKey: brandKeySchema,
      },
    },
    async ({ query, brandKey }, extra) => {
      requireScope(extra, "mcp:content:read");
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
    async ({ brandKey }, extra) => {
      requireScope(extra, "mcp:content:read");
      const result = await getBrandContext({ brandKey });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "create_content_draft",
    {
      title: "Create content draft",
      description:
        'Save content YOU (the connected AI client) already wrote in this conversation — using your own model, not Noticed\'s. Saves the supplied title and body exactly as given; does not generate, rewrite, or call any model. Every draft belongs to a ContentProject, never a MarketingRequest — this never fabricates a fake marketing-operations record. Use target: "new_project" to start something new (also creates the originating Idea), or target: "existing_project" to add to a project you already started. brandKey is always required and is verified against the actual project brand for existing_project — never guess or default it.',
      inputSchema: createContentDraftSchema,
    },
    async (args, extra) => {
      requireScope(extra, "mcp:content:write");
      const result = await createContentDraft(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "update_draft",
    {
      title: "Update draft",
      description:
        "Revise an existing content draft's body, title, or scheduled date. Saves the supplied text exactly as given — does not regenerate or rewrite it. Does not publish or change approval status. A draft's brand is fixed by its parent ContentProject and cannot be changed here.",
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
    async ({ draftId, body, title, scheduledFor }, extra) => {
      requireScope(extra, "mcp:content:write");
      const result = await updateDraft({ draftId, body, title, scheduledFor });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "attach_image_to_draft",
    {
      title: "Attach image to draft",
      description:
        "Attach an image YOU (the connected AI client) already generated to an existing content draft — e.g. for Instagram/TikTok/Pinterest, which require media on every post. Saves the supplied image bytes exactly as given; does not generate or edit images itself. Provide raw base64 image data (no data: URL prefix) and its mime type.",
      inputSchema: {
        draftId: z.string().describe("The ID of the draft to attach this image to."),
        imageBase64: z.string().describe("Raw base64-encoded image bytes (no data: URL prefix)."),
        mimeType: z.string().describe("The image's mime type, e.g. image/png or image/jpeg."),
      },
    },
    async ({ draftId, imageBase64, mimeType }, extra) => {
      requireScope(extra, "mcp:content:write");
      const draft = await prisma.contentDraft.findUnique({ where: { id: draftId } });
      if (!draft) throw new Error(`No draft found with id ${draftId}`);
      const attachment = await saveAttachmentFromBase64({ contentDraftId: draftId, base64: imageBase64, mimeType });
      return { content: [{ type: "text", text: JSON.stringify(attachment, null, 2) }] };
    },
  );

  server.registerTool(
    "get_calendar",
    {
      title: "Get calendar",
      description:
        "List scheduled content drafts within a date range, optionally scoped to one brand.",
      inputSchema: {
        from: z.string().describe("ISO date, inclusive start of range."),
        to: z.string().describe("ISO date, exclusive end of range."),
        brandKey: brandKeySchema,
      },
    },
    async ({ from, to, brandKey }, extra) => {
      requireScope(extra, "mcp:content:read");
      const result = await getCalendarEntries({ from, to, brandKey });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
