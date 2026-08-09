import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, PageShell, buttonClassName } from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { manager } from '@/lib/copy/manager';
import { prisma } from '@/lib/db/client';

import { PartySheet } from '../../../../_components/party-sheet';
import { BOOKING_INCLUDE, loadConfig } from '../../../../_lib/catalog';

/**
 * `/manage/day/[date]/sheets` — the Saturday-morning ritual, one tap from the board header.
 *
 * Every party on a date, one per page. The page break lives in `print-sheet.css`
 * (`page-break-after` on `.sheet-page`), so this route is a loop and nothing else.
 */

/** `sheet.day.heading` carries `{dateIso}`; used raw it printed the braces in the tab and the
 *  print header. The date is only known per request, so the title is generated per request. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  return { title: interpolate(manager.sheet.day.heading, { dateIso: date }) };
}

export const dynamic = 'force-dynamic';

const { sheet, empty } = manager;

export default async function DaySheetsPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const printedAt = new Date();

  const [config, bookings] = await Promise.all([
    loadConfig(),
    prisma.booking.findMany({
      where: { date, status: { in: ['HOLD', 'CONFIRMED'] }, party: { isNot: null } },
      include: BOOKING_INCLUDE,
    }),
  ]);

  const parties = bookings
    .filter((booking) => booking.party !== null)
    .sort(
      (a, b) =>
        (a.party?.partyWindow.startMinutes ?? 0) - (b.party?.partyWindow.startMinutes ?? 0),
    );

  if (parties.length === 0) {
    return (
      <PageShell width="page" className="py-8">
        <EmptyState
          title={interpolate(empty.sheets.title, { dateIso: date })}
          body={empty.sheets.body}
          action={
            <Link href={`/manage/schedule?date=${date}`} className={buttonClassName('secondary')}>
              {manager.TODO_COPY.backToBoard}
            </Link>
          }
        />
      </PageShell>
    );
  }

  return (
    <div className="py-6">
      <div className="sheet-noprint mx-auto mb-4 flex max-w-[7.5in] flex-wrap items-baseline gap-3 px-4">
        <h1 className="font-display text-display-3 text-text">
          {interpolate(sheet.day.heading, { dateIso: date })}
        </h1>
        <span className="font-mono text-mono-sm text-text-2">
          {interpolate(sheet.day.count, { n: parties.length })}
        </span>
        <span className="text-caption text-text-3">{sheet.day.pageBreakNote}</span>
        <Link
          href={`/manage/schedule?date=${date}`}
          className={`${buttonClassName('ghost')} ml-auto`}
        >
          {manager.TODO_COPY.backToBoard}
        </Link>
      </div>

      {parties.map((booking) => (
        <PartySheet key={booking.id} booking={booking} config={config} printedAt={printedAt} />
      ))}
    </div>
  );
}
