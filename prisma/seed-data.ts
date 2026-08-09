/**
 * The seed, as plain data.
 *
 * Every value here is traceable to a line of RULES.md — the citation is in the comment above
 * it. Times are written as 24-hour strings and prices as decimal strings so a manager reading
 * this file sees the same characters as the spec; `parseClock24` / `parseMoney` do the
 * conversion to the integer representations the schema and the engine use.
 *
 * `prisma/seed.ts` writes this into the database. The test suite imports the same objects as
 * fixtures, so the engine tests and the seeded venue can never drift apart.
 */

import { parseMoney } from '../src/lib/domain/money';
import { parseClock24 } from '../src/lib/domain/time';
import type {
  AddOnRecord,
  Catalog,
  DayOfWeek,
  GamePricingRecord,
  OperatingHoursRecord,
  PackageRecord,
  PartyGameSetRecord,
  PartyOnlyGameTimeRecord,
  PartyWindowRecord,
  PizzaTierRecord,
  RoomConfigurationRecord,
  RoomRecord,
  WindowOfferingRecord,
} from '../src/lib/domain/types';

const SUN = 0 as DayOfWeek;
const MON = 1 as DayOfWeek;
const TUE = 2 as DayOfWeek;
const WED = 3 as DayOfWeek;
const THU = 4 as DayOfWeek;
const FRI = 5 as DayOfWeek;
const SAT = 6 as DayOfWeek;

const WEEKDAYS: DayOfWeek[] = [MON, TUE, WED, THU, FRI];
const DAY_CODE: Record<number, string> = { 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT' };

// =========================================================================================
// §2.0 Configuration registry
// =========================================================================================

export interface SeedSetting {
  key: string;
  value: string;
  valueType: 'INT' | 'DECIMAL' | 'BOOL' | 'STRING' | 'MONEY_CENTS' | 'DURATION_MINUTES';
  description: string;
}

export const settings: SeedSetting[] = [
  { key: 'CFG.timezone', value: 'America/Winnipeg', valueType: 'STRING', description: 'R-01. All rule evaluation happens in this zone.' },
  { key: 'CFG.gameIntervalMinutes', value: '15', valueType: 'DURATION_MINUTES', description: 'Laser tag cadence.' },
  { key: 'CFG.gameDurationMinutes', value: '15', valueType: 'DURATION_MINUTES', description: 'PROVISIONAL. Decides whether a game fits inside a party window (R-17a).' },
  { key: 'CFG.arenaCapacity', value: '25', valueType: 'INT', description: 'R-63. Max concurrent players in one game slot.' },
  { key: 'CFG.onlineCutoffMinutes', value: '90', valueType: 'DURATION_MINUTES', description: 'R-10. No online public booking within this many minutes of game start.' },
  { key: 'CFG.cutoffAppliesToManager', value: 'false', valueType: 'BOOL', description: 'R-13. Manager backend may book inside the cutoff (walk-ins).' },
  { key: 'CFG.maxGamesPerPublicBooking', value: '3', valueType: 'INT', description: 'R-08. Only 1/2/3 games are priced.' },
  { key: 'CFG.publicGamesMustBeConsecutive', value: 'true', valueType: 'BOOL', description: 'PROVISIONAL (OQ-23). R-09.' },
  { key: 'CFG.lastGameStartOffsetMinutes', value: '15', valueType: 'DURATION_MINUTES', description: 'PROVISIONAL (OQ-29). Last public game starts this long before closing.' },
  { key: 'CFG.reservedReleaseLeadMinutes', value: '10080', valueType: 'DURATION_MINUTES', description: 'PROVISIONAL (OQ-28). 7 days. How close to the date an unclaimed reserved time opens to the public (R-18).' },
  { key: 'CFG.partyGameMinGapMinutes', value: '30', valueType: 'DURATION_MINUTES', description: 'R-17b/R-22. Spacing between AUTO-ASSIGNED party games only.' },
  { key: 'CFG.autoAssignedGamesBlockPublic', value: 'true', valueType: 'BOOL', description: 'R-17. Auto-assigned party games become PARTY_HELD.' },
  { key: 'CFG.partiesMayShareGameSlot', value: 'true', valueType: 'BOOL', description: 'PROVISIONAL (OQ-21). Two parties may share a game slot if capacity and age pass.' },
  { key: 'CFG.publicMayJoinPartyHeldSlot', value: 'false', valueType: 'BOOL', description: 'R-11. The public can never enter a party-held game.' },
  { key: 'CFG.maxAgeDifferenceYears', value: '2', valueType: 'INT', description: 'R-35. Pairing rule. Exactly 2 passes.' },
  { key: 'CFG.packageBaseGuests', value: '10', valueType: 'INT', description: 'R-40. Guests included in every package price.' },
  { key: 'CFG.maxPartyGuests', value: '28', valueType: 'INT', description: 'R-25. Hard ceiling; drives the EXCEEDS_MAX_PARTY_SIZE copy.' },
  { key: 'CFG.minPartyGuests', value: '1', valueType: 'INT', description: 'R-40 / OQ-22. Below 10 pays full base price with no discount.' },
  { key: 'CFG.maxPartiesPerWindow', value: 'null', valueType: 'INT', description: 'R-28. null = unlimited; room inventory is the real limit (OQ-07).' },
  { key: 'CFG.windowChangeoverMinutes', value: '0', valueType: 'DURATION_MINUTES', description: 'PROVISIONAL (OQ-26). Cleanup buffer between two bookings of one room (R-30).' },
  { key: 'CFG.depositAmount', value: '50.00', valueType: 'MONEY_CENTS', description: 'R-53. Non-refundable event deposit. Recorded, never charged.' },
  { key: 'CFG.changeNoticeDays', value: '14', valueType: 'INT', description: 'R-56. The 2-week reschedule/cancel boundary. Exactly 14 counts as sufficient.' },
  { key: 'CFG.taxRatePercent', value: '12.0', valueType: 'DECIMAL', description: 'PROVISIONAL (OQ-20). Applied to tax-exclusive lines only (R-51, R-67).' },
  { key: 'CFG.bookingHoldMinutes', value: '15', valueType: 'DURATION_MINUTES', description: 'PROVISIONAL. How long an in-progress booking holds inventory (R-38).' },
  { key: 'CFG.bookingHorizonDays', value: '60', valueType: 'INT', description: 'How far ahead the public may book (STRATEGY §3.1 G2 default).' },
  { key: 'CFG.partyMinLeadHours', value: '0', valueType: 'INT', description: 'OQ-30. No minimum party lead time beyond the 90-minute cutoff.' },
  { key: 'CFG.minHonoreeAge', value: '3', valueType: 'INT', description: 'OQ-25. Bookable honoree age range (STRATEGY §3.2 P1).' },
  { key: 'CFG.maxHonoreeAge', value: '17', valueType: 'INT', description: 'OQ-25. Bookable honoree age range (STRATEGY §3.2 P1).' },
  { key: 'CFG.hotDogsPerGuest', value: '1', valueType: 'INT', description: 'R-43 / OQ-19. Hot dogs replace the pizza allotment.' },
  { key: 'CFG.cupcakesPerGuest', value: '1', valueType: 'INT', description: 'R-44 / OQ-19.' },
  { key: 'CFG.arcadeMatchMinAmount', value: '5.00', valueType: 'MONEY_CENTS', description: 'R-48 / OQ-15. Minimum 5-Up load.' },
  { key: 'CFG.arcadeMatchMaxAmount', value: '20.00', valueType: 'MONEY_CENTS', description: 'R-48 / OQ-15. Match capped at $20.' },
  { key: 'CFG.arcadeMatchIncrement', value: '5.00', valueType: 'MONEY_CENTS', description: 'R-48 / OQ-15. Loads move in $5 increments.' },
  { key: 'CFG.venuePhone', value: '204-474-5900', valueType: 'STRING', description: 'R-25 requires it inside rejection copy, so it is configuration too.' },
];

// =========================================================================================
// §3.2 Rooms — names are PLACEHOLDERS (OQ-04, OQ-36). Renaming is a data edit.
// =========================================================================================

export const rooms: RoomRecord[] = [
  { id: 'RM1', name: 'Party Room 1', capacity: 14, isActive: true, sortOrder: 1 },
  { id: 'RM2', name: 'Party Room 2', capacity: 12, isActive: true, sortOrder: 2 },
  { id: 'RM3', name: 'Party Room 3', capacity: 14, isActive: true, sortOrder: 3 },
  { id: 'RM4', name: 'Party Room 4', capacity: 12, isActive: true, sortOrder: 4 },
  { id: 'RM5', name: 'Grand Party Room', capacity: 18, isActive: true, sortOrder: 5 },
];

export const roomNotes: Record<string, string> = {
  RM1: 'The "largest party room set" 14 in afternoon/early-evening windows.',
  RM2: 'Pairs with RM1.',
  RM3: 'The 14 in the "two different size party rooms" windows.',
  RM4: 'The 12 in the same windows.',
  RM5: 'The single 18-capacity room; the weekend third room-slot.',
};

// =========================================================================================
// §3.3 Room configurations — `capacity` OVERRIDES the member sum (R-27, OQ-05/OQ-06)
// =========================================================================================

export const roomConfigurations: RoomConfigurationRecord[] = [
  { id: 'CFG-A-12', code: 'CFG-A-12', name: 'Room 2 (up to 12)', capacity: 12, roomSlotsConsumed: 1, priority: 10, isActive: true, roomIds: ['RM2'] },
  { id: 'CFG-A-14', code: 'CFG-A-14', name: 'Room 1 (up to 14)', capacity: 14, roomSlotsConsumed: 1, priority: 20, isActive: true, roomIds: ['RM1'] },
  { id: 'CFG-A-20', code: 'CFG-A-20', name: 'Rooms 1 + 2 (up to 20)', capacity: 20, roomSlotsConsumed: 2, priority: 30, isActive: true, roomIds: ['RM1', 'RM2'] },
  { id: 'CFG-B-12', code: 'CFG-B-12', name: 'Room 4 (up to 12)', capacity: 12, roomSlotsConsumed: 1, priority: 40, isActive: true, roomIds: ['RM4'] },
  { id: 'CFG-B-14', code: 'CFG-B-14', name: 'Room 3 (up to 14)', capacity: 14, roomSlotsConsumed: 1, priority: 50, isActive: true, roomIds: ['RM3'] },
  { id: 'CFG-B-20', code: 'CFG-B-20', name: 'Rooms 3 + 4 (up to 20)', capacity: 20, roomSlotsConsumed: 2, priority: 60, isActive: true, roomIds: ['RM3', 'RM4'] },
  { id: 'CFG-G-18', code: 'CFG-G-18', name: 'Grand Party Room (up to 18)', capacity: 18, roomSlotsConsumed: 1, priority: 70, isActive: true, roomIds: ['RM5'] },
  { id: 'CFG-A-28', code: 'CFG-A-28', name: 'Rooms 1 + 2 + Grand (up to 28)', capacity: 28, roomSlotsConsumed: 3, priority: 80, isActive: true, roomIds: ['RM1', 'RM2', 'RM5'] },
  { id: 'CFG-B-28', code: 'CFG-B-28', name: 'Rooms 3 + 4 + Grand (up to 28)', capacity: 28, roomSlotsConsumed: 3, priority: 90, isActive: true, roomIds: ['RM3', 'RM4', 'RM5'] },
];

export const roomConfigurationNotes: Record<string, string> = {
  'CFG-A-12': 'Brief: "one room max 12".',
  'CFG-A-14': 'Brief: "largest party room set holds up to 14 guests (13 friends + honoree)".',
  'CFG-A-20': 'Brief: "If over 14 guests, book two time slots. This can hold up to 20 guests." Capacity 20 overrides the member sum of 26 (R-27, OQ-05).',
  'CFG-B-12': 'Brief: "One room max 12".',
  'CFG-B-14': 'Brief: "the other max 14".',
  'CFG-B-20': 'NOT stated by the brief for these windows. Seeded isOffered = false everywhere (OQ-10). One boolean flip enables it.',
  'CFG-G-18': 'Brief: "the largest party room can hold up to 18" / "third time slot... holds up to 18".',
  'CFG-A-28': 'Brief: "Over 20 guests: up to 28 guests, which takes 3 time slots."',
  'CFG-B-28': 'Same sentence, applied to the evening room set.',
};

// =========================================================================================
// §3.4 Party windows, offerings and reserved game times, for all seven days
// =========================================================================================

interface WindowSpec {
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
  label: string;
  /** Configuration codes offered in this window (all isOffered = true). */
  offered: string[];
  /** Configuration codes present but switched off — the OQ-10 flip lives here. */
  notOffered?: string[];
  /**
   * Reserved game times, one array per party the window can host (R-15).
   * ONLY times the brief states verbatim. Everything else is derived at booking time by R-17.
   */
  sets: string[][];
}

function windowId(day: DayOfWeek, start: string): string {
  return `W-${DAY_CODE[day]}-${start.replace(':', '')}`;
}

// The "A" room pair (RM1 + RM2) serves every window the brief narrates as
// "largest party room set holds up to 14 ... over 14 -> two slots, up to 20".
const OFFERED_A = ['CFG-A-12', 'CFG-A-14', 'CFG-A-20'];
// The "B" room pair (RM3 + RM4) serves every "one max 12, one max 14" window.
const OFFERED_B = ['CFG-B-12', 'CFG-B-14'];

const windowSpecs: WindowSpec[] = [
  // --- Monday to Friday (identical) -----------------------------------------------------
  ...WEEKDAYS.flatMap((day): WindowSpec[] => [
    {
      dayOfWeek: day,
      start: '17:00',
      end: '19:00',
      label: '5:00 PM – 7:00 PM',
      offered: OFFERED_A,
      // Interleaved so each party's two games are spread across its two hours (OQ-03).
      sets: [['17:15', '18:15'], ['17:30', '18:45']],
    },
    {
      dayOfWeek: day,
      start: '18:00',
      end: '20:00',
      label: '6:00 PM – 8:00 PM',
      offered: ['CFG-B-12', 'CFG-B-14', 'CFG-G-18', 'CFG-B-28'],
      notOffered: ['CFG-B-20'],
      // No reserved times exist in the brief for this window at all (OQ-08). R-17 fills it.
      sets: [],
    },
  ]),

  // --- Saturday -------------------------------------------------------------------------
  {
    dayOfWeek: SAT,
    start: '10:00',
    end: '12:00',
    label: '10:00 AM – 12:00 PM',
    offered: ['CFG-A-12', 'CFG-A-14', 'CFG-G-18', 'CFG-A-20', 'CFG-A-28'],
    sets: [['10:15', '10:45'], ['10:30', '11:00']],
  },
  { dayOfWeek: SAT, start: '11:00', end: '13:00', label: '11:00 AM – 1:00 PM', offered: OFFERED_B, notOffered: ['CFG-B-20'], sets: [] },
  { dayOfWeek: SAT, start: '13:00', end: '15:00', label: '1:00 PM – 3:00 PM', offered: OFFERED_A, sets: [['13:15'], ['13:45']] },
  { dayOfWeek: SAT, start: '15:00', end: '17:00', label: '3:00 PM – 5:00 PM', offered: OFFERED_B, notOffered: ['CFG-B-20'], sets: [['15:15'], ['15:45']] },
  { dayOfWeek: SAT, start: '17:00', end: '19:00', label: '5:00 PM – 7:00 PM', offered: OFFERED_A, sets: [['17:15'], ['17:45']] },

  // --- Sunday ---------------------------------------------------------------------------
  {
    dayOfWeek: SUN,
    start: '10:00',
    end: '12:00',
    label: '10:00 AM – 12:00 PM',
    offered: ['CFG-A-12', 'CFG-A-14', 'CFG-G-18', 'CFG-A-20', 'CFG-A-28'],
    sets: [['10:15', '10:45'], ['10:30', '11:00']],
  },
  { dayOfWeek: SUN, start: '11:00', end: '13:00', label: '11:00 AM – 1:00 PM', offered: OFFERED_B, notOffered: ['CFG-B-20'], sets: [] },
  { dayOfWeek: SUN, start: '13:00', end: '15:00', label: '1:00 PM – 3:00 PM', offered: OFFERED_A, sets: [['13:15'], ['13:45']] },
  { dayOfWeek: SUN, start: '15:00', end: '17:00', label: '3:00 PM – 5:00 PM', offered: OFFERED_B, notOffered: ['CFG-B-20'], sets: [['15:00'], ['15:15']] },
  { dayOfWeek: SUN, start: '16:00', end: '18:00', label: '4:00 PM – 6:00 PM', offered: OFFERED_A, sets: [['16:15'], ['16:45']] },
];

export const partyWindows: PartyWindowRecord[] = windowSpecs.map((spec) => ({
  id: windowId(spec.dayOfWeek, spec.start),
  dayOfWeek: spec.dayOfWeek,
  startMinutes: parseClock24(spec.start),
  endMinutes: parseClock24(spec.end),
  label: spec.label,
  isActive: true,
  maxParties: null,
}));

export const windowOfferings: WindowOfferingRecord[] = windowSpecs.flatMap((spec) => {
  const id = windowId(spec.dayOfWeek, spec.start);
  const offered = spec.offered.map((code, index) => ({
    partyWindowId: id,
    roomConfigurationId: code,
    isOffered: true,
    priority: (index + 1) * 10,
  }));
  const withheld = (spec.notOffered ?? []).map((code, index) => ({
    partyWindowId: id,
    roomConfigurationId: code,
    isOffered: false,
    priority: 900 + index,
  }));
  return [...offered, ...withheld];
});

export const partyGameSets: PartyGameSetRecord[] = windowSpecs.flatMap((spec) => {
  const id = windowId(spec.dayOfWeek, spec.start);
  return spec.sets.map((times, index) => ({
    id: `${id}-SET${index + 1}`,
    partyWindowId: id,
    setIndex: index + 1,
    isActive: true,
    times: times.map(parseClock24),
  }));
});

// =========================================================================================
// R-02 Operating hours. Last public game = close - CFG.lastGameStartOffsetMinutes (OQ-29).
// =========================================================================================

function hours(day: DayOfWeek, opens: string, closes: string): OperatingHoursRecord {
  const closesMinutes = parseClock24(closes);
  return {
    dayOfWeek: day,
    opensMinutes: parseClock24(opens),
    closesMinutes,
    firstPublicGameMinutes: parseClock24(opens),
    lastPublicGameMinutes: closesMinutes - 15,
    isOpen: true,
  };
}

export const operatingHours: OperatingHoursRecord[] = [
  hours(SUN, '12:00', '19:00'),
  hours(MON, '12:00', '21:00'),
  hours(TUE, '12:00', '21:00'),
  hours(WED, '12:00', '21:00'),
  hours(THU, '12:00', '21:00'),
  hours(FRI, '12:00', '22:00'),
  hours(SAT, '12:00', '21:00'),
];

// R-04. Exactly four extra slots before opening on Saturday and Sunday, mode PARTY_ONLY.
// R-19: these NEVER release to the public, on any lead time.
export const partyOnlyGameTimes: PartyOnlyGameTimeRecord[] = [SAT, SUN].flatMap((day) =>
  ['10:15', '10:30', '10:45', '11:00'].map((t) => ({ dayOfWeek: day, startMinutes: parseClock24(t) })),
);

// R-06. Empty at seed; the manager adds holiday closures in the backend (OQ-27).
export const closures: Catalog['closures'] = [];

// =========================================================================================
// §2.6 Packages (R-39)
// =========================================================================================

export const packages: PackageRecord[] = [
  {
    id: 'PKG-TRAVELER',
    code: 'TRAVELER',
    name: 'The Traveler',
    basePriceCents: parseMoney('224.50'),
    extraGuestPriceCents: parseMoney('22.45'),
    baseGuests: 10,
    gamesIncluded: 2,
    roomMinutes: 90, // OQ-02b: 1.5 hrs of room time inside a 2-hour window (R-32).
    includesPizza: false, // OQ-02a: the website lists no food for The Traveler. REVENUE-MATERIAL.
    includesCupcakes: false,
    includesHotDogOption: false,
    funCardCentsPerGuest: 0,
    includesLazerFrenzy: false,
    includesTyphoon: false,
    arcadeCardEligible: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'PKG-GREAT_ADVENTURE',
    code: 'GREAT_ADVENTURE',
    name: 'The Great Adventure',
    basePriceCents: parseMoney('259.50'),
    extraGuestPriceCents: parseMoney('25.95'),
    baseGuests: 10,
    gamesIncluded: 2,
    roomMinutes: 120,
    includesPizza: true,
    includesCupcakes: true,
    includesHotDogOption: true,
    funCardCentsPerGuest: 0,
    includesLazerFrenzy: false,
    includesTyphoon: false,
    arcadeCardEligible: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'PKG-AROUND_THE_WORLD',
    code: 'AROUND_THE_WORLD',
    name: 'Around The World',
    basePriceCents: parseMoney('359.50'),
    extraGuestPriceCents: parseMoney('35.95'),
    baseGuests: 10,
    gamesIncluded: 2,
    roomMinutes: 120,
    includesPizza: true,
    includesCupcakes: true,
    includesHotDogOption: true,
    funCardCentsPerGuest: parseMoney('10.00'),
    includesLazerFrenzy: true,
    includesTyphoon: true,
    arcadeCardEligible: false, // R-46: already includes a $10 fun card per guest.
    isActive: true,
    sortOrder: 3,
  },
];

export const packageDescriptions: Record<string, string> = {
  TRAVELER:
    'Private party room, 2 laser tag games, merch for the honoree, 1.5 hrs in the room. All packages include a VIP host, soft drinks, popcorn, party supplies, setup and cleanup, and free downloadable invitations.',
  GREAT_ADVENTURE:
    'Private party room, 2 laser tag games, pizza or hot dogs, cupcakes, merch for the honoree, 2 hrs in the room. All packages include a VIP host, soft drinks, popcorn, party supplies, setup and cleanup, and free downloadable invitations.',
  AROUND_THE_WORLD:
    'Private party room, 2 laser tag games, Lazer Frenzy, the Typhoon Experience ride, a $10 fun card per guest, pizza or hot dogs, cupcakes, merch for the honoree, 2 hrs in the room. All packages include a VIP host, soft drinks, popcorn, party supplies, setup and cleanup, and free downloadable invitations.',
};

// R-41. Approved resolution of the brief's gap (11 undefined) and overlaps (20, 25).
export const pizzaTiers: PizzaTierRecord[] = [
  { minGuests: 10, maxGuests: 11, pizzaCount: 2 },
  { minGuests: 12, maxGuests: 15, pizzaCount: 3 },
  { minGuests: 16, maxGuests: 20, pizzaCount: 4 },
  { minGuests: 21, maxGuests: 25, pizzaCount: 5 },
  { minGuests: 26, maxGuests: 30, pizzaCount: 6 },
];

// =========================================================================================
// §2.7 Add-ons
// =========================================================================================

const PIZZA_TOPPINGS = ['Pepperoni', 'Bacon', 'Hawaiian'];
const WING_SAUCES = [
  'Louisiana',
  'Dry',
  'Sweet Chili',
  'Honey Garlic',
  'Salt and Pepper',
  'Lemon Pepper',
  'Honey Garlic BBQ',
];

const ALL_PACKAGES = ['TRAVELER', 'GREAT_ADVENTURE', 'AROUND_THE_WORLD'];
const ARCADE_PACKAGES = ['TRAVELER', 'GREAT_ADVENTURE'];

function options(addOnId: string, labels: string[]): AddOnRecord['options'] {
  return labels.map((label, index) => ({
    id: `${addOnId}-OPT-${index + 1}`,
    addOnId,
    label,
    priceDeltaCents: 0,
    sortOrder: index + 1,
  }));
}

export const addOns: AddOnRecord[] = [
  {
    id: 'ADDON-ARCADE_5UP_MATCH',
    code: 'ARCADE_5UP_MATCH',
    name: '5-Up Arcade Card (match)',
    pricingMode: 'PER_GUEST',
    priceCents: parseMoney('5.00'),
    taxIncluded: false, // PROVISIONAL (OQ-20).
    requiresOptionChoice: true,
    exclusiveGroup: 'ARCADE_CARD', // R-47: the brief says "OR".
    eligiblePackageCodes: ARCADE_PACKAGES,
    // R-48: loads move in $5 increments from $5 to $20; the match is 1:1 and caps at $20.
    options: [
      { id: 'ADDON-ARCADE_5UP_MATCH-OPT-1', addOnId: 'ADDON-ARCADE_5UP_MATCH', label: 'Load $5 (matched with $5)', priceDeltaCents: 0, sortOrder: 1 },
      { id: 'ADDON-ARCADE_5UP_MATCH-OPT-2', addOnId: 'ADDON-ARCADE_5UP_MATCH', label: 'Load $10 (matched with $10)', priceDeltaCents: parseMoney('5.00'), sortOrder: 2 },
      { id: 'ADDON-ARCADE_5UP_MATCH-OPT-3', addOnId: 'ADDON-ARCADE_5UP_MATCH', label: 'Load $15 (matched with $15)', priceDeltaCents: parseMoney('10.00'), sortOrder: 3 },
      { id: 'ADDON-ARCADE_5UP_MATCH-OPT-4', addOnId: 'ADDON-ARCADE_5UP_MATCH', label: 'Load $20 (matched with $20)', priceDeltaCents: parseMoney('15.00'), sortOrder: 4 },
    ],
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'ADDON-ARCADE_TIMEPLAY_45',
    code: 'ARCADE_TIMEPLAY_45',
    name: '45-minute Arcade Time Play card',
    pricingMode: 'PER_GUEST',
    priceCents: parseMoney('5.00'),
    taxIncluded: false, // PROVISIONAL (OQ-20).
    requiresOptionChoice: false,
    exclusiveGroup: 'ARCADE_CARD',
    eligiblePackageCodes: ARCADE_PACKAGES,
    options: [],
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'ADDON-QBIX_5D',
    code: 'QBIX_5D',
    name: 'QBIX 5D',
    pricingMode: 'PER_GUEST',
    priceCents: parseMoney('3.95'),
    taxIncluded: false, // PROVISIONAL (OQ-20).
    requiresOptionChoice: false,
    exclusiveGroup: null,
    eligiblePackageCodes: ALL_PACKAGES, // OQ-17 unresolved: may duplicate Typhoon on Around The World.
    options: [],
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'ADDON-PIZZA_CHEESE',
    code: 'PIZZA_CHEESE',
    name: 'Extra Large Cheese pizza',
    pricingMode: 'PER_UNIT',
    priceCents: parseMoney('22.39'),
    taxIncluded: true, // R-51: price includes tax; never apply CFG.taxRatePercent.
    requiresOptionChoice: false,
    exclusiveGroup: null,
    eligiblePackageCodes: ALL_PACKAGES,
    options: [],
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'ADDON-PIZZA_1TOP',
    code: 'PIZZA_1TOP',
    name: 'Extra Large 1-Topping pizza',
    pricingMode: 'PER_UNIT',
    priceCents: parseMoney('24.63'),
    taxIncluded: true,
    requiresOptionChoice: true,
    exclusiveGroup: null,
    eligiblePackageCodes: ALL_PACKAGES,
    options: options('ADDON-PIZZA_1TOP', PIZZA_TOPPINGS),
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'ADDON-PIZZA_2TOP',
    code: 'PIZZA_2TOP',
    name: 'Extra Large 2-Topping pizza',
    pricingMode: 'PER_UNIT',
    priceCents: parseMoney('26.87'),
    taxIncluded: true,
    requiresOptionChoice: true,
    exclusiveGroup: null,
    eligiblePackageCodes: ALL_PACKAGES,
    options: options('ADDON-PIZZA_2TOP', PIZZA_TOPPINGS),
    isActive: true,
    sortOrder: 6,
  },
  {
    id: 'ADDON-WINGS_8',
    code: 'WINGS_8',
    name: '8 wings',
    pricingMode: 'PER_UNIT',
    priceCents: parseMoney('10.07'),
    taxIncluded: true,
    requiresOptionChoice: true,
    exclusiveGroup: null,
    eligiblePackageCodes: ALL_PACKAGES,
    options: options('ADDON-WINGS_8', WING_SAUCES),
    isActive: true,
    sortOrder: 7,
  },
  {
    id: 'ADDON-WINGS_16',
    code: 'WINGS_16',
    name: '16 wings',
    pricingMode: 'PER_UNIT',
    priceCents: parseMoney('19.03'),
    taxIncluded: true,
    requiresOptionChoice: true,
    exclusiveGroup: null,
    eligiblePackageCodes: ALL_PACKAGES,
    options: options('ADDON-WINGS_16', WING_SAUCES),
    isActive: true,
    sortOrder: 8,
  },
  {
    id: 'ADDON-WINGS_24',
    code: 'WINGS_24',
    name: '24 wings',
    pricingMode: 'PER_UNIT',
    priceCents: parseMoney('29.11'),
    taxIncluded: true,
    requiresOptionChoice: true,
    exclusiveGroup: null,
    eligiblePackageCodes: ALL_PACKAGES,
    options: options('ADDON-WINGS_24', WING_SAUCES),
    isActive: true,
    sortOrder: 9,
  },
];

export const addOnDescriptions: Record<string, string> = {
  ARCADE_5UP_MATCH: 'Guest loads $5 and Lasertopia matches it 1:1 with Bonus Cash, matched up to $20.',
  ARCADE_TIMEPLAY_45:
    'Unlimited arcade time play for 45 minutes. Earns no prize points, and does not work on Claw Machines or QBIX (R-49).',
  QBIX_5D:
    'Immersive 5D interactive game with real-world effects. Seats up to 5. Priced per person; ride times are not scheduled by the platform (R-50, OQ-17).',
  PIZZA_CHEESE: 'Extra Large Cheese pizza. Price includes tax.',
  PIZZA_1TOP: 'Extra Large 1-Topping pizza. Price includes tax.',
  PIZZA_2TOP: 'Extra Large 2-Topping pizza. Price includes tax.',
  WINGS_8: '8 wings, one sauce. Price includes tax.',
  WINGS_16: '16 wings, one sauce. Price includes tax.',
  WINGS_24: '24 wings, one sauce. Price includes tax.',
};

// R-08. Public laser tag pricing, per person, tax-EXCLUSIVE.
export const gamePricing: GamePricingRecord[] = [
  { gameCount: 1, pricePerPersonCents: parseMoney('8.49'), taxIncluded: false },
  { gameCount: 2, pricePerPersonCents: parseMoney('15.49'), taxIncluded: false },
  { gameCount: 3, pricePerPersonCents: parseMoney('21.49'), taxIncluded: false },
];

/** The whole seeded venue, in the shape every engine function expects. */
export const seededCatalog: Catalog = {
  rooms,
  roomConfigurations,
  partyWindows,
  windowOfferings,
  partyGameSets,
  operatingHours,
  partyOnlyGameTimes,
  closures,
  packages,
  pizzaTiers,
  addOns,
  gamePricing,
};
