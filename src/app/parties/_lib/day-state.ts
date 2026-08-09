/**
 * Occupancy: what is already booked on a set of dates, in the shape the engine takes.
 *
 * Two things here are load-bearing.
 *
 * **Expired holds are excluded at query time**, not by hoping a sweep already ran. A lapsed
 * hold that still counted would keep a room and — worse — keep its honoree's age constraint,
 * closing a window to a party that should be able to book it.
 *
 * **Room occupancy is read off `BookingRoomSlot` rows**, which is where R-30's unique index
 * lives, so what the availability screen believes and what the database will actually let a
 * booking commit are derived from the same rows.
 */

import { prisma } from "@/lib/db/client";
import {
  emptyDayState,
  localMinutesOf,
  type Catalog,
  type DayState,
  type EngineConfig,
  type ExistingPartyBooking,
  type ExistingPublicBooking,
  type LocalDateString,
} from "@/lib/domain";

export async function loadDayStates(
  dates: readonly LocalDateString[],
  now: Date,
  catalog: Catalog,
  config: EngineConfig,
): Promise<Map<LocalDateString, DayState>> {
  const states = new Map<LocalDateString, DayState>();
  for (const date of dates) states.set(date, emptyDayState(date));
  if (dates.length === 0) return states;

  const [bookings, blockedSlots] = await Promise.all([
    prisma.booking.findMany({
      // Live bookings only: CONFIRMED, plus HOLDs whose countdown has not run out. A lapsed
      // hold that still counted would keep a room *and* keep its honoree's age constraint.
      where: {
        date: { in: [...dates] },
        status: { in: ["HOLD", "CONFIRMED"] },
        NOT: { status: "HOLD", holdExpiresAt: { lt: now } },
      },
      include: {
        party: true,
        publicGame: true,
        roomSlots: { select: { roomId: true } },
        games: { include: { gameSlot: { select: { startMinutes: true } } } },
      },
    }),
    prisma.gameSlot.findMany({
      where: { date: { in: [...dates] }, mode: "BLOCKED" },
      select: { date: true, startMinutes: true },
    }),
  ]);

  const windowById = new Map(catalog.partyWindows.map((w) => [w.id, w]));

  for (const booking of bookings) {
    const state = states.get(booking.date);
    if (!state) continue;

    const games = booking.games.map((game) => ({
      startMinutes: game.gameSlot.startMinutes,
      playerCount: game.playerCount,
      arenaGroupIndex: game.arenaGroupIndex,
    }));

    if (booking.party) {
      const template = windowById.get(booking.party.partyWindowId);
      const party: ExistingPartyBooking = {
        bookingId: booking.id,
        date: booking.date,
        partyWindowId: booking.party.partyWindowId,
        roomConfigurationId: booking.party.roomConfigurationId,
        roomIds: booking.roomSlots.map((slot) => slot.roomId),
        windowStartMinutes:
          template?.startMinutes ??
          localMinutesOf(booking.party.windowStartsAtUtc, config.timezone),
        windowEndMinutes:
          template?.endMinutes ?? localMinutesOf(booking.party.windowEndsAtUtc, config.timezone),
        honoreeAge: booking.party.honoreeAge,
        claimedGameSetIds: [
          ...new Set(
            booking.games
              .map((game) => game.partyGameSetId)
              .filter((id): id is string => id !== null),
          ),
        ],
        games,
        status: booking.status === "CONFIRMED" ? "CONFIRMED" : "HOLD",
      };
      state.partyBookings.push(party);
      continue;
    }

    const publicBooking: ExistingPublicBooking = {
      bookingId: booking.id,
      date: booking.date,
      games: games.map((g) => ({ startMinutes: g.startMinutes, playerCount: g.playerCount })),
    };
    state.publicBookings.push(publicBooking);
  }

  for (const slot of blockedSlots) {
    states.get(slot.date)?.blockedSlotMinutes.push(slot.startMinutes);
  }

  return states;
}

export async function loadDayState(
  date: LocalDateString,
  now: Date,
  catalog: Catalog,
  config: EngineConfig,
): Promise<DayState> {
  const states = await loadDayStates([date], now, catalog, config);
  return states.get(date) ?? emptyDayState(date);
}
