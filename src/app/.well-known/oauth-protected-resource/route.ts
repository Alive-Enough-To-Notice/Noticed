import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { mcpPublicOrigin } from "@/lib/mcp/oauth/config";

const authServerUrl = mcpPublicOrigin();

const handler = protectedResourceHandler({
  authServerUrls: [authServerUrl],
  resourceUrl: `${authServerUrl}/api/mcp`,
});

export { handler as GET };

export const OPTIONS = metadataCorsOptionsRequestHandler();
