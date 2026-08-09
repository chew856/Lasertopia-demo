import type { GameSlotMode } from '@/lib/domain';

/**
 * Ad-hoc blocks — the manager's most-used write action, and the one the brief asks for by
 * name: *"We sometimes have to book off other time slots for parties as well."*
 *
 * STRATEGY §4.3 specifies a block as a record with `date`, `startTime`, optional `endTime`,
 * optional `reason`, `createdBy` and `createdAt`. The schema has no such table: a block is
 * `GameSlot.mode = 'BLOCKED'` plus a free-text `GameSlot.blockedReason`, and `GameSlot` has no
 * actor or timestamp column. Rather than lose who and when — which STRATEGY §4.3 and §4.4 both
 * require, and which is the whole point of `/manage/activity` — the metadata is encoded as
 * JSON into the one column that exists.
 *
 * **This is a schema gap, not a design choice**, and it is reported as one. The right fix is a
 * `SlotBlock` table (or three columns on `GameSlot`); `prisma/` belongs to another team.
 *
 * `parseBlockMeta` is deliberately tolerant: a `blockedReason` written by anything other than
 * this module — a hand edit, a future migration, an earlier version — parses as a plain reason
 * with no actor, rather than throwing on a board render.
 */

export const BLOCK_META_VERSION = 1;

export interface BlockMeta {
  /** Free text from the manager. Empty when they blocked first and explained later. */
  reason: string;
  /** `ManagerUser.id` of whoever blocked it. */
  byId: string;
  /** Display name, rendered verbatim into `{staffName}`. */
  byName: string;
  /** ISO instant. */
  atIso: string;
  /**
   * What the slot's mode was before the block, so an unblock restores the real mode instead
   * of guessing `PUBLIC` and quietly releasing a reserved party time to the public.
   */
  previousMode: GameSlotMode;
}

export function encodeBlockMeta(meta: BlockMeta): string {
  return JSON.stringify({
    v: BLOCK_META_VERSION,
    reason: meta.reason,
    byId: meta.byId,
    byName: meta.byName,
    at: meta.atIso,
    prev: meta.previousMode,
  });
}

const MODES: readonly GameSlotMode[] = ['PUBLIC', 'PARTY_HELD', 'PARTY_ONLY', 'BLOCKED'];

function asMode(value: unknown): GameSlotMode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value)
    ? (value as GameSlotMode)
    : 'PUBLIC';
}

/** Never throws. A blob this module did not write becomes `{ reason: <the whole string> }`. */
export function parseBlockMeta(raw: string | null | undefined): Partial<BlockMeta> & { reason: string } {
  if (!raw || raw.trim() === '') return { reason: '' };
  const text = raw.trim();
  if (!text.startsWith('{')) return { reason: text };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { reason: text };
  }
  if (typeof parsed !== 'object' || parsed === null) return { reason: text };

  const value = parsed as Record<string, unknown>;
  return {
    reason: typeof value.reason === 'string' ? value.reason : '',
    byId: typeof value.byId === 'string' ? value.byId : undefined,
    byName: typeof value.byName === 'string' ? value.byName : undefined,
    atIso: typeof value.at === 'string' ? value.at : undefined,
    previousMode: value.prev === undefined ? undefined : asMode(value.prev),
  };
}

/**
 * Every start time in an inclusive `from`–`to` range that actually exists on the date.
 *
 * It intersects with the generated slot list rather than stepping blindly by the interval:
 * a weekend morning has 10:15–11:00 and then nothing until 12:00, and a block of
 * "10:15 through 12:15" must not invent 11:15, 11:30 and 11:45 as slots that can be blocked.
 */
export function expandBlockRange(
  fromMinutes: number,
  toMinutes: number,
  existingStartMinutes: readonly number[],
): number[] {
  const low = Math.min(fromMinutes, toMinutes);
  const high = Math.max(fromMinutes, toMinutes);
  return existingStartMinutes
    .filter((minutes) => minutes >= low && minutes <= high)
    .sort((a, b) => a - b);
}

/**
 * A block does not cancel anything (STRATEGY §4.3) — it stops *new* bookings. This is the
 * acknowledgement payload for the "6:15 PM has 2 bookings (8 players)" confirmation.
 */
export interface BlockImpact {
  startMinutes: number;
  bookingCount: number;
  playerCount: number;
}

export function blockImpact(
  startMinutes: readonly number[],
  games: readonly { startMinutes: number; playerCount: number; bookingId: string }[],
): BlockImpact[] {
  return startMinutes.map((minutes) => {
    const hits = games.filter((game) => game.startMinutes === minutes);
    return {
      startMinutes: minutes,
      bookingCount: new Set(hits.map((hit) => hit.bookingId)).size,
      playerCount: hits.reduce((total, hit) => total + hit.playerCount, 0),
    };
  });
}

/** True when any slot in the range already has players in it. */
export function anyImpact(impacts: readonly BlockImpact[]): boolean {
  return impacts.some((impact) => impact.bookingCount > 0);
}
