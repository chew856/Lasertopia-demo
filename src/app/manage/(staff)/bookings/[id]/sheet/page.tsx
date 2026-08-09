import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonClassName } from '@/components/ui';
import { global } from '@/lib/copy/global';
import { manager } from '@/lib/copy/manager';
import { prisma } from '@/lib/db/client';

import { PartySheet } from '../../../../_components/party-sheet';
import { BOOKING_INCLUDE, loadConfig } from '../../../../_lib/catalog';

/**
 * `/manage/bookings/[id]/sheet` — one party, one page, black on white.
 *
 * The only chrome is a `.sheet-noprint` strip: the browser's own print dialog is the print
 * button, so there is nothing here to go wrong between the screen and the paper.
 */

export const metadata: Metadata = { title: manager.mg.bookings.title };
export const dynamic = 'force-dynamic';

export default async function PartySheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [config, booking] = await Promise.all([
    loadConfig(),
    prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE }),
  ]);

  if (!booking?.party) notFound();

  return (
    <div className="py-6">
      <div className="sheet-noprint mx-auto mb-4 flex max-w-[7.5in] flex-wrap gap-2 px-4">
        <Link href={`/manage/bookings/${booking.id}`} className={buttonClassName('ghost')}>
          {global.btn.back}
        </Link>
        <Link href="/manage/schedule" className={buttonClassName('ghost')}>
          {manager.TODO_COPY.backToBoard}
        </Link>
      </div>

      <PartySheet booking={booking} config={config} printedAt={new Date()} />
    </div>
  );
}
