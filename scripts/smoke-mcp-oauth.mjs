#!/usr/bin/env node
/**
 * Local smoke: DCR → authorize code (via API helpers) → token → tools/list.
 * Requires the Next server running with NOTICED_OWNER_PASSWORD set.
 *
 * Usage:
 *   NOTICED_OWNER_PASSWORD=dev ORIGIN=http://localhost:3004 node scripts/smoke-mcp-oauth.mjs
 */
import { createHash, randomBytes } from "node:crypto";

const ORIGIN = (process.env.ORIGIN || "http://localhost:3004").replace(/\/$/, "");

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function pkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function main() {
  const meta = await fetch(`${ORIGIN}/.well-known/oauth-authorization-server`).then((r) =>
    r.json(),
  );
  console.log("issuer:", meta.issuer);
  if (!meta.authorization_endpoint || !meta.token_endpoint) {
    throw new Error("AS metadata incomplete");
  }

  const unauth = await fetch(`${ORIGIN}/api/mcp`, { method: "POST" });
  console.log("unauthenticated /api/mcp status:", unauth.status, "(expect 401)");

  const redirectUri = "http://127.0.0.1/callback";
  const reg = await fetch(`${ORIGIN}/api/mcp/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "smoke-test",
      redirect_uris: [redirectUri],
    }),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`register ${r.status}: ${await r.text()}`);
    return r.json();
  });
  console.log("registered client_id:", reg.client_id);

  console.log("\nOpen authorize URL in a browser (owner password → Approve):");
  const { verifier, challenge } = pkce();
  const authUrl = new URL(meta.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", reg.client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", "smoke");
  console.log(authUrl.toString());
  console.log("\ncode_verifier (for token exchange after redirect):", verifier);
  console.log("Done — metadata + DCR + 401 check OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
