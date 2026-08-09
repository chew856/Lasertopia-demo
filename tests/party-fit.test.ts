/**
 * Screen P1's non-trivial pure logic: what the rooms engine implies about a guest count, and
 * what the server accepts as an answer to the two questions P1 asks.
 *
 * The point of `guestRoomFit` is that the thresholds are *derived*. RULES.md §3.3's seeded
 * inventory makes 15–18 fit the single 18-capacity Grand room in one room-slot, so a hardcoded
 * "over 14 needs two rooms" would be false for exactly the counts a parent is most anxious
 * about. These tests pin that behaviour to the catalog rather than to a number.
 */

import { describe, expect, it } from 'vitest';

import {
  guestCeiling,
  guestRoomFit,
  honoreeAgeRange,
  isOverCeiling,
  offeredConfigurationSummaries,
  parsePartyIntent,
  roomHintFor,
  venueCapacity,
} from '@/app/parties/_lib/fit';

import { catalog, config } from './helpers';

describe('offered configurations', () => {
  it('ignores configurations no window actually sells', () => {
    // CFG-B-20 is seeded present but isOffered = false everywhere (OQ-10). Until a manager
    // flips that boolean it is not inventory and must not influence what P1 promises.
    const capacities = offeredConfigurationSummaries(catalog).map((c) => c.capacity);
    const offeredIds = new Set(
      catalog.windowOfferings.filter((o) => o.isOffered).map((o) => o.roomConfigurationId),
    );
    expect(offeredIds.has('CFG-B-20')).toBe(false);
    expect(capacities).not.toHaveLength(catalog.roomConfigurations.length);
  });

  it('reports the venue ceiling from the rooms, not from a literal', () => {
    expect(venueCapacity(catalog)).toBe(28);
    expect(guestCeiling(catalog, config)).toBe(28);
  });
});

describe('guestRoomFit', () => {
  it('seats a party of 10 in one room', () => {
    const fit = guestRoomFit(catalog, 10);
    expect(fit).toMatchObject({ fits: true, roomSlots: 1, capacity: 12 });
  });

  it('still seats 15 to 18 in ONE room — the Grand room, not a pair', () => {
    for (const guests of [15, 16, 17, 18]) {
      const fit = guestRoomFit(catalog, guests);
      expect(fit.roomSlots, `${guests} guests`).toBe(1);
      expect(fit.capacity, `${guests} guests`).toBe(18);
      expect(fit.needsLargestRoom, `${guests} guests`).toBe(true);
    }
  });

  it('needs two room-slots only above the largest single room', () => {
    expect(guestRoomFit(catalog, 19).roomSlots).toBe(2);
    expect(guestRoomFit(catalog, 20).roomSlots).toBe(2);
  });

  it('needs three room-slots above 20', () => {
    expect(guestRoomFit(catalog, 21).roomSlots).toBe(3);
    expect(guestRoomFit(catalog, 28).roomSlots).toBe(3);
  });

  it('reports no fit above the ceiling rather than throwing', () => {
    expect(guestRoomFit(catalog, 29)).toMatchObject({ fits: false, roomSlots: 0 });
  });

  it('does not claim the largest room for counts a smaller room takes', () => {
    expect(guestRoomFit(catalog, 12).needsLargestRoom).toBe(false);
    expect(guestRoomFit(catalog, 14).needsLargestRoom).toBe(false);
  });
});

describe('roomHintFor', () => {
  it('says nothing for counts an ordinary room takes', () => {
    expect(roomHintFor(catalog, 10)).toBeNull();
    expect(roomHintFor(catalog, 14)).toBeNull();
  });

  it('celebrates the largest-room fit rather than warning about two rooms', () => {
    expect(roomHintFor(catalog, 16)).toBe('fits');
  });

  it('warns about two rooms and three rooms at the engine thresholds', () => {
    expect(roomHintFor(catalog, 19)).toBe('twoRooms');
    expect(roomHintFor(catalog, 24)).toBe('threeRooms');
  });

  it('has no hint at all for a count nothing fits', () => {
    expect(roomHintFor(catalog, 40)).toBeNull();
  });
});

describe('parsePartyIntent', () => {
  it('accepts a valid pair', () => {
    const result = parsePartyIntent({ guests: '16', age: '9' }, catalog, config);
    expect(result).toEqual({ ok: true, value: { guests: 16, honoreeAge: 9 } });
  });

  it('rejects a blank age with its own code, not a generic failure', () => {
    const result = parsePartyIntent({ guests: '10', age: '' }, catalog, config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toEqual([{ field: 'age', code: 'ageRequired' }]);
  });

  it('rejects an age outside the bookable band', () => {
    const result = parsePartyIntent({ guests: '10', age: '2' }, catalog, config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toEqual({ field: 'age', code: 'ageRange' });
  });

  it('flags over-ceiling counts as guestsMax so the caller can route to the enquiry path', () => {
    const result = parsePartyIntent({ guests: '40', age: '9' }, catalog, config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === 'guestsMax')).toBe(true);
    // The partial is preserved so the enquiry screen can quote the number that was asked for.
    expect(result.partial.guests).toBe(40);
  });

  it('rejects non-numeric input without coercing it', () => {
    const result = parsePartyIntent({ guests: '12abc', age: '9' }, catalog, config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].code).toBe('guestsMin');
  });

  it('collects both problems at once rather than one at a time', () => {
    const result = parsePartyIntent({ guests: '0', age: '99' }, catalog, config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toHaveLength(2);
  });
});

describe('ceiling helpers', () => {
  it('isOverCeiling agrees with guestCeiling', () => {
    expect(isOverCeiling(28, catalog, config)).toBe(false);
    expect(isOverCeiling(29, catalog, config)).toBe(true);
  });

  it('offers exactly the configured honoree ages', () => {
    const ages = honoreeAgeRange(config);
    expect(ages[0]).toBe(config.minHonoreeAge);
    expect(ages[ages.length - 1]).toBe(config.maxHonoreeAge);
    expect(ages).toHaveLength(config.maxHonoreeAge - config.minHonoreeAge + 1);
  });
});
