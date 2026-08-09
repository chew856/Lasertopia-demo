import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/client';
import {
  emptyDayState,
  loadEngineConfig,
  type Catalog,
  type DayOfWeek,
  type DayState,
  type EngineConfig,
  type ExistingPartyBooking,
  type LocalDateString,
} from '@/lib/domain';

/**
 * Prisma rows → the plain shapes the domain engine takes.
 *
 * The engine is deliberately ignorant of Prisma (see `src/lib/domain/README.md`), so exactly
 * one adapter has to exist per surface that reads the database. This is the manager surface's
 * adapter and it does nothing but reshape: no rule, no default and no business number appears
 * below. If a value is missing from the database the loader throws rather than substituting
 * one, because a board rendered from half a catalog is worse than a board that refuses.
 */

/** Domain `DayOfWeek` is 0–6; the column is an unconstrained `Int`. Narrow once, here. */
function dayOfWeek(value: number): DayOfWeek {
  const normalised = ((value % 7) + 7) % 7;
  return normalised as DayOfWeek;
}

export async function loadConfig(): Promise<EngineConfig> {
  const rows = await prisma.setting.findMany({ select: { key: true, value: true, valueType: true } });
  return loadEngineConfig(rows);
}

export async function loadCatalog(): Promise<Catalog> {
  const [
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
    prisma.room.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.roomConfiguration.findMany({
      include: { rooms: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { priority: 'asc' },
    }),
    prisma.partyWindow.findMany({ orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }] }),
    prisma.windowOffering.findMany(),
    prisma.partyGameSet.findMany({
      include: { times: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { setIndex: 'asc' },
    }),
    prisma.operatingHours.findMany(),
    prisma.partyOnlyGameTime.findMany(),
    prisma.closure.findMany({ orderBy: { date: 'asc' } }),
    prisma.package.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.pizzaTier.findMany({ orderBy: { minGuests: 'asc' } }),
    prisma.addOn.findMany({
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        eligibility: { include: { packageRef: { select: { code: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.gameSlotPricing.findMany({ orderBy: { gameCount: 'asc' } }),
  ]);

  return {
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
    })),
    roomConfigurations: roomConfigurations.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      capacity: c.capacity,
      roomSlotsConsumed: c.roomSlotsConsumed,
      priority: c.priority,
      isActive: c.isActive,
      roomIds: c.rooms.map((member) => member.roomId),
    })),
    partyWindows: partyWindows.map((w) => ({
      id: w.id,
      dayOfWeek: dayOfWeek(w.dayOfWeek),
      startMinutes: w.startMinutes,
      endMinutes: w.endMinutes,
      label: w.label,
      isActive: w.isActive,
      maxParties: w.maxParties,
    })),
    windowOfferings: windowOfferings.map((o) => ({
      partyWindowId: o.partyWindowId,
      roomConfigurationId: o.roomConfigurationId,
      isOffered: o.isOffered,
      priority: o.priority,
    })),
    partyGameSets: partyGameSets.map((s) => ({
      id: s.id,
      partyWindowId: s.partyWindowId,
      setIndex: s.setIndex,
      isActive: s.isActive,
      times: s.times.map((t) => t.startMinutes).sort((a, b) => a - b),
    })),
    operatingHours: operatingHours.map((h) => ({
      dayOfWeek: dayOfWeek(h.dayOfWeek),
      opensMinutes: h.opensMinutes,
      closesMinutes: h.closesMinutes,
      firstPublicGameMinutes: h.firstPublicGameMinutes,
      lastPublicGameMinutes: h.lastPublicGameMinutes,
      isOpen: h.isOpen,
    })),
    partyOnlyGameTimes: partyOnlyGameTimes.map((t) => ({
      dayOfWeek: dayOfWeek(t.dayOfWeek),
      startMinutes: t.startMinutes,
    })),
    closures: closures.map((c) => ({
      date: c.date,
      reason: c.reason,
      blocksParties: c.blocksParties,
      blocksPublic: c.blocksPublic,
    })),
    packages: packages.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      basePriceCents: p.basePriceCents,
      extraGuestPriceCents: p.extraGuestPriceCents,
      baseGuests: p.baseGuests,
      gamesIncluded: p.gamesIncluded,
      roomMinutes: p.roomMinutes,
      includesPizza: p.includesPizza,
      includesCupcakes: p.includesCupcakes,
      includesHotDogOption: p.includesHotDogOption,
      funCardCentsPerGuest: p.funCardCentsPerGuest,
      includesLazerFrenzy: p.includesLazerFrenzy,
      includesTyphoon: p.includesTyphoon,
      arcadeCardEligible: p.arcadeCardEligible,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    })),
    pizzaTiers: pizzaTiers.map((t) => ({
      minGuests: t.minGuests,
      maxGuests: t.maxGuests,
      pizzaCount: t.pizzaCount,
    })),
    addOns: addOns.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      pricingMode: a.pricingMode === 'PER_GUEST' ? 'PER_GUEST' : 'PER_UNIT',
      priceCents: a.priceCents,
      taxIncluded: a.taxIncluded,
      requiresOptionChoice: a.requiresOptionChoice,
      exclusiveGroup: a.exclusiveGroup,
      eligiblePackageCodes: a.eligibility.map((e) => e.packageRef.code),
      options: a.options.map((o) => ({
        id: o.id,
        addOnId: o.addOnId,
        label: o.label,
        priceDeltaCents: o.priceDeltaCents,
        sortOrder: o.sortOrder,
      })),
      isActive: a.isActive,
      sortOrder: a.sortOrder,
    })),
    gamePricing: gamePricing.map((g) => ({
      gameCount: g.gameCount,
      pricePerPersonCents: g.pricePerPersonCents,
      taxIncluded: g.taxIncluded,
    })),
  };
}

/** The `include` the board, the bookings list and the party sheet all read from. */
export const BOOKING_INCLUDE = {
  publicGame: true,
  party: { include: { partyWindow: true, packageRef: true, roomConfiguration: true } },
  roomSlots: { include: { room: true } },
  games: { include: { gameSlot: true } },
  addOns: { include: { addOn: true, option: true } },
  deposit: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.BookingInclude;

export type BookingWithDetail = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

/** Only `HOLD` and `CONFIRMED` occupy inventory — a cancelled booking frees its rooms (R-21). */
const LIVE_STATUSES = ['HOLD', 'CONFIRMED'] as const;

export async function loadBookingsOn(date: LocalDateString): Promise<BookingWithDetail[]> {
  return prisma.booking.findMany({
    where: { date },
    include: BOOKING_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
}

/** The blocked slots on a date with their metadata, for the board's block badges. */
export async function loadBlocks(
  date: LocalDateString,
): Promise<{ startMinutes: number; blockedReason: string | null }[]> {
  return prisma.gameSlot.findMany({
    where: { date, mode: 'BLOCKED' },
    select: { startMinutes: true, blockedReason: true },
    orderBy: { startMinutes: 'asc' },
  });
}

export async function loadBlockedMinutes(date: LocalDateString): Promise<number[]> {
  const rows = await prisma.gameSlot.findMany({
    where: { date, mode: 'BLOCKED' },
    select: { startMinutes: true },
  });
  return rows.map((r) => r.startMinutes).sort((a, b) => a - b);
}

/**
 * The occupancy picture for one date, in the shape every engine function takes.
 * `catalog` is needed only to resolve a room configuration to its member rooms — the engine
 * checks room overlap without ever having to look one up.
 */
export function toDayState(
  date: LocalDateString,
  bookings: readonly BookingWithDetail[],
  blockedSlotMinutes: readonly number[],
  catalog: Catalog,
): DayState {
  const state = emptyDayState(date);
  state.blockedSlotMinutes = [...blockedSlotMinutes];

  const roomIdsFor = new Map(catalog.roomConfigurations.map((c) => [c.id, c.roomIds]));

  for (const booking of bookings) {
    if (!LIVE_STATUSES.includes(booking.status as (typeof LIVE_STATUSES)[number])) continue;

    if (booking.party) {
      const party: ExistingPartyBooking = {
        bookingId: booking.id,
        date: booking.date,
        partyWindowId: booking.party.partyWindowId,
        roomConfigurationId: booking.party.roomConfigurationId,
        roomIds:
          booking.roomSlots.length > 0
            ? booking.roomSlots.map((s) => s.roomId)
            : (roomIdsFor.get(booking.party.roomConfigurationId) ?? []),
        windowStartMinutes: booking.party.partyWindow.startMinutes,
        windowEndMinutes: booking.party.partyWindow.endMinutes,
        honoreeAge: booking.party.honoreeAge,
        claimedGameSetIds: [
          ...new Set(
            booking.games
              .map((g) => g.partyGameSetId)
              .filter((id): id is string => typeof id === 'string'),
          ),
        ],
        games: booking.games.map((g) => ({
          startMinutes: g.gameSlot.startMinutes,
          playerCount: g.playerCount,
          arenaGroupIndex: g.arenaGroupIndex,
        })),
        status: booking.status === 'HOLD' ? 'HOLD' : 'CONFIRMED',
      };
      state.partyBookings.push(party);
      continue;
    }

    state.publicBookings.push({
      bookingId: booking.id,
      date: booking.date,
      games: booking.games.map((g) => ({
        startMinutes: g.gameSlot.startMinutes,
        playerCount: g.playerCount,
      })),
    });
  }

  return state;
}

/** Everything one board render needs, in one round trip per table. */
export async function loadDay(date: LocalDateString): Promise<{
  config: EngineConfig;
  catalog: Catalog;
  bookings: BookingWithDetail[];
  dayState: DayState;
}> {
  const [config, catalog, bookings, blocked] = await Promise.all([
    loadConfig(),
    loadCatalog(),
    loadBookingsOn(date),
    loadBlockedMinutes(date),
  ]);
  return { config, catalog, bookings, dayState: toDayState(date, bookings, blocked, catalog) };
}
