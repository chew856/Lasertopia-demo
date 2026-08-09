import type { GameSlotMode } from '@/lib/domain';

/**
 * The schedule board's model — STRATEGY §4.1, computed as pure functions over plain data.
 *
 * Nothing here touches Prisma, React or the clock: `nowMinutes` arrives as a parameter, the
 * same discipline the domain engine keeps, and for the same reason — "is 5:15 PM in the past"
 * is the sort of rule that is untestable the moment a module reads `Date.now()` itself.
 *
 * The one non-obvious decision is the time axis. STRATEGY calls for "a grid running the day's
 * operating span" *and* "one row per 15-minute game start", and on a weekend those are not the
 * same list: Saturday has games at 10:15–11:00, then nothing until 12:00, while the 10:00–12:00
 * party window covers the gap. So rows are a continuous 15-minute tick across the whole span,
 * and only the ticks that are real game starts carry an arena slot. A party block then spans
 * its true window instead of being clipped to the games inside it, which is the physical truth
 * a manager is actually managing.
 */

// ─── Inputs ──────────────────────────────────────────────────────────────────────────────

export interface BoardPartyInput {
  bookingId: string;
  reference: string;
  status: string;
  honoreeName: string;
  honoreeAge: number;
  guestCount: number;
  packageName: string;
  roomIds: string[];
  roomNames: string[];
  windowStartMinutes: number;
  windowEndMinutes: number;
  windowLabel: string;
  gameStartMinutes: number[];
  depositRecorded: boolean;
  /** Free text from the organiser. Empty string means "nothing recorded", not "unknown". */
  allergyNotes: string;
  organiserName: string;
  organiserPhone: string;
  overrideReason: string | null;
  createdAtMs: number;
}

export interface BoardGameInput {
  bookingId: string;
  reference: string;
  status: string;
  customerName: string;
  customerPhone: string;
  playerCount: number;
  startMinutes: number[];
  overrideReason: string | null;
  createdAtMs: number;
}

export interface BoardRoomInput {
  id: string;
  name: string;
  capacity: number;
}

// ─── Rows ────────────────────────────────────────────────────────────────────────────────

export interface BoardTimeRow {
  id: string;
  startMinutes: number;
  onHour: boolean;
}

export function rowId(startMinutes: number): string {
  return `t${startMinutes}`;
}

/** Inclusive of `fromMinutes`, exclusive of `toMinutes`. */
export function buildRows(
  fromMinutes: number,
  toMinutes: number,
  intervalMinutes: number,
): BoardTimeRow[] {
  if (intervalMinutes <= 0 || toMinutes <= fromMinutes) return [];
  const rows: BoardTimeRow[] = [];
  for (let minutes = fromMinutes; minutes < toMinutes; minutes += intervalMinutes) {
    rows.push({ id: rowId(minutes), startMinutes: minutes, onHour: minutes % 60 === 0 });
  }
  return rows;
}

/**
 * The span the axis has to cover: every game start on the date and every party window on it,
 * rounded out to whole interval ticks. Returns null when the date has neither.
 */
export function boardSpan(
  gameStartMinutes: readonly number[],
  windows: readonly { startMinutes: number; endMinutes: number }[],
  intervalMinutes: number,
): { fromMinutes: number; toMinutes: number } | null {
  const starts = [...gameStartMinutes, ...windows.map((w) => w.startMinutes)];
  const ends = [
    ...gameStartMinutes.map((m) => m + intervalMinutes),
    ...windows.map((w) => w.endMinutes),
  ];
  if (starts.length === 0 || ends.length === 0) return null;
  const from = Math.floor(Math.min(...starts) / intervalMinutes) * intervalMinutes;
  const to = Math.ceil(Math.max(...ends) / intervalMinutes) * intervalMinutes;
  return { fromMinutes: from, toMinutes: to };
}

// ─── The arena lane ──────────────────────────────────────────────────────────────────────

/** The state word is the carrier; colour is never the only cue (DESIGN principle 3). */
export type ArenaState = 'open' | 'filling' | 'full' | 'party' | 'blocked';

export type ArenaMarker = 'PARTY' | 'BLOCKED' | 'OVERRIDE' | 'PAST';

export interface ArenaSlotModel {
  rowId: string;
  startMinutes: number;
  playersUsed: number;
  capacity: number;
  mode: GameSlotMode;
  state: ArenaState;
  /** The literal uppercase word rendered beside the figure. */
  stateWord: string;
  markers: ArenaMarker[];
  isPast: boolean;
  bookings: {
    bookingId: string;
    reference: string;
    name: string;
    phone: string;
    players: number;
    kind: 'games' | 'party';
  }[];
}

/**
 * Precedence is deliberate and is the order a manager reads the row in:
 * blocked beats everything (nothing can be sold), a full arena beats a party marker (the
 * constraint that will bite next), and only then the structural party hold.
 */
export function arenaState(args: {
  playersUsed: number;
  capacity: number;
  mode: GameSlotMode;
}): { state: ArenaState; stateWord: string } {
  if (args.mode === 'BLOCKED') return { state: 'blocked', stateWord: 'BLOCKED' };
  if (args.capacity > 0 && args.playersUsed >= args.capacity) {
    return { state: 'full', stateWord: 'FULL' };
  }
  if (args.mode === 'PARTY_ONLY' || args.mode === 'PARTY_HELD') {
    return { state: 'party', stateWord: 'PARTY' };
  }
  if (args.playersUsed > 0) return { state: 'filling', stateWord: 'FILLING' };
  return { state: 'open', stateWord: 'OPEN' };
}

export function buildArenaLane(args: {
  slots: readonly { startMinutes: number; mode: GameSlotMode }[];
  parties: readonly BoardPartyInput[];
  games: readonly BoardGameInput[];
  arenaCapacity: number;
  nowMinutes: number | null;
}): ArenaSlotModel[] {
  const { slots, parties, games, arenaCapacity, nowMinutes } = args;

  return slots.map((slot) => {
    const bookings: ArenaSlotModel['bookings'] = [];
    let playersUsed = 0;
    let overridden = false;

    for (const game of games) {
      if (!game.startMinutes.includes(slot.startMinutes)) continue;
      playersUsed += game.playerCount;
      overridden = overridden || game.overrideReason !== null;
      bookings.push({
        bookingId: game.bookingId,
        reference: game.reference,
        name: game.customerName,
        phone: game.customerPhone,
        players: game.playerCount,
        kind: 'games',
      });
    }
    for (const party of parties) {
      if (!party.gameStartMinutes.includes(slot.startMinutes)) continue;
      playersUsed += party.guestCount;
      overridden = overridden || party.overrideReason !== null;
      bookings.push({
        bookingId: party.bookingId,
        reference: party.reference,
        name: party.honoreeName,
        phone: party.organiserPhone,
        players: party.guestCount,
        kind: 'party',
      });
    }

    const { state, stateWord } = arenaState({ playersUsed, capacity: arenaCapacity, mode: slot.mode });
    const isPast = nowMinutes !== null && slot.startMinutes < nowMinutes;

    const markers: ArenaMarker[] = [];
    if (slot.mode === 'PARTY_HELD' || slot.mode === 'PARTY_ONLY') markers.push('PARTY');
    if (slot.mode === 'BLOCKED') markers.push('BLOCKED');
    if (overridden) markers.push('OVERRIDE');
    if (isPast) markers.push('PAST');

    return {
      rowId: rowId(slot.startMinutes),
      startMinutes: slot.startMinutes,
      playersUsed,
      capacity: arenaCapacity,
      mode: slot.mode,
      state,
      stateWord,
      markers,
      isPast,
      bookings,
    };
  });
}

// ─── Room lanes ──────────────────────────────────────────────────────────────────────────

export interface RoomChipModel {
  id: string;
  roomId: string;
  rowId: string;
  span: number;
  bookingId: string;
  state: 'party' | 'blocked';
  hasAllergy: boolean;
  depositOutstanding: boolean;
}

/**
 * One chip per (party, room). `ScheduleBoard` keys chips by cell, so a party across two rooms
 * is two adjacent chips rather than one object spanning two columns — the component has no
 * column span. The pairing still reads as one party because both chips carry the same label
 * and the same start row.
 */
export function buildRoomChips(
  parties: readonly BoardPartyInput[],
  rows: readonly BoardTimeRow[],
): RoomChipModel[] {
  if (rows.length === 0) return [];
  const chips: RoomChipModel[] = [];

  for (const party of parties) {
    const covered = rows.filter(
      (row) => row.startMinutes >= party.windowStartMinutes && row.startMinutes < party.windowEndMinutes,
    );
    if (covered.length === 0) continue;

    for (const roomId of party.roomIds) {
      chips.push({
        id: `${party.bookingId}:${roomId}`,
        roomId,
        rowId: covered[0].id,
        span: covered.length,
        bookingId: party.bookingId,
        state: 'party',
        hasAllergy: party.allergyNotes.trim() !== '',
        depositOutstanding: !party.depositRecorded,
      });
    }
  }

  return chips;
}

// ─── The header strip — the shift dashboard ──────────────────────────────────────────────

export interface ArrivalModel {
  bookingId: string;
  startMinutes: number;
  name: string;
  kind: 'games' | 'party';
  detail: string;
}

export interface ShiftStats {
  arrivals: ArrivalModel[];
  partyCount: number;
  depositsOutstanding: { bookingId: string; honoree: string; startMinutes: number }[];
  allergyFlags: { bookingId: string; honoree: string; notes: string }[];
  overrideCount: number;
  /** Bookings created since this instant get the `NEW` badge. */
  newBookingIds: string[];
}

const CANCELLED = 'CANCELLED';

export function summariseShift(args: {
  parties: readonly BoardPartyInput[];
  games: readonly BoardGameInput[];
  nowMinutes: number | null;
  /** Anything created after this instant arrived during the shift. */
  shiftStartedAtMs: number;
  arrivalLimit: number;
}): ShiftStats {
  const { parties, games, nowMinutes, shiftStartedAtMs, arrivalLimit } = args;
  const liveParties = parties.filter((p) => p.status !== CANCELLED);
  const liveGames = games.filter((g) => g.status !== CANCELLED);

  const arrivals: ArrivalModel[] = [
    ...liveParties.map((party) => ({
      bookingId: party.bookingId,
      startMinutes: party.windowStartMinutes,
      name: party.honoreeName,
      kind: 'party' as const,
      detail: party.windowLabel,
    })),
    ...liveGames.map((game) => ({
      bookingId: game.bookingId,
      startMinutes: Math.min(...game.startMinutes),
      name: game.customerName,
      kind: 'games' as const,
      detail: game.reference,
    })),
  ]
    .filter((arrival) => nowMinutes === null || arrival.startMinutes >= nowMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .slice(0, arrivalLimit);

  return {
    arrivals,
    partyCount: liveParties.length,
    depositsOutstanding: liveParties
      .filter((party) => !party.depositRecorded)
      .map((party) => ({
        bookingId: party.bookingId,
        honoree: party.honoreeName,
        startMinutes: party.windowStartMinutes,
      })),
    allergyFlags: liveParties
      .filter((party) => party.allergyNotes.trim() !== '')
      .map((party) => ({
        bookingId: party.bookingId,
        honoree: party.honoreeName,
        notes: party.allergyNotes.trim(),
      })),
    overrideCount:
      liveParties.filter((p) => p.overrideReason !== null).length +
      liveGames.filter((g) => g.overrideReason !== null).length,
    newBookingIds: [...liveParties, ...liveGames]
      .filter((booking) => booking.createdAtMs >= shiftStartedAtMs)
      .map((booking) => booking.bookingId),
  };
}

// ─── Week view ───────────────────────────────────────────────────────────────────────────

export interface WeekDayModel {
  date: string;
  partyCount: number;
  gameBookingCount: number;
  playerCount: number;
  closed: boolean;
  /** Heaviest day in the week gets the reference bar; the rest are drawn relative to it. */
  loadRatio: number;
}

export function summariseWeek(
  days: readonly {
    date: string;
    closed: boolean;
    parties: readonly BoardPartyInput[];
    games: readonly BoardGameInput[];
  }[],
): WeekDayModel[] {
  const raw = days.map((day) => {
    const liveParties = day.parties.filter((p) => p.status !== CANCELLED);
    const liveGames = day.games.filter((g) => g.status !== CANCELLED);
    return {
      date: day.date,
      closed: day.closed,
      partyCount: liveParties.length,
      gameBookingCount: liveGames.length,
      playerCount:
        liveParties.reduce((total, p) => total + p.guestCount, 0) +
        liveGames.reduce((total, g) => total + g.playerCount, 0),
    };
  });

  const peak = Math.max(1, ...raw.map((day) => day.playerCount));
  return raw.map((day) => ({ ...day, loadRatio: day.playerCount / peak }));
}
