export default function Home() {
  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-white p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Cobalt<span style={{ color: "var(--lime)" }}>+Lime</span>
      </h1>
      <p className="mt-3 max-w-xl text-zinc-600">
        Marketing operations, run as a spine — request in, brief out,
        published and verified. Scaffold only: no data model yet.
      </p>
    </div>
  );
}
