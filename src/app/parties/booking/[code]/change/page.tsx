import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Caption,
  Eyebrow,
  FlowSection,
  Hairline,
  MEASURE_BODY,
  PageShell,
  SectionHeader,
  Tag,
  buttonClassName,
  cx,
} from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { assessNotice, evaluateCancellation } from "@/lib/domain";
import { formatDateLong, formatMoney, formatTimeRange } from "@/lib/format";

import { CallLink, RejectionPanel } from "../../../_components/flow-chrome";
import { CancelForm, DateChangeRequestForm } from "../../../_components/change-forms";
import { loadPartyByReference } from "../../../_lib/draft";
import { loadVenue, packageByCode } from "../../../_lib/venue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${party.p9.title} — ${global.venueName}`,
};

/**
 * Screen P9 — change or cancel.
 *
 * The 14-day boundary is the sharpest edge in this product, so the outcome is **computed and
 * stated in dollars before the button**. Which side of the boundary the booking sits on comes
 * from `assessNotice` / `evaluateCancellation` in venue-local wall clock, never from a
 * millisecond subtraction that drifts across a DST change (R-56).
 */
export default async function ChangeOrCancelPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await props.params;
  const searchParams = await props.searchParams;

  const booking = await loadPartyByReference(decodeURIComponent(code));
  if (!booking) notFound();

  const { catalog, config } = await loadVenue();
  const now = new Date();
  const packageRecord = packageByCode(catalog, booking.packageCode);
  const window = catalog.partyWindows.find((w) => w.id === booking.partyWindowId) ?? null;
  const windowLabel = window ? formatTimeRange(window.startMinutes, window.endMinutes) : "";
  const deposit = formatMoney(booking.deposit?.amountCents ?? config.depositAmountCents);

  const notice = assessNotice({
    now,
    eventStartsAtUtc: booking.windowStartsAtUtc,
    config,
  });
  const outcome = evaluateCancellation({
    now,
    eventStartsAtUtc: booking.windowStartsAtUtc,
    depositAmountCents: config.depositAmountCents,
    config,
  });
  const outsideNotice = notice.sufficient;

  const sent = searchParams.sent === "1";
  const cancelled = searchParams.cancelled === "1" || booking.status === "CANCELLED";

  const summaryLine = interpolate(party.p9.summary, {
    date: formatDateLong(booking.date),
    window: windowLabel,
    guests: booking.guests,
    packageName: packageRecord?.name ?? "",
  });

  if (cancelled) {
    const giftCard = outcome.depositStatus === "CONVERTED_TO_GIFT_CARD";
    return (
      <PageShell as="main" width="flow" className="py-8 md:py-12">
        <FlowSection>
          <Tag tone="full">{global.status.cancelled}</Tag>
          <SectionHeader
            className="mt-5"
            level={1}
            headingTag="h1"
            title={
              giftCard
                ? party.p9.cancel.done.giftcard.heading
                : party.p9.cancel.done.forfeit.heading
            }
            description={
              giftCard
                ? interpolate(party.p9.cancel.done.giftcard.body, {
                    deposit,
                    email: booking.customerEmail,
                  })
                : interpolate(party.p9.cancel.done.forfeit.body, {
                    deposit,
                    noticeDays: config.changeNoticeDays,
                  })
            }
          />
        </FlowSection>
        <FlowSection>
          <div className="flex flex-wrap gap-3">
            <Link href="/parties" className={buttonClassName("secondary")}>
              {global.btn.bookAgain}
            </Link>
            <CallLink variant="ghost" />
          </div>
        </FlowSection>
      </PageShell>
    );
  }

  return (
    <PageShell as="main" width="flow" className="py-8 md:py-12">
      <FlowSection>
        <SectionHeader
          level={1}
          headingTag="h1"
          title={interpolate(party.p9.heading, { honoree: booking.honoreeName })}
          description={summaryLine}
        />
      </FlowSection>

      {sent ? (
        <FlowSection>
          <RejectionPanel
            tone="notice"
            title={party.p9.request.done.heading}
            body={interpolate(party.p9.request.done.body, { phone: global.phone })}
            actions={
              <Link
                href={`/parties/booking/${booking.reference}`}
                className={buttonClassName("secondary")}
              >
                {global.btn.done}
              </Link>
            }
          />
        </FlowSection>
      ) : null}

      {/* The outcome, in dollars, before any button. */}
      <FlowSection>
        <section
          aria-label={party.p9.title}
          className={cx(
            "border p-4 md:p-6",
            outsideNotice ? "border-rule bg-raised" : "border-state-filling bg-raised",
          )}
        >
          <Eyebrow as="h2">
            {interpolate(
              outsideNotice ? party.p9.outside.heading : party.p9.inside.heading,
              { daysAway: notice.noticeDays },
            )}
          </Eyebrow>
          <p className={cx("mt-3 text-body-sm text-text", MEASURE_BODY)}>
            {outsideNotice
              ? interpolate(party.p9.outside.body, { deposit })
              : interpolate(party.p9.inside.body, {
                  noticeDays: config.changeNoticeDays,
                  deposit,
                })}
          </p>
          {!outsideNotice ? (
            <Caption className="mt-3">
              {interpolate(party.p9.inside.rescheduleNote, {
                noticeDays: config.changeNoticeDays,
              })}
            </Caption>
          ) : null}
        </section>
      </FlowSection>

      {!sent ? (
        <FlowSection>
          <Eyebrow as="h2">{party.p9.request.heading}</Eyebrow>
          <div className="mt-4">
            <DateChangeRequestForm reference={booking.reference} />
          </div>
        </FlowSection>
      ) : null}

      <FlowSection>
        <Hairline tone="rule" />
        <div className="mt-6">
          <CancelForm
            reference={booking.reference}
            confirmHeading={interpolate(party.p9.cancel.confirm.heading, {
              honoree: booking.honoreeName,
            })}
            confirmBody={
              outsideNotice
                ? interpolate(party.p9.cancel.confirm.giftcard, { deposit })
                : interpolate(party.p9.cancel.confirm.forfeit, { deposit })
            }
          />
        </div>
      </FlowSection>

      <FlowSection>
        <details className="border border-rule bg-raised p-4">
          <summary className="cursor-pointer text-body-sm text-accent">
            {party.p9.policy.link}
          </summary>
          <div className="mt-4 flex flex-col gap-3 text-body-sm text-text-2">
            <p className={MEASURE_BODY}>
              {interpolate(party.policy.deposit.body, { deposit })}
            </p>
            <p className={MEASURE_BODY}>
              {interpolate(party.policy.reschedule.body, {
                noticeDays: config.changeNoticeDays,
                deposit,
                phone: global.phone,
              })}
            </p>
            <p className={MEASURE_BODY}>
              {interpolate(party.policy.cancel.outside, {
                noticeDays: config.changeNoticeDays,
                deposit,
              })}
            </p>
            <p className={MEASURE_BODY}>
              {interpolate(party.policy.cancel.inside, {
                noticeDays: config.changeNoticeDays,
              })}
            </p>
            <p className={MEASURE_BODY}>{party.policy.cancel.noCash}</p>
            <p className={MEASURE_BODY}>
              {interpolate(party.policy.cancel.boundary, {
                noticeDays: config.changeNoticeDays,
              })}
            </p>
            <Hairline tone="rule" />
            <Eyebrow as="h3">{party.policy.full.heading}</Eyebrow>
            <p className={cx("text-caption text-text-3", MEASURE_BODY)}>
              {party.policy.full.source}
            </p>
            <Caption>{party.policy.full.note}</Caption>
          </div>
        </details>
      </FlowSection>
    </PageShell>
  );
}
