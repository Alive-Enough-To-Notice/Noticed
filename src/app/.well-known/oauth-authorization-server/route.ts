import {
  MCP_SCOPES_SUPPORTED,
  mcpPublicOrigin,
} from "@/lib/mcp/oauth/config";

/** RFC 8414 Authorization Server Metadata */
export function GET() {
  const issuer = mcpPublicOrigin();
  const body = {
    issuer,
    authorization_endpoint: `${issuer}/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    revocation_endpoint: `${issuer}/api/mcp/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...MCP_SCOPES_SUPPORTED],
    service_documentation: `${issuer}/docs/chatgpt-mcp`,
  };
  return Response.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
