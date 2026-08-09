/**
 * The concurrency guarantee, proven against a real database.
 *
 * Two parents hitting Confirm at the same instant for the last free room-slot must not both
 * succeed. The proof is not "the code checks first" — every double-booking bug in history
 * checked first. The proof is that the second INSERT cannot physically commit, because
 * `BookingRoomSlot` carries a UNIQUE index on (roomId, startsAtUtc).
 *
 * This suite runs against its own SQLite file so it never touches dev data.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BookingConflictError, commitBookingInventory, releaseBookingInventory } from '../src/lib/db/booking-repository';
import { parseClock24 } from '../src/lib/domain/time';
import { config } from './helpers';
import { rooms } from '../prisma/seed-data';

const DB_FILE = path.join(process.cwd(), 'prisma', 'test-concurrency.db');
const DATE = '2026-09-19';
const WINDOW_START = parseClock24('13:00');
const WINDOW_END = parseClock24('15:00');

let prisma: PrismaClient;

function removeDbFiles(): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(`${DB_FILE}${suffix}`, { force: true });
  }
}

beforeAll(async () => {
  removeDbFiles();
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` },
    stdio: 'pipe',
  });
  prisma = new PrismaClient({ datasources: { db: { url: `file:${DB_FILE}` } } });
  for (const room of rooms) {
    await prisma.room.create({
      data: { id: room.id, name: room.name, capacity: room.capacity, isActive: true, sortOrder: room.sortOrder },
    });
  }
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  removeDbFiles();
});

async function makeBooking(reference: string): Promise<string> {
  const booking = await prisma.booking.create({
    data: {
      reference,
      type: 'PARTY',
      status: 'HOLD',
      date: DATE,
      customerName: `Parent ${reference}`,
      customerEmail: `${reference.toLowerCase()}@example.test`,
      customerPhone: '204-555-0134',
      createdVia: 'ONLINE',
    },
    select: { id: true },
  });
  return booking.id;
}

describe('two simultaneous bookings for the last room-slot', () => {
  it('yields exactly one success and one ROOM_DOUBLE_BOOKED', async () => {
    const [bookingA, bookingB] = await Promise.all([makeBooking('LT-RACE-A'), makeBooking('LT-RACE-B')]);

    const claim = (bookingId: string) =>
      commitBookingInventory(prisma, {
        bookingId,
        date: DATE,
        config,
        roomSlots: [{ roomId: 'RM1', date: DATE, startMinutes: WINDOW_START, endMinutes: WINDOW_END }],
        games: [
          { startMinutes: parseClock24('13:15'), arenaGroupIndex: 0, playerCount: 14, partyGameSetId: null, assignmentSource: 'CONFIGURED_SET' },
          { startMinutes: parseClock24('14:00'), arenaGroupIndex: 0, playerCount: 14, partyGameSetId: null, assignmentSource: 'AUTO_APPENDED' },
        ],
      });

    // Fired together, resolved together. Whichever transaction commits first wins.
    const results = await Promise.allSettled([claim(bookingA), claim(bookingB)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const failure = (rejected[0] as PromiseRejectedResult).reason;
    expect(failure).toBeInstanceOf(BookingConflictError);
    expect((failure as BookingConflictError).rejection.code).toBe('ROOM_DOUBLE_BOOKED');

    // The database, not the application, is the source of truth for "exactly one".
    const heldSlots = await prisma.bookingRoomSlot.findMany({ where: { roomId: 'RM1', date: DATE } });
    expect(heldSlots).toHaveLength(1);

    // And the loser left nothing behind — the whole transaction rolled back.
    const loserId = heldSlots[0].bookingId === bookingA ? bookingB : bookingA;
    expect(await prisma.bookingRoomSlot.count({ where: { bookingId: loserId } })).toBe(0);
    expect(await prisma.bookingGame.count({ where: { bookingId: loserId } })).toBe(0);
  });

  /**
   * The test above is satisfied by either layer. This one isolates layer 1: it bypasses the
   * application overlap check entirely and writes straight to the table. If the unique index
   * were ever dropped from a future migration, this is the test that fails.
   */
  it('the UNIQUE index alone rejects the duplicate, with no application check involved', async () => {
    const a = await makeBooking('LT-INDEX-A');
    const b = await makeBooking('LT-INDEX-B');
    const startsAtUtc = new Date('2026-11-07T19:00:00.000Z');
    const endsAtUtc = new Date('2026-11-07T21:00:00.000Z');

    await prisma.bookingRoomSlot.create({
      data: { bookingId: a, roomId: 'RM3', date: '2026-11-07', startsAtUtc, endsAtUtc },
    });

    await expect(
      prisma.bookingRoomSlot.create({
        data: { bookingId: b, roomId: 'RM3', date: '2026-11-07', startsAtUtc, endsAtUtc },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(await prisma.bookingRoomSlot.count({ where: { roomId: 'RM3' } })).toBe(1);
    await prisma.bookingRoomSlot.deleteMany({ where: { roomId: 'RM3' } });
  });

  it('frees the room again when the winner cancels (R-21, R-30)', async () => {
    const existing = await prisma.bookingRoomSlot.findFirstOrThrow({ where: { roomId: 'RM1', date: DATE } });
    await releaseBookingInventory(prisma, existing.bookingId);
    expect(await prisma.bookingRoomSlot.count({ where: { roomId: 'RM1', date: DATE } })).toBe(0);

    const bookingC = await makeBooking('LT-RACE-C');
    await commitBookingInventory(prisma, {
      bookingId: bookingC,
      date: DATE,
      config,
      roomSlots: [{ roomId: 'RM1', date: DATE, startMinutes: WINDOW_START, endMinutes: WINDOW_END }],
      games: [{ startMinutes: parseClock24('13:15'), arenaGroupIndex: 0, playerCount: 10, partyGameSetId: null, assignmentSource: 'CONFIGURED_SET' }],
    });
    expect(await prisma.bookingRoomSlot.count({ where: { roomId: 'RM1', date: DATE } })).toBe(1);
    await releaseBookingInventory(prisma, bookingC);
  });

  it('R-30: rejects a partially overlapping window on the same room, which no unique index can catch', async () => {
    const first = await makeBooking('LT-OVERLAP-A');
    await commitBookingInventory(prisma, {
      bookingId: first,
      date: DATE,
      config,
      roomSlots: [{ roomId: 'RM2', date: DATE, startMinutes: parseClock24('15:00'), endMinutes: parseClock24('17:00') }],
      games: [{ startMinutes: parseClock24('15:15'), arenaGroupIndex: 0, playerCount: 10, partyGameSetId: null, assignmentSource: 'CONFIGURED_SET' }],
    });

    const second = await makeBooking('LT-OVERLAP-B');
    // 16:00-18:00 starts inside 15:00-17:00: different startsAtUtc, so the unique index is
    // silent and the in-transaction overlap check is what saves us.
    await expect(
      commitBookingInventory(prisma, {
        bookingId: second,
        date: DATE,
        config,
        roomSlots: [{ roomId: 'RM2', date: DATE, startMinutes: parseClock24('16:00'), endMinutes: parseClock24('18:00') }],
        games: [{ startMinutes: parseClock24('16:15'), arenaGroupIndex: 0, playerCount: 10, partyGameSetId: null, assignmentSource: 'AUTO_APPENDED' }],
      }),
    ).rejects.toThrowError(/room/i);

    expect(await prisma.bookingRoomSlot.count({ where: { roomId: 'RM2', date: DATE } })).toBe(1);

    // A touching boundary (17:00 end / 17:00 start) is NOT an overlap at 0-minute changeover.
    const third = await makeBooking('LT-TOUCH');
    await commitBookingInventory(prisma, {
      bookingId: third,
      date: DATE,
      config,
      roomSlots: [{ roomId: 'RM2', date: DATE, startMinutes: parseClock24('17:00'), endMinutes: parseClock24('19:00') }],
      games: [{ startMinutes: parseClock24('17:15'), arenaGroupIndex: 0, playerCount: 10, partyGameSetId: null, assignmentSource: 'CONFIGURED_SET' }],
    });
    expect(await prisma.bookingRoomSlot.count({ where: { roomId: 'RM2', date: DATE } })).toBe(2);
  });
});

describe('the arena cap is a sum, enforced inside the transaction (R-12, R-31)', () => {
  it('lets two bookings share a game slot up to 25 players and refuses the 26th', async () => {
    const slotDate = '2026-09-26';
    const start = parseClock24('13:15');

    const a = await prisma.booking.create({
      data: { reference: 'LT-ARENA-A', type: 'PUBLIC_GAME', status: 'CONFIRMED', date: slotDate, customerName: 'A', customerEmail: 'a@example.test', customerPhone: '204-555-0100', createdVia: 'ONLINE' },
      select: { id: true },
    });
    await commitBookingInventory(prisma, {
      bookingId: a.id,
      date: slotDate,
      config,
      roomSlots: [],
      games: [{ startMinutes: start, arenaGroupIndex: 0, playerCount: 13, partyGameSetId: null, assignmentSource: 'MANAGER' }],
    });

    const b = await prisma.booking.create({
      data: { reference: 'LT-ARENA-B', type: 'PUBLIC_GAME', status: 'CONFIRMED', date: slotDate, customerName: 'B', customerEmail: 'b@example.test', customerPhone: '204-555-0101', createdVia: 'ONLINE' },
      select: { id: true },
    });
    // 13 + 12 = 25 fits exactly.
    await commitBookingInventory(prisma, {
      bookingId: b.id,
      date: slotDate,
      config,
      roomSlots: [],
      games: [{ startMinutes: start, arenaGroupIndex: 0, playerCount: 12, partyGameSetId: null, assignmentSource: 'MANAGER' }],
    });

    const c = await prisma.booking.create({
      data: { reference: 'LT-ARENA-C', type: 'PUBLIC_GAME', status: 'CONFIRMED', date: slotDate, customerName: 'C', customerEmail: 'c@example.test', customerPhone: '204-555-0102', createdVia: 'ONLINE' },
      select: { id: true },
    });
    await expect(
      commitBookingInventory(prisma, {
        bookingId: c.id,
        date: slotDate,
        config,
        roomSlots: [],
        games: [{ startMinutes: start, arenaGroupIndex: 0, playerCount: 1, partyGameSetId: null, assignmentSource: 'MANAGER' }],
      }),
    ).rejects.toMatchObject({ rejection: { code: 'ARENA_FULL' } });

    const slot = await prisma.gameSlot.findUniqueOrThrow({ where: { date_startMinutes: { date: slotDate, startMinutes: start } } });
    const total = await prisma.bookingGame.aggregate({ where: { gameSlotId: slot.id }, _sum: { playerCount: true } });
    expect(total._sum.playerCount).toBe(25);
  });

  it('R-64: the same booking cannot put two arena groups in one slot', async () => {
    const slotDate = '2026-09-27';
    const booking = await prisma.booking.create({
      data: { reference: 'LT-SPLIT', type: 'PARTY', status: 'HOLD', date: slotDate, customerName: 'D', customerEmail: 'd@example.test', customerPhone: '204-555-0103', createdVia: 'ONLINE' },
      select: { id: true },
    });
    await expect(
      commitBookingInventory(prisma, {
        bookingId: booking.id,
        date: slotDate,
        config,
        roomSlots: [],
        games: [
          { startMinutes: parseClock24('13:15'), arenaGroupIndex: 0, playerCount: 14, partyGameSetId: null, assignmentSource: 'CONFIGURED_SET' },
          { startMinutes: parseClock24('13:15'), arenaGroupIndex: 1, playerCount: 14, partyGameSetId: null, assignmentSource: 'CONFIGURED_SET' },
        ],
      }),
    ).rejects.toThrow();
    expect(await prisma.bookingGame.count({ where: { bookingId: booking.id } })).toBe(0);
  });
});
