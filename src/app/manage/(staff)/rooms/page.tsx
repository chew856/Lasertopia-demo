import type { Metadata } from 'next';

import { PageShell, ValidationMessage } from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { manager } from '@/lib/copy/manager';
import { prisma } from '@/lib/db/client';
import { venueDateOf } from '@/lib/format';

import { addRoomAction, saveRoomConfigurationsAction, saveRoomsAction } from '../../_lib/actions';
import { CheckField, Field, SaveButton, SetupPage, SetupSection } from '../../_components/setup';

/**
 * `/manage/rooms` — STRATEGY §4.8 and RULES.md §3.
 *
 * "Add or resize a room without a code change (brief gap #6)." Two tables, because the schema
 * has two ideas and conflating them is the single most expensive mistake available here:
 *
 *  - **Rooms** are physical. Capacity is how many that room holds.
 *  - **Room combinations** are what is sold. Their capacity is **authoritative** and is *not*
 *    the sum of the member rooms (R-27): Rooms 1 + 2 hold 26 as two parties but 20 as one.
 *
 * `mg.config.capacityHelp` says that to the manager in their own terms, because OQ-05/OQ-06
 * are open questions and this screen is where they get answered.
 */

export const metadata: Metadata = { title: manager.mg.rooms.title };
export const dynamic = 'force-dynamic';

const { mg } = manager;

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const todayIso = venueDateOf(new Date());

  const [rooms, configurations, futureSlots] = await Promise.all([
    prisma.room.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.roomConfiguration.findMany({
      include: { rooms: { include: { room: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { priority: 'asc' },
    }),
    prisma.bookingRoomSlot.findMany({
      where: { date: { gte: todayIso }, booking: { status: { in: ['HOLD', 'CONFIRMED'] } } },
      include: {
        booking: { select: { reference: true, party: { select: { guestCount: true } } } },
      },
    }),
  ]);

  // "A room in use by a future booking cannot be deleted or shrunk below a booked party
  // without a warning that names the affected bookings." Computed here so the warning is on
  // screen before the manager types, not after they save.
  const usageByRoom = new Map<string, { reference: string; guests: number }[]>();
  for (const slot of futureSlots) {
    const list = usageByRoom.get(slot.roomId) ?? [];
    list.push({
      reference: slot.booking.reference,
      guests: slot.booking.party?.guestCount ?? 0,
    });
    usageByRoom.set(slot.roomId, list);
  }

  return (
    <PageShell width="page" className="py-6">
      <SetupPage
        title={mg.rooms.heading}
        intro={mg.rooms.intro}
        saved={params.saved === '1'}
        error={typeof params.error === 'string' ? params.error : undefined}
      >
        <SetupSection title={mg.rooms.heading}>
          <form action={saveRoomsAction}>
            <div className="flex flex-col gap-4">
              {rooms.map((room) => {
                const usage = usageByRoom.get(room.id) ?? [];
                const oversized = usage.filter((entry) => entry.guests > room.capacity);
                return (
                  <div key={room.id} className="border border-rule p-3">
                    <input type="hidden" name="roomId" value={room.id} />
                    <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
                      <Field
                        name={`room:${room.id}:name`}
                        label={mg.rooms.col.name}
                        defaultValue={room.name}
                        helper={mg.rooms.namePlaceholder}
                        required
                      />
                      <Field
                        name={`room:${room.id}:capacity`}
                        label={mg.rooms.col.capacity}
                        defaultValue={room.capacity}
                        type="number"
                        inputMode="numeric"
                        required
                      />
                      <CheckField
                        name={`room:${room.id}:active`}
                        label={mg.rooms.col.active}
                        defaultChecked={room.isActive}
                      />
                    </div>

                    {usage.length > 0 ? (
                      <ValidationMessage tone="warning" className="mt-3">
                        {interpolate(mg.rooms.deactivate.warning, {
                          n: usage.length,
                          roomNames: room.name,
                          list: usage.map((entry) => entry.reference).join(', '),
                        })}
                      </ValidationMessage>
                    ) : null}

                    {oversized.length > 0 ? (
                      <ValidationMessage tone="error" className="mt-2">
                        {interpolate(mg.rooms.shrink.warning, {
                          n: oversized.length,
                          roomNames: room.name,
                          roomMax: room.capacity,
                          list: oversized.map((entry) => entry.reference).join(', '),
                        })}
                      </ValidationMessage>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <SaveButton />
          </form>
        </SetupSection>

        <SetupSection title={mg.rooms.add}>
          <form action={addRoomAction} className="grid items-end gap-3 md:grid-cols-[2fr_1fr_auto]">
            <Field name="name" label={mg.rooms.col.name} required />
            <Field
              name="capacity"
              label={mg.rooms.col.capacity}
              type="number"
              inputMode="numeric"
              required
            />
            <SaveButton label={mg.rooms.add} />
          </form>
        </SetupSection>

        <SetupSection id="combinations" title={mg.config.heading} intro={mg.config.intro}>
          <p className="mb-3 max-w-[68ch] text-body-sm text-state-filling">
            {mg.config.capacityHelp}
          </p>
          <form action={saveRoomConfigurationsAction}>
            <table className="w-full border-collapse text-body-sm">
              <caption className="sr-only">{mg.config.heading}</caption>
              <thead>
                <tr className="border-b border-rule text-left">
                  {[
                    mg.config.col.rooms,
                    mg.config.col.capacity,
                    mg.config.col.slots,
                    mg.config.col.offered,
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="py-2 pr-3 font-display text-label uppercase text-text-2"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {configurations.map((configuration) => (
                  <tr key={configuration.id} className="border-b border-rule align-bottom">
                    <td className="py-2 pr-3 text-text">
                      <input type="hidden" name="configId" value={configuration.id} />
                      {configuration.rooms.map((member) => member.room.name).join(' + ')}
                      <span className="block font-mono text-mono-xs text-text-3">
                        {configuration.code}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <Field
                        name={`config:${configuration.id}:capacity`}
                        label={mg.config.col.capacity}
                        defaultValue={configuration.capacity}
                        type="number"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="py-2 pr-3 font-mono text-mono-sm text-text-2">
                      {configuration.roomSlotsConsumed}
                    </td>
                    <td className="py-2 pr-3">
                      <CheckField
                        name={`config:${configuration.id}:active`}
                        label={mg.config.col.offered}
                        defaultChecked={configuration.isActive}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <SaveButton />
          </form>
        </SetupSection>
      </SetupPage>
    </PageShell>
  );
}
