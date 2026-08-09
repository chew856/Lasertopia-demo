/**
 * "Recovery-by-alternative" (STRATEGY §0): whenever we reject a choice we offer the nearest
 * valid alternatives, computed by the same engine that rejected it — never "try another time".
 *
 * Every §8 party rejection body names `{altWindow1}` and `{altWindow2}`, so this is what makes
 * that copy renderable at all.
 */

import {
  addDays,
  getPartyAvailability,
  localDateOf,
  type Catalog,
  type EngineConfig,
  type LocalDateString,
  type PartyDayAvailability,
} from "@/lib/domain";
import { formatDateShort, formatTimeRange } from "@/lib/format";

import { loadDayStates } from "./day-state";
import { dateRange, nearestFittingWindows } from "./calendar";

/** How far ahead a rejection looks for somewhere to send the customer instead. */
export const ALTERNATIVE_SEARCH_DAYS = 45;

export interface AlternativeWindow {
  date: LocalDateString;
  partyWindowId: string;
  /** `Sun, Aug 23 · 1:00 – 3:00 PM` — COPY.md §0.3's `{altWindow1}` shape. */
  formatted: string;
  dateShort: string;
  windowLabel: string;
}

export interface AvailabilityScan {
  today: LocalDateString;
  days: PartyDayAvailability[];
}

/**
 * Availability for a run of dates, for this guest count and this honoree age.
 *
 * One database round trip for the whole range; the engine then answers each `(date, window)`
 * question in memory. The range is clamped by `CFG.bookingHorizonDays` so a hand-edited query
 * string cannot ask the venue for two years of calendar.
 */
export async function scanAvailability(args: {
  now: Date;
  from: LocalDateString;
  days: number;
  guests: number;
  honoreeAge: number;
  catalog: Catalog;
  config: EngineConfig;
  packageCode?: string;
  extraDates?: readonly LocalDateString[];
}): Promise<AvailabilityScan> {
  const { now, catalog, config } = args;
  const today = localDateOf(now, config.timezone);
  const horizonEnd = addDays(today, config.bookingHorizonDays);

  const scanned = dateRange(args.from, addDays(args.from, Math.max(0, args.days - 1)));
  const dates = [...new Set([...scanned, ...(args.extraDates ?? [])])]
    .filter((date) => date >= today && date <= horizonEnd)
    .sort();

  const states = await loadDayStates(dates, now, catalog, config);

  const days = dates.map((date) =>
    getPartyAvailability({
      now,
      date,
      guests: args.guests,
      honoreeAge: args.honoreeAge,
      packageCode: args.packageCode,
      channel: "ONLINE",
      catalog,
      config,
      dayState: states.get(date) ?? { date, partyBookings: [], publicBookings: [], blockedSlotMinutes: [] },
    }),
  );

  return { today, days };
}

export function formatAlternatives(
  scan: AvailabilityScan,
  limit: number,
  exclude: { date?: LocalDateString; partyWindowId?: string } = {},
): AlternativeWindow[] {
  return nearestFittingWindows(scan.days, limit, exclude).map((option) => ({
    date: option.date,
    partyWindowId: option.partyWindowId,
    dateShort: formatDateShort(option.date),
    windowLabel: formatTimeRange(option.startMinutes, option.endMinutes),
    formatted: `${formatDateShort(option.date)} · ${formatTimeRange(option.startMinutes, option.endMinutes)}`,
  }));
}

/** The two nearest windows that fit, ready to drop into `{altWindow1}` / `{altWindow2}`. */
export async function findAlternatives(args: {
  now: Date;
  guests: number;
  honoreeAge: number;
  catalog: Catalog;
  config: EngineConfig;
  limit?: number;
  exclude?: { date?: LocalDateString; partyWindowId?: string };
}): Promise<AlternativeWindow[]> {
  const today = localDateOf(args.now, args.config.timezone);
  const scan = await scanAvailability({
    now: args.now,
    from: today,
    days: ALTERNATIVE_SEARCH_DAYS,
    guests: args.guests,
    honoreeAge: args.honoreeAge,
    catalog: args.catalog,
    config: args.config,
  });
  return formatAlternatives(scan, args.limit ?? 2, args.exclude ?? {});
}
