import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell, SectionHeader, type DateOption } from "@/components/ui";
import { global, interpolate, laserTag } from "@/lib/copy";
import {
  addDays,
  blockStartsFor,
  getPublicAvailability,
  localDateOf,
  localMinutesOf,
  operatingHoursFor,
  type BookingErrorCode,
  type PublicAvailability,
  type PublicSlotStatus,
} from "@/lib/domain";
import {
  formatBlock,
  formatBlockSub,
  formatDateLong,
  formatTime,
  formatTimeRange,
  unitLabel,
} from "@/lib/format";

import { FlowFooter, FlowStep } from "../../_components/flow-chrome";
import {
  TimePicker,
  type HourGroupView,
  type SlotView,
} from "../../_components/time-picker";
import { getDraft } from "../../_lib/draft";
import {
  blockEndMinutes,
  dateAvailabilityFor,
  dayOutcomeFor,
  firstFailingStart,
  fillingThreshold,
  groupByHour,
  nextDaysWithRoom,
  nextOpenDay,
  tileStateFor,
} from "../../_lib/grid";
import {
  dayClosedContent,
  dayFullContent,
  slotRejectionContent,
  weekendMorningContent,
  type RejectionContext,
} from "../../_lib/rejections";
import { CLOSED, LASER_TAG_HOME } from "../../_lib/routes";
import { parseCalendarDate } from "../../_lib/validate";
import { loadDayStates, loadVenue } from "../../_lib/venue";

/**
 * Screen G2 — `/laser-tag/[draftId]/time` · Date & time (STRATEGY §3.1).
 *
 * The single most important property of this page: **the grid is computed for this group.**
 * A cell is not "free" or "taken" on its own — six players booking two consecutive games ask
 * a different question of 6:15 PM than one player booking one, and a grid rendered without
 * knowing which shows green cells that reject on submit. So `players` and `games` come out of
 * the draft and go into every engine call on the page.
 *
 * The whole horizon is evaluated here, not just the selected day. The date strip's four
 * statuses are real availability for this group, and the recovery copy for a full or closed
 * day names the *next dates that work* — both need every day in the window, and both would be
 * a lie if they were computed from anything less.
 *
 * Everything a customer might read, including the rejection panel behind every unbookable
 * cell, is assembled here and handed down as data. The client component picks and shows; it
 * never decides.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: laserTag.g2.title,
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function TimePage({
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
  const limits = { maxPlayers: config.arenaCapacity, maxGames: config.maxGamesPerPublicBooking };
  const draft = await getDraft(draftId, limits);
  // A draft the browser no longer holds cannot be recovered, and there is no COPY.md string
  // for "we lost your choices". Starting again is two taps and states nothing untrue.
  if (!draft) redirect(LASER_TAG_HOME);

  const today = localDateOf(now, config.timezone);
  const dates = Array.from({ length: config.bookingHorizonDays + 1 }, (_, offset) =>
    addDays(today, offset),
  );
  const dayStates = await loadDayStates({ dates, now, catalog });

  const days: PublicAvailability[] = dates.map((date) =>
    getPublicAvailability({
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
    }),
  );

  // STRATEGY §2.1: `/closed` is for a venue with nothing bookable at all in the browsing
  // window. That is a property of the venue, not of this group — a day with games on it that
  // this group cannot fit is `DAY_FULL`, and it stays inside the flow with its own copy.
  if (days.every((day) => day.closed || day.slots.length === 0)) redirect(CLOSED);

  const lastDate = dates[dates.length - 1];
  const defaultDate = days.find((day) => day.nextAvailableStartMinutes !== null)?.date ?? today;

  const requested = parseCalendarDate(firstParam(query.date));
  let corrected: { title: string; body: string } | null = null;
  let date: string;

  if (requested === null) {
    date = draft.date !== null && dates.includes(draft.date) ? draft.date : defaultDate;
  } else if (requested < today) {
    corrected = { title: laserTag.err.past.title, body: laserTag.err.past.body };
    date = defaultDate;
  } else if (requested > lastDate) {
    corrected = {
      title: laserTag.err.horizon.title,
      body: interpolate(laserTag.err.horizon.body, {
        date: formatDateLong(requested, { currentYear: Number(today.slice(0, 4)) }),
        phone: config.venuePhone,
      }),
    };
    date = defaultDate;
  } else {
    date = requested;
  }

  const availability = days.find((day) => day.date === date) ?? days[0];
  const dayState = dayStates.get(availability.date) ?? {
    date: availability.date,
    partyBookings: [],
    publicBookings: [],
    blockedSlotMinutes: [],
  };

  // The same date evaluated for a single game. It is what tells a `PARTIAL_BLOCK` cell *which*
  // of its games failed, and it is what makes "book 1 game at 6:15 instead" a real offer.
  const singleGame = getPublicAvailability({
    now,
    date: availability.date,
    players: draft.players,
    games: 1,
    channel: "ONLINE",
    catalog,
    config,
    dayState,
  });

  const currentYear = Number(today.slice(0, 4));
  const hours = operatingHoursFor(catalog, availability.date);
  const oneGamePrice =
    catalog.gamePricing.find((pricing) => pricing.gameCount === 1)?.pricePerPersonCents ?? 0;

  const context: RejectionContext = {
    date: availability.date,
    players: draft.players,
    games: draft.games,
    arenaCapacity: config.arenaCapacity,
    cutoffMinutes: config.onlineCutoffMinutes,
    phone: config.venuePhone,
    openMinutes: availability.opensMinutes ?? hours?.opensMinutes ?? 0,
    gameDurationMinutes: config.gameDurationMinutes,
    gameIntervalMinutes: config.gameIntervalMinutes,
    nowMinutes: localMinutesOf(now, config.timezone),
    earliestOnlineStartMinutes: availability.nextAvailableStartMinutes,
    oneGamePricePerPersonCents: oneGamePrice,
    availableStarts: availability.slots.filter((slot) => slot.available).map((s) => s.startMinutes),
    nextDays: nextDaysWithRoom(days, availability.date, 2),
    currentYear,
  };

  // ── Tiles ──────────────────────────────────────────────────────────────────────────────
  const threshold = fillingThreshold(config.arenaCapacity);
  const readbackByStart: Record<number, string> = {};
  const scarceWarningByStart: Record<number, string> = {};

  const labelFor = (slot: PublicSlotStatus): string =>
    draft.games === 1
      ? formatTime(slot.startMinutes)
      : formatBlock(
          slot.startMinutes,
          blockEndMinutes(slot.blockStartMinutes, config.gameDurationMinutes),
        );

  const toView = (slot: PublicSlotStatus): SlotView => {
    const state = tileStateFor(slot, config.arenaCapacity);
    const stateWord = STATE_WORDS[state];
    const timeLabel = labelFor(slot);

    if (slot.available) {
      readbackByStart[slot.startMinutes] = interpolate(laserTag.g2.selectedReadback, {
        gameBlock: timeLabel,
        date: formatDateLong(availability.date, { currentYear }),
      });
      if (slot.seatsRemaining <= threshold) {
        scarceWarningByStart[slot.startMinutes] = interpolate(laserTag.g2.warn.scarce, {
          seatsLeft: slot.seatsRemaining,
          "unit.spot": unitLabel(slot.seatsRemaining, "spot"),
        });
      }
    }

    return {
      startMinutes: slot.startMinutes,
      timeLabel,
      subTimes: draft.games === 1 ? null : formatBlockSub(slot.blockStartMinutes),
      state,
      stateWord,
      detail: detailFor(slot, state, config.arenaCapacity),
      a11yLabel: interpolate(laserTag.g2.cell.a11y, {
        time: timeLabel,
        state: stateWord,
        seatsLeft: slot.seatsRemaining,
        arenaCap: config.arenaCapacity,
      }),
      selectable: slot.available,
      reason: slot.available
        ? null
        : slotRejectionContent(
            {
              startMinutes: slot.startMinutes,
              blockStartMinutes: slot.blockStartMinutes,
              seatsRemaining: slot.seatsRemaining,
              reason: slot.reason,
              failingStartMinutes:
                slot.reason === "PARTIAL_BLOCK"
                  ? firstFailingStart(slot.blockStartMinutes, singleGame.slots)
                  : null,
            },
            context,
          ),
    };
  };

  const hourGroups: HourGroupView[] = groupByHour(availability.slots).map((group) => ({
    hourLabel: formatTime(group.hourMinutes),
    slots: group.slots.map(toView),
  }));

  // ── Date strip ─────────────────────────────────────────────────────────────────────────
  const tomorrow = addDays(today, 1);
  const dateOptions: DateOption[] = days.map((day) => {
    const level = dateAvailabilityFor(day, config.arenaCapacity);
    return {
      date: day.date,
      availability: level,
      statusLabel: DATE_STATUS[level],
      weekdayOverride:
        day.date === today
          ? laserTag.g2.dateStrip.today
          : day.date === tomorrow
            ? laserTag.g2.dateStrip.tomorrow
            : undefined,
      isToday: day.date === today,
      // Deliberately never disabled: a full or closed day is a designed state with its own
      // sentence and its own recovery, and disabling the chip would put both out of reach.
    };
  });

  // ── Whole-day states ───────────────────────────────────────────────────────────────────
  const outcome = dayOutcomeFor(availability);
  const openNext = nextOpenDay(days, availability.date);
  const openNextHours = openNext ? operatingHoursFor(catalog, openNext.date) : null;

  let blockingPanel = null;
  let emptyState: {
    title: string;
    body: string;
    actionLabel: string;
    goToDate: string | null;
  } | null = null;

  if (outcome === "DAY_CLOSED") {
    blockingPanel = dayClosedContent(
      context,
      openNext && openNextHours
        ? {
            date: openNext.date,
            hoursLine: formatTimeRange(openNextHours.opensMinutes, openNextHours.closesMinutes),
          }
        : null,
    );
  } else if (outcome === "DAY_FULL") {
    blockingPanel = dayFullContent(context);
  }

  if (blockingPanel === null && outcome !== "OK") {
    // The ladder's last rung. `empty.g2.noGames` states the real constraint — when the doors
    // open and who the morning belongs to — and offers exactly one action.
    emptyState = {
      title: laserTag.empty.g2.noGamesTitle,
      body: interpolate(laserTag.empty.g2.noGamesBody, {
        date: formatDateLong(availability.date, { currentYear }),
        openTime: formatTime(context.openMinutes),
        phone: config.venuePhone,
      }),
      actionLabel: global.btn.pickAnotherDate,
      goToDate: openNext?.date ?? context.nextDays[0]?.date ?? null,
    };
  }

  // The weekend-morning explanation stands above the grid whenever the day really does carry
  // party-only games — the customer can see cells they cannot have, and this says why.
  const standingPanel =
    availability.slots.some((slot) => slot.mode === "PARTY_ONLY") && outcome === "OK"
      ? weekendMorningContent(context)
      : null;

  // ── A choice refused between render and submit ─────────────────────────────────────────
  const rejectedCode = firstParam(query.rejected) as BookingErrorCode | null;
  const rejectedStart = Number.parseInt(firstParam(query.start) ?? "", 10);
  let alertPanel = null;
  let raceLostMessage: string | null = null;

  if (rejectedCode && Number.isInteger(rejectedStart)) {
    const slot = availability.slots.find((entry) => entry.startMinutes === rejectedStart);
    alertPanel = slotRejectionContent(
      {
        startMinutes: rejectedStart,
        blockStartMinutes:
          slot?.blockStartMinutes ?? blockStartsFor(rejectedStart, draft.games, config),
        seatsRemaining: slot?.seatsRemaining ?? 0,
        reason: rejectedCode,
        failingStartMinutes:
          slot && rejectedCode === "PARTIAL_BLOCK"
            ? firstFailingStart(slot.blockStartMinutes, singleGame.slots)
            : null,
      },
      context,
    );
    if (rejectedCode === "ARENA_FULL" || rejectedCode === "PARTIAL_BLOCK") {
      raceLostMessage = interpolate(laserTag.err.raceLost.gridBody, {
        time: formatTime(rejectedStart),
      });
    }
  }

  // ── "Next available", only when the soonest legal start really is on this date ──────────
  const nextAvailable =
    availability.date === today && availability.nextAvailableStartMinutes !== null
      ? {
          startMinutes: availability.nextAvailableStartMinutes,
          label: interpolate(laserTag.g2.nextAvailable, {
            time: formatTime(availability.nextAvailableStartMinutes),
          }),
          actionLabel: interpolate(laserTag.g2.nextAvailableAction, {
            time: formatTime(availability.nextAvailableStartMinutes),
          }),
        }
      : null;

  return (
    <PageShell as="main" width="flow" className="flex flex-1 flex-col py-8 md:py-12">
      <FlowStep current={2} />

      <SectionHeader
        level={1}
        headingTag="h1"
        title={laserTag.g2.heading}
        className="mt-6 mb-8"
      />

      <TimePicker
        draftId={draft.id}
        date={availability.date}
        days={dateOptions}
        hours={hourGroups}
        gridLabel={interpolate(laserTag.g2.grid.label, {
          date: formatDateLong(availability.date, { currentYear }),
        })}
        contextLine={interpolate(laserTag.g2.context, {
          players: draft.players,
          "unit.player": unitLabel(draft.players, "player"),
          games: draft.games,
          "unit.game": unitLabel(draft.games, "game"),
        })}
        nextAvailable={nextAvailable}
        readbackByStart={readbackByStart}
        scarceWarningByStart={scarceWarningByStart}
        blockingPanel={blockingPanel}
        emptyState={emptyState}
        alertPanel={alertPanel}
        standingPanel={standingPanel}
        raceLostMessage={raceLostMessage}
        correctedMessage={corrected}
        phone={config.venuePhone}
      />

      <FlowFooter phone={config.venuePhone} />
    </PageShell>
  );
}

/** COPY.md `g2.cell.state.*` — DESIGN §5.6's literal uppercase words, one per tile state. */
const STATE_WORDS = {
  open: laserTag.g2.cell.state.open,
  filling: laserTag.g2.cell.state.filling,
  full: laserTag.g2.cell.state.full,
  party: laserTag.g2.cell.state.partyHold,
  blocked: laserTag.g2.cell.state.blocked,
  tooSoon: laserTag.g2.cell.state.tooSoon,
} as const;

const DATE_STATUS = {
  open: laserTag.g2.dateStrip.status.open,
  limited: laserTag.g2.dateStrip.status.limited,
  none: laserTag.g2.dateStrip.status.full,
  closed: laserTag.g2.dateStrip.status.closed,
} as const;

/**
 * The capacity line under a tile.
 *
 * A `PARTIAL_BLOCK` cell deliberately shows none: its first game may have plenty of room, and
 * printing "12 / 25 spots" on a cell the customer cannot book would contradict the word above
 * it. The tap sheet is where that cell explains itself.
 */
function detailFor(
  slot: PublicSlotStatus,
  state: keyof typeof STATE_WORDS,
  arenaCapacity: number,
): string | null {
  switch (state) {
    case "filling":
      return interpolate(laserTag.g2.cell.spotsLeft, {
        seatsLeft: slot.seatsRemaining,
        arenaCap: arenaCapacity,
      });
    case "open":
      return interpolate(laserTag.g2.cell.spots, {
        seatsLeft: slot.seatsRemaining,
        arenaCap: arenaCapacity,
        "unit.spot": unitLabel(slot.seatsRemaining, "spot"),
      });
    case "full":
      return slot.reason === "ARENA_FULL"
        ? interpolate(laserTag.g2.cell.spots, {
            seatsLeft: slot.seatsRemaining,
            arenaCap: arenaCapacity,
            "unit.spot": unitLabel(slot.seatsRemaining, "spot"),
          })
        : null;
    case "party":
      return laserTag.g2.cell.state.partyHoldSub;
    case "tooSoon":
      return laserTag.g2.cell.state.tooSoonSub;
    case "blocked":
      // COPY.md §8.4: never expose the internal block reason to a customer.
      return null;
  }
}
