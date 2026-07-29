import "dotenv/config";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { validateWritingDraft } from "../src/lib/validation";

const SOURCE_URL = "https://www.infranet-hr.com/latch-story";

const source = `The latch was fixed four times. The pattern was never seen.

Machine 90 became a lesson in what happens when every team has the information—but no one has the whole operating picture.

An employee noticed a safety issue on Machine 90. Maintenance logged the work order, fixed the latch, and closed the request. A few weeks later, someone reported the same latch. Maintenance fixed it again. Then it happened again: same component, same machine, another complete repair record.

Four latch repairs were finally seen inside 12 maintenance requests. HR had the incident report. Maintenance had the work orders. Safety had the near-miss log. Each team was doing its job. Nothing was missing. The connection was missing.

InfraNet's build test: Can this help the right person see the pattern before the fourth repair?`;

const blog = `# The Latch Was Fixed Four Times. The Pattern Was Never Seen.

The first report did not look like a systems problem.

An employee noticed something wrong with the door latch on Machine 90. Maintenance received the work order, repaired the latch, and closed the request. The employee reported the concern. Maintenance responded. The record was complete.

A few weeks later, the same latch was reported again. A new work order entered the queue. The latch was repaired again. Then the sequence repeated.

Reported. Repaired. Closed. Repeated.

By the time the organization saw the larger pattern, four latch repairs were sitting inside 12 maintenance requests. Every individual record could look complete while the combined operating history told a different story.

## Nobody failed

That distinction matters.

Nobody hid information. Nobody ignored a work order. Nobody was negligent. HR had the incident report. Maintenance had the work orders. Safety had the near-miss log. Each team was doing its job inside the systems and responsibilities available to it.

The failure was not effort. It was visibility.

The information existed in three different operating worlds. Each function could see its own record, but no shared view connected the recurring repair, the employee event, the near miss, the timing, and the follow-up. Nothing was missing. The connection was missing.

## A closed task is not always a closed risk

Operational systems are often designed to answer a local question: Was this work order completed? Was this incident recorded? Was the follow-up assigned?

Those are necessary questions. They are not always sufficient.

When every new report enters as a separate job, recurrence can disappear. A completed repair can reduce the visible queue while the underlying pattern continues to grow. The organization may not recognize the pattern until recurrence, cost, or downtime makes it too expensive to overlook.

Machine 90 illustrates a broader problem in workplace operations. One employee event can cross HR, Safety, Maintenance, Risk, leave administration, workers' compensation, and return-to-work planning. Each team may hold a valid piece of the story. No single team necessarily owns the complete sequence.

## The operating questions that reveal a pattern

Organizations do not need every employee to become a data analyst. They need a reliable way for authorized people to see context across work that already exists.

For a recurring safety or employee event, useful questions include:

- Has this machine, location, component, or condition appeared before?
- Which teams created related records?
- What action was taken each time?
- Who owns the next step after the immediate task closes?
- Are timing, restrictions, leave, claims, or corrective actions connected to the same event?
- What remains open even though one team's task is complete?

Those questions move the organization from isolated records toward an operating history.

## What stronger handling looks like

Stronger handling does not require automating professional judgment away. It requires preserving enough context for the right person to exercise judgment earlier.

The employee event should remain connected to related work, owners, timing, decisions, and follow-up. A repair can be completed without erasing the recurrence signal. A near miss can remain visible alongside the maintenance record. A handoff can preserve what happened, what is waiting, and who is responsible next.

This is the operating principle behind InfraNet: keep the work between systems visible, ownable, and durable.

InfraNet is designed to connect employee events across HR, Safety, Operations, and outside partners without replacing the systems that already hold important records. It supports movement and context; authorized people remain responsible for decisions requiring interpretation, discretion, or legal judgment.

## The build test

Machine 90 gave InfraNet a practical test for every workflow:

Can this help the right person see the pattern before the fourth repair?

That question applies far beyond a machine latch. It applies when an injury becomes a claim, leave request, accommodation, investigation, restriction, and return-to-work plan. It applies whenever the work crosses teams and the operating picture is wider than any single record.

How many Machine 90 problems are invisible inside your organization right now?

Bring InfraNet one recurring issue, handoff, or employee event. We will map where the information lives, where ownership changes, and where the connection disappears.

[Schedule an Assessment](https://www.infranet-hr.com/get-started)`;

const linkedIn = `The latch was fixed four times. The pattern was never seen.

An employee reported a safety concern on Machine 90. Maintenance repaired the door latch and closed the work order.

Then the same latch was reported again. And again.

Each response was documented. Each repair was completed. By the time the larger pattern became visible, four latch repairs were sitting inside 12 maintenance requests.

Nobody failed.

HR had the incident report. Maintenance had the work orders. Safety had the near-miss log. Each team was doing its job.

Nothing was missing. The connection was missing.

That is the operating risk inside many workplace systems. A closed task can look complete while the pattern surrounding it remains open. One employee event may cross safety, maintenance, HR, leave, workers' compensation, restrictions, and return-to-work planning. Every team can hold a valid piece without anyone seeing the whole sequence.

The better question is not only, “Was this task completed?”

It is also:

• Has this condition appeared before?
• Which teams hold related records?
• What remains open after the immediate task closes?
• Who owns the next move?

InfraNet was shaped by a practical build test: Can this help the right person see the pattern before the fourth repair?

The goal is not to automate judgment away. It is to preserve enough context, timing, ownership, and evidence for authorized people to exercise judgment earlier.

How many Machine 90 problems are invisible inside your organization right now?

Read the full story: ${SOURCE_URL}`;

async function main() {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { key: "infranet" } });
  const checksum = createHash("sha256").update(source).digest("hex");
  let project = await prisma.contentProject.findFirst({
    where: { brandId: brand.id, title: "Machine 90: The Pattern No One Could See" },
  });
  if (!project) {
    project = await prisma.contentProject.create({
      data: {
        brandId: brand.id,
        title: "Machine 90: The Pattern No One Could See",
        premise: "Turn the locked Machine 90 founder-origin story into an InfraNet article and destination-specific adaptations.",
      },
    });
  }

  await prisma.contentSource.upsert({
    where: { contentProjectId_checksum: { contentProjectId: project.id, checksum } },
    create: { contentProjectId: project.id, type: "WEB_PAGE", title: "The Latch Story — locked Webflow source", sourceUrl: SOURCE_URL, body: source, checksum, locked: true },
    update: { title: "The Latch Story — locked Webflow source", sourceUrl: SOURCE_URL, body: source, locked: true },
  });

  const drafts = [
    { channel: "BLOG" as const, title: "The Latch Was Fixed Four Times. The Pattern Was Never Seen.", body: blog },
    { channel: "LINKEDIN" as const, title: "The Machine 90 Story", body: linkedIn },
  ];

  for (const item of drafts) {
    const issues = validateWritingDraft(item.body);
    const existing = await prisma.contentDraft.findFirst({ where: { contentProjectId: project.id, channel: item.channel } });
    if (existing) {
      await prisma.contentDraft.update({ where: { id: existing.id }, data: { title: item.title, body: item.body, complianceFlag: issues.length ? JSON.stringify(issues) : null, complianceCheckedAt: new Date(), status: "DRAFT", approvedAt: null, approvedBy: null } });
    } else {
      await prisma.contentDraft.create({ data: { contentProjectId: project.id, channel: item.channel, title: item.title, body: item.body, complianceFlag: issues.length ? JSON.stringify(issues) : null, complianceCheckedAt: new Date() } });
    }
  }

  const savedDrafts = await prisma.contentDraft.findMany({
    where: { contentProjectId: project.id },
  });
  const proposals = [
    {
      channel: "BLOG",
      destination: "WEBFLOW_BLOG",
      scheduledFor: new Date("2026-08-04T15:00:00.000Z"),
    },
    {
      channel: "LINKEDIN",
      destination: "LINKEDIN_ARTICLE_HANDOFF",
      scheduledFor: new Date("2026-08-05T14:00:00.000Z"),
    },
  ];
  for (const proposal of proposals) {
    const draft = savedDrafts.find((candidate) => candidate.channel === proposal.channel);
    if (!draft) continue;
    await prisma.scheduleEntry.upsert({
      where: {
        draftId_destination_scheduledFor: {
          draftId: draft.id,
          destination: proposal.destination,
          scheduledFor: proposal.scheduledFor,
        },
      },
      create: {
        draftId: draft.id,
        destination: proposal.destination,
        scheduledFor: proposal.scheduledFor,
        status: "PLANNED",
      },
      update: { status: "PLANNED" },
    });
  }

  console.log(project.id);
}

main().finally(() => prisma.$disconnect());
