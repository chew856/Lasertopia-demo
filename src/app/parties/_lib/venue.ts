/**
 * Loading the venue: the `Catalog` and the `EngineConfig` the engine takes as parameters.
 *
 * One query per table, assembled in memory — the engine is pure and must never see Prisma.
 * Wrapped in React `cache()` so a single render that touches the catalog from four components
 * still issues one set of queries.
 *
 * Nothing here decides anything. Every number a screen shows comes out of these rows
 * (CLAUDE.md: "configuration lives in the database, not in code").
 */

import { cache } from "react";

import { prisma } from "@/lib/db/client";
import {
  loadEngineConfig,
  type AddOnRecord,
  type Catalog,
  type DayOfWeek,
  type EngineConfig,
  type PricingMode,
} from "@/lib/domain";

export interface Venue {
  catalog: Catalog;
  config: EngineConfig;
}

async function readVenue(): Promise<Venue> {
  const [
    settingRows,
    roomRows,
    configurationRows,
    windowRows,
    offeringRows,
    gameSetRows,
    hoursRows,
    partyOnlyRows,
    closureRows,
    packageRows,
    pizzaTierRows,
    addOnRows,
    gamePricingRows,
  ] = await Promise.all([
    prisma.setting.findMany(),
    prisma.room.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.roomConfiguration.findMany({
      include: { rooms: { orderBy: { sortOrder: "asc" } } },
      orderBy: { priority: "asc" },
    }),
    prisma.partyWindow.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }] }),
    prisma.windowOffering.findMany({ orderBy: { priority: "asc" } }),
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

  const addOns: AddOnRecord[] = addOnRows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    pricingMode: row.pricingMode as PricingMode,
    priceCents: row.priceCents,
    taxIncluded: row.taxIncluded,
    requiresOptionChoice: row.requiresOptionChoice,
    exclusiveGroup: row.exclusiveGroup,
    eligiblePackageCodes: row.eligibility.map((e) => e.packageRef.code),
    options: row.options.map((option) => ({
      id: option.id,
      addOnId: option.addOnId,
      label: option.label,
      priceDeltaCents: option.priceDeltaCents,
      sortOrder: option.sortOrder,
    })),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }));

  const catalog: Catalog = {
    rooms: roomRows.map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
    })),
    roomConfigurations: configurationRows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      capacity: c.capacity,
      roomSlotsConsumed: c.roomSlotsConsumed,
      priority: c.priority,
      isActive: c.isActive,
      roomIds: c.rooms.map((link) => link.roomId),
    })),
    partyWindows: windowRows.map((w) => ({
      id: w.id,
      dayOfWeek: w.dayOfWeek as DayOfWeek,
      startMinutes: w.startMinutes,
      endMinutes: w.endMinutes,
      label: w.label,
      isActive: w.isActive,
      maxParties: w.maxParties,
    })),
    windowOfferings: offeringRows.map((o) => ({
      partyWindowId: o.partyWindowId,
      roomConfigurationId: o.roomConfigurationId,
      isOffered: o.isOffered,
      priority: o.priority,
    })),
    partyGameSets: gameSetRows.map((s) => ({
      id: s.id,
      partyWindowId: s.partyWindowId,
      setIndex: s.setIndex,
      isActive: s.isActive,
      times: s.times.map((t) => t.startMinutes).sort((a, b) => a - b),
    })),
    operatingHours: hoursRows.map((h) => ({
      dayOfWeek: h.dayOfWeek as DayOfWeek,
      opensMinutes: h.opensMinutes,
      closesMinutes: h.closesMinutes,
      firstPublicGameMinutes: h.firstPublicGameMinutes,
      lastPublicGameMinutes: h.lastPublicGameMinutes,
      isOpen: h.isOpen,
    })),
    partyOnlyGameTimes: partyOnlyRows.map((p) => ({
      dayOfWeek: p.dayOfWeek as DayOfWeek,
      startMinutes: p.startMinutes,
    })),
    closures: closureRows.map((c) => ({
      date: c.date,
      reason: c.reason,
      blocksParties: c.blocksParties,
      blocksPublic: c.blocksPublic,
    })),
    packages: packageRows.map((p) => ({
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
    pizzaTiers: pizzaTierRows.map((t) => ({
      minGuests: t.minGuests,
      maxGuests: t.maxGuests,
      pizzaCount: t.pizzaCount,
    })),
    addOns,
    gamePricing: gamePricingRows.map((g) => ({
      gameCount: g.gameCount,
      pricePerPersonCents: g.pricePerPersonCents,
      taxIncluded: g.taxIncluded,
    })),
  };

  const config: EngineConfig = loadEngineConfig(
    settingRows.map((s) => ({ key: s.key, value: s.value, valueType: s.valueType })),
  );

  return { catalog, config };
}

/** Per-request memoised. `loadEngineConfig` throws loudly if a setting row is missing. */
export const loadVenue = cache(readVenue);

/**
 * The package the calendar assumes before one is chosen. `getPartyAvailability` defaults to the
 * most demanding active package's game count for the same reason: a window offered on the
 * strength of the cheapest package's games would reject as soon as a package was picked.
 */
export function provisionalPackage(catalog: Catalog) {
  const active = catalog.packages.filter((p) => p.isActive);
  return [...active].sort(
    (a, b) => b.gamesIncluded - a.gamesIncluded || a.sortOrder - b.sortOrder,
  )[0];
}

export function packageByCode(catalog: Catalog, code: string) {
  return catalog.packages.find((p) => p.code === code && p.isActive) ?? null;
}
