/**
 * Public laser tag availability and booking validation
 * (R-08 to R-14, and the 90-minute cutoff in R-10).
 *
 * The grid this produces is the laser tag flow's entire second screen. Every cell carries a
 * status and, when unavailable, a specific coded reason — the UI has designed different copy
 * and a different recovery for each, so a bare "unavailable" would force it to guess.
 */

import type { EngineConfig } from './config';
import { ok, reject, type BookingErrorCode, type Result } from './errors';
import { formatClock, localDateOf, type LocalDateString } from './time';
import type { BookingChannel, Catalog, DayState } from './types';
import {
  arenaHeadroom,
  closureFor,
  generateGameSlots,
  indexSlots,
  operatingHoursFor,
  type GeneratedGameSlot,
} from './slots';
import { isReservedTimeReleasedToPublic } from './reserved';
import { splitArenaGroups } from './arena';
import { multiplyMoney, cents, type Cents } from './money';

export interface PublicAvailabilityRequest {
  /** Always passed in. No domain function reads the clock. */
  now: Date;
  date: LocalDateString;
  players: number;
  games: number;
  channel: BookingChannel;
  catalog: Catalog;
  config: EngineConfig;
  dayState: DayState;
}

export interface PublicSlotStatus {
  startMinutes: number;
  startsAtUtc: Date;
  label: string;
  /** The static mode before release is considered. */
  mode: GeneratedGameSlot['mode'];
  /** True when a PARTY_HELD slot has released to the public under R-18. */
  releasedFromParty: boolean;
  available: boolean;
  reason: BookingErrorCode | null;
  /** Seats left in the tightest slot of the block this start would occupy. */
  seatsRemaining: number;
  /** All start times this booking would occupy, e.g. [17:15, 17:30] for 2 games. */
  blockStartMinutes: number[];
}

export interface PublicAvailability {
  date: LocalDateString;
  closed: boolean;
  closedReason: BookingErrorCode | null;
  opensMinutes: number | null;
  closesMinutes: number | null;
  slots: PublicSlotStatus[];
  /** The earliest start a customer can actually take on this date, or null. */
  nextAvailableStartMinutes: number | null;
}

/**
 * R-10 — the 90-minute online cutoff. Reject when `now > startTime - CFG.onlineCutoffMinutes`.
 *
 * Strictly greater-than: `now == startTime - 90min` is ACCEPTED. This reserves the last
 * 90 minutes of every game for the front desk, which is the walk-in protection the manager
 * asked for; it is a policy, not a capacity limit, which is why the manager backend is exempt
 * (R-13, CFG.cutoffAppliesToManager).
 */
export function cutoffPassed(args: {
  now: Date;
  startsAtUtc: Date;
  channel: BookingChannel;
  config: EngineConfig;
}): boolean {
  if (args.channel === 'MANAGER' && !args.config.cutoffAppliesToManager) return false;
  const deadline = args.startsAtUtc.getTime() - args.config.onlineCutoffMinutes * 60_000;
  return args.now.getTime() > deadline;
}

/** The earliest start time a customer could still book online right now, as an instant. */
export function earliestOnlineStart(now: Date, config: EngineConfig): Date {
  return new Date(now.getTime() + config.onlineCutoffMinutes * 60_000);
}

function validateShape(req: PublicAvailabilityRequest): Result<null> {
  if (!Number.isInteger(req.players) || req.players < 1) {
    return reject('INVALID_PLAYER_COUNT');
  }
  if (!Number.isInteger(req.games) || req.games < 1 || req.games > req.config.maxGamesPerPublicBooking) {
    return reject(
      'INVALID_GAME_COUNT',
      `Choose between 1 and ${req.config.maxGamesPerPublicBooking} games.`,
      { maxGames: req.config.maxGamesPerPublicBooking },
    );
  }
  return ok(null);
}

/**
 * R-09 — the start times a booking of N games occupies. With
 * CFG.publicGamesMustBeConsecutive, that is T, T+15, ... T+15(N-1); every one of them must
 * independently pass the slot and arena checks.
 */
export function blockStartsFor(startMinutes: number, games: number, config: EngineConfig): number[] {
  if (!config.publicGamesMustBeConsecutive) return [startMinutes];
  return Array.from({ length: games }, (_, i) => startMinutes + i * config.gameIntervalMinutes);
}

/** Why a single slot is or is not bookable by the public, ignoring the rest of the block. */
function evaluateSlot(
  slot: GeneratedGameSlot,
  req: PublicAvailabilityRequest,
): { available: boolean; reason: BookingErrorCode | null; released: boolean } {
  const { config, catalog, dayState, now, channel } = req;

  if (slot.mode === 'BLOCKED') return { available: false, reason: 'SLOT_UNAVAILABLE', released: false };

  if (slot.mode === 'PARTY_ONLY') {
    // R-19: never releases, on any lead time. Occupancy and headroom are irrelevant.
    return { available: false, reason: 'PARTY_ONLY_WINDOW', released: false };
  }

  let released = false;
  if (slot.mode === 'PARTY_HELD') {
    const decision = isReservedTimeReleasedToPublic({
      now,
      date: slot.date,
      startMinutes: slot.startMinutes,
      startsAtUtc: slot.startsAtUtc,
      isPartyOnly: false,
      catalog,
      dayState,
      config,
    });
    released = decision.released;
    if (!released && !config.publicMayJoinPartyHeldSlot) {
      return { available: false, reason: 'SLOT_HELD_FOR_PARTY', released: false };
    }
  }

  // A party's auto-appended games also occupy the slot without being a configured reserved
  // time. They are visible here only through arena occupancy, which is intentional: R-12 is
  // the constraint, and a party of 10 on a 25-seat slot leaves 15 real public seats.
  if (cutoffPassed({ now, startsAtUtc: slot.startsAtUtc, channel, config })) {
    return { available: false, reason: 'ONLINE_CUTOFF', released };
  }

  if (arenaHeadroom(dayState, slot.startMinutes, config) < req.players) {
    return { available: false, reason: 'ARENA_FULL', released };
  }

  return { available: true, reason: null, released };
}

/**
 * The whole availability picture for one date and one specific group size / game count.
 *
 * It is deliberately parameterised by `players` and `games`: a grid rendered without knowing
 * them would show green cells that reject on submit, because "is this time free" is not a
 * property of the time.
 */
export function getPublicAvailability(req: PublicAvailabilityRequest): PublicAvailability {
  const shape = validateShape(req);
  const { catalog, config, date, dayState } = req;
  const closure = closureFor(catalog, date);
  const hours = operatingHoursFor(catalog, date);

  if (closure?.blocksPublic || !hours?.isOpen) {
    return {
      date,
      closed: true,
      closedReason: 'VENUE_CLOSED',
      opensMinutes: hours?.opensMinutes ?? null,
      closesMinutes: hours?.closesMinutes ?? null,
      slots: [],
      nextAvailableStartMinutes: null,
    };
  }

  const slots = generateGameSlots({ date, catalog, config, dayState });
  const index = indexSlots(slots);

  const statuses: PublicSlotStatus[] = slots.map((slot) => {
    const blockStarts = blockStartsFor(slot.startMinutes, req.games, config);
    const base: PublicSlotStatus = {
      startMinutes: slot.startMinutes,
      startsAtUtc: slot.startsAtUtc,
      label: formatClock(slot.startMinutes),
      mode: slot.mode,
      releasedFromParty: false,
      available: false,
      reason: null,
      seatsRemaining: Math.max(0, arenaHeadroom(dayState, slot.startMinutes, config)),
      blockStartMinutes: blockStarts,
    };

    if (!shape.ok) return { ...base, reason: shape.error.code };

    const first = evaluateSlot(slot, req);
    base.releasedFromParty = first.released;
    if (!first.available) return { ...base, reason: first.reason };

    // R-09: the whole consecutive block must work, not just the first game.
    let tightest = arenaHeadroom(dayState, slot.startMinutes, config);
    for (const m of blockStarts.slice(1)) {
      const next = index.get(m);
      if (!next) return { ...base, reason: 'PARTIAL_BLOCK' };
      const laterCheck = evaluateSlot(next, req);
      if (!laterCheck.available) return { ...base, reason: 'PARTIAL_BLOCK' };
      tightest = Math.min(tightest, arenaHeadroom(dayState, m, config));
    }

    return { ...base, available: true, reason: null, seatsRemaining: Math.max(0, tightest) };
  });

  const nextAvailable = statuses.find((s) => s.available)?.startMinutes ?? null;

  return {
    date,
    closed: false,
    closedReason: null,
    opensMinutes: hours.opensMinutes,
    closesMinutes: hours.closesMinutes,
    slots: statuses,
    nextAvailableStartMinutes: nextAvailable,
  };
}

export interface PublicBookingPlan {
  date: LocalDateString;
  games: number;
  players: number;
  /** One entry per arena group (R-14/R-64); a group of <= 25 has exactly one. */
  arenaGroups: { arenaGroupIndex: number; playerCount: number; startMinutes: number[] }[];
  pricePerPersonCents: Cents;
  preTaxSubtotalCents: Cents;
}

/**
 * Server-side validation of a concrete public booking. R-70: the availability API and the
 * booking API both re-validate; a client-side check is a courtesy only.
 */
export function planPublicBooking(
  req: PublicAvailabilityRequest & { startMinutes: number },
): Result<PublicBookingPlan> {
  const shape = validateShape(req);
  if (!shape.ok) return shape;

  const { catalog, config, date, dayState } = req;

  const nowLocalDate = localDateOf(req.now, config.timezone);
  if (date < nowLocalDate) {
    return reject('PAST_DATE', 'That date has already passed. Pick an upcoming date.', { date });
  }

  const closure = closureFor(catalog, date);
  const hours = operatingHoursFor(catalog, date);
  if (closure?.blocksPublic || !hours?.isOpen) {
    return reject(
      'VENUE_CLOSED',
      closure ? `We are closed on ${date}: ${closure.reason}. Pick another date.` : 'We are closed that day. Pick another date.',
      { date },
    );
  }

  const pricing = catalog.gamePricing.find((p) => p.gameCount === req.games);
  if (!pricing) {
    return reject('INVALID_GAME_COUNT', `We only price 1, 2 or 3 games. Choose one of those.`, {
      games: req.games,
    });
  }

  const slots = generateGameSlots({ date, catalog, config, dayState });
  const index = indexSlots(slots);

  // R-14: a public group over the arena cap splits exactly like a party. Each group takes its
  // own consecutive block, immediately after the previous group's, so two groups of one
  // booking never share a slot (R-64).
  const groupSizes = splitArenaGroups(req.players, config);
  const arenaGroups: PublicBookingPlan['arenaGroups'] = [];
  const takenByThisBooking = new Set<number>();
  let cursor = req.startMinutes;

  for (let groupIndex = 0; groupIndex < groupSizes.length; groupIndex += 1) {
    const playerCount = groupSizes[groupIndex];
    const blockStarts = blockStartsFor(cursor, req.games, config);

    for (let i = 0; i < blockStarts.length; i += 1) {
      const startMinutes = blockStarts[i];
      const slot = index.get(startMinutes);
      if (!slot) {
        return reject(
          i === 0 ? 'SLOT_DOES_NOT_EXIST' : 'PARTIAL_BLOCK',
          i === 0
            ? `We do not run a game at ${formatClock(startMinutes)} on that day. Pick a time from the schedule.`
            : `${formatClock(req.startMinutes)} works, but we do not run a game at ${formatClock(startMinutes)} right after it, and ${req.games} games play back to back. Pick a different start time.`,
          { startMinutes, requestedStart: req.startMinutes },
        );
      }
      const check = evaluateSlot({ ...slot }, { ...req, players: playerCount });
      if (!check.available) {
        const headroom = arenaHeadroom(dayState, startMinutes, config);
        return reject(
          i === 0 || check.reason !== 'ARENA_FULL' ? (check.reason as BookingErrorCode) : 'PARTIAL_BLOCK',
          check.reason === 'ONLINE_CUTOFF'
            ? `Online booking closes ${config.onlineCutoffMinutes} minutes before each game. The ${formatClock(startMinutes)} game cannot be booked online now — walk in, or call ${config.venuePhone}.`
            : check.reason === 'ARENA_FULL'
              ? `${formatClock(startMinutes)} has ${Math.max(0, headroom)} seats left and you need ${playerCount}. Pick another time, or reduce the group size.`
              : undefined,
          {
            startMinutes,
            seatsRemaining: Math.max(0, headroom),
            requiredSeats: playerCount,
            phone: config.venuePhone,
          },
        );
      }
      if (takenByThisBooking.has(startMinutes)) {
        return reject(
          'PARTIAL_BLOCK',
          'Your groups would end up in the same game. Pick a different start time.',
          { startMinutes },
        );
      }
      takenByThisBooking.add(startMinutes);
    }

    arenaGroups.push({ arenaGroupIndex: groupIndex, playerCount, startMinutes: blockStarts });
    cursor = blockStarts[blockStarts.length - 1] + config.gameIntervalMinutes;
  }

  const pricePerPerson = cents(pricing.pricePerPersonCents);
  return ok({
    date,
    games: req.games,
    players: req.players,
    arenaGroups,
    pricePerPersonCents: pricePerPerson,
    preTaxSubtotalCents: multiplyMoney(pricePerPerson, req.players),
  });
}
