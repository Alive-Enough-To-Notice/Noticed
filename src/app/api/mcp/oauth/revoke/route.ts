import { revokeToken } from "@/lib/mcp/oauth/tokens";

export const runtime = "nodejs";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let token: string | null = null;
  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as { token?: string };
      token = json.token?.trim() || null;
    } else {
      const text = await request.text();
      token = new URLSearchParams(text).get("token")?.trim() || null;
    }
  } catch {
    return Response.json(
      { error: "invalid_request", error_description: "Could not parse body" },
      { status: 400, headers: corsHeaders() },
    );
  }

  if (!token) {
    return Response.json(
      { error: "invalid_request", error_description: "token required" },
      { status: 400, headers: corsHeaders() },
    );
  }

  await revokeToken(token);
  return new Response(null, { status: 200, headers: corsHeaders() });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
