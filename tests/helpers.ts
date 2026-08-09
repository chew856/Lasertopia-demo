/**
 * Test fixtures.
 *
 * The catalog and config come from `prisma/seed-data.ts` — the same objects the database is
 * seeded from — so a test can never pass against a venue that does not exist.
 */

import { seededCatalog, settings } from '../prisma/seed-data';
import { loadEngineConfig, type EngineConfig } from '../src/lib/domain/config';
import { zonedTimeToUtc, parseClock24, type LocalDateString } from '../src/lib/domain/time';
import type {
  Catalog,
  DayState,
  ExistingPartyBooking,
  ExistingPublicBooking,
} from '../src/lib/domain/types';

export const catalog: Catalog = seededCatalog;
export const config: EngineConfig = loadEngineConfig(settings);
export const TZ = config.timezone;

/** Venue-local wall clock -> instant. Every `now` in these tests is written this way. */
export function at(date: LocalDateString, clock: string): Date {
  return zonedTimeToUtc(date, parseClock24(clock), TZ);
}

export function emptyDay(date: LocalDateString): DayState {
  return { date, partyBookings: [], publicBookings: [], blockedSlotMinutes: [] };
}

export function windowByIdOrThrow(id: string) {
  const found = catalog.partyWindows.find((w) => w.id === id);
  if (!found) throw new Error(`No seeded party window "${id}".`);
  return found;
}

export function packageByCode(code: string) {
  const found = catalog.packages.find((p) => p.code === code);
  if (!found) throw new Error(`No seeded package "${code}".`);
  return found;
}

export function addOnOptionId(addOnCode: string, label: string): string {
  const addOn = catalog.addOns.find((a) => a.code === addOnCode);
  const option = addOn?.options.find((o) => o.label === label);
  if (!option) throw new Error(`No option "${label}" on add-on "${addOnCode}".`);
  return option.id;
}

/** Build an existing party booking occupying a window, for "second party" scenarios. */
export function partyBooking(args: {
  bookingId: string;
  date: LocalDateString;
  partyWindowId: string;
  roomConfigurationId: string;
  honoreeAge: number;
  claimedGameSetIds?: string[];
  games: { clock: string; playerCount: number }[];
}): ExistingPartyBooking {
  const window = windowByIdOrThrow(args.partyWindowId);
  const configuration = catalog.roomConfigurations.find((c) => c.id === args.roomConfigurationId);
  if (!configuration) throw new Error(`No seeded configuration "${args.roomConfigurationId}".`);
  return {
    bookingId: args.bookingId,
    date: args.date,
    partyWindowId: args.partyWindowId,
    roomConfigurationId: args.roomConfigurationId,
    roomIds: [...configuration.roomIds],
    windowStartMinutes: window.startMinutes,
    windowEndMinutes: window.endMinutes,
    honoreeAge: args.honoreeAge,
    claimedGameSetIds: args.claimedGameSetIds ?? [],
    games: args.games.map((g) => ({
      startMinutes: parseClock24(g.clock),
      playerCount: g.playerCount,
      arenaGroupIndex: 0,
    })),
    status: 'CONFIRMED',
  };
}

export function publicBooking(args: {
  bookingId: string;
  date: LocalDateString;
  games: { clock: string; playerCount: number }[];
}): ExistingPublicBooking {
  return {
    bookingId: args.bookingId,
    date: args.date,
    games: args.games.map((g) => ({ startMinutes: parseClock24(g.clock), playerCount: g.playerCount })),
  };
}

/** Turn assigned game times back into "HH:MM" strings so assertions read like the spec. */
export function clocks(times: readonly { startMinutes: number }[]): string[] {
  return times.map((t) => `${String(Math.floor(t.startMinutes / 60)).padStart(2, '0')}:${String(t.startMinutes % 60).padStart(2, '0')}`);
}
