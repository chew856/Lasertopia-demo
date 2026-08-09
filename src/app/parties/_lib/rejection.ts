/**
 * A `BookingErrorCode` → the COPY.md §8 panel a customer reads.
 *
 * Pure. One place decides which of the deck's rejection entries applies, so no screen invents a
 * sentence and no screen shows a machine code.
 *
 * **A known gap in the deck, handled honestly:** every party-side §8 body names `{altWindow1}`
 * and `{altWindow2}`, and the deck has no variant for "the engine found no alternative inside
 * the booking horizon". Rather than invent one, this returns `body: null` in that case and the
 * screens render the specific title plus the tap-to-call action, so the failure still says what
 * happened and names a next action. Raised in the report.
 */

import { interpolate, party } from "@/lib/copy";
import type { BookingErrorCode, EngineConfig } from "@/lib/domain";
import { formatMoney } from "@/lib/format";

export interface RejectionContext {
  config: EngineConfig;
  guests: number;
  honoreeAge: number;
  /** `1:00 – 3:00 PM` */
  windowLabel: string;
  /** `Sat, Aug 22` */
  dateShort: string;
  /** `Saturday, August 22` */
  dateLong: string;
  /** The largest party this window could still take. */
  roomMax: number;
  /** The other party's honoree age, when the age rule is what failed. */
  otherAge?: number;
  /** `Sun, Aug 23 · 1:00 – 3:00 PM`, nearest first. */
  alternatives: readonly string[];
  /** Set on add-on failures. */
  addOnName?: string;
  packageName?: string;
  totalLabel?: string;
  /** The soonest bookable date, for the lead-time rejection. */
  nextDateShort?: string;
  /**
   * P6's guest-count edit has its own §8.9 variant: the hold survives a rejected edit, so the
   * copy offers to keep the count that fits rather than sending the parent back to the calendar.
   */
  atReview?: boolean;
}

export interface PresentedRejection {
  title: string;
  /** Null when the deck's body needs alternatives the engine could not find. */
  body: string | null;
  /** True when the recovery is a phone call rather than another window. */
  callOnly: boolean;
}

function pair(ctx: RejectionContext): { altWindow1: string; altWindow2: string } | null {
  if (ctx.alternatives.length < 2) return null;
  return { altWindow1: ctx.alternatives[0], altWindow2: ctx.alternatives[1] };
}

export function presentRejection(
  code: BookingErrorCode,
  ctx: RejectionContext,
): PresentedRejection {
  const { config } = ctx;
  const alts = pair(ctx);

  switch (code) {
    case "NO_ROOM_CONFIG":
      if (ctx.atReview) {
        return {
          title: interpolate(party.err.roomFit.atReview.title, {
            window: ctx.windowLabel,
            dateShort: ctx.dateShort,
            roomMax: ctx.roomMax,
          }),
          body: interpolate(party.err.roomFit.atReview.body, {
            guests: ctx.guests,
            window: ctx.windowLabel,
            roomMax: ctx.roomMax,
          }),
          callOnly: false,
        };
      }
      return {
        title: interpolate(party.err.roomFit.title, { roomMax: ctx.roomMax }),
        body: alts
          ? interpolate(party.err.roomFit.body, {
              guests: ctx.guests,
              window: ctx.windowLabel,
              roomMax: ctx.roomMax,
              ...alts,
            })
          : null,
        callOnly: false,
      };

    case "WINDOW_FULL":
      return {
        title: interpolate(party.err.windowFull.title, { window: ctx.windowLabel }),
        body: alts
          ? interpolate(party.err.windowFull.body, { guests: ctx.guests, ...alts })
          : null,
        callOnly: false,
      };

    case "AGE_GAP_EXCEEDED":
      return {
        title: party.err.ageConflict.title,
        body:
          alts && ctx.otherAge !== undefined
            ? interpolate(party.err.ageConflict.body, {
                ageBand: config.maxAgeDifferenceYears,
                otherAge: ctx.otherAge,
                age: ctx.honoreeAge,
                ...alts,
              })
            : null,
        callOnly: false,
      };

    case "NO_GAME_CAPACITY":
    case "ARENA_FULL":
      return {
        title: party.err.arenaConflict.title,
        body: alts
          ? interpolate(party.err.arenaConflict.body, {
              arenaCap: config.arenaCapacity,
              window: ctx.windowLabel,
              guests: ctx.guests,
              ...alts,
            })
          : null,
        callOnly: false,
      };

    case "ROOM_DOUBLE_BOOKED":
      return {
        title: party.err.roomDoubleBooked.title,
        body: alts
          ? interpolate(party.err.roomDoubleBooked.body, {
              window: ctx.windowLabel,
              guests: ctx.guests,
              ...alts,
            })
          : null,
        callOnly: false,
      };

    case "EXCEEDS_MAX_PARTY_SIZE":
      return {
        title: interpolate(party.err.maxPartySize.title, { maxGuests: config.maxPartyGuests }),
        body: interpolate(party.err.maxPartySize.body, {
          maxGuests: config.maxPartyGuests,
          phone: config.venuePhone,
        }),
        callOnly: true,
      };

    case "MIN_LEAD_TIME_NOT_MET":
      return {
        title: party.err.noticeParty.title,
        body: ctx.nextDateShort
          ? interpolate(party.err.noticeParty.body, {
              leadHours: config.partyMinLeadHours,
              altDate1: ctx.nextDateShort,
              phone: config.venuePhone,
            })
          : null,
        callOnly: true,
      };

    case "BEYOND_HORIZON":
      return {
        title: party.err.horizon.title,
        body: interpolate(party.err.horizon.body, { phone: config.venuePhone }),
        callOnly: true,
      };

    case "PAST_DATE":
      return { title: party.err.past.title, body: party.err.past.body, callOnly: false };

    case "VENUE_CLOSED":
      return {
        title: interpolate(party.err.dayClosed.title, { date: ctx.dateLong }),
        body: null,
        callOnly: false,
      };

    case "ADDON_NOT_ELIGIBLE": {
      // `interpolate` counts "" as a missing value: it throws in development and logs a fault
      // and renders a hole in production ("The  doesn't come with "). Passing `?? ""` here
      // therefore turned a missing add-on or package name into a broken sentence — or a 500
      // on the extras action. When either name is unknown, fall back to the generic panel.
      const named = ctx.addOnName && ctx.packageName;
      return {
        title: named
          ? interpolate(party.err.addonNotEligible.title, {
              addonName: ctx.addOnName as string,
              packageName: ctx.packageName as string,
            })
          : party.err.server.generic.title,
        body: ctx.totalLabel
          ? interpolate(party.err.addonNotEligible.body, { total: ctx.totalLabel })
          : null,
        callOnly: false,
      };
    }

    case "ADDON_EXCLUSIVE_CONFLICT":
      return {
        title: party.err.addonExclusive.title,
        body: party.err.addonExclusive.body,
        callOnly: false,
      };

    case "DEPOSIT_REQUIRED":
      return {
        title: party.err.deposit.title,
        body: interpolate(party.err.deposit.body, {
          deposit: formatMoney(config.depositAmountCents),
          phone: config.venuePhone,
        }),
        callOnly: false,
      };

    case "NOTICE_PERIOD_NOT_MET":
      return {
        title: party.err.noticeChange.title,
        body: interpolate(party.err.noticeChange.body, { phone: config.venuePhone }),
        callOnly: true,
      };

    default:
      return {
        title: party.err.server.generic.title,
        body: interpolate(party.err.server.generic.body, { phone: config.venuePhone }),
        callOnly: false,
      };
  }
}

/** The lapsed-hold panel. Which body depends on whether the window survived (§8.19). */
export function presentHoldExpired(
  ctx: Pick<RejectionContext, "config" | "guests" | "windowLabel" | "dateShort" | "alternatives">,
  stillOpen: boolean,
): PresentedRejection {
  const title = interpolate(party.err.holdExpired.title, { window: ctx.windowLabel });
  if (stillOpen) {
    return {
      title,
      body: interpolate(party.err.holdExpired.body.stillOpen, {
        holdMinutes: ctx.config.bookingHoldMinutes,
        window: ctx.windowLabel,
        dateShort: ctx.dateShort,
      }),
      callOnly: false,
    };
  }
  if (ctx.alternatives.length < 2) return { title, body: null, callOnly: false };
  return {
    title,
    body: interpolate(party.err.holdExpired.body.gone, {
      holdMinutes: ctx.config.bookingHoldMinutes,
      guests: ctx.guests,
      altWindow1: ctx.alternatives[0],
      altWindow2: ctx.alternatives[1],
    }),
    callOnly: false,
  };
}
