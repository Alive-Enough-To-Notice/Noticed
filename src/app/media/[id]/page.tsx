import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AccessibleMediaEditor } from "./AccessibleMediaEditor";

export default async function MediaProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const project = await prisma.contentProject.findUnique({
    where: { id },
    include: {
      brand: true,
      recordings: {
        include: { editDecisions: { orderBy: { createdAt: "asc" } }, exports: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();
  const defaultKind = query.kind === "podcast" ? "AUDIO" : "VIDEO";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <Link href="/media" className="text-sm underline">← Media Studio</Link>
        <p className="mt-3 text-sm text-[var(--slate)]">{project.brand.name}</p>
        <h1 className="text-3xl font-semibold">{project.title}</h1>
      </header>
      <AccessibleMediaEditor projectId={project.id} initialKind={defaultKind} initialRecordings={project.recordings.map((recording) => ({
        ...recording,
        createdAt: recording.createdAt.toISOString(),
        updatedAt: recording.updatedAt.toISOString(),
        editDecisions: recording.editDecisions.map((decision) => ({ ...decision, createdAt: decision.createdAt.toISOString(), updatedAt: decision.updatedAt.toISOString() })),
        exports: recording.exports.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
      }))} />
    </div>
  );
}
