import Link from 'next/link';

import {
  Eyebrow,
  EmptyState,
  Hairline,
  MonoValue,
  PageShell,
  Tag,
  buttonClassName,
} from '@/components/ui';
import { prisma } from '@/lib/db/client';
import { interpolate } from '@/lib/copy';
import { manager } from '@/lib/copy/manager';
import { addDays, closureFor, dayOfWeekFor, type Catalog } from '@/lib/domain';
import { formatCount, formatDayNumber, formatMonth, formatWeekday } from '@/lib/format';

import { summariseWeek } from '../_lib/board';
import { BOOKING_INCLUDE } from '../_lib/catalog';

/**
 * Week view — STRATEGY §4.1: "a compressed 7-column read-only overview for planning
 * ('is the 22nd heavy?'), with a tap to open a day. All actions live in Day view."
 *
 * Read-only is enforced structurally, not by discipline: this is a Server Component with no
 * client boundary and no action imported, so there is nothing here that could mutate.
 *
 * The load bar is a width, and every column also prints its real figures — a bar that is the
 * only carrier of "heavy" is unreadable to a colour-blind manager and meaningless in a
 * screen reader.
 */

const { mg, empty } = manager;

const WEEK_LENGTH = 7;

export async function WeekView({
  anchorDate,
  todayIso,
  catalog,
}: {
  anchorDate: string;
  todayIso: string;
  catalog: Catalog;
}) {
  const weekStart = addDays(anchorDate, -dayOfWeekFor(anchorDate));
  const dates = Array.from({ length: WEEK_LENGTH }, (_, index) => addDays(weekStart, index));
  const weekEnd = dates[dates.length - 1];

  const bookings = await prisma.booking.findMany({
    where: { date: { in: dates } },
    include: BOOKING_INCLUDE,
  });

  const days = summariseWeek(
    dates.map((date) => {
      const onDate = bookings.filter((booking) => booking.date === date);
      return {
        date,
        closed: closureFor(catalog, date) !== null,
        parties: onDate
          .filter((booking) => booking.party !== null)
          .map((booking) => ({
            bookingId: booking.id,
            reference: booking.reference,
            status: booking.status,
            honoreeName: booking.party?.honoreeName ?? '',
            honoreeAge: booking.party?.honoreeAge ?? 0,
            guestCount: booking.party?.guestCount ?? 0,
            packageName: '',
            roomIds: [],
            roomNames: [],
            windowStartMinutes: booking.party?.partyWindow.startMinutes ?? 0,
            windowEndMinutes: booking.party?.partyWindow.endMinutes ?? 0,
            windowLabel: '',
            gameStartMinutes: [],
            depositRecorded: booking.deposit?.status === 'RECORDED',
            allergyNotes: booking.notes ?? '',
            organiserName: booking.customerName,
            organiserPhone: booking.customerPhone,
            overrideReason: booking.overrideReason,
            createdAtMs: booking.createdAt.getTime(),
          })),
        games: onDate
          .filter((booking) => booking.party === null)
          .map((booking) => ({
            bookingId: booking.id,
            reference: booking.reference,
            status: booking.status,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            playerCount: booking.publicGame?.playerCount ?? 0,
            startMinutes: [],
            overrideReason: booking.overrideReason,
            createdAtMs: booking.createdAt.getTime(),
          })),
      };
    }),
  );

  const nothing = days.every((day) => day.partyCount === 0 && day.gameBookingCount === 0);

  return (
    <PageShell width="board" className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-display-3 text-text">
          {interpolate(mg.board.week.heading, { dateIso: weekStart })}
        </h1>
        <div className="flex items-center gap-1">
          <Link
            href={`/manage/schedule?date=${addDays(weekStart, -WEEK_LENGTH)}&view=week`}
            aria-label={mg.board.prevDay}
            className={buttonClassName('compact')}
          >
            ◀
          </Link>
          <Link
            href={`/manage/schedule?date=${todayIso}&view=week`}
            className={buttonClassName('compact')}
          >
            {mg.board.today}
          </Link>
          <Link
            href={`/manage/schedule?date=${addDays(weekStart, WEEK_LENGTH)}&view=week`}
            aria-label={mg.board.nextDay}
            className={buttonClassName('compact')}
          >
            ▶
          </Link>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label={mg.board.title}>
          <Link
            href={`/manage/schedule?date=${anchorDate}`}
            className={buttonClassName('compact')}
          >
            {mg.board.view.day}
          </Link>
          <span
            aria-current="true"
            className={`${buttonClassName('compact')} border-accent text-accent`}
          >
            {mg.board.view.week}
          </span>
        </div>
      </div>

      <p className="mt-2 text-body-sm text-text-2">{mg.board.week.readOnly}</p>

      {nothing ? (
        <div className="mt-4">
          <EmptyState
            title={empty.week.nothing.title}
            body={interpolate(empty.week.nothing.body, { from: weekStart, to: weekEnd })}
            action={
              <Link
                href={`/manage/schedule?date=${todayIso}&view=week`}
                className={buttonClassName('secondary')}
              >
                {empty.week.nothing.action}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-px border border-rule bg-rule md:grid-cols-7">
          {days.map((day) => (
            <section key={day.date} className="flex flex-col gap-2 bg-canvas p-3">
              <header>
                <Eyebrow as="h2">{formatWeekday(day.date, 'short')}</Eyebrow>
                <p className="flex items-baseline gap-2">
                  <MonoValue step="lg" className="text-text">
                    {formatDayNumber(day.date)}
                  </MonoValue>
                  <span className="text-caption text-text-3">{formatMonth(day.date)}</span>
                </p>
              </header>

              <Hairline />

              {day.closed ? <Tag tone="blocked">{mg.board.marker.blocked}</Tag> : null}

              <dl className="flex flex-col gap-1 text-body-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-2">{mg.board.header.parties}</dt>
                  <dd>
                    <MonoValue step="sm" className="text-text">
                      {day.partyCount}
                    </MonoValue>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-2">{mg.add.type.games}</dt>
                  <dd>
                    <MonoValue step="sm" className="text-text">
                      {day.gameBookingCount}
                    </MonoValue>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-2">{mg.settings.arenaCap.unit}</dt>
                  <dd>
                    <MonoValue step="sm" className="text-text">
                      {day.playerCount}
                    </MonoValue>
                  </dd>
                </div>
              </dl>

              {/* The bar is a second reading of `playerCount`, never the only one. */}
              <div className="h-1 w-full bg-rule" aria-hidden="true">
                <div
                  className="h-1 bg-accent"
                  style={{ width: `${Math.round(day.loadRatio * 100)}%` }}
                />
              </div>
              <span className="sr-only">{formatCount(day.playerCount, 'player')}</span>

              <Link
                href={`/manage/schedule?date=${day.date}`}
                className={`${buttonClassName('compact')} mt-auto`}
              >
                {interpolate(mg.board.week.openDay, { dateIso: day.date })}
              </Link>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
