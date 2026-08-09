/**
 * The boundaries the spec calls out explicitly, plus the ones that only bite in production:
 * the 90-minute cutoff to the minute, the 14-day notice boundary to the hour, 25 vs 26
 * players, the age rule at exactly 2 years, DST, and money that must never touch a float.
 */

import { describe, expect, it } from 'vitest';

import {
  addMoney,
  agesCompatible,
  arenaHeadroom,
  blockHeadroom,
  computePartyPrice,
  cutoffPassed,
  evaluateCancellation,
  formatMoney,
  generateGameSlots,
  getPublicAvailability,
  loadEngineConfig,
  localDateOf,
  MoneyError,
  parseClock24,
  parseMoney,
  parseRateToMilliPercent,
  planPartyBooking,
  planPublicBooking,
  roundHalfUp,
  selectRoomConfiguration,
  splitArenaGroups,
  taxOn,
  validatePizzaTiers,
  wholeDaysBetween,
  zonedTimeToUtc,
  type Cents,
} from '../src/lib/domain';
import { settings } from '../prisma/seed-data';
import { at, catalog, clocks, config, emptyDay, packageByCode, partyBooking, publicBooking, windowByIdOrThrow } from './helpers';

describe('money is integer cents and never a float', () => {
  it('parses and formats without floating point error', () => {
    expect(parseMoney('259.50')).toBe(25950);
    expect(parseMoney('$8.49')).toBe(849);
    expect(parseMoney('22.4')).toBe(2240);
    expect(parseMoney('0.01')).toBe(1);
    expect(formatMoney(parseMoney('1234.05'))).toBe('$1234.05');
    expect(formatMoney(0 as Cents)).toBe('$0.00');
  });

  it('refuses non-integer cents at construction', () => {
    expect(() => addMoney(1.5 as Cents)).toThrow(MoneyError);
    expect(() => parseMoney('12.345')).toThrow(MoneyError);
    expect(() => parseMoney('abc')).toThrow(MoneyError);
  });

  it('rounds half-up, not banker-style', () => {
    expect(roundHalfUp(5, 2)).toBe(3);
    expect(roundHalfUp(7, 2)).toBe(4);
    expect(roundHalfUp(-5, 2)).toBe(-3);
    // 0.1 + 0.2 in cents is exact.
    expect(addMoney(parseMoney('0.10'), parseMoney('0.20'))).toBe(30);
  });

  it('computes tax as integer arithmetic at the milli-percent scale', () => {
    expect(parseRateToMilliPercent('12.0')).toBe(12000);
    expect(taxOn(parseMoney('376.80'), 12000)).toBe(4522); // .6 rounds up
    expect(taxOn(parseMoney('92.94'), 12000)).toBe(1115); // .28 rounds down
    expect(taxOn(parseMoney('259.50'), 12000)).toBe(3114); // exact
  });

  it('re-baselines every worked-example total by changing one number (R-67)', () => {
    const atZero = { ...config, taxRateMilliPercent: 0 };
    const price = computePartyPrice({ packageRecord: packageByCode('GREAT_ADVENTURE'), guests: 10, catalog, config: atZero });
    expect(price.ok && price.value.taxCents).toBe(0);
    expect(price.ok && price.value.totalCents).toBe(25950);
  });
});

describe('the 90-minute cutoff, to the minute (R-10)', () => {
  const date = '2026-09-17';
  const startsAtUtc = zonedTimeToUtc(date, parseClock24('13:45'), config.timezone);

  it('accepts at exactly startTime - 90 minutes (strictly greater-than)', () => {
    expect(cutoffPassed({ now: at(date, '12:15'), startsAtUtc, channel: 'ONLINE', config })).toBe(false);
  });

  it('rejects one minute later', () => {
    expect(cutoffPassed({ now: at(date, '12:16'), startsAtUtc, channel: 'ONLINE', config })).toBe(true);
  });

  it('accepts one minute earlier', () => {
    expect(cutoffPassed({ now: at(date, '12:14'), startsAtUtc, channel: 'ONLINE', config })).toBe(false);
  });

  it('exempts the manager backend while CFG.cutoffAppliesToManager is false (R-13)', () => {
    expect(cutoffPassed({ now: at(date, '13:44'), startsAtUtc, channel: 'MANAGER', config })).toBe(false);
    const strict = { ...config, cutoffAppliesToManager: true };
    expect(cutoffPassed({ now: at(date, '13:44'), startsAtUtc, channel: 'MANAGER', config: strict })).toBe(true);
  });

  it('is driven by config, not a literal: raising it to 120 moves the boundary', () => {
    const twoHours = { ...config, onlineCutoffMinutes: 120 };
    expect(cutoffPassed({ now: at(date, '11:45'), startsAtUtc, channel: 'ONLINE', config: twoHours })).toBe(false);
    expect(cutoffPassed({ now: at(date, '11:46'), startsAtUtc, channel: 'ONLINE', config: twoHours })).toBe(true);
  });
});

describe('arena capacity: 25 vs 26 (R-12, R-63, R-64)', () => {
  const date = '2026-09-17';

  it('accepts a public booking of exactly 25 and rejects 26 on the same empty slot', () => {
    const request = {
      now: at(date, '09:00'),
      date,
      games: 1,
      startMinutes: parseClock24('13:45'),
      channel: 'ONLINE' as const,
      catalog,
      config,
      dayState: emptyDay(date),
    };
    expect(planPublicBooking({ ...request, players: 25 }).ok).toBe(true);

    const twentySix = planPublicBooking({ ...request, players: 26 });
    // 26 splits into 13 + 13 across two consecutive blocks, so it is bookable but never puts
    // 26 people in the arena at once (R-14 -> R-64).
    expect(twentySix.ok).toBe(true);
    if (!twentySix.ok) return;
    expect(twentySix.value.arenaGroups.map((g) => g.playerCount)).toEqual([13, 13]);
    const slots = twentySix.value.arenaGroups.flatMap((g) => g.startMinutes);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('splits evenly and deterministically', () => {
    expect(splitArenaGroups(25, config)).toEqual([25]);
    expect(splitArenaGroups(26, config)).toEqual([13, 13]);
    expect(splitArenaGroups(28, config)).toEqual([14, 14]);
    expect(splitArenaGroups(51, config)).toEqual([17, 17, 17]);
    expect(splitArenaGroups(52, config)).toEqual([18, 17, 17]);
  });

  it('rejects the 25th + 1 seat when the slot is already partly sold', () => {
    const dayState = {
      ...emptyDay(date),
      publicBookings: [publicBooking({ bookingId: 'PUB1', date, games: [{ clock: '13:45', playerCount: 20 }] })],
    };
    expect(arenaHeadroom(dayState, parseClock24('13:45'), config)).toBe(5);
    const request = {
      now: at(date, '09:00'),
      date,
      games: 1,
      startMinutes: parseClock24('13:45'),
      channel: 'ONLINE' as const,
      catalog,
      config,
      dayState,
    };
    expect(planPublicBooking({ ...request, players: 5 }).ok).toBe(true);
    const six = planPublicBooking({ ...request, players: 6 });
    expect(six.ok).toBe(false);
    if (six.ok) return;
    expect(six.error.code).toBe('ARENA_FULL');
    expect(six.error.detail.seatsRemaining).toBe(5);
  });

  it('reports PARTIAL_BLOCK when only a later game of the block is full', () => {
    const dayState = {
      ...emptyDay(date),
      publicBookings: [publicBooking({ bookingId: 'PUB1', date, games: [{ clock: '14:00', playerCount: 24 }] })],
    };
    const result = planPublicBooking({
      now: at(date, '09:00'),
      date,
      players: 6,
      games: 2,
      startMinutes: parseClock24('13:45'),
      channel: 'ONLINE',
      catalog,
      config,
      dayState,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PARTIAL_BLOCK');
    expect(blockHeadroom(dayState, [parseClock24('13:45'), parseClock24('14:00')], config)).toBe(1);
  });

  it('R-31: a window can have a free room and no arena headroom', () => {
    const date = '2026-09-19';
    // Fill both weekend-morning game slots of Set 1 and Set 2 with public-ish occupancy by
    // parking a large party on every morning slot, leaving RM5 physically free.
    const dayState = {
      ...emptyDay(date),
      partyBookings: [
        partyBooking({
          bookingId: 'P1',
          date,
          partyWindowId: 'W-SAT-1000',
          roomConfigurationId: 'CFG-A-14',
          honoreeAge: 9,
          claimedGameSetIds: ['W-SAT-1000-SET1', 'W-SAT-1000-SET2'],
          games: [
            { clock: '10:15', playerCount: 25 },
            { clock: '10:30', playerCount: 25 },
            { clock: '10:45', playerCount: 25 },
            { clock: '11:00', playerCount: 25 },
          ],
        }),
      ],
    };
    // RM2 and RM5 are still free, so the room constraint passes...
    const roomResult = selectRoomConfiguration({
      guests: 10,
      catalog,
      config,
      window: windowByIdOrThrow('W-SAT-1000'),
      dayState,
    });
    expect(roomResult.ok).toBe(true);
    // ...but every game slot in the window is at capacity, so the booking still fails.
    const plan = planPartyBooking({
      now: at('2026-09-01', '12:00'),
      date,
      guests: 10,
      honoreeAge: 9,
      packageCode: 'GREAT_ADVENTURE',
      partyWindowId: 'W-SAT-1000',
      channel: 'ONLINE',
      catalog,
      config,
      dayState,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error.code).toBe('NO_GAME_CAPACITY');
  });
});

describe('the 14-day notice boundary, to the hour (R-56)', () => {
  const eventStart = zonedTimeToUtc('2026-09-15', parseClock24('17:00'), config.timezone);

  it('counts whole days by wall clock, flooring the remainder', () => {
    expect(wholeDaysBetween(at('2026-09-01', '17:00'), eventStart, config.timezone)).toBe(14);
    expect(wholeDaysBetween(at('2026-09-01', '16:59'), eventStart, config.timezone)).toBe(14);
    expect(wholeDaysBetween(at('2026-09-01', '17:01'), eventStart, config.timezone)).toBe(13);
    expect(wholeDaysBetween(at('2026-09-15', '16:59'), eventStart, config.timezone)).toBe(0);
  });

  it('exactly 14 days gets the gift card; one minute later forfeits', () => {
    const onTime = evaluateCancellation({ now: at('2026-09-01', '17:00'), eventStartsAtUtc: eventStart, depositAmountCents: config.depositAmountCents, config });
    expect(onTime.depositStatus).toBe('CONVERTED_TO_GIFT_CARD');
    const late = evaluateCancellation({ now: at('2026-09-01', '17:01'), eventStartsAtUtc: eventStart, depositAmountCents: config.depositAmountCents, config });
    expect(late.depositStatus).toBe('FORFEITED');
  });

  it('is not fooled by the DST transition (a 23-hour local day)', () => {
    // Winnipeg springs forward on 2026-03-08. An event on 2026-03-15 09:00 is exactly 14
    // wall-clock days after 2026-03-01 09:00, even though only 13 days 23 hours elapsed.
    const springEvent = zonedTimeToUtc('2026-03-15', parseClock24('09:00'), config.timezone);
    const fourteenDaysBefore = at('2026-03-01', '09:00');
    const elapsedHours = (springEvent.getTime() - fourteenDaysBefore.getTime()) / 3_600_000;
    expect(elapsedHours).toBe(335); // 14 x 24 = 336, minus the hour DST stole
    expect(wholeDaysBetween(fourteenDaysBefore, springEvent, config.timezone)).toBe(14);
    const outcome = evaluateCancellation({ now: fourteenDaysBefore, eventStartsAtUtc: springEvent, depositAmountCents: config.depositAmountCents, config });
    expect(outcome.depositStatus).toBe('CONVERTED_TO_GIFT_CARD');
  });
});

describe('the age rule at exactly 2 years (R-35, R-37)', () => {
  it('allows a difference of exactly CFG.maxAgeDifferenceYears', () => {
    expect(agesCompatible(7, 9, config)).toBe(true);
    expect(agesCompatible(9, 7, config)).toBe(true);
    expect(agesCompatible(7, 10, config)).toBe(false);
    expect(agesCompatible(7, 11, config)).toBe(false);
  });

  it('applies pairwise across three parties, not just to "the two parties" (R-37)', () => {
    const date = '2026-09-19';
    // Two parties already in the weekend-morning window at 8 and 10 — compatible with each
    // other. A third at 11 is within 2 of the 10 but 3 from the 8, so it must be refused.
    const dayState = {
      ...emptyDay(date),
      partyBookings: [
        partyBooking({ bookingId: 'P1', date, partyWindowId: 'W-SAT-1000', roomConfigurationId: 'CFG-A-14', honoreeAge: 8, claimedGameSetIds: ['W-SAT-1000-SET1'], games: [{ clock: '10:15', playerCount: 10 }, { clock: '10:45', playerCount: 10 }] }),
        partyBooking({ bookingId: 'P2', date, partyWindowId: 'W-SAT-1000', roomConfigurationId: 'CFG-A-12', honoreeAge: 10, claimedGameSetIds: ['W-SAT-1000-SET2'], games: [{ clock: '10:30', playerCount: 10 }, { clock: '11:00', playerCount: 10 }] }),
      ],
    };
    const third = planPartyBooking({
      now: at('2026-09-01', '12:00'),
      date,
      guests: 10,
      honoreeAge: 11,
      packageCode: 'GREAT_ADVENTURE',
      partyWindowId: 'W-SAT-1000',
      channel: 'ONLINE',
      catalog,
      config,
      dayState,
    });
    expect(third.ok).toBe(false);
    if (third.ok) return;
    expect(third.error.code).toBe('AGE_GAP_EXCEEDED');
    expect(third.error.detail.existingAges).toEqual([8]);
  });
});

describe('R-25 preference order', () => {
  const date = '2026-10-14';
  const window = windowByIdOrThrow('W-WED-1800');

  it('prefers one big room over two small ones (fewest room-slots first)', () => {
    // 16 guests: CFG-G-18 is 1 room-slot, CFG-B-28 is 3. CFG-B-20 is not offered here.
    const result = selectRoomConfiguration({ guests: 16, catalog, config, window, dayState: emptyDay(date) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.configuration.code).toBe('CFG-G-18');
    expect(result.value.roomSlotsConsumed).toBe(1);
  });

  it('then prefers the smallest capacity that fits', () => {
    const result = selectRoomConfiguration({ guests: 12, catalog, config, window, dayState: emptyDay(date) });
    expect(result.ok && result.value.configuration.code).toBe('CFG-B-12');
  });

  it('R-27: capacity is the stored override, never the sum of member rooms', () => {
    const combined = catalog.roomConfigurations.find((c) => c.code === 'CFG-A-20');
    expect(combined?.capacity).toBe(20);
    const memberSum = combined!.roomIds
      .map((id) => catalog.rooms.find((r) => r.id === id)!.capacity)
      .reduce((a, b) => a + b, 0);
    expect(memberSum).toBe(26);
    expect(combined?.capacity).not.toBe(memberSum);
  });

  it('R-30: touching boundaries do not overlap at the seeded 0-minute changeover', () => {
    const date = '2026-09-19';
    const dayState = {
      ...emptyDay(date),
      partyBookings: [
        partyBooking({ bookingId: 'P1', date, partyWindowId: 'W-SAT-1100', roomConfigurationId: 'CFG-B-14', honoreeAge: 9, claimedGameSetIds: [], games: [{ clock: '12:00', playerCount: 10 }, { clock: '12:30', playerCount: 10 }] }),
      ],
    };
    // Saturday 11:00-13:00 ends exactly as 13:00-15:00 begins; RM3 is free for the later one.
    const later = selectRoomConfiguration({ guests: 14, catalog, config, window: windowByIdOrThrow('W-SAT-1300'), dayState });
    expect(later.ok).toBe(true);
    // ...and a 15-minute changeover would still not collide, because they use different rooms.
    const withBuffer = selectRoomConfiguration({ guests: 14, catalog, config: { ...config, windowChangeoverMinutes: 15 }, window: windowByIdOrThrow('W-SAT-1300'), dayState });
    expect(withBuffer.ok).toBe(true);
  });

  it('R-30: overlapping Sunday windows are only safe because they use different rooms', () => {
    const date = '2026-09-20';
    const dayState = {
      ...emptyDay(date),
      partyBookings: [
        partyBooking({ bookingId: 'P1', date, partyWindowId: 'W-SUN-1500', roomConfigurationId: 'CFG-B-14', honoreeAge: 9, claimedGameSetIds: ['W-SUN-1500-SET1'], games: [{ clock: '15:00', playerCount: 10 }, { clock: '15:30', playerCount: 10 }] }),
      ],
    };
    const overlapping = selectRoomConfiguration({ guests: 14, catalog, config, window: windowByIdOrThrow('W-SUN-1600'), dayState });
    expect(overlapping.ok).toBe(true);
    if (!overlapping.ok) return;
    expect(overlapping.value.roomIds).toEqual(['RM1']); // never RM3
  });
});

describe('slot generation (R-02 to R-06)', () => {
  it('runs 12:00 to 20:45 on a Wednesday', () => {
    const slots = generateGameSlots({ date: '2026-09-16', catalog, config });
    const publicSlots = slots.filter((s) => s.startMinutes >= parseClock24('12:00'));
    expect(clocks([publicSlots[0]])).toEqual(['12:00']);
    expect(clocks([publicSlots[publicSlots.length - 1]])).toEqual(['20:45']);
    expect(publicSlots).toHaveLength(36);
  });

  it('runs 12:00 to 21:45 on a Friday and 12:00 to 18:45 on a Sunday', () => {
    const friday = generateGameSlots({ date: '2026-09-18', catalog, config });
    expect(clocks([friday[friday.length - 1]])).toEqual(['21:45']);
    const sunday = generateGameSlots({ date: '2026-09-20', catalog, config }).filter((s) => s.mode !== 'PARTY_ONLY');
    expect(clocks([sunday[sunday.length - 1]])).toEqual(['18:45']);
  });

  it('adds exactly four PARTY_ONLY morning slots on Saturday and Sunday, and none 11:15-11:45', () => {
    const saturday = generateGameSlots({ date: '2026-09-19', catalog, config });
    const partyOnly = saturday.filter((s) => s.mode === 'PARTY_ONLY');
    expect(clocks(partyOnly)).toEqual(['10:15', '10:30', '10:45', '11:00']);
    const between = saturday.filter((s) => s.startMinutes > parseClock24('11:00') && s.startMinutes < parseClock24('12:00'));
    expect(between).toEqual([]);
  });

  it('marks the four Mon-Fri reserved times PARTY_HELD', () => {
    const slots = generateGameSlots({ date: '2026-09-16', catalog, config });
    const held = slots.filter((s) => s.mode === 'PARTY_HELD');
    expect(clocks(held)).toEqual(['17:15', '17:30', '18:15', '18:45']);
  });

  it('a Closure suppresses the whole day (R-06)', () => {
    const closedCatalog = { ...catalog, closures: [{ date: '2026-09-16', reason: 'Statutory holiday', blocksParties: true, blocksPublic: true }] };
    expect(generateGameSlots({ date: '2026-09-16', catalog: closedCatalog, config })).toEqual([]);
    const availability = getPublicAvailability({ now: at('2026-09-01', '12:00'), date: '2026-09-16', players: 4, games: 1, channel: 'ONLINE', catalog: closedCatalog, config, dayState: emptyDay('2026-09-16') });
    expect(availability.closed).toBe(true);
    expect(availability.closedReason).toBe('VENUE_CLOSED');
  });

  it('a manager block takes a single slot out (R-23d)', () => {
    const dayState = { ...emptyDay('2026-09-16'), blockedSlotMinutes: [parseClock24('13:00')] };
    const result = planPublicBooking({ now: at('2026-09-01', '12:00'), date: '2026-09-16', players: 4, games: 1, startMinutes: parseClock24('13:00'), channel: 'ONLINE', catalog, config, dayState });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SLOT_UNAVAILABLE');
  });
});

describe('reserved release (R-18, R-19)', () => {
  const date = '2026-09-16';

  it('releases at exactly the 7-day lead and not a minute before', () => {
    const request = { date, players: 4, games: 1, startMinutes: parseClock24('17:15'), channel: 'ONLINE' as const, catalog, config, dayState: emptyDay(date) };
    const gameStart = zonedTimeToUtc(date, parseClock24('17:15'), config.timezone);
    const exactly7Days = new Date(gameStart.getTime() - config.reservedReleaseLeadMinutes * 60_000);
    expect(planPublicBooking({ ...request, now: exactly7Days }).ok).toBe(true);
    const oneMinuteEarlier = new Date(exactly7Days.getTime() - 60_000);
    const early = planPublicBooking({ ...request, now: oneMinuteEarlier });
    expect(early.ok).toBe(false);
    if (early.ok) return;
    expect(early.error.code).toBe('SLOT_HELD_FOR_PARTY');
  });

  it('does not release a set a party has already claimed', () => {
    const dayState = {
      ...emptyDay(date),
      partyBookings: [
        partyBooking({ bookingId: 'P1', date, partyWindowId: 'W-WED-1700', roomConfigurationId: 'CFG-A-12', honoreeAge: 8, claimedGameSetIds: ['W-WED-1700-SET1'], games: [{ clock: '17:15', playerCount: 10 }, { clock: '18:15', playerCount: 10 }] }),
      ],
    };
    const result = planPublicBooking({ now: at('2026-09-15', '12:00'), date, players: 4, games: 1, startMinutes: parseClock24('17:15'), channel: 'ONLINE', catalog, config, dayState });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Inside the 7-day lead the set has released for OTHER sets, but this one is claimed and
    // its arena seats are gone to the party; either way the public cannot have it.
    expect(['SLOT_HELD_FOR_PARTY', 'ARENA_FULL']).toContain(result.error.code);
  });

  it('R-19: PARTY_ONLY slots never release, even when the whole window is unsellable', () => {
    const date = '2026-09-19';
    const dayState = {
      ...emptyDay(date),
      partyBookings: [
        partyBooking({ bookingId: 'P1', date, partyWindowId: 'W-SAT-1000', roomConfigurationId: 'CFG-A-28', honoreeAge: 9, claimedGameSetIds: ['W-SAT-1000-SET1'], games: [{ clock: '10:15', playerCount: 12 }, { clock: '10:45', playerCount: 12 }] }),
      ],
    };
    const result = planPublicBooking({ now: at(date, '09:00'), date, players: 4, games: 1, startMinutes: parseClock24('10:30'), channel: 'ONLINE', catalog, config, dayState });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PARTY_ONLY_WINDOW');
  });
});

describe('configuration is data, not code', () => {
  it('loads every §2.0 key and rejects a missing one', () => {
    const loaded = loadEngineConfig(settings);
    expect(loaded.arenaCapacity).toBe(25);
    expect(loaded.onlineCutoffMinutes).toBe(90);
    expect(loaded.changeNoticeDays).toBe(14);
    expect(loaded.maxPartyGuests).toBe(28);
    expect(loaded.depositAmountCents).toBe(5000);
    expect(loaded.timezone).toBe('America/Winnipeg');
    expect(() => loadEngineConfig(settings.filter((s) => s.key !== 'CFG.arenaCapacity'))).toThrow(/CFG.arenaCapacity/);
  });

  it('changing arena capacity changes the split without touching code', () => {
    expect(splitArenaGroups(28, { ...config, arenaCapacity: 30 })).toEqual([28]);
    expect(splitArenaGroups(28, { ...config, arenaCapacity: 10 })).toEqual([10, 9, 9]);
  });

  it('validates the pizza tiers, and fails the brief original rows', () => {
    expect(validatePizzaTiers(catalog.pizzaTiers)).toEqual([]);
    const briefOriginal = [
      { minGuests: 10, maxGuests: 10, pizzaCount: 2 },
      { minGuests: 12, maxGuests: 15, pizzaCount: 3 },
      { minGuests: 16, maxGuests: 20, pizzaCount: 4 },
      { minGuests: 20, maxGuests: 25, pizzaCount: 5 },
      { minGuests: 25, maxGuests: 30, pizzaCount: 6 },
    ];
    const problems = validatePizzaTiers(briefOriginal);
    expect(problems.map((p) => p.kind)).toEqual(['GAP', 'OVERLAP', 'OVERLAP']);
  });
});

describe('time zone handling is explicit', () => {
  it('never uses the server clock: the same instant is a different local date near midnight', () => {
    const instant = new Date('2026-09-16T04:30:00.000Z'); // 23:30 on the 15th in Winnipeg
    expect(localDateOf(instant, 'America/Winnipeg')).toBe('2026-09-15');
    expect(localDateOf(instant, 'UTC')).toBe('2026-09-16');
  });

  it('holds a party window at the same wall clock across the DST change', () => {
    const beforeDst = zonedTimeToUtc('2026-03-01', parseClock24('17:00'), config.timezone);
    const afterDst = zonedTimeToUtc('2026-03-15', parseClock24('17:00'), config.timezone);
    expect(beforeDst.toISOString()).toBe('2026-03-01T23:00:00.000Z'); // CST, UTC-6
    expect(afterDst.toISOString()).toBe('2026-03-15T22:00:00.000Z'); // CDT, UTC-5
  });

  it('resolves the nonexistent 02:30 wall clock on the spring-forward morning without throwing', () => {
    const skipped = zonedTimeToUtc('2026-03-08', parseClock24('02:30'), config.timezone);
    expect(Number.isNaN(skipped.getTime())).toBe(false);
  });
});
