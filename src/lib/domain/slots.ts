/**
 * Game slot generation and operating hours (R-02, R-03, R-04, R-05, R-06).
 *
 * A game slot is one 15-minute laser tag start time on one calendar date. This module turns
 * the manager's weekly templates into the concrete list of slots that exist on a given date,
 * and stamps each one with its mode. Nothing downstream may invent a slot that is not here.
 */

import type { EngineConfig } from './config';
import { dayOfWeekFor, zonedTimeToUtc, type LocalDateString } from './time';
import type {
  Catalog,
  ClosureRecord,
  DayState,
  GameSlotMode,
  OperatingHoursRecord,
  PartyGameSetRecord,
  PartyWindowRecord,
} from './types';

export interface GeneratedGameSlot {
  date: LocalDateString;
  startMinutes: number;
  startsAtUtc: Date;
  mode: GameSlotMode;
  /** Set when the slot exists because a party game set configures it (R-15). */
  sourcePartyGameSetId: string | null;
  /** The window that owns this slot when the mode is PARTY_HELD or PARTY_ONLY. */
  owningPartyWindowIds: string[];
}

export function operatingHoursFor(catalog: Catalog, date: LocalDateString): OperatingHoursRecord | null {
  const day = dayOfWeekFor(date);
  return catalog.operatingHours.find((h) => h.dayOfWeek === day) ?? null;
}

export function closureFor(catalog: Catalog, date: LocalDateString): ClosureRecord | null {
  return catalog.closures.find((c) => c.date === date) ?? null;
}

export function partyWindowsFor(catalog: Catalog, date: LocalDateString): PartyWindowRecord[] {
  const day = dayOfWeekFor(date);
  return catalog.partyWindows
    .filter((w) => w.dayOfWeek === day && w.isActive)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export function gameSetsForWindow(catalog: Catalog, partyWindowId: string): PartyGameSetRecord[] {
  return catalog.partyGameSets
    .filter((s) => s.partyWindowId === partyWindowId && s.isActive)
    .sort((a, b) => a.setIndex - b.setIndex);
}

/** Every manager-configured reserved game time on a date, across every window (R-17c). */
export function configuredTimesOn(
  catalog: Catalog,
  date: LocalDateString,
): Map<number, { setId: string; partyWindowId: string }[]> {
  const map = new Map<number, { setId: string; partyWindowId: string }[]>();
  for (const window of partyWindowsFor(catalog, date)) {
    for (const set of gameSetsForWindow(catalog, window.id)) {
      for (const minutes of set.times) {
        const existing = map.get(minutes) ?? [];
        existing.push({ setId: set.id, partyWindowId: window.id });
        map.set(minutes, existing);
      }
    }
  }
  return map;
}

/**
 * The full slot list for a date, in ascending time order.
 *
 * Composition, in order:
 *  - R-04: the weekend party-only morning games (10:15, 10:30, 10:45, 11:00), which exist
 *    BEFORE the building opens and are never public on any lead time.
 *  - R-03: one slot every CFG.gameIntervalMinutes from the day's first public game start to
 *    its last inclusive.
 *  - R-05 falls out of the above rather than being coded: nothing generates 11:15-11:45 on a
 *    weekend, because the party-only list stops at 11:00 and public play starts at 12:00.
 *  - R-06: a Closure that blocks public play suppresses the public slots; one that blocks
 *    parties suppresses the party-only slots.
 *
 * Mode is the STATIC mode: whether the slot is structurally public, held for a party, or
 * blocked. Whether a PARTY_HELD slot has actually released to the public depends on `now`
 * and on bookings, and is decided by `reserved.ts`, not here.
 */
export function generateGameSlots(args: {
  date: LocalDateString;
  catalog: Catalog;
  config: EngineConfig;
  dayState?: DayState;
}): GeneratedGameSlot[] {
  const { date, catalog, config } = args;
  const blocked = new Set(args.dayState?.blockedSlotMinutes ?? []);
  const closure = closureFor(catalog, date);
  const day = dayOfWeekFor(date);
  const hours = operatingHoursFor(catalog, date);
  const configured = configuredTimesOn(catalog, date);

  const minutesList: number[] = [];

  if (!closure?.blocksParties) {
    for (const t of catalog.partyOnlyGameTimes) {
      if (t.dayOfWeek === day) minutesList.push(t.startMinutes);
    }
  }

  if (hours?.isOpen && !closure?.blocksPublic) {
    for (
      let m = hours.firstPublicGameMinutes;
      m <= hours.lastPublicGameMinutes;
      m += config.gameIntervalMinutes
    ) {
      minutesList.push(m);
    }
  }

  const partyOnlyMinutes = new Set(
    catalog.partyOnlyGameTimes.filter((t) => t.dayOfWeek === day).map((t) => t.startMinutes),
  );

  const unique = [...new Set(minutesList)].sort((a, b) => a - b);

  return unique.map((startMinutes) => {
    const owners = configured.get(startMinutes) ?? [];
    let mode: GameSlotMode;
    if (blocked.has(startMinutes)) {
      mode = 'BLOCKED';
    } else if (partyOnlyMinutes.has(startMinutes)) {
      mode = 'PARTY_ONLY';
    } else if (owners.length > 0) {
      mode = 'PARTY_HELD';
    } else {
      mode = 'PUBLIC';
    }
    return {
      date,
      startMinutes,
      startsAtUtc: zonedTimeToUtc(date, startMinutes, config.timezone),
      mode,
      sourcePartyGameSetId: owners[0]?.setId ?? null,
      owningPartyWindowIds: [...new Set(owners.map((o) => o.partyWindowId))],
    };
  });
}

/** Index the generated slots by start minute for O(1) lookups. */
export function indexSlots(slots: GeneratedGameSlot[]): Map<number, GeneratedGameSlot> {
  return new Map(slots.map((s) => [s.startMinutes, s]));
}

/** R-12 helper: how many players are already committed to a start time on a date. */
export function playersOnSlot(dayState: DayState, startMinutes: number): number {
  let total = 0;
  for (const booking of dayState.publicBookings) {
    for (const game of booking.games) {
      if (game.startMinutes === startMinutes) total += game.playerCount;
    }
  }
  for (const booking of dayState.partyBookings) {
    for (const game of booking.games) {
      if (game.startMinutes === startMinutes) total += game.playerCount;
    }
  }
  return total;
}

export function arenaHeadroom(dayState: DayState, startMinutes: number, config: EngineConfig): number {
  return config.arenaCapacity - playersOnSlot(dayState, startMinutes);
}

/** True when at least one public booking already owns this start time (R-20, R-17d). */
export function hasPublicBooking(dayState: DayState, startMinutes: number): boolean {
  return dayState.publicBookings.some((b) => b.games.some((g) => g.startMinutes === startMinutes));
}

/** The party bookings occupying a start time, for the shared-game age rule (R-36). */
export function partiesOnSlot(dayState: DayState, startMinutes: number) {
  return dayState.partyBookings.filter((b) => b.games.some((g) => g.startMinutes === startMinutes));
}
