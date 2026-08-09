/**
 * Party window availability (R-24 to R-37, R-64 to R-66).
 *
 * A window's availability is NOT a property of the window. It is a function of
 * (window, date, guestCount, honoreeAge): Saturday 11:00-1:00 with a party of 10 already in
 * the 12-room is perfectly available to a party of 14 and impossible for a party of 16. That
 * is why every entry point here takes all four, and why the result carries a specific reason
 * code rather than a boolean.
 *
 * Evaluation order matters and is deliberate:
 *   1. size ceiling  (EXCEEDS_MAX_PARTY_SIZE — "call us", not "try another time")
 *   2. calendar      (VENUE_CLOSED / PAST_DATE / BEYOND_HORIZON / MIN_LEAD_TIME_NOT_MET)
 *   3. age rule      (R-35, BEFORE room allocation — see WE-07: a customer must never be
 *                     shown a room that is then pulled away for a reason unrelated to rooms)
 *   4. rooms         (R-30, the physical constraint)
 *   5. arena + games (R-12/R-17, the independent second constraint)
 */

import type { EngineConfig } from './config';
import { ok, reject, type BookingErrorCode, type Result } from './errors';
import { localDateOf, zonedTimeToUtc, daysBetween, type LocalDateString } from './time';
import type { BookingChannel, Catalog, DayState, PartyWindowRecord } from './types';
import { closureFor, partyWindowsFor } from './slots';
import {
  maxCapacityAnywhere,
  maxCapacityInWindow,
  remainingCapacityInWindow,
  roomSlotCounts,
  selectRoomConfiguration,
  type RoomSelection,
} from './rooms';
import { checkWindowAgeRule } from './age';
import { splitArenaGroups } from './arena';
import { assignPartyGameTimes, type AssignedArenaGroup } from './game-assignment';

export interface PartyAvailabilityRequest {
  now: Date;
  date: LocalDateString;
  guests: number;
  honoreeAge: number;
  /** Determines gamesIncluded. Defaults to the largest gamesIncluded across active packages. */
  packageCode?: string;
  channel: BookingChannel;
  catalog: Catalog;
  config: EngineConfig;
  dayState: DayState;
  excludeBookingId?: string;
}

export interface PartyWindowAvailability {
  partyWindowId: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  startsAtUtc: Date;
  endsAtUtc: Date;
  available: boolean;
  /** null when available. Never a bare boolean — the UI writes different copy per code. */
  reason: BookingErrorCode | null;
  message: string | null;
  detail: Record<string, unknown>;
  /** Largest party this window could hold on an empty calendar. */
  maxGuestsInWindow: number;
  /** Largest party it could still hold on THIS date. */
  remainingCapacity: number;
  roomSlotsTotal: number;
  roomSlotsFree: number;
  /** The configuration that would be allocated, when the window is available. */
  selection: RoomSelection | null;
  /** The party's proposed game times, one entry per arena group. */
  arenaGroups: AssignedArenaGroup[] | null;
}

export interface PartyDayAvailability {
  date: LocalDateString;
  closed: boolean;
  closedReason: BookingErrorCode | null;
  windows: PartyWindowAvailability[];
  /** True when at least one window fits this party — the calendar's "open" mark. */
  anyAvailable: boolean;
}

function gamesRequiredFor(req: PartyAvailabilityRequest): number {
  const active = req.catalog.packages.filter((p) => p.isActive);
  if (req.packageCode) {
    const found = active.find((p) => p.code === req.packageCode);
    if (found) return found.gamesIncluded;
  }
  // With no package chosen yet the calendar must not promise a window that only fits the
  // cheapest package's game count, so assume the most demanding active package.
  return active.reduce((max, p) => Math.max(max, p.gamesIncluded), 1);
}

/** Calendar-level gates that apply to every window on the date. */
function checkDate(req: PartyAvailabilityRequest): Result<null> {
  const { catalog, config, date, now } = req;
  const today = localDateOf(now, config.timezone);

  if (date < today) {
    return reject('PAST_DATE', 'That date has already passed. Pick an upcoming date.', { date });
  }
  const horizon = daysBetween(today, date);
  if (horizon > config.bookingHorizonDays) {
    return reject(
      'BEYOND_HORIZON',
      `We are taking bookings up to ${config.bookingHorizonDays} days ahead. Pick an earlier date, or call ${config.venuePhone}.`,
      { horizonDays: config.bookingHorizonDays, requestedDaysAhead: horizon },
    );
  }
  const closure = closureFor(catalog, date);
  if (closure?.blocksParties) {
    return reject('VENUE_CLOSED', `We are closed on ${date}: ${closure.reason}. Pick another date.`, {
      date,
      reason: closure.reason,
    });
  }
  return ok(null);
}

/**
 * Evaluate one window. Returns the same rich shape whether it succeeds or fails, because the
 * availability screen renders inactive rows WITH their reason rather than hiding them.
 */
export function evaluatePartyWindow(
  req: PartyAvailabilityRequest,
  window: PartyWindowRecord,
): PartyWindowAvailability {
  const { catalog, config, date, dayState } = req;
  const startsAtUtc = zonedTimeToUtc(date, window.startMinutes, config.timezone);
  const endsAtUtc = zonedTimeToUtc(date, window.endMinutes, config.timezone);
  const counts = roomSlotCounts(catalog, window, dayState, config, {
    excludeBookingId: req.excludeBookingId,
  });

  const base: PartyWindowAvailability = {
    partyWindowId: window.id,
    label: window.label,
    startMinutes: window.startMinutes,
    endMinutes: window.endMinutes,
    startsAtUtc,
    endsAtUtc,
    available: false,
    reason: null,
    message: null,
    detail: {},
    maxGuestsInWindow: maxCapacityInWindow(catalog, window.id),
    remainingCapacity: remainingCapacityInWindow(catalog, window, dayState, config, {
      excludeBookingId: req.excludeBookingId,
    }),
    roomSlotsTotal: counts.total,
    roomSlotsFree: counts.free,
    selection: null,
    arenaGroups: null,
  };

  const fail = (result: { ok: false; error: { code: BookingErrorCode; message: string; detail: unknown } }) => ({
    ...base,
    available: false,
    reason: result.error.code,
    message: result.error.message,
    detail: result.error.detail as Record<string, unknown>,
  });

  const dateCheck = checkDate(req);
  if (!dateCheck.ok) return fail(dateCheck);

  // R-30 + OQ-30: a window that has already started (or is inside the minimum lead time) is
  // not bookable. The party flow has no 90-minute cutoff of its own; the lead time is config.
  const leadMs = config.partyMinLeadHours * 3_600_000;
  if (req.now.getTime() + leadMs > startsAtUtc.getTime()) {
    return fail(
      reject(
        config.partyMinLeadHours > 0 ? 'MIN_LEAD_TIME_NOT_MET' : 'PAST_DATE',
        config.partyMinLeadHours > 0
          ? `Parties need at least ${config.partyMinLeadHours} hours notice to set up. Pick a later date, or call ${config.venuePhone}.`
          : 'That window has already started. Pick a later window or date.',
        { partyWindowId: window.id, minLeadHours: config.partyMinLeadHours },
      ) as { ok: false; error: { code: BookingErrorCode; message: string; detail: unknown } },
    );
  }

  // R-35 BEFORE R-25 (WE-07).
  const ageCheck = checkWindowAgeRule({
    honoreeAge: req.honoreeAge,
    window,
    dayState,
    config,
    excludeBookingId: req.excludeBookingId,
  });
  if (!ageCheck.ok) return fail(ageCheck);

  const roomResult = selectRoomConfiguration({
    guests: req.guests,
    catalog,
    config,
    window,
    dayState,
    excludeBookingId: req.excludeBookingId,
  });
  if (!roomResult.ok) return fail(roomResult);

  // R-31: rooms passed; the arena is a separate question with a separate answer.
  const arenaGroupSizes = splitArenaGroups(req.guests, config);
  const gamesResult = assignPartyGameTimes({
    date,
    window,
    arenaGroups: arenaGroupSizes,
    gamesRequired: gamesRequiredFor(req),
    honoreeAge: req.honoreeAge,
    catalog,
    config,
    dayState,
    excludeBookingId: req.excludeBookingId,
  });
  if (!gamesResult.ok) return fail(gamesResult);

  return {
    ...base,
    available: true,
    reason: null,
    message: null,
    detail: {},
    selection: roomResult.value,
    arenaGroups: gamesResult.value,
  };
}

/** Every window on a date, with a status and a reason. The party flow's date screen. */
export function getPartyAvailability(req: PartyAvailabilityRequest): PartyDayAvailability {
  const { catalog, config, date } = req;

  const ceiling = Math.min(config.maxPartyGuests, maxCapacityAnywhere(catalog));
  const closure = closureFor(catalog, date);
  const windows = partyWindowsFor(catalog, date);

  if (closure?.blocksParties || windows.length === 0) {
    return {
      date,
      closed: true,
      closedReason: closure ? 'VENUE_CLOSED' : 'VENUE_CLOSED',
      windows: [],
      anyAvailable: false,
    };
  }

  const evaluated = windows.map((w) => evaluatePartyWindow(req, w));

  // A party above the venue ceiling gets one clear "call us", not a wall of per-window noise.
  if (req.guests > ceiling) {
    const message = `Our largest party setup holds ${ceiling} guests. For ${req.guests} guests, please call us at ${config.venuePhone} so we can look at options.`;
    return {
      date,
      closed: false,
      closedReason: null,
      anyAvailable: false,
      windows: evaluated.map((w) => ({
        ...w,
        available: false,
        reason: 'EXCEEDS_MAX_PARTY_SIZE' as BookingErrorCode,
        message,
        detail: { maxPartyGuests: ceiling, requestedGuests: req.guests, phone: config.venuePhone },
      })),
    };
  }

  return {
    date,
    closed: false,
    closedReason: null,
    windows: evaluated,
    anyAvailable: evaluated.some((w) => w.available),
  };
}

export interface PartyBookingPlan {
  date: LocalDateString;
  window: PartyWindowRecord;
  startsAtUtc: Date;
  endsAtUtc: Date;
  selection: RoomSelection;
  arenaGroups: AssignedArenaGroup[];
  guests: number;
  honoreeAge: number;
}

/**
 * Server-side validation of a concrete party booking (R-70). Same evaluation as the
 * availability screen, re-run at submit against fresh state, because the screen's answer can
 * be seconds old and the customer's inventory can be gone.
 */
export function planPartyBooking(
  req: PartyAvailabilityRequest & { partyWindowId: string },
): Result<PartyBookingPlan> {
  const window = req.catalog.partyWindows.find((w) => w.id === req.partyWindowId && w.isActive);
  if (!window) {
    return reject(
      'UNKNOWN_REFERENCE',
      'That party window is no longer offered. Refresh and pick another.',
      { partyWindowId: req.partyWindowId },
    );
  }
  const day = partyWindowsFor(req.catalog, req.date);
  if (!day.some((w) => w.id === window.id)) {
    return reject(
      'UNKNOWN_REFERENCE',
      'That party window does not run on the date you picked. Refresh and pick another.',
      { partyWindowId: req.partyWindowId, date: req.date },
    );
  }

  const ceiling = Math.min(req.config.maxPartyGuests, maxCapacityAnywhere(req.catalog));
  if (req.guests > ceiling) {
    return reject(
      'EXCEEDS_MAX_PARTY_SIZE',
      `Our largest party setup holds ${ceiling} guests. For ${req.guests} guests, please call us at ${req.config.venuePhone} so we can look at options.`,
      { maxPartyGuests: ceiling, requestedGuests: req.guests, phone: req.config.venuePhone },
    );
  }

  const evaluation = evaluatePartyWindow(req, window);
  if (!evaluation.available || !evaluation.selection || !evaluation.arenaGroups) {
    return reject(
      evaluation.reason ?? 'NO_ROOM_CONFIG',
      evaluation.message ?? undefined,
      evaluation.detail as Record<string, never>,
    );
  }

  return ok({
    date: req.date,
    window,
    startsAtUtc: evaluation.startsAtUtc,
    endsAtUtc: evaluation.endsAtUtc,
    selection: evaluation.selection,
    arenaGroups: evaluation.arenaGroups,
    guests: req.guests,
    honoreeAge: req.honoreeAge,
  });
}
