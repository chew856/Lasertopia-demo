import type { BoardChipState } from '@/components/ui';

import type { ArenaState } from '../_lib/board';

/**
 * The board's wire format: everything the client component needs, already formatted.
 *
 * Every figure is a string because `src/lib/format.ts` is the single implementation of
 * COPY.md §1 and it runs on the server, where the venue's timezone is not in question. A
 * client that receives `1035` and formats it itself is a client that will eventually render
 * a different time than the server did.
 */

export interface RowView {
  id: string;
  timeLabel: string;
  onHour: boolean;
}

export interface ColumnView {
  id: string;
  name: string;
  capacityLabel: string;
}

export interface SlotBookingView {
  bookingId: string;
  reference: string;
  name: string;
  phone: string;
  phoneHref: string;
  playersLabel: string;
  kind: 'games' | 'party';
  /** COPY.md `mg.slot.checkedIn`, already interpolated, or null when not checked in. */
  checkedInLabel: string | null;
}

export interface SlotView {
  rowId: string;
  startMinutes: number;
  timeLabel: string;
  playersUsed: number;
  capacity: number;
  /** `mg.board.capacity` — "14 / 25". */
  capacityLabel: string;
  state: ArenaState;
  chipState: BoardChipState;
  /** The literal uppercase word. Colour is never the only cue. */
  stateWord: string;
  markers: string[];
  isPast: boolean;
  isReserved: boolean;
  blocked: { reason: string; byLabel: string | null } | null;
  bookings: SlotBookingView[];
  a11yLabel: string;
}

export interface PartyView {
  bookingId: string;
  reference: string;
  honoree: string;
  age: number;
  guests: number;
  headingLabel: string;
  packageLabel: string;
  gamesLabel: string;
  organiserLabel: string;
  phoneHref: string;
  allergyLabel: string | null;
  windowLabel: string;
  depositRecorded: boolean;
  depositLabel: string;
  overrideLabel: string | null;
  isNew: boolean;
}

export interface ChipView {
  id: string;
  columnId: string;
  rowId: string;
  span: number;
  bookingId: string;
  state: BoardChipState;
  name: string;
  countLabel: string;
  a11yLabel: string;
}

export interface StatsView {
  arrivals: { bookingId: string; label: string; detail: string }[];
  partyCount: number;
  depositCount: number;
  allergyCount: number;
  allergies: { bookingId: string; label: string }[];
  overrideCount: number;
  newBookingIds: string[];
}

export interface BoardView {
  date: string;
  dateLabel: string;
  isToday: boolean;
  todayIso: string;
  previousDate: string;
  nextDate: string;
  gridLabel: string;
  columns: ColumnView[];
  rows: RowView[];
  slots: SlotView[];
  chips: ChipView[];
  parties: PartyView[];
  now: { rowId: string; label: string } | null;
  stats: StatsView;
  closed: { reason: string } | null;
  generatedAtMs: number;
  /** Block-range picker options: every real game start on the date. */
  blockRangeOptions: { value: number; label: string }[];
}
