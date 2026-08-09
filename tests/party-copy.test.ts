/**
 * The party surface's copy contract.
 *
 * Two failures this suite exists to catch:
 *
 *  1. **A `{placeholder}` reaching a customer.** Every rejection body and every window reason is
 *     rendered through `interpolate`, which throws in development on a missing value — these
 *     tests exercise those paths so a forgotten value fails in CI rather than on a phone.
 *  2. **A greyed-out row with no reason.** STRATEGY §3.2 P2 is explicit that P2 "must never grey
 *     something out without saying why", so every unavailable window must produce a sentence.
 */

import { describe, expect, it } from 'vitest';

import {
  dayVerdict,
  presentWindow,
  windowReason,
  windowStatus,
} from '@/app/parties/_lib/window-copy';
import { presentHoldExpired, presentRejection } from '@/app/parties/_lib/rejection';
import { buildSummary, packageCardMaths } from '@/app/parties/_lib/money-lines';
import {
  formSummaryMessage,
  isValidEmail,
  isValidPhone,
  validateAcknowledgements,
  validateDetails,
} from '@/app/parties/_lib/validate';
import { party } from '@/lib/copy';
import { hasPlaceholders } from '@/lib/copy/interpolate';
import {
  BOOKING_ERROR_CODES,
  computePartyPrice,
  quotePackages,
  type BookingErrorCode,
  type PartyWindowAvailability,
} from '@/lib/domain';

import { catalog, config, packageByCode } from './helpers';

function unavailableWindow(reason: BookingErrorCode): PartyWindowAvailability {
  return {
    partyWindowId: 'W-SAT-1300',
    label: '1:00 PM – 3:00 PM',
    startMinutes: 780,
    endMinutes: 900,
    startsAtUtc: new Date('2026-08-22T18:00:00Z'),
    endsAtUtc: new Date('2026-08-22T20:00:00Z'),
    available: false,
    reason,
    message: 'engine english, not customer english',
    detail: reason === 'AGE_GAP_EXCEEDED' ? { existingAges: [5] } : {},
    maxGuestsInWindow: 20,
    remainingCapacity: 14,
    roomSlotsTotal: 2,
    roomSlotsFree: 1,
    selection: null,
    arenaGroups: null,
  };
}

const ctx = {
  guests: 16,
  honoreeAge: 9,
  config,
  dateLabel: 'Saturday, August 22',
};

describe('window reasons', () => {
  it('produces a fully-resolved sentence for every reason code the engine can emit', () => {
    for (const code of BOOKING_ERROR_CODES) {
      const reason = windowReason(unavailableWindow(code), ctx);
      expect(reason, code).toBeTruthy();
      expect(hasPlaceholders(reason as string), `${code} left a placeholder`).toBe(false);
    }
  });

  it('names the other party by age only — never a family name', () => {
    const reason = windowReason(unavailableWindow('AGE_GAP_EXCEEDED'), ctx) as string;
    expect(reason).toContain('5-year-old');
    expect(reason).toContain('2 years');
  });

  it('never leaks the engine message, which is written for logs', () => {
    const reason = windowReason(unavailableWindow('NO_ROOM_CONFIG'), ctx) as string;
    expect(reason).not.toContain('engine english');
  });

  it('says nothing when the window is available', () => {
    const available = { ...unavailableWindow('NO_ROOM_CONFIG'), available: true, reason: null };
    expect(windowReason(available, ctx)).toBeNull();
  });

  it('marks an age clash with the party colour and everything else with full', () => {
    expect(presentWindow(unavailableWindow('AGE_GAP_EXCEEDED'), ctx).bayState).toBe('party');
    expect(presentWindow(unavailableWindow('WINDOW_FULL'), ctx).bayState).toBe('full');
    expect(presentWindow(unavailableWindow('VENUE_CLOSED'), ctx).bayState).toBe('blocked');
  });

  it('shows a bay count only while bays are actually free', () => {
    const full = { ...unavailableWindow('WINDOW_FULL'), roomSlotsFree: 0 };
    expect(windowStatus(full).label).toBe('FULL');
    const open = { ...unavailableWindow('WINDOW_FULL'), available: true, roomSlotsFree: 2 };
    expect(windowStatus(open).label).toBe('2 BAYS OPEN');
  });
});

describe('dayVerdict', () => {
  it('separates "closed" from "nothing here fits this party"', () => {
    expect(dayVerdict({ closed: true, windows: [] })).toBe('DAY_CLOSED');
    expect(dayVerdict({ closed: false, windows: [] })).toBe('DAY_CLOSED');
    expect(dayVerdict({ closed: false, windows: [{ available: false }] })).toBe('DAY_FULL');
    expect(dayVerdict({ closed: false, windows: [{ available: true }] })).toBe('OK');
  });
});

describe('presentRejection', () => {
  const base = {
    config,
    guests: 16,
    honoreeAge: 9,
    windowLabel: '1:00 – 3:00 PM',
    dateShort: 'Sat, Aug 22',
    dateLong: 'Saturday, August 22',
    roomMax: 14,
    otherAge: 5,
    alternatives: ['Sun, Aug 23 · 1:00 – 3:00 PM', 'Sat, Aug 29 · 1:00 – 3:00 PM'],
    addOnName: '5-Up Arcade Card — match',
    packageName: 'Around The World',
    totalLabel: '$575.20',
    nextDateShort: 'Sun, Aug 23',
  };

  it('resolves a title and a body with no placeholders left, for every code', () => {
    for (const code of BOOKING_ERROR_CODES) {
      const presented = presentRejection(code, base);
      expect(presented.title, code).toBeTruthy();
      expect(hasPlaceholders(presented.title), `${code} title`).toBe(false);
      if (presented.body !== null) {
        expect(hasPlaceholders(presented.body), `${code} body`).toBe(false);
      }
    }
  });

  it('drops the body rather than printing empty braces when no alternative exists', () => {
    const presented = presentRejection('WINDOW_FULL', { ...base, alternatives: [] });
    expect(presented.title).toContain('1:00 – 3:00 PM');
    expect(presented.body).toBeNull();
  });

  it('uses the review-screen variant when the guest count was edited at P6', () => {
    const atReview = presentRejection('NO_ROOM_CONFIG', { ...base, atReview: true });
    expect(atReview.body).toContain('still live');
    const atCalendar = presentRejection('NO_ROOM_CONFIG', base);
    expect(atCalendar.body).not.toContain('still live');
  });

  it('routes the over-ceiling case to a phone call, not to another window', () => {
    expect(presentRejection('EXCEEDS_MAX_PARTY_SIZE', base).callOnly).toBe(true);
    expect(presentRejection('WINDOW_FULL', base).callOnly).toBe(false);
  });

  it('has both hold-expired bodies, and drops the "gone" one without alternatives', () => {
    const stillOpen = presentHoldExpired({ ...base }, true);
    expect(stillOpen.body).toContain('still open');
    expect(hasPlaceholders(stillOpen.body as string)).toBe(false);

    const gone = presentHoldExpired({ ...base }, false);
    expect(hasPlaceholders(gone.body as string)).toBe(false);

    const goneNoAlts = presentHoldExpired({ ...base, alternatives: [] }, false);
    expect(goneNoAlts.body).toBeNull();
  });
});

describe('money lines', () => {
  const packageRecord = packageByCode('GREAT_ADVENTURE');

  it('shows the extra-guest arithmetic, not just the answer', () => {
    const quote = quotePackages({ guests: 16, catalog, config }).find(
      (q) => q.packageRecord.code === 'GREAT_ADVENTURE',
    )!;
    const maths = packageCardMaths(packageRecord, 16, quote.preTaxSubtotalCents);
    expect(maths.math).toBe('$259.50 + 6 × $25.95');
    expect(maths.total).toBe('$415.20');
  });

  it('omits the arithmetic line when there are no extra guests', () => {
    const quote = quotePackages({ guests: 10, catalog, config }).find(
      (q) => q.packageRecord.code === 'GREAT_ADVENTURE',
    )!;
    const maths = packageCardMaths(packageRecord, 10, quote.preTaxSubtotalCents);
    expect(maths.math).toBeNull();
    expect(maths.note).toContain('$259.50');
  });

  it('renders the tax-inclusive food subtotal as its own row (R-51)', () => {
    const priced = computePartyPrice({
      packageRecord,
      guests: 16,
      addOns: [{ addOnCode: 'PIZZA_CHEESE', quantity: 2 }],
      foodChoice: 'PIZZA',
      catalog,
      config,
      depositAppliedCents: config.depositAmountCents,
    });
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;

    const summary = buildSummary({
      breakdown: priced.value,
      packageRecord,
      guests: 16,
      config,
    });
    const ids = summary.totalsBefore.map((row) => row.id);
    expect(ids).toEqual(['subtotal', 'tax', 'food']);
    expect(summary.totalsBefore[1].label).toBe('GST + PST (12%)');
    // Displayed, never recomputed: the grand total is the engine's figure.
    // $259.50 + 6 x $25.95 = $415.20 pre-tax, + $49.82 tax, + 2 x $22.39 tax-included food.
    expect(summary.totalsBefore[0].amount).toBe('415.20');
    expect(summary.totalsBefore[2].amount).toBe('44.78');
    expect(summary.total.amount).toBe('509.80');
    expect(summary.deposit.label).toBe('Deposit due now');
  });

  it('drops the food row entirely when nothing tax-inclusive was bought', () => {
    const priced = computePartyPrice({
      packageRecord,
      guests: 10,
      catalog,
      config,
      depositAppliedCents: config.depositAmountCents,
    });
    if (!priced.ok) throw new Error('expected a price');
    const summary = buildSummary({ breakdown: priced.value, packageRecord, guests: 10, config });
    expect(summary.totalsBefore.map((r) => r.id)).toEqual(['subtotal', 'tax']);
  });

  it('flips the deposit label once it is recorded', () => {
    const priced = computePartyPrice({
      packageRecord,
      guests: 10,
      catalog,
      config,
      depositAppliedCents: config.depositAmountCents,
    });
    if (!priced.ok) throw new Error('expected a price');
    const summary = buildSummary({
      breakdown: priced.value,
      packageRecord,
      guests: 10,
      config,
      depositPaid: true,
    });
    expect(summary.deposit.label).toBe('Deposit paid');
  });
});

describe('field validation', () => {
  it('accepts the phone shapes the copy tells a customer to use', () => {
    expect(isValidPhone('204-555-0134')).toBe(true);
    expect(isValidPhone('(204) 555 0134')).toBe(true);
    expect(isValidPhone('+1 204 555 0134')).toBe(true);
    expect(isValidPhone('5550134')).toBe(false);
  });

  it('checks an email for the two things the copy promises to check', () => {
    expect(isValidEmail('dana@example.com')).toBe(true);
    expect(isValidEmail('dana@example')).toBe(false);
    expect(isValidEmail('dana.example.com')).toBe(false);
    expect(isValidEmail('a@b@example.com')).toBe(false);
    expect(isValidEmail('dana @example.com')).toBe(false);
  });

  it('names every missing detail field individually', () => {
    const problems = validateDetails({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      honoreeName: '',
      notes: '',
    });
    expect(problems.map((p) => p.fieldId)).toEqual([
      'organiser-name',
      'organiser-phone',
      'organiser-email',
      'honoree-name',
    ]);
    for (const problem of problems) {
      expect(hasPlaceholders(problem.message)).toBe(false);
    }
  });

  it('caps the notes field rather than truncating a parent silently', () => {
    const problems = validateDetails({
      customerName: 'Dana',
      customerPhone: '204-555-0134',
      customerEmail: 'dana@example.com',
      honoreeName: 'Ada',
      notes: 'x'.repeat(501),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].fieldId).toBe('party-notes');
  });

  it('requires all three acknowledgements, each with its own message', () => {
    const problems = validateAcknowledgements({
      house: false,
      deposit: false,
      headcount: false,
    });
    expect(problems).toHaveLength(3);
    expect(new Set(problems.map((p) => p.message)).size).toBe(3);
    expect(validateAcknowledgements({ house: true, deposit: true, headcount: true })).toEqual([]);
  });

  it('counts the problems in the form-level summary', () => {
    expect(formSummaryMessage([{ fieldId: 'a', message: 'x' }])).toBe(
      '1 things need a look before we can continue.',
    );
  });
});

describe('the copy deck itself', () => {
  it('keeps the verbatim policy source byte-for-byte', () => {
    expect(party.policy.full.source).toContain('non refundable deposit of $50.00');
    expect(party.policy.full.source).toContain('GIFT CARD');
  });

  it('keeps the venue spelling of The Traveler — one L', () => {
    expect(party.pkg.TRAVELER.name).toBe('The Traveler');
  });

  it('contains no exclamation marks and no emoji, per COPY.md §0.1', () => {
    const walk = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : typeof value === 'object' && value !== null
          ? Object.values(value).flatMap(walk)
          : [];
    const strings = walk(party);
    expect(strings.length).toBeGreaterThan(200);
    expect(strings.filter((s) => s.includes('!'))).toEqual([]);
    expect(strings.filter((s) => /\p{Extended_Pictographic}/u.test(s))).toEqual([]);
  });
});
