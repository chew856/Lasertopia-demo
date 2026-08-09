import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/db/client';

import { parseBlockMeta } from './blocks';
import type { StaffSession } from './session-token';

/**
 * The audit trail — STRATEGY §4.3, §4.4 and the `/manage/activity` feed.
 *
 * **A known schema gap, stated plainly.** `BookingChangeLog` is the only append-only table in
 * the schema and its `bookingId` is required, so it can record anything that happens *to a
 * booking* and nothing that happens to the venue. Blocking 3:15 PM, taking a room out of use
 * and changing the tax rate are none of them booking events, and `/manage/activity` is
 * specified to list all three.
 *
 * Until a venue-level `AuditLog` table exists, the feed is assembled from the three places the
 * facts already live:
 *
 *  | Event                     | Where it is recorded                                   |
 *  |---------------------------|--------------------------------------------------------|
 *  | override, cancel, deposit, check-in, guest change | `BookingChangeLog`              |
 *  | block / unblock a game    | `GameSlot.blockedReason` JSON (see `blocks.ts`)         |
 *  | settings change           | `Setting.updatedAt` + `Setting.updatedByUserId`         |
 *
 * The last of those is a *latest-value* column, not a history, so a settings row that has been
 * edited three times contributes one entry. That is a real limitation and it is reported.
 */

export type AuditAction =
  | 'CREATED'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'CANCELLED'
  | 'OVERRIDDEN'
  | 'ADDON_CHANGED'
  | 'DEPOSIT_RESOLVED'
  | 'GUESTS_CHANGED'
  | 'CHECKED_IN'
  | 'CHECK_IN_UNDONE'
  | 'NOTES_CHANGED';

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Every write path calls this. The actor is the session, never a string a form supplied —
 * "who did it" is not something a client gets to assert.
 */
export async function recordChange(
  client: Client,
  args: {
    bookingId: string;
    action: AuditAction;
    session: StaffSession;
    reason?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await client.bookingChangeLog.create({
    data: {
      bookingId: args.bookingId,
      action: args.action,
      actorType: 'MANAGER',
      actorUserId: args.session.sub,
      reason: args.reason ?? null,
      beforeJson: args.before === undefined ? null : JSON.stringify(args.before),
      afterJson: args.after === undefined ? null : JSON.stringify(args.after),
    },
  });
}

export interface ActivityEntry {
  id: string;
  atMs: number;
  kind: 'override' | 'cancellation' | 'block' | 'settings' | 'other';
  staffName: string;
  summary: string;
  bookingId: string | null;
  bookingReference: string | null;
}

function kindOf(action: string): ActivityEntry['kind'] {
  if (action === 'OVERRIDDEN') return 'override';
  if (action === 'CANCELLED') return 'cancellation';
  return 'other';
}

const UNKNOWN_ACTOR = 'System';

/**
 * The read side. `limit` bounds each source separately and then the merged list, so one noisy
 * source cannot crowd the other two out of the page.
 */
export async function loadActivity(limit: number): Promise<ActivityEntry[]> {
  const [logs, blocks, settings] = await Promise.all([
    prisma.bookingChangeLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { name: true } },
        booking: { select: { id: true, reference: true } },
      },
    }),
    prisma.gameSlot.findMany({
      where: { mode: 'BLOCKED' },
      orderBy: [{ date: 'desc' }, { startMinutes: 'desc' }],
      take: limit,
      select: { id: true, date: true, startMinutes: true, blockedReason: true },
    }),
    prisma.setting.findMany({
      where: { updatedByUserId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { updatedBy: { select: { name: true } } },
    }),
  ]);

  const entries: ActivityEntry[] = [];

  for (const log of logs) {
    entries.push({
      id: `log:${log.id}`,
      atMs: log.createdAt.getTime(),
      kind: kindOf(log.action),
      staffName: log.actor?.name ?? UNKNOWN_ACTOR,
      summary: log.reason ? `${log.action} — ${log.reason}` : log.action,
      bookingId: log.booking.id,
      bookingReference: log.booking.reference,
    });
  }

  for (const block of blocks) {
    const meta = parseBlockMeta(block.blockedReason);
    // A block with no recorded instant predates this module (or was written by hand); it is
    // still shown, dated to its own slot, rather than dropped from the audit trail.
    const atMs = meta.atIso ? Date.parse(meta.atIso) : Number.NaN;
    entries.push({
      id: `block:${block.id}`,
      atMs: Number.isNaN(atMs) ? 0 : atMs,
      kind: 'block',
      staffName: meta.byName ?? UNKNOWN_ACTOR,
      summary: meta.reason
        ? `Blocked ${block.date} — ${meta.reason}`
        : `Blocked ${block.date}, no reason given`,
      bookingId: null,
      bookingReference: null,
    });
  }

  for (const setting of settings) {
    entries.push({
      id: `setting:${setting.key}`,
      atMs: setting.updatedAt.getTime(),
      kind: 'settings',
      staffName: setting.updatedBy?.name ?? UNKNOWN_ACTOR,
      summary: `${setting.key} set to ${setting.value}`,
      bookingId: null,
      bookingReference: null,
    });
  }

  return entries.sort((a, b) => b.atMs - a.atMs).slice(0, limit);
}

/** Check-in has no column on `Booking`; the append-only log is its source of truth. */
export async function checkInStateFor(bookingIds: readonly string[]): Promise<Map<string, Date>> {
  if (bookingIds.length === 0) return new Map();
  const rows = await prisma.bookingChangeLog.findMany({
    where: { bookingId: { in: [...bookingIds] }, action: { in: ['CHECKED_IN', 'CHECK_IN_UNDONE'] } },
    orderBy: { createdAt: 'asc' },
    select: { bookingId: true, action: true, createdAt: true },
  });
  const state = new Map<string, Date>();
  for (const row of rows) {
    if (row.action === 'CHECKED_IN') state.set(row.bookingId, row.createdAt);
    else state.delete(row.bookingId);
  }
  return state;
}
