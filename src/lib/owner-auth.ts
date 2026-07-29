import { createHmac, timingSafeEqual } from "node:crypto";
import { safeEqualString } from "@/lib/mcp/oauth/crypto";

export const OWNER_SESSION_COOKIE = "noticed_owner_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  return (
    process.env.NOTICED_SESSION_SECRET?.trim() ||
    process.env.NOTICED_OWNER_PASSWORD?.trim() ||
    "noticed-dev-session"
  );
}

/**
 * Hosted instances must always be gated. Local development may opt out by
 * leaving the password unset, but production never fails open.
 */
export function ownerGateEnabled(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.NOTICED_OWNER_PASSWORD?.trim());
}

export function ownerAuthConfigured(): boolean {
  return Boolean(
    process.env.NOTICED_OWNER_PASSWORD?.trim() &&
      process.env.NOTICED_SESSION_SECRET?.trim(),
  );
}

export function verifyOwnerPassword(password: string): boolean {
  const expected = process.env.NOTICED_OWNER_PASSWORD?.trim();
  if (!expected) return false;
  return safeEqualString(password, expected);
}

export function createOwnerSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `owner.${exp}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOwnerSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [subject, expStr, sig] = parts;
  if (subject !== "owner") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  const payload = `${subject}.${expStr}`;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
