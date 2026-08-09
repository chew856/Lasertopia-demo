/**
 * The age-pairing rule (R-35, R-36, R-37).
 *
 * Two parties may share a two-hour window, or a single game slot, only if their honorees'
 * ages are within CFG.maxAgeDifferenceYears. The rule is applied PAIRWISE across every pair,
 * not just "the two parties" — the weekend 10:00-12:00 window has three room-slots, and three
 * parties produce three pairs.
 */

import type { EngineConfig } from './config';
import { ok, reject, type Result } from './errors';
import type { DayState, ExistingPartyBooking, PartyWindowRecord } from './types';
import { partiesOnSlot } from './slots';

export interface AgeConflict {
  bookingId: string;
  otherAge: number;
  difference: number;
}

/** Boundary: a difference of exactly CFG.maxAgeDifferenceYears is ALLOWED (7 and 9 pass). */
export function agesCompatible(a: number, b: number, config: EngineConfig): boolean {
  return Math.abs(a - b) <= config.maxAgeDifferenceYears;
}

export function findAgeConflicts(
  honoreeAge: number,
  others: readonly ExistingPartyBooking[],
  config: EngineConfig,
): AgeConflict[] {
  return others
    .filter((b) => !agesCompatible(honoreeAge, b.honoreeAge, config))
    .map((b) => ({
      bookingId: b.bookingId,
      otherAge: b.honoreeAge,
      difference: Math.abs(honoreeAge - b.honoreeAge),
    }));
}

/**
 * R-35 — same-window rule. Evaluated BEFORE room allocation (see WE-07) so a customer is
 * never shown a room that is then pulled away for a reason unrelated to rooms.
 *
 * The copy names the other party's AGE and never their name — a family's identity is not
 * ours to disclose to another customer.
 */
export function checkWindowAgeRule(args: {
  honoreeAge: number;
  window: PartyWindowRecord;
  dayState: DayState;
  config: EngineConfig;
  excludeBookingId?: string;
}): Result<null> {
  const { honoreeAge, window, dayState, config } = args;

  if (!Number.isInteger(honoreeAge) || honoreeAge < config.minHonoreeAge || honoreeAge > config.maxHonoreeAge) {
    return reject(
      'INVALID_HONOREE_AGE',
      `Enter the age the birthday guest of honour is turning, between ${config.minHonoreeAge} and ${config.maxHonoreeAge}. We use it to match your party with a compatible one in the same window.`,
      { minAge: config.minHonoreeAge, maxAge: config.maxHonoreeAge },
    );
  }

  const sameWindow = dayState.partyBookings.filter(
    (b) => b.partyWindowId === window.id && b.bookingId !== args.excludeBookingId,
  );
  const conflicts = findAgeConflicts(honoreeAge, sameWindow, config);
  if (conflicts.length === 0) return ok(null);

  const ages = [...new Set(conflicts.map((c) => c.otherAge))].sort((a, b) => a - b);
  const agePhrase = ages.map((a) => `${a}-year-old`).join(' and a ');
  return reject(
    'AGE_GAP_EXCEEDED',
    `${window.label} is already booked by a party for a ${agePhrase}. Parties sharing a two-hour window must be within ${config.maxAgeDifferenceYears} years in age. Try a different time, or call ${config.venuePhone}.`,
    {
      partyWindowId: window.id,
      existingAges: ages,
      honoreeAge,
      maxAgeDifferenceYears: config.maxAgeDifferenceYears,
      phone: config.venuePhone,
    },
  );
}

/**
 * R-36 — shared-game rule. The same test applied to parties on the same GAME SLOT, even when
 * they come from different windows (Sunday 15:00-17:00 and 16:00-18:00 overlap). The rule
 * exists because these children share the arena; if they share a game they must satisfy it.
 */
export function checkSharedGameAgeRule(args: {
  honoreeAge: number;
  startMinutes: number;
  dayState: DayState;
  config: EngineConfig;
  excludeBookingId?: string;
}): Result<null> {
  const others = partiesOnSlot(args.dayState, args.startMinutes).filter(
    (b) => b.bookingId !== args.excludeBookingId,
  );
  const conflicts = findAgeConflicts(args.honoreeAge, others, args.config);
  if (conflicts.length === 0) return ok(null);
  const ages = [...new Set(conflicts.map((c) => c.otherAge))].sort((a, b) => a - b);
  return reject(
    'AGE_GAP_EXCEEDED',
    `That game already has a party more than ${args.config.maxAgeDifferenceYears} years apart in age from yours. We will put your party in a different game — try another window or date if none is free.`,
    { startMinutes: args.startMinutes, existingAges: ages, honoreeAge: args.honoreeAge },
  );
}

/**
 * R-37 — validate an entire window's roster pairwise. Used by the manager backend when
 * moving a booking into a window that already holds several parties.
 */
export function allPairsCompatible(ages: readonly number[], config: EngineConfig): boolean {
  for (let i = 0; i < ages.length; i += 1) {
    for (let j = i + 1; j < ages.length; j += 1) {
      if (!agesCompatible(ages[i], ages[j], config)) return false;
    }
  }
  return true;
}
