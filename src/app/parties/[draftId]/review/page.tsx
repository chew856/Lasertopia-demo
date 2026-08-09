import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Caption,
  Eyebrow,
  FlowLayout,
  FlowSection,
  Hairline,
  MEASURE_BODY,
  PageShell,
  cx,
} from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { formatClock } from "@/lib/domain";
import {
  formatDateLong,
  formatDuration,
  formatMoney,
  formatTimeList,
  formatTimeRange,
} from "@/lib/format";

import { FactRow, FlowStepHeader, SummaryRail } from "../../_components/flow-chrome";
import { HoldGate } from "../../_components/hold-gate";
import {
  AcknowledgementForm,
  GuestCountEditor,
} from "../../_components/review-form";
import { loadDraftView } from "../../_lib/draft-view";
import { addOnName } from "../../_lib/extras";
import { guestCeiling } from "../../_lib/fit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${party.p6.title} — ${global.venueName}`,
};

/**
 * Screen P6 — the whole booking in one scroll, then three acknowledgements.
 *
 * Everything on this page is re-derived on render: the window is still the window the engine
 * planned, the price is recomputed from settings, and the hold is re-checked. A total posted by
 * a client is never displayed and never written.
 */
export default async function ReviewPage(props: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await props.params;
  const view = await loadDraftView(draftId);
  if (!view || !view.packageRecord || !view.breakdown || !view.summary) notFound();

  const { draft, catalog, config, packageRecord, window, breakdown, summary } = view;
  const windowLabel = window ? formatTimeRange(window.startMinutes, window.endMinutes) : "";
  const deposit = formatMoney(config.depositAmountCents);

  const addOnLines = draft.addOns.map((line) => {
    const record = catalog.addOns.find((a) => a.code === line.addOnCode);
    return record ? `${addOnName(record)} × ${line.quantity}` : line.addOnCode;
  });

  return (
    <PageShell as="main" width="page" className="py-8 md:py-12">
      <FlowSection>
        <FlowStepHeader step={6} title={party.p6.heading} />
      </FlowSection>

      <FlowSection>
        <HoldGate view={view} />
      </FlowSection>

      <FlowLayout rail={<SummaryRail model={summary} />}>
        <div className="flex flex-col gap-10">
          <section aria-label={party.p6.when.heading}>
            <Eyebrow as="h2">{party.p6.when.heading}</Eyebrow>
            <dl className="mt-2 divide-y divide-rule">
              <FactRow
                label={party.p6.when.heading}
                value={formatDateLong(draft.date)}
                note={windowLabel}
              />
              {window ? (
                <FactRow
                  label={global.hold.label}
                  value={formatClock(window.startMinutes)}
                  note={interpolate(party.p6.when.arrive, {
                    startTime: formatClock(window.startMinutes),
                  })}
                />
              ) : null}
              {draft.gameTimes.length > 0 ? (
                <FactRow
                  label={party.p8.games.label}
                  value={formatTimeList(draft.gameTimes)}
                  note={interpolate(party.p6.when.games, {
                    gameTimes: formatTimeList(draft.gameTimes),
                  })}
                />
              ) : null}
              <FactRow
                label={party.p8.room.label}
                value={formatDuration(packageRecord.roomMinutes)}
                note={interpolate(party.p6.when.roomTime, {
                  roomTime: formatDuration(packageRecord.roomMinutes),
                })}
              />
            </dl>
          </section>

          <Hairline tone="rule" />

          <section aria-label={party.p6.who.heading}>
            <Eyebrow as="h2">{party.p6.who.heading}</Eyebrow>
            <p className="mt-3 text-body text-text">
              {interpolate(party.p6.who.guests, {
                guests: draft.guests,
                honoree: draft.honoreeName || party.p5.honoree.label,
              })}
            </p>
            <p className="mt-1 text-body-sm text-text-2">
              {interpolate(party.p6.who.honoree, {
                honoree: draft.honoreeName || party.p5.honoree.label,
                age: draft.honoreeAge,
              })}
            </p>
            <div className="mt-5">
              <GuestCountEditor
                draftId={draft.id}
                guests={draft.guests}
                min={Math.max(1, config.minPartyGuests)}
                max={guestCeiling(catalog, config)}
              />
            </div>
          </section>

          <Hairline tone="rule" />

          <section aria-label={party.p6.package.heading}>
            <Eyebrow as="h2">{party.p6.package.heading}</Eyebrow>
            <p className="mt-3 text-body text-text">{packageRecord.name}</p>
            <Caption className="mt-1">
              <Link
                href={`/parties/${draft.id}/package`}
                className="text-accent underline underline-offset-4"
              >
                {global.btn.edit}
              </Link>
            </Caption>
          </section>

          <section aria-label={party.p6.extras.heading}>
            <Eyebrow as="h2">{party.p6.extras.heading}</Eyebrow>
            {addOnLines.length === 0 ? (
              <p className="mt-3 text-body-sm text-text-2">{party.p6.extras.none}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1 text-body-sm text-text-2">
                {addOnLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <Caption className="mt-1">
              <Link
                href={`/parties/${draft.id}/extras`}
                className="text-accent underline underline-offset-4"
              >
                {global.btn.edit}
              </Link>
            </Caption>
          </section>

          <Hairline tone="rule" />

          {/* The deposit and the balance are the two figures a parent is actually deciding on. */}
          <section aria-label={party.p6.price.heading} className="lg:hidden">
            <Eyebrow as="h2">{party.p6.price.heading}</Eyebrow>
            <div className="mt-3">
              <SummaryRail model={summary} />
            </div>
          </section>

          <section
            aria-label={global.sum.balanceDue}
            className="border border-rule bg-raised p-4 md:p-6"
          >
            <dl className="divide-y divide-rule">
              <FactRow
                label={global.sum.depositDue}
                value={interpolate(party.p6.deposit.value, { deposit })}
              />
              <FactRow
                label={global.sum.balanceDue}
                value={interpolate(party.p6.balance.value, {
                  balance: formatMoney(breakdown.balanceDueCents),
                })}
              />
            </dl>
            <p className={cx("mt-4 text-caption text-text-2", MEASURE_BODY)}>
              {interpolate(party.policy.deposit.perBooking, { deposit })}
            </p>
          </section>

          <AcknowledgementForm
            draftId={draft.id}
            depositAckBody={interpolate(party.p6.ack.deposit.body, {
              deposit,
              noticeDays: config.changeNoticeDays,
            })}
            ctaLabel={interpolate(global.btn.reserveDeposit, { deposit })}
          />
        </div>
      </FlowLayout>
    </PageShell>
  );
}
