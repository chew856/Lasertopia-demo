import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FlowLayout, FlowSection, PageShell } from "@/components/ui";
import { global, party } from "@/lib/copy";

import { DetailsForm } from "../../_components/details-form";
import { FlowStepHeader, SummaryRail } from "../../_components/flow-chrome";
import { HoldGate } from "../../_components/hold-gate";
import { loadDraftView } from "../../_lib/draft-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${party.p5.title} — ${global.venueName}`,
};

/** Screen P5 — who is organising, and who the birthday guest of honour is. */
export default async function DetailsPage(props: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await props.params;
  const view = await loadDraftView(draftId);
  if (!view) notFound();

  const { draft, summary } = view;

  return (
    <PageShell as="main" width="page" className="py-8 md:py-12">
      <FlowSection>
        <FlowStepHeader step={5} title={party.p5.heading} />
      </FlowSection>

      <FlowSection>
        <HoldGate view={view} />
      </FlowSection>

      <FlowLayout rail={summary ? <SummaryRail model={summary} /> : undefined}>
        <DetailsForm
          draftId={draft.id}
          defaults={{
            customerName: draft.customerName,
            customerPhone: draft.customerPhone,
            customerEmail: draft.customerEmail,
            honoreeName: draft.honoreeName,
            notes: draft.notes,
          }}
        />
      </FlowLayout>
    </PageShell>
  );
}
