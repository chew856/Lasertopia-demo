import { describe, expect, it } from 'vitest';

import {
  arenaState,
  boardSpan,
  buildArenaLane,
  buildRoomChips,
  buildRows,
  rowId,
  summariseShift,
  summariseWeek,
  type BoardGameInput,
  type BoardPartyInput,
} from '@/app/manage/_lib/board';
import {
  anyImpact,
  blockImpact,
  encodeBlockMeta,
  expandBlockRange,
  parseBlockMeta,
} from '@/app/manage/_lib/blocks';

/** A party with sensible defaults; each test overrides only what it is about. */
function party(overrides: Partial<BoardPartyInput> = {}): BoardPartyInput {
  return {
    bookingId: 'b1',
    reference: 'PT-AAAA1111',
    status: 'CONFIRMED',
    honoreeName: 'Ada',
    honoreeAge: 9,
    guestCount: 14,
    packageName: 'The Great Adventure',
    roomIds: ['RM1'],
    roomNames: ['Room 1'],
    windowStartMinutes: 780, // 13:00
    windowEndMinutes: 900, // 15:00
    windowLabel: '1:00 – 3:00 PM',
    gameStartMinutes: [795, 825],
    depositRecorded: true,
    allergyNotes: '',
    organiserName: 'Dana',
    organiserPhone: '2045550134',
    overrideReason: null,
    createdAtMs: 1_000,
    ...overrides,
  };
}

function game(overrides: Partial<BoardGameInput> = {}): BoardGameInput {
  return {
    bookingId: 'g1',
    reference: 'LT-BBBB2222',
    status: 'CONFIRMED',
    customerName: 'Marcus',
    customerPhone: '2045550199',
    playerCount: 6,
    startMinutes: [1095],
    overrideReason: null,
    createdAtMs: 2_000,
    ...overrides,
  };
}

describe('the time axis', () => {
  it('runs a continuous tick across games and party windows', () => {
    // Saturday's real shape: party-only games 10:15–11:00, nothing until 12:00, and a
    // 10:00–12:00 window covering the gap. The axis must not skip 11:15–11:45.
    const span = boardSpan([615, 630, 645, 660, 720, 735], [{ startMinutes: 600, endMinutes: 720 }], 15);
    expect(span).toEqual({ fromMinutes: 600, toMinutes: 750 });

    const rows = buildRows(span!.fromMinutes, span!.toMinutes, 15);
    expect(rows).toHaveLength(10);
    expect(rows[0].startMinutes).toBe(600);
    expect(rows.map((row) => row.startMinutes)).toContain(705); // 11:45 — no game, still a row
    expect(rows.at(-1)?.startMinutes).toBe(735);
  });

  it('marks hour boundaries so a manager can find 5:15 without counting', () => {
    const rows = buildRows(720, 780, 15);
    expect(rows.map((row) => row.onHour)).toEqual([true, false, false, false]);
  });

  it('returns no span for a date with neither games nor windows', () => {
    expect(boardSpan([], [], 15)).toBeNull();
    expect(buildRows(0, 0, 15)).toEqual([]);
    expect(buildRows(600, 700, 0)).toEqual([]);
  });
});

describe('arena state precedence', () => {
  const cap = 25;

  it('ranks blocked above everything — nothing can be sold', () => {
    expect(arenaState({ playersUsed: 25, capacity: cap, mode: 'BLOCKED' })).toEqual({
      state: 'blocked',
      stateWord: 'BLOCKED',
    });
  });

  it('ranks a full arena above a party hold — it is the constraint that bites next', () => {
    expect(arenaState({ playersUsed: 25, capacity: cap, mode: 'PARTY_HELD' }).state).toBe('full');
  });

  it('shows a party hold when there is still headroom', () => {
    expect(arenaState({ playersUsed: 14, capacity: cap, mode: 'PARTY_HELD' })).toEqual({
      state: 'party',
      stateWord: 'PARTY',
    });
  });

  it('distinguishes empty from partly sold', () => {
    expect(arenaState({ playersUsed: 0, capacity: cap, mode: 'PUBLIC' }).state).toBe('open');
    expect(arenaState({ playersUsed: 1, capacity: cap, mode: 'PUBLIC' }).state).toBe('filling');
    expect(arenaState({ playersUsed: 26, capacity: cap, mode: 'PUBLIC' }).state).toBe('full');
  });

  it('always carries a word, never colour alone', () => {
    for (const mode of ['PUBLIC', 'PARTY_HELD', 'PARTY_ONLY', 'BLOCKED'] as const) {
      const result = arenaState({ playersUsed: 3, capacity: cap, mode });
      expect(result.stateWord).toMatch(/^[A-Z]+$/);
    }
  });
});

describe('the arena lane', () => {
  it('counts parties and public bookings into the same slot', () => {
    const lane = buildArenaLane({
      slots: [{ startMinutes: 795, mode: 'PARTY_HELD' }],
      parties: [party()],
      games: [game({ startMinutes: [795], playerCount: 6 })],
      arenaCapacity: 25,
      nowMinutes: null,
    });
    expect(lane[0].playersUsed).toBe(20);
    expect(lane[0].bookings).toHaveLength(2);
    expect(lane[0].rowId).toBe(rowId(795));
  });

  it('marks a slot PAST relative to the clock it is handed', () => {
    const slots = [{ startMinutes: 720, mode: 'PUBLIC' as const }];
    expect(buildArenaLane({ slots, parties: [], games: [], arenaCapacity: 25, nowMinutes: 800 })[0].markers)
      .toContain('PAST');
    expect(buildArenaLane({ slots, parties: [], games: [], arenaCapacity: 25, nowMinutes: 700 })[0].markers)
      .not.toContain('PAST');
    expect(buildArenaLane({ slots, parties: [], games: [], arenaCapacity: 25, nowMinutes: null })[0].isPast)
      .toBe(false);
  });

  it('badges a slot that carries an overridden booking', () => {
    const lane = buildArenaLane({
      slots: [{ startMinutes: 795, mode: 'PUBLIC' }],
      parties: [party({ overrideReason: 'Manager approved' })],
      games: [],
      arenaCapacity: 25,
      nowMinutes: null,
    });
    expect(lane[0].markers).toContain('OVERRIDE');
  });
});

describe('room chips', () => {
  const rows = buildRows(720, 960, 15);

  it('spans a party across every row inside its window, per room', () => {
    const chips = buildRoomChips([party({ roomIds: ['RM1', 'RM2'] })], rows);
    expect(chips).toHaveLength(2);
    expect(chips[0].rowId).toBe(rowId(780));
    // 13:00–15:00 at 15-minute rows is eight rows, and the 15:00 row is excluded.
    expect(chips[0].span).toBe(8);
    expect(chips.map((chip) => chip.roomId)).toEqual(['RM1', 'RM2']);
  });

  it('surfaces the two things a chip must warn about', () => {
    const [chip] = buildRoomChips([party({ allergyNotes: ' peanut ', depositRecorded: false })], rows);
    expect(chip.hasAllergy).toBe(true);
    expect(chip.depositOutstanding).toBe(true);
  });

  it('drops a party whose window falls outside the rendered axis', () => {
    expect(buildRoomChips([party({ windowStartMinutes: 300, windowEndMinutes: 420 })], rows)).toEqual([]);
  });
});

describe('the shift dashboard', () => {
  it('lists the next arrivals only, in time order, capped', () => {
    const stats = summariseShift({
      parties: [party({ bookingId: 'p1', windowStartMinutes: 780 })],
      games: [
        game({ bookingId: 'g1', startMinutes: [750] }),
        game({ bookingId: 'g2', startMinutes: [900] }),
        game({ bookingId: 'g3', startMinutes: [960] }),
        game({ bookingId: 'g4', startMinutes: [600] }),
      ],
      nowMinutes: 700,
      shiftStartedAtMs: 0,
      arrivalLimit: 3,
    });
    expect(stats.arrivals.map((arrival) => arrival.bookingId)).toEqual(['g1', 'p1', 'g2']);
  });

  it('counts deposits outstanding and allergy flags — the two tappable alerts', () => {
    const stats = summariseShift({
      parties: [
        party({ bookingId: 'p1', depositRecorded: false, allergyNotes: 'dairy' }),
        party({ bookingId: 'p2', depositRecorded: true, allergyNotes: '   ' }),
      ],
      games: [],
      nowMinutes: null,
      shiftStartedAtMs: 0,
      arrivalLimit: 3,
    });
    expect(stats.depositsOutstanding.map((row) => row.bookingId)).toEqual(['p1']);
    expect(stats.allergyFlags.map((row) => row.bookingId)).toEqual(['p1']);
    expect(stats.partyCount).toBe(2);
  });

  it('excludes cancelled bookings from every count', () => {
    const stats = summariseShift({
      parties: [party({ status: 'CANCELLED', depositRecorded: false, allergyNotes: 'nuts' })],
      games: [game({ status: 'CANCELLED' })],
      nowMinutes: null,
      shiftStartedAtMs: 0,
      arrivalLimit: 3,
    });
    expect(stats.partyCount).toBe(0);
    expect(stats.arrivals).toEqual([]);
    expect(stats.allergyFlags).toEqual([]);
  });

  it('badges only what arrived during this shift', () => {
    const stats = summariseShift({
      parties: [party({ bookingId: 'old', createdAtMs: 100 }), party({ bookingId: 'new', createdAtMs: 5_000 })],
      games: [],
      nowMinutes: null,
      shiftStartedAtMs: 1_000,
      arrivalLimit: 3,
    });
    expect(stats.newBookingIds).toEqual(['new']);
  });
});

describe('week view', () => {
  it('scales the load bar against the busiest day, never against a fixed ceiling', () => {
    const week = summariseWeek([
      { date: '2026-08-09', closed: false, parties: [party({ guestCount: 10 })], games: [] },
      { date: '2026-08-10', closed: false, parties: [], games: [game({ playerCount: 30 })] },
      { date: '2026-08-11', closed: true, parties: [], games: [] },
    ]);
    expect(week[1].loadRatio).toBe(1);
    expect(week[0].loadRatio).toBeCloseTo(10 / 30);
    expect(week[2].loadRatio).toBe(0);
    expect(week[2].closed).toBe(true);
  });

  it('never divides by zero on an empty week', () => {
    const week = summariseWeek([{ date: '2026-08-09', closed: false, parties: [], games: [] }]);
    expect(week[0].loadRatio).toBe(0);
  });
});

describe('blocks', () => {
  it('round-trips its metadata', () => {
    const encoded = encodeBlockMeta({
      reason: 'Party expanding',
      byId: 'u1',
      byName: 'Priya',
      atIso: '2026-08-08T18:00:00.000Z',
      previousMode: 'PARTY_HELD',
    });
    expect(parseBlockMeta(encoded)).toEqual({
      reason: 'Party expanding',
      byId: 'u1',
      byName: 'Priya',
      atIso: '2026-08-08T18:00:00.000Z',
      previousMode: 'PARTY_HELD',
    });
  });

  it('reads a hand-written reason as a plain reason instead of throwing', () => {
    expect(parseBlockMeta('maintenance')).toEqual({ reason: 'maintenance' });
    expect(parseBlockMeta('{not json')).toEqual({ reason: '{not json' });
    expect(parseBlockMeta(null)).toEqual({ reason: '' });
    expect(parseBlockMeta('   ')).toEqual({ reason: '' });
  });

  it('never restores an unknown mode — an undo must not release a party time', () => {
    expect(parseBlockMeta('{"prev":"NONSENSE"}').previousMode).toBe('PUBLIC');
    expect(parseBlockMeta('{"reason":"x"}').previousMode).toBeUndefined();
  });

  it('expands a range over real game starts only, never inventing slots in the gap', () => {
    const saturday = [615, 630, 645, 660, 720, 735, 750];
    expect(expandBlockRange(615, 735, saturday)).toEqual([615, 630, 645, 660, 720, 735]);
    // 11:15, 11:30 and 11:45 do not exist on a Saturday and must not be blockable.
    expect(expandBlockRange(660, 720, saturday)).toEqual([660, 720]);
  });

  it('accepts a reversed range', () => {
    expect(expandBlockRange(735, 615, [615, 630, 735])).toEqual([615, 630, 735]);
  });

  it('counts distinct bookings and total players before blocking over them', () => {
    const games = [
      { startMinutes: 1095, playerCount: 6, bookingId: 'a' },
      { startMinutes: 1095, playerCount: 2, bookingId: 'b' },
      { startMinutes: 1110, playerCount: 4, bookingId: 'a' },
    ];
    const impacts = blockImpact([1095, 1110, 1125], games);
    expect(impacts[0]).toEqual({ startMinutes: 1095, bookingCount: 2, playerCount: 8 });
    expect(impacts[1]).toEqual({ startMinutes: 1110, bookingCount: 1, playerCount: 4 });
    expect(impacts[2]).toEqual({ startMinutes: 1125, bookingCount: 0, playerCount: 0 });
    expect(anyImpact(impacts)).toBe(true);
    expect(anyImpact([impacts[2]])).toBe(false);
  });
});
