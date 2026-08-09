import { describe, expect, it } from 'vitest';

import {
  compareBookings,
  digitsOf,
  isPendingDeposit,
  matchesQuery,
  normaliseCode,
  normaliseText,
  parseQuery,
  parseStatusFilter,
  parseTypeFilter,
  statusesFor,
  type SearchableBooking,
  type SortableBooking,
} from '@/app/manage/_lib/search';

/**
 * STRATEGY §4.5 states the acceptance test in words: "Priya types 'Nguyen' or '204555' or
 * 'PT-4KJ2QW9X' and it works." These are those three, plus the ways each one usually breaks.
 */

function booking(overrides: Partial<SearchableBooking> = {}): SearchableBooking {
  return {
    reference: 'PT-4KJ2QW9X',
    customerName: 'Dana Nguyễn',
    customerEmail: 'dana@example.test',
    customerPhone: '(204) 555-0134',
    honoreeName: 'Ada',
    ...overrides,
  };
}

describe('normalisation', () => {
  it('strips accents and punctuation from names', () => {
    expect(normaliseText('Nguyễn')).toBe('nguyen');
    expect(normaliseText("O'Brien-Smith")).toBe('o brien smith');
    expect(normaliseText('  Ada  ')).toBe('ada');
  });

  it('reduces a phone number to its digits whatever its punctuation', () => {
    expect(digitsOf('(204) 555-0134')).toBe('2045550134');
    expect(digitsOf('+1 204 555 0134')).toBe('12045550134');
  });

  it('makes booking codes comparable regardless of case or hyphen', () => {
    expect(normaliseCode('pt-4kj2qw9x')).toBe('PT4KJ2QW9X');
    expect(normaliseCode('PT 4KJ2QW9X')).toBe('PT4KJ2QW9X');
  });
});

describe('the one search field', () => {
  it('finds a booking by last name, accented or not', () => {
    expect(matchesQuery(booking(), parseQuery('Nguyen'))).toBe(true);
    expect(matchesQuery(booking(), parseQuery('nguyễn'))).toBe(true);
  });

  it('finds a booking by a phone fragment typed without punctuation', () => {
    expect(matchesQuery(booking(), parseQuery('204555'))).toBe(true);
    expect(matchesQuery(booking(), parseQuery('5550134'))).toBe(true);
    expect(matchesQuery(booking(), parseQuery('999'))).toBe(false);
  });

  it('finds a booking by its code, cased or hyphenated any way', () => {
    expect(matchesQuery(booking(), parseQuery('PT-4KJ2QW9X'))).toBe(true);
    expect(matchesQuery(booking(), parseQuery('pt4kj2qw9x'))).toBe(true);
    expect(matchesQuery(booking(), parseQuery('4KJ2'))).toBe(true);
  });

  it("matches the birthday guest of honour's name, as the help text promises", () => {
    expect(matchesQuery(booking(), parseQuery('Ada'))).toBe(true);
    expect(matchesQuery(booking({ honoreeName: null }), parseQuery('Ada'))).toBe(false);
  });

  it('matches email', () => {
    expect(matchesQuery(booking(), parseQuery('dana@example.test'))).toBe(true);
    expect(matchesQuery(booking(), parseQuery('example'))).toBe(true);
  });

  it('narrows on a second word rather than widening', () => {
    expect(matchesQuery(booking(), parseQuery('dana nguyen'))).toBe(true);
    expect(matchesQuery(booking(), parseQuery('dana smith'))).toBe(false);
  });

  it('shows everything for an empty query — the default view is today and forward', () => {
    expect(matchesQuery(booking(), parseQuery(''))).toBe(true);
    expect(matchesQuery(booking(), parseQuery('   '))).toBe(true);
  });

  it('does not let a one- or two-digit query match every phone number', () => {
    expect(matchesQuery(booking(), parseQuery('20'))).toBe(false);
  });
});

describe('filters', () => {
  it('falls back to "all" for anything it does not recognise', () => {
    expect(parseTypeFilter(undefined)).toBe('all');
    expect(parseTypeFilter('nonsense')).toBe('all');
    expect(parseTypeFilter('party')).toBe('party');
    expect(parseStatusFilter('pending')).toBe('pending');
    expect(parseStatusFilter('')).toBe('all');
  });

  it('maps a status filter onto real Booking.status values', () => {
    expect(statusesFor('all')).toBeNull();
    expect(statusesFor('confirmed')).toEqual(['CONFIRMED']);
    expect(statusesFor('completed')).toEqual(['COMPLETED', 'NO_SHOW']);
  });
});

describe('ordering', () => {
  function row(overrides: Partial<SortableBooking> = {}): SortableBooking {
    return {
      date: '2026-08-10',
      startMinutes: 780,
      isParty: false,
      status: 'CONFIRMED',
      depositRecorded: true,
      createdAtMs: 0,
      ...overrides,
    };
  }

  it('treats only a confirmed party with no deposit as money on the floor', () => {
    expect(isPendingDeposit(row({ isParty: true, depositRecorded: false }))).toBe(true);
    expect(isPendingDeposit(row({ isParty: true, depositRecorded: true }))).toBe(false);
    expect(isPendingDeposit(row({ isParty: false, depositRecorded: false }))).toBe(false);
    expect(isPendingDeposit(row({ isParty: true, depositRecorded: false, status: 'CANCELLED' }))).toBe(
      false,
    );
  });

  it('pins pending-deposit parties above everything, however far away they are', () => {
    const pending = row({ date: '2026-12-01', isParty: true, depositRecorded: false });
    const today = row({ date: '2026-08-08' });
    expect([today, pending].sort(compareBookings)[0]).toBe(pending);
  });

  it('otherwise sorts by when it happens, then newest booking first', () => {
    const early = row({ startMinutes: 720 });
    const late = row({ startMinutes: 900 });
    expect([late, early].sort(compareBookings)).toEqual([early, late]);

    const older = row({ createdAtMs: 1 });
    const newer = row({ createdAtMs: 2 });
    expect([older, newer].sort(compareBookings)).toEqual([newer, older]);
  });
});
