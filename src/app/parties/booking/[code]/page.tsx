import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Caption,
  Eyebrow,
  FlowLayout,
  FlowSection,
  MEASURE_BODY,
  MonoValue,
  PageShell,
  SectionHeader,
  Tag,
  buttonClassName,
  cx,
} from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { formatClock } from "@/lib/domain";
import {
  formatBookingCode,
  formatDateLong,
  formatDuration,
  formatMoney,
  formatPhoneHref,
  formatTimeList,
  formatTimeRange,
} from "@/lib/format";

import { CallLink, FactRow, SummaryRail } from "../../_components/flow-chrome";
import { breakdownFromSnapshot, loadPartyByReference } from "../../_lib/draft";
import { addOnName } from "../../_lib/extras";
import { buildSummary } from "../../_lib/money-lines";
import { loadVenue, packageByCode } from "../../_lib/venue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${global.productName} — ${global.venueName}`,
};

/**
 * Screen P8 — the confirmation, and the customer's permanent view of the booking.
 *
 * The booking code in the URL is the bearer token (STRATEGY §0), which is why it is eight
 * random characters rather than a sequence.
 *
 * Money here comes off the booking's **snapshots**, not from today's settings: R-68 freezes the
 * total at confirmation so a later price change never moves what an existing customer owes.
 */
export default async function PartyConfirmationPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await props.params;
  const searchParams = await props.searchParams;
  const isNew = searchParams.new === "1";

  const booking = await loadPartyByReference(decodeURIComponent(code));
  if (!booking) notFound();

  const { catalog, config } = await loadVenue();
  const packageRecord = packageByCode(catalog, booking.packageCode);
  const window = catalog.partyWindows.find((w) => w.id === booking.partyWindowId) ?? null;
  const rooms =
    catalog.roomConfigurations.find((c) => c.id === booking.roomConfigurationId)?.name ?? "";

  const addOnNames = new Map(catalog.addOns.map((a) => [a.code, addOnName(a)]));
  const breakdown = packageRecord
    ? breakdownFromSnapshot(booking, packageRecord, addOnNames)
    : null;
  const summary =
    breakdown && packageRecord
      ? buildSummary({
          breakdown,
          packageRecord,
          guests: booking.guests,
          config,
          depositPaid: booking.deposit !== null,
        })
      : null;

  const deposit = formatMoney(booking.deposit?.amountCents ?? config.depositAmountCents);
  const windowLabel = window ? formatTimeRange(window.startMinutes, window.endMinutes) : "";
  const statusTone =
    booking.status === "CONFIRMED"
      ? "accent"
      : booking.status === "CANCELLED"
        ? "full"
        : "filling";
  const statusLabel =
    booking.status === "CONFIRMED"
      ? global.status.confirmed
      : booking.status === "CANCELLED"
        ? global.status.cancelled
        : global.status.pendingDeposit;

  const addOnLines = booking.addOns.map((line) => {
    const name = addOnNames.get(line.addOnCode) ?? line.addOnCode;
    return `${name} × ${line.quantity}`;
  });

  return (
    <PageShell as="main" width="page" className="py-8 md:py-12">
      <FlowSection>
        <div className="flex flex-wrap items-center gap-3">
          <Tag tone={statusTone}>{statusLabel}</Tag>
        </div>
        <SectionHeader
          className="mt-5"
          level={1}
          headingTag="h1"
          title={interpolate(isNew ? party.p8.heading.new : party.p8.heading.return, {
            honoree: booking.honoreeName,
          })}
          description={
            isNew && booking.customerEmail
              ? interpolate(party.p8.sub.new, { email: booking.customerEmail })
              : undefined
          }
        />
      </FlowSection>

      <FlowSection>
        <section
          aria-label={party.p8.code.label}
          className="border border-rule bg-raised p-4 md:p-6"
        >
          <Eyebrow as="h2">{party.p8.code.label}</Eyebrow>
          <MonoValue step="xl" as="p" className="mt-2">
            {formatBookingCode(booking.reference)}
          </MonoValue>
          <Caption className="mt-2">{party.p8.code.help}</Caption>
        </section>
      </FlowSection>

      {booking.status !== "CONFIRMED" && booking.status !== "CANCELLED" ? (
        <FlowSection>
          <p className={cx("text-body-sm text-text-2", MEASURE_BODY)}>
            {interpolate(global.status.pendingDepositBody, {
              deposit,
              phone: global.phone,
            })}
          </p>
        </FlowSection>
      ) : null}

      <FlowLayout rail={summary ? <SummaryRail model={summary} /> : undefined}>
        <div className="flex flex-col gap-10">
          <section aria-label={party.p8.when.heading}>
            <Eyebrow as="h2">{party.p8.when.heading}</Eyebrow>
            <dl className="mt-2 divide-y divide-rule">
              <FactRow
                label={party.p8.when.heading}
                value={interpolate(party.p8.when.value, {
                  date: formatDateLong(booking.date),
                  window: windowLabel,
                })}
              />
              {window ? (
                <FactRow
                  label={party.p8.arrive.label}
                  value={interpolate(party.p8.arrive.value, {
                    startTime: formatClock(window.startMinutes),
                  })}
                  note={party.p8.arrive.note}
                />
              ) : null}
              {booking.gameTimes.length > 0 ? (
                <FactRow
                  label={party.p8.games.label}
                  value={interpolate(party.p8.games.value, {
                    gameTimes: formatTimeList(booking.gameTimes),
                  })}
                />
              ) : null}
              {packageRecord ? (
                <FactRow
                  label={party.p8.room.label}
                  value={interpolate(party.p8.room.value, {
                    roomNames: rooms,
                    roomTime: formatDuration(packageRecord.roomMinutes),
                  })}
                />
              ) : null}
              <FactRow
                label={party.p8.guests.label}
                value={interpolate(party.p8.guests.value, {
                  guests: booking.guests,
                  honoree: booking.honoreeName,
                })}
              />
              {packageRecord ? (
                <FactRow label={party.p8.package.label} value={packageRecord.name} />
              ) : null}
              {addOnLines.length > 0 ? (
                <FactRow label={party.p8.extras.label} value={addOnLines.join(" · ")} />
              ) : null}
            </dl>
          </section>

          {breakdown ? (
            <section aria-label={party.p8.money.heading}>
              <Eyebrow as="h2">{party.p8.money.heading}</Eyebrow>
              <ul className="mt-3 flex flex-col gap-1 text-body-sm text-text-2">
                <li>
                  {interpolate(party.p8.money.total, {
                    total: formatMoney(breakdown.totalCents),
                  })}
                </li>
                <li>{interpolate(party.p8.money.paid, { deposit })}</li>
                <li>
                  {interpolate(party.p8.money.balance, {
                    balance: formatMoney(breakdown.balanceDueCents),
                  })}
                </li>
              </ul>
            </section>
          ) : null}

          <section aria-label={party.p8.allergies.heading}>
            <Eyebrow as="h2">{party.p8.allergies.heading}</Eyebrow>
            <p className={cx("mt-3 text-body-sm text-text-2", MEASURE_BODY)}>
              {booking.notes.length > 0
                ? booking.notes
                : interpolate(party.p8.allergies.none, { phone: global.phone })}
            </p>
          </section>

          <section aria-label={party.p8.rules.heading}>
            <Eyebrow as="h2">{party.p8.rules.heading}</Eyebrow>
            <ul className="mt-3 flex flex-col gap-1 text-body-sm text-text-2">
              <li>{global.rule.nutFree}</li>
              <li>{global.rule.outsideFood}</li>
              <li>{global.rule.shoes}</li>
            </ul>
          </section>

          <section aria-label={party.p8.where.heading}>
            <Eyebrow as="h2">{party.p8.where.heading}</Eyebrow>
            <p className="mt-3 text-body-sm text-text-2">{global.address}</p>
            <a
              href={formatPhoneHref(global.phone)}
              className="mt-1 inline-block font-mono text-mono-sm tabular-nums text-accent"
            >
              {global.phone}
            </a>
          </section>

          <section aria-label={party.p8.forward.heading}>
            <Eyebrow as="h2">{party.p8.forward.heading}</Eyebrow>
            <p className={cx("mt-3 text-body-sm text-text-2", MEASURE_BODY)}>
              {party.p8.forward.body}
            </p>
          </section>

          {booking.status !== "CANCELLED" ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/parties/booking/${booking.reference}/change`}
                className={buttonClassName("secondary")}
              >
                {global.btn.changeOrCancel}
              </Link>
              <CallLink variant="ghost" />
            </div>
          ) : null}
        </div>
      </FlowLayout>
    </PageShell>
  );
}
