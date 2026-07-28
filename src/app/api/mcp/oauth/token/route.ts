import {
  exchangeAuthorizationCode,
  refreshAccessToken,
} from "@/lib/mcp/oauth/tokens";

export const runtime = "nodejs";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function formError(error: string, description: string, status = 400) {
  return Response.json(
    { error, error_description: description },
    { status, headers: corsHeaders() },
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let params: URLSearchParams;
  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, string>;
      params = new URLSearchParams();
      for (const [k, v] of Object.entries(json)) {
        if (v != null) params.set(k, String(v));
      }
    } else {
      const text = await request.text();
      params = new URLSearchParams(text);
    }
  } catch {
    return formError("invalid_request", "Could not parse token request body");
  }

  const grantType = params.get("grant_type");
  const clientId = params.get("client_id")?.trim();
  if (!clientId) return formError("invalid_client", "client_id required");

  try {
    if (grantType === "authorization_code") {
      const code = params.get("code");
      const redirectUri = params.get("redirect_uri");
      const codeVerifier = params.get("code_verifier");
      if (!code || !redirectUri || !codeVerifier) {
        return formError(
          "invalid_request",
          "code, redirect_uri, and code_verifier are required",
        );
      }
      const tokens = await exchangeAuthorizationCode({
        code,
        clientId,
        redirectUri,
        codeVerifier,
      });
      return Response.json(tokens, { headers: corsHeaders() });
    }

    if (grantType === "refresh_token") {
      const refreshToken = params.get("refresh_token");
      if (!refreshToken) {
        return formError("invalid_request", "refresh_token required");
      }
      const tokens = await refreshAccessToken({
        refreshToken,
        clientId,
      });
      return Response.json(tokens, { headers: corsHeaders() });
    }

    return formError("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token exchange failed";
    return formError("invalid_grant", message);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
