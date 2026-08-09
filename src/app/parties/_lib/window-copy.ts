/**
 * Turning an engine verdict on one party window into the row a parent reads.
 *
 * Pure: catalog + availability in, strings and state words out. No component decides why a
 * window is unavailable and no component writes a sentence — this is the single place a
 * `BookingErrorCode` becomes COPY.md prose, which is what stops "greyed out with no reason"
 * from being reachable at all (STRATEGY §3.2 P2: "it must never grey something out without
 * saying why").
 */

import type { BayState, TagTone } from "@/components/ui";
import { interpolate, party } from "@/lib/copy";
import type { BookingErrorCode, EngineConfig, PartyWindowAvailability } from "@/lib/domain";

export interface WindowRowContext {
  guests: number;
  honoreeAge: number;
  config: EngineConfig;
  /** Long-form date, already formatted. Only used by the closed-date reason. */
  dateLabel: string;
}

export interface WindowPresentation {
  available: boolean;
  bayState: BayState;
  stateWord: string;
  /** The card's top-right chip. */
  status: { label: string; tone: TagTone; hatched?: boolean };
  /** The row's reason sentence, or `null` when the window is available. */
  reason: string | null;
  /** "Fits up to N guests" — always shown, available or not. */
  capacityLabel: string;
}

/** The pink "another party holds this" bar is only correct for the age rule (DESIGN §5.7). */
function bayStateFor(code: BookingErrorCode | null): BayState {
  if (code === null) return "open";
  if (code === "AGE_GAP_EXCEEDED") return "party";
  if (code === "VENUE_CLOSED" || code === "PAST_DATE" || code === "BEYOND_HORIZON") {
    return "blocked";
  }
  if (code === "MIN_LEAD_TIME_NOT_MET") return "blocked";
  return "full";
}

function stateWordFor(code: BookingErrorCode | null): string {
  if (code === null) return party.p2.window.state.open;
  if (code === "AGE_GAP_EXCEEDED") return party.p2.window.state.partyHold;
  const state = bayStateFor(code);
  return state === "blocked" ? party.p2.window.state.blocked : party.p2.window.state.full;
}

/**
 * The reason sentence for one unavailable window, keyed by the engine's code.
 *
 * Every branch resolves to a §8 string with its real numbers filled in. The `default` branch is
 * the generic server sentence rather than the engine's own English, because the engine's
 * messages are written for logs and manager screens, not for a parent on a phone.
 */
export function windowReason(
  window: PartyWindowAvailability,
  ctx: WindowRowContext,
): string | null {
  if (window.available) return null;
  const { config } = ctx;

  switch (window.reason) {
    case "NO_ROOM_CONFIG":
      return interpolate(party.err.roomFit.row, {
        roomMax: window.remainingCapacity > 0 ? window.remainingCapacity : window.maxGuestsInWindow,
        guests: ctx.guests,
      });

    case "WINDOW_FULL":
      return party.err.windowFull.row;

    case "AGE_GAP_EXCEEDED": {
      const ages = window.detail.existingAges;
      const otherAge = Array.isArray(ages) && typeof ages[0] === "number" ? ages[0] : null;
      if (otherAge === null) break;
      return interpolate(party.err.ageConflict.row, {
        otherAge,
        ageBand: config.maxAgeDifferenceYears,
      });
    }

    case "NO_GAME_CAPACITY":
    case "ARENA_FULL":
      return party.err.arenaConflict.row;

    case "EXCEEDS_MAX_PARTY_SIZE":
      return interpolate(party.err.maxPartySize.title, {
        maxGuests: config.maxPartyGuests,
      });

    case "MIN_LEAD_TIME_NOT_MET":
      return party.err.noticeParty.title;

    case "PAST_DATE":
      return party.err.past.title;

    case "BEYOND_HORIZON":
      return party.err.horizon.title;

    case "VENUE_CLOSED":
      return interpolate(party.err.dayClosed.title, { date: ctx.dateLabel });

    case "ROOM_DOUBLE_BOOKED":
      return party.err.roomDoubleBooked.title;

    case "INVALID_HONOREE_AGE":
      return interpolate(party.err.field.age.range, { phone: config.venuePhone });

    default:
      break;
  }
  return party.err.server.generic.title;
}

/** The card's status chip. Bay counts come from the engine's room-slot accounting, not a guess. */
export function windowStatus(
  window: PartyWindowAvailability,
): { label: string; tone: TagTone; hatched?: boolean } {
  if (!window.available || window.roomSlotsFree === 0) {
    return { label: party.p2.window.status.full, tone: "full", hatched: true };
  }
  if (window.roomSlotsFree === 1) {
    return { label: party.p2.window.status.oneBayOpen, tone: "accent" };
  }
  return {
    label: interpolate(party.p2.window.status.baysOpen, { n: window.roomSlotsFree }),
    tone: "accent",
  };
}

export function presentWindow(
  window: PartyWindowAvailability,
  ctx: WindowRowContext,
): WindowPresentation {
  const roomMax = window.selection?.capacity ?? window.remainingCapacity ?? window.maxGuestsInWindow;
  return {
    available: window.available,
    bayState: bayStateFor(window.available ? null : window.reason),
    stateWord: stateWordFor(window.available ? null : window.reason),
    status: windowStatus(window),
    reason: windowReason(window, ctx),
    capacityLabel: interpolate(party.p2.window.capacity, {
      roomMax: roomMax > 0 ? roomMax : window.maxGuestsInWindow,
    }),
  };
}

/**
 * The whole-day verdict. `DAY_FULL` and `DAY_CLOSED` are separate designed states in
 * STRATEGY §3.2 and must not collapse into one another: "we are closed" and "nothing here fits
 * your party" have different recoveries.
 */
export type DayVerdict = "OK" | "DAY_CLOSED" | "DAY_FULL";

export function dayVerdict(day: {
  closed: boolean;
  windows: readonly { available: boolean }[];
}): DayVerdict {
  if (day.closed || day.windows.length === 0) return "DAY_CLOSED";
  return day.windows.some((w) => w.available) ? "OK" : "DAY_FULL";
}
