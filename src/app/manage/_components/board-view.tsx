'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  Button,
  Eyebrow,
  EmptyState,
  Hairline,
  MonoValue,
  PageShell,
  ScheduleBoard,
  Tag,
  ValidationMessage,
  buttonClassName,
  cx,
  type BoardChip,
} from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { manager } from '@/lib/copy/manager';
import { global } from '@/lib/copy/global';

import { blockSlotsAction, unblockSlotsAction } from '../_lib/actions';
import type { BoardView as BoardViewData, PartyView, SlotView } from './board-types';
import { SlotInspector } from './slot-inspector';

/**
 * The board's client shell — STRATEGY §4.1.
 *
 * It owns exactly three things and nothing else: **which row or party is selected**, the
 * **25-second refresh** and its "updated Ns ago" readout, and the **10-second undo toast**.
 * Every figure it renders was formatted on the server, and every write goes through a Server
 * Action that re-validates.
 *
 * The refresh is `router.refresh()` rather than a polled JSON endpoint. STRATEGY §2.2 sketches
 * `GET /api/manage/schedule`, but the payload it describes is exactly what this page's Server
 * Component already produces — a second endpoint would be a second implementation of the board
 * model, and the spec's own rule is that the two must never diverge. The trade is one extra
 * RSC payload every 25 seconds, on a desk browser, on the venue's own network.
 */

const { mg, empty } = manager;

const REFRESH_MS = 25_000;
const UNDO_MS = 10_000;

interface EmptyCopy {
  title: string;
  body: string;
  closedTitle: string;
  closedBody: string;
  closedAction: string;
}

type Selection =
  | { kind: 'slot'; startMinutes: number }
  | { kind: 'party'; bookingId: string }
  | null;

function UpdatedAgo({ generatedAtMs }: { generatedAtMs: number }) {
  const [seconds, setSeconds] = useState(0);
  const [countingFrom, setCountingFrom] = useState(generatedAtMs);

  // Adjusting state during render, which is React's own answer to "reset when a prop changes".
  // Doing it in an effect instead would tick the counter one render behind the payload it is
  // describing, and would cascade a second render every refresh.
  if (countingFrom !== generatedAtMs) {
    setCountingFrom(generatedAtMs);
    setSeconds(0);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [generatedAtMs]);

  return (
    <span aria-live="off" className="font-mono text-mono-xs text-text-3">
      {interpolate(mg.board.updated, { secondsAgo: seconds })}
    </span>
  );
}

function HeaderStat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  tone?: 'alert';
}) {
  const body = (
    <>
      <Eyebrow as="span" className={tone === 'alert' ? 'text-state-filling' : undefined}>
        {label}
      </Eyebrow>
      <MonoValue step="lg" className={tone === 'alert' ? 'text-state-filling' : 'text-text'}>
        {value}
      </MonoValue>
    </>
  );

  const shared = cx(
    'flex min-w-[8rem] flex-col gap-1 border-l px-4 py-2',
    tone === 'alert' ? 'border-l-state-filling' : 'border-l-rule',
  );

  return href ? (
    <Link href={href} className={cx(shared, 'hover:bg-raised')}>
      {body}
    </Link>
  ) : (
    <div className={shared}>{body}</div>
  );
}

export function BoardView({
  data,
  emptyCopy,
  arenaCapacityLabel,
}: {
  data: BoardViewData;
  emptyCopy: EmptyCopy;
  arenaCapacityLabel: string;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(null);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string, undo?: () => void): void {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), UNDO_MS);
  }

  const slotByMinutes = useMemo(
    () => new Map(data.slots.map((slot) => [slot.startMinutes, slot])),
    [data.slots],
  );
  const partyById = useMemo(
    () => new Map(data.parties.map((party) => [party.bookingId, party])),
    [data.parties],
  );

  const selectedSlot: SlotView | null =
    selection?.kind === 'slot' ? (slotByMinutes.get(selection.startMinutes) ?? null) : null;
  const selectedParty: PartyView | null =
    selection?.kind === 'party' ? (partyById.get(selection.bookingId) ?? null) : null;

  function runBlock(startMinutes: number[], reason: string, acknowledge = false): void {
    setError(null);
    startTransition(async () => {
      const result = await blockSlotsAction({
        date: data.date,
        startMinutes,
        reason,
        acknowledge,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const label = slotByMinutes.get(startMinutes[0])?.timeLabel ?? '';
      showToast(interpolate(mg.block.done, { time: label }), () => {
        startTransition(async () => {
          await unblockSlotsAction({ date: data.date, startMinutes });
          showToast(interpolate(mg.block.undone, { time: label }));
          router.refresh();
        });
      });
      router.refresh();
    });
  }

  function runUnblock(startMinutes: number[]): void {
    setError(null);
    startTransition(async () => {
      const result = await unblockSlotsAction({ date: data.date, startMinutes });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      showToast(
        interpolate(mg.block.undone, {
          time: slotByMinutes.get(startMinutes[0])?.timeLabel ?? '',
        }),
      );
      router.refresh();
    });
  }

  // The arena is a lane on the board, not a separate table: one chip per 15-minute row, so a
  // manager reads seats-used and the room lanes on the same time axis.
  const arenaChips: BoardChip[] = data.slots.map((slot) => ({
    id: `arena:${slot.startMinutes}`,
    columnId: 'arena',
    rowId: slot.rowId,
    state: slot.chipState,
    name: slot.stateWord,
    countLabel: slot.capacityLabel,
    a11yLabel: slot.a11yLabel,
    onSelect: () => setSelection({ kind: 'slot', startMinutes: slot.startMinutes }),
  }));

  const roomChips: BoardChip[] = data.chips.map((chip) => ({
    id: chip.id,
    columnId: chip.columnId,
    rowId: chip.rowId,
    span: chip.span,
    state: chip.state,
    name: chip.name,
    countLabel: chip.countLabel,
    a11yLabel: chip.a11yLabel,
    onSelect: () => setSelection({ kind: 'party', bookingId: chip.bookingId }),
  }));

  const columns = [
    { id: 'arena', name: mg.board.lane.arena, capacityLabel: arenaCapacityLabel },
    ...data.columns,
  ];

  const nothingBooked = data.parties.length === 0 && data.slots.every((slot) => slot.bookings.length === 0);

  return (
    <PageShell width="board" className="py-4">
      {/* ── Date control ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-display-3 text-text">{data.dateLabel}</h1>
        <div className="flex items-center gap-1">
          <Link
            href={`/manage/schedule?date=${data.previousDate}`}
            aria-label={mg.board.prevDay}
            className={buttonClassName('compact')}
          >
            ◀
          </Link>
          <Link href={`/manage/schedule?date=${data.todayIso}`} className={buttonClassName('compact')}>
            {mg.board.today}
          </Link>
          <Link
            href={`/manage/schedule?date=${data.nextDate}`}
            aria-label={mg.board.nextDay}
            className={buttonClassName('compact')}
          >
            ▶
          </Link>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label={mg.board.title}>
          <span aria-current="true" className={cx(buttonClassName('compact'), 'border-accent text-accent')}>
            {mg.board.view.day}
          </span>
          <Link
            href={`/manage/schedule?date=${data.date}&view=week`}
            className={buttonClassName('compact')}
          >
            {mg.board.view.week}
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <UpdatedAgo generatedAtMs={data.generatedAtMs} />
          <button type="button" onClick={() => router.refresh()} className={buttonClassName('ghost')}>
            {mg.board.refresh}
          </button>
          <Link
            href={`/manage/day/${data.date}/sheets`}
            className={buttonClassName('compact')}
          >
            {global.btn.printAllSheets}
          </Link>
        </div>
      </div>

      {/* ── Shift dashboard ──────────────────────────────────────────────────────────── */}
      <section
        aria-label={mg.board.header.nextArrivals}
        className="mt-4 flex flex-wrap items-stretch border border-rule"
      >
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1 px-4 py-2">
          <Eyebrow as="h2">{mg.board.header.nextArrivals}</Eyebrow>
          {data.stats.arrivals.length === 0 ? (
            <p className="text-body-sm text-text-2">{mg.board.header.nextArrivalsNone}</p>
          ) : (
            <ul className="flex flex-col">
              {data.stats.arrivals.map((arrival) => (
                <li key={arrival.bookingId} className="flex items-baseline gap-2 text-body-sm">
                  <span className="font-mono text-mono-sm text-text">{arrival.label}</span>
                  <span className="text-text-3">{arrival.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <HeaderStat label={mg.board.header.parties} value={String(data.stats.partyCount)} />
        <HeaderStat
          label={mg.board.header.deposits}
          value={String(data.stats.depositCount)}
          href="/manage/bookings?status=pending"
          tone={data.stats.depositCount > 0 ? 'alert' : undefined}
        />
        <HeaderStat
          label={mg.board.header.allergies}
          value={String(data.stats.allergyCount)}
          href="#allergies-today"
          tone={data.stats.allergyCount > 0 ? 'alert' : undefined}
        />
        <HeaderStat label={mg.board.header.overrides} value={String(data.stats.overrideCount)} />
      </section>

      {error ? (
        <ValidationMessage tone="error" className="mt-3">
          {error}
        </ValidationMessage>
      ) : null}

      {data.closed ? (
        <div className="mt-4">
          <EmptyState
            title={emptyCopy.closedTitle}
            body={emptyCopy.closedBody}
            action={
              <Link href="/manage/closures" className={buttonClassName('secondary')}>
                {emptyCopy.closedAction}
              </Link>
            }
          />
        </div>
      ) : null}

      {/* ── The board and its inspector ──────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {data.rows.length === 0 ? (
            <EmptyState title={emptyCopy.title} body={emptyCopy.body} />
          ) : (
            <ScheduleBoard
              label={data.gridLabel}
              columns={columns}
              rows={data.rows}
              chips={[...arenaChips, ...roomChips]}
              now={data.now ?? undefined}
            />
          )}

          {nothingBooked && data.rows.length > 0 ? (
            <p className="mt-3 text-body-sm text-text-2">{emptyCopy.body}</p>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <SlotInspector
            date={data.date}
            slot={selectedSlot}
            party={selectedParty}
            pending={pending}
            blockRangeOptions={data.blockRangeOptions}
            onBlock={(minutes, reason) => runBlock(minutes, reason)}
            onBlockAnyway={(minutes, reason) => runBlock(minutes, reason, true)}
            onUnblock={runUnblock}
            onError={setError}
            onDone={() => router.refresh()}
          />
        </aside>
      </div>

      {/* ── Allergy flags, the one thing that must be impossible to miss ─────────────── */}
      <section id="allergies-today" className="mt-8">
        <Eyebrow as="h2" className={data.stats.allergyCount > 0 ? 'text-state-filling' : undefined}>
          {mg.board.header.allergies}
        </Eyebrow>
        <Hairline className="my-2" />
        {data.stats.allergies.length === 0 ? (
          <p className="text-body-sm text-text-2">{empty.allergies.body}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.stats.allergies.map((flag) => (
              <li key={flag.bookingId} className="flex items-center gap-2">
                <Tag tone="filling">{manager.sheet.allergies.label}</Tag>
                <Link href={`/manage/bookings/${flag.bookingId}`} className="text-body-sm text-text underline decoration-1 underline-offset-4">
                  {flag.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Undo toast ───────────────────────────────────────────────────────────────── */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-40 flex items-center gap-4 border border-border bg-raised px-4 py-3 md:left-auto md:right-6 md:w-auto"
        >
          <span className="text-body-sm text-text">{toast.message}</span>
          {toast.undo ? (
            <Button variant="compact" onClick={toast.undo} disabled={pending}>
              {mg.block.undo}
            </Button>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
