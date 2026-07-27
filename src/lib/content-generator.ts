import Anthropic from "@anthropic-ai/sdk";

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

// No persistent brand-voice memory yet (that's area 4 in the product spec,
// not built) — each call is grounded only in the request's own brief, with
// generic-but-firm instructions against reusing one caption across channels.
export async function generateContentPackage(
  brief: RequestBrief,
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
    system:
      "You are a marketing copywriter. Genuinely adapt tone, length, and structure per channel — never reuse the same copy across formats. No corporate-jargon filler.",
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
