/**
 * Seeds the venue described in RULES.md §2.0 and §3.
 *
 * Idempotent: every write is an upsert keyed on the natural id, so re-running it after a
 * manager has edited a price will reset that price to the spec value but will not duplicate
 * rows. Bookings are never touched.
 */

import { PrismaClient } from '@prisma/client';
import {
  addOnDescriptions,
  addOns,
  closures,
  gamePricing,
  operatingHours,
  packageDescriptions,
  packages,
  partyGameSets,
  partyOnlyGameTimes,
  partyWindows,
  pizzaTiers,
  roomConfigurationNotes,
  roomConfigurations,
  roomNotes,
  rooms,
  settings,
  windowOfferings,
} from './seed-data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // --- §2.0 configuration registry ------------------------------------------------------
  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      create: { key: setting.key, value: setting.value, valueType: setting.valueType, description: setting.description },
      update: { value: setting.value, valueType: setting.valueType, description: setting.description },
    });
  }

  // --- §3.2 rooms -----------------------------------------------------------------------
  for (const room of rooms) {
    const data = {
      name: room.name,
      capacity: room.capacity,
      isActive: room.isActive,
      sortOrder: room.sortOrder,
      notes: roomNotes[room.id] ?? null,
    };
    await prisma.room.upsert({ where: { id: room.id }, create: { id: room.id, ...data }, update: data });
  }

  // --- §3.3 room configurations ---------------------------------------------------------
  for (const config of roomConfigurations) {
    if (config.roomSlotsConsumed !== config.roomIds.length) {
      throw new Error(
        `Configuration ${config.code} claims ${config.roomSlotsConsumed} room-slots but lists ${config.roomIds.length} rooms. roomSlotsConsumed MUST equal the member room count.`,
      );
    }
    const data = {
      code: config.code,
      name: config.name,
      capacity: config.capacity,
      roomSlotsConsumed: config.roomSlotsConsumed,
      priority: config.priority,
      isActive: config.isActive,
      notes: roomConfigurationNotes[config.id] ?? null,
    };
    await prisma.roomConfiguration.upsert({
      where: { id: config.id },
      create: { id: config.id, ...data },
      update: data,
    });
    await prisma.roomConfigurationRoom.deleteMany({ where: { roomConfigurationId: config.id } });
    for (const [index, roomId] of config.roomIds.entries()) {
      await prisma.roomConfigurationRoom.create({
        data: { roomConfigurationId: config.id, roomId, sortOrder: index + 1 },
      });
    }
  }

  // --- §3.4 party windows, offerings and reserved game times ----------------------------
  for (const window of partyWindows) {
    const data = {
      dayOfWeek: window.dayOfWeek,
      startMinutes: window.startMinutes,
      endMinutes: window.endMinutes,
      label: window.label,
      isActive: window.isActive,
      maxParties: window.maxParties,
    };
    await prisma.partyWindow.upsert({
      where: { id: window.id },
      create: { id: window.id, ...data },
      update: data,
    });
  }

  await prisma.windowOffering.deleteMany({});
  for (const offering of windowOfferings) {
    await prisma.windowOffering.create({ data: offering });
  }

  await prisma.partyGameSetTime.deleteMany({});
  for (const set of partyGameSets) {
    const data = { partyWindowId: set.partyWindowId, setIndex: set.setIndex, isActive: set.isActive };
    await prisma.partyGameSet.upsert({
      where: { id: set.id },
      create: { id: set.id, ...data },
      update: data,
    });
    for (const [index, startMinutes] of set.times.entries()) {
      await prisma.partyGameSetTime.create({
        data: { partyGameSetId: set.id, sortOrder: index + 1, startMinutes, source: 'BRIEF' },
      });
    }
  }

  // --- R-02 / R-04 / R-06 ---------------------------------------------------------------
  for (const hours of operatingHours) {
    const data = {
      opensMinutes: hours.opensMinutes,
      closesMinutes: hours.closesMinutes,
      firstPublicGameMinutes: hours.firstPublicGameMinutes,
      lastPublicGameMinutes: hours.lastPublicGameMinutes,
      isOpen: hours.isOpen,
    };
    await prisma.operatingHours.upsert({
      where: { dayOfWeek: hours.dayOfWeek },
      create: { dayOfWeek: hours.dayOfWeek, ...data },
      update: data,
    });
  }

  await prisma.partyOnlyGameTime.deleteMany({});
  for (const time of partyOnlyGameTimes) {
    await prisma.partyOnlyGameTime.create({ data: time });
  }

  for (const closure of closures) {
    await prisma.closure.upsert({
      where: { date: closure.date },
      create: closure,
      update: closure,
    });
  }

  // --- §2.6 packages and pizza tiers ----------------------------------------------------
  for (const pkg of packages) {
    const data = {
      code: pkg.code,
      name: pkg.name,
      basePriceCents: pkg.basePriceCents,
      extraGuestPriceCents: pkg.extraGuestPriceCents,
      baseGuests: pkg.baseGuests,
      gamesIncluded: pkg.gamesIncluded,
      roomMinutes: pkg.roomMinutes,
      includesPizza: pkg.includesPizza,
      includesCupcakes: pkg.includesCupcakes,
      includesHotDogOption: pkg.includesHotDogOption,
      funCardCentsPerGuest: pkg.funCardCentsPerGuest,
      includesLazerFrenzy: pkg.includesLazerFrenzy,
      includesTyphoon: pkg.includesTyphoon,
      arcadeCardEligible: pkg.arcadeCardEligible,
      descriptionMarkdown: packageDescriptions[pkg.code] ?? '',
      isActive: pkg.isActive,
      sortOrder: pkg.sortOrder,
    };
    await prisma.package.upsert({ where: { id: pkg.id }, create: { id: pkg.id, ...data }, update: data });
  }

  await prisma.pizzaTier.deleteMany({});
  for (const tier of pizzaTiers) {
    await prisma.pizzaTier.create({ data: tier });
  }

  // --- §2.7 add-ons ---------------------------------------------------------------------
  await prisma.addOnPackageEligibility.deleteMany({});
  await prisma.addOnOption.deleteMany({});
  const packageIdByCode = new Map(packages.map((p) => [p.code, p.id]));
  for (const addOn of addOns) {
    const data = {
      code: addOn.code,
      name: addOn.name,
      pricingMode: addOn.pricingMode,
      priceCents: addOn.priceCents,
      taxIncluded: addOn.taxIncluded,
      requiresOptionChoice: addOn.requiresOptionChoice,
      exclusiveGroup: addOn.exclusiveGroup,
      description: addOnDescriptions[addOn.code] ?? '',
      isActive: addOn.isActive,
      sortOrder: addOn.sortOrder,
    };
    await prisma.addOn.upsert({ where: { id: addOn.id }, create: { id: addOn.id, ...data }, update: data });
    for (const option of addOn.options) {
      await prisma.addOnOption.create({
        data: {
          id: option.id,
          addOnId: addOn.id,
          label: option.label,
          priceDeltaCents: option.priceDeltaCents,
          sortOrder: option.sortOrder,
        },
      });
    }
    for (const code of addOn.eligiblePackageCodes) {
      const packageId = packageIdByCode.get(code);
      if (!packageId) throw new Error(`Add-on ${addOn.code} is eligible for unknown package "${code}".`);
      await prisma.addOnPackageEligibility.create({ data: { addOnId: addOn.id, packageId } });
    }
  }

  // --- R-08 public laser tag pricing -----------------------------------------------------
  for (const price of gamePricing) {
    const data = { pricePerPersonCents: price.pricePerPersonCents, taxIncluded: price.taxIncluded };
    await prisma.gameSlotPricing.upsert({
      where: { gameCount: price.gameCount },
      create: { gameCount: price.gameCount, ...data },
      update: data,
    });
  }

  const counts = {
    settings: await prisma.setting.count(),
    rooms: await prisma.room.count(),
    roomConfigurations: await prisma.roomConfiguration.count(),
    partyWindows: await prisma.partyWindow.count(),
    windowOfferings: await prisma.windowOffering.count(),
    partyGameSets: await prisma.partyGameSet.count(),
    partyGameSetTimes: await prisma.partyGameSetTime.count(),
    operatingHours: await prisma.operatingHours.count(),
    partyOnlyGameTimes: await prisma.partyOnlyGameTime.count(),
    packages: await prisma.package.count(),
    pizzaTiers: await prisma.pizzaTier.count(),
    addOns: await prisma.addOn.count(),
    addOnOptions: await prisma.addOnOption.count(),
    gamePricing: await prisma.gameSlotPricing.count(),
  };
  console.log('Seed complete:');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(20)} ${value}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
