/**
 * The facts a rejection panel needs, gathered for one date.
 *
 * G2 builds this inline because it is already holding the whole horizon. G3 and G4 are not:
 * on the happy path they need one date's availability and a price, and nothing else. So this
 * is deliberately a *lazy* loader — it is called only once something has actually been
 * refused, which is the only moment the alternatives are worth sixty days of evaluation.
 */

import {
  addDays,
  getPublicAvailability,
  localDateOf,
  localMinutesOf,
  operatingHoursFor,
  type PublicAvailability,
} from "@/lib/domain";

import { nextDaysWithRoom } from "./grid";
import type { RejectionContext } from "./rejections";
import { loadDayStates, loadVenue } from "./venue";

export interface FlowRejectionContext {
  context: RejectionContext;
  availability: PublicAvailability;
  /** Every day in the browsing window, so a caller can also answer "is anything bookable". */
  days: PublicAvailability[];
}

export async function loadRejectionContext(args: {
  now: Date;
  players: number;
  games: number;
  date: string;
}): Promise<FlowRejectionContext> {
  const { catalog, config } = await loadVenue();
  const today = localDateOf(args.now, config.timezone);
  const dates = Array.from({ length: config.bookingHorizonDays + 1 }, (_, offset) =>
    addDays(today, offset),
  );
  if (!dates.includes(args.date)) dates.push(args.date);

  const dayStates = await loadDayStates({ dates, now: args.now, catalog });
  const days = dates.map((date) =>
    getPublicAvailability({
      now: args.now,
      date,
      players: args.players,
      games: args.games,
      channel: "ONLINE",
      catalog,
      config,
      dayState: dayStates.get(date) ?? {
        date,
        partyBookings: [],
        publicBookings: [],
        blockedSlotMinutes: [],
      },
    }),
  );

  const availability = days.find((day) => day.date === args.date) ?? days[0];
  const hours = operatingHoursFor(catalog, availability.date);

  return {
    days,
    availability,
    context: {
      date: availability.date,
      players: args.players,
      games: args.games,
      arenaCapacity: config.arenaCapacity,
      cutoffMinutes: config.onlineCutoffMinutes,
      phone: config.venuePhone,
      openMinutes: availability.opensMinutes ?? hours?.opensMinutes ?? 0,
      gameDurationMinutes: config.gameDurationMinutes,
      gameIntervalMinutes: config.gameIntervalMinutes,
      nowMinutes: localMinutesOf(args.now, config.timezone),
      earliestOnlineStartMinutes: availability.nextAvailableStartMinutes,
      oneGamePricePerPersonCents:
        catalog.gamePricing.find((pricing) => pricing.gameCount === 1)?.pricePerPersonCents ?? 0,
      availableStarts: availability.slots
        .filter((slot) => slot.available)
        .map((slot) => slot.startMinutes),
      nextDays: nextDaysWithRoom(days, availability.date, 2),
      currentYear: Number(today.slice(0, 4)),
    },
  };
}

/** Whether a specific start is still bookable for this group right now. */
export function startStillOpen(availability: PublicAvailability, startMinutes: number): boolean {
  return availability.slots.some((slot) => slot.startMinutes === startMinutes && slot.available);
}
