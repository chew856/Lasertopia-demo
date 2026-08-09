import type { Metadata } from "next";
import Link from "next/link";

import {
  ButtonLink,
  Eyebrow,
  Hairline,
  MonoValue,
  PageShell,
  SectionHeader,
  Tag,
  ValidationMessage,
  buttonClassName,
} from "@/components/ui";
import { global, interpolate, laserTag } from "@/lib/copy";
import { prisma } from "@/lib/db/client";
import { cutoffPassed, localDateOf } from "@/lib/domain";
import {
  formatBookingCode,
  formatDateLong,
  formatMoney,
  formatPhone,
  formatPhoneHref,
  formatTime,
  formatTimeList,
  unitLabel,
} from "@/lib/format";

import { CancelForm } from "../../_components/cancel-form";
import { FlowFooter } from "../../_components/flow-chrome";
import { ReasonPanel } from "../../_components/reason-panel";
import { isGamesBookingCode, normaliseBookingCode } from "../../_lib/booking-code";
import { LASER_TAG_HOME, confirmation } from "../../_lib/routes";
import { loadVenue } from "../../_lib/venue";

/**
 * Screen G5 — `/laser-tag/booking/[code]` · Confirmed (STRATEGY §3.1).
 *
 * The customer's permanent view of their booking, and the only page in the flow reachable
 * without a draft. The booking code is the credential: eight random characters, unguessable
 * enough to be a bearer token and short enough to read down a phone line — which is exactly
 * the trade STRATEGY §0 asks for, and the reason a wrong code gets `err.code.notFound` and a
 * lookup link rather than a bare 404.
 *
 * STRATEGY §2.1 puts the shared confirmation at `/booking/[code]`, rendering differently for
 * games and parties. That route is shared with the party surface and outside this surface's
 * files, so the laser tag confirmation lives under `/laser-tag/booking/[code]` and is flagged
 * for consolidation in the handover.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: laserTag.g5.title.replace("{code}", ""),
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code: raw } = await params;
  const query = await searchParams;
  const now = new Date();
  const code = normaliseBookingCode(raw);

  const { config } = await loadVenue();
  const phone = formatPhone(config.venuePhone);

  const booking = isGamesBookingCode(code)
    ? await prisma.booking.findUnique({
        where: { reference: code },
        include: {
          publicGame: true,
          games: { include: { gameSlot: { select: { startMinutes: true, startsAtUtc: true } } } },
        },
      })
    : null;

  if (!booking || booking.type !== "PUBLIC_GAME" || !booking.publicGame) {
    return (
      <PageShell as="main" width="flow" className="flex flex-1 flex-col py-12 md:py-16">
        <ReasonPanel
          title={interpolate(laserTag.err.codeNotFound.title, { code })}
          body={laserTag.err.codeNotFound.body}
        >
          <Link href="/manage-booking" className={buttonClassName("primary")}>
            {global.btn.lookUpBooking}
          </Link>
          <Link href={LASER_TAG_HOME} className={buttonClassName("secondary")}>
            {global.btn.bookAgain}
          </Link>
        </ReasonPanel>
        <FlowFooter phone={config.venuePhone} />
      </PageShell>
    );
  }

  const starts = booking.games
    .map((game) => game.gameSlot)
    .sort((a, b) => a.startsAtUtc.getTime() - b.startsAtUtc.getTime());
  const startMinutes = starts.map((slot) => slot.startMinutes);
  const players = booking.publicGame.playerCount;
  const currentYear = Number(localDateOf(now, config.timezone).slice(0, 4));
  const dateLong = formatDateLong(booking.date, { currentYear });
  const gameTimes = startMinutes.length > 0 ? formatTimeList(startMinutes) : "";

  const isNew = firstParam(query.new) === "1";
  const justCancelled = firstParam(query.cancelled) === "1";
  const confirming = firstParam(query.cancel) === "1";
  const cancelled = booking.status === "CANCELLED";
  const lastStart = starts[starts.length - 1]?.startsAtUtc;
  const completed =
    !cancelled &&
    lastStart !== undefined &&
    lastStart.getTime() + config.gameDurationMinutes * 60_000 < now.getTime();
  const pastCutoff =
    starts.length > 0 &&
    cutoffPassed({ now, startsAtUtc: starts[0].startsAtUtc, channel: "ONLINE", config });

  return (
    <PageShell as="main" width="flow" className="flex flex-1 flex-col py-8 md:py-12">
      {cancelled ? (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Tag tone="full" variant="solid">
            {global.status.cancelled}
          </Tag>
          <span className="text-body-sm text-text-2">
            {interpolate(global.status.cancelledOn, {
              date: formatDateLong(localDateOf(booking.updatedAt, config.timezone), {
                currentYear,
              }),
            })}
          </span>
        </div>
      ) : null}

      {completed ? (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Tag tone="neutral" variant="solid">
            {global.status.completed}
          </Tag>
          <span className="text-body-sm text-text-2">
            {interpolate(global.status.completedOn, { date: dateLong })}
          </span>
        </div>
      ) : null}

      {justCancelled ? (
        <ValidationMessage tone="success" className="mb-6">
          {laserTag.g5.cancel.done}
        </ValidationMessage>
      ) : null}

      <SectionHeader
        level={1}
        headingTag="h1"
        title={isNew && !cancelled ? laserTag.g5.heading.new : laserTag.g5.heading.return}
        description={
          isNew && !cancelled
            ? interpolate(laserTag.g5.sub.new, { email: booking.customerEmail })
            : undefined
        }
      />

      {/* The code is the largest thing on the screen: it is what the front desk asks for. */}
      <section className="mt-10 border border-rule bg-raised p-6">
        <Eyebrow as="h2">{laserTag.g5.code.label}</Eyebrow>
        <p className="mt-3">
          <MonoValue step="xl" className="text-accent">
            {formatBookingCode(booking.reference)}
          </MonoValue>
        </p>
        <p className="mt-3 max-w-[56ch] text-body-sm text-text-2">{laserTag.g5.code.help}</p>
      </section>

      <dl className="mt-10 flex flex-col gap-6">
        <div>
          <Eyebrow as="dt">{laserTag.g5.when.label}</Eyebrow>
          <dd className="mt-2">
            <MonoValue step="lg">
              {interpolate(laserTag.g5.when.value, { date: dateLong, gameTimes })}
            </MonoValue>
          </dd>
        </div>

        <div>
          <Eyebrow as="dt">{laserTag.g5.players.label}</Eyebrow>
          <dd className="mt-2">
            <MonoValue step="md">{players}</MonoValue>
          </dd>
        </div>

        <div>
          <Eyebrow as="dt">{global.sum.dueAtDesk}</Eyebrow>
          <dd className="mt-2">
            <MonoValue step="lg">
              {interpolate(laserTag.g5.due.value, {
                total: formatMoney(booking.preTaxSubtotalCents),
              })}
            </MonoValue>
            <p className="mt-2 max-w-[56ch] text-body-sm text-text-2">{global.rule.payDesk}</p>
          </dd>
        </div>
      </dl>

      <Hairline className="my-8" />

      <section>
        <Eyebrow as="h2">{laserTag.g5.arrive.heading}</Eyebrow>
        <p className="mt-2 max-w-[56ch] text-body-sm text-text">{global.rule.arrive}</p>
      </section>

      <section className="mt-8">
        <Eyebrow as="h2">{laserTag.g5.rules.heading}</Eyebrow>
        <ul className="mt-2 flex flex-col gap-1 text-body-sm text-text-2">
          <li>{global.rule.shoes}</li>
          <li>{global.rule.nutFree}</li>
          <li>{global.rule.outsideFood}</li>
        </ul>
      </section>

      <section className="mt-8">
        <Eyebrow as="h2">{laserTag.g5.where.heading}</Eyebrow>
        <p className="mt-2 text-body-sm text-text">{global.address}</p>
        <p className="mt-3">
          <a
            className="text-body-sm text-text-2 underline decoration-1 underline-offset-4 hover:text-accent"
            href={formatPhoneHref(config.venuePhone)}
          >
            {interpolate(global.phoneCall, { phone })}
          </a>
        </p>
      </section>

      {!cancelled && !completed ? (
        <section className="mt-10 flex flex-col gap-4 border-t border-rule pt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href={`${confirmation(code)}/calendar`} download>
              {global.btn.addToCalendar}
            </ButtonLink>
          </div>

          {confirming ? (
            <div className="mt-4 border border-rule border-l-[3px] border-l-state-full bg-raised p-4 md:p-6">
              <h2 className="font-display text-display-3 text-text">
                {interpolate(laserTag.g5.cancel.confirmHeading, {
                  code: formatBookingCode(booking.reference),
                })}
              </h2>
              <div className="mt-4">
                <CancelForm
                  code={booking.reference}
                  confirmBody={interpolate(laserTag.g5.cancel.confirmBody, {
                    players,
                    "unit.player": unitLabel(players, "player"),
                    time: formatTime(startMinutes[0] ?? 0),
                    date: dateLong,
                  })}
                  keepHref={confirmation(code)}
                  phone={config.venuePhone}
                  cutoffMinutes={config.onlineCutoffMinutes}
                />
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <p className="max-w-[56ch] text-caption text-text-2">
                {interpolate(laserTag.g5.cancel.free, {
                  cutoffMinutes: config.onlineCutoffMinutes,
                })}
              </p>
              {pastCutoff ? (
                <ValidationMessage tone="warning">
                  {interpolate(laserTag.g5.cancel.tooLate, {
                    cutoffMinutes: config.onlineCutoffMinutes,
                    phone,
                  })}
                </ValidationMessage>
              ) : (
                <Link
                  href={`${confirmation(code)}?cancel=1`}
                  className="min-h-11 content-center self-start text-body-sm text-text-2 underline decoration-1 underline-offset-4 hover:text-accent"
                >
                  {global.btn.cancelBooking}
                </Link>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-10 border-t border-rule pt-8">
          <Link href={LASER_TAG_HOME} className={buttonClassName("primary")}>
            {global.btn.bookAgain}
          </Link>
        </section>
      )}

      <FlowFooter phone={config.venuePhone} />
    </PageShell>
  );
}
