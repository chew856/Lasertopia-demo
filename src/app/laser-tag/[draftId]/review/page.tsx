import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Eyebrow, Hairline, MonoValue, PageShell, SectionHeader } from "@/components/ui";
import { global, interpolate, laserTag } from "@/lib/copy";
import {
  blockStartsFor,
  computePublicGamePrice,
  localDateOf,
  planPublicBooking,
  type BookingErrorCode,
} from "@/lib/domain";
import {
  formatBlock,
  formatDateLong,
  formatMoney,
  formatTime,
  formatTimeList,
  unitLabel,
} from "@/lib/format";

import { EditLink, FlowFooter, FlowStep } from "../../_components/flow-chrome";
import { HoldBar } from "../../_components/hold-bar";
import { ReasonPanel } from "../../_components/reason-panel";
import { RecoveryActions } from "../../_components/recovery-actions";
import { ReviewForm } from "../../_components/review-form";
import { getDraft, holdExpired } from "../../_lib/draft";
import { loadRejectionContext, startStillOpen } from "../../_lib/flow-context";
import { blockEndMinutes } from "../../_lib/grid";
import {
  arenaFullAtSubmitContent,
  cutoffAtSubmitContent,
  holdExpiredContent,
  serverErrorContent,
  slotRejectionContent,
  type ReasonContent,
} from "../../_lib/rejections";
import { LASER_TAG_HOME, detailsStep, timeStep } from "../../_lib/routes";
import { validateDetails } from "../../_lib/validate";
import { loadDayStates, loadVenue } from "../../_lib/venue";

/**
 * Screen G4 — `/laser-tag/[draftId]/review` · Confirm (STRATEGY §3.1).
 *
 * This screen re-validates **on render and again on submit**, and the two are not the same
 * check run twice for the sake of it: the 90-minute cutoff is a moving deadline, so a page
 * that was legal when it painted can be illegal by the time someone reads the acknowledgement
 * and taps Confirm. The render-time check keeps a doomed button from being offered; the
 * submit-time check in `confirmBooking` is what actually decides.
 *
 * When the submit-time check refuses, the customer comes back here with the engine's code in
 * the URL and reads the `atSubmit` half of COPY.md §8 — a different sentence from the
 * browse-time one, because it has to say that nothing was charged and their details are kept.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: laserTag.g4.title,
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { draftId } = await params;
  const query = await searchParams;
  const now = new Date();

  const { catalog, config } = await loadVenue();
  const draft = await getDraft(draftId, {
    maxPlayers: config.arenaCapacity,
    maxGames: config.maxGamesPerPublicBooking,
  });
  if (!draft) redirect(LASER_TAG_HOME);
  if (draft.date === null || draft.startMinutes === null) redirect(timeStep(draft.id));

  const details = validateDetails(draft);
  if (!details.ok) redirect(detailsStep(draft.id));

  const date = draft.date;
  const startMinutes = draft.startMinutes;
  const currentYear = Number(localDateOf(now, config.timezone).slice(0, 4));
  const blockStarts = blockStartsFor(startMinutes, draft.games, config);
  const gameBlock = formatBlock(
    startMinutes,
    blockEndMinutes(blockStarts, config.gameDurationMinutes),
  );

  const price = computePublicGamePrice({
    players: draft.players,
    games: draft.games,
    catalog,
    config,
  });

  // ── Re-validate at render ──────────────────────────────────────────────────────────────
  const dayStates = await loadDayStates({ dates: [date], now, catalog });
  const plan = planPublicBooking({
    now,
    date,
    players: draft.players,
    games: draft.games,
    channel: "ONLINE",
    catalog,
    config,
    dayState: dayStates.get(date) ?? {
      date,
      partyBookings: [],
      publicBookings: [],
      blockedSlotMinutes: [],
    },
    startMinutes,
  });

  const submitRejection = firstParam(query.rejected) as BookingErrorCode | null;
  const submitSeats = Number.parseInt(firstParam(query.seats) ?? "", 10);
  const expired = holdExpired(draft, now);
  const failing = submitRejection ?? (plan.ok ? null : plan.error.code);

  let panel: ReasonContent | null = null;
  if (expired || failing) {
    const { context, availability } = await loadRejectionContext({
      now,
      players: draft.players,
      games: draft.games,
      date,
    });

    if (failing === "ONLINE_CUTOFF") {
      panel = cutoffAtSubmitContent(context, startMinutes);
    } else if (failing === "ARENA_FULL") {
      panel = arenaFullAtSubmitContent(context, {
        startMinutes,
        seatsRemaining: Number.isInteger(submitSeats)
          ? submitSeats
          : (availability.slots.find((slot) => slot.startMinutes === startMinutes)
              ?.seatsRemaining ?? 0),
      });
    } else if (failing) {
      const slot = availability.slots.find((entry) => entry.startMinutes === startMinutes);
      panel = slotRejectionContent(
        {
          startMinutes,
          blockStartMinutes: slot?.blockStartMinutes ?? blockStarts,
          seatsRemaining: slot?.seatsRemaining ?? 0,
          reason: failing,
        },
        context,
      );
    } else {
      panel = holdExpiredContent(context, {
        startMinutes,
        stillOpen: startStillOpen(availability, startMinutes),
        holdMinutes: config.bookingHoldMinutes,
      });
    }

    // The ladder bottoms out at the one string that needs no venue facts to be true.
    panel = panel ?? serverErrorContent(config.venuePhone);

    return (
      <PageShell as="main" width="flow" className="flex flex-1 flex-col py-8 md:py-12">
        <FlowStep current={4} />
        <div className="mt-10">
          <ReasonPanel title={panel.title} body={panel.body}>
            <RecoveryActions
              draftId={draft.id}
              date={date}
              actions={panel.actions}
              phone={config.venuePhone}
              then="review"
            />
          </ReasonPanel>
        </div>
        <FlowFooter phone={config.venuePhone} />
      </PageShell>
    );
  }

  if (!price.ok) {
    const content = serverErrorContent(config.venuePhone);
    return (
      <PageShell as="main" width="flow" className="flex flex-1 flex-col py-8 md:py-12">
        <FlowStep current={4} />
        <div className="mt-10">
          <ReasonPanel title={content.title} body={content.body} />
        </div>
        <FlowFooter phone={config.venuePhone} />
      </PageShell>
    );
  }

  const times =
    draft.games === 1
      ? formatTime(startMinutes)
      : formatTimeList(blockStarts);

  return (
    <PageShell as="main" width="flow" className="flex flex-1 flex-col py-8 md:py-12">
      <FlowStep current={4} />

      <SectionHeader
        level={1}
        headingTag="h1"
        title={laserTag.g4.heading}
        className="mt-6 mb-8"
      />

      <HoldBar
        draftId={draft.id}
        heldUntil={draft.heldUntil ?? now.getTime()}
        holdMinutes={config.bookingHoldMinutes}
        gameBlock={gameBlock}
        alreadyExtended={draft.holdExtended}
        className="mb-8"
      />

      {/* The readback. STRATEGY §5 puts the date and both start times at the top of the
          hierarchy: they are the two facts a customer must not get wrong. */}
      <section className="border-t border-rule pt-6">
        <p className="font-display text-display-2 text-text">
          {formatDateLong(date, { currentYear })}
        </p>

        <div className="mt-6 flex flex-col gap-1">
          <Eyebrow as="h2">
            {interpolate(laserTag.g4.readback.timesLabel, {
              "unit.game": unitLabel(draft.games, "game"),
            })}
          </Eyebrow>
          <MonoValue step="lg">{times}</MonoValue>
        </div>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <MonoValue step="md" className="text-text-2">
            {interpolate(laserTag.g4.readback.players, {
              players: draft.players,
              "unit.player": unitLabel(draft.players, "player"),
            })}
          </MonoValue>
          <EditLink href={timeStep(draft.id, { date })}>{laserTag.g4.editTime}</EditLink>
          <EditLink href={LASER_TAG_HOME}>{laserTag.g4.editPlayers}</EditLink>
        </div>

        <p className="mt-6 max-w-[56ch] text-body-sm text-text-2">{global.rule.arrive}</p>
      </section>

      <Hairline className="my-8" />

      {/* Price. Laser tag is quoted plus tax and never collects a card. */}
      <section>
        <Eyebrow as="h2">{global.sum.heading}</Eyebrow>
        <dl className="mt-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-body-sm text-text-2">
              {interpolate(global.sum.line.games, {
                games: draft.games,
                "unit.game": unitLabel(draft.games, "game"),
                players: draft.players,
                "unit.player": unitLabel(draft.players, "player"),
              })}
            </dt>
            <dd>
              <MonoValue step="sm" className="text-text-2">
                {interpolate(laserTag.g4.price.perPerson, {
                  perPerson: formatMoney(price.value.pricePerPersonCents),
                })}
              </MonoValue>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-3">
            <dt className="font-display text-button uppercase text-text">
              {global.sum.subtotal}
            </dt>
            <dd>
              <MonoValue step="xl">{formatMoney(price.value.preTaxSubtotalCents)}</MonoValue>
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-caption text-text-2">{global.sum.plusTax}</p>
        <p className="mt-4 max-w-[56ch] text-body-sm text-text">{global.rule.payDesk}</p>
      </section>

      <Hairline className="my-8" />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-6">
          <EditLink href={detailsStep(draft.id)}>{laserTag.g4.editDetails}</EditLink>
        </div>

        <ReviewForm
          draftId={draft.id}
          ackBody={`${global.rule.shoes} ${global.rule.nutFreeCombined}`}
          totalLabel={formatMoney(price.value.preTaxSubtotalCents)}
          phone={config.venuePhone}
        />
      </section>

      <FlowFooter phone={config.venuePhone} />
    </PageShell>
  );
}
