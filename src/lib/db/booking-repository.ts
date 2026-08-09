/**
 * The write path — the only place inventory is committed.
 *
 * THE CONCURRENCY GUARANTEE
 * =========================
 * Two parents hitting Confirm at the same instant for the last free room-slot must not both
 * succeed. This is enforced in two layers, and the first one is not application logic:
 *
 *  1. `BookingRoomSlot` has a UNIQUE index on `(roomId, startsAtUtc)` (see schema.prisma).
 *     A party window is a fixed template, so two bookings of the same room in the same window
 *     on the same date produce byte-identical `(roomId, startsAtUtc)` pairs. Both transactions
 *     may read "the room is free" — that read is not the guard — but only one INSERT can
 *     commit. The loser gets Prisma error P2002, which this module translates into a
 *     `ROOM_DOUBLE_BOOKED` rejection. No interleaving of reads and writes can defeat a unique
 *     index, which is why the race is a database error rather than a logic race.
 *
 *  2. The arena cap (R-12) is a SUM, not a row count, so no unique index can express it. It is
 *     re-read and re-checked INSIDE the same transaction as the insert, after the room slots
 *     are already claimed. On SQLite this is airtight because the engine serialises writers
 *     (one write transaction at a time, `busy_timeout` handles the queue). On Postgres,
 *     concurrent transactions are not serialised by default, so the transaction must take the
 *     `GameSlot` rows under `SELECT ... FOR UPDATE` before summing — that line is marked
 *     below.
 *
 * WHAT CHANGES ON POSTGRES
 *  - Add the exclusion constraint SQLite cannot express, which upgrades layer 1 from
 *    "identical windows" to "any overlap at all":
 *      ALTER TABLE "BookingRoomSlot" ADD CONSTRAINT booking_room_slot_no_overlap
 *        EXCLUDE USING gist ("roomId" WITH =, tstzrange("startsAtUtc","endsAtUtc") WITH &&);
 *  - Uncomment the `SELECT ... FOR UPDATE` lock in `assertArenaHeadroom` and pass
 *    `isolationLevel: 'Serializable'` to `$transaction`.
 * Until then the R-30 overlap check below covers partial overlaps, and it is safe on SQLite
 * because writers are serialised.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import type { EngineConfig } from '../domain/config';
import { rejection, type Rejection } from '../domain/errors';
import { zonedTimeToUtc } from '../domain/time';

export class BookingConflictError extends Error {
  readonly rejection: Rejection;
  constructor(rejectionValue: Rejection) {
    super(rejectionValue.message);
    this.name = 'BookingConflictError';
    this.rejection = rejectionValue;
  }
}

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export interface RoomSlotClaim {
  roomId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export interface GameClaim {
  startMinutes: number;
  arenaGroupIndex: number;
  playerCount: number;
  partyGameSetId: string | null;
  assignmentSource: 'CONFIGURED_SET' | 'AUTO_APPENDED' | 'MANAGER';
}

/**
 * R-30 — reject any room reservation that overlaps an existing one.
 * The unique index catches identical windows; this catches partial overlaps (a manager who
 * maps two overlapping windows onto the same room).
 */
async function assertNoRoomOverlap(
  tx: Tx,
  claims: RoomSlotClaim[],
  config: EngineConfig,
  excludeBookingId?: string,
): Promise<void> {
  const changeoverMs = config.windowChangeoverMinutes * 60_000;
  for (const claim of claims) {
    const startsAtUtc = zonedTimeToUtc(claim.date, claim.startMinutes, config.timezone);
    const endsAtUtc = zonedTimeToUtc(claim.date, claim.endMinutes, config.timezone);
    const existing = await tx.bookingRoomSlot.findMany({
      where: {
        roomId: claim.roomId,
        date: claim.date,
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
      },
      select: { startsAtUtc: true, endsAtUtc: true },
    });
    const clash = existing.some(
      (row) =>
        startsAtUtc.getTime() < row.endsAtUtc.getTime() + changeoverMs &&
        row.startsAtUtc.getTime() < endsAtUtc.getTime() + changeoverMs,
    );
    if (clash) {
      throw new BookingConflictError(
        rejection('ROOM_DOUBLE_BOOKED', undefined, { roomId: claim.roomId, date: claim.date }),
      );
    }
  }
}

/**
 * R-12 — arena capacity, re-derived inside the transaction. Never a stored counter: a counter
 * can drift from the bookings it claims to count, and a sum cannot.
 */
async function assertArenaHeadroom(
  tx: Tx,
  gameSlotIds: { gameSlotId: string; playerCount: number }[],
  config: EngineConfig,
  excludeBookingId?: string,
  now: Date = new Date(),
): Promise<void> {
  for (const { gameSlotId, playerCount } of gameSlotIds) {
    // POSTGRES: take the row lock first so concurrent transactions serialise on this slot.
    //   await tx.$queryRaw`SELECT id FROM "GameSlot" WHERE id = ${gameSlotId} FOR UPDATE`;
    const aggregate = await tx.bookingGame.aggregate({
      where: {
        gameSlotId,
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
        // A lapsed hold is not occupancy. Both availability readers already exclude it
        // (laser-tag/_lib/venue.ts, parties/_lib/day-state.ts); without the same filter here
        // the write path counted seats the read path had already given back, and a customer
        // who was shown an open slot got ARENA_FULL from a hold that died twenty minutes ago.
        booking: {
          status: { in: ['HOLD', 'CONFIRMED'] },
          OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }],
        },
      },
      _sum: { playerCount: true },
    });
    const committed = aggregate._sum.playerCount ?? 0;
    if (committed + playerCount > config.arenaCapacity) {
      throw new BookingConflictError(
        rejection(
          'ARENA_FULL',
          `That game has ${Math.max(0, config.arenaCapacity - committed)} seats left and you need ${playerCount}. Pick another time, or reduce the group size.`,
          { gameSlotId, seatsRemaining: Math.max(0, config.arenaCapacity - committed), requiredSeats: playerCount },
        ),
      );
    }
  }
}

/**
 * Find or create the GameSlot row for a (date, startMinutes) so bookings can reference it.
 * The create can lose its own race against a concurrent transaction materialising the same
 * slot; that P2002 is benign and simply means the row now exists, so re-read it.
 */
async function ensureGameSlot(
  tx: Tx,
  date: string,
  startMinutes: number,
  mode: string,
  config: EngineConfig,
): Promise<string> {
  const existing = await tx.gameSlot.findUnique({
    where: { date_startMinutes: { date, startMinutes } },
    select: { id: true },
  });
  if (existing) return existing.id;
  try {
    const created = await tx.gameSlot.create({
      data: {
        date,
        startMinutes,
        startsAtUtc: zonedTimeToUtc(date, startMinutes, config.timezone),
        mode,
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await tx.gameSlot.findUniqueOrThrow({
        where: { date_startMinutes: { date, startMinutes } },
        select: { id: true },
      });
      return raced.id;
    }
    throw error;
  }
}

export interface CommitBookingInput {
  bookingId: string;
  roomSlots: RoomSlotClaim[];
  games: GameClaim[];
  date: string;
  config: EngineConfig;
  excludeBookingId?: string;
  /**
   * Replace this booking's existing inventory rather than adding to it, inside the SAME
   * transaction as the new claim.
   *
   * Releasing first and committing second — as two transactions — is not equivalent, and the
   * difference is a real defect: between the two, the rooms are unheld, so a claim that then
   * loses its race leaves the booking owning nothing at all. Doing the delete inside this
   * transaction means a failed re-claim rolls back to the inventory the booking already had.
   */
  replaceExisting?: boolean;
  /**
   * The instant the arena sum is evaluated against, so a lapsed hold does not count as
   * occupancy. Defaults to the current time; callers that already hold a `now` pass it so the
   * write path and the availability read that preceded it agree on which holds are alive.
   */
  now?: Date;
}

/**
 * Claim room-slots and arena seats for an already-created Booking row, atomically.
 *
 * Order is R-31's order and it is not arbitrary: rooms first (the physical constraint, and the
 * one a unique index can enforce), then arena. Neither implies the other — a window can have a
 * free room and no arena headroom, or arena headroom and no free room.
 */
export async function commitBookingInventory(
  prisma: PrismaClient,
  input: CommitBookingInput,
): Promise<{ roomSlotIds: string[]; bookingGameIds: string[] }> {
  const { config } = input;
  try {
    return await prisma.$transaction(
      async (tx) => {
        // ---- 0. Re-hold: drop what this booking already owns, atomically with the re-claim.
        // The unique index on (roomId, startsAtUtc) means a booking cannot re-claim its own
        // room without releasing it first, and doing that here keeps the release and the
        // claim in one transaction that either both happen or neither does.
        if (input.replaceExisting) {
          await tx.bookingRoomSlot.deleteMany({ where: { bookingId: input.bookingId } });
          await tx.bookingGame.deleteMany({ where: { bookingId: input.bookingId } });
        }

        // ---- 1. Rooms (R-30) -----------------------------------------------------------
        await assertNoRoomOverlap(tx, input.roomSlots, config, input.excludeBookingId);
        const roomSlotIds: string[] = [];
        for (const claim of input.roomSlots) {
          const row = await tx.bookingRoomSlot.create({
            data: {
              bookingId: input.bookingId,
              roomId: claim.roomId,
              date: claim.date,
              startsAtUtc: zonedTimeToUtc(claim.date, claim.startMinutes, config.timezone),
              endsAtUtc: zonedTimeToUtc(claim.date, claim.endMinutes, config.timezone),
            },
            select: { id: true },
          });
          roomSlotIds.push(row.id);
        }

        // ---- 2. Arena (R-12) -----------------------------------------------------------
        const withSlotIds: { gameSlotId: string; claim: GameClaim }[] = [];
        for (const game of input.games) {
          // A party's games are PARTY_HELD whichever way they were assigned: configured set
          // times are reserved by definition, and R-17's appended times become held when
          // CFG.autoAssignedGamesBlockPublic is true.
          const mode = config.autoAssignedGamesBlockPublic || game.assignmentSource === 'CONFIGURED_SET'
            ? 'PARTY_HELD'
            : 'PUBLIC';
          const gameSlotId = await ensureGameSlot(tx, input.date, game.startMinutes, mode, config);
          withSlotIds.push({ gameSlotId, claim: game });
        }
        await assertArenaHeadroom(
          tx,
          withSlotIds.map((w) => ({ gameSlotId: w.gameSlotId, playerCount: w.claim.playerCount })),
          config,
          input.excludeBookingId,
          input.now,
        );

        const bookingGameIds: string[] = [];
        for (const { gameSlotId, claim } of withSlotIds) {
          const row = await tx.bookingGame.create({
            data: {
              bookingId: input.bookingId,
              gameSlotId,
              arenaGroupIndex: claim.arenaGroupIndex,
              playerCount: claim.playerCount,
              partyGameSetId: claim.partyGameSetId,
              assignmentSource: claim.assignmentSource,
            },
            select: { id: true },
          });
          bookingGameIds.push(row.id);
        }

        return { roomSlotIds, bookingGameIds };
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    if (error instanceof BookingConflictError) throw error;
    // P2002 = unique constraint violation. On BookingRoomSlot that is precisely the race this
    // whole design exists to lose safely: the other transaction got the room first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String((error.meta as { target?: unknown } | undefined)?.target ?? '');
      if (target.includes('roomId') || target.includes('BookingRoomSlot')) {
        throw new BookingConflictError(
          rejection('ROOM_DOUBLE_BOOKED', undefined, { constraint: target }),
        );
      }
      // The other unique index in this transaction is BookingGame(bookingId, gameSlotId) —
      // R-64's "two arena groups of one booking must not share a slot". Reporting that as
      // ROOM_DOUBLE_BOOKED would tell a laser tag customer, who has no room at all, that a
      // party room was taken.
      if (target.includes('gameSlotId') || target.includes('BookingGame')) {
        throw new BookingConflictError(
          rejection(
            'PARTIAL_BLOCK',
            'Your groups would end up in the same game. Pick a different start time.',
            { constraint: target },
          ),
        );
      }
      throw new BookingConflictError(rejection('CONFIG_INVALID', undefined, { constraint: target }));
    }
    throw error;
  }
}

/**
 * R-21 / R-30 — releasing inventory. Deleting the room-slot rows is what frees the room; the
 * unique index would otherwise keep a cancelled booking's claim alive forever. The audit trail
 * lives in BookingChangeLog (R-62), not in tombstoned inventory rows.
 */
export async function releaseBookingInventory(prisma: PrismaClient, bookingId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.bookingRoomSlot.deleteMany({ where: { bookingId } });
    await tx.bookingGame.deleteMany({ where: { bookingId } });
  });
}
