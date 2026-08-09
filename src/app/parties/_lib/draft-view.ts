/**
 * Everything screens P3–P7 need about a draft, assembled once.
 *
 * Each of those screens re-validates on render (STRATEGY §0's two-phase validation): it reloads
 * the draft, re-reads the venue, re-prices from settings and re-checks the hold. A screen never
 * renders a figure that was computed on an earlier request.
 */

import { global, interpolate } from "@/lib/copy";
import {
  computePartyPrice,
  formatClock,
  type Catalog,
  type EngineConfig,
  type PackageRecord,
  type PartyWindowRecord,
  type PriceBreakdown,
} from "@/lib/domain";
import { formatTimeList } from "@/lib/format";

import {
  holdExpired,
  holdSecondsRemaining,
  loadDraft,
  selectionsOf,
  type PartyDraft,
} from "./draft";
import { buildSummary, type SummaryModel } from "./money-lines";
import { loadVenue, packageByCode } from "./venue";

export interface DraftView {
  now: Date;
  draft: PartyDraft;
  catalog: Catalog;
  config: EngineConfig;
  /** Null only if a manager deactivated the package between screens. */
  packageRecord: PackageRecord | null;
  window: PartyWindowRecord | null;
  breakdown: PriceBreakdown | null;
  summary: SummaryModel | null;
  holdExpired: boolean;
  holdSecondsRemaining: number;
}

export async function loadDraftView(draftId: string): Promise<DraftView | null> {
  const draft = await loadDraft(draftId);
  if (!draft) return null;

  const { catalog, config } = await loadVenue();
  const now = new Date();
  const packageRecord = packageByCode(catalog, draft.packageCode);
  const window = catalog.partyWindows.find((w) => w.id === draft.partyWindowId) ?? null;

  let breakdown: PriceBreakdown | null = null;
  if (packageRecord) {
    const priced = computePartyPrice({
      packageRecord,
      guests: draft.guests,
      addOns: selectionsOf(draft),
      foodChoice: draft.foodChoice,
      catalog,
      config,
      depositAppliedCents: config.depositAmountCents,
    });
    if (priced.ok) breakdown = priced.value;
  }

  return {
    now,
    draft,
    catalog,
    config,
    packageRecord,
    window,
    breakdown,
    summary:
      breakdown && packageRecord
        ? buildSummary({ breakdown, packageRecord, guests: draft.guests, config })
        : null,
    holdExpired: holdExpired(draft, now),
    holdSecondsRemaining: holdSecondsRemaining(draft, now),
  };
}

/** "1:15 PM and 1:45 PM" — the party's laser tag games, from the times the engine assigned. */
export function gameTimesLabel(draft: PartyDraft): string | null {
  if (draft.gameTimes.length === 0) return null;
  return formatTimeList(draft.gameTimes);
}

/** The window's own clock range, from the template rather than the stored instant. */
export function windowLabel(window: PartyWindowRecord | null, draft: PartyDraft): string {
  if (window) return window.label;
  return formatClock(draft.gameTimes[0] ?? 0);
}

/**
 * The hold sentence for the sticky bar. `{holdMinutes}` is `CFG.bookingHoldMinutes`, never a
 * literal — the manager can change how long a window is held without a deploy.
 */
export function holdExplainLine(
  config: EngineConfig,
  windowText: string,
  dateShort: string,
): string {
  return interpolate(global.hold.partyExplain, {
    window: windowText,
    dateShort,
    holdMinutes: config.bookingHoldMinutes,
  });
}
