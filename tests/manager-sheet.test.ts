import { describe, expect, it } from 'vitest';

import {
  buildArenaGroups,
  buildAddOnLines,
  buildFoodLines,
  buildSheet,
  type SheetInput,
} from '@/app/manage/_lib/sheet';
import {
  assessGuestChange,
  isReasonAcceptable,
  overrideSummary,
} from '@/app/manage/_lib/override';
import { parseSettingsSubmission, parseTierSubmission } from '@/app/manage/_lib/settings-form';
import { SETTING_SPECS, type SettingRow } from '@/lib/domain';

// ─────────────────────────────────────────────────────────────────────────────────────────
// The party sheet
// ─────────────────────────────────────────────────────────────────────────────────────────

function input(overrides: Partial<SheetInput> = {}): SheetInput {
  return {
    guestCount: 14,
    foodChoice: 'PIZZA',
    includedPizzaCount: 3,
    package: {
      includesPizza: true,
      includesCupcakes: true,
      includesHotDogOption: false,
      includesLazerFrenzy: false,
      includesTyphoon: false,
      funCardCentsPerGuest: 0,
    },
    hotDogsPerGuest: 1,
    cupcakesPerGuest: 1,
    games: [
      { startMinutes: 795, arenaGroupIndex: 0 },
      { startMinutes: 825, arenaGroupIndex: 0 },
    ],
    addOns: [],
    notes: null,
    totalCents: 40_000,
    deposit: { amountCents: 5_000, status: 'RECORDED' },
    ...overrides,
  };
}

describe('the party sheet', () => {
  it('groups game times by arena group so a split party is never sent in at once', () => {
    const groups = buildArenaGroups([
      { startMinutes: 825, arenaGroupIndex: 1 },
      { startMinutes: 795, arenaGroupIndex: 0 },
      { startMinutes: 810, arenaGroupIndex: 1 },
      { startMinutes: 780, arenaGroupIndex: 0 },
    ]);
    expect(groups).toEqual([
      { index: 0, startMinutes: [780, 795] },
      { index: 1, startMinutes: [810, 825] },
    ]);
    expect(buildSheet(input({ games: groups.flatMap((g) => g.startMinutes.map((m) => ({ startMinutes: m, arenaGroupIndex: g.index }))) })).isSplit).toBe(true);
    expect(buildSheet(input()).isSplit).toBe(false);
  });

  it('prints "None recorded" rather than an empty allergy box', () => {
    expect(buildSheet(input({ notes: null })).allergies).toBeNull();
    expect(buildSheet(input({ notes: '   ' })).allergies).toBeNull();
    expect(buildSheet(input({ notes: ' peanut allergy ' })).allergies).toBe('peanut allergy');
  });

  it('adds the package pizzas to any bought as an add-on, with their toppings in order', () => {
    const food = buildFoodLines(
      input({
        addOns: [
          { code: 'PIZZA_1TOP', quantity: 2, optionLabel: 'Pepperoni' },
          { code: 'PIZZA_CHEESE', quantity: 1, optionLabel: null },
        ],
      }),
    );
    const pizza = food.find((line) => line.kind === 'pizza');
    expect(pizza?.count).toBe(6);
    expect(pizza?.options).toEqual(['Pepperoni']);
  });

  it('never prints included pizzas when the party chose hot dogs', () => {
    const food = buildFoodLines(
      input({
        foodChoice: 'HOT_DOGS',
        package: { ...input().package, includesHotDogOption: true },
      }),
    );
    expect(food.find((line) => line.kind === 'pizza')).toBeUndefined();
    expect(food.find((line) => line.kind === 'hotdogs')?.count).toBe(14);
  });

  it('states "no food on this package" instead of leaving the box blank', () => {
    const food = buildFoodLines(
      input({
        foodChoice: 'NONE',
        package: { ...input().package, includesPizza: false, includesCupcakes: false },
      }),
    );
    expect(food).toEqual([{ kind: 'none', count: 0, options: [] }]);
  });

  it('lists the add-ons the floor has to hand over, including included ones', () => {
    const lines = buildAddOnLines(
      input({
        addOns: [
          { code: 'QBIX_5D', quantity: 14, optionLabel: null },
          { code: 'ARCADE_TIMEPLAY_45', quantity: 14, optionLabel: null },
        ],
        package: {
          ...input().package,
          funCardCentsPerGuest: 1_000,
          includesLazerFrenzy: true,
          includesTyphoon: true,
        },
      }),
    );
    expect(lines.map((line) => line.kind)).toEqual([
      'qbix',
      'arcadeTimeplay',
      'funcard',
      'frenzy',
      'typhoon',
    ]);
    expect(lines.find((line) => line.kind === 'funcard')?.count).toBe(14);
  });

  it('takes only money actually held off the balance', () => {
    expect(buildSheet(input()).balanceDueCents).toBe(35_000);
    // A forfeited or gift-carded deposit is no longer against this booking; the floor still
    // collects the full amount.
    expect(buildSheet(input({ deposit: { amountCents: 5_000, status: 'FORFEITED' } })).balanceDueCents).toBe(
      40_000,
    );
    expect(
      buildSheet(input({ deposit: { amountCents: 5_000, status: 'CONVERTED_TO_GIFT_CARD' } }))
        .depositState,
    ).toBe('giftcard');
    expect(buildSheet(input({ deposit: null })).depositState).toBe('pending');
  });

  it('never prints a negative balance', () => {
    expect(buildSheet(input({ totalCents: 1_000 })).balanceDueCents).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Capacity override
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('capacity override', () => {
  it('says nothing when the change fits', () => {
    const result = assessGuestChange({
      guests: 14,
      roomCapacity: 14,
      arenaCapacity: 25,
      slots: [{ startMinutes: 795, otherPlayers: 5, otherNames: ['Marcus'], groupPlayers: 14 }],
    });
    expect(result.fits).toBe(true);
    expect(result.requiresSecondConfirmation).toBe(false);
  });

  it('restates a room breach with the numbers the copy needs', () => {
    const result = assessGuestChange({
      guests: 16,
      roomCapacity: 14,
      arenaCapacity: 25,
      slots: [],
    });
    expect(result.breaches).toEqual([{ kind: 'room', roomMax: 14, guests: 16, over: 2 }]);
    // A room over-fill is one confirmation and a reason; it is not the arena cap.
    expect(result.requiresSecondConfirmation).toBe(false);
  });

  it('names who else is in the game when the arena cap would break', () => {
    const result = assessGuestChange({
      guests: 22,
      roomCapacity: 28,
      arenaCapacity: 25,
      slots: [{ startMinutes: 795, otherPlayers: 6, otherNames: ['Marcus'], groupPlayers: 22 }],
    });
    expect(result.fits).toBe(false);
    expect(result.requiresSecondConfirmation).toBe(true);
    const breach = result.breaches[0];
    expect(breach).toMatchObject({
      kind: 'arena',
      playerCount: 28,
      arenaCapacity: 25,
      over: 3,
      alsoBooked: ['Marcus'],
    });
  });

  it('reports every breach, not just the first', () => {
    const result = assessGuestChange({
      guests: 30,
      roomCapacity: 20,
      arenaCapacity: 25,
      slots: [
        { startMinutes: 795, otherPlayers: 0, otherNames: [], groupPlayers: 30 },
        { startMinutes: 810, otherPlayers: 0, otherNames: [], groupPlayers: 30 },
      ],
    });
    expect(result.breaches.map((breach) => breach.kind)).toEqual(['room', 'arena', 'arena']);
  });

  it('will not accept an empty or token reason', () => {
    expect(isReasonAcceptable('')).toBe(false);
    expect(isReasonAcceptable('  ')).toBe(false);
    expect(isReasonAcceptable('ok')).toBe(false);
    expect(isReasonAcceptable('Manager approved')).toBe(true);
  });

  it('summarises what was broken alongside why, for the audit line', () => {
    const summary = overrideSummary(
      [
        { kind: 'room', roomMax: 14, guests: 16, over: 2 },
        {
          kind: 'arena',
          startMinutes: 795,
          playerCount: 28,
          arenaCapacity: 25,
          players: 22,
          over: 3,
          alsoBooked: [],
        },
      ],
      '  Manager approved  ',
    );
    expect(summary).toBe('room, arena: Manager approved');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Settings save path
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * A complete, valid registry. It is derived from `SETTING_SPECS` rather than hand-listed so a
 * new configuration key cannot make these tests pass while the real save path fails on it —
 * which is the same reason the settings screen is generated from the spec.
 */
const OVERRIDES: Record<string, string> = {
  'CFG.timezone': 'America/Winnipeg',
  'CFG.venuePhone': '204-474-5900',
  'CFG.arenaCapacity': '25',
  'CFG.onlineCutoffMinutes': '90',
  'CFG.maxPartiesPerWindow': 'null',
  'CFG.arcadeMatchIncrement': '5.00',
  'CFG.depositAmount': '50.00',
  'CFG.taxRatePercent': '12',
};

const DEFAULT_BY_TYPE: Record<string, string> = {
  INT: '10',
  NULLABLE_INT: 'null',
  BOOL: 'false',
  STRING: 'x',
  MONEY: '1.00',
  RATE: '12',
};

const STORED: SettingRow[] = SETTING_SPECS.map((spec) => ({
  key: spec.key,
  value: OVERRIDES[spec.key] ?? DEFAULT_BY_TYPE[spec.type],
  valueType: spec.type,
}));

describe('settings save', () => {
  it('keeps a stored value for any key the submitted form did not carry', () => {
    const { rows, errors } = parseSettingsSubmission({ 'CFG.arenaCapacity': '30' }, STORED);
    expect(errors).toEqual([]);
    expect(rows.find((row) => row.key === 'CFG.arenaCapacity')?.value).toBe('30');
    expect(rows.find((row) => row.key === 'CFG.onlineCutoffMinutes')?.value).toBe('90');
  });

  it('points a type error at the field that caused it', () => {
    const { errors } = parseSettingsSubmission({ 'CFG.arenaCapacity': 'twenty-five' }, STORED);
    expect(errors).toHaveLength(1);
    expect(errors[0].key).toBe('CFG.arenaCapacity');
    expect(errors[0].message).toContain('twenty-five');
  });

  it('rejects money and rate fields that are not amounts', () => {
    expect(parseSettingsSubmission({ 'CFG.depositAmount': 'fifty' }, STORED).errors[0].key).toBe(
      'CFG.depositAmount',
    );
    expect(parseSettingsSubmission({ 'CFG.taxRatePercent': 'lots' }, STORED).errors[0].key).toBe(
      'CFG.taxRatePercent',
    );
  });

  it('catches a cross-field problem the engine would refuse to load', () => {
    // maxPartyGuests below minPartyGuests parses per field and still cannot be booked against.
    const { errors } = parseSettingsSubmission(
      { 'CFG.maxPartyGuests': '2', 'CFG.minPartyGuests': '10' },
      STORED,
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('normalises a checkbox to a real boolean string', () => {
    const { rows } = parseSettingsSubmission({ 'CFG.cutoffAppliesToManager': 'true' }, STORED);
    expect(rows.find((row) => row.key === 'CFG.cutoffAppliesToManager')?.value).toBe('true');
    const off = parseSettingsSubmission({ 'CFG.cutoffAppliesToManager': 'false' }, STORED);
    expect(off.rows.find((row) => row.key === 'CFG.cutoffAppliesToManager')?.value).toBe('false');
  });
});

describe('pizza tiers (R-41)', () => {
  it('accepts a contiguous, non-overlapping table', () => {
    const { tiers, errors } = parseTierSubmission([
      { minGuests: '1', maxGuests: '10', pizzaCount: '2' },
      { minGuests: '11', maxGuests: '20', pizzaCount: '3' },
    ]);
    expect(errors).toEqual([]);
    expect(tiers).toHaveLength(2);
  });

  it("flags the brief's own gap and overlap rather than resolving them silently", () => {
    const gap = parseTierSubmission([
      { minGuests: '1', maxGuests: '10', pizzaCount: '2' },
      { minGuests: '12', maxGuests: '20', pizzaCount: '3' },
    ]);
    expect(gap.errors.join(' ')).toContain('11');

    const overlap = parseTierSubmission([
      { minGuests: '1', maxGuests: '20', pizzaCount: '2' },
      { minGuests: '20', maxGuests: '25', pizzaCount: '3' },
    ]);
    expect(overlap.errors.join(' ')).toContain('20');
  });

  it('names the row when a value is not a number or a range is inverted', () => {
    expect(parseTierSubmission([{ minGuests: 'x', maxGuests: '10', pizzaCount: '2' }]).errors[0]).toContain(
      'Row 1',
    );
    expect(parseTierSubmission([{ minGuests: '10', maxGuests: '1', pizzaCount: '2' }]).errors[0]).toContain(
      'Row 1',
    );
  });
});
