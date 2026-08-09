/**
 * Capacity override — STRATEGY §4.4, COPY.md §13.5.
 *
 * Two rules from the spec are encoded here rather than in the form, because both are the kind
 * of thing that quietly stops being true when a component is refactored:
 *
 *  1. **The modal restates what is being broken in specific terms.** So this returns the
 *     numbers each sentence needs — `roomMax` and `over`, or `playerCount` and the names of
 *     who else is in that game — not a boolean.
 *  2. **Two limits need a second, explicit confirmation**: the arena cap (a safety limit) and
 *     the age band (it affects another family who already booked). `requiresSecondConfirmation`
 *     is derived from the breach list, so adding a breach kind cannot accidentally skip it.
 *
 * A room double-booking is deliberately **not** overridable (R-13): two parties cannot be in
 * one room, and no reason makes them fit.
 */

export type BreachKind = 'room' | 'arena' | 'age';

export interface RoomBreach {
  kind: 'room';
  roomMax: number;
  guests: number;
  over: number;
}

export interface ArenaBreach {
  kind: 'arena';
  startMinutes: number;
  playerCount: number;
  arenaCapacity: number;
  players: number;
  over: number;
  /** Everyone else already booked into that game — the §4.4 "who else is affected" list. */
  alsoBooked: string[];
}

export interface AgeBreach {
  kind: 'age';
  otherAge: number;
  age: number;
  gap: number;
  ageBand: number;
  otherName: string;
  otherPhone: string;
}

export type Breach = RoomBreach | ArenaBreach | AgeBreach;

export interface OverrideAssessment {
  fits: boolean;
  breaches: Breach[];
  /** Arena and age both need the second confirmation step. Rooms alone do not. */
  requiresSecondConfirmation: boolean;
}

export interface ArenaSlotLoad {
  startMinutes: number;
  /** Players from every OTHER booking on this start time. */
  otherPlayers: number;
  otherNames: string[];
}

export function assessGuestChange(args: {
  guests: number;
  roomCapacity: number;
  arenaCapacity: number;
  /** One entry per game the party plays, with its group's size. */
  slots: readonly (ArenaSlotLoad & { groupPlayers: number })[];
}): OverrideAssessment {
  const breaches: Breach[] = [];

  if (args.guests > args.roomCapacity) {
    breaches.push({
      kind: 'room',
      roomMax: args.roomCapacity,
      guests: args.guests,
      over: args.guests - args.roomCapacity,
    });
  }

  for (const slot of args.slots) {
    const total = slot.otherPlayers + slot.groupPlayers;
    if (total > args.arenaCapacity) {
      breaches.push({
        kind: 'arena',
        startMinutes: slot.startMinutes,
        playerCount: total,
        arenaCapacity: args.arenaCapacity,
        players: slot.groupPlayers,
        over: total - args.arenaCapacity,
        alsoBooked: slot.otherNames,
      });
    }
  }

  return {
    fits: breaches.length === 0,
    breaches,
    requiresSecondConfirmation: breaches.some(
      (breach) => breach.kind === 'arena' || breach.kind === 'age',
    ),
  };
}

/** COPY.md `mg.override.reason.chip1`–`chip5`. A preset still has to be sent as a reason. */
export function isReasonAcceptable(reason: string): boolean {
  return reason.trim().length >= 3;
}

/**
 * The audit line stored on the booking and replayed in the activity feed. Assembled once so
 * the board badge, the booking detail and `/manage/activity` cannot drift apart.
 */
export function overrideSummary(breaches: readonly Breach[], reason: string): string {
  const kinds = [...new Set(breaches.map((breach) => breach.kind))].join(', ');
  return kinds === '' ? reason.trim() : `${kinds}: ${reason.trim()}`;
}
