/**
 * Wall-clock time in America/Winnipeg.
 *
 * Three rules this module exists to enforce:
 *  1. R-01 — every customer-observable comparison happens in the venue's local zone, so a
 *     DST transition never shifts a game time or a party window.
 *  2. No domain function reads the clock. `now: Date` is always a parameter, which is what
 *     makes the engine deterministically testable.
 *  3. Calendar dates are wall-clock strings ("2026-09-15"), not instants. A `Date` pinned to
 *     "UTC midnight" is the previous local day in Winnipeg, which is a whole class of
 *     off-by-one-day bugs this representation cannot have.
 *
 * Implementation note: conversion uses `Intl.DateTimeFormat` with an IANA zone rather than a
 * date library. Node ships full ICU, the zone database is maintained by the platform, and it
 * keeps the dependency count at zero for something the standard library already does well.
 */

/** IANA zone id. Always passed explicitly; never defaulted from the server's locale. */
export type TimeZone = string;

/** A local calendar date, "YYYY-MM-DD" in the venue's zone. */
export type LocalDateString = string;

export interface LocalDateParts {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

export interface ZonedParts extends LocalDateParts {
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
  /** 0-59 */
  second: number;
  /** 0 = Sunday .. 6 = Saturday */
  dayOfWeek: number;
  /** Minutes from local midnight. */
  minutesOfDay: number;
}

export class TimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeError';
  }
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatterCache = new Map<TimeZone, Intl.DateTimeFormat>();

function formatterFor(timeZone: TimeZone): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function parseLocalDate(date: LocalDateString): LocalDateParts {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new TimeError(`"${date}" is not a valid calendar date. Expected the form YYYY-MM-DD.`);
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new TimeError(`"${date}" is not a real calendar date.`);
  }
  // Round-trip check catches 2026-02-30 and friends.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new TimeError(`"${date}" is not a real calendar date.`);
  }
  return { year, month, day };
}

export function formatLocalDate(parts: LocalDateParts): LocalDateString {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** 0 = Sunday .. 6 = Saturday, for a wall-clock calendar date (zone-independent). */
export function dayOfWeekFor(date: LocalDateString): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Add (or subtract) whole calendar days to a wall-clock date. DST-safe by construction. */
export function addDays(date: LocalDateString, days: number): LocalDateString {
  const { year, month, day } = parseLocalDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/** Whole calendar days from `from` to `to`; negative when `to` precedes `from`. */
export function daysBetween(from: LocalDateString, to: LocalDateString): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  const msPerDay = 86_400_000;
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / msPerDay,
  );
}

/** Break an absolute instant into the venue's wall-clock fields. */
export function toZonedParts(instant: Date, timeZone: TimeZone): ZonedParts {
  if (Number.isNaN(instant.getTime())) {
    throw new TimeError('Cannot convert an Invalid Date to local time.');
  }
  const parts = formatterFor(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new TimeError(`Time zone "${timeZone}" produced no ${type} field.`);
    return Number.parseInt(found.value, 10);
  };
  const year = read('year');
  const month = read('month');
  const day = read('day');
  // `hourCycle: 'h23'` still emits "24" for midnight in some ICU versions; normalise.
  const hour = read('hour') % 24;
  const minute = read('minute');
  const second = read('second');
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    minutesOfDay: hour * 60 + minute,
  };
}

/** The venue-local calendar date an instant falls on. */
export function localDateOf(instant: Date, timeZone: TimeZone): LocalDateString {
  return formatLocalDate(toZonedParts(instant, timeZone));
}

/** Minutes from local midnight for an instant. */
export function localMinutesOf(instant: Date, timeZone: TimeZone): number {
  return toZonedParts(instant, timeZone).minutesOfDay;
}

function offsetMsAt(instant: Date, timeZone: TimeZone): number {
  const p = toZonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - instant.getTime();
}

/**
 * Wall clock -> instant. `minutesOfDay` may exceed 1439 (e.g. a window that runs past
 * midnight); the arithmetic handles it.
 *
 * The two-pass correction is what makes this safe across DST: the first pass guesses the
 * offset from the naive instant, the second re-reads the offset at the corrected instant and
 * redoes the conversion if the guess landed on the wrong side of a transition.
 */
export function zonedTimeToUtc(
  date: LocalDateString,
  minutesOfDay: number,
  timeZone: TimeZone,
): Date {
  const { year, month, day } = parseLocalDate(date);
  const naive = Date.UTC(year, month - 1, day, 0, minutesOfDay);
  const firstOffset = offsetMsAt(new Date(naive), timeZone);
  const firstPass = new Date(naive - firstOffset);
  const secondOffset = offsetMsAt(firstPass, timeZone);
  if (secondOffset === firstOffset) return firstPass;
  return new Date(naive - secondOffset);
}

/** Convenience: minutes-from-midnight -> "5:15 PM" for customer copy. */
export function formatClock(minutesOfDay: number): string {
  const normalised = ((minutesOfDay % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalised / 60);
  const minute = normalised % 60;
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** Convenience: minutes-from-midnight -> "17:15" for logs, tests and manager screens. */
export function formatClock24(minutesOfDay: number): string {
  const normalised = ((minutesOfDay % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalised / 60)).padStart(2, '0')}:${String(normalised % 60).padStart(2, '0')}`;
}

/** "17:15" -> 1035. Used by the seed and by manager input parsing. */
export function parseClock24(text: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) {
    throw new TimeError(`"${text}" is not a valid time of day. Expected 24-hour "HH:MM", e.g. "17:15".`);
  }
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour > 47 || minute > 59) {
    throw new TimeError(`"${text}" is not a valid time of day.`);
  }
  return hour * 60 + minute;
}

/**
 * R-56 — whole days of notice between `now` and an event, in venue-local wall-clock terms.
 *
 * Deliberately calendar arithmetic and not `(eventMs - nowMs) / 86400000`: a span crossing a
 * DST boundary contains a 23- or 25-hour day, and dividing by a fixed 24 hours would move the
 * 14-day boundary by an hour twice a year — for a rule that decides whether a customer keeps
 * $50, that is not acceptable.
 *
 * Returns a floor: 14 days and 5 hours is 14; 13 days and 23 hours is 13.
 */
export function wholeDaysBetween(now: Date, event: Date, timeZone: TimeZone): number {
  const nowParts = toZonedParts(now, timeZone);
  const eventParts = toZonedParts(event, timeZone);
  const calendarDays = daysBetween(formatLocalDate(nowParts), formatLocalDate(eventParts));
  const nowSeconds = nowParts.minutesOfDay * 60 + nowParts.second;
  const eventSeconds = eventParts.minutesOfDay * 60 + eventParts.second;
  return eventSeconds >= nowSeconds ? calendarDays : calendarDays - 1;
}
