import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Caption,
  Eyebrow,
  Hairline,
  MonoValue,
  PageShell,
  Tag,
  ValidationMessage,
  buttonClassName,
} from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { global } from '@/lib/copy/global';
import { manager } from '@/lib/copy/manager';
import { prisma } from '@/lib/db/client';
import { assessNotice, cents, evaluateCancellation } from '@/lib/domain';
import {
  formatCount,
  formatDateLong,
  formatMoney,
  formatPhoneHref,
  formatTime,
  formatTimeList,
  formatTimeRange,
  venueDateOf,
  venueMinutesOf,
} from '@/lib/format';

import { cancelBookingAction } from '../../../_lib/actions';
import { BOOKING_INCLUDE, loadConfig } from '../../../_lib/catalog';
import { DepositRecorder, GuestCountEditor, NotesEditor } from '../../../_components/booking-editors';

/**
 * `/manage/bookings/[id]` — everything about one booking. STRATEGY §4.6.
 *
 * Order follows §5's hierarchy: name, date, window and guest count first; allergies second;
 * deposit and balance third; and **[Cancel booking] last and visually quiet**, behind a
 * disclosure, restating the deposit consequence in dollars before the button will proceed.
 */

export const metadata: Metadata = { title: manager.mg.bookings.title };
export const dynamic = 'force-dynamic';

const { mg, empty } = manager;

const LOG_LABEL: Record<string, string> = {
  CREATED: mg.booking.log.created,
  CONFIRMED: global.status.confirmed,
  DEPOSIT_RESOLVED: mg.booking.log.deposit,
  CANCELLED: mg.booking.log.cancelled,
  OVERRIDDEN: mg.booking.log.override,
  CHECKED_IN: mg.booking.log.checkIn,
  CHECK_IN_UNDONE: mg.slot.undoCheckIn,
  GUESTS_CHANGED: mg.booking.edit.guests,
  NOTES_CHANGED: mg.booking.edit.notes,
  ADDON_CHANGED: mg.booking.edit.extras,
  RESCHEDULED: mg.booking.reschedule.cta,
};

/**
 * The activity line for one log row.
 *
 * Four of these labels carry `{staffName}` / `{notes}`. They were rendered raw beside the
 * actor name and the reason, so the board printed "Cancelled by {staffName} — {notes}  Priya
 * Customer called" — the braces sitting next to the values that should have filled them.
 * A row with no reason loses the clause rather than interpolating an empty one, because
 * `interpolate` treats "" as a missing value.
 */
function logLine(entry: {
  action: string;
  reason: string | null;
  actor: { name: string } | null;
}): string {
  const template = LOG_LABEL[entry.action] ?? entry.action;
  const notes = entry.reason?.trim() ?? '';
  const withNotes = notes.length > 0 ? template : template.replace(/\s*—\s*\{notes\}/u, '');
  return interpolate(withNotes as string, {
    staffName: entry.actor?.name ?? mg.add.source.inPerson,
    notes,
  } as never);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-rule p-4">
      <Eyebrow as="h2">{title}</Eyebrow>
      <Hairline className="my-3" />
      {children}
    </section>
  );
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const config = await loadConfig();

  const booking = await prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
  if (!booking) notFound();

  const log = await prisma.bookingChangeLog.findMany({
    where: { bookingId: booking.id },
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { name: true } } },
  });
  const giftCards = await prisma.giftCard.findMany({ where: { issuedFromBookingId: booking.id } });

  const now = new Date();
  const todayIso = venueDateOf(now);
  const party = booking.party;
  const gameStarts = booking.games
    .map((game) => game.gameSlot.startMinutes)
    .sort((a, b) => a - b);

  const windowLabel = party
    ? formatTimeRange(party.partyWindow.startMinutes, party.partyWindow.endMinutes)
    : '';
  const gameTimesLabel = gameStarts.length > 0 ? formatTimeList(gameStarts) : '—';
  const roomNames = booking.roomSlots.map((slot) => slot.room.name).join(' + ');

  const startsAtUtc =
    party?.windowStartsAtUtc ??
    booking.games.map((game) => game.gameSlot.startsAtUtc).sort((a, b) => a.getTime() - b.getTime())[0] ??
    now;

  const notice = assessNotice({ now, eventStartsAtUtc: startsAtUtc, config });
  const cancellation = evaluateCancellation({
    now,
    eventStartsAtUtc: startsAtUtc,
    depositAmountCents: cents(booking.deposit?.amountCents ?? 0),
    config,
  });

  const depositRecorded =
    booking.deposit?.status === 'RECORDED' || booking.deposit?.status === 'APPLIED';

  let phoneHref = '';
  try {
    phoneHref = formatPhoneHref(booking.customerPhone);
  } catch {
    phoneHref = '';
  }

  const heading = party
    ? interpolate(mg.booking.heading.party, {
        honoree: party.honoreeName,
        dateIso: booking.date,
        window: windowLabel,
      })
    : interpolate(mg.booking.heading.games, {
        name: booking.customerName,
        dateIso: booking.date,
        gameTimes: gameTimesLabel,
      });

  return (
    <PageShell width="page" className="py-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <MonoValue step="lg" className="text-accent">
          {booking.reference}
        </MonoValue>
        <Tag tone={booking.status === 'CANCELLED' ? 'blocked' : 'open'}>{booking.status}</Tag>
        {booking.overrideReason ? <Tag tone="filling">{mg.override.badge.word}</Tag> : null}
        <Link href="/manage/schedule" className={`${buttonClassName('ghost')} ml-auto`}>
          {manager.TODO_COPY.backToBoard}
        </Link>
      </div>

      <h1 className="mt-2 font-display text-display-2 text-text">{heading}</h1>

      {query.saved ? (
        <ValidationMessage tone="success" className="mt-3">
          {mg.toast.saved}
        </ValidationMessage>
      ) : null}
      {query.error === 'reason' ? (
        <ValidationMessage tone="error" className="mt-3">
          {mg.booking.cancel.reason.label}
        </ValidationMessage>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Section title={mg.booking.section.when}>
          <p className="text-body">{formatDateLong(booking.date, { currentYear: now.getFullYear() })}</p>
          {party ? (
            <MonoValue step="md" className="mt-1 block text-text-2">
              {windowLabel}
            </MonoValue>
          ) : null}
          <MonoValue step="md" className="mt-1 block text-text-2">
            {gameTimesLabel}
          </MonoValue>
          <Caption className="mt-2">{global.timezoneNote}</Caption>
        </Section>

        <Section title={mg.booking.section.who}>
          <p className="text-body text-text">{booking.customerName}</p>
          <p className="mt-1 text-body-sm text-text-2">{booking.customerEmail}</p>
          {phoneHref ? (
            <a
              href={phoneHref}
              className="mt-1 block font-mono text-mono-sm text-text underline decoration-1 underline-offset-4"
            >
              {booking.customerPhone}
            </a>
          ) : (
            <p className="mt-1 font-mono text-mono-sm text-text-2">{booking.customerPhone}</p>
          )}
          {party ? (
            <p className="mt-3 text-body-sm text-text-2">
              {interpolate(mg.party.heading, {
                honoree: party.honoreeName,
                age: party.honoreeAge,
                guests: party.guestCount,
              })}
            </p>
          ) : (
            <p className="mt-3 font-mono text-mono-sm text-text">
              {formatCount(booking.publicGame?.playerCount ?? 0, 'player')}
            </p>
          )}
        </Section>

        {party ? (
          <Section title={mg.booking.section.rooms}>
            <p className="text-body text-text">{roomNames || '—'}</p>
            <p className="mt-1 text-body-sm text-text-2">{party.roomConfiguration.name}</p>
            <Caption className="mt-2">
              {interpolate(mg.board.lane.roomCap, { roomMax: party.roomConfiguration.capacity })}
            </Caption>
          </Section>
        ) : null}

        <Section title={mg.booking.section.games}>
          {booking.games.length === 0 ? (
            <p className="text-body-sm text-text-2">{mg.slot.bookings.none}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {booking.games
                .slice()
                .sort((a, b) => a.gameSlot.startMinutes - b.gameSlot.startMinutes)
                .map((game) => (
                  <li key={game.id} className="flex items-baseline gap-3">
                    <MonoValue step="md" className="text-text">
                      {formatTime(game.gameSlot.startMinutes)}
                    </MonoValue>
                    <span className="text-body-sm text-text-2">
                      {formatCount(game.playerCount, 'player')}
                    </span>
                    <span className="text-caption text-text-3">{game.gameSlot.mode}</span>
                  </li>
                ))}
            </ul>
          )}
        </Section>

        {party ? (
          <Section title={mg.booking.section.package}>
            <p className="text-body text-text">{party.packageRef.name}</p>
            {booking.addOns.length === 0 ? (
              <p className="mt-2 text-body-sm text-text-2">{manager.sheet.addons.none}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-body-sm">
                {booking.addOns.map((line) => (
                  <li key={line.id} className="flex justify-between gap-3">
                    <span className="text-text-2">
                      {line.addOn.name}
                      {line.option ? ` · ${line.option.label}` : ''}
                    </span>
                    <MonoValue step="sm" className="text-text">
                      {`${line.quantity} × ${formatMoney(line.unitPriceCentsSnapshot)}`}
                    </MonoValue>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        <Section title={mg.booking.section.money}>
          <dl className="flex flex-col gap-1 text-body-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-text-2">{global.sum.subtotal}</dt>
              <dd>
                <MonoValue step="sm">{formatMoney(booking.preTaxSubtotalCents)}</MonoValue>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-2">
                {interpolate(global.sum.tax, {
                  taxRate: booking.taxRateMilliPercentSnapshot / 1000,
                })}
              </dt>
              <dd>
                <MonoValue step="sm">{formatMoney(booking.taxCents)}</MonoValue>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text">{global.sum.total}</dt>
              <dd>
                <MonoValue step="md" className="text-text">
                  {formatMoney(booking.totalCents)}
                </MonoValue>
              </dd>
            </div>
          </dl>

          <Hairline className="my-3" />

          <p className="text-body-sm text-text-2">
            {depositRecorded
              ? interpolate(mg.booking.deposit.status.paid, {
                  deposit: formatMoney(booking.deposit?.amountCents ?? 0),
                  dateIso: booking.deposit ? venueDateOf(booking.deposit.recordedAt) : todayIso,
                  staffName: booking.createdBy?.name ?? mg.add.source.inPerson,
                })
              : mg.booking.deposit.status.pending}
          </p>
          {giftCards.map((card) => (
            <p key={card.id} className="mt-1 text-body-sm text-text-2">
              {interpolate(mg.booking.deposit.status.giftcard, {
                code: card.code,
                dateIso: venueDateOf(card.issuedAt),
              })}
            </p>
          ))}

          {party && !depositRecorded && booking.status !== 'CANCELLED' ? (
            <div className="mt-3">
              <DepositRecorder bookingId={booking.id} />
            </div>
          ) : null}

          {booking.overrideReason ? (
            <p className="mt-3 text-caption text-state-filling">
              {interpolate(mg.booking.price.override, { notes: booking.overrideReason })}
            </p>
          ) : null}
          <Caption className="mt-2">
            {interpolate(mg.booking.price.snapshot, { dateIso: venueDateOf(booking.createdAt) })}
          </Caption>
        </Section>

        <Section title={mg.booking.section.notes}>
          <NotesEditor bookingId={booking.id} notes={booking.notes ?? ''} />
          {(booking.notes ?? '').trim() === '' ? (
            <Caption className="mt-2">{empty.noAllergies}</Caption>
          ) : null}
        </Section>

        {party && booking.status !== 'CANCELLED' ? (
          <Section title={mg.booking.edit.guests}>
            <GuestCountEditor
              bookingId={booking.id}
              guests={party.guestCount}
              minGuests={config.minPartyGuests}
              maxGuests={config.maxPartyGuests}
              windowLabel={windowLabel}
              ageBand={config.maxAgeDifferenceYears}
              timeLabels={Object.fromEntries(
                gameStarts.map((minutes) => [String(minutes), formatTime(minutes)]),
              )}
            />
          </Section>
        ) : null}

        <Section title={mg.booking.section.log}>
          {log.length === 0 ? (
            <p className="text-body-sm text-text-2">{empty.activity.body}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {log.map((entry) => (
                <li key={entry.id} className="text-body-sm">
                  <MonoValue step="xs" className="text-text-3">
                    {`${venueDateOf(entry.createdAt)} ${formatTime(venueMinutesOf(entry.createdAt))}`}
                  </MonoValue>
                  {/* Actor and reason are inside the sentence now, not appended after it. */}
                  <span className="ml-2 text-text">{logLine(entry)}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {party ? (
          <Link
            href={`/manage/bookings/${booking.id}/sheet`}
            className={buttonClassName('secondary')}
          >
            {global.btn.printSheet}
          </Link>
        ) : null}
      </div>

      {/* ── Cancel: last, quiet, and it states the money before it will proceed ───────── */}
      {booking.status !== 'CANCELLED' ? (
        <details className="mt-10 border border-rule p-4">
          <summary className="cursor-pointer font-display text-button uppercase text-text-2">
            {mg.booking.cancel.cta}
          </summary>

          <h2 className="mt-4 font-display text-display-3 text-text">
            {interpolate(mg.booking.cancel.heading, { code: booking.reference })}
          </h2>

          <p className="mt-2 max-w-[68ch] text-body-sm text-text-2">
            {party
              ? notice.sufficient
                ? interpolate(mg.booking.cancel.partyOutside, {
                    daysAway: notice.noticeDays,
                    deposit: formatMoney(config.depositAmountCents),
                    roomNames: roomNames || '—',
                    window: windowLabel,
                    gameTimes: gameTimesLabel,
                  })
                : interpolate(mg.booking.cancel.partyInside, {
                    daysAway: notice.noticeDays,
                    noticeDays: config.changeNoticeDays,
                    deposit: formatMoney(config.depositAmountCents),
                  })
              : interpolate(mg.booking.cancel.games, {
                  players: booking.publicGame?.playerCount ?? 0,
                  gameTimes: gameTimesLabel,
                  dateIso: booking.date,
                })}
          </p>

          <form action={cancelBookingAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="bookingId" value={booking.id} />

            <label htmlFor="cancel-reason" className="font-display text-label uppercase text-text-2">
              {mg.booking.cancel.reason.label}
            </label>
            <input
              id="cancel-reason"
              name="reason"
              required
              minLength={3}
              className="h-11 border border-border bg-sunken px-3.5 text-body text-text"
            />

            {party && !notice.sufficient && depositRecorded ? (
              <label className="flex items-center gap-2 text-body-sm text-text-2">
                <input type="checkbox" name="giftCardAnyway" className="size-5 border border-border" />
                {mg.booking.cancel.giftcardToggle}
              </label>
            ) : null}

            <p className="text-caption text-text-3">{cancellation.message}</p>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className={buttonClassName('secondary')}>
                {mg.booking.cancel.confirm}
              </button>
              <Link href={`/manage/bookings/${booking.id}`} className={buttonClassName('ghost')}>
                {mg.booking.cancel.keep}
              </Link>
            </div>
          </form>
        </details>
      ) : null}
    </PageShell>
  );
}
