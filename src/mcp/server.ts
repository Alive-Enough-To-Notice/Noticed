// Local stdio MCP — same five tools as the hosted Streamable HTTP endpoint.
// Run with `npm run mcp` (Claude Desktop / Cursor). ChatGPT uses /api/mcp.
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerNoticedTools } from "./register-tools";

const server = new McpServer({
  name: "noticed",
  version: "0.2.0",
});

registerNoticedTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Noticed MCP server failed to start:", error);
  process.exit(1);
});
