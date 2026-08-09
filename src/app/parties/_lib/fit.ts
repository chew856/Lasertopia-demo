/**
 * Guest count, honoree age and the room-fit consequences of both — screen P1's whole subject.
 *
 * Pure functions over the catalog. Nothing here reads the clock, touches Prisma or renders.
 * The thresholds ("over 14 needs two rooms") are *derived from the offered configurations*,
 * never typed in: RULES.md §3.3's seeded inventory happens to make 15–18 fit the single
 * 18-capacity Grand room in one room-slot, so a hardcoded "over 14 uses two rooms" would be
 * false for exactly the counts a parent is most anxious about.
 */

import type { Catalog, EngineConfig } from "@/lib/domain";

export interface OfferedConfigurationSummary {
  capacity: number;
  roomSlots: number;
}

/**
 * Every configuration actually sold in some window, as `(capacity, roomSlots)`.
 * `isOffered === false` rows exist so a manager can enable them without a deploy; until then
 * they are not inventory and must not influence what P1 tells a parent.
 */
export function offeredConfigurationSummaries(
  catalog: Catalog,
): OfferedConfigurationSummary[] {
  const offeredIds = new Set(
    catalog.windowOfferings.filter((o) => o.isOffered).map((o) => o.roomConfigurationId),
  );
  return catalog.roomConfigurations
    .filter((c) => c.isActive && offeredIds.has(c.id))
    .map((c) => ({ capacity: c.capacity, roomSlots: c.roomSlotsConsumed }));
}

/** The largest party the venue can seat anywhere, before `CFG.maxPartyGuests` is applied. */
export function venueCapacity(catalog: Catalog): number {
  return offeredConfigurationSummaries(catalog).reduce((max, c) => Math.max(max, c.capacity), 0);
}

/** The online ceiling: the smaller of the configured cap and what the rooms can physically do. */
export function guestCeiling(catalog: Catalog, config: EngineConfig): number {
  return Math.min(config.maxPartyGuests, venueCapacity(catalog));
}

export interface GuestRoomFit {
  /** False when no offered configuration anywhere is big enough. */
  fits: boolean;
  /** Fewest rooms any fitting configuration occupies. `0` when nothing fits. */
  roomSlots: number;
  /** The smallest fitting capacity — what "fits up to N" means for this count. */
  capacity: number;
  /**
   * True when this count fits in one room-slot, but only because of the venue's single
   * largest room. This is the honest trigger for `p1.guests.hint.fits`.
   */
  needsLargestRoom: boolean;
}

/** What the rooms engine would do with this guest count, ignoring any particular date. */
export function guestRoomFit(catalog: Catalog, guests: number): GuestRoomFit {
  const all = offeredConfigurationSummaries(catalog);
  const fitting = all.filter((c) => c.capacity >= guests);
  if (fitting.length === 0) {
    return { fits: false, roomSlots: 0, capacity: 0, needsLargestRoom: false };
  }

  const roomSlots = fitting.reduce((min, c) => Math.min(min, c.roomSlots), Number.POSITIVE_INFINITY);
  const capacity = fitting
    .filter((c) => c.roomSlots === roomSlots)
    .reduce((min, c) => Math.min(min, c.capacity), Number.POSITIVE_INFINITY);

  // The largest single room, and the largest single room *below* it. A count above the second
  // figure can only be seated in one room-slot by the biggest room in the building.
  const singles = all.filter((c) => c.roomSlots === 1).map((c) => c.capacity);
  const largestSingle = singles.reduce((max, c) => Math.max(max, c), 0);
  const nextSingle = singles
    .filter((c) => c < largestSingle)
    .reduce((max, c) => Math.max(max, c), 0);

  return {
    fits: true,
    roomSlots,
    capacity,
    needsLargestRoom: roomSlots === 1 && guests > nextSingle && largestSingle > nextSingle,
  };
}

/**
 * Which of COPY.md's three room hints is true for this count, or `null` when none is.
 * `twoRooms` / `threeRooms` are keyed off the engine's room-slot answer, not off the numbers
 * that appear inside the sentences.
 */
export type RoomHint = "fits" | "twoRooms" | "threeRooms" | null;

export function roomHintFor(catalog: Catalog, guests: number): RoomHint {
  const fit = guestRoomFit(catalog, guests);
  if (!fit.fits) return null;
  if (fit.roomSlots >= 3) return "threeRooms";
  if (fit.roomSlots === 2) return "twoRooms";
  return fit.needsLargestRoom ? "fits" : null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Parsing the two P1 fields
// ─────────────────────────────────────────────────────────────────────────────────────────

export type IntentField = "guests" | "age";

export interface IntentProblem {
  field: IntentField;
  /** Maps 1:1 onto a COPY.md §8.25 `err.field.*` key. */
  code: "guestsMin" | "guestsMax" | "ageRequired" | "ageRange";
}

export interface PartyIntent {
  guests: number;
  honoreeAge: number;
}

export type IntentResult =
  | { ok: true; value: PartyIntent }
  | { ok: false; problems: IntentProblem[]; partial: { guests: number | null; honoreeAge: number | null } };

function toInteger(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

/**
 * The server-side gate on P1. Guest counts above the ceiling are NOT a field error — R-25 and
 * COPY.md §8.8 send those to the "call us" path with a real phone number, so they are reported
 * as `guestsMax` and the caller routes rather than re-rendering the form.
 */
export function parsePartyIntent(
  raw: { guests?: string | null; age?: string | null },
  catalog: Catalog,
  config: EngineConfig,
): IntentResult {
  const guests = toInteger(raw.guests);
  const honoreeAge = toInteger(raw.age);
  const problems: IntentProblem[] = [];
  const ceiling = guestCeiling(catalog, config);

  if (guests === null || guests < config.minPartyGuests) {
    problems.push({ field: "guests", code: "guestsMin" });
  } else if (guests > ceiling) {
    problems.push({ field: "guests", code: "guestsMax" });
  }

  if (honoreeAge === null) {
    problems.push({ field: "age", code: "ageRequired" });
  } else if (honoreeAge < config.minHonoreeAge || honoreeAge > config.maxHonoreeAge) {
    problems.push({ field: "age", code: "ageRange" });
  }

  if (problems.length > 0) {
    return { ok: false, problems, partial: { guests, honoreeAge } };
  }
  return { ok: true, value: { guests: guests as number, honoreeAge: honoreeAge as number } };
}

/** Whether the count is over the online ceiling — the enquiry path's only trigger from P1. */
export function isOverCeiling(guests: number, catalog: Catalog, config: EngineConfig): boolean {
  return guests > guestCeiling(catalog, config);
}

/** The honoree ages the age control offers, straight from `CFG.minHonoreeAge`/`maxHonoreeAge`. */
export function honoreeAgeRange(config: EngineConfig): number[] {
  const ages: number[] = [];
  for (let age = config.minHonoreeAge; age <= config.maxHonoreeAge; age += 1) ages.push(age);
  return ages;
}
