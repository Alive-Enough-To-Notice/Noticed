/** Public origin for MCP OAuth issuer / resource metadata. */
export function mcpPublicOrigin(): string {
  const explicit =
    process.env.NOTICED_PUBLIC_ORIGIN?.trim() ||
    process.env.MCP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      // fall through
    }
  }
  return "http://localhost:3004";
}

export const MCP_OWNER_SUBJECT = "owner";

export const MCP_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const MCP_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MCP_AUTH_CODE_TTL_SECONDS = 10 * 60;

export const MCP_SCOPES_SUPPORTED = [
  "mcp:content:read",
  "mcp:content:write",
] as const;

export const MCP_DEFAULT_SCOPES = [...MCP_SCOPES_SUPPORTED] as string[];

export function expandMcpScopes(requested?: string[] | null): string[] {
  const out = new Set<string>(
    requested && requested.length > 0 ? requested : MCP_DEFAULT_SCOPES,
  );
  for (const s of MCP_SCOPES_SUPPORTED) out.add(s);
  return [...out];
}

export function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function stringifyJsonStringArray(values: string[]): string {
  return JSON.stringify(values);
}
