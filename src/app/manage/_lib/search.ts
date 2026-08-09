/**
 * The one search field — STRATEGY §4.5.
 *
 * "Priya types 'Nguyen' or '204555' or 'PT-4KJ2QW9X' and it works." That is one field matching
 * six columns, one of which (phone) has to match regardless of how either side is punctuated.
 * `LIKE` cannot do that: `204555` must find `(204) 555-0134`, and no `LIKE` pattern over the
 * stored string will. So the SQL query narrows by the structured filters — type, status, date
 * range — and this predicate does the text match in memory over that page of rows.
 *
 * Pure, and therefore testable without a database, which is the point: the phone-normalisation
 * rule is exactly the kind of thing that silently regresses.
 */

export interface SearchableBooking {
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  honoreeName: string | null;
}

/** Digits only. `(204) 555-0134`, `+1 204 555 0134` and `2045550134` all collapse to the same. */
export function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Case, accents and punctuation removed. `Nguyễn` and `nguyen` match; so do `O'Brien` and
 * `obrien`. NFD + combining-mark strip is the whole of the accent handling, and it is enough
 * for Latin-script names, which is what this venue takes over the phone.
 */
export function normaliseText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A booking code, normalised for comparison: `pt 4kj2qw9x` and `PT-4KJ2QW9X` are the same. */
export function normaliseCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export interface ParsedQuery {
  raw: string;
  text: string;
  digits: string;
  code: string;
  empty: boolean;
}

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  return {
    raw: trimmed,
    text: normaliseText(trimmed),
    digits: digitsOf(trimmed),
    code: normaliseCode(trimmed),
    empty: trimmed === '',
  };
}

/**
 * An empty query matches everything — the default view is "today and forward", not "nothing".
 *
 * A digit run of three or more is treated as a phone fragment as well as text, so `204555`
 * finds the number without also making every booking with a `5` in its code a result.
 */
export function matchesQuery(booking: SearchableBooking, query: ParsedQuery): boolean {
  if (query.empty) return true;

  if (query.code.length >= 3 && normaliseCode(booking.reference).includes(query.code)) return true;

  if (query.digits.length >= 3 && digitsOf(booking.customerPhone).includes(query.digits)) return true;

  if (query.text === '') return false;

  const haystacks = [
    normaliseText(booking.customerName),
    normaliseText(booking.customerEmail),
    booking.honoreeName ? normaliseText(booking.honoreeName) : '',
  ];
  // Every whitespace-separated term must appear somewhere, so "nguyen sat" narrows rather
  // than widening — a manager adding a word expects fewer rows, not more.
  const terms = query.text.split(' ').filter(Boolean);
  return terms.every((term) => haystacks.some((haystack) => haystack.includes(term)));
}

// ─── Filters and ordering ────────────────────────────────────────────────────────────────

export type TypeFilter = 'all' | 'games' | 'party';
export type StatusFilter = 'all' | 'confirmed' | 'pending' | 'cancelled' | 'completed';

export function parseTypeFilter(value: string | undefined): TypeFilter {
  return value === 'games' || value === 'party' ? value : 'all';
}

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return value === 'confirmed' || value === 'pending' || value === 'cancelled' || value === 'completed'
    ? value
    : 'all';
}

export interface SortableBooking {
  date: string;
  startMinutes: number;
  isParty: boolean;
  status: string;
  depositRecorded: boolean;
  createdAtMs: number;
}

/**
 * STRATEGY §4.5: "Pending-deposit parties are pinned to the top … this is money on the floor."
 * Everything else sorts by when it happens, then by when it was taken.
 */
export function isPendingDeposit(booking: SortableBooking): boolean {
  return booking.isParty && booking.status === 'CONFIRMED' && !booking.depositRecorded;
}

export function compareBookings(a: SortableBooking, b: SortableBooking): number {
  const pinned = Number(isPendingDeposit(b)) - Number(isPendingDeposit(a));
  if (pinned !== 0) return pinned;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return b.createdAtMs - a.createdAtMs;
}

/** Which `Booking.status` values a status filter selects. `pending` is a derived state. */
export function statusesFor(filter: StatusFilter): string[] | null {
  switch (filter) {
    case 'confirmed':
      return ['CONFIRMED'];
    case 'pending':
      return ['CONFIRMED', 'HOLD'];
    case 'cancelled':
      return ['CANCELLED'];
    case 'completed':
      return ['COMPLETED', 'NO_SHOW'];
    case 'all':
      return null;
  }
}
