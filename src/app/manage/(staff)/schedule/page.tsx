import type { Metadata } from 'next';

import { interpolate } from '@/lib/copy';
import { manager } from '@/lib/copy/manager';
import {
  addDays,
  closureFor,
  generateGameSlots,
  partyWindowsFor,
  type LocalDateString,
} from '@/lib/domain';
import {
  formatCount,
  formatDateLong,
  formatMoney,
  formatPhone,
  formatPhoneHref,
  formatTime,
  formatTimeList,
  formatTimeRange,
  unitLabel,
  venueDateOf,
  venueMinutesOf,
} from '@/lib/format';

import { BoardView } from '../../_components/board-view';
import { WeekView } from '../../_components/week-view';
import type { ChipView, PartyView, SlotView } from '../../_components/board-types';
import { checkInStateFor } from '../../_lib/audit';
import { parseBlockMeta } from '../../_lib/blocks';
import { buildArenaLane, buildRoomChips, buildRows, boardSpan, rowId, summariseShift } from '../../_lib/board';
import {
  loadBlockedMinutes,
  loadBlocks,
  loadBookingsOn,
  loadCatalog,
  loadConfig,
  toDayState,
  type BookingWithDetail,
} from '../../_lib/catalog';

/**
 * `/manage/schedule` — the board. STRATEGY §4.1.
 *
 * The centre of gravity: Priya lands here, works the whole shift here, and every action
 * returns here. The server does all the computing and all the formatting; the client
 * component owns selection, the 25-second refresh and the undo toast, and nothing else.
 */

export const metadata: Metadata = { title: manager.mg.board.title };
export const dynamic = 'force-dynamic';

const { mg, empty, TODO_COPY } = manager;

/** Bookings taken after this instant are "new this shift" and get the `NEW` badge. */
const SHIFT_LENGTH_MS = 8 * 60 * 60 * 1000;
const ARRIVAL_LIMIT = 3;

function isoDate(value: string | undefined, fallback: LocalDateString): LocalDateString {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function partyInputsFrom(bookings: readonly BookingWithDetail[], roomNameById: Map<string, string>) {
  return bookings
    .filter((booking) => booking.party !== null)
    .map((booking) => {
      const party = booking.party!;
      const roomIds =
        booking.roomSlots.length > 0 ? booking.roomSlots.map((slot) => slot.roomId) : [];
      return {
        bookingId: booking.id,
        reference: booking.reference,
        status: booking.status,
        honoreeName: party.honoreeName,
        honoreeAge: party.honoreeAge,
        guestCount: party.guestCount,
        packageName: party.packageRef.name,
        roomIds,
        roomNames: roomIds.map((id) => roomNameById.get(id) ?? id),
        windowStartMinutes: party.partyWindow.startMinutes,
        windowEndMinutes: party.partyWindow.endMinutes,
        windowLabel: formatTimeRange(party.partyWindow.startMinutes, party.partyWindow.endMinutes),
        gameStartMinutes: booking.games.map((game) => game.gameSlot.startMinutes),
        depositRecorded: booking.deposit?.status === 'RECORDED' || booking.deposit?.status === 'APPLIED',
        allergyNotes: booking.notes ?? '',
        organiserName: booking.customerName,
        organiserPhone: booking.customerPhone,
        overrideReason: booking.overrideReason,
        createdAtMs: booking.createdAt.getTime(),
      };
    });
}

function gameInputsFrom(bookings: readonly BookingWithDetail[]) {
  return bookings
    .filter((booking) => booking.party === null)
    .map((booking) => ({
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      playerCount: booking.publicGame?.playerCount ?? 0,
      startMinutes: booking.games.map((game) => game.gameSlot.startMinutes),
      overrideReason: booking.overrideReason,
      createdAtMs: booking.createdAt.getTime(),
    }));
}

/** Phone numbers in the database may be any shape; a bad one must not blank the board. */
function safePhone(raw: string): { display: string; href: string } {
  try {
    return { display: formatPhone(raw), href: formatPhoneHref(raw) };
  } catch {
    return { display: raw, href: '' };
  }
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();

  const config = await loadConfig();
  const todayIso = venueDateOf(now);
  const date = isoDate(typeof params.date === 'string' ? params.date : undefined, todayIso);
  const view = params.view === 'week' ? 'week' : 'day';

  const catalog = await loadCatalog();

  if (view === 'week') {
    return <WeekView anchorDate={date} todayIso={todayIso} catalog={catalog} />;
  }

  const [bookings, blockedMinutes] = await Promise.all([
    loadBookingsOn(date),
    loadBlockedMinutes(date),
  ]);
  const dayState = toDayState(date, bookings, blockedMinutes, catalog);

  const roomNameById = new Map(catalog.rooms.map((room) => [room.id, room.name]));
  const parties = partyInputsFrom(bookings, roomNameById);
  const games = gameInputsFrom(bookings);

  const slots = generateGameSlots({ date, catalog, config, dayState });
  const windows = partyWindowsFor(catalog, date);
  const span = boardSpan(
    slots.map((slot) => slot.startMinutes),
    windows,
    config.gameIntervalMinutes,
  );
  const rows = span ? buildRows(span.fromMinutes, span.toMinutes, config.gameIntervalMinutes) : [];

  const nowMinutes = date === todayIso ? venueMinutesOf(now) : null;
  const arena = buildArenaLane({
    slots,
    parties,
    games,
    arenaCapacity: config.arenaCapacity,
    nowMinutes,
  });
  const roomChips = buildRoomChips(parties, rows);
  const stats = summariseShift({
    parties,
    games,
    nowMinutes,
    shiftStartedAtMs: now.getTime() - SHIFT_LENGTH_MS,
    arrivalLimit: ARRIVAL_LIMIT,
  });

  const checkIns = await checkInStateFor(bookings.map((booking) => booking.id));

  const blockedBySlot = new Map(
    (await loadBlocks(date)).map((row) => [row.startMinutes, parseBlockMeta(row.blockedReason)]),
  );

  const slotViews: SlotView[] = arena.map((slot) => {
    const meta = blockedBySlot.get(slot.startMinutes);
    const timeLabel = formatTime(slot.startMinutes);
    const capacityLabel = interpolate(mg.board.capacity, {
      playerCount: slot.playersUsed,
      arenaCap: slot.capacity,
    });
    return {
      rowId: slot.rowId,
      startMinutes: slot.startMinutes,
      timeLabel,
      playersUsed: slot.playersUsed,
      capacity: slot.capacity,
      capacityLabel,
      state: slot.state,
      chipState: slot.state === 'open' ? 'confirmed' : slot.state,
      stateWord: slot.state === 'open' ? TODO_COPY.slotOpen : slot.stateWord,
      markers: slot.markers,
      isPast: slot.isPast,
      isReserved: slot.mode === 'PARTY_HELD' || slot.mode === 'PARTY_ONLY',
      blocked:
        slot.mode === 'BLOCKED'
          ? {
              reason: meta?.reason
                ? interpolate(mg.slot.blocked.reason, { notes: meta.reason })
                : mg.slot.blocked.noReason,
              byLabel:
                meta?.byName && meta.atIso
                  ? interpolate(mg.slot.blocked.by, {
                      staffName: meta.byName,
                      time: formatTime(venueMinutesOf(new Date(meta.atIso))),
                    })
                  : null,
            }
          : null,
      bookings: slot.bookings.map((booking) => {
        const phone = safePhone(booking.phone);
        const checkedInAt = checkIns.get(booking.bookingId);
        return {
          bookingId: booking.bookingId,
          reference: booking.reference,
          name: booking.name,
          phone: phone.display,
          phoneHref: phone.href,
          playersLabel: interpolate(mg.slot.bookings.row, {
            name: booking.name,
            players: booking.players,
            // COPY.md §1.1 spells the unit noun in exactly one place; never inline it.
            unit: unitLabel(booking.players, booking.kind === 'party' ? 'guest' : 'player'),
            code: booking.reference,
          }),
          kind: booking.kind,
          checkedInLabel: checkedInAt
            ? interpolate(mg.slot.checkedIn, { time: formatTime(venueMinutesOf(checkedInAt)) })
            : null,
        };
      }),
      a11yLabel: `${timeLabel}, ${mg.board.lane.arena}, ${capacityLabel}, ${slot.stateWord}`,
    };
  });

  const partyById = new Map(parties.map((party) => [party.bookingId, party]));
  const partyViews: PartyView[] = parties.map((party) => {
    const phone = safePhone(party.organiserPhone);
    return {
      bookingId: party.bookingId,
      reference: party.reference,
      honoree: party.honoreeName,
      age: party.honoreeAge,
      guests: party.guestCount,
      headingLabel: interpolate(mg.party.heading, {
        honoree: party.honoreeName,
        age: party.honoreeAge,
        guests: party.guestCount,
      }),
      packageLabel: interpolate(mg.party.package, {
        packageName: party.packageName,
        roomNames: party.roomNames.join(' + ') || '—',
      }),
      gamesLabel:
        party.gameStartMinutes.length > 0
          ? interpolate(mg.party.games, { gameTimes: formatTimeList(party.gameStartMinutes) })
          : interpolate(mg.party.games, { gameTimes: '—' }),
      organiserLabel: interpolate(mg.party.organiser, {
        name: party.organiserName,
        phone: phone.display,
      }),
      phoneHref: phone.href,
      allergyLabel: party.allergyNotes.trim()
        ? interpolate(mg.party.allergyFlag, { notes: party.allergyNotes.trim() })
        : null,
      windowLabel: party.windowLabel,
      depositRecorded: party.depositRecorded,
      depositLabel: party.depositRecorded
        ? interpolate(mg.toast.depositRecorded, {
            deposit: formatMoney(config.depositAmountCents),
            honoree: party.honoreeName,
          })
        : mg.booking.deposit.status.pending,
      overrideLabel: party.overrideReason
        ? interpolate(mg.override.badge.detail, {
            staffName: mg.board.marker.override,
            notes: party.overrideReason,
          })
        : null,
      isNew: stats.newBookingIds.includes(party.bookingId),
    };
  });

  const chips: ChipView[] = roomChips.map((chip) => {
    const party = partyById.get(chip.bookingId);
    const name = party ? `${party.honoreeName} · ${party.packageName}` : chip.bookingId;
    const countLabel = party ? formatCount(party.guestCount, 'guest') : '';
    return {
      id: chip.id,
      columnId: chip.roomId,
      rowId: chip.rowId,
      span: chip.span,
      bookingId: chip.bookingId,
      state: chip.state,
      name,
      countLabel,
      a11yLabel: [
        party?.windowLabel ?? '',
        roomNameById.get(chip.roomId) ?? chip.roomId,
        name,
        countLabel,
        mg.board.marker.party,
        chip.hasAllergy ? manager.sheet.allergies.label : '',
        chip.depositOutstanding ? mg.bookings.filter.status.pending : '',
      ]
        .filter(Boolean)
        .join(', '),
    };
  });

  const closure = closureFor(catalog, date);

  return (
    <BoardView
      data={{
        date,
        dateLabel: formatDateLong(date, { currentYear: Number(todayIso.slice(0, 4)) }),
        isToday: date === todayIso,
        todayIso,
        previousDate: addDays(date, -1),
        nextDate: addDays(date, 1),
        gridLabel: interpolate(TODO_COPY.boardGridLabel, { dateIso: date }),
        columns: catalog.rooms
          .filter((room) => room.isActive)
          .map((room) => ({
            id: room.id,
            name: room.name,
            capacityLabel: interpolate(mg.board.lane.roomCap, { roomMax: room.capacity }),
          })),
        rows: rows.map((row) => ({
          id: row.id,
          timeLabel: formatTime(row.startMinutes),
          onHour: row.onHour,
        })),
        slots: slotViews,
        chips,
        parties: partyViews,
        now:
          nowMinutes !== null && rows.length > 0
            ? {
                rowId: rowId(
                  rows.reduce(
                    (best, row) => (row.startMinutes <= nowMinutes ? row.startMinutes : best),
                    rows[0].startMinutes,
                  ),
                ),
                label: formatTime(nowMinutes),
              }
            : null,
        stats: {
          arrivals: stats.arrivals.map((arrival) => ({
            bookingId: arrival.bookingId,
            label: `${formatTime(arrival.startMinutes)} · ${arrival.name}`,
            detail: arrival.detail,
          })),
          partyCount: stats.partyCount,
          depositCount: stats.depositsOutstanding.length,
          allergyCount: stats.allergyFlags.length,
          allergies: stats.allergyFlags.map((flag) => ({
            bookingId: flag.bookingId,
            label: `${flag.honoree} — ${flag.notes}`,
          })),
          overrideCount: stats.overrideCount,
          newBookingIds: stats.newBookingIds,
        },
        closed: closure ? { reason: closure.reason } : null,
        generatedAtMs: now.getTime(),
        blockRangeOptions: slots.map((slot) => ({
          value: slot.startMinutes,
          label: formatTime(slot.startMinutes),
        })),
      }}
      emptyCopy={{
        title: empty.board.noBookings.title,
        body: interpolate(empty.board.noBookings.body, { dateIso: date }),
        closedTitle: interpolate(empty.board.closed.title, { dateIso: date }),
        closedBody: empty.board.closed.body,
        closedAction: empty.board.closed.action,
      }}
      arenaCapacityLabel={interpolate(mg.board.lane.arenaCap, { arenaCap: config.arenaCapacity })}
    />
  );
}
