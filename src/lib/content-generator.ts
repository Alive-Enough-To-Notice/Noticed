import Anthropic from "@anthropic-ai/sdk";
import { KNOWLEDGE_TYPE_LABELS, PROHIBITIVE_TYPES } from "@/lib/knowledge";
import type { KnowledgeRecord } from "@/generated/prisma/client";

export type ContentPackage = {
  blog: string;
  linkedin: string;
  x: string;
};

export type RequestBrief = {
  type: string;
  title: string;
  description: string | null;
  department: string | null;
};

const GENERATE_TOOL: Anthropic.Tool = {
  name: "generate_content_package",
  description:
    "Generate a blog article and channel-adapted social posts from a marketing request brief.",
  input_schema: {
    type: "object",
    properties: {
      blog: {
        type: "string",
        description:
          "A complete blog article, 3-5 paragraphs, with a headline as the first line.",
      },
      linkedin: {
        type: "string",
        description:
          "A LinkedIn post: professional tone, 2-4 short paragraphs, no hashtag spam.",
      },
      x: {
        type: "string",
        description:
          "A single X/Twitter post, under 280 characters, punchy, no corporate throat-clearing.",
      },
    },
    required: ["blog", "linkedin", "x"],
  },
};

// Groups APPROVED knowledge by type rather than dumping the whole table in —
// still not real relevance-ranked retrieval (that's overkill for the record
// counts a single-brand knowledge base actually has), but it keeps
// prohibited claims/terms visually and structurally impossible to miss.
function buildSystemPrompt(knowledge: KnowledgeRecord[]): string {
  const base =
    "You are a marketing copywriter. Genuinely adapt tone, length, and structure per channel — never reuse the same copy across formats. No corporate-jargon filler.";

  if (knowledge.length === 0) return base;

  const byType = new Map<string, KnowledgeRecord[]>();
  for (const record of knowledge) {
    const list = byType.get(record.type) ?? [];
    list.push(record);
    byType.set(record.type, list);
  }

  const sections: string[] = [];
  for (const [type, records] of byType) {
    const isProhibitive = PROHIBITIVE_TYPES.includes(
      type as (typeof PROHIBITIVE_TYPES)[number],
    );
    const heading = isProhibitive
      ? `NEVER use or imply (${KNOWLEDGE_TYPE_LABELS[type as keyof typeof KNOWLEDGE_TYPE_LABELS]})`
      : KNOWLEDGE_TYPE_LABELS[type as keyof typeof KNOWLEDGE_TYPE_LABELS];
    sections.push(
      `${heading}:\n${records.map((r) => `- ${r.title}: ${r.content}`).join("\n")}`,
    );
  }

  return `${base}\n\nOrganizational knowledge to follow exactly:\n\n${sections.join("\n\n")}`;
}

export async function generateContentPackage(
  brief: RequestBrief,
  knowledge: KnowledgeRecord[] = [],
): Promise<ContentPackage> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add your own key to .env to enable content generation.",
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: buildSystemPrompt(knowledge),
    tools: [GENERATE_TOOL],
    tool_choice: { type: "tool", name: "generate_content_package" },
    messages: [
      {
        role: "user",
        content: `Marketing request brief:\nType: ${brief.type}\nTitle: ${brief.title}\nDepartment: ${brief.department ?? "n/a"}\nDescription: ${brief.description ?? "n/a"}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Couldn't generate content for that request — try again.");
  }

  return toolUse.input as ContentPackage;
}

const COMPLIANCE_TOOL: Anthropic.Tool = {
  name: "report_compliance",
  description:
    "Report whether generated marketing copy violates any prohibited claim or term.",
  input_schema: {
    type: "object",
    properties: {
      clean: {
        type: "boolean",
        description: "true only if none of the prohibited rules are violated anywhere",
      },
      violations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            channel: { type: "string", description: "blog, linkedin, or x" },
            rule: { type: "string", description: "which prohibited rule was violated" },
            quote: { type: "string", description: "the exact offending text" },
          },
          required: ["channel", "rule", "quote"],
        },
      },
    },
    required: ["clean", "violations"],
  },
};

export type ComplianceResult = {
  clean: boolean;
  violations: Array<{ channel: string; rule: string; quote: string }>;
};

// A genuinely separate second call rather than asking the same generation
// call to self-grade — self-verification in the same turn is weak; an
// independent pass with the explicit job of trying to find a violation is
// the point (mirrors "adversarial verify" — don't just trust the writer to
// notice its own mistake).
export async function checkCompliance(
  content: ContentPackage,
  prohibitedRecords: KnowledgeRecord[],
): Promise<ComplianceResult> {
  if (prohibitedRecords.length === 0) {
    return { clean: true, violations: [] };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add your own key to .env to enable the compliance check.",
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const rules = prohibitedRecords.map((r) => `- ${r.title}: ${r.content}`).join("\n");
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    system:
      "You are a compliance reviewer. Your only job is to find violations of the rules below in the given marketing copy. Default to reporting a violation if text is ambiguous — false positives are far cheaper than a missed violation.",
    tools: [COMPLIANCE_TOOL],
    tool_choice: { type: "tool", name: "report_compliance" },
    messages: [
      {
        role: "user",
        content: `Prohibited rules:\n${rules}\n\nContent to review:\n\nBLOG:\n${content.blog}\n\nLINKEDIN:\n${content.linkedin}\n\nX:\n${content.x}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    // Fail closed: if the checker itself didn't return a usable result,
    // treat it as a violation requiring human review rather than silently
    // passing it through clean.
    return {
      clean: false,
      violations: [{ channel: "all", rule: "compliance check failed to run", quote: "" }],
    };
  }

  return toolUse.input as ComplianceResult;
}
