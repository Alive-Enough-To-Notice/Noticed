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

/** Gate is active when an owner password is configured (hosted / secured local). */
export function ownerGateEnabled(): boolean {
  return Boolean(process.env.NOTICED_OWNER_PASSWORD?.trim());
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
