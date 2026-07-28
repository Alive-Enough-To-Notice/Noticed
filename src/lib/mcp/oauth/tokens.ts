import { prisma } from "@/lib/prisma";
import {
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  MCP_AUTH_CODE_TTL_SECONDS,
  MCP_DEFAULT_SCOPES,
  MCP_OWNER_SUBJECT,
  MCP_REFRESH_TOKEN_TTL_SECONDS,
  expandMcpScopes,
  parseJsonStringArray,
  stringifyJsonStringArray,
} from "@/lib/mcp/oauth/config";
import {
  generateClientId,
  generateOpaqueToken,
  sha256Hex,
  verifyPkceS256,
} from "@/lib/mcp/oauth/crypto";

export async function registerPublicMcpClient(input: {
  clientName?: string;
  redirectUris: string[];
}) {
  const redirectUris = input.redirectUris.map((u) => u.trim()).filter(Boolean);
  if (redirectUris.length === 0) {
    throw new Error("redirect_uris required");
  }
  for (const uri of redirectUris) {
    try {
      // eslint-disable-next-line no-new
      new URL(uri);
    } catch {
      throw new Error(`Invalid redirect_uri: ${uri}`);
    }
  }

  const clientId = generateClientId();
  await prisma.mcpOAuthClient.create({
    data: {
      clientId,
      clientSecretHash: null,
      clientName: input.clientName?.trim() || "MCP client",
      redirectUris: stringifyJsonStringArray(redirectUris),
      tokenEndpointAuthMethod: "none",
    },
  });

  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    token_endpoint_auth_method: "none",
    redirect_uris: redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    code_challenge_methods_supported: ["S256"],
  };
}

export async function createAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes?: string[];
}) {
  const client = await prisma.mcpOAuthClient.findUnique({
    where: { clientId: input.clientId },
  });
  if (!client) throw new Error("Unknown client_id");
  const uris = parseJsonStringArray(client.redirectUris);
  if (!uris.includes(input.redirectUri)) {
    throw new Error("redirect_uri not registered for client");
  }

  const code = generateOpaqueToken(32);
  const expiresAt = new Date(Date.now() + MCP_AUTH_CODE_TTL_SECONDS * 1000);
  await prisma.mcpOAuthAuthorizationCode.create({
    data: {
      codeHash: sha256Hex(code),
      clientId: input.clientId,
      userId: MCP_OWNER_SUBJECT,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: "S256",
      scopes: stringifyJsonStringArray(expandMcpScopes(input.scopes)),
      expiresAt,
    },
  });
  return code;
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  const codeHash = sha256Hex(input.code);
  const row = await prisma.mcpOAuthAuthorizationCode.findUnique({
    where: { codeHash },
  });
  if (!row || row.usedAt) throw new Error("Invalid authorization code");
  if (row.clientId !== input.clientId) throw new Error("client_id mismatch");
  if (row.redirectUri !== input.redirectUri) throw new Error("redirect_uri mismatch");
  if (row.expiresAt.getTime() <= Date.now()) throw new Error("Authorization code expired");
  if (!verifyPkceS256(input.codeVerifier, row.codeChallenge)) {
    throw new Error("PKCE verification failed");
  }

  await prisma.mcpOAuthAuthorizationCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return issueTokenPair({
    clientId: input.clientId,
    scopes: parseJsonStringArray(row.scopes),
  });
}

export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
}) {
  const hash = sha256Hex(input.refreshToken);
  const row = await prisma.mcpOAuthRefreshToken.findUnique({
    where: { tokenHash: hash },
  });
  if (!row || row.revokedAt) throw new Error("Invalid refresh token");
  if (row.clientId !== input.clientId) throw new Error("client_id mismatch");
  if (row.expiresAt.getTime() <= Date.now()) throw new Error("Refresh token expired");

  await prisma.mcpOAuthRefreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });

  return issueTokenPair({
    clientId: input.clientId,
    scopes: parseJsonStringArray(row.scopes),
  });
}

async function issueTokenPair(input: { clientId: string; scopes: string[] }) {
  const scopes =
    input.scopes.length > 0 ? input.scopes : [...MCP_DEFAULT_SCOPES];
  const accessToken = generateOpaqueToken(32);
  const refreshToken = generateOpaqueToken(32);
  const accessExpires = new Date(Date.now() + MCP_ACCESS_TOKEN_TTL_SECONDS * 1000);
  const refreshExpires = new Date(Date.now() + MCP_REFRESH_TOKEN_TTL_SECONDS * 1000);

  const accessRow = await prisma.mcpOAuthAccessToken.create({
    data: {
      tokenHash: sha256Hex(accessToken),
      clientId: input.clientId,
      userId: MCP_OWNER_SUBJECT,
      scopes: stringifyJsonStringArray(scopes),
      expiresAt: accessExpires,
    },
  });

  await prisma.mcpOAuthRefreshToken.create({
    data: {
      tokenHash: sha256Hex(refreshToken),
      accessTokenId: accessRow.id,
      clientId: input.clientId,
      userId: MCP_OWNER_SUBJECT,
      scopes: stringifyJsonStringArray(scopes),
      expiresAt: refreshExpires,
    },
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
    scope: scopes.join(" "),
  };
}

export async function revokeToken(token: string) {
  const hash = sha256Hex(token);
  const now = new Date();
  await prisma.mcpOAuthAccessToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: now },
  });
  await prisma.mcpOAuthRefreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: now },
  });
}

export type VerifiedMcpBearer = {
  userId: string;
  clientId: string;
  scopes: string[];
};

export async function verifyMcpAccessToken(
  bearerToken: string,
): Promise<VerifiedMcpBearer | null> {
  const hash = sha256Hex(bearerToken);
  const row = await prisma.mcpOAuthAccessToken.findUnique({
    where: { tokenHash: hash },
  });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.userId !== MCP_OWNER_SUBJECT) return null;

  return {
    userId: row.userId,
    clientId: row.clientId,
    scopes: parseJsonStringArray(row.scopes),
  };
}
