import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OWNER_AUTH_LOCKED_MESSAGE,
  OWNER_SESSION_COOKIE,
  createOwnerSessionToken,
  ownerAuthLocked,
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const next = first(sp.next) || "/studio";
  const error = first(sp.error);
  const jar = await cookies();
  const locked = ownerAuthLocked();

  if (
    !locked &&
    (!ownerGateEnabled() ||
      verifyOwnerSessionToken(jar.get(OWNER_SESSION_COOKIE)?.value))
  ) {
    redirect(next.startsWith("/") ? next : "/studio");
  }

  async function loginAction(formData: FormData) {
    "use server";
    if (ownerAuthLocked()) {
      redirect(
        `/login?error=${encodeURIComponent(OWNER_AUTH_LOCKED_MESSAGE)}&next=${encodeURIComponent(String(formData.get("next") ?? "/studio"))}`,
      );
    }
    const password = String(formData.get("password") ?? "");
    const dest = String(formData.get("next") ?? "/studio");
    if (!verifyOwnerPassword(password)) {
      redirect(
        `/login?error=${encodeURIComponent("Incorrect password")}&next=${encodeURIComponent(dest)}`,
      );
    }
    const cookieStore = await cookies();
    cookieStore.set(OWNER_SESSION_COOKIE, createOwnerSessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    redirect(dest.startsWith("/") ? dest : "/studio");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Noticed
      </h1>
      <p className="mt-2 text-sm text-zinc-600">Owner sign-in</p>
      {error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : null}
      {locked ? (
        <p className="mt-4 text-sm text-red-700">{OWNER_AUTH_LOCKED_MESSAGE}</p>
      ) : (
        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">Password</span>
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
            className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Sign in
          </button>
        </form>
      )}
    </main>
  );
}
