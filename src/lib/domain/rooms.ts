/**
 * Room configuration selection and physical room contention (R-25, R-27, R-30).
 *
 * Two things live here and they are deliberately separate:
 *  - which configuration a party SHOULD get (a deterministic preference order), and
 *  - which rooms are physically free (an overlap test on concrete time ranges).
 *
 * The second is what makes overlapping party windows safe. It is not the window definition
 * that prevents a double booking — Sunday 15:00-17:00 and 16:00-18:00 genuinely overlap in
 * time — it is that no room ends up in two live bookings at once.
 */

import type { EngineConfig } from './config';
import { reject, ok, type Result } from './errors';
import type {
  Catalog,
  DayState,
  ExistingPartyBooking,
  PartyWindowRecord,
  RoomConfigurationRecord,
  WindowOfferingRecord,
} from './types';

export interface OfferedConfiguration {
  configuration: RoomConfigurationRecord;
  offering: WindowOfferingRecord;
}

/** The configurations actually sold in a window, honouring `isOffered` and `isActive`. */
export function offeredConfigurations(catalog: Catalog, partyWindowId: string): OfferedConfiguration[] {
  const byId = new Map(catalog.roomConfigurations.map((c) => [c.id, c]));
  return catalog.windowOfferings
    .filter((o) => o.partyWindowId === partyWindowId && o.isOffered)
    .map((offering) => ({ offering, configuration: byId.get(offering.roomConfigurationId) }))
    .filter((x): x is OfferedConfiguration => Boolean(x.configuration?.isActive));
}

/** The largest party any window anywhere can hold. Drives EXCEEDS_MAX_PARTY_SIZE (R-25). */
export function maxCapacityAnywhere(catalog: Catalog): number {
  const offeredIds = new Set(
    catalog.windowOfferings.filter((o) => o.isOffered).map((o) => o.roomConfigurationId),
  );
  return catalog.roomConfigurations
    .filter((c) => c.isActive && offeredIds.has(c.id))
    .reduce((max, c) => Math.max(max, c.capacity), 0);
}

/** The largest party a specific window can hold on an empty calendar. */
export function maxCapacityInWindow(catalog: Catalog, partyWindowId: string): number {
  return offeredConfigurations(catalog, partyWindowId).reduce(
    (max, o) => Math.max(max, o.configuration.capacity),
    0,
  );
}

/**
 * R-30 — two room reservations overlap when
 *   aStart < bEnd + changeover  AND  bStart < aEnd + changeover.
 * Touching boundaries (13:00 end / 13:00 start) do NOT overlap at the seeded 0-minute
 * changeover, which is what lets Saturday 11:00-13:00 and 13:00-15:00 both be sold.
 */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  changeoverMinutes: number,
): boolean {
  return aStart < bEnd + changeoverMinutes && bStart < aEnd + changeoverMinutes;
}

/** The party bookings whose held period overlaps this window on this date. */
export function bookingsOverlapping(
  dayState: DayState,
  window: { startMinutes: number; endMinutes: number },
  config: EngineConfig,
  options: { excludeBookingId?: string } = {},
): ExistingPartyBooking[] {
  return dayState.partyBookings.filter(
    (b) =>
      b.bookingId !== options.excludeBookingId &&
      rangesOverlap(
        window.startMinutes,
        window.endMinutes,
        b.windowStartMinutes,
        b.windowEndMinutes,
        config.windowChangeoverMinutes,
      ),
  );
}

/**
 * Rooms physically unavailable for a window on a date — including rooms held by bookings in
 * a DIFFERENT, overlapping window. This is the check that makes R-31's "two independent
 * constraints" true: it knows nothing about the arena.
 */
export function occupiedRoomIds(
  dayState: DayState,
  window: { startMinutes: number; endMinutes: number },
  config: EngineConfig,
  options: { excludeBookingId?: string } = {},
): Set<string> {
  const occupied = new Set<string>();
  for (const booking of bookingsOverlapping(dayState, window, config, options)) {
    for (const roomId of booking.roomIds) occupied.add(roomId);
  }
  return occupied;
}

export interface RoomSelectionInput {
  guests: number;
  catalog: Catalog;
  config: EngineConfig;
  window: PartyWindowRecord;
  dayState: DayState;
  /** Set when re-validating an existing booking (a reschedule must not collide with itself). */
  excludeBookingId?: string;
}

export interface RoomSelection {
  configuration: RoomConfigurationRecord;
  roomIds: string[];
  capacity: number;
  roomSlotsConsumed: number;
}

/**
 * R-25 — deterministic allocation.
 *
 * Rank the configurations that fit and whose rooms are free by:
 *   1. fewest roomSlotsConsumed  — leave as much of the window sellable as possible. This is
 *      why the 18-capacity single room beats the 14+12 pair for a party of 16: one room-slot
 *      instead of two.
 *   2. smallest capacity         — leave the big rooms for big parties.
 *   3. lowest configured priority — stable tie-break so the same request always resolves the
 *      same way, which is what makes the availability screen and the confirm step agree.
 */
export function selectRoomConfiguration(input: RoomSelectionInput): Result<RoomSelection> {
  const { guests, catalog, config, window, dayState } = input;

  if (!Number.isInteger(guests) || guests < config.minPartyGuests) {
    return reject(
      'INVALID_GUEST_COUNT',
      `Enter a guest count of at least ${config.minPartyGuests}, including the birthday guest of honour.`,
      { minGuests: config.minPartyGuests },
    );
  }

  const ceiling = Math.min(config.maxPartyGuests, maxCapacityAnywhere(catalog));
  if (guests > ceiling) {
    return reject(
      'EXCEEDS_MAX_PARTY_SIZE',
      `Our largest party setup holds ${ceiling} guests. For ${guests} guests, please call us at ${config.venuePhone} so we can look at options.`,
      { maxPartyGuests: ceiling, requestedGuests: guests, phone: config.venuePhone },
    );
  }

  const offered = offeredConfigurations(catalog, window.id);
  const windowCeiling = offered.reduce((max, o) => Math.max(max, o.configuration.capacity), 0);
  if (guests > windowCeiling) {
    return reject(
      'NO_ROOM_CONFIG',
      `${window.label} holds up to ${windowCeiling} guests. For ${guests}, try another window or date.`,
      { windowMaxGuests: windowCeiling, requestedGuests: guests, partyWindowId: window.id },
    );
  }

  const occupied = occupiedRoomIds(dayState, window, config, { excludeBookingId: input.excludeBookingId });
  const allWindowRooms = new Set(offered.flatMap((o) => o.configuration.roomIds));
  const everyRoomTaken =
    allWindowRooms.size > 0 && [...allWindowRooms].every((roomId) => occupied.has(roomId));

  const candidates = offered
    .filter((o) => o.configuration.capacity >= guests)
    .filter((o) => o.configuration.roomIds.every((roomId) => !occupied.has(roomId)))
    .sort((a, b) => {
      if (a.configuration.roomSlotsConsumed !== b.configuration.roomSlotsConsumed) {
        return a.configuration.roomSlotsConsumed - b.configuration.roomSlotsConsumed;
      }
      if (a.configuration.capacity !== b.configuration.capacity) {
        return a.configuration.capacity - b.configuration.capacity;
      }
      if (a.offering.priority !== b.offering.priority) return a.offering.priority - b.offering.priority;
      return a.configuration.priority - b.configuration.priority;
    });

  const best = candidates[0];
  if (!best) {
    if (everyRoomTaken) {
      return reject(
        'WINDOW_FULL',
        `Every party room in ${window.label} is already booked on this date. Pick another window or date.`,
        { partyWindowId: window.id, requestedGuests: guests },
      );
    }
    const largestFree = offered
      .filter((o) => o.configuration.roomIds.every((roomId) => !occupied.has(roomId)))
      .reduce((max, o) => Math.max(max, o.configuration.capacity), 0);
    return reject(
      'NO_ROOM_CONFIG',
      `${window.label} can still hold up to ${largestFree} guests on this date — a party of ${guests} needs rooms that are already booked. Try another window or date.`,
      {
        partyWindowId: window.id,
        requestedGuests: guests,
        remainingCapacity: largestFree,
        windowMaxGuests: windowCeiling,
      },
    );
  }

  return ok({
    configuration: best.configuration,
    roomIds: [...best.configuration.roomIds],
    capacity: best.configuration.capacity,
    roomSlotsConsumed: best.configuration.roomSlotsConsumed,
  });
}

/** Room-slot accounting for the availability screen: how much of the window is left. */
export function roomSlotCounts(
  catalog: Catalog,
  window: PartyWindowRecord,
  dayState: DayState,
  config: EngineConfig,
  options: { excludeBookingId?: string } = {},
): { total: number; free: number } {
  const offered = offeredConfigurations(catalog, window.id);
  const allRooms = new Set(offered.flatMap((o) => o.configuration.roomIds));
  const occupied = occupiedRoomIds(dayState, window, config, options);
  let free = 0;
  for (const roomId of allRooms) if (!occupied.has(roomId)) free += 1;
  return { total: allRooms.size, free };
}

/** The biggest party this window could still take on this date, given what is already booked. */
export function remainingCapacityInWindow(
  catalog: Catalog,
  window: PartyWindowRecord,
  dayState: DayState,
  config: EngineConfig,
  options: { excludeBookingId?: string } = {},
): number {
  const occupied = occupiedRoomIds(dayState, window, config, options);
  return offeredConfigurations(catalog, window.id)
    .filter((o) => o.configuration.roomIds.every((roomId) => !occupied.has(roomId)))
    .reduce((max, o) => Math.max(max, o.configuration.capacity), 0);
}

/**
 * R-18 condition 2(a): can any further party still be sold into this window on this date?
 * When the answer is no, the window's unclaimed reserved game times are dead inventory and
 * release to the public immediately, without waiting out the 7-day lead.
 */
export function windowHasBookableConfiguration(
  catalog: Catalog,
  window: PartyWindowRecord,
  dayState: DayState,
  config: EngineConfig,
): boolean {
  if (config.maxPartiesPerWindow !== null) {
    const parties = dayState.partyBookings.filter((b) => b.partyWindowId === window.id).length;
    if (parties >= config.maxPartiesPerWindow) return false;
  }
  return remainingCapacityInWindow(catalog, window, dayState, config) > 0;
}
