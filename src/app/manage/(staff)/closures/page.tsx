import type { Metadata } from 'next';

import { EmptyState, Eyebrow, MonoValue, PageShell, Tag, ValidationMessage, buttonClassName } from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { global } from '@/lib/copy/global';
import { manager } from '@/lib/copy/manager';
import { prisma } from '@/lib/db/client';
import { formatDateLong } from '@/lib/format';

import { deleteClosureAction, saveClosureAction } from '../../_lib/actions';
import { CheckField, Field, SaveButton, SetupPage, SetupSection } from '../../_components/setup';

/**
 * `/manage/closures` — STRATEGY §4.8: "one-off closures and modified hours, with a warning
 * listing any bookings the closure would strand."
 *
 * The warning is enforced, not decorative: `saveClosureAction` refuses to write a closure over
 * a date that has live bookings until the manager comes back with `acknowledge`. The copy is
 * blunt about why — closing a date "does not cancel them or tell the customers".
 *
 * **A schema gap, reported rather than faked.** COPY.md §13.12 offers "Different hours" for a
 * date, but `Closure` has only `blocksPublic` / `blocksParties` — there is nowhere to put
 * per-date opening times. So this screen offers what the data model can actually honour:
 * close the whole date, or close it to one of the two audiences. Per-date hours needs a
 * migration.
 */

export const metadata: Metadata = { title: manager.mg.closures.title };
export const dynamic = 'force-dynamic';

const { mg, empty } = manager;

export default async function ClosuresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const strandedCount = typeof params.stranded === 'string' ? Number(params.stranded) : 0;
  const strandedDate = typeof params.date === 'string' ? params.date : '';

  const closures = await prisma.closure.findMany({ orderBy: { date: 'asc' } });

  const stranded =
    strandedCount > 0 && strandedDate
      ? await prisma.booking.findMany({
          where: { date: strandedDate, status: { in: ['HOLD', 'CONFIRMED'] } },
          select: { id: true, reference: true, customerName: true },
        })
      : [];

  return (
    <PageShell width="page" className="py-6">
      <SetupPage
        title={mg.closures.heading}
        intro={mg.closures.intro}
        saved={params.saved === '1'}
        error={typeof params.error === 'string' ? params.error : undefined}
      >
        {stranded.length > 0 ? (
          <section className="border border-state-full border-l-[3px] p-4">
            <Eyebrow as="h2" className="text-state-full">
              {interpolate(mg.closures.stranded.heading, { n: stranded.length })}
            </Eyebrow>
            <p className="mt-2 max-w-[68ch] text-body-sm text-text-2">
              {interpolate(mg.closures.stranded.body, {
                list: stranded
                  .map((booking) => `${booking.reference} (${booking.customerName})`)
                  .join(', '),
              })}
            </p>

            <form action={saveClosureAction} className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="date" value={strandedDate} />
              <input type="hidden" name="acknowledge" value="true" />
              <input type="hidden" name="blocksPublic" value="true" />
              <input type="hidden" name="blocksParties" value="true" />
              <Field id="f-stranded-reason" name="reason" label={mg.closures.reason.label} />
              <SaveButton label={mg.closures.stranded.proceed} />
              <a
                href={`/manage/bookings?from=${strandedDate}&to=${strandedDate}`}
                className={buttonClassName('ghost')}
              >
                {mg.closures.stranded.review}
              </a>
            </form>
          </section>
        ) : null}

        <SetupSection title={mg.closures.add}>
          <form action={saveClosureAction} className="flex flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
              <Field name="date" label={mg.closures.date.label} type="date" required />
              <Field name="reason" label={mg.closures.reason.label} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <CheckField
                name="blocksPublic"
                label={mg.add.type.games}
                defaultChecked
                helper={mg.closures.type.closed}
              />
              <CheckField
                name="blocksParties"
                label={mg.add.type.party}
                defaultChecked
                helper={mg.closures.type.closed}
              />
            </div>
            <ValidationMessage tone="warning">{mg.closures.intro}</ValidationMessage>
            <SaveButton label={mg.closures.add} />
          </form>
        </SetupSection>

        <SetupSection title={mg.closures.title}>
          {closures.length === 0 ? (
            <EmptyState title={empty.closures.title} body={empty.closures.body} />
          ) : (
            <ul className="flex flex-col gap-2">
              {closures.map((closure) => (
                <li
                  key={closure.id}
                  className="flex flex-wrap items-center gap-3 border border-rule p-3"
                >
                  <MonoValue step="md" className="text-text">
                    {closure.date}
                  </MonoValue>
                  <span className="text-body-sm text-text-2">
                    {formatDateLong(closure.date, { currentYear: new Date().getFullYear() })}
                  </span>
                  <span className="text-body-sm text-text">{closure.reason}</span>
                  {closure.blocksPublic ? <Tag tone="blocked">{mg.add.type.games}</Tag> : null}
                  {closure.blocksParties ? <Tag tone="blocked">{mg.add.type.party}</Tag> : null}
                  <form action={deleteClosureAction} className="ml-auto">
                    <input type="hidden" name="date" value={closure.date} />
                    <button type="submit" className={buttonClassName('ghost')}>
                      {global.btn.cancel}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </SetupSection>
      </SetupPage>
    </PageShell>
  );
}
