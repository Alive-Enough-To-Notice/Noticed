import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noticed",
  description: "Marketing operations, run as a request-to-delivery spine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--card-border)] bg-[var(--canvas)]">
          <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo-mark.png"
                alt=""
                width={40}
                height={32}
                className="h-8 w-auto"
                priority
              />
              <span
                className="text-lg font-semibold tracking-tight"
                style={{ color: "var(--midnight)" }}
              >
                Noticed
              </span>
            </Link>
            <nav className="flex gap-4 text-sm text-[var(--slate)]">
              <Link href="/" className="hover:text-[var(--accent)]">
                Workbench
              </Link>
              <Link href="/requests/new" className="hover:text-[var(--accent)]">
                New request
              </Link>
              <Link href="/brand" className="hover:text-[var(--accent)]">
                Brand
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
