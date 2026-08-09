/**
 * Deposit lifecycle: notice period, reschedule, cancellation (R-53 to R-61).
 *
 * The venue's verbatim policy contradicts itself about rescheduling inside 14 days, and about
 * whether "at least 2 weeks" means >= 14 or > 14. Both readings are implemented as explicit,
 * named decisions rather than as an accident of how the comparison was typed:
 *   - the boundary is `>=` (exactly 14 days counts as sufficient notice), the
 *     customer-favourable reading of "at least 2 weeks" — OQ-13;
 *   - inside 14 days a reschedule is permitted, but only as a manager backend action — OQ-12.
 */

import type { EngineConfig } from './config';
import { ok, reject, type Result } from './errors';
import { wholeDaysBetween } from './time';
import { cents, type Cents } from './money';
import type { BookingChannel, DepositStatus } from './types';

export interface NoticeAssessment {
  /** R-56: floor of the whole days between now and the event, in venue-local wall clock. */
  noticeDays: number;
  requiredDays: number;
  /** Boundary: EXACTLY CFG.changeNoticeDays counts as sufficient. */
  sufficient: boolean;
}

/**
 * R-56 — whole days remaining, computed in CFG.timezone.
 *
 * `wholeDaysBetween` does calendar arithmetic rather than dividing a millisecond span by
 * 86,400,000, because a span crossing a DST change contains a 23- or 25-hour day. For a rule
 * that decides whether a customer keeps $50, drifting the boundary by an hour twice a year is
 * not acceptable.
 */
export function assessNotice(args: {
  now: Date;
  eventStartsAtUtc: Date;
  config: EngineConfig;
}): NoticeAssessment {
  const noticeDays = wholeDaysBetween(args.now, args.eventStartsAtUtc, args.config.timezone);
  return {
    noticeDays,
    requiredDays: args.config.changeNoticeDays,
    sufficient: noticeDays >= args.config.changeNoticeDays,
  };
}

export interface CancellationOutcome {
  notice: NoticeAssessment;
  /** R-57 / R-58. */
  depositStatus: Extract<DepositStatus, 'CONVERTED_TO_GIFT_CARD' | 'FORFEITED'>;
  giftCardAmountCents: Cents;
  /** R-58: the customer MUST be offered the reschedule alternative before finalising. */
  mustOfferReschedule: boolean;
  message: string;
}

/**
 * R-57 / R-58 — cancellation is always allowed; what changes is what happens to the deposit.
 *
 * >= 14 days: the $50 becomes a gift card usable in the facility (never a cash refund).
 * <  14 days: the deposit is forfeited, and the customer must first be offered the move.
 */
export function evaluateCancellation(args: {
  now: Date;
  eventStartsAtUtc: Date;
  depositAmountCents: Cents;
  config: EngineConfig;
}): CancellationOutcome {
  const notice = assessNotice(args);
  if (notice.sufficient) {
    return {
      notice,
      depositStatus: 'CONVERTED_TO_GIFT_CARD',
      giftCardAmountCents: args.depositAmountCents,
      mustOfferReschedule: false,
      message: `Cancelled with ${notice.noticeDays} days notice. Your $50 deposit becomes a gift card you can use in the facility. We never issue a cash refund.`,
    };
  }
  return {
    notice,
    depositStatus: 'FORFEITED',
    giftCardAmountCents: cents(0),
    mustOfferReschedule: true,
    message: `Cancelling ${notice.noticeDays} days before the party means the $50 deposit is forfeited. You can move to a new date instead and keep it — call ${args.config.venuePhone}.`,
  };
}

export interface RescheduleAssessment {
  notice: NoticeAssessment;
  /** The deposit always carries to the new date; it is never re-charged (R-59). */
  depositStatus: Extract<DepositStatus, 'CARRIED_FORWARD'>;
  requiresManager: boolean;
}

/**
 * R-59 — self-serve rescheduling requires >= CFG.changeNoticeDays notice. Inside that, the
 * verbatim policy also offers "the choice to move to a new rescheduled date", so the move is
 * permitted but only from the manager backend (OQ-12).
 *
 * R-60 — a caller that gets `ok` here MUST still re-validate the new date as a fresh booking:
 * rooms (R-30), arena (R-12), the age rule (R-35/R-36) and game assignment (R-16/R-17). If the
 * new date fails, the reschedule is rejected and the original booking is left untouched.
 */
export function evaluateReschedule(args: {
  now: Date;
  eventStartsAtUtc: Date;
  channel: BookingChannel;
  config: EngineConfig;
}): Result<RescheduleAssessment> {
  const notice = assessNotice(args);
  if (notice.sufficient) {
    return ok({ notice, depositStatus: 'CARRIED_FORWARD', requiresManager: false });
  }
  if (args.channel === 'MANAGER') {
    return ok({ notice, depositStatus: 'CARRIED_FORWARD', requiresManager: true });
  }
  return reject(
    'NOTICE_PERIOD_NOT_MET',
    `We need at least ${notice.requiredDays} days notice to change a party date online, and your party is ${notice.noticeDays} days away. Call ${args.config.venuePhone} — our staff can move it and carry your deposit across.`,
    {
      noticeDays: notice.noticeDays,
      requiredDays: notice.requiredDays,
      phone: args.config.venuePhone,
    },
  );
}

/** R-53 — a party cannot reach CONFIRMED without a recorded deposit of CFG.depositAmount. */
export function checkDepositForConfirmation(args: {
  recordedDepositCents: Cents | null;
  config: EngineConfig;
}): Result<null> {
  if (args.recordedDepositCents === null || args.recordedDepositCents < args.config.depositAmountCents) {
    return reject(
      'DEPOSIT_REQUIRED',
      `A $${(args.config.depositAmountCents / 100).toFixed(2)} deposit is required to confirm a party booking. It is applied against your balance and is non-refundable.`,
      { requiredCents: args.config.depositAmountCents },
    );
  }
  return ok(null);
}

/**
 * R-61 — gift card codes. Deterministic given a seed string so the same cancellation cannot
 * mint two different codes on retry; uniqueness is still enforced by the DB unique index.
 */
export function giftCardCodeFor(bookingReference: string, issuedAt: Date): string {
  const stamp = issuedAt.toISOString().slice(0, 10).replace(/-/g, '');
  return `GC-${bookingReference.toUpperCase()}-${stamp}`;
}
