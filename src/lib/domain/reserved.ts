/**
 * Reserved game times and their release to the public (R-18, R-19, R-20, R-21).
 *
 * "Some time slots are reserved for private birthday parties. They open up if no party is
 * scheduled." That single sentence from the manager is the whole of this module, and the
 * hard part is *when* they open up: releasing immediately lets the public eat party inventory
 * months ahead; never releasing wastes it.
 */

import type { EngineConfig } from './config';
import type { Catalog, DayState, PartyWindowRecord } from './types';
import { gameSetsForWindow, partyWindowsFor } from './slots';
import { windowHasBookableConfiguration } from './rooms';

export type ReleaseDecision =
  | { released: true; reason: 'WINDOW_UNSELLABLE' | 'LEAD_TIME_REACHED' }
  | { released: false; reason: 'PARTY_ONLY' | 'SET_CLAIMED' | 'STILL_RESERVED' };

/** Every party game set id claimed by a live booking on this date (R-16). */
export function claimedSetIds(dayState: DayState): Set<string> {
  const claimed = new Set<string>();
  for (const booking of dayState.partyBookings) {
    for (const id of booking.claimedGameSetIds) claimed.add(id);
  }
  return claimed;
}

/**
 * R-18 — a reserved game time G in set S of window W on date D is publicly bookable iff BOTH:
 *   1. no party booking on D has claimed S, and
 *   2. either (a) W has no remaining bookable room configuration on D — no further party can
 *      be sold into that window, so its remaining reserved times are dead inventory — or
 *      (b) now >= G - CFG.reservedReleaseLeadMinutes.
 *
 * R-19 — this never applies to PARTY_ONLY slots (the weekend 10:15-11:00 games). Those exist
 * only to serve the parties in that window and are not public inventory on any lead time.
 */
export function evaluateRelease(args: {
  now: Date;
  startsAtUtc: Date;
  isPartyOnly: boolean;
  setId: string;
  window: PartyWindowRecord;
  catalog: Catalog;
  dayState: DayState;
  config: EngineConfig;
}): ReleaseDecision {
  if (args.isPartyOnly) return { released: false, reason: 'PARTY_ONLY' };

  if (claimedSetIds(args.dayState).has(args.setId)) {
    return { released: false, reason: 'SET_CLAIMED' };
  }

  if (!windowHasBookableConfiguration(args.catalog, args.window, args.dayState, args.config)) {
    return { released: true, reason: 'WINDOW_UNSELLABLE' };
  }

  const leadMs = args.config.reservedReleaseLeadMinutes * 60_000;
  if (args.now.getTime() >= args.startsAtUtc.getTime() - leadMs) {
    return { released: true, reason: 'LEAD_TIME_REACHED' };
  }

  return { released: false, reason: 'STILL_RESERVED' };
}

/**
 * Whether a PARTY_HELD start time on a date is currently open to the public.
 *
 * A start time can be configured in more than one set (a manager could, in principle,
 * schedule the same time in two windows). It releases only if EVERY set that owns it has
 * released — otherwise the public would be sold a game a party can still claim.
 */
export function isReservedTimeReleasedToPublic(args: {
  now: Date;
  date: string;
  startMinutes: number;
  startsAtUtc: Date;
  isPartyOnly: boolean;
  catalog: Catalog;
  dayState: DayState;
  config: EngineConfig;
}): ReleaseDecision {
  if (args.isPartyOnly) return { released: false, reason: 'PARTY_ONLY' };

  const decisions: ReleaseDecision[] = [];
  for (const window of partyWindowsFor(args.catalog, args.date)) {
    for (const set of gameSetsForWindow(args.catalog, window.id)) {
      if (!set.times.includes(args.startMinutes)) continue;
      decisions.push(
        evaluateRelease({
          now: args.now,
          startsAtUtc: args.startsAtUtc,
          isPartyOnly: false,
          setId: set.id,
          window,
          catalog: args.catalog,
          dayState: args.dayState,
          config: args.config,
        }),
      );
    }
  }

  if (decisions.length === 0) return { released: true, reason: 'LEAD_TIME_REACHED' };
  const blocked = decisions.find((d) => !d.released);
  return blocked ?? decisions[0];
}

/**
 * R-21 — what a cancelled party's slots revert to.
 * Slots from its configured set go back to PARTY_HELD and become releasable again under R-18;
 * slots that R-17 auto-appended go back to PUBLIC, because nothing reserved them in the first
 * place.
 */
export function revertModeOnCancellation(
  assignmentSource: 'CONFIGURED_SET' | 'AUTO_APPENDED' | 'MANAGER',
): 'PARTY_HELD' | 'PUBLIC' {
  return assignmentSource === 'CONFIGURED_SET' ? 'PARTY_HELD' : 'PUBLIC';
}
