import { registerPublicMcpClient } from "@/lib/mcp/oauth/tokens";

export const runtime = "nodejs";

/** OAuth 2.0 Dynamic Client Registration (public PKCE clients). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      client_name?: string;
      redirect_uris?: string[];
    };
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
    const registered = await registerPublicMcpClient({
      clientName: body.client_name,
      redirectUris,
    });
    return Response.json(registered, {
      status: 201,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return Response.json(
      { error: "invalid_client_metadata", error_description: message },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    );
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
