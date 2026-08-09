import type { Metadata } from 'next';
import Link from 'next/link';

import {
  Eyebrow,
  EmptyState,
  Hairline,
  MonoValue,
  PageShell,
  Tag,
  buttonClassName,
  cx,
} from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { global } from '@/lib/copy/global';
import { manager } from '@/lib/copy/manager';
import { prisma } from '@/lib/db/client';
import {
  formatCount,
  formatDateShort,
  formatMoney,
  formatPhoneHref,
  formatTime,
  venueDateOf,
} from '@/lib/format';

import { BOOKING_INCLUDE, loadConfig, type BookingWithDetail } from '../../_lib/catalog';
import {
  compareBookings,
  isPendingDeposit,
  matchesQuery,
  parseQuery,
  parseStatusFilter,
  parseTypeFilter,
  statusesFor,
} from '../../_lib/search';

/**
 * `/manage/bookings` — list and search. STRATEGY §4.5.
 *
 * One field, six columns matched. The structured filters run in SQL; the text match runs in
 * `_lib/search.ts` over the returned page, because "204555" has to find "(204) 555-0134" and
 * no `LIKE` pattern does that. `PAGE_SIZE` bounds what that costs.
 *
 * It is a plain `GET` form. A search box that needs JavaScript to submit is a search box that
 * does not work on the desk tablet while the till software is updating.
 */

export const metadata: Metadata = { title: manager.mg.bookings.title };
export const dynamic = 'force-dynamic';

const { mg, empty } = manager;

const PAGE_SIZE = 200;

const STATUS_TONE = {
  CONFIRMED: 'open',
  HOLD: 'filling',
  CANCELLED: 'blocked',
  COMPLETED: 'neutral',
  NO_SHOW: 'full',
} as const;

const STATUS_WORD: Record<string, string> = {
  CONFIRMED: global.status.confirmed,
  HOLD: global.status.pendingDeposit,
  CANCELLED: global.status.cancelled,
  COMPLETED: global.status.completed,
  NO_SHOW: global.status.cancelled,
};

function startMinutesOf(booking: BookingWithDetail): number {
  if (booking.party) return booking.party.partyWindow.startMinutes;
  const starts = booking.games.map((game) => game.gameSlot.startMinutes);
  return starts.length > 0 ? Math.min(...starts) : 0;
}

function depositRecorded(booking: BookingWithDetail): boolean {
  return booking.deposit?.status === 'RECORDED' || booking.deposit?.status === 'APPLIED';
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (key: string): string | undefined =>
    typeof params[key] === 'string' ? (params[key] as string) : undefined;

  const config = await loadConfig();
  const todayIso = venueDateOf(new Date());

  const query = parseQuery(single('q') ?? '');
  const typeFilter = parseTypeFilter(single('type'));
  const statusFilter = parseStatusFilter(single('status'));
  const from = single('from') ?? todayIso;
  const to = single('to');
  const usingDefaults = single('from') === undefined && to === undefined;

  const statuses = statusesFor(statusFilter);

  const rows = await prisma.booking.findMany({
    where: {
      date: { gte: from, ...(to ? { lte: to } : {}) },
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(typeFilter === 'party' ? { party: { isNot: null } } : {}),
      ...(typeFilter === 'games' ? { party: { is: null } } : {}),
    },
    include: BOOKING_INCLUDE,
    orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
    take: PAGE_SIZE,
  });

  const matched = rows.filter((booking) =>
    matchesQuery(
      {
        reference: booking.reference,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        honoreeName: booking.party?.honoreeName ?? null,
      },
      query,
    ),
  );

  const sortable = matched.map((booking) => ({
    booking,
    key: {
      date: booking.date,
      startMinutes: startMinutesOf(booking),
      isParty: booking.party !== null,
      status: booking.status,
      depositRecorded: depositRecorded(booking),
      createdAtMs: booking.createdAt.getTime(),
    },
  }));

  // "Deposit pending" is a derived state, not a `Booking.status`, so the filter for it is
  // applied here rather than in SQL.
  const visible = (
    statusFilter === 'pending' ? sortable.filter((row) => isPendingDeposit(row.key)) : sortable
  ).sort((a, b) => compareBookings(a.key, b.key));

  const pendingCount = sortable.filter((row) => isPendingDeposit(row.key)).length;

  return (
    <PageShell width="board" className="py-6">
      <h1 className="font-display text-display-2 text-text">{mg.bookings.title}</h1>

      {/* ── One field, plus the structured filters ───────────────────────────────────── */}
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex min-w-[18rem] flex-1 flex-col">
          <label htmlFor="q" className="mb-2 font-display text-label uppercase text-text-2">
            {mg.bookings.search.label}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query.raw}
            /* STRATEGY §4.5: "Single search field, autofocused." A manager arrives at this
               screen to type a name; this is a staff tool, not a page a customer lands on. */
            autoFocus
            placeholder={mg.bookings.search.placeholder}
            aria-describedby="q-help"
            className="h-11 w-full border border-border bg-sunken px-3.5 text-body text-text"
          />
          <p id="q-help" className="mt-1.5 text-caption text-text-3">
            {mg.bookings.search.help}
          </p>
        </div>

        <div className="flex flex-col">
          <label htmlFor="type" className="mb-2 font-display text-label uppercase text-text-2">
            {mg.bookings.filter.type.label}
          </label>
          <select
            id="type"
            name="type"
            defaultValue={typeFilter}
            className="h-11 border border-border bg-sunken px-3 text-body text-text"
          >
            <option value="all">{mg.bookings.filter.type.all}</option>
            <option value="games">{mg.bookings.filter.type.games}</option>
            <option value="party">{mg.bookings.filter.type.party}</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="status" className="mb-2 font-display text-label uppercase text-text-2">
            {mg.bookings.filter.status.label}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter}
            className="h-11 border border-border bg-sunken px-3 text-body text-text"
          >
            <option value="all">{mg.bookings.filter.type.all}</option>
            <option value="confirmed">{mg.bookings.filter.status.confirmed}</option>
            <option value="pending">{mg.bookings.filter.status.pending}</option>
            <option value="cancelled">{mg.bookings.filter.status.cancelled}</option>
            <option value="completed">{mg.bookings.filter.status.completed}</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="from" className="mb-2 font-display text-label uppercase text-text-2">
            {mg.bookings.filter.dateFrom}
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="h-11 border border-border bg-sunken px-3 font-mono text-body text-text"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="to" className="mb-2 font-display text-label uppercase text-text-2">
            {mg.bookings.filter.dateTo}
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to ?? ''}
            className="h-11 border border-border bg-sunken px-3 font-mono text-body text-text"
          />
        </div>

        <button type="submit" className={buttonClassName('secondary')}>
          {mg.bookings.search.label}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <MonoValue step="sm" className="text-text-2">
          {interpolate(mg.bookings.resultCount, { n: visible.length })}
        </MonoValue>
        {usingDefaults ? (
          <span className="text-caption text-text-3">{mg.bookings.default}</span>
        ) : null}
        {visible.length >= PAGE_SIZE ? (
          <span className="text-caption text-text-3">{mg.bookings.loadMore}</span>
        ) : null}
      </div>

      {pendingCount > 0 ? (
        <section
          aria-label={mg.bookings.pinned.heading}
          className="mt-4 border border-state-filling border-l-[3px] p-3"
        >
          <Eyebrow as="h2" className="text-state-filling">
            {mg.bookings.pinned.heading}
          </Eyebrow>
          <p className="mt-1 text-body-sm text-text-2">
            {interpolate(mg.bookings.pinned.body, { n: pendingCount })}
          </p>
        </section>
      ) : null}

      <Hairline tone="border" className="mt-6" />

      {visible.length === 0 ? (
        <div className="mt-6">
          {query.empty ? (
            <EmptyState
              title={empty.filter.title}
              body={interpolate(empty.filter.body, {
                status: statusFilter === 'all' ? mg.bookings.filter.type.all : statusFilter,
                from,
                to: to ?? todayIso,
              })}
              action={
                <Link href="/manage/bookings" className={buttonClassName('secondary')}>
                  {empty.filter.action}
                </Link>
              }
            />
          ) : (
            <EmptyState
              title={interpolate(empty.search.title, { query: query.raw })}
              body={empty.search.body}
              action={
                <Link href="/manage/bookings" className={buttonClassName('secondary')}>
                  {empty.search.action}
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <table className="mt-4 w-full border-collapse text-body-sm">
          <caption className="sr-only">{mg.bookings.title}</caption>
          <thead>
            <tr className="border-b border-rule text-left">
              {[
                mg.bookings.col.date,
                mg.bookings.col.time,
                mg.bookings.col.type,
                mg.bookings.col.name,
                mg.bookings.col.size,
                mg.bookings.col.status,
                mg.bookings.col.deposit,
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="py-2 pr-3 font-display text-label uppercase text-text-2"
                >
                  {heading}
                </th>
              ))}
              <th scope="col" className="py-2">
                <span className="sr-only">{global.btn.edit}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ booking, key }) => {
              const pending = isPendingDeposit(key);
              const size = booking.party
                ? formatCount(booking.party.guestCount, 'guest')
                : formatCount(booking.publicGame?.playerCount ?? 0, 'player');
              let phoneHref = '';
              try {
                phoneHref = formatPhoneHref(booking.customerPhone);
              } catch {
                phoneHref = '';
              }
              return (
                <tr
                  key={booking.id}
                  className={cx(
                    'border-b border-rule align-top',
                    pending && 'border-l-[3px] border-l-state-filling',
                  )}
                >
                  <td className="py-2 pr-3 font-mono text-mono-sm text-text">
                    {formatDateShort(booking.date)}
                  </td>
                  <td className="py-2 pr-3 font-mono text-mono-sm text-text">
                    {formatTime(key.startMinutes)}
                  </td>
                  <td className="py-2 pr-3 text-text-2">
                    {booking.party ? mg.add.type.party : mg.add.type.games}
                  </td>
                  <td className="py-2 pr-3">
                    <Link
                      href={`/manage/bookings/${booking.id}`}
                      className="text-text underline decoration-1 underline-offset-4"
                    >
                      {booking.customerName}
                    </Link>
                    {booking.party ? (
                      <span className="block text-caption text-text-3">
                        {booking.party.honoreeName}
                      </span>
                    ) : null}
                    <span className="block font-mono text-mono-xs text-text-3">
                      {booking.reference}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-mono-sm text-text">{size}</td>
                  <td className="py-2 pr-3">
                    <Tag tone={STATUS_TONE[booking.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                      {STATUS_WORD[booking.status] ?? booking.status}
                    </Tag>
                  </td>
                  <td className="py-2 pr-3 font-mono text-mono-sm">
                    {booking.party ? (
                      depositRecorded(booking) ? (
                        <span className="text-accent">{formatMoney(config.depositAmountCents)}</span>
                      ) : (
                        <span className="text-state-filling">
                          {mg.booking.deposit.status.pending}
                        </span>
                      )
                    ) : (
                      <span className="text-text-3">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    {phoneHref ? (
                      <a
                        href={phoneHref}
                        aria-label={interpolate(mg.bookings.call, { name: booking.customerName })}
                        className={buttonClassName('ghost')}
                      >
                        {booking.customerPhone}
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
