/**
 * Screen P2's pure logic: calendar arithmetic, the month rollup mark, and the alternatives a
 * rejection is allowed to offer.
 *
 * The rollup is the one thing on P2 that could quietly lie. `dateMarkFor` must distinguish
 * "closed" from "nothing here fits *this* party" — COPY.md words `p2.date.status.full` as "No
 * windows for this party" precisely because the venue may be wide open for a different guest
 * count — and it must call a single remaining window `limited`, since that is the difference
 * between "book whenever" and "book now".
 */

import { describe, expect, it } from 'vitest';

import {
  dateMarkFor,
  dateRange,
  fittingWindowCount,
  largestCountThatFits,
  monthDates,
  nearestFittingWindows,
  nextOpenDate,
  shiftMonth,
  startOfMonth,
} from '@/app/parties/_lib/calendar';
import type { PartyDayAvailability, PartyWindowAvailability } from '@/lib/domain';

function window(
  overrides: Partial<PartyWindowAvailability> & { partyWindowId: string },
): PartyWindowAvailability {
  return {
    label: '1:00 PM – 3:00 PM',
    startMinutes: 780,
    endMinutes: 900,
    startsAtUtc: new Date('2026-08-22T18:00:00Z'),
    endsAtUtc: new Date('2026-08-22T20:00:00Z'),
    available: false,
    reason: null,
    message: null,
    detail: {},
    maxGuestsInWindow: 20,
    remainingCapacity: 0,
    roomSlotsTotal: 2,
    roomSlotsFree: 0,
    selection: null,
    arenaGroups: null,
    ...overrides,
  };
}

function availableWindow(id: string, startMinutes: number, capacity: number) {
  return window({
    partyWindowId: id,
    startMinutes,
    endMinutes: startMinutes + 120,
    available: true,
    remainingCapacity: capacity,
    roomSlotsFree: 1,
    selection: {
      configuration: {
        id: 'CFG',
        code: 'CFG',
        name: 'Room',
        capacity,
        roomSlotsConsumed: 1,
        priority: 0,
        isActive: true,
        roomIds: ['RM1'],
      },
      roomIds: ['RM1'],
      capacity,
      roomSlotsConsumed: 1,
    },
  });
}

function day(
  date: string,
  windows: PartyWindowAvailability[],
  closed = false,
): PartyDayAvailability {
  return {
    date,
    closed,
    closedReason: closed ? 'VENUE_CLOSED' : null,
    windows,
    anyAvailable: windows.some((w) => w.available),
  };
}

describe('month arithmetic', () => {
  it('lists every day of the month, in order, with no leading blanks', () => {
    const days = monthDates('2026-02-14');
    expect(days).toHaveLength(28);
    expect(days[0]).toBe('2026-02-01');
    expect(days[27]).toBe('2026-02-28');
  });

  it('gets February right in a leap year', () => {
    expect(monthDates('2028-02-01')).toHaveLength(29);
  });

  it('shifts across a year boundary in both directions', () => {
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-01');
  });

  it('normalises to the first of the month', () => {
    expect(startOfMonth('2026-08-22')).toBe('2026-08-01');
  });

  it('caps a range so a hand-edited query string cannot ask for a decade', () => {
    expect(dateRange('2026-01-01', '2036-01-01', 10)).toHaveLength(11);
  });
});

describe('dateMarkFor', () => {
  it('marks a closed day closed, not full', () => {
    expect(dateMarkFor(day('2026-08-22', [], true))).toBe('closed');
  });

  it('marks a day with windows but none that fit as "none", not closed', () => {
    const marked = dateMarkFor(
      day('2026-08-22', [
        window({ partyWindowId: 'W1', reason: 'NO_ROOM_CONFIG' }),
        window({ partyWindowId: 'W2', reason: 'AGE_GAP_EXCEEDED' }),
      ]),
    );
    expect(marked).toBe('none');
  });

  it('marks exactly one remaining window as limited', () => {
    const marked = dateMarkFor(
      day('2026-08-22', [
        availableWindow('W1', 780, 14),
        window({ partyWindowId: 'W2', reason: 'WINDOW_FULL' }),
      ]),
    );
    expect(marked).toBe('limited');
  });

  it('marks two or more as open', () => {
    const marked = dateMarkFor(
      day('2026-08-22', [availableWindow('W1', 600, 14), availableWindow('W2', 780, 18)]),
    );
    expect(marked).toBe('open');
  });

  it('treats a day with no windows at all as closed', () => {
    expect(dateMarkFor(day('2026-08-24', []))).toBe('closed');
  });
});

describe('nearestFittingWindows', () => {
  const days = [
    day('2026-08-22', [window({ partyWindowId: 'W-SAT-1300', reason: 'WINDOW_FULL' })]),
    day('2026-08-23', [availableWindow('W-SUN-1300', 780, 20), availableWindow('W-SUN-1000', 600, 18)]),
    day('2026-08-24', [availableWindow('W-MON-1700', 1020, 14)]),
  ];

  it('returns windows in date-then-time order, not catalog order', () => {
    const found = nearestFittingWindows(days, 3);
    expect(found.map((w) => w.partyWindowId)).toEqual([
      'W-SUN-1000',
      'W-SUN-1300',
      'W-MON-1700',
    ]);
  });

  it('stops at the limit', () => {
    expect(nearestFittingWindows(days, 1)).toHaveLength(1);
  });

  it('never offers the window the customer was just rejected from', () => {
    const found = nearestFittingWindows(days, 2, {
      date: '2026-08-23',
      partyWindowId: 'W-SUN-1000',
    });
    expect(found.map((w) => w.partyWindowId)).toEqual(['W-SUN-1300', 'W-MON-1700']);
  });

  it('skips closed days entirely', () => {
    const withClosure = [day('2026-08-21', [availableWindow('W-X', 600, 14)], true), ...days];
    expect(nearestFittingWindows(withClosure, 1)[0].partyWindowId).toBe('W-SUN-1000');
  });

  it('returns nothing rather than throwing when the venue is full', () => {
    expect(nearestFittingWindows([days[0]], 2)).toEqual([]);
  });
});

describe('rollup helpers', () => {
  const days = [
    day('2026-08-22', [window({ partyWindowId: 'W1', reason: 'NO_ROOM_CONFIG', remainingCapacity: 14 })]),
    day('2026-08-23', [availableWindow('W2', 780, 20)]),
  ];

  it('counts fitting windows for the month-empty copy', () => {
    expect(fittingWindowCount(days)).toBe(1);
  });

  it('finds the next open date strictly after the one being looked at', () => {
    expect(nextOpenDate(days, '2026-08-22')).toBe('2026-08-23');
    expect(nextOpenDate(days, '2026-08-23')).toBeNull();
  });

  it('reports the largest count a full day could still take, for the "would 14 work?" offer', () => {
    expect(largestCountThatFits(days[0])).toBe(14);
  });
});
