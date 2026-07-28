import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listBrands } from "@/lib/brands";
import { NEUTRAL_BADGE_CLASS, ideaStatusBadgeClass } from "@/lib/badges";
import {
  createIdeaAction,
  setIdeaStatusAction,
  promoteIdeaAction,
  createProjectAction,
} from "./actions";

const IDEA_STATUS_LABELS: Record<string, string> = {
  CAPTURED: "Captured",
  DEVELOPING: "Developing",
  PROMOTED: "Promoted",
  ARCHIVED: "Archived",
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand: brandFilter } = await searchParams;
  const brands = await listBrands();
  const activeBrand = brandFilter ? brands.find((b) => b.key === brandFilter) : undefined;
  const defaultBrandKey = activeBrand?.key ?? brands.find((b) => b.isDefault)?.key ?? "";

  const [ideas, projects] = await Promise.all([
    prisma.idea.findMany({
      where: activeBrand ? { brandId: activeBrand.id } : {},
      include: {
        brand: true,
        contentProjects: { include: { contentProject: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contentProject.findMany({
      where: activeBrand ? { brandId: activeBrand.id } : {},
      include: { brand: true, drafts: true, ideas: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Creator Studio</h1>
        <p className="max-w-2xl text-sm text-[var(--slate)]">
          Idea → project → draft, no marketing request required. Capture a
          thought here, promote it into a project when it&apos;s ready, then
          draft, edit, approve, and publish through the same calendar and
          publishing controls Noticed already has.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/studio"
          className={`rounded-full px-3 py-1 ${!activeBrand ? "bg-[var(--accent)] text-white" : NEUTRAL_BADGE_CLASS}`}
        >
          All brands
        </Link>
        {brands.map((b) => (
          <Link
            key={b.key}
            href={`/studio?brand=${b.key}`}
            className={`rounded-full px-3 py-1 ${activeBrand?.key === b.key ? "bg-[var(--accent)] text-white" : NEUTRAL_BADGE_CLASS}`}
          >
            {b.name}
          </Link>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate)]">
          Capture an idea
        </h2>
        <form
          action={createIdeaAction}
          className="flex flex-col gap-3 rounded-lg border border-[var(--card-border)] bg-white p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Brand</span>
              <select
                name="brandKey"
                required
                defaultValue={defaultBrandKey}
                className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
              >
                {brands.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Working title (optional)</span>
              <input
                name="workingTitle"
                placeholder="A few words to remember it by"
                className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">The thought itself</span>
            <textarea
              name="content"
              required
              rows={3}
              placeholder="Fragment, quote, observation, question — whatever it is right now"
              className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Capture idea
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate)]">
          Ideas ({ideas.length})
        </h2>
        <div className="flex flex-col gap-3">
          {ideas.map((idea) => {
            const setStatus = setIdeaStatusAction.bind(null, idea.id);
            const promote = promoteIdeaAction.bind(null, idea.id);
            const brandProjects = projects.filter((p) => p.brandId === idea.brandId);
            const linkedProjects = idea.contentProjects.map((link) => link.contentProject);
            return (
              <div
                key={idea.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--card-border)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-[var(--ink)]">{idea.content}</p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${ideaStatusBadgeClass(idea.status)}`}
                  >
                    {IDEA_STATUS_LABELS[idea.status]}
                  </span>
                </div>
                <p className="text-xs text-[var(--slate)]">
                  {idea.brand.name}
                  {idea.source ? ` · ${idea.source}` : ""}
                </p>

                {linkedProjects.length > 0 && (
                  <p className="text-xs text-[var(--slate)]">
                    In:{" "}
                    {linkedProjects.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ", "}
                        <Link href={`/studio/projects/${p.id}`} className="underline">
                          {p.title}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--card-border)] pt-2">
                  <form action={setStatus} className="flex items-center gap-1">
                    <select
                      key={idea.status}
                      name="status"
                      defaultValue={idea.status}
                      className="rounded border border-[var(--card-border)] px-2 py-1 text-xs"
                    >
                      <option value="CAPTURED">Captured</option>
                      <option value="DEVELOPING">Developing</option>
                      <option value="PROMOTED">Promoted</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded border border-[var(--card-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--blue-frost)]"
                    >
                      Save status
                    </button>
                  </form>
                </div>

                <form
                  action={promote}
                  className="flex flex-wrap items-end gap-2 border-t border-[var(--card-border)] pt-2 text-xs"
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-[var(--slate)]">Promote into</span>
                    {brandProjects.length > 0 ? (
                      <select
                        name="contentProjectId"
                        className="rounded border border-[var(--card-border)] px-2 py-1"
                      >
                        <option value="">— new project —</option>
                        {brandProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input type="hidden" name="contentProjectId" value="" />
                    )}
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[var(--slate)]">Or new project title</span>
                    <input
                      name="projectTitle"
                      placeholder={idea.content.slice(0, 40)}
                      className="rounded border border-[var(--card-border)] px-2 py-1"
                    />
                  </label>
                  <button
                    type="submit"
                    name="mode"
                    value="new"
                    className="rounded bg-[var(--accent)] px-3 py-1.5 font-medium text-white hover:bg-[var(--accent-hover)]"
                  >
                    Promote to new project
                  </button>
                  {brandProjects.length > 0 && (
                    <button
                      type="submit"
                      name="mode"
                      value="existing"
                      className="rounded border border-[var(--card-border)] px-3 py-1.5 font-medium hover:bg-[var(--blue-frost)]"
                    >
                      Promote to selected project
                    </button>
                  )}
                </form>
              </div>
            );
          })}
          {ideas.length === 0 && (
            <p className="text-sm text-[var(--slate)]">
              No ideas captured yet — start above.
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate)]">
          Projects ({projects.length})
        </h2>

        <form
          action={createProjectAction}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--card-border)] bg-white p-3 text-sm"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--slate)]">Brand</span>
            <select
              name="brandKey"
              required
              defaultValue={defaultBrandKey}
              className="rounded border border-[var(--card-border)] px-2 py-1.5"
            >
              {brands.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 min-w-[200px] flex-col gap-1">
            <span className="text-xs text-[var(--slate)]">Title</span>
            <input
              name="title"
              required
              placeholder="Start a project directly, without an idea first"
              className="rounded border border-[var(--card-border)] px-2 py-1.5"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-[var(--accent)] px-3 py-1.5 font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            New project
          </button>
        </form>

        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/studio/projects/${project.id}`}
              className="flex flex-col gap-1 rounded-lg border border-[var(--card-border)] bg-white p-4 hover:border-[var(--accent)]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{project.title}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${NEUTRAL_BADGE_CLASS}`}>
                  {project.status}
                </span>
              </div>
              <p className="text-xs text-[var(--slate)]">
                {project.brand.name} · {project.ideas.length} idea
                {project.ideas.length === 1 ? "" : "s"} · {project.drafts.length} draft
                {project.drafts.length === 1 ? "" : "s"}
              </p>
              {project.premise && (
                <p className="text-xs text-[var(--slate)]">{project.premise}</p>
              )}
            </Link>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-[var(--slate)]">No projects yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
