import { prisma } from "@/lib/prisma";
import { saveBrandProfile } from "./actions";

export default async function BrandPage() {
  const brand = await prisma.brandProfile.findUnique({ where: { id: "brand" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Brand memory</h1>
        <p className="text-sm text-[var(--slate)]">
          This grounds content generation — everything you save here feeds
          the prompt every time someone generates a draft package from a
          request. Colors, logos, and typography already live in code; this
          is just the voice.
        </p>
      </div>

      <form
        action={saveBrandProfile}
        className="flex flex-col gap-4 rounded-lg border border-[var(--card-border)] bg-white p-6"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Voice</span>
          <textarea
            key={brand?.voice}
            name="voice"
            rows={3}
            defaultValue={brand?.voice ?? ""}
            placeholder="Direct, a little dry, no corporate throat-clearing. Short sentences over long ones."
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Audiences</span>
          <textarea
            key={brand?.audiences}
            name="audiences"
            rows={2}
            defaultValue={brand?.audiences ?? ""}
            placeholder="Who is this actually written for?"
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Positioning</span>
          <textarea
            key={brand?.positioning}
            name="positioning"
            rows={2}
            defaultValue={brand?.positioning ?? ""}
            placeholder="How do we want to be perceived, relative to alternatives?"
            className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Approved language</span>
            <textarea
              key={brand?.approvedLanguage}
              name="approvedLanguage"
              rows={3}
              defaultValue={brand?.approvedLanguage ?? ""}
              placeholder="Words/phrases we want used"
              className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Prohibited language</span>
            <textarea
              key={brand?.prohibitedLanguage}
              name="prohibitedLanguage"
              rows={3}
              defaultValue={brand?.prohibitedLanguage ?? ""}
              placeholder="Words/phrases to avoid"
              className="rounded border border-[var(--card-border)] px-3 py-2 text-sm"
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-2 self-start rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          Save
        </button>
      </form>
    </div>
  );
}
