/**
 * Pure view logic for the laser tag time grid.
 *
 * Nothing here touches React, Prisma, the clock or the DOM: it takes the engine's
 * `PublicAvailability` and turns it into the shapes the screen renders — tile states, hour
 * groups, date-strip statuses, and the "nearest time that works" lists every rejection in
 * COPY.md §8 needs in order to offer a real alternative instead of "try another time".
 *
 * It lives here rather than in `src/lib/domain` because none of it is a business rule: the
 * engine decides what is bookable, this decides how that is displayed and which alternatives
 * are worth offering. It is separated out so it can be tested without a database or a render.
 */

import type { DateAvailability } from "@/components/ui/date-picker";
import type { SlotState } from "@/components/ui/slot-tile";
import type { BookingErrorCode, PublicAvailability, PublicSlotStatus } from "@/lib/domain";

/**
 * A bookable slot is shown as FILLING rather than OPEN once its remaining spots fall to a
 * quarter of the arena or fewer — DESIGN §5.6 draws OPEN at 18/25 and FILLING at 4/25.
 *
 * This is a display threshold, not a business rule: nothing is refused because of it, so it
 * is deliberately not a `CFG.*` setting. The arena cap it is derived from is.
 */
export const FILLING_FRACTION = 0.25;

export function fillingThreshold(arenaCapacity: number): number {
  return Math.floor(arenaCapacity * FILLING_FRACTION);
}

/**
 * The tile state for one slot — DESIGN §5.6's six states, keyed off the engine's reason code.
 *
 * `PARTIAL_BLOCK` renders as `full`: from the customer's side the *block* they asked for has
 * no room, and the tap sheet (COPY.md §8.6) is what explains that it is the second game and
 * not the first. `PARTY_ONLY_WINDOW` renders as `party` for the same reason — the cell reads
 * as held, and §8.3 supplies the weekend-morning explanation behind it.
 */
export function tileStateFor(slot: PublicSlotStatus, arenaCapacity: number): SlotState {
  if (slot.available) {
    return slot.seatsRemaining <= fillingThreshold(arenaCapacity) ? "filling" : "open";
  }
  switch (slot.reason) {
    case "ONLINE_CUTOFF":
      return "tooSoon";
    case "SLOT_HELD_FOR_PARTY":
    case "PARTY_ONLY_WINDOW":
      return "party";
    case "SLOT_UNAVAILABLE":
      return "blocked";
    case "ARENA_FULL":
    case "PARTIAL_BLOCK":
      return "full";
    default:
      // Shape rejections (bad player/game count) can only reach here from a tampered draft,
      // and the honest rendering is "not bookable" rather than a guess at a nicer reason.
      return "blocked";
  }
}

export interface HourGroup {
  /** Minutes from local midnight for the top of the hour, e.g. 1080 for 6:00 PM. */
  hourMinutes: number;
  slots: PublicSlotStatus[];
}

/**
 * Group the day's starts under their hour, in ascending time order — DESIGN §4.5's sticky
 * hour headers. A 40-tile day is unscannable without them.
 */
export function groupByHour(slots: readonly PublicSlotStatus[]): HourGroup[] {
  const groups: HourGroup[] = [];
  for (const slot of [...slots].sort((a, b) => a.startMinutes - b.startMinutes)) {
    const hourMinutes = Math.floor(slot.startMinutes / 60) * 60;
    const last = groups[groups.length - 1];
    if (last && last.hourMinutes === hourMinutes) {
      last.slots.push(slot);
    } else {
      groups.push({ hourMinutes, slots: [slot] });
    }
  }
  return groups;
}

/**
 * The bookable starts nearest a rejected one, closest first, ties broken by the later time.
 *
 * "Recovery by alternative" (STRATEGY §0) is the reason every rejection copy string has an
 * `{altTime1}` in it: we never say "pick another time" without naming one that works, and the
 * list comes from the same engine call that rejected the choice.
 */
export function nearestAvailable(
  slots: readonly PublicSlotStatus[],
  fromMinutes: number,
  limit: number,
): PublicSlotStatus[] {
  return [...slots]
    .filter((slot) => slot.available && slot.startMinutes !== fromMinutes)
    .sort((a, b) => {
      const byDistance =
        Math.abs(a.startMinutes - fromMinutes) - Math.abs(b.startMinutes - fromMinutes);
      return byDistance !== 0 ? byDistance : b.startMinutes - a.startMinutes;
    })
    .slice(0, limit);
}

/**
 * Inside a multi-game block that was rejected as `PARTIAL_BLOCK`, the first start that is not
 * itself bookable — the `{altTime1}` in COPY.md §8.6 ("the 6:30 PM game right after it").
 *
 * `singleGameSlots` is the same date evaluated for **one** game, so each entry answers "could
 * this group play this single start" without the block constraint folded in.
 */
export function firstFailingStart(
  blockStartMinutes: readonly number[],
  singleGameSlots: readonly PublicSlotStatus[],
): number | null {
  const byStart = new Map(singleGameSlots.map((slot) => [slot.startMinutes, slot]));
  for (const startMinutes of blockStartMinutes.slice(1)) {
    const slot = byStart.get(startMinutes);
    if (!slot || !slot.available) return startMinutes;
  }
  return null;
}

/** The end of a block of games: the last start plus one game's duration. */
export function blockEndMinutes(
  blockStartMinutes: readonly number[],
  gameDurationMinutes: number,
): number {
  if (blockStartMinutes.length === 0) {
    throw new Error("A game block must contain at least one start time.");
  }
  return blockStartMinutes[blockStartMinutes.length - 1] + gameDurationMinutes;
}

/**
 * The date strip's four-way status — DESIGN §5.5, COPY.md `g2.dateStrip.status.*`.
 *
 * `limited` is not a guess: it means every remaining bookable start on that day is already in
 * the FILLING band, so a customer can see before tapping that the day is nearly gone.
 */
export function dateAvailabilityFor(
  day: PublicAvailability,
  arenaCapacity: number,
): DateAvailability {
  if (day.closed) return "closed";
  const bookable = day.slots.filter((slot) => slot.available);
  if (bookable.length === 0) return "none";
  const threshold = fillingThreshold(arenaCapacity);
  return bookable.every((slot) => slot.seatsRemaining <= threshold) ? "limited" : "open";
}

/**
 * Why a whole day has nothing for this group, distinguished the way COPY.md §8.15 and §8.16
 * distinguish it: closed is a different sentence from full, and both are different from a day
 * that simply has no games on the schedule.
 */
export type DayOutcome = "OK" | "DAY_CLOSED" | "DAY_FULL" | "NO_GAMES";

export function dayOutcomeFor(day: PublicAvailability): DayOutcome {
  if (day.closed) return "DAY_CLOSED";
  if (day.slots.length === 0) return "NO_GAMES";
  return day.slots.some((slot) => slot.available) ? "OK" : "DAY_FULL";
}

/**
 * The next dates with a bookable start, for the `{altDate1} from {altTime1}` recovery in
 * COPY.md §8.15. Days are expected in ascending calendar order.
 */
export function nextDaysWithRoom(
  days: readonly PublicAvailability[],
  fromDate: string,
  limit: number,
): { date: string; startMinutes: number }[] {
  const out: { date: string; startMinutes: number }[] = [];
  for (const day of days) {
    if (day.date <= fromDate) continue;
    if (day.nextAvailableStartMinutes === null) continue;
    out.push({ date: day.date, startMinutes: day.nextAvailableStartMinutes });
    if (out.length === limit) break;
  }
  return out;
}

/** The next open day at or after `fromDate`, for the `DAY_CLOSED` recovery. */
export function nextOpenDay(
  days: readonly PublicAvailability[],
  fromDate: string,
): PublicAvailability | null {
  return days.find((day) => day.date > fromDate && !day.closed && day.slots.length > 0) ?? null;
}

/**
 * The reason a whole day's grid should be replaced by a panel, or `null` when the grid stands.
 * Kept separate from `dayOutcomeFor` so the caller can render a panel *and* the grid when only
 * some cells are unavailable.
 */
export function gridReasonCode(day: PublicAvailability): BookingErrorCode | null {
  return day.closed ? (day.closedReason ?? "VENUE_CLOSED") : null;
}
