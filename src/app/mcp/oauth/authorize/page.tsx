import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  MCP_DEFAULT_SCOPES,
  parseJsonStringArray,
} from "@/lib/mcp/oauth/config";
import { createAuthorizationCode } from "@/lib/mcp/oauth/tokens";
import {
  OWNER_SESSION_COOKIE,
  createOwnerSessionToken,
  ownerGateEnabled,
  verifyOwnerPassword,
  verifyOwnerSessionToken,
} from "@/lib/owner-auth";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function oauthQuery(sp: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "error" || k === "login_error") continue;
    const val = first(v);
    if (val) q.set(k, val);
  }
  return q;
}

export default async function McpOAuthAuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const clientId = first(sp.client_id).trim();
  const redirectUri = first(sp.redirect_uri).trim();
  const state = first(sp.state).trim();
  const codeChallenge = first(sp.code_challenge).trim();
  const codeChallengeMethod = first(sp.code_challenge_method).trim() || "S256";
  const scope = first(sp.scope).trim();
  const responseType = first(sp.response_type).trim() || "code";
  const errorMsg = first(sp.error);
  const loginError = first(sp.login_error);

  const jar = await cookies();
  const sessionOk =
    !ownerGateEnabled() ||
    verifyOwnerSessionToken(jar.get(OWNER_SESSION_COOKIE)?.value);

  const client = clientId
    ? await prisma.mcpOAuthClient.findUnique({ where: { clientId } })
    : null;
  const redirectUris = client ? parseJsonStringArray(client.redirectUris) : [];

  const canAuthorize =
    Boolean(client) &&
    sessionOk &&
    responseType === "code" &&
    codeChallengeMethod === "S256" &&
    codeChallenge.length > 0 &&
    redirectUris.includes(redirectUri);

  async function loginAction(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    if (!verifyOwnerPassword(password)) {
      const q = oauthQuery(sp);
      q.set("login_error", "Incorrect password");
      redirect(`/mcp/oauth/authorize?${q.toString()}`);
    }
    const cookieStore = await cookies();
    cookieStore.set(OWNER_SESSION_COOKIE, createOwnerSessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    redirect(`/mcp/oauth/authorize?${oauthQuery(sp).toString()}`);
  }

  async function approveAction() {
    "use server";
    const cookieStore = await cookies();
    if (
      ownerGateEnabled() &&
      !verifyOwnerSessionToken(cookieStore.get(OWNER_SESSION_COOKIE)?.value)
    ) {
      redirect(`/mcp/oauth/authorize?${oauthQuery(sp).toString()}`);
    }

    let code: string;
    try {
      code = await createAuthorizationCode({
        clientId,
        redirectUri,
        codeChallenge,
        scopes: scope ? scope.split(/\s+/).filter(Boolean) : [...MCP_DEFAULT_SCOPES],
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Authorization failed";
      const q = oauthQuery(sp);
      q.set("error", message);
      redirect(`/mcp/oauth/authorize?${q.toString()}`);
    }
    const dest = new URL(redirectUri);
    dest.searchParams.set("code", code);
    if (state) dest.searchParams.set("state", state);
    redirect(dest.toString());
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Connect ChatGPT to Noticed
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Grants this client access to Noticed draft tools (search, brand context,
        create/update drafts, calendar). Publishing still happens in the Studio UI.
      </p>

      {errorMsg ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMsg}
        </p>
      ) : null}

      {!client ? (
        <p className="mt-6 text-sm text-zinc-700">
          Unknown or missing <code className="text-xs">client_id</code>. Start the
          connection from ChatGPT so it can register itself.
        </p>
      ) : !sessionOk ? (
        <form action={loginAction} className="mt-6 space-y-4">
          <p className="text-sm text-zinc-700">
            Sign in as the Noticed owner to approve{" "}
            <strong>{client.clientName || client.clientId}</strong>.
          </p>
          {loginError ? (
            <p className="text-sm text-red-700">{loginError}</p>
          ) : null}
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">Owner password</span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Continue
          </button>
        </form>
      ) : !canAuthorize ? (
        <p className="mt-6 text-sm text-zinc-700">
          This authorization request is invalid (redirect URI, PKCE challenge, or
          response type). Retry from ChatGPT.
        </p>
      ) : (
        <form action={approveAction} className="mt-6 space-y-4">
          <p className="text-sm text-zinc-700">
            Approve access for <strong>{client.clientName || client.clientId}</strong>?
          </p>
          <ul className="list-inside list-disc text-sm text-zinc-600">
            <li>Redirect: {redirectUri}</li>
            <li>Scopes: {scope || MCP_DEFAULT_SCOPES.join(" ")}</li>
          </ul>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Approve
          </button>
        </form>
      )}
    </main>
  );
}
