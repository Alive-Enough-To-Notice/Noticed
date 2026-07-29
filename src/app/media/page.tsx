import Link from "next/link";
import { listBrands } from "@/lib/brands";
import { prisma } from "@/lib/prisma";
import { createMediaProjectAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MediaStudioPage() {
  const [brands, projects] = await Promise.all([
    listBrands(),
    prisma.contentProject.findMany({
      where: {
        OR: [
          { recordings: { some: {} } },
          { premise: { contains: "Accessible" } },
        ],
      },
      include: { brand: true, recordings: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const defaultBrand = brands.find((brand) => brand.isDefault)?.key ?? brands[0]?.key ?? "";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header>
        <p className="text-sm font-semibold text-[var(--accent)]">ACCESSIBLE MEDIA STUDIO</p>
        <h1 className="mt-1 text-3xl font-semibold">Talk first. Clean it up by reading.</h1>
        <p className="mt-2 max-w-2xl text-base text-[var(--slate)]">
          Record without trying to make a perfect take. Say “scratch, scratch, meow” when you restart. Your original is always preserved.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--card-border)] bg-white p-6">
        <h2 className="text-xl font-semibold">Start something</h2>
        <form action={createMediaProjectAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            What are you making?
            <select name="kind" className="rounded-lg border border-[var(--card-border)] px-4 py-3 text-base">
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Podcast or audio</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Brand
            <select name="brandKey" defaultValue={defaultBrand} className="rounded-lg border border-[var(--card-border)] px-4 py-3 text-base">
              {brands.map((brand) => <option key={brand.key} value={brand.key}>{brand.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Name this recording
            <input name="title" required placeholder="Techstars application video" className="rounded-lg border border-[var(--card-border)] px-4 py-3 text-base" />
          </label>
          <button className="min-h-12 justify-self-start rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-white">Open recording studio</button>
        </form>
      </section>

      {projects.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Continue where you left off</h2>
          <div className="mt-3 grid gap-3">
            {projects.map((project) => {
              const latest = project.recordings[0];
              return (
                <Link key={project.id} href={`/media/${project.id}`} className="rounded-lg border border-[var(--card-border)] bg-white p-4 hover:border-[var(--accent)]">
                  <span className="font-semibold">{project.title}</span>
                  <span className="ml-2 text-sm text-[var(--slate)]">
                    {project.brand.name} · {latest ? `${latest.mediaKind === "VIDEO" ? "Video" : "Audio"} · ${latest.status}` : "Ready to record"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
