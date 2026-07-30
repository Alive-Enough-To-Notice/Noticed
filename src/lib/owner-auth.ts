import { createHmac, timingSafeEqual } from "node:crypto";
import { safeEqualString } from "@/lib/mcp/oauth/crypto";

export const OWNER_SESSION_COOKIE = "noticed_owner_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const secret = process.env.NOTICED_SESSION_SECRET?.trim();
  if (!secret) {
    // No fallback on purpose: a hardcoded default would be a public string
    // (this repo is public), which would let anyone forge a valid owner
    // session cookie. Callers must check ownerAuthLocked() first so this
    // is only ever reached when the gate is fully configured.
    throw new Error(
      "NOTICED_SESSION_SECRET is not set — owner sessions cannot be created or verified.",
    );
  }
  return secret;
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

export const OWNER_AUTH_LOCKED_MESSAGE =
  "Noticed is locked because owner authentication is not fully configured.";

/**
 * True whenever the owner gate should apply but NOTICED_OWNER_PASSWORD /
 * NOTICED_SESSION_SECRET aren't both set — covers a misconfigured
 * production deploy as well as a partially-configured local setup, so
 * every gate entry point (proxy, /login, /mcp/oauth/authorize) can check
 * this once instead of reaching sessionSecret() and throwing.
 */
export function ownerAuthLocked(): boolean {
  return ownerGateEnabled() && !ownerAuthConfigured();
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
