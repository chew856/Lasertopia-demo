/**
 * Every way the engine can say no.
 *
 * R-69: a rejection MUST carry a machine-readable code AND a human sentence that says what
 * went wrong and what to do about it. The UI maps codes to designed copy, so this union has
 * to be exhaustive and specific — a bare boolean, or a generic "unavailable", forces the
 * frontend to invent a reason, and it will invent the wrong one.
 */

/** The 13 codes named in R-69. These are the contract; nothing may quietly disappear. */
export const RULE_ERROR_CODES = [
  /** R-10. Online booking attempted inside the 90-minute walk-in window. */
  'ONLINE_CUTOFF',
  /** R-11. The game slot is reserved for a party and has not released. */
  'SLOT_HELD_FOR_PARTY',
  /** R-11 / R-19. Weekend 10:15-11:00: exists only for parties, never releases. */
  'PARTY_ONLY_WINDOW',
  /** R-11. Manager blocked the slot, or it does not exist on that date. */
  'SLOT_UNAVAILABLE',
  /** R-12. Sum of players on the slot would exceed CFG.arenaCapacity. */
  'ARENA_FULL',
  /** R-25. No offered configuration in this window fits, or its rooms are taken. */
  'NO_ROOM_CONFIG',
  /** R-25. Above CFG.maxPartyGuests / the largest configuration anywhere. "Call us". */
  'EXCEEDS_MAX_PARTY_SIZE',
  /** R-35 / R-36. Honoree ages more than CFG.maxAgeDifferenceYears apart. */
  'AGE_GAP_EXCEEDED',
  /** R-17 / R-66. No conforming game slots left inside the party window. */
  'NO_GAME_CAPACITY',
  /** R-46. Add-on is not sold against this package. */
  'ADDON_NOT_ELIGIBLE',
  /** R-30. A room is already held for an overlapping period. */
  'ROOM_DOUBLE_BOOKED',
  /** R-56 / R-59. Less than CFG.changeNoticeDays of notice for a self-serve change. */
  'NOTICE_PERIOD_NOT_MET',
  /** R-06. A Closure covers the date. */
  'VENUE_CLOSED',
] as const;

/**
 * Codes beyond R-69's list. Each one exists because collapsing it into a neighbour would
 * lose a distinction the UI has designed different copy and a different recovery for
 * (STRATEGY §3 state vocabulary).
 */
export const EXTENDED_ERROR_CODES = [
  /** Every room-slot in the window is held. Distinct from NO_ROOM_CONFIG: "come back another day", not "try a different size". */
  'WINDOW_FULL',
  /** The first game fits but a later consecutive game of the same booking does not (R-09). */
  'PARTIAL_BLOCK',
  /** Requested time is not on the day's slot cadence at all (R-03). */
  'SLOT_DOES_NOT_EXIST',
  /** Inside building hours but outside the public game range (R-02). */
  'OUTSIDE_OPERATING_HOURS',
  /** The requested date/time has already passed in venue-local time. */
  'PAST_DATE',
  /** Beyond CFG.bookingHorizonDays. */
  'BEYOND_HORIZON',
  /** Inside CFG.partyMinLeadHours (OQ-30). */
  'MIN_LEAD_TIME_NOT_MET',
  /** R-47. Both arcade cards selected; the brief says "OR". */
  'ADDON_EXCLUSIVE_CONFLICT',
  /** Per-guest add-on quantity above the guest count, or a non-positive quantity. */
  'ADDON_QUANTITY_INVALID',
  /** R-48. 5-Up load outside the configured increment/cap range. */
  'ADDON_OPTION_INVALID',
  /** Guest count is not a positive integer within the bookable range. */
  'INVALID_GUEST_COUNT',
  /** Player count is not a positive integer. */
  'INVALID_PLAYER_COUNT',
  /** Games requested is outside 1..CFG.maxGamesPerPublicBooking (R-08). */
  'INVALID_GAME_COUNT',
  /** Honoree age missing or outside the bookable range (R-34). */
  'INVALID_HONOREE_AGE',
  /** R-53. Party cannot be CONFIRMED without a recorded deposit. */
  'DEPOSIT_REQUIRED',
  /** R-13 / R-59. The action is legal, but only from the manager backend. */
  'MANAGER_ONLY',
  /** Seeded configuration is itself invalid (e.g. non-contiguous pizza tiers, R-41). */
  'CONFIG_INVALID',
  /** R-24. The referenced window / package / add-on / configuration is not active. */
  'UNKNOWN_REFERENCE',
] as const;

export const BOOKING_ERROR_CODES = [...RULE_ERROR_CODES, ...EXTENDED_ERROR_CODES] as const;

export type RuleErrorCode = (typeof RULE_ERROR_CODES)[number];
export type ExtendedErrorCode = (typeof EXTENDED_ERROR_CODES)[number];
export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[number];

/** Structured facts the UI needs to write its own copy (nearest open times, the other party's age, seats left). */
export type RejectionDetail = Record<string, string | number | boolean | null | number[] | string[]>;

export interface Rejection<C extends BookingErrorCode = BookingErrorCode> {
  readonly code: C;
  /** A complete sentence: what went wrong, and what to do about it (R-69). */
  readonly message: string;
  readonly detail: RejectionDetail;
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: Rejection };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function reject(code: BookingErrorCode, message?: string, detail: RejectionDetail = {}): Result<never> {
  return { ok: false, error: rejection(code, message, detail) };
}

export function rejection(
  code: BookingErrorCode,
  message?: string,
  detail: RejectionDetail = {},
): Rejection {
  return { code, message: message ?? DEFAULT_MESSAGES[code], detail };
}

/** Throws if the result is a rejection. For call sites that have already validated. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

export function isRejection<T>(result: Result<T>): result is { ok: false; error: Rejection } {
  return !result.ok;
}

/**
 * Fallback copy. Every entry says what happened and what to do next, because R-69 requires
 * it even when a caller forgets to supply a richer, data-filled sentence. The `Record` type
 * makes adding a code without adding copy a compile error.
 */
export const DEFAULT_MESSAGES: Record<BookingErrorCode, string> = {
  ONLINE_CUTOFF:
    'Online booking closes 90 minutes before each game so we can look after walk-ins. Pick a later game, or call us and we will book it by hand.',
  SLOT_HELD_FOR_PARTY:
    'This game is held for a birthday party. If the party does not book it will open up — check back, or pick a nearby time.',
  PARTY_ONLY_WINDOW:
    'Weekend mornings are reserved for birthday parties. We open to the public at 12:00 PM — pick a game from then on, or book a party in this window instead.',
  SLOT_UNAVAILABLE:
    'We have taken this game out of the schedule. Pick one of the nearby open games.',
  ARENA_FULL:
    'Our arena holds a limited number of players at a time and this game does not have room for your group. Pick another game time, or reduce the group size.',
  NO_ROOM_CONFIG:
    'We do not have a room combination free in this window for a party your size. Try another window or date, or reduce the guest count.',
  EXCEEDS_MAX_PARTY_SIZE:
    'Your party is larger than our biggest room setup. Please call us so we can look at options.',
  AGE_GAP_EXCEEDED:
    'This window already holds a party for a different age group, and parties sharing a two-hour window must be within two years in age. Try another window or date.',
  NO_GAME_CAPACITY:
    'We cannot fit your laser tag games inside this party window. Try another window or date, or call us.',
  ADDON_NOT_ELIGIBLE:
    'This extra is not available with the package you chose. Remove it, or switch packages.',
  ROOM_DOUBLE_BOOKED:
    'That room was taken while you were booking. Refresh to see what is still open.',
  NOTICE_PERIOD_NOT_MET:
    'We need at least two weeks notice to change or cancel a party self-serve. Call us and we will see what we can do.',
  VENUE_CLOSED: 'We are closed that day. Pick another date.',
  WINDOW_FULL:
    'Every party room in this window is already booked. Pick another window or date.',
  PARTIAL_BLOCK:
    'Your first game fits but the game right after it does not, and multi-game bookings play back to back. Pick a different start time, or book fewer games.',
  SLOT_DOES_NOT_EXIST: 'We do not run a game at that time. Pick a time from the schedule.',
  OUTSIDE_OPERATING_HOURS:
    'That time is outside our hours for that day. Pick a time inside the posted hours.',
  PAST_DATE: 'That time has already passed. Pick an upcoming date.',
  BEYOND_HORIZON: 'We are not taking bookings that far ahead yet. Pick an earlier date.',
  MIN_LEAD_TIME_NOT_MET:
    'We need more notice to set a party up. Pick a later date, or call us about something sooner.',
  ADDON_EXCLUSIVE_CONFLICT:
    'You can pick one arcade card option, not both. Choose the $5 match or the 45-minute Time Play card.',
  ADDON_QUANTITY_INVALID:
    'That quantity does not work for this extra. Per-guest extras cannot exceed your guest count.',
  ADDON_OPTION_INVALID: 'That option is not available for this extra. Pick one from the list.',
  INVALID_GUEST_COUNT: 'Enter the number of guests, including the birthday guest of honour.',
  INVALID_PLAYER_COUNT: 'Enter at least 1 player.',
  INVALID_GAME_COUNT: 'Choose 1, 2 or 3 games.',
  INVALID_HONOREE_AGE:
    'We need the birthday age so we can match your party with a compatible one in the same window.',
  DEPOSIT_REQUIRED: 'A $50 deposit is required to confirm a party booking.',
  MANAGER_ONLY: 'This change cannot be made online. Call us and our staff can do it for you.',
  CONFIG_INVALID:
    'The booking settings are inconsistent and this request cannot be evaluated. Please tell staff — this is our problem, not yours.',
  UNKNOWN_REFERENCE:
    'Something you selected is no longer available. Refresh and make the selection again.',
};
