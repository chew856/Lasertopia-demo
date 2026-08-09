import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  Caption,
  Eyebrow,
  FlowLayout,
  FlowSection,
  MEASURE_BODY,
  MonoValue,
  PageShell,
  cx,
} from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { formatDateShort, formatMoney, formatTimeRange } from "@/lib/format";

import { DepositForm } from "../../_components/deposit-form";
import { FlowStepHeader, SummaryRail } from "../../_components/flow-chrome";
import { HoldGate } from "../../_components/hold-gate";
import { loadDraftView } from "../../_lib/draft-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${party.p7.title} — ${global.venueName}`,
};

/**
 * Screen P7 — the deposit.
 *
 * One line saying what is being paid for, one field, one button, and the "no card details are
 * collected" notice stated plainly rather than buried. A booking that already has its deposit
 * skips straight to the confirmation, which is what makes a refresh safe.
 */
export default async function DepositPage(props: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await props.params;
  const view = await loadDraftView(draftId);
  if (!view || !view.summary) notFound();

  const { draft, config, window, summary } = view;
  if (draft.deposit) redirect(`/parties/booking/${draft.reference}`);

  const deposit = formatMoney(config.depositAmountCents);
  const windowLabel = window ? formatTimeRange(window.startMinutes, window.endMinutes) : "";

  return (
    <PageShell as="main" width="page" className="py-8 md:py-12">
      <FlowSection>
        <FlowStepHeader step={7} title={party.p7.heading} />
      </FlowSection>

      <FlowSection>
        <HoldGate view={view} />
      </FlowSection>

      <FlowLayout rail={<SummaryRail model={summary} />}>
        <div className="flex flex-col gap-8">
          <section
            aria-label={party.p7.heading}
            className="border border-rule bg-raised p-4 md:p-6"
          >
            <MonoValue step="xl" as="p">
              {deposit}
            </MonoValue>
            <p className={cx("mt-3 text-body-sm text-text-2", MEASURE_BODY)}>
              {interpolate(party.p7.lineItem, {
                deposit,
                honoree: draft.honoreeName,
                dateShort: formatDateShort(draft.date),
                window: windowLabel,
              })}
            </p>
          </section>

          <section aria-label={party.p7.notice.heading}>
            <Eyebrow as="h2">{party.p7.notice.heading}</Eyebrow>
            <p className={cx("mt-3 text-body-sm text-text-2", MEASURE_BODY)}>
              {interpolate(party.p7.notice.body, { deposit })}
            </p>
            <Caption className="mt-3">{party.policy.deposit.simulated}</Caption>
          </section>

          {/* The policy summary sits above the button, not behind a link. */}
          <p className={cx("text-body-sm text-text", MEASURE_BODY)}>
            {interpolate(party.p7.policyLine, { deposit })}
          </p>

          <DepositForm
            draftId={draft.id}
            defaultName={draft.customerName}
            ctaLabel={interpolate(global.btn.payDeposit, { deposit })}
          />
        </div>
      </FlowLayout>
    </PageShell>
  );
}
