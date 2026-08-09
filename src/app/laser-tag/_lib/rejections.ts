/**
 * Turning an engine rejection into the panel a customer reads.
 *
 * STRATEGY §0 sets two rules this module exists to keep. **Every failure names what happened,
 * why in the venue's terms, and the next action as a tappable control** — so nothing here
 * returns a bare string, only a title, a body and at least one real action. And **recovery is
 * by alternative**: we never say "try another time" without naming times that work, computed
 * by the same engine call that produced the rejection.
 *
 * It is pure, and it takes every fact as a parameter — the current minute, the seats left,
 * the alternatives — so the whole §8 deck can be exercised in tests without a database, a
 * clock or a render.
 *
 * WHEN THE DECK RUNS OUT OF ALTERNATIVES
 * --------------------------------------
 * COPY.md §8 assumes a rejected time has neighbours: `err.arenaFull.body` names three, and
 * `err.blocked.body` names two. A day can have fewer. Rather than invent a sentence or ship a
 * half-filled one, this module walks down a ladder of strings the deck really contains:
 *
 *   per-cell §8 copy  →  err.dayFull.games (names the nearest *days*)  →  empty.g2.noGames
 *
 * and the caller sends the customer to `/closed` when the whole horizon is empty. Every rung
 * is a true statement written by the copywriter; none of them is assembled here.
 */

import { global, interpolate, laserTag } from "@/lib/copy";
import {
  formatBlock,
  formatDateLong,
  formatDateShort,
  formatMoney,
  formatTime,
  unitLabel,
} from "@/lib/format";
import type { BookingErrorCode, LocalDateString } from "@/lib/domain";

export type PanelActionKind =
  | "takeTime"
  | "oneGame"
  | "goToDate"
  | "call"
  | "callWalkIn"
  | "reduceGroup"
  | "bookParty";

export interface PanelAction {
  kind: PanelActionKind;
  label: string;
  variant: "primary" | "secondary";
  /** `takeTime` / `oneGame`: the start to move to. */
  startMinutes?: number;
  /** `goToDate`: the date to jump the strip to. */
  date?: LocalDateString;
}

export interface ReasonContent {
  title: string;
  body: string;
  actions: PanelAction[];
}

/** Everything the §8 strings interpolate, gathered once per render. */
export interface RejectionContext {
  date: LocalDateString;
  players: number;
  games: number;
  arenaCapacity: number;
  cutoffMinutes: number;
  phone: string;
  /** Venue-local minutes of the day the doors open. */
  openMinutes: number;
  gameDurationMinutes: number;
  /** Spacing between consecutive starts. `CFG.gameIntervalMinutes`. */
  gameIntervalMinutes: number;
  /** Venue-local minutes for "It's {time} now" in the cutoff copy. */
  nowMinutes: number;
  /** The earliest start on this date that clears the cutoff and has room, or null. */
  earliestOnlineStartMinutes: number | null;
  /** Per-person price of a single game, for the "book 1 game instead" offer. */
  oneGamePricePerPersonCents: number;
  /** Bookable starts on this date, ascending. */
  availableStarts: readonly number[];
  /** Nearest later dates with room for this group, ascending. */
  nextDays: readonly { date: LocalDateString; startMinutes: number }[];
  /** The year the customer is browsing in, so `formatDateLong` knows when to print one. */
  currentYear: number;
}

export interface RejectedSlot {
  startMinutes: number;
  blockStartMinutes: readonly number[];
  seatsRemaining: number;
  reason: BookingErrorCode | null;
  /**
   * For `PARTIAL_BLOCK` only: the first start inside the block that does not work. The engine
   * knows the block failed; this is which game inside it did, from `firstFailingStart`.
   */
  failingStartMinutes?: number | null;
}

function takeTime(startMinutes: number, label: string, variant: PanelAction["variant"]): PanelAction {
  return { kind: "takeTime", label, variant, startMinutes };
}

function callAction(phone: string, variant: PanelAction["variant"] = "secondary"): PanelAction {
  return { kind: "call", label: interpolate(global.phoneCall, { phone }), variant };
}

function callWalkInAction(phone: string): PanelAction {
  return { kind: "callWalkIn", label: interpolate(global.phoneCallWalkin, { phone }), variant: "secondary" };
}

/** The nearest bookable starts to a rejected one, closest first. */
export function alternativesNear(
  availableStarts: readonly number[],
  fromMinutes: number,
  count: number,
): number[] | null {
  const sorted = [...availableStarts]
    .filter((start) => start !== fromMinutes)
    .sort((a, b) => {
      const byDistance = Math.abs(a - fromMinutes) - Math.abs(b - fromMinutes);
      return byDistance !== 0 ? byDistance : b - a;
    });
  return sorted.length >= count ? sorted.slice(0, count) : null;
}

/**
 * `err.dayFull.games` — the rung below every per-cell string. Needs two later dates with room;
 * returns null when the horizon cannot supply them, which is the caller's cue to drop to the
 * empty state.
 */
export function dayFullContent(context: RejectionContext): ReasonContent | null {
  if (context.nextDays.length < 2) return null;
  const [first, second] = context.nextDays;
  return {
    title: interpolate(laserTag.err.dayFull.title, {
      date: formatDateLong(context.date, { currentYear: context.currentYear }),
      players: context.players,
    }),
    body: interpolate(laserTag.err.dayFull.body, {
      players: context.players,
      "unit.player": unitLabel(context.players, "player"),
      altDate1: formatDateShort(first.date),
      altTime1: formatTime(first.startMinutes),
      altDate2: formatDateShort(second.date),
      altTime2: formatTime(second.startMinutes),
    }),
    actions: [
      {
        kind: "goToDate",
        label: interpolate(global.btn.goToDate, { altDate1: formatDateShort(first.date) }),
        variant: "primary",
        date: first.date,
      },
      {
        kind: "goToDate",
        label: interpolate(laserTag.err.dayFull.actionSecondary, {
          altDate2: formatDateShort(second.date),
        }),
        variant: "secondary",
        date: second.date,
      },
    ],
  };
}

/** `err.dayClosed` — the venue is shut that date. */
export function dayClosedContent(
  context: RejectionContext,
  nextOpen: { date: LocalDateString; hoursLine: string } | null,
): ReasonContent | null {
  if (!nextOpen) return null;
  return {
    title: interpolate(laserTag.err.dayClosed.title, {
      date: formatDateLong(context.date, { currentYear: context.currentYear }),
    }),
    body: interpolate(laserTag.err.dayClosed.body, {
      nextOpenDate: formatDateShort(nextOpen.date),
      hoursLine: nextOpen.hoursLine,
    }),
    actions: [
      {
        kind: "goToDate",
        label: interpolate(laserTag.err.dayClosed.actionPrimary, {
          nextOpenDate: formatDateShort(nextOpen.date),
        }),
        variant: "primary",
        date: nextOpen.date,
      },
    ],
  };
}

/**
 * `err.dayClosed.weekendMorning` — the standing explanation on a Saturday or Sunday for why
 * the 10:00 AM–12:00 PM games are not on offer. Approved default, BRIEF gap #4.
 */
export function weekendMorningContent(context: RejectionContext): ReasonContent | null {
  const firstPublic = context.availableStarts[0];
  if (firstPublic === undefined) return null;
  return {
    title: interpolate(laserTag.err.dayClosed.weekendMorning.title, {
      openTime: formatTime(context.openMinutes),
    }),
    body: interpolate(laserTag.err.dayClosed.weekendMorning.body, {
      openTime: formatTime(context.openMinutes),
      altTime1: formatTime(firstPublic),
    }),
    actions: [
      takeTime(
        firstPublic,
        interpolate(laserTag.err.dayClosed.weekendMorning.actionPrimary, {
          altTime1: formatTime(firstPublic),
        }),
        "primary",
      ),
      {
        kind: "bookParty",
        label: laserTag.err.dayClosed.weekendMorning.actionSecondary,
        variant: "secondary",
      },
    ],
  };
}

/** `err.groupTooLarge.games` — the G1 ceiling panel. */
export function groupTooLargeContent(args: { arenaCapacity: number; phone: string }): ReasonContent {
  return {
    title: interpolate(laserTag.err.groupTooLarge.title, { arenaCap: args.arenaCapacity }),
    body: interpolate(laserTag.err.groupTooLarge.body, {
      arenaCap: args.arenaCapacity,
      phone: args.phone,
    }),
    actions: [callAction(args.phone, "primary")],
  };
}

/**
 * The panel behind a cell that cannot be booked. Returns `null` when the slot is bookable and
 * `dayFullContent`'s ladder when the day has too few alternatives for the deck's sentence.
 */
export function slotRejectionContent(
  slot: RejectedSlot,
  context: RejectionContext,
): ReasonContent | null {
  const time = formatTime(slot.startMinutes);
  const players = context.players;
  const playerUnit = unitLabel(players, "player");

  switch (slot.reason) {
    case null:
      return null;

    case "ONLINE_CUTOFF": {
      if (context.earliestOnlineStartMinutes === null) return fallback(context);
      const earliest = formatTime(context.earliestOnlineStartMinutes);
      return {
        title: laserTag.err.cutoff.title,
        body: interpolate(laserTag.err.cutoff.body, {
          cutoffMinutes: context.cutoffMinutes,
          time: formatTime(context.nowMinutes),
          altTime1: earliest,
          phone: context.phone,
        }),
        actions: [
          takeTime(
            context.earliestOnlineStartMinutes,
            interpolate(laserTag.err.cutoff.actionPrimary, { altTime1: earliest }),
            "primary",
          ),
          callWalkInAction(context.phone),
        ],
      };
    }

    case "SLOT_HELD_FOR_PARTY": {
      const alternatives = alternativesNear(context.availableStarts, slot.startMinutes, 2);
      if (!alternatives) return fallback(context);
      const [one, two] = alternatives;
      return {
        title: interpolate(laserTag.err.partyHeld.title, { time }),
        body: interpolate(laserTag.err.partyHeld.body, {
          players,
          "unit.player": playerUnit,
          altTime1: formatTime(one),
          altTime2: formatTime(two),
        }),
        actions: [
          takeTime(
            one,
            interpolate(laserTag.err.partyHeld.actionPrimary, { altTime1: formatTime(one) }),
            "primary",
          ),
          takeTime(
            two,
            interpolate(laserTag.err.partyHeld.actionSecondary, { altTime2: formatTime(two) }),
            "secondary",
          ),
        ],
      };
    }

    case "PARTY_ONLY_WINDOW": {
      const firstPublic = context.availableStarts[0];
      if (firstPublic === undefined) return fallback(context);
      return {
        title: laserTag.err.partyOnly.title,
        body: interpolate(laserTag.err.partyOnly.body, {
          openTime: formatTime(context.openMinutes),
          altTime1: formatTime(firstPublic),
        }),
        actions: [
          takeTime(
            firstPublic,
            interpolate(laserTag.err.partyOnly.actionPrimary, { altTime1: formatTime(firstPublic) }),
            "primary",
          ),
          { kind: "bookParty", label: laserTag.err.partyOnly.actionSecondary, variant: "secondary" },
        ],
      };
    }

    case "SLOT_UNAVAILABLE": {
      const alternatives = alternativesNear(context.availableStarts, slot.startMinutes, 2);
      if (!alternatives) return fallback(context);
      const [one, two] = alternatives;
      return {
        title: interpolate(laserTag.err.blocked.title, { time }),
        body: interpolate(laserTag.err.blocked.body, {
          players,
          "unit.player": playerUnit,
          altTime1: formatTime(one),
          altTime2: formatTime(two),
        }),
        actions: [
          takeTime(
            one,
            interpolate(laserTag.err.blocked.actionPrimary, { altTime1: formatTime(one) }),
            "primary",
          ),
          takeTime(
            two,
            interpolate(laserTag.err.blocked.actionSecondary, { altTime2: formatTime(two) }),
            "secondary",
          ),
        ],
      };
    }

    case "ARENA_FULL": {
      const alternatives = alternativesNear(context.availableStarts, slot.startMinutes, 3);
      if (!alternatives) return fallback(context);
      const [one, two, three] = alternatives;
      return {
        title: interpolate(laserTag.err.arenaFull.title, { time, players }),
        body: interpolate(laserTag.err.arenaFull.body, {
          arenaCap: context.arenaCapacity,
          time,
          seatsLeft: slot.seatsRemaining,
          "unit.spot": unitLabel(slot.seatsRemaining, "spot"),
          players,
          altTime1: formatTime(one),
          altTime2: formatTime(two),
          altTime3: formatTime(three),
        }),
        actions: [
          takeTime(
            one,
            interpolate(laserTag.err.arenaFull.actionPrimary, { altTime1: formatTime(one) }),
            "primary",
          ),
          { kind: "reduceGroup", label: global.btn.reduceGroup, variant: "secondary" },
        ],
      };
    }

    case "PARTIAL_BLOCK": {
      const alternatives = alternativesNear(context.availableStarts, slot.startMinutes, 2);
      const failing = slot.failingStartMinutes ?? slot.blockStartMinutes[1];
      if (!alternatives || failing === undefined) return fallback(context);
      // `fmt.block` runs from the first start to the end of the last game, so the last start
      // is `interval` apart and the tail is one `duration` long. The two are equal on the
      // seeded venue and must not be assumed equal here.
      const blockFor = (start: number) =>
        formatBlock(
          start,
          start + (context.games - 1) * context.gameIntervalMinutes + context.gameDurationMinutes,
        );
      const [one, two] = alternatives;
      return {
        title: interpolate(laserTag.err.partialBlock.title, { games: context.games, time }),
        body: interpolate(laserTag.err.partialBlock.body, {
          time,
          altTime1: formatTime(failing),
          players,
          gameBlock: blockFor(one),
          altWindow1: blockFor(two),
        }),
        actions: [
          takeTime(
            one,
            interpolate(laserTag.err.partialBlock.actionPrimary, { gameBlock: blockFor(one) }),
            "primary",
          ),
          {
            kind: "oneGame",
            label: interpolate(laserTag.err.partialBlock.actionSecondary, {
              time,
              perPerson: formatMoney(context.oneGamePricePerPersonCents),
            }),
            variant: "secondary",
            startMinutes: slot.startMinutes,
          },
        ],
      };
    }

    default:
      // Shape rejections (a tampered player or game count) have no customer-facing story
      // beyond "this is not bookable"; the day-level copy is the honest one.
      return fallback(context);
  }
}

// ─── Submit-time variants ────────────────────────────────────────────────────────────────
// COPY.md keeps these as separate keys on purpose: "that time is too soon to book" while
// browsing and "that time moved inside the window while you were typing" are different
// events, and the second has to say that nothing was charged and the details are kept.

export function cutoffAtSubmitContent(
  context: RejectionContext,
  startMinutes: number,
): ReasonContent | null {
  if (context.earliestOnlineStartMinutes === null) return fallback(context);
  const altTime1 = formatTime(context.earliestOnlineStartMinutes);
  return {
    title: interpolate(laserTag.err.cutoff.atSubmit.title, { time: formatTime(startMinutes) }),
    body: interpolate(laserTag.err.cutoff.atSubmit.body, {
      time: formatTime(startMinutes),
      cutoffMinutes: context.cutoffMinutes,
      altTime1,
    }),
    actions: [
      takeTime(
        context.earliestOnlineStartMinutes,
        interpolate(laserTag.err.cutoff.atSubmit.actionPrimary, { altTime1 }),
        "primary",
      ),
      callWalkInAction(context.phone),
    ],
  };
}

export function arenaFullAtSubmitContent(
  context: RejectionContext,
  args: { startMinutes: number; seatsRemaining: number },
): ReasonContent | null {
  const alternatives = alternativesNear(context.availableStarts, args.startMinutes, 2);
  if (!alternatives) return fallback(context);
  const [one, two] = alternatives;
  const time = formatTime(args.startMinutes);
  return {
    title: interpolate(laserTag.err.arenaFull.atSubmit.title, { time }),
    body: interpolate(laserTag.err.arenaFull.atSubmit.body, {
      seatsLeft: args.seatsRemaining,
      "unit.spot": unitLabel(args.seatsRemaining, "spot"),
      time,
      players: context.players,
      altTime1: formatTime(one),
      altTime2: formatTime(two),
    }),
    actions: [
      takeTime(
        one,
        interpolate(laserTag.err.arenaFull.atSubmit.actionPrimary, { altTime1: formatTime(one) }),
        "primary",
      ),
      takeTime(
        two,
        interpolate(laserTag.err.arenaFull.atSubmit.actionSecondary, { altTime2: formatTime(two) }),
        "secondary",
      ),
    ],
  };
}

/**
 * `err.holdExpired.games` — the two halves of the same event. The time being still open is a
 * different sentence and a different button from the time having gone, and the customer has
 * to be told which one happened before being asked to act.
 */
export function holdExpiredContent(
  context: RejectionContext,
  args: { startMinutes: number; stillOpen: boolean; holdMinutes: number },
): ReasonContent | null {
  const time = formatTime(args.startMinutes);
  const title = interpolate(laserTag.err.holdExpired.title, { time });

  if (args.stillOpen) {
    return {
      title,
      body: interpolate(laserTag.err.holdExpired.bodyStillOpen, {
        holdMinutes: args.holdMinutes,
        time,
      }),
      actions: [
        takeTime(args.startMinutes, interpolate(global.btn.holdAgain, { time }), "primary"),
        { kind: "goToDate", label: laserTag.err.holdExpired.actionRepick, variant: "secondary", date: context.date },
      ],
    };
  }

  const alternatives = alternativesNear(context.availableStarts, args.startMinutes, 2);
  if (!alternatives) return fallback(context);
  const [one, two] = alternatives;
  return {
    title,
    body: interpolate(laserTag.err.holdExpired.bodyGone, {
      holdMinutes: args.holdMinutes,
      time,
      players: context.players,
      altTime1: formatTime(one),
      altTime2: formatTime(two),
    }),
    actions: [
      takeTime(
        one,
        interpolate(laserTag.err.holdExpired.actionGone, { altTime1: formatTime(one) }),
        "primary",
      ),
      {
        kind: "goToDate",
        label: laserTag.err.holdExpired.actionRepick,
        variant: "secondary",
        date: context.date,
      },
    ],
  };
}

/** `err.server.generic` — the last rung, and the only one with no venue-specific facts in it. */
export function serverErrorContent(phone: string): ReasonContent {
  return {
    title: laserTag.err.server.genericTitle,
    body: interpolate(laserTag.err.server.genericBody, { phone }),
    actions: [callAction(phone)],
  };
}

function fallback(context: RejectionContext): ReasonContent | null {
  return dayFullContent(context);
}
