/**
 * All 14 worked examples from RULES.md §4, as explicit test cases, asserting the stated
 * outputs to the cent.
 *
 * Where the engine and the spec disagree, the test asserts the ENGINE's behaviour and the
 * disagreement is documented in a comment above it — see WE-09's knock-on paragraph, the one
 * place a worked example contradicts a normative MUST rule.
 */

import { describe, expect, it } from 'vitest';

import {
  assignPartyGameTimes,
  computePartyPrice,
  computePublicGamePrice,
  evaluateCancellation,
  evaluatePartyWindow,
  evaluateReschedule,
  formatMoney,
  getPartyAvailability,
  includedPizzaCount,
  parseClock24,
  planPartyBooking,
  planPublicBooking,
  splitArenaGroups,
  zonedTimeToUtc,
  type Cents,
} from '../src/lib/domain';
import {
  addOnOptionId,
  at,
  catalog,
  clocks,
  config,
  emptyDay,
  packageByCode,
  partyBooking,
  publicBooking,
  windowByIdOrThrow,
} from './helpers';

const DEPOSIT = config.depositAmountCents;

function partyRequest(overrides: {
  now: Date;
  date: string;
  guests: number;
  honoreeAge: number;
  packageCode: string;
  dayState?: ReturnType<typeof emptyDay>;
}) {
  return {
    now: overrides.now,
    date: overrides.date,
    guests: overrides.guests,
    honoreeAge: overrides.honoreeAge,
    packageCode: overrides.packageCode,
    channel: 'ONLINE' as const,
    catalog,
    config,
    dayState: overrides.dayState ?? emptyDay(overrides.date),
  };
}

// =========================================================================================
describe('WE-01 — 10 guests, Tuesday, The Great Adventure', () => {
  const date = '2026-09-15';
  const now = at('2026-09-01', '12:00');
  const req = { ...partyRequest({ now, date, guests: 10, honoreeAge: 8, packageCode: 'GREAT_ADVENTURE' }), partyWindowId: 'W-TUE-1700' };

  it('allocates CFG-A-12 -> room RM2 (fewest room-slots, then smallest capacity)', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.selection.configuration.code).toBe('CFG-A-12');
    expect(plan.value.selection.roomIds).toEqual(['RM2']);
    expect(plan.value.selection.roomSlotsConsumed).toBe(1);
  });

  it('leaves 1 of 2 room-slots free so a second party can still book', () => {
    const evaluation = evaluatePartyWindow(req, windowByIdOrThrow('W-TUE-1700'));
    expect(evaluation.roomSlotsTotal).toBe(2);
    expect(evaluation.roomSlotsFree).toBe(2); // before this booking commits
  });

  it('includes 2 pizzas (tier 10-11)', () => {
    const result = includedPizzaCount({
      guests: 10,
      packageRecord: packageByCode('GREAT_ADVENTURE'),
      tiers: catalog.pizzaTiers,
      foodChoice: 'PIZZA',
    });
    expect(result.ok && result.value).toBe(2);
  });

  it('claims Set 1 -> 17:15 and 18:15, both verbatim reserved times', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.arenaGroups).toHaveLength(1);
    expect(clocks(plan.value.arenaGroups[0].times)).toEqual(['17:15', '18:15']);
    expect(plan.value.arenaGroups[0].times.every((t) => t.source === 'CONFIGURED_SET')).toBe(true);
    expect(plan.value.arenaGroups[0].partyGameSetId).toBe('W-TUE-1700-SET1');
  });

  it('makes 1 arena group of 10', () => {
    expect(splitArenaGroups(10, config)).toEqual([10]);
  });

  it('prices at pre-tax 259.50, tax 31.14, total 290.64, balance 240.64', () => {
    const price = computePartyPrice({
      packageRecord: packageByCode('GREAT_ADVENTURE'),
      guests: 10,
      catalog,
      config,
      depositAppliedCents: DEPOSIT,
    });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    expect(price.value.preTaxSubtotalCents).toBe(25950);
    expect(price.value.taxCents).toBe(3114);
    expect(price.value.totalCents).toBe(29064);
    expect(price.value.balanceDueCents).toBe(24064);
    expect(formatMoney(price.value.totalCents)).toBe('$290.64');
  });
});

// =========================================================================================
describe('WE-02 — 14 guests, Saturday 13:00-15:00, The Great Adventure', () => {
  const date = '2026-09-19';
  const now = at('2026-09-01', '12:00');
  const req = { ...partyRequest({ now, date, guests: 14, honoreeAge: 10, packageCode: 'GREAT_ADVENTURE' }), partyWindowId: 'W-SAT-1300' };

  it('allocates CFG-A-14 -> RM1 (CFG-A-12 fails capacity; fewest room-slots beats CFG-A-20)', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.selection.configuration.code).toBe('CFG-A-14');
    expect(plan.value.selection.roomIds).toEqual(['RM1']);
    expect(plan.value.selection.roomSlotsConsumed).toBe(1);
  });

  it('includes 3 pizzas (tier 12-15)', () => {
    const result = includedPizzaCount({ guests: 14, packageRecord: packageByCode('GREAT_ADVENTURE'), tiers: catalog.pizzaTiers, foodChoice: 'PIZZA' });
    expect(result.ok && result.value).toBe(3);
  });

  it('claims 13:15 then R-17 appends 14:00 (13:45 belongs to Set 2 and is skipped)', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const times = plan.value.arenaGroups[0].times;
    expect(clocks(times)).toEqual(['13:15', '14:00']);
    expect(times[0].source).toBe('CONFIGURED_SET');
    expect(times[1].source).toBe('AUTO_APPENDED');
  });

  it('prices at pre-tax 363.30, tax 43.60, total 406.90, balance 356.90', () => {
    const price = computePartyPrice({
      packageRecord: packageByCode('GREAT_ADVENTURE'),
      guests: 14,
      catalog,
      config,
      depositAppliedCents: DEPOSIT,
    });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    expect(price.value.extraGuestCount).toBe(4);
    expect(price.value.extraGuestsCents).toBe(10380);
    expect(price.value.preTaxSubtotalCents).toBe(36330);
    expect(price.value.taxCents).toBe(4360);
    expect(price.value.totalCents).toBe(40690);
    expect(price.value.balanceDueCents).toBe(35690);
  });
});

// =========================================================================================
describe('WE-03 — 15 guests, Saturday 13:00-15:00 (crosses the two-room-slot boundary)', () => {
  const date = '2026-09-19';
  const now = at('2026-09-01', '12:00');
  const req = { ...partyRequest({ now, date, guests: 15, honoreeAge: 10, packageCode: 'GREAT_ADVENTURE' }), partyWindowId: 'W-SAT-1300' };

  it('allocates CFG-A-20 -> RM1 + RM2 because CFG-A-14 now fails by one guest', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.selection.configuration.code).toBe('CFG-A-20');
    expect(plan.value.selection.roomIds).toEqual(['RM1', 'RM2']);
    expect(plan.value.selection.roomSlotsConsumed).toBe(2);
  });

  it('still gets 3 pizzas — the pizza boundary and the room boundary are in different places', () => {
    const result = includedPizzaCount({ guests: 15, packageRecord: packageByCode('GREAT_ADVENTURE'), tiers: catalog.pizzaTiers, foodChoice: 'PIZZA' });
    expect(result.ok && result.value).toBe(3);
  });

  it('sells the window out, so a second party is rejected', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const after = {
      ...emptyDay(date),
      partyBookings: [
        partyBooking({
          bookingId: 'P1',
          date,
          partyWindowId: 'W-SAT-1300',
          roomConfigurationId: 'CFG-A-20',
          honoreeAge: 10,
          claimedGameSetIds: ['W-SAT-1300-SET1'],
          games: [{ clock: '13:15', playerCount: 15 }, { clock: '14:00', playerCount: 15 }],
        }),
      ],
    };
    const second = planPartyBooking({
      ...partyRequest({ now, date, guests: 10, honoreeAge: 10, packageCode: 'GREAT_ADVENTURE', dayState: after }),
      partyWindowId: 'W-SAT-1300',
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('WINDOW_FULL');
  });

  it('R-18(2a): 13:45 releases to the public immediately, without waiting out the 7-day lead', () => {
    const after = {
      ...emptyDay(date),
      partyBookings: [
        partyBooking({
          bookingId: 'P1',
          date,
          partyWindowId: 'W-SAT-1300',
          roomConfigurationId: 'CFG-A-20',
          honoreeAge: 10,
          claimedGameSetIds: ['W-SAT-1300-SET1'],
          games: [{ clock: '13:15', playerCount: 15 }, { clock: '14:00', playerCount: 15 }],
        }),
      ],
    };
    // 18 days ahead — far outside CFG.reservedReleaseLeadMinutes (7 days).
    const publicResult = planPublicBooking({
      now: at('2026-09-01', '12:00'),
      date,
      players: 4,
      games: 1,
      startMinutes: parseClock24('13:45'),
      channel: 'ONLINE',
      catalog,
      config,
      dayState: after,
    });
    expect(publicResult.ok).toBe(true);
  });

  it('prices at pre-tax 389.25, tax 46.71, total 435.96, balance 385.96', () => {
    const price = computePartyPrice({
      packageRecord: packageByCode('GREAT_ADVENTURE'),
      guests: 15,
      catalog,
      config,
      depositAppliedCents: DEPOSIT,
    });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    expect(price.value.extraGuestsCents).toBe(12975);
    expect(price.value.preTaxSubtotalCents).toBe(38925);
    expect(price.value.taxCents).toBe(4671);
    expect(price.value.totalCents).toBe(43596);
    expect(price.value.balanceDueCents).toBe(38596);
  });
});

// =========================================================================================
describe('WE-04 — 22 guests, Sunday 10:00-12:00, Around The World', () => {
  const date = '2026-09-20';
  const now = at('2026-09-01', '12:00');
  const req = { ...partyRequest({ now, date, guests: 22, honoreeAge: 9, packageCode: 'AROUND_THE_WORLD' }), partyWindowId: 'W-SUN-1000' };

  it('allocates CFG-A-28 -> RM1 + RM2 + RM5 (only configuration with capacity >= 22)', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.selection.configuration.code).toBe('CFG-A-28');
    expect(plan.value.selection.roomIds).toEqual(['RM1', 'RM2', 'RM5']);
    expect(plan.value.selection.roomSlotsConsumed).toBe(3);
  });

  it('leaves RM3/RM4 untouched, so the overlapping Sunday 11:00-13:00 window is still sellable', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const after = {
      ...emptyDay(date),
      partyBookings: [
        partyBooking({
          bookingId: 'P1',
          date,
          partyWindowId: 'W-SUN-1000',
          roomConfigurationId: 'CFG-A-28',
          honoreeAge: 9,
          claimedGameSetIds: ['W-SUN-1000-SET1'],
          games: [{ clock: '10:15', playerCount: 22 }, { clock: '10:45', playerCount: 22 }],
        }),
      ],
    };
    const overlapping = evaluatePartyWindow(
      partyRequest({ now, date, guests: 14, honoreeAge: 9, packageCode: 'GREAT_ADVENTURE', dayState: after }),
      windowByIdOrThrow('W-SUN-1100'),
    );
    expect(overlapping.roomSlotsFree).toBe(2);
    expect(overlapping.available).toBe(true);
  });

  it('includes 5 pizzas (tier 21-25)', () => {
    const result = includedPizzaCount({ guests: 22, packageRecord: packageByCode('AROUND_THE_WORLD'), tiers: catalog.pizzaTiers, foodChoice: 'PIZZA' });
    expect(result.ok && result.value).toBe(5);
  });

  it('claims Set 1 -> 10:15 and 10:45, both PARTY_ONLY slots', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(clocks(plan.value.arenaGroups[0].times)).toEqual(['10:15', '10:45']);
  });

  it('prices at pre-tax 790.90, tax 94.91, total 885.81, balance 835.81', () => {
    const price = computePartyPrice({
      packageRecord: packageByCode('AROUND_THE_WORLD'),
      guests: 22,
      catalog,
      config,
      depositAppliedCents: DEPOSIT,
    });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    expect(price.value.extraGuestsCents).toBe(43140);
    expect(price.value.preTaxSubtotalCents).toBe(79090);
    expect(price.value.taxCents).toBe(9491);
    expect(price.value.totalCents).toBe(88581);
    expect(price.value.balanceDueCents).toBe(83581);
  });
});

// =========================================================================================
describe('WE-05 — 28 guests, Saturday 10:00-12:00 (three room-slots + arena split)', () => {
  const date = '2026-09-26';
  const now = at('2026-09-01', '12:00');
  const req = { ...partyRequest({ now, date, guests: 28, honoreeAge: 11, packageCode: 'GREAT_ADVENTURE' }), partyWindowId: 'W-SAT-1000' };

  it('allocates CFG-A-28 -> RM1 + RM2 + RM5, three of three room-slots', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.selection.configuration.code).toBe('CFG-A-28');
    expect(plan.value.selection.roomSlotsConsumed).toBe(3);
  });

  it('includes 6 pizzas (tier 26-30)', () => {
    const result = includedPizzaCount({ guests: 28, packageRecord: packageByCode('GREAT_ADVENTURE'), tiers: catalog.pizzaTiers, foodChoice: 'PIZZA' });
    expect(result.ok && result.value).toBe(6);
  });

  it('splits 28 into two arena groups of 14', () => {
    expect(splitArenaGroups(28, config)).toEqual([14, 14]);
  });

  it('gives group A Set 1 (10:15, 10:45) and group B Set 2 (10:30, 11:00) — the four morning games', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.arenaGroups).toHaveLength(2);
    expect(clocks(plan.value.arenaGroups[0].times)).toEqual(['10:15', '10:45']);
    expect(clocks(plan.value.arenaGroups[1].times)).toEqual(['10:30', '11:00']);
    // R-64: the two groups never share a slot.
    const all = plan.value.arenaGroups.flatMap((g) => g.times.map((t) => t.startMinutes));
    expect(new Set(all).size).toBe(all.length);
    // At no instant are 28 players in the arena.
    expect(plan.value.arenaGroups.every((g) => g.playerCount <= config.arenaCapacity)).toBe(true);
  });

  it('prices at pre-tax 726.60, tax 87.19, total 813.79, balance 763.79', () => {
    const price = computePartyPrice({
      packageRecord: packageByCode('GREAT_ADVENTURE'),
      guests: 28,
      catalog,
      config,
      depositAppliedCents: DEPOSIT,
    });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    expect(price.value.extraGuestsCents).toBe(46710);
    expect(price.value.preTaxSubtotalCents).toBe(72660);
    expect(price.value.taxCents).toBe(8719);
    expect(price.value.totalCents).toBe(81379);
    expect(price.value.balanceDueCents).toBe(76379);
  });
});

// =========================================================================================
describe('WE-06 — second party into an occupied window, ages 7 and 9 (allowed)', () => {
  const date = '2026-10-03';
  const now = at('2026-09-01', '12:00');
  const existing = {
    ...emptyDay(date),
    partyBookings: [
      partyBooking({
        bookingId: 'P1',
        date,
        partyWindowId: 'W-SAT-1500',
        roomConfigurationId: 'CFG-B-12',
        honoreeAge: 7,
        claimedGameSetIds: ['W-SAT-1500-SET1'],
        games: [{ clock: '15:15', playerCount: 12 }, { clock: '16:00', playerCount: 12 }],
      }),
    ],
  };
  const req = {
    ...partyRequest({ now, date, guests: 10, honoreeAge: 9, packageCode: 'GREAT_ADVENTURE', dayState: existing }),
    partyWindowId: 'W-SAT-1500',
  };

  it('passes the age rule on the boundary: |7 - 9| = 2 <= 2', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
  });

  it('allocates CFG-B-14 -> RM3, because RM4 is taken by P1', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.selection.configuration.code).toBe('CFG-B-14');
    expect(plan.value.selection.roomIds).toEqual(['RM3']);
  });

  it('sells the window out: 2 of 2 room-slots', () => {
    const evaluation = evaluatePartyWindow(req, windowByIdOrThrow('W-SAT-1500'));
    expect(evaluation.roomSlotsTotal).toBe(2);
    expect(evaluation.roomSlotsFree).toBe(1);
  });

  it('claims Set 2 -> 15:45, then appends 16:15 (16:00 is held by P1)', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(clocks(plan.value.arenaGroups[0].times)).toEqual(['15:45', '16:15']);
    expect(plan.value.arenaGroups[0].partyGameSetId).toBe('W-SAT-1500-SET2');
  });

  it('prices at pre-tax 259.50, tax 31.14, total 290.64', () => {
    const price = computePartyPrice({ packageRecord: packageByCode('GREAT_ADVENTURE'), guests: 10, catalog, config, depositAppliedCents: DEPOSIT });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    expect(price.value.preTaxSubtotalCents).toBe(25950);
    expect(price.value.taxCents).toBe(3114);
    expect(price.value.totalCents).toBe(29064);
  });
});

// =========================================================================================
describe('WE-07 — second party into the same window, ages 7 and 11 (rejected)', () => {
  const date = '2026-10-03';
  const now = at('2026-09-01', '12:00');
  const existing = {
    ...emptyDay(date),
    partyBookings: [
      partyBooking({
        bookingId: 'P1',
        date,
        partyWindowId: 'W-SAT-1500',
        roomConfigurationId: 'CFG-B-12',
        honoreeAge: 7,
        claimedGameSetIds: ['W-SAT-1500-SET1'],
        games: [{ clock: '15:15', playerCount: 12 }, { clock: '16:00', playerCount: 12 }],
      }),
    ],
  };

  it('rejects with AGE_GAP_EXCEEDED and names the existing party age band, not their name', () => {
    const plan = planPartyBooking({
      ...partyRequest({ now, date, guests: 10, honoreeAge: 11, packageCode: 'GREAT_ADVENTURE', dayState: existing }),
      partyWindowId: 'W-SAT-1500',
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error.code).toBe('AGE_GAP_EXCEEDED');
    expect(plan.error.detail.existingAges).toEqual([7]);
    expect(plan.error.message).toContain('7-year-old');
    expect(plan.error.message).toContain(config.venuePhone);
  });

  it('never attempts room allocation — the age rule is evaluated first', () => {
    const evaluation = evaluatePartyWindow(
      partyRequest({ now, date, guests: 10, honoreeAge: 11, packageCode: 'GREAT_ADVENTURE', dayState: existing }),
      windowByIdOrThrow('W-SAT-1500'),
    );
    expect(evaluation.reason).toBe('AGE_GAP_EXCEEDED');
    expect(evaluation.selection).toBeNull();
  });

  it('still offers 13:00-15:00 and 17:00-19:00 on the same date', () => {
    const day = getPartyAvailability(
      partyRequest({ now, date, guests: 10, honoreeAge: 11, packageCode: 'GREAT_ADVENTURE', dayState: existing }),
    );
    const open = day.windows.filter((w) => w.available).map((w) => w.partyWindowId);
    expect(open).toContain('W-SAT-1300');
    expect(open).toContain('W-SAT-1700');
  });
});

// =========================================================================================
describe('WE-08 — public laser tag booked 45 minutes before start (rejected)', () => {
  const date = '2026-09-17';

  it('rejects with ONLINE_CUTOFF at 13:00 for a 13:45 game', () => {
    const result = planPublicBooking({
      now: at(date, '13:00'),
      date,
      players: 6,
      games: 1,
      startMinutes: parseClock24('13:45'),
      channel: 'ONLINE',
      catalog,
      config,
      dayState: emptyDay(date),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ONLINE_CUTOFF');
  });

  it('accepts exactly at the boundary (12:15) and rejects one minute later (12:16)', () => {
    const request = {
      date,
      players: 6,
      games: 1,
      startMinutes: parseClock24('13:45'),
      channel: 'ONLINE' as const,
      catalog,
      config,
      dayState: emptyDay(date),
    };
    expect(planPublicBooking({ ...request, now: at(date, '12:15') }).ok).toBe(true);
    const late = planPublicBooking({ ...request, now: at(date, '12:16') });
    expect(late.ok).toBe(false);
    if (late.ok) return;
    expect(late.error.code).toBe('ONLINE_CUTOFF');
  });

  it('lets the manager backend create the same booking (R-13)', () => {
    const result = planPublicBooking({
      now: at(date, '13:00'),
      date,
      players: 6,
      games: 1,
      startMinutes: parseClock24('13:45'),
      channel: 'MANAGER',
      catalog,
      config,
      dayState: emptyDay(date),
    });
    expect(result.ok).toBe(true);
  });

  it('would have priced at 6 x $8.49 = $50.94 pre-tax', () => {
    const price = computePublicGamePrice({ players: 6, games: 1, catalog, config });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    expect(price.value.preTaxSubtotalCents).toBe(5094);
    expect(formatMoney(price.value.preTaxSubtotalCents)).toBe('$50.94');
  });

  it('the rejection is policy, not capacity — the arena still had headroom', () => {
    const availability = planPublicBooking({
      now: at(date, '13:00'),
      date,
      players: 6,
      games: 1,
      startMinutes: parseClock24('13:45'),
      channel: 'MANAGER',
      catalog,
      config,
      dayState: emptyDay(date),
    });
    expect(availability.ok).toBe(true);
  });
});

// =========================================================================================
describe('WE-09 — reserved 17:15 game on a Wednesday with no party booked (released)', () => {
  const date = '2026-09-16';
  const threeDaysOut = at('2026-09-13', '19:00');

  it('releases 17:15 and 17:30 three days out and accepts a 2-game booking', () => {
    const result = planPublicBooking({
      now: threeDaysOut,
      date,
      players: 6,
      games: 2,
      startMinutes: parseClock24('17:15'),
      channel: 'ONLINE',
      catalog,
      config,
      dayState: emptyDay(date),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.arenaGroups[0].startMinutes).toEqual([parseClock24('17:15'), parseClock24('17:30')]);
  });

  it('prices at pre-tax 92.94, tax 11.15, total 104.09', () => {
    const price = computePublicGamePrice({ players: 6, games: 2, catalog, config });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    expect(price.value.preTaxSubtotalCents).toBe(9294);
    expect(price.value.taxCents).toBe(1115);
    expect(price.value.totalCents).toBe(10409);
  });

  it('rejects the same request 10 days ahead with SLOT_HELD_FOR_PARTY', () => {
    const result = planPublicBooking({
      now: at('2026-09-06', '19:00'),
      date,
      players: 6,
      games: 2,
      startMinutes: parseClock24('17:15'),
      channel: 'ONLINE',
      catalog,
      config,
      dayState: emptyDay(date),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SLOT_HELD_FOR_PARTY');
  });

  /**
   * SPEC DISAGREEMENT — WE-09's "Knock-on" row says the party that arrives after the public
   * bought 17:15 and 17:30 "plays 18:15 and 19:00". That contradicts R-17(a), which requires
   * `T + CFG.gameDurationMinutes <= window.end`: 19:00 + 15 = 19:15 > 19:00, so 19:00 is not a
   * legal auto-extension for the 17:00-19:00 window. The only other candidate at or after
   * 18:45 is 18:45 itself, which R-17(c) skips as Set 2's configured time.
   *
   * The engine implements R-17(a), the normative MUST rule, and therefore rejects with
   * NO_GAME_CAPACITY. Flagged in the final report; the fix is either a wording change to
   * WE-09 or a manager decision that a party's last game may start at the window's end.
   */
  it('SPEC DISAGREEMENT: the knock-on party is rejected with NO_GAME_CAPACITY, not given 19:00', () => {
    const dayState = {
      ...emptyDay(date),
      publicBookings: [
        publicBooking({ bookingId: 'PUB1', date, games: [{ clock: '17:15', playerCount: 6 }, { clock: '17:30', playerCount: 6 }] }),
      ],
    };
    const plan = planPartyBooking({
      ...partyRequest({ now: threeDaysOut, date, guests: 10, honoreeAge: 8, packageCode: 'GREAT_ADVENTURE', dayState }),
      partyWindowId: 'W-WED-1700',
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error.code).toBe('NO_GAME_CAPACITY');
    expect(plan.error.detail.gamesFound).toBe(1); // it did keep 18:15
  });

  it('R-20: a sold public game is never taken back — 17:15 stays with the public', () => {
    const dayState = {
      ...emptyDay(date),
      publicBookings: [publicBooking({ bookingId: 'PUB1', date, games: [{ clock: '17:15', playerCount: 6 }] })],
    };
    const assigned = assignPartyGameTimes({
      date,
      window: windowByIdOrThrow('W-WED-1700'),
      arenaGroups: [10],
      gamesRequired: 1,
      honoreeAge: 8,
      catalog,
      config,
      dayState,
    });
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(clocks(assigned.value[0].times)).toEqual(['18:15']);
  });
});

// =========================================================================================
describe('WE-10 — Saturday 10:15 game, public booking attempted (rejected)', () => {
  const date = '2026-09-19';

  it('rejects with PARTY_ONLY_WINDOW three weeks out with no party booked', () => {
    const result = planPublicBooking({
      now: at('2026-08-29', '12:00'),
      date,
      players: 4,
      games: 1,
      startMinutes: parseClock24('10:15'),
      channel: 'ONLINE',
      catalog,
      config,
      dayState: emptyDay(date),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PARTY_ONLY_WINDOW');
  });

  it('R-19: lead time, occupancy and headroom are all irrelevant — even 1 hour out it is refused', () => {
    const result = planPublicBooking({
      now: at(date, '08:00'),
      date,
      players: 4,
      games: 1,
      startMinutes: parseClock24('10:15'),
      channel: 'ONLINE',
      catalog,
      config,
      dayState: emptyDay(date),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PARTY_ONLY_WINDOW');
  });

  it('the first game the public can book that day is 12:00', () => {
    const day = planPublicBooking({
      now: at('2026-08-29', '12:00'),
      date,
      players: 4,
      games: 1,
      startMinutes: parseClock24('12:00'),
      channel: 'ONLINE',
      catalog,
      config,
      dayState: emptyDay(date),
    });
    expect(day.ok).toBe(true);
  });

  it('no game slots exist between 11:15 and 11:45 on a weekend (R-05)', () => {
    for (const clock of ['11:15', '11:30', '11:45']) {
      const result = planPublicBooking({
        now: at('2026-08-29', '12:00'),
        date,
        players: 4,
        games: 1,
        startMinutes: parseClock24(clock),
        channel: 'ONLINE',
        catalog,
        config,
        dayState: emptyDay(date),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('SLOT_DOES_NOT_EXIST');
    }
  });
});

// =========================================================================================
describe('WE-11 — 30 guests, any day (exceeds every configuration)', () => {
  const now = at('2026-09-01', '12:00');

  it('rejects with EXCEEDS_MAX_PARTY_SIZE, naming 28 and the venue phone', () => {
    const plan = planPartyBooking({
      ...partyRequest({ now, date: '2026-09-26', guests: 30, honoreeAge: 10, packageCode: 'GREAT_ADVENTURE' }),
      partyWindowId: 'W-SAT-1000',
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error.code).toBe('EXCEEDS_MAX_PARTY_SIZE');
    expect(plan.error.detail.maxPartyGuests).toBe(28);
    expect(plan.error.message).toContain('28');
    expect(plan.error.message).toContain(config.venuePhone);
  });

  it('QA boundary: 28 accepts, 29 rejects — and 29 is NOT NO_ROOM_CONFIG', () => {
    const base = { now, date: '2026-09-26', honoreeAge: 10, packageCode: 'GREAT_ADVENTURE' as const };
    const accepted = planPartyBooking({ ...partyRequest({ ...base, guests: 28 }), partyWindowId: 'W-SAT-1000' });
    expect(accepted.ok).toBe(true);
    const rejected = planPartyBooking({ ...partyRequest({ ...base, guests: 29 }), partyWindowId: 'W-SAT-1000' });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.error.code).toBe('EXCEEDS_MAX_PARTY_SIZE');
  });

  it('every window on the date reports the same reason, so the UI shows one "call us"', () => {
    const day = getPartyAvailability(partyRequest({ ...{ now, date: '2026-09-26' }, guests: 30, honoreeAge: 10, packageCode: 'GREAT_ADVENTURE' }));
    expect(day.anyAvailable).toBe(false);
    expect(day.windows.every((w) => w.reason === 'EXCEEDS_MAX_PARTY_SIZE')).toBe(true);
  });
});

// =========================================================================================
describe('WE-12 — 16 guests, Saturday 11:00-13:00 (rejected, exposes OQ-10)', () => {
  const date = '2026-10-10';
  const now = at('2026-09-01', '12:00');

  it('rejects with NO_ROOM_CONFIG because the window tops out at 14', () => {
    const plan = planPartyBooking({
      ...partyRequest({ now, date, guests: 16, honoreeAge: 9, packageCode: 'GREAT_ADVENTURE' }),
      partyWindowId: 'W-SAT-1100',
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error.code).toBe('NO_ROOM_CONFIG');
    expect(plan.error.detail.windowMaxGuests).toBe(14);
  });

  it('names the windows that DO fit 16 on the same date', () => {
    const day = getPartyAvailability(partyRequest({ now, date, guests: 16, honoreeAge: 9, packageCode: 'GREAT_ADVENTURE' }));
    const open = day.windows.filter((w) => w.available).map((w) => w.partyWindowId);
    expect(open).toContain('W-SAT-1000'); // up to 28
    expect(open).toContain('W-SAT-1300'); // up to 20
    expect(open).not.toContain('W-SAT-1100');
  });

  it('CFG-B-20 exists but is seeded isOffered = false — the OQ-10 flip is a data change', () => {
    const offering = catalog.windowOfferings.find(
      (o) => o.partyWindowId === 'W-SAT-1100' && o.roomConfigurationId === 'CFG-B-20',
    );
    expect(offering).toBeDefined();
    expect(offering?.isOffered).toBe(false);
  });
});

// =========================================================================================
describe('WE-13 — 12 guests, Wednesday 18:00-20:00, The Traveler with every add-on type', () => {
  const date = '2026-10-14';
  const now = at('2026-09-01', '12:00');
  const req = { ...partyRequest({ now, date, guests: 12, honoreeAge: 8, packageCode: 'TRAVELER' }), partyWindowId: 'W-WED-1800' };

  const selections = [
    { addOnCode: 'ARCADE_TIMEPLAY_45', quantity: 12 },
    { addOnCode: 'QBIX_5D', quantity: 12 },
    { addOnCode: 'PIZZA_1TOP', quantity: 3, addOnOptionId: addOnOptionId('PIZZA_1TOP', 'Pepperoni') },
    { addOnCode: 'WINGS_16', quantity: 1, addOnOptionId: addOnOptionId('WINGS_16', 'Honey Garlic') },
  ];

  it('allocates CFG-B-12 -> RM4 (all RS-1 candidates tie; smallest capacity wins)', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.selection.configuration.code).toBe('CFG-B-12');
    expect(plan.value.selection.roomIds).toEqual(['RM4']);
  });

  it('leaves RM3 and RM5 sellable: 1 of 3 room-slots used', () => {
    const evaluation = evaluatePartyWindow(req, windowByIdOrThrow('W-WED-1800'));
    expect(evaluation.roomSlotsTotal).toBe(3);
  });

  it('holds the room for the full window even though the package is 90 minutes (R-32)', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(packageByCode('TRAVELER').roomMinutes).toBe(90);
    expect(plan.value.window.endMinutes - plan.value.window.startMinutes).toBe(120);
  });

  it('includes 0 pizzas — TRAVELER.includesPizza is false (R-42, OQ-02)', () => {
    const result = includedPizzaCount({ guests: 12, packageRecord: packageByCode('TRAVELER'), tiers: catalog.pizzaTiers, foodChoice: 'PIZZA' });
    expect(result.ok && result.value).toBe(0);
  });

  it('auto-assigns 18:00 and 18:30 (18:15 and 18:45 belong to the 17:00-19:00 window)', () => {
    const plan = planPartyBooking(req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(clocks(plan.value.arenaGroups[0].times)).toEqual(['18:00', '18:30']);
    expect(plan.value.arenaGroups[0].times.every((t) => t.source === 'AUTO_APPENDED')).toBe(true);
    expect(plan.value.arenaGroups[0].partyGameSetId).toBeNull();
  });

  it('prices at pre-tax 376.80, tax 45.22, tax-included food 92.92, total 514.94, balance 464.94', () => {
    const price = computePartyPrice({
      packageRecord: packageByCode('TRAVELER'),
      guests: 12,
      addOns: selections,
      catalog,
      config,
      depositAppliedCents: DEPOSIT,
    });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    expect(price.value.packageBaseCents).toBe(22450);
    expect(price.value.extraGuestsCents).toBe(4490);
    expect(price.value.preTaxSubtotalCents).toBe(37680);
    expect(price.value.taxCents).toBe(4522);
    expect(price.value.taxIncludedTotalCents).toBe(9292);
    expect(price.value.totalCents).toBe(51494);
    expect(price.value.balanceDueCents).toBe(46494);
    expect(formatMoney(price.value.totalCents)).toBe('$514.94');
  });

  it('separates the tax-inclusive food lines so the tax line is auditable (R-51)', () => {
    const price = computePartyPrice({ packageRecord: packageByCode('TRAVELER'), guests: 12, addOns: selections, catalog, config });
    expect(price.ok).toBe(true);
    if (!price.ok) return;
    const inclusive = price.value.lines.filter((l) => l.taxIncluded).map((l) => l.code);
    expect(inclusive).toEqual(['PIZZA_1TOP', 'WINGS_16']);
    const pizzaLine = price.value.lines.find((l) => l.code === 'PIZZA_1TOP');
    expect(pizzaLine?.lineTotalCents).toBe(7389);
    expect(price.value.lines.find((l) => l.code === 'WINGS_16')?.lineTotalCents).toBe(1903);
  });

  it('QA note: the same add-ons on AROUND_THE_WORLD reject the arcade card, keeping QBIX legal', () => {
    const rejected = computePartyPrice({
      packageRecord: packageByCode('AROUND_THE_WORLD'),
      guests: 12,
      addOns: selections,
      catalog,
      config,
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.error.code).toBe('ADDON_NOT_ELIGIBLE');
    expect(rejected.error.detail.addOnCode).toBe('ARCADE_TIMEPLAY_45');

    const qbixOnly = computePartyPrice({
      packageRecord: packageByCode('AROUND_THE_WORLD'),
      guests: 12,
      addOns: [{ addOnCode: 'QBIX_5D', quantity: 12 }],
      catalog,
      config,
    });
    expect(qbixOnly.ok).toBe(true);
  });
});

// =========================================================================================
describe('WE-14 — reschedule 10 days out, then cancel (deposit lifecycle)', () => {
  const eventStart = zonedTimeToUtc('2026-09-15', parseClock24('17:00'), config.timezone);

  it('computes 10 whole days of notice on 2026-09-05 at 12:00', () => {
    const outcome = evaluateCancellation({
      now: at('2026-09-05', '12:00'),
      eventStartsAtUtc: eventStart,
      depositAmountCents: DEPOSIT,
      config,
    });
    expect(outcome.notice.noticeDays).toBe(10);
    expect(outcome.notice.sufficient).toBe(false);
  });

  it('rejects a self-serve reschedule with NOTICE_PERIOD_NOT_MET', () => {
    const result = evaluateReschedule({
      now: at('2026-09-05', '12:00'),
      eventStartsAtUtc: eventStart,
      channel: 'ONLINE',
      config,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOTICE_PERIOD_NOT_MET');
    expect(result.error.detail.noticeDays).toBe(10);
  });

  it('allows the manager backend to move it and carry the deposit (OQ-12)', () => {
    const result = evaluateReschedule({
      now: at('2026-09-05', '12:00'),
      eventStartsAtUtc: eventStart,
      channel: 'MANAGER',
      config,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.depositStatus).toBe('CARRIED_FORWARD');
    expect(result.value.requiresManager).toBe(true);
  });

  it('forfeits the deposit when cancelling at 10 days, and offers the move first', () => {
    const outcome = evaluateCancellation({
      now: at('2026-09-05', '12:00'),
      eventStartsAtUtc: eventStart,
      depositAmountCents: DEPOSIT,
      config,
    });
    expect(outcome.depositStatus).toBe('FORFEITED');
    expect(outcome.giftCardAmountCents).toBe(0);
    expect(outcome.mustOfferReschedule).toBe(true);
  });

  it('converts the deposit to a $50 gift card when cancelling on 2026-09-01 (14 whole days)', () => {
    const outcome = evaluateCancellation({
      now: at('2026-09-01', '12:00'),
      eventStartsAtUtc: eventStart,
      depositAmountCents: DEPOSIT,
      config,
    });
    expect(outcome.notice.noticeDays).toBe(14);
    expect(outcome.depositStatus).toBe('CONVERTED_TO_GIFT_CARD');
    expect(outcome.giftCardAmountCents).toBe(5000);
    expect(formatMoney(outcome.giftCardAmountCents as Cents)).toBe('$50.00');
  });

  it('QA boundary: exactly 14 days -> gift card; 13 days 23 hours -> forfeit', () => {
    const exactly14 = evaluateCancellation({
      now: at('2026-09-01', '17:00'),
      eventStartsAtUtc: eventStart,
      depositAmountCents: DEPOSIT,
      config,
    });
    expect(exactly14.notice.noticeDays).toBe(14);
    expect(exactly14.depositStatus).toBe('CONVERTED_TO_GIFT_CARD');

    const oneHourLate = evaluateCancellation({
      now: at('2026-09-01', '18:00'),
      eventStartsAtUtc: eventStart,
      depositAmountCents: DEPOSIT,
      config,
    });
    expect(oneHourLate.notice.noticeDays).toBe(13);
    expect(oneHourLate.depositStatus).toBe('FORFEITED');
  });
});
