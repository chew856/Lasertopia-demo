/**
 * Display formatting — the single implementation of COPY.md §1.
 *
 * §1 is a table of formatting *rules*, not strings, with the instruction "implement once as
 * helpers". This is that implementation. Every `fmt.*` key maps to exactly one export:
 *
 * | COPY.md §1 key        | Helper                     | Example                        |
 * |-----------------------|----------------------------|--------------------------------|
 * | `fmt.time`            | `formatTime`               | `7:45 PM`                      |
 * | `fmt.time.compact`    | `formatTimeCompact`        | `5:15`                         |
 * | `fmt.range`           | `formatTimeRange`          | `1:00 – 3:00 PM`               |
 * | `fmt.block`           | `formatBlock`              | `6:00 → 6:30 PM`               |
 * | `fmt.block.sub`       | `formatBlockSub`           | `6:00 · 6:15`                  |
 * | `fmt.date.long`       | `formatDateLong`           | `Saturday, August 22`          |
 * | `fmt.date.short`      | `formatDateShort`          | `Sat, Aug 22`                  |
 * | `fmt.date.iso`        | `formatDateIso`            | `2026-08-22`                   |
 * | `fmt.list.times`      | `formatTimeList`           | `1:15 PM and 1:45 PM`          |
 * | `fmt.money`           | `formatMoney`              | `$224.50`                      |
 * | `fmt.money.cad`       | `formatMoneyCad`           | `$224.50 CAD`                  |
 * | `fmt.money.perPerson` | `formatMoneyPerPerson`     | `$15.49 per person`            |
 * | `fmt.percent`         | `formatPercent`            | `12%`                          |
 * | `fmt.duration.hours`  | `formatDurationHours`      | `2 hours`                      |
 * | `fmt.duration.minutes`| `formatDurationMinutes`    | `90 minutes`                   |
 * | `fmt.countdown`       | `formatCountdown`          | `4:12`                         |
 * | `fmt.code`            | `formatBookingCode`        | `PT-4KJ2QW9X`                  |
 * | `fmt.phone`           | `formatPhone`              | `204-474-5900`                 |
 * | `fmt.capacity`        | `formatCapacity`           | `14 / 25`                      |
 * | §1.1 units            | `unitLabel` / `formatCount`| `6 players`                    |
 *
 * Three invariants, all of them load-bearing:
 *
 * 1. **No formatter reads the clock.** Nothing here calls `new Date()`. "Is this the current
 *    year" is a parameter, not an ambient fact — the same reason no domain function reads the
 *    clock, and the reason these are deterministically testable.
 * 2. **Money arrives as integer cents.** The engine speaks `Cents`; a float never reaches a
 *    formatter, and `cents()` throws rather than silently truncating one that does.
 * 3. **Times of day are minutes from local midnight** and calendar dates are `"YYYY-MM-DD"`
 *    wall-clock strings, matching `src/lib/domain/time.ts`. A `Date` at UTC midnight is the
 *    previous local day in Winnipeg, which is a whole class of off-by-one-day bugs this
 *    representation cannot have.
 *
 * Words come from COPY.md. Unit nouns are read off `copy/global` so "spot" is spelled in
 * exactly one place; nothing here invents prose.
 */

import { unit } from "@/lib/copy/global";
import { cents, formatMoney as formatCentsAsMoney, type Cents } from "@/lib/domain/money";
import {
  localDateOf,
  localMinutesOf,
  parseLocalDate,
  type LocalDateString,
  type TimeZone,
} from "@/lib/domain/time";

export type { LocalDateString } from "@/lib/domain/time";

/** COPY.md is written in Canadian English and prices are CAD. */
export const LOCALE = "en-CA";

/** Every customer-observable time in this product is Winnipeg wall clock. */
export const VENUE_TIME_ZONE: TimeZone = "America/Winnipeg";

// A non-breaking space keeps "7:45 PM" from wrapping between the figure and the meridiem,
// which is exactly where a narrow tile would break it.
const NBSP = "\u00A0"; // U+00A0, written as an escape so an editor cannot eat it
const EN_DASH = "–";
const ARROW = "→";
const MIDDOT = "·";

export class FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormatError";
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function assertInteger(value: number, what: string): void {
  if (!Number.isInteger(value)) {
    throw new FormatError(
      `${what} must be a whole number, received ${value}. Round or floor it before formatting.`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Time of day — minutes from local midnight
// ─────────────────────────────────────────────────────────────────────────────────────────

export type Meridiem = "AM" | "PM";

interface ClockParts {
  hour12: number;
  minute: number;
  meridiem: Meridiem;
}

function clockParts(minutesOfDay: number): ClockParts {
  assertInteger(minutesOfDay, "A time of day in minutes");
  const normalised = ((minutesOfDay % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalised / 60);
  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute: normalised % 60,
    meridiem: hour24 < 12 ? "AM" : "PM",
  };
}

/** `fmt.time` — 12-hour, no leading zero, uppercase meridiem after a non-breaking space. */
export function formatTime(minutesOfDay: number): string {
  const { hour12, minute, meridiem } = clockParts(minutesOfDay);
  return `${hour12}:${pad2(minute)}${NBSP}${meridiem}`;
}

/** `fmt.time.compact` — dense grids and chips, where a group header carries the meridiem. */
export function formatTimeCompact(minutesOfDay: number): string {
  const { hour12, minute } = clockParts(minutesOfDay);
  return `${hour12}:${pad2(minute)}`;
}

/** `AM` or `PM` on its own, for a group header that carries the meridiem for its tiles. */
export function meridiemOf(minutesOfDay: number): Meridiem {
  return clockParts(minutesOfDay).meridiem;
}

function joinTimes(startMinutes: number, endMinutes: number, separator: string): string {
  const start = clockParts(startMinutes);
  const end = clockParts(endMinutes);
  // Meridiem shown once when both ends share it — "1:00 – 3:00 PM", not "1:00 PM – 3:00 PM".
  if (start.meridiem === end.meridiem) {
    return `${start.hour12}:${pad2(start.minute)}${separator}${formatTime(endMinutes)}`;
  }
  return `${formatTime(startMinutes)}${separator}${formatTime(endMinutes)}`;
}

/** `fmt.range` — en dash with a space either side. `1:00 – 3:00 PM`, `10:00 AM – 12:00 PM`. */
export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return joinTimes(startMinutes, endMinutes, ` ${EN_DASH} `);
}

/** `fmt.block` — a multi-game booking, first start to end of last game. `6:00 → 6:30 PM`. */
export function formatBlock(startMinutes: number, endMinutes: number): string {
  return joinTimes(startMinutes, endMinutes, ` ${ARROW} `);
}

/** `fmt.block.sub` — the individual starts inside a block, middot separated. `6:00 · 6:15`. */
export function formatBlockSub(startMinutes: readonly number[]): string {
  if (startMinutes.length === 0) {
    throw new FormatError("A game block must contain at least one start time.");
  }
  return startMinutes.map(formatTimeCompact).join(` ${MIDDOT} `);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Calendar dates — "YYYY-MM-DD" wall-clock strings
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * A calendar date carries no zone, so it is formatted through a UTC anchor. Formatting
 * "2026-08-22" in America/Winnipeg would render the 21st, because UTC midnight is the
 * previous evening in Winnipeg.
 */
function anchor(date: LocalDateString): Date {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

const UTC = "UTC";

const longDate = new Intl.DateTimeFormat(LOCALE, {
  timeZone: UTC,
  weekday: "long",
  month: "long",
  day: "numeric",
});

const longDateWithYear = new Intl.DateTimeFormat(LOCALE, {
  timeZone: UTC,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat(LOCALE, {
  timeZone: UTC,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const weekdayLong = new Intl.DateTimeFormat(LOCALE, { timeZone: UTC, weekday: "long" });
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { timeZone: UTC, weekday: "short" });
const monthLong = new Intl.DateTimeFormat(LOCALE, { timeZone: UTC, month: "long" });

/**
 * `fmt.date.long` — `Saturday, August 22`. The year is appended only when the date is not in
 * the current year, so pass the current year in: no formatter reads the clock.
 *
 * ```ts
 * formatDateLong('2026-08-22', { currentYear: 2026 })  // "Saturday, August 22"
 * formatDateLong('2027-08-22', { currentYear: 2026 })  // "Sunday, August 22, 2027"
 * ```
 */
export function formatDateLong(
  date: LocalDateString,
  options: { currentYear?: number } = {},
): string {
  const { year } = parseLocalDate(date);
  const showYear = options.currentYear !== undefined && options.currentYear !== year;
  return (showYear ? longDateWithYear : longDate).format(anchor(date));
}

/** `fmt.date.short` — abbreviated weekday, abbreviated month, day. `Sat, Aug 22`. */
export function formatDateShort(date: LocalDateString): string {
  return shortDate.format(anchor(date));
}

/** `fmt.date.iso` — manager surfaces, exports and URLs only. Never shown to customers. */
export function formatDateIso(date: LocalDateString): LocalDateString {
  parseLocalDate(date); // validates; throws a named error on "2026-02-30"
  return date;
}

/** `Saturday` / `Sat`. The date strip uppercases the short form itself. */
export function formatWeekday(
  date: LocalDateString,
  style: "long" | "short" = "long",
): string {
  return (style === "long" ? weekdayLong : weekdayShort).format(anchor(date));
}

/** `August` — month grid and date strip headers. */
export function formatMonth(date: LocalDateString): string {
  return monthLong.format(anchor(date));
}

/** `22` — the day number in a date-strip tile or month cell. No leading zero. */
export function formatDayNumber(date: LocalDateString): string {
  return String(parseLocalDate(date).day);
}

/** The venue-local calendar date an instant falls on. Takes the instant in; reads no clock. */
export function venueDateOf(instant: Date): LocalDateString {
  return localDateOf(instant, VENUE_TIME_ZONE);
}

/** Minutes from venue-local midnight for an instant. Takes the instant in; reads no clock. */
export function venueMinutesOf(instant: Date): number {
  return localMinutesOf(instant, VENUE_TIME_ZONE);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Lists
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * `fmt.list.times` behaviour, generalised: two items joined with "and", three or more with
 * commas and a final "and". No serial comma — the deck's example is `1:15 PM and 1:45 PM`.
 */
export function formatList(items: readonly string[]): string {
  if (items.length === 0) {
    throw new FormatError("Cannot format an empty list. Guard the empty case in the caller.");
  }
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** `fmt.list.times` — `1:15 PM and 1:45 PM`. */
export function formatTimeList(startMinutes: readonly number[]): string {
  return formatList(startMinutes.map(formatTime));
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Money — integer cents in, formatted string out
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * `cents()` brands and validates. A fractional value throws here rather than rendering
 * `$259.499999` three screens later.
 */
function asCents(value: number | Cents): Cents {
  return cents(value);
}

/** `fmt.money` — leading `$`, always two decimals, no space, no currency code. `$224.50`. */
export function formatMoney(value: number | Cents): string {
  return formatCentsAsMoney(asCents(value));
}

/** `fmt.money.cad` — where currency must be explicit: email footer, policy, receipts. */
export function formatMoneyCad(value: number | Cents): string {
  return `${formatMoney(value)} CAD`;
}

/** `fmt.money.perPerson` — price followed by the unit on its own. `$15.49 per person`. */
export function formatMoneyPerPerson(value: number | Cents): string {
  return `${formatMoney(value)} per person`;
}

/**
 * `224.50` — no symbol. DESIGN §5.9 omits the symbol in order-summary line items and states
 * the currency once in the panel header, so the amounts align on the decimal point.
 */
export function formatMoneyPlain(value: number | Cents): string {
  return formatCentsAsMoney(asCents(value), { symbol: "" });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Percent, duration, countdown, capacity, codes, phone
// ─────────────────────────────────────────────────────────────────────────────────────────

/** `fmt.percent` — whole number unless the rate has decimals. `12%`, `12.5%`. */
export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) {
    throw new FormatError(`A percentage must be a finite number, received ${percent}.`);
  }
  // `String(12)` is "12" and `String(12.5)` is "12.5", which is exactly the rule: a whole
  // number unless the rate has decimals.
  return `${String(percent)}%`;
}

/**
 * The engine holds tax as thousandths of a percent so the arithmetic stays integral.
 * `formatPercentFromMilli(12000) === '12%'`.
 */
export function formatPercentFromMilli(milliPercent: number): string {
  assertInteger(milliPercent, "A milli-percent rate");
  return formatPercent(milliPercent / 1000);
}

/** `fmt.duration.hours` — whole hours only. `2 hours`, `1 hour`. */
export function formatDurationHours(minutes: number): string {
  assertInteger(minutes, "A duration in minutes");
  if (minutes <= 0 || minutes % 60 !== 0) {
    throw new FormatError(
      `${minutes} minutes is not a whole number of hours. Use formatDuration() so a part-hour ` +
        `renders as minutes — COPY.md §1 forbids "1.5 hrs".`,
    );
  }
  const wholeHours = minutes / 60;
  return `${wholeHours} ${wholeHours === 1 ? "hour" : "hours"}`;
}

/** `fmt.duration.minutes` — a part-hour duration. `90 minutes`. Never `1.5 hrs`. */
export function formatDurationMinutes(minutes: number): string {
  assertInteger(minutes, "A duration in minutes");
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/**
 * The rule from §1, applied: whole hours render as hours, anything else renders as minutes.
 * `formatDuration(120) === '2 hours'`, `formatDuration(90) === '90 minutes'`.
 */
export function formatDuration(minutes: number): string {
  assertInteger(minutes, "A duration in minutes");
  return minutes > 0 && minutes % 60 === 0
    ? formatDurationHours(minutes)
    : formatDurationMinutes(minutes);
}

/** `fmt.countdown` — minutes and seconds, no leading zero on minutes. `4:12`. */
export function formatCountdown(totalSeconds: number): string {
  assertInteger(totalSeconds, "A countdown in seconds");
  const clamped = Math.max(0, totalSeconds);
  return `${Math.floor(clamped / 60)}:${pad2(clamped % 60)}`;
}

/** `fmt.capacity` — used over cap with a spaced slash. `14 / 25`. */
export function formatCapacity(used: number, capacity: number): string {
  assertInteger(used, "A capacity count");
  assertInteger(capacity, "A capacity cap");
  return `${used} / ${capacity}`;
}

/** `fmt.code` — booking codes always uppercase, hyphen retained, never wrapped. */
export function formatBookingCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * `fmt.phone` — hyphenated, never parenthesised. `204-474-5900`.
 *
 * Accepts anything a settings row or a form might hold: `2044745900`, `(204) 474-5900`,
 * `+1 204 474 5900`. A leading North American `1` is dropped.
 */
export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) {
    throw new FormatError(
      `"${input}" is not a 10-digit North American phone number. Store it as 10 digits ` +
        `(optionally with a leading 1) — the display hyphens are added here, not in the data.`,
    );
  }
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}

/** The `href` for a tap-to-call control. `tel:+12044745900`. */
export function formatPhoneHref(input: string): string {
  return `tel:+1${formatPhone(input).replace(/\D/g, "")}`;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Units and pluralisation — §1.1
// ─────────────────────────────────────────────────────────────────────────────────────────

/** The unit nouns from COPY.md §1.1. Spelled in exactly one place: `copy/global.ts`. */
export type UnitKey = keyof typeof unit;

/** The right noun for a count. `unitLabel(1, 'spot') === 'spot'`. */
export function unitLabel(count: number, key: UnitKey): string {
  const forms = unit[key];
  return Math.abs(count) === 1 ? forms.one : forms.other;
}

/** Count and noun together. `formatCount(6, 'player') === '6 players'`. */
export function formatCount(count: number, key: UnitKey): string {
  assertInteger(count, "A count");
  return `${count} ${unitLabel(count, key)}`;
}

/** `16 guests` — the party flow's headline count. Includes the guest of honour. */
export function formatGuests(count: number): string {
  return formatCount(count, "guest");
}

/** `6 players` — the laser tag flow's headline count. Everyone going into the arena. */
export function formatPlayers(count: number): string {
  return formatCount(count, "player");
}

/** `3 spots` — arena seats are called spots to customers, seats never. */
export function formatSpots(count: number): string {
  return formatCount(count, "spot");
}

/** `2 games` — a game runs 15 minutes. */
export function formatGames(count: number): string {
  return formatCount(count, "game");
}
