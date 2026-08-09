/**
 * Reading the venue out of the database and into the shapes the engine takes.
 *
 * The engine is pure: it takes a `Catalog`, an `EngineConfig` and a `DayState` and never
 * reaches for a table or a clock. This module is the adapter that fills those three, and it
 * is the only place in the laser tag surface that touches Prisma.
 *
 * Two things it is careful about:
 *
 * 1. **Expired holds do not occupy the arena.** A `HOLD` booking whose `holdExpiresAt` has
 *    passed is excluded from `DayState`, so an abandoned checkout cannot eat capacity for the
 *    rest of the day. The filter is in the query, not in a later pass, because "which
 *    bookings count" is the definition of occupancy and must be answered once.
 * 2. **Every date in the browsing window is loaded in one query.** The date strip needs 60
 *    days of availability; sixty round trips per render is not an option, and the engine is
 *    cheap enough to evaluate all of them in memory from a single fetch.
 */

import { cache } from "react";

import { prisma } from "@/lib/db/client";
import { loadEngineConfig, type EngineConfig } from "@/lib/domain";
import type {
  AddOnRecord,
  Catalog,
  DayOfWeek,
  DayState,
  ExistingPartyBooking,
  ExistingPublicBooking,
  LocalDateString,
  PackageRecord,
} from "@/lib/domain";

export interface Venue {
  catalog: Catalog;
  config: EngineConfig;
}

/**
 * The whole manager-editable venue. Wrapped in React's `cache` so a page that renders the
 * grid, the date strip and the price all read one snapshot within a single request.
 */
export const loadVenue = cache(async (): Promise<Venue> => {
  const [
    settingRows,
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
  ] = await Promise.all([
    prisma.setting.findMany({ select: { key: true, value: true, valueType: true } }),
    prisma.room.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.roomConfiguration.findMany({
      include: { rooms: { orderBy: { sortOrder: "asc" } } },
      orderBy: { priority: "asc" },
    }),
    prisma.partyWindow.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }] }),
    prisma.windowOffering.findMany(),
    prisma.partyGameSet.findMany({
      include: { times: { orderBy: { sortOrder: "asc" } } },
      orderBy: { setIndex: "asc" },
    }),
    prisma.operatingHours.findMany(),
    prisma.partyOnlyGameTime.findMany(),
    prisma.closure.findMany(),
    prisma.package.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.pizzaTier.findMany({ orderBy: { minGuests: "asc" } }),
    prisma.addOn.findMany({
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        eligibility: { include: { packageRef: { select: { code: true } } } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.gameSlotPricing.findMany({ orderBy: { gameCount: "asc" } }),
  ]);

  const catalog: Catalog = {
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      isActive: room.isActive,
      sortOrder: room.sortOrder,
    })),
    roomConfigurations: roomConfigurations.map((configuration) => ({
      id: configuration.id,
      code: configuration.code,
      name: configuration.name,
      capacity: configuration.capacity,
      roomSlotsConsumed: configuration.roomSlotsConsumed,
      priority: configuration.priority,
      isActive: configuration.isActive,
      roomIds: configuration.rooms.map((member) => member.roomId),
    })),
    partyWindows: partyWindows.map((window) => ({
      id: window.id,
      dayOfWeek: window.dayOfWeek as DayOfWeek,
      startMinutes: window.startMinutes,
      endMinutes: window.endMinutes,
      label: window.label,
      isActive: window.isActive,
      maxParties: window.maxParties,
    })),
    windowOfferings: windowOfferings.map((offering) => ({
      partyWindowId: offering.partyWindowId,
      roomConfigurationId: offering.roomConfigurationId,
      isOffered: offering.isOffered,
      priority: offering.priority,
    })),
    partyGameSets: partyGameSets.map((set) => ({
      id: set.id,
      partyWindowId: set.partyWindowId,
      setIndex: set.setIndex,
      isActive: set.isActive,
      times: set.times.map((time) => time.startMinutes),
    })),
    operatingHours: operatingHours.map((hours) => ({
      dayOfWeek: hours.dayOfWeek as DayOfWeek,
      opensMinutes: hours.opensMinutes,
      closesMinutes: hours.closesMinutes,
      firstPublicGameMinutes: hours.firstPublicGameMinutes,
      lastPublicGameMinutes: hours.lastPublicGameMinutes,
      isOpen: hours.isOpen,
    })),
    partyOnlyGameTimes: partyOnlyGameTimes.map((time) => ({
      dayOfWeek: time.dayOfWeek as DayOfWeek,
      startMinutes: time.startMinutes,
    })),
    closures: closures.map((closure) => ({
      date: closure.date,
      reason: closure.reason,
      blocksParties: closure.blocksParties,
      blocksPublic: closure.blocksPublic,
    })),
    packages: packages.map(
      (packageRow): PackageRecord => ({
        id: packageRow.id,
        code: packageRow.code,
        name: packageRow.name,
        basePriceCents: packageRow.basePriceCents,
        extraGuestPriceCents: packageRow.extraGuestPriceCents,
        baseGuests: packageRow.baseGuests,
        gamesIncluded: packageRow.gamesIncluded,
        roomMinutes: packageRow.roomMinutes,
        includesPizza: packageRow.includesPizza,
        includesCupcakes: packageRow.includesCupcakes,
        includesHotDogOption: packageRow.includesHotDogOption,
        funCardCentsPerGuest: packageRow.funCardCentsPerGuest,
        includesLazerFrenzy: packageRow.includesLazerFrenzy,
        includesTyphoon: packageRow.includesTyphoon,
        arcadeCardEligible: packageRow.arcadeCardEligible,
        isActive: packageRow.isActive,
        sortOrder: packageRow.sortOrder,
      }),
    ),
    pizzaTiers: pizzaTiers.map((tier) => ({
      minGuests: tier.minGuests,
      maxGuests: tier.maxGuests,
      pizzaCount: tier.pizzaCount,
    })),
    addOns: addOns.map(
      (addOn): AddOnRecord => ({
        id: addOn.id,
        code: addOn.code,
        name: addOn.name,
        pricingMode: addOn.pricingMode as AddOnRecord["pricingMode"],
        priceCents: addOn.priceCents,
        taxIncluded: addOn.taxIncluded,
        requiresOptionChoice: addOn.requiresOptionChoice,
        exclusiveGroup: addOn.exclusiveGroup,
        eligiblePackageCodes: addOn.eligibility.map((row) => row.packageRef.code),
        options: addOn.options.map((option) => ({
          id: option.id,
          addOnId: option.addOnId,
          label: option.label,
          priceDeltaCents: option.priceDeltaCents,
          sortOrder: option.sortOrder,
        })),
        isActive: addOn.isActive,
        sortOrder: addOn.sortOrder,
      }),
    ),
    gamePricing: gamePricing.map((pricing) => ({
      gameCount: pricing.gameCount,
      pricePerPersonCents: pricing.pricePerPersonCents,
      taxIncluded: pricing.taxIncluded,
    })),
  };

  return { catalog, config: loadEngineConfig(settingRows) };
});

/**
 * Occupancy for a set of dates, in one round trip.
 *
 * `excludeBookingId` exists for the re-validation a customer does on their own booking (the
 * cancel screen re-checks the cutoff): a booking must not count itself as competition for the
 * seats it already holds.
 */
export async function loadDayStates(args: {
  dates: readonly LocalDateString[];
  now: Date;
  catalog: Catalog;
  excludeBookingId?: string;
}): Promise<Map<LocalDateString, DayState>> {
  const dates = [...new Set(args.dates)];
  const states = new Map<LocalDateString, DayState>(
    dates.map((date) => [date, { date, partyBookings: [], publicBookings: [], blockedSlotMinutes: [] }]),
  );
  if (dates.length === 0) return states;

  const [bookings, blockedSlots] = await Promise.all([
    prisma.booking.findMany({
      where: {
        date: { in: dates },
        status: { in: ["HOLD", "CONFIRMED"] },
        // An expired hold is not occupancy. Without this an abandoned checkout would keep its
        // seats until a human noticed.
        OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: args.now } }],
        ...(args.excludeBookingId ? { id: { not: args.excludeBookingId } } : {}),
      },
      include: {
        party: true,
        roomSlots: { select: { roomId: true } },
        games: { include: { gameSlot: { select: { startMinutes: true } } } },
      },
    }),
    prisma.gameSlot.findMany({
      where: { date: { in: dates }, mode: "BLOCKED" },
      select: { date: true, startMinutes: true },
    }),
  ]);

  const windowById = new Map(args.catalog.partyWindows.map((window) => [window.id, window]));

  for (const booking of bookings) {
    const state = states.get(booking.date);
    if (!state) continue;

    const games = booking.games.map((game) => ({
      startMinutes: game.gameSlot.startMinutes,
      playerCount: game.playerCount,
      arenaGroupIndex: game.arenaGroupIndex,
    }));

    if (booking.type === "PARTY" && booking.party) {
      const window = windowById.get(booking.party.partyWindowId);
      const party: ExistingPartyBooking = {
        bookingId: booking.id,
        date: booking.date,
        partyWindowId: booking.party.partyWindowId,
        roomConfigurationId: booking.party.roomConfigurationId,
        roomIds: booking.roomSlots.map((slot) => slot.roomId),
        windowStartMinutes: window?.startMinutes ?? 0,
        windowEndMinutes: window?.endMinutes ?? 0,
        honoreeAge: booking.party.honoreeAge,
        claimedGameSetIds: booking.games
          .map((game) => game.partyGameSetId)
          .filter((id): id is string => id !== null),
        games,
        status: booking.status === "HOLD" ? "HOLD" : "CONFIRMED",
      };
      state.partyBookings.push(party);
      continue;
    }

    const publicBooking: ExistingPublicBooking = {
      bookingId: booking.id,
      date: booking.date,
      games: games.map((game) => ({
        startMinutes: game.startMinutes,
        playerCount: game.playerCount,
      })),
    };
    state.publicBookings.push(publicBooking);
  }

  for (const slot of blockedSlots) {
    states.get(slot.date)?.blockedSlotMinutes.push(slot.startMinutes);
  }

  return states;
}
