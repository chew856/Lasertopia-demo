/**
 * Plain data the engine operates on.
 *
 * These are deliberately structural, not Prisma types: the engine must be testable without a
 * database, and the persistence layer's job is to hand it these shapes. Every one of them
 * corresponds to a manager-editable table in RULES.md §3 / §6.1.
 */

import type { LocalDateString } from './time';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type GameSlotMode = 'PUBLIC' | 'PARTY_HELD' | 'PARTY_ONLY' | 'BLOCKED';
export type BookingChannel = 'ONLINE' | 'MANAGER';
export type BookingStatus = 'HOLD' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type PricingMode = 'PER_GUEST' | 'PER_UNIT';
export type FoodChoice = 'PIZZA' | 'HOT_DOGS' | 'NONE';
export type GameAssignmentSource = 'CONFIGURED_SET' | 'AUTO_APPENDED' | 'MANAGER';
export type DepositStatus =
  | 'RECORDED'
  | 'APPLIED'
  | 'FORFEITED'
  | 'CONVERTED_TO_GIFT_CARD'
  | 'CARRIED_FORWARD';

// ---------------------------------------------------------------------------------------
// Inventory and templates (RULES §3)
// ---------------------------------------------------------------------------------------

export interface RoomRecord {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  sortOrder: number;
}

export interface RoomConfigurationRecord {
  id: string;
  code: string;
  name: string;
  /** R-27: authoritative. NEVER the sum of member room capacities. */
  capacity: number;
  /** MUST equal roomIds.length. */
  roomSlotsConsumed: number;
  priority: number;
  isActive: boolean;
  roomIds: string[];
}

export interface PartyWindowRecord {
  id: string;
  dayOfWeek: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
  label: string;
  isActive: boolean;
  /** R-28: null = unlimited; room inventory is the real limit. */
  maxParties: number | null;
}

export interface WindowOfferingRecord {
  partyWindowId: string;
  roomConfigurationId: string;
  /** The OQ-10 / OQ-14 boolean. */
  isOffered: boolean;
  priority: number;
}

export interface PartyGameSetRecord {
  id: string;
  partyWindowId: string;
  setIndex: number;
  isActive: boolean;
  /** Minutes from midnight, ascending. Manager-configured times only (R-15). */
  times: number[];
}

export interface OperatingHoursRecord {
  dayOfWeek: DayOfWeek;
  opensMinutes: number;
  closesMinutes: number;
  firstPublicGameMinutes: number;
  lastPublicGameMinutes: number;
  isOpen: boolean;
}

export interface PartyOnlyGameTimeRecord {
  dayOfWeek: DayOfWeek;
  startMinutes: number;
}

export interface ClosureRecord {
  date: LocalDateString;
  reason: string;
  blocksParties: boolean;
  blocksPublic: boolean;
}

export interface PackageRecord {
  id: string;
  code: string;
  name: string;
  basePriceCents: number;
  extraGuestPriceCents: number;
  baseGuests: number;
  gamesIncluded: number;
  roomMinutes: number;
  includesPizza: boolean;
  includesCupcakes: boolean;
  includesHotDogOption: boolean;
  funCardCentsPerGuest: number;
  includesLazerFrenzy: boolean;
  includesTyphoon: boolean;
  arcadeCardEligible: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface PizzaTierRecord {
  minGuests: number;
  maxGuests: number;
  pizzaCount: number;
}

export interface AddOnOptionRecord {
  id: string;
  addOnId: string;
  label: string;
  priceDeltaCents: number;
  sortOrder: number;
}

export interface AddOnRecord {
  id: string;
  code: string;
  name: string;
  pricingMode: PricingMode;
  priceCents: number;
  /** R-51: pizzas and wings are tax-inclusive and must never be taxed again. */
  taxIncluded: boolean;
  requiresOptionChoice: boolean;
  /** R-47: shared group makes two add-ons mutually exclusive. */
  exclusiveGroup: string | null;
  eligiblePackageCodes: string[];
  options: AddOnOptionRecord[];
  isActive: boolean;
  sortOrder: number;
}

export interface GamePricingRecord {
  gameCount: number;
  pricePerPersonCents: number;
  taxIncluded: boolean;
}

/**
 * Everything the manager can edit, in one bag. Every engine function takes this rather than
 * reaching for a module-level constant — that is the mechanical guarantee behind "nothing
 * RULES.md marks as configuration is hardcoded".
 */
export interface Catalog {
  rooms: RoomRecord[];
  roomConfigurations: RoomConfigurationRecord[];
  partyWindows: PartyWindowRecord[];
  windowOfferings: WindowOfferingRecord[];
  partyGameSets: PartyGameSetRecord[];
  operatingHours: OperatingHoursRecord[];
  partyOnlyGameTimes: PartyOnlyGameTimeRecord[];
  closures: ClosureRecord[];
  packages: PackageRecord[];
  pizzaTiers: PizzaTierRecord[];
  addOns: AddOnRecord[];
  gamePricing: GamePricingRecord[];
}

// ---------------------------------------------------------------------------------------
// Live state for a single date
// ---------------------------------------------------------------------------------------

export interface ExistingGameAssignment {
  startMinutes: number;
  playerCount: number;
  arenaGroupIndex: number;
}

export interface ExistingPartyBooking {
  bookingId: string;
  date: LocalDateString;
  partyWindowId: string;
  roomConfigurationId: string;
  /** Denormalised so the engine never has to resolve a configuration to check room overlap. */
  roomIds: string[];
  windowStartMinutes: number;
  windowEndMinutes: number;
  honoreeAge: number;
  /** PartyGameSet ids this booking has claimed (R-16). */
  claimedGameSetIds: string[];
  games: ExistingGameAssignment[];
  status: Extract<BookingStatus, 'HOLD' | 'CONFIRMED'>;
}

export interface ExistingPublicBooking {
  bookingId: string;
  date: LocalDateString;
  games: { startMinutes: number; playerCount: number }[];
}

/**
 * The occupancy picture for one date. Everything the engine needs to answer "what is free",
 * loaded by one query per table and then reasoned over in memory.
 */
export interface DayState {
  date: LocalDateString;
  partyBookings: ExistingPartyBooking[];
  publicBookings: ExistingPublicBooking[];
  /** Manager-blocked game slots on this date (R-23d), minutes from midnight. */
  blockedSlotMinutes: number[];
}

export function emptyDayState(date: LocalDateString): DayState {
  return { date, partyBookings: [], publicBookings: [], blockedSlotMinutes: [] };
}
