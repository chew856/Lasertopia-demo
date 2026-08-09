import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, MonoValue, PageShell, Tag, buttonClassName, cx } from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { manager } from '@/lib/copy/manager';
import { formatTime, venueDateOf, venueMinutesOf } from '@/lib/format';

import { loadActivity, type ActivityEntry } from '../../_lib/audit';

/**
 * `/manage/activity` — STRATEGY §2.2: "Audit feed: overrides (with reasons), cancellations,
 * capacity edits, blocks. Read-only."
 *
 * Read-only structurally: a Server Component with no action imported and no client boundary.
 *
 * The feed is assembled from three sources because the schema has no venue-level audit table —
 * `BookingChangeLog` requires a `bookingId`, and a block or a tax-rate change belongs to no
 * booking. `_lib/audit.ts` documents the mapping and its one real limitation: `Setting` carries
 * a last-updated column, not a history, so a key edited three times contributes one row.
 */

export const metadata: Metadata = { title: manager.mg.activity.title };
export const dynamic = 'force-dynamic';

const { mg, empty } = manager;

const LIMIT = 200;

const FILTERS = [
  { value: 'all', label: mg.activity.filter.all },
  { value: 'override', label: mg.activity.filter.overrides },
  { value: 'cancellation', label: mg.activity.filter.cancellations },
  { value: 'block', label: mg.activity.filter.blocks },
  { value: 'settings', label: mg.activity.filter.settings },
] as const;

const KIND_TONE = {
  override: 'filling',
  cancellation: 'full',
  block: 'blocked',
  settings: 'neutral',
  other: 'neutral',
} as const;

function rowLabel(entry: ActivityEntry): string {
  const at = new Date(entry.atMs);
  return interpolate(mg.activity.row, {
    dateIso: entry.atMs === 0 ? '—' : venueDateOf(at),
    time: entry.atMs === 0 ? '—' : formatTime(venueMinutesOf(at)),
    staffName: entry.staffName,
    notes: entry.summary,
  });
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = typeof params.kind === 'string' ? params.kind : 'all';

  const entries = await loadActivity(LIMIT);
  const visible = filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter);

  return (
    <PageShell width="page" className="py-6">
      <h1 className="font-display text-display-2 text-text">{mg.activity.heading}</h1>
      <p className="mt-2 max-w-[68ch] text-body text-text-2">{mg.activity.intro}</p>

      <nav aria-label={mg.activity.filter.all} className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={option.value === 'all' ? '/manage/activity' : `/manage/activity?kind=${option.value}`}
            aria-current={filter === option.value ? 'page' : undefined}
            className={cx(
              buttonClassName('compact'),
              filter === option.value && 'border-accent text-accent',
            )}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={empty.activity.title} body={empty.activity.body} />
        </div>
      ) : (
        <ol className="mt-6 flex flex-col">
          {visible.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline gap-3 border-b border-rule py-2"
            >
              <Tag tone={KIND_TONE[entry.kind]}>{entry.kind}</Tag>
              <MonoValue step="xs" className="text-text-3">
                {entry.atMs === 0 ? '—' : venueDateOf(new Date(entry.atMs))}
              </MonoValue>
              <span className="min-w-0 flex-1 text-body-sm text-text">{rowLabel(entry)}</span>
              {entry.bookingId && entry.bookingReference ? (
                <Link
                  href={`/manage/bookings/${entry.bookingId}`}
                  className="font-mono text-mono-xs text-text-2 underline decoration-1 underline-offset-4"
                >
                  {interpolate(mg.activity.openBooking, { code: entry.bookingReference })}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
