import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { mcpPublicOrigin } from "@/lib/mcp/oauth/config";
import { verifyMcpAccessToken } from "@/lib/mcp/oauth/tokens";
import { registerNoticedTools } from "@/mcp/register-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const mcpHandler = createMcpHandler(
  (server) => {
    registerNoticedTools(server);
  },
  {
    serverInfo: {
      name: "noticed",
      version: "0.2.0",
    },
  },
  {
    streamableHttpEndpoint: "/api/mcp",
    disableSse: true,
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

const authHandler = withMcpAuth(
  mcpHandler,
  async (_req, bearerToken): Promise<AuthInfo | undefined> => {
    if (!bearerToken) return undefined;
    const verified = await verifyMcpAccessToken(bearerToken);
    if (!verified) return undefined;
    return {
      token: bearerToken,
      clientId: verified.clientId,
      scopes: verified.scopes,
      extra: {
        userId: verified.userId,
      },
    };
  },
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
    resourceUrl: `${mcpPublicOrigin()}/api/mcp`,
  },
);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
