import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function generateClientId(): string {
  return `mcp_${randomBytes(16).toString("hex")}`;
}

/** PKCE S256: BASE64URL(SHA256(code_verifier)) */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const digest = createHash("sha256").update(codeVerifier, "utf8").digest();
  const computed = digest.toString("base64url");
  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(codeChallenge);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function safeEqualString(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
