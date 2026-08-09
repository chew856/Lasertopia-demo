import type { Metadata } from 'next';

import { Eyebrow, MonoValue, PageShell, Tag, ValidationMessage } from '@/components/ui';
import { manager } from '@/lib/copy/manager';
import { prisma } from '@/lib/db/client';
import { formatClock24 } from '@/lib/domain';
import { formatTime, formatTimeRange, venueDateOf } from '@/lib/format';

import { saveOperatingHoursAction, savePartyWindowsAction } from '../../_lib/actions';
import { CheckField, Field, SaveButton, SetupPage, SetupSection } from '../../_components/setup';

/**
 * `/manage/slots` — party windows and the ordered reserved game times. STRATEGY §4.8.
 *
 * This is brief gap #3, and it is the screen that makes the difference between "the venue
 * changes its Saturday schedule" being a data edit and being a deploy. R-15 is explicit that
 * the reserved game times are **never a flat hardcoded list**; this is where they live.
 *
 * Times are edited as one comma-separated line per set rather than a row per time, because a
 * manager fixing "17:15, 17:45" wants to retype a line, not operate an add/remove list. The
 * 24-hour clock is used throughout — RULES.md's own notation, and unambiguous on a form.
 *
 * Operating hours sit on this screen too: `mg.slots.validation.outsideHours` validates a
 * window against them, and splitting the two across screens would mean editing one thing in
 * two places.
 */

export const metadata: Metadata = { title: manager.mg.slots.title };
export const dynamic = 'force-dynamic';

const { mg } = manager;

/** Sunday-first, matching `PartyWindow.dayOfWeek` (JS `getUTCDay`). */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const todayIso = venueDateOf(new Date());

  const [hours, windows, futureParties] = await Promise.all([
    prisma.operatingHours.findMany({ orderBy: { dayOfWeek: 'asc' } }),
    prisma.partyWindow.findMany({
      orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
      include: {
        gameSets: { include: { times: { orderBy: { sortOrder: 'asc' } } }, orderBy: { setIndex: 'asc' } },
        offerings: { include: { roomConfiguration: true } },
      },
    }),
    prisma.partyBooking.findMany({
      where: { booking: { date: { gte: todayIso }, status: { in: ['HOLD', 'CONFIRMED'] } } },
      select: { partyWindowId: true, booking: { select: { reference: true } } },
    }),
  ]);

  const futureByWindow = new Map<string, string[]>();
  for (const party of futureParties) {
    futureByWindow.set(party.partyWindowId, [
      ...(futureByWindow.get(party.partyWindowId) ?? []),
      party.booking.reference,
    ]);
  }

  const byDay = new Map<number, typeof windows>();
  for (const window of windows) {
    byDay.set(window.dayOfWeek, [...(byDay.get(window.dayOfWeek) ?? []), window]);
  }

  return (
    <PageShell width="page" className="py-6">
      <SetupPage
        title={mg.slots.heading}
        intro={mg.slots.intro}
        saved={params.saved === '1'}
        error={typeof params.error === 'string' ? params.error : undefined}
      >
        {/* ── Opening hours ────────────────────────────────────────────────────────── */}
        <SetupSection id="hours" title={manager.TODO_COPY.openingHours}>
          <form action={saveOperatingHoursAction}>
            <div className="flex flex-col gap-3">
              {hours.map((day) => (
                <div key={day.dayOfWeek} className="border border-rule p-3">
                  <input type="hidden" name="dayOfWeek" value={day.dayOfWeek} />
                  <Eyebrow as="h3">{DAY_NAMES[day.dayOfWeek] ?? String(day.dayOfWeek)}</Eyebrow>
                  <div className="mt-2 grid gap-3 md:grid-cols-5">
                    <Field
                      name={`hours:${day.dayOfWeek}:opens`}
                      label={mg.closures.open.label}
                      defaultValue={day.opensMinutes}
                      type="number"
                      inputMode="numeric"
                      helper={formatClock24(day.opensMinutes)}
                    />
                    <Field
                      name={`hours:${day.dayOfWeek}:closes`}
                      label={mg.closures.close.label}
                      defaultValue={day.closesMinutes}
                      type="number"
                      inputMode="numeric"
                      helper={formatClock24(day.closesMinutes)}
                    />
                    <Field
                      name={`hours:${day.dayOfWeek}:first`}
                      label={manager.TODO_COPY.firstGame}
                      defaultValue={day.firstPublicGameMinutes}
                      type="number"
                      inputMode="numeric"
                      helper={formatClock24(day.firstPublicGameMinutes)}
                    />
                    <Field
                      name={`hours:${day.dayOfWeek}:last`}
                      label={manager.TODO_COPY.lastGame}
                      defaultValue={day.lastPublicGameMinutes}
                      type="number"
                      inputMode="numeric"
                      helper={formatClock24(day.lastPublicGameMinutes)}
                    />
                    <CheckField
                      name={`hours:${day.dayOfWeek}:open`}
                      label={mg.rooms.col.active}
                      defaultChecked={day.isOpen}
                    />
                  </div>
                </div>
              ))}
            </div>
            <SaveButton />
          </form>
        </SetupSection>

        {/* ── Windows and their reserved game times ────────────────────────────────── */}
        <SetupSection title={mg.slots.title} intro={mg.slots.sets.intro}>
          <form action={savePartyWindowsAction}>
            <div className="flex flex-col gap-6">
              {DAY_NAMES.map((dayName, dayIndex) => {
                const dayWindows = byDay.get(dayIndex) ?? [];
                if (dayWindows.length === 0) return null;
                return (
                  <div key={dayName}>
                    <Eyebrow as="h3">{dayName}</Eyebrow>
                    <div className="mt-2 flex flex-col gap-3">
                      {dayWindows.map((window) => (
                        <div key={window.id} className="border border-rule p-3">
                          <input type="hidden" name="windowId" value={window.id} />

                          <div className="flex flex-wrap items-baseline gap-3">
                            <MonoValue step="md" className="text-text">
                              {formatTimeRange(window.startMinutes, window.endMinutes)}
                            </MonoValue>
                            <span className="text-body-sm text-text-2">{window.label}</span>
                            {window.isActive ? null : (
                              <Tag tone="blocked">{mg.board.marker.blocked}</Tag>
                            )}
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <Field
                              name={`window:${window.id}:start`}
                              label={mg.block.range.from}
                              defaultValue={window.startMinutes}
                              type="number"
                              inputMode="numeric"
                              helper={formatClock24(window.startMinutes)}
                            />
                            <Field
                              name={`window:${window.id}:end`}
                              label={mg.block.range.to}
                              defaultValue={window.endMinutes}
                              type="number"
                              inputMode="numeric"
                              helper={formatClock24(window.endMinutes)}
                            />
                            <CheckField
                              name={`window:${window.id}:active`}
                              label={mg.rooms.col.active}
                              defaultChecked={window.isActive}
                            />
                          </div>

                          <div className="mt-3">
                            <Eyebrow as="h4">{mg.slots.sets.heading}</Eyebrow>
                            {window.gameSets.length === 0 ? (
                              <ValidationMessage tone="warning" className="mt-2">
                                {mg.slots.sets.empty}
                              </ValidationMessage>
                            ) : (
                              <div className="mt-2 flex flex-col gap-2">
                                {window.gameSets.map((set) => (
                                  <Field
                                    key={set.id}
                                    name={`set:${set.id}:times`}
                                    label={`${mg.slots.sets.heading} ${set.setIndex}`}
                                    defaultValue={set.times
                                      .map((time) => formatClock24(time.startMinutes))
                                      .join(', ')}
                                    helper={set.times
                                      .map((time) => formatTime(time.startMinutes))
                                      .join(' · ')}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="mt-3">
                            <Eyebrow as="h4">{mg.slots.window.rooms}</Eyebrow>
                            <div className="mt-1 grid gap-1 md:grid-cols-3">
                              {window.offerings.map((offering) => (
                                <CheckField
                                  key={offering.id}
                                  name={`offering:${offering.id}`}
                                  label={offering.roomConfiguration.name}
                                  defaultChecked={offering.isOffered}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <SaveButton />
          </form>
        </SetupSection>

        <SetupSection title={mg.slots.preview.heading}>
          {/* A real count, not an example: which future bookings currently sit in each window.
              The full "{n} existing bookings would no longer fit" preview needs the proposed
              values to re-run the fit against, which this form does not have until it posts —
              reported as a gap rather than faked with a plausible-looking number. */}
          {windows.length === 0 ? (
            <p className="text-body-sm text-text-2">{mg.slots.sets.empty}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-body-sm">
              {windows.map((window) => {
                const bookings = futureByWindow.get(window.id) ?? [];
                return (
                  <li key={window.id} className="flex flex-wrap items-baseline gap-2">
                    <MonoValue step="sm" className="text-text">
                      {formatTimeRange(window.startMinutes, window.endMinutes)}
                    </MonoValue>
                    <span className="text-text-3">{DAY_NAMES[window.dayOfWeek]}</span>
                    <span className={bookings.length > 0 ? 'text-state-filling' : 'text-text-2'}>
                      {bookings.length === 0
                        ? mg.slots.preview.none
                        : bookings.map((reference) => reference).join(', ')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SetupSection>
      </SetupPage>
    </PageShell>
  );
}
