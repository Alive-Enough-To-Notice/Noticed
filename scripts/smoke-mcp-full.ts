import { createHash, randomBytes } from "node:crypto";
import {
  registerPublicMcpClient,
  createAuthorizationCode,
  exchangeAuthorizationCode,
  verifyMcpAccessToken,
} from "../src/lib/mcp/oauth/tokens";

function b64url(buf: Buffer) {
  return buf.toString("base64url");
}

async function main() {
  const origin = (process.env.ORIGIN || "http://localhost:3004").replace(/\/$/, "");
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const redirectUri = "http://127.0.0.1/callback";

  const reg = await registerPublicMcpClient({
    clientName: "full-smoke",
    redirectUris: [redirectUri],
  });
  const code = await createAuthorizationCode({
    clientId: reg.client_id,
    redirectUri,
    codeChallenge: challenge,
  });
  const tokens = await exchangeAuthorizationCode({
    code,
    clientId: reg.client_id,
    redirectUri,
    codeVerifier: verifier,
  });
  const verified = await verifyMcpAccessToken(tokens.access_token);
  console.log("token ok:", Boolean(verified), "scopes:", verified?.scopes);

  const init = await fetch(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${tokens.access_token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "smoke", version: "0.0.1" },
      },
    }),
  });
  console.log("initialize status:", init.status);
  console.log((await init.text()).slice(0, 1000));

  const sessionId = init.headers.get("mcp-session-id");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${tokens.access_token}`,
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const list = await fetch(`${origin}/api/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });
  console.log("tools/list status:", list.status);
  const listText = await list.text();
  console.log(listText.slice(0, 2000));
  const names = [
    "search_content",
    "get_brand_context",
    "create_content_draft",
    "update_draft",
    "get_calendar",
  ];
  for (const n of names) {
    if (!listText.includes(n)) throw new Error(`missing tool: ${n}`);
  }
  console.log("All five tools present.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
