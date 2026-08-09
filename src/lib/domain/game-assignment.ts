/**
 * Which laser tag games a party gets (R-16, R-17, R-20, R-22, R-64, R-65, R-66).
 *
 * A party window carries an ordered list of party game sets — the manager's answer to "which
 * of the reserved times belongs to which party". A booking claims the lowest free set, and if
 * that set is short (the brief supplies only half the times its own windows need) R-17
 * appends more by a deterministic search.
 */

import type { EngineConfig } from './config';
import { ok, reject, type Result } from './errors';
import { formatClock } from './time';
import type { DayState, Catalog, PartyWindowRecord, GameAssignmentSource } from './types';
import { configuredTimesOn, gameSetsForWindow, hasPublicBooking, indexSlots, generateGameSlots, arenaHeadroom, partiesOnSlot } from './slots';
import { agesCompatible } from './age';
import { claimedSetIds } from './reserved';

export interface AssignedGameTime {
  startMinutes: number;
  source: GameAssignmentSource;
  partyGameSetId: string | null;
}

export interface AssignedArenaGroup {
  arenaGroupIndex: number;
  playerCount: number;
  /** The set this group claimed, or null when every set was taken and R-17 did all the work. */
  partyGameSetId: string | null;
  times: AssignedGameTime[];
}

export interface GameAssignmentInput {
  date: string;
  window: PartyWindowRecord;
  /** One entry per arena group, in order. A party of 28 is [14, 14] (R-64). */
  arenaGroups: number[];
  gamesRequired: number;
  honoreeAge: number;
  catalog: Catalog;
  config: EngineConfig;
  dayState: DayState;
  excludeBookingId?: string;
}

/**
 * R-16 + R-17 + R-65.
 *
 * Group 1 claims the window's lowest free set, group 2 the next, and R-17 auto-extends
 * whichever runs short. A split booking therefore consumes the game inventory of two parties
 * even though it is one booking — which is consistent, since it also consumes two or three
 * room-slots.
 */
export function assignPartyGameTimes(input: GameAssignmentInput): Result<AssignedArenaGroup[]> {
  const { date, window, catalog, config, dayState } = input;

  const slots = generateGameSlots({ date, catalog, config, dayState });
  const slotIndex = indexSlots(slots);
  const configured = configuredTimesOn(catalog, date);
  const alreadyClaimed = claimedSetIds(dayState);

  const freeSets = gameSetsForWindow(catalog, window.id).filter((s) => !alreadyClaimed.has(s.id));

  /** Times this booking's other groups already took — R-64 forbids sharing across groups. */
  const takenByThisBooking = new Set<number>();
  const result: AssignedArenaGroup[] = [];

  for (let groupIndex = 0; groupIndex < input.arenaGroups.length; groupIndex += 1) {
    const playerCount = input.arenaGroups[groupIndex];
    const claimedSet = freeSets[groupIndex] ?? null;
    const times: AssignedGameTime[] = [];

    if (claimedSet) {
      for (const startMinutes of [...claimedSet.times].sort((a, b) => a - b)) {
        if (times.length >= input.gamesRequired) break;
        const slot = slotIndex.get(startMinutes);
        // A configured time that no longer exists (manager blocked it, or a closure removed
        // the day's slots) simply drops; R-17 backfills.
        if (!slot || slot.mode === 'BLOCKED') continue;
        // R-20: a game already sold to the public is never taken back for a party.
        if (hasPublicBooking(dayState, startMinutes)) continue;
        if (takenByThisBooking.has(startMinutes)) continue;
        if (arenaHeadroom(dayState, startMinutes, config) < playerCount) continue;
        if (!sharedSlotAgeOk(startMinutes, input, config)) continue;
        // NOTE: R-22 — manager-configured times are exempt from CFG.partyGameMinGapMinutes.
        // The brief's own weekend data (10:15 and 10:45) and Sunday 15:00/15:15 would
        // otherwise be invalid. The gap rule exists only to keep AUTO-assigned times sensible.
        times.push({ startMinutes, source: 'CONFIGURED_SET', partyGameSetId: claimedSet.id });
        takenByThisBooking.add(startMinutes);
      }
    }

    // R-17 auto-extension.
    while (times.length < input.gamesRequired) {
      const lastAssigned = times.length > 0 ? times[times.length - 1].startMinutes : null;
      const candidate = findNextAutoSlot({
        input,
        slots,
        configured,
        claimedSetId: claimedSet?.id ?? null,
        lastAssigned,
        playerCount,
        takenByThisBooking,
      });
      if (candidate === null) {
        return reject(
          'NO_GAME_CAPACITY',
          `We cannot fit ${input.gamesRequired} laser tag games inside ${window.label} on that date. Try another window or date, or call ${config.venuePhone}.`,
          {
            partyWindowId: window.id,
            date,
            gamesRequired: input.gamesRequired,
            gamesFound: times.length,
            arenaGroupIndex: groupIndex,
            phone: config.venuePhone,
          },
        );
      }
      times.push({ startMinutes: candidate, source: 'AUTO_APPENDED', partyGameSetId: null });
      takenByThisBooking.add(candidate);
    }

    result.push({
      arenaGroupIndex: groupIndex,
      playerCount,
      partyGameSetId: claimedSet?.id ?? null,
      times: times.sort((a, b) => a.startMinutes - b.startMinutes),
    });
  }

  return ok(result);
}

function sharedSlotAgeOk(startMinutes: number, input: GameAssignmentInput, config: EngineConfig): boolean {
  const others = partiesOnSlot(input.dayState, startMinutes).filter(
    (b) => b.bookingId !== input.excludeBookingId,
  );
  if (others.length === 0) return true;
  // R-36 applies across windows: two parties in the same game must satisfy the age rule even
  // when they came from different two-hour windows.
  if (!config.partiesMayShareGameSlot) return false;
  return others.every((b) => agesCompatible(input.honoreeAge, b.honoreeAge, config));
}

/**
 * R-17's search, verbatim. Take the EARLIEST game slot T on the date such that:
 *   (a) T >= window.start and T + CFG.gameDurationMinutes <= window.end;
 *   (b) T >= lastAssignedTime + CFG.partyGameMinGapMinutes (skipped for the group's first game);
 *   (c) T is not a configured time of any OTHER party game set on that date, in any window —
 *       auto-extension may never consume another window's reserved inventory;
 *   (d) T has no existing public booking;
 *   (e) arena headroom at T >= this arena group's size;
 *   (f) if T already has another party on it, CFG.partiesMayShareGameSlot is true and the age
 *       rule passes.
 */
function findNextAutoSlot(args: {
  input: GameAssignmentInput;
  slots: ReturnType<typeof generateGameSlots>;
  configured: Map<number, { setId: string; partyWindowId: string }[]>;
  claimedSetId: string | null;
  lastAssigned: number | null;
  playerCount: number;
  takenByThisBooking: Set<number>;
}): number | null {
  const { input, slots, configured, claimedSetId, lastAssigned, playerCount, takenByThisBooking } = args;
  const { window, config, dayState } = input;

  for (const slot of slots) {
    const T = slot.startMinutes;
    if (slot.mode === 'BLOCKED') continue;
    if (takenByThisBooking.has(T)) continue;
    // (a)
    if (T < window.startMinutes) continue;
    if (T + config.gameDurationMinutes > window.endMinutes) continue;
    // (b)
    if (lastAssigned !== null && T < lastAssigned + config.partyGameMinGapMinutes) continue;
    // (c)
    const owners = configured.get(T) ?? [];
    if (owners.some((o) => o.setId !== claimedSetId)) continue;
    // (d)
    if (hasPublicBooking(dayState, T)) continue;
    // (e)
    if (arenaHeadroom(dayState, T, config) < playerCount) continue;
    // (f)
    if (!sharedSlotAgeOk(T, input, config)) continue;
    return T;
  }
  return null;
}

/** Human-readable summary for the availability screen: "1:15 PM and 2:00 PM". */
export function describeGameTimes(times: readonly AssignedGameTime[]): string {
  const labels = times.map((t) => formatClock(t.startMinutes));
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
