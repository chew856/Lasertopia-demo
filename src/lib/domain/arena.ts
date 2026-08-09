/**
 * Arena capacity and group splitting (R-12, R-63, R-64).
 *
 * The arena holds CFG.arenaCapacity players at a time, counted across EVERY booking on the
 * slot. A booking bigger than that plays in separate groups, and the groups must never share
 * a slot with each other — sharing would put all P players in the arena at once, which is
 * exactly what the split exists to prevent.
 */

import type { EngineConfig } from './config';
import type { DayState } from './types';
import { arenaHeadroom } from './slots';

/**
 * R-64 — split into `ceil(P / capacity)` groups, sized as evenly as possible.
 * 28 -> [14, 14]; 26 -> [13, 13]; 30 -> [15, 15]; 51 -> [17, 17, 17]; 52 -> [18, 17, 17].
 * Larger groups come first so the remainder is deterministic and testable.
 */
export function splitArenaGroups(players: number, config: EngineConfig): number[] {
  if (!Number.isInteger(players) || players < 1) {
    throw new Error(`Player count must be a positive integer, received ${players}.`);
  }
  const groups = Math.ceil(players / config.arenaCapacity);
  const base = Math.floor(players / groups);
  const remainder = players % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function needsArenaSplit(players: number, config: EngineConfig): boolean {
  return players > config.arenaCapacity;
}

/** R-12: does this slot have room for `players` more, given what is already booked? */
export function slotHasHeadroom(
  dayState: DayState,
  startMinutes: number,
  players: number,
  config: EngineConfig,
): boolean {
  return arenaHeadroom(dayState, startMinutes, config) >= players;
}

/**
 * Seats remaining across a consecutive block of N game slots — the number the laser tag time
 * grid shows. The binding constraint is the tightest slot in the block, because a 2-game
 * booking must seat the whole group in both.
 */
export function blockHeadroom(
  dayState: DayState,
  startMinutesList: readonly number[],
  config: EngineConfig,
): number {
  return startMinutesList.reduce(
    (min, m) => Math.min(min, arenaHeadroom(dayState, m, config)),
    config.arenaCapacity,
  );
}
