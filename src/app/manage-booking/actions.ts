'use server';

import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db/client';

import { digitsOf, normaliseCode } from '../manage/_lib/search';

/**
 * `/manage-booking` — the public lookup. COPY.md §6 and §8.26.
 *
 * Identity for a customer is `booking code + phone or email` (STRATEGY §0), which makes the
 * code a bearer token and this form the place someone would try to guess one. Three
 * consequences, all of them deliberate:
 *
 *  1. **The code alone is never enough.** The contact field must also match the booking.
 *  2. **The failure copy does not confirm which half was right** (`err.lookup.mismatch.body`),
 *     so a correct code cannot be distinguished from an incorrect one by probing.
 *  3. **Attempts are rate-limited per client**, and the limit counts *attempts*, not failures,
 *     so walking the code space is bounded regardless of how the guesses come out.
 */

export type LookupState = {
  error: 'notFound' | 'mismatch' | 'rateLimit' | 'incomplete' | null;
};

const ATTEMPT_LIMIT = 8;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * In-process, which is honest about what it is: one venue, one server. On more than one
 * instance this needs a shared store, and `err.lookup.rateLimit.body` is the promise that
 * would need to keep holding.
 */
const attempts = new Map<string, { count: number; windowStartedAtMs: number }>();

function overLimit(key: string, nowMs: number): boolean {
  const previous = attempts.get(key);
  if (!previous || nowMs - previous.windowStartedAtMs >= WINDOW_MS) {
    attempts.set(key, { count: 1, windowStartedAtMs: nowMs });
    return false;
  }
  previous.count += 1;
  return previous.count > ATTEMPT_LIMIT;
}

/** Matches whichever of the two the customer typed, without telling them which we checked. */
function contactMatches(
  booking: { customerEmail: string; customerPhone: string },
  contact: string,
): boolean {
  const trimmed = contact.trim();
  if (trimmed === '') return false;

  if (trimmed.includes('@')) {
    return booking.customerEmail.trim().toLowerCase() === trimmed.toLowerCase();
  }
  const digits = digitsOf(trimmed);
  if (digits.length < 7) return false;
  const stored = digitsOf(booking.customerPhone);
  // Compare the last ten digits so a stored `+1 204…` and a typed `204…` agree.
  return stored.slice(-10) === digits.slice(-10);
}

export async function lookupBookingAction(
  _previous: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const code = normaliseCode(String(formData.get('code') ?? ''));
  const contact = String(formData.get('contact') ?? '');

  if (code === '' || contact.trim() === '') return { error: 'incomplete' };

  // Keyed on the code rather than an IP: `x-forwarded-for` is trivially spoofed, and the
  // thing worth bounding is guesses against one booking.
  if (overLimit(code, Date.now())) return { error: 'rateLimit' };

  const booking = await prisma.booking.findFirst({
    where: {
      reference: { in: referenceCandidates(code) },
      status: { in: ['HOLD', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] },
    },
    select: { reference: true, type: true, customerEmail: true, customerPhone: true },
  });
  if (!booking) return { error: 'notFound' };
  if (!contactMatches(booking, contact)) return { error: 'mismatch' };

  // There is no shared `/booking/[code]`; each surface renders its own confirmation.
  redirect(
    booking.type === 'PARTY'
      ? `/parties/booking/${booking.reference}`
      : `/laser-tag/booking/${booking.reference}`,
  );
}

/**
 * The stored references a typed code could mean.
 *
 * `normaliseCode` strips the hyphen so a customer may type `LT-4KJ2QW9X`, `lt4kj2qw9x` or
 * anything between, but the column holds the hyphenated form. Reconstructing the canonical
 * shape keeps this an indexed unique lookup: the previous version pulled the first 500
 * bookings and scanned them in memory, which silently starts returning "not found" for real
 * codes as soon as the venue has taken its 501st booking.
 */
function referenceCandidates(code: string): string[] {
  const withHyphen = /^([A-Z]{2})([A-Z0-9]+)$/.exec(code);
  return withHyphen ? [code, `${withHyphen[1]}-${withHyphen[2]}`] : [code];
}
