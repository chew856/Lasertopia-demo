/**
 * Calendar arithmetic and the month rollup for screen P2.
 *
 * Pure. A date is a `"YYYY-MM-DD"` wall-clock string throughout, never a `Date` — a `Date` at
 * UTC midnight is the previous local day in Winnipeg, and a calendar that is one day out is a
 * booking taken on the wrong day.
 *
 * The rollup mark is the whole reason P1 comes before P2: `anyAvailable` is computed for
 * *this* party, so "full" here means "no window fits 16 guests turning 9", not "the venue is
 * full". COPY.md `p2.date.status.full` is worded for exactly that distinction.
 */

import type { DateAvailability } from "@/components/ui";
import {
  addDays,
  daysBetween,
  formatLocalDate,
  parseLocalDate,
  type LocalDateString,
  type PartyDayAvailability,
} from "@/lib/domain";

/** Every date in the month containing `anchor`, in calendar order. */
export function monthDates(anchor: LocalDateString): LocalDateString[] {
  const { year, month } = parseLocalDate(anchor);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: LocalDateString[] = [];
  for (let day = 1; day <= days; day += 1) {
    out.push(formatLocalDate({ year, month, day }));
  }
  return out;
}

/** The first of the month `delta` months away from `anchor`. Clamps nothing; day is always 1. */
export function shiftMonth(anchor: LocalDateString, delta: number): LocalDateString {
  const { year, month } = parseLocalDate(anchor);
  const zeroBased = year * 12 + (month - 1) + delta;
  return formatLocalDate({
    year: Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1,
    day: 1,
  });
}

/** The first of the month a date sits in. */
export function startOfMonth(date: LocalDateString): LocalDateString {
  const { year, month } = parseLocalDate(date);
  return formatLocalDate({ year, month, day: 1 });
}

/** Inclusive date range, capped so a bad query string cannot ask for ten thousand days. */
export function dateRange(
  from: LocalDateString,
  to: LocalDateString,
  maxDays = 400,
): LocalDateString[] {
  const span = Math.min(daysBetween(from, to), maxDays);
  const out: LocalDateString[] = [];
  for (let i = 0; i <= span; i += 1) out.push(addDays(from, i));
  return out;
}

/**
 * The calendar cell's mark. Four states, and each one has its own sentence in COPY.md §5.2:
 * `open` (more than one window fits), `limited` (exactly one — the real "book now" signal),
 * `none` (nothing fits *this* party), `closed` (the venue is not running parties that day).
 */
export function dateMarkFor(day: PartyDayAvailability): DateAvailability {
  if (day.closed || day.windows.length === 0) return "closed";
  const open = day.windows.filter((w) => w.available).length;
  if (open === 0) return "none";
  if (open === 1) return "limited";
  return "open";
}

export interface WindowOption {
  date: LocalDateString;
  partyWindowId: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  capacity: number;
}

/**
 * The nearest windows that actually fit this party, in date-then-time order.
 *
 * This is STRATEGY §0's "recovery-by-alternative": every rejection on P2 offers concrete
 * alternatives computed by the same engine that produced the rejection, so the copy can name
 * `{altWindow1}` and `{altWindow2}` instead of saying "try another time".
 */
export function nearestFittingWindows(
  days: readonly PartyDayAvailability[],
  limit: number,
  exclude: { date?: LocalDateString; partyWindowId?: string } = {},
): WindowOption[] {
  const out: WindowOption[] = [];
  for (const day of days) {
    if (day.closed) continue;
    for (const window of [...day.windows].sort((a, b) => a.startMinutes - b.startMinutes)) {
      if (!window.available || !window.selection) continue;
      if (exclude.date === day.date && exclude.partyWindowId === window.partyWindowId) continue;
      out.push({
        date: day.date,
        partyWindowId: window.partyWindowId,
        label: window.label,
        startMinutes: window.startMinutes,
        endMinutes: window.endMinutes,
        capacity: window.selection.capacity,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** The next date on which anything at all is bookable for this party. Drives "Go to {date}". */
export function nextOpenDate(
  days: readonly PartyDayAvailability[],
  after?: LocalDateString,
): LocalDateString | null {
  for (const day of days) {
    if (after !== undefined && day.date <= after) continue;
    if (day.anyAvailable) return day.date;
  }
  return null;
}

/** How many windows in a set of days fit this party. Fills `{monthCount}` in `err.monthEmpty`. */
export function fittingWindowCount(days: readonly PartyDayAvailability[]): number {
  return days.reduce((sum, day) => sum + day.windows.filter((w) => w.available).length, 0);
}

/**
 * Would a smaller party open windows this one cannot use? Answers COPY.md
 * `err.dayFull.party.action.tertiary`, which may only be offered when it is genuinely true.
 */
export function largestCountThatFits(day: PartyDayAvailability): number {
  return day.windows.reduce((max, w) => Math.max(max, w.remainingCapacity), 0);
}
