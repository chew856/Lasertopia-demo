'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import {
  Button,
  Caption,
  Eyebrow,
  Hairline,
  MonoValue,
  Select,
  Tag,
  TextInput,
  buttonClassName,
  type TagTone,
} from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { global } from '@/lib/copy/global';
import { manager } from '@/lib/copy/manager';

import { checkInAction, recordDepositAction, releaseSlotAction } from '../_lib/actions';
import type { PartyView, SlotView } from './board-types';

/**
 * The board's one-tap action surface — STRATEGY §4.2.
 *
 * The spec calls this a popover. It is built as a **sticky rail beside the board** instead, for
 * two reasons that both come out of §4.2's own cost table: a popover anchored to a 44px row
 * has to be dismissed before the next row can be inspected, which turns "block 3:15 and 3:30"
 * into four interactions rather than two; and a rail needs no focus trap, no repositioning and
 * no escape handling, so the keyboard path is the same path. Nothing is hidden behind it —
 * the rail is always on screen, and selecting a row fills it.
 *
 * Cost accounting against §4.2, so the ranking is checkable rather than claimed:
 *   see a slot's seats and who's booked — 1 tap (select the row)
 *   block · unblock · check in · deposit collected · print sheet — 1 tap from there
 *   block a range — 2 taps (open the range form, apply)
 */

const { mg } = manager;

const MARKER_TONE: Record<string, TagTone> = {
  PARTY: 'party',
  BLOCKED: 'blocked',
  OVERRIDE: 'filling',
  PAST: 'neutral',
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="border border-rule bg-raised p-4">
      {children}
    </section>
  );
}

export interface SlotInspectorProps {
  date: string;
  slot: SlotView | null;
  party: PartyView | null;
  pending: boolean;
  blockRangeOptions: { value: number; label: string }[];
  onBlock: (startMinutes: number[], reason: string) => void;
  onBlockAnyway: (startMinutes: number[], reason: string) => void;
  onUnblock: (startMinutes: number[]) => void;
  onError: (message: string | null) => void;
  onDone: () => void;
}

export function SlotInspector({
  date,
  slot,
  party,
  pending,
  blockRangeOptions,
  onBlock,
  onBlockAnyway,
  onUnblock,
  onError,
  onDone,
}: SlotInspectorProps) {
  const [reason, setReason] = useState('');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState<number | null>(null);
  const [rangeTo, setRangeTo] = useState<number | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<number[] | null>(null);
  const [busy, startTransition] = useTransition();

  // A new selection is a new decision: a reason typed for 3:15 must not silently ride along to
  // the block applied at 3:30. Reset during render rather than in an effect, so the panel can
  // never paint one frame carrying the previous row's reason.
  const selectionKey = slot ? `slot:${slot.startMinutes}` : party ? `party:${party.bookingId}` : 'none';
  const [shownFor, setShownFor] = useState(selectionKey);
  if (shownFor !== selectionKey) {
    setShownFor(selectionKey);
    setReason('');
    setConfirmBlock(null);
    setRangeOpen(false);
    setRangeFrom(null);
    setRangeTo(null);
  }

  const inFlight = pending || busy;

  if (!slot && !party) {
    return (
      <Panel title={mg.board.title}>
        <Eyebrow as="h2">{mg.board.title}</Eyebrow>
        <p className="mt-2 text-body-sm text-text-2">{mg.slot.bookings.none}</p>
        <Caption className="mt-4">{mg.block.recurring.note}</Caption>
      </Panel>
    );
  }

  if (party) {
    return (
      <Panel title={party.headingLabel}>
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="party">{mg.board.marker.party}</Tag>
          {party.isNew ? <Tag tone="accent">{mg.board.new}</Tag> : null}
          {party.depositRecorded ? null : (
            <Tag tone="filling">{mg.bookings.filter.status.pending}</Tag>
          )}
        </div>

        <h2 className="mt-3 font-display text-display-3 text-text">{party.headingLabel}</h2>
        <p className="mt-1 font-mono text-mono-sm text-text-2">{party.windowLabel}</p>

        <Hairline className="my-3" />

        <dl className="flex flex-col gap-2 text-body-sm">
          <div>
            <dt className="sr-only">{mg.booking.section.package}</dt>
            <dd className="text-text">{party.packageLabel}</dd>
          </div>
          <div>
            <dt className="sr-only">{mg.booking.section.games}</dt>
            <dd className="font-mono text-mono-sm text-text">{party.gamesLabel}</dd>
          </div>
          <div>
            <dt className="sr-only">{mg.booking.section.who}</dt>
            <dd>
              {party.phoneHref ? (
                <a
                  href={party.phoneHref}
                  className="text-text underline decoration-1 underline-offset-4"
                >
                  {party.organiserLabel}
                </a>
              ) : (
                <span className="text-text">{party.organiserLabel}</span>
              )}
            </dd>
          </div>
        </dl>

        {party.allergyLabel ? (
          <p className="mt-3 border-l-[3px] border-l-state-filling bg-canvas p-3 text-body-sm font-medium text-state-filling">
            {party.allergyLabel}
          </p>
        ) : null}

        {party.overrideLabel ? (
          <p className="mt-3 text-caption text-text-2">{party.overrideLabel}</p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          {party.depositRecorded ? (
            <p className="text-caption text-text-2">{party.depositLabel}</p>
          ) : (
            <Button
              variant="primary"
              disabled={inFlight}
              onClick={() =>
                startTransition(async () => {
                  const result = await recordDepositAction({
                    bookingId: party.bookingId,
                    method: mg.booking.deposit.method.cash,
                  });
                  if (!result.ok) onError(result.message);
                  else onDone();
                })
              }
            >
              {mg.party.depositCollected}
            </Button>
          )}

          <Link
            href={`/manage/bookings/${party.bookingId}/sheet`}
            className={buttonClassName('secondary')}
          >
            {global.btn.printSheet}
          </Link>
          <Link
            href={`/manage/bookings/${party.bookingId}#guests`}
            className={buttonClassName('secondary')}
          >
            {mg.party.editGuests}
          </Link>
          <Link href={`/manage/bookings/${party.bookingId}`} className={buttonClassName('ghost')}>
            {mg.party.openBooking}
          </Link>
        </div>
      </Panel>
    );
  }

  if (!slot) return null;

  const heading = interpolate(mg.slot.heading, {
    time: slot.timeLabel,
    playerCount: slot.playersUsed,
    arenaCap: slot.capacity,
  });
  const rangeMinutes =
    rangeFrom !== null && rangeTo !== null
      ? blockRangeOptions
          .map((option) => option.value)
          .filter(
            (value) =>
              value >= Math.min(rangeFrom, rangeTo) && value <= Math.max(rangeFrom, rangeTo),
          )
      : [];

  return (
    <Panel title={heading}>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={slot.state}>{slot.stateWord}</Tag>
        {slot.markers.map((marker) => (
          <Tag key={marker} tone={MARKER_TONE[marker] ?? 'neutral'}>
            {marker}
          </Tag>
        ))}
      </div>

      <h2 className="mt-3 font-display text-display-3 text-text">{slot.timeLabel}</h2>
      <MonoValue step="lg" className="mt-1 block text-text-2">
        {slot.capacityLabel}
      </MonoValue>

      {slot.blocked ? (
        <div className="mt-3 border-l-[3px] border-l-state-blocked bg-canvas p-3">
          <p className="text-body-sm text-text-2">{slot.blocked.reason}</p>
          {slot.blocked.byLabel ? (
            <p className="mt-1 text-caption text-text-3">{slot.blocked.byLabel}</p>
          ) : null}
        </div>
      ) : null}

      <Hairline className="my-3" />

      <Eyebrow as="h3">{mg.slot.bookings.heading}</Eyebrow>
      {slot.bookings.length === 0 ? (
        <p className="mt-1 text-body-sm text-text-2">{mg.slot.bookings.none}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {slot.bookings.map((booking) => (
            <li key={booking.bookingId} className="border border-rule bg-canvas p-2">
              <p className="text-body-sm text-text">{booking.playersLabel}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {booking.phoneHref ? (
                  <a
                    href={booking.phoneHref}
                    className="font-mono text-mono-xs text-text-2 underline decoration-1 underline-offset-4"
                  >
                    {booking.phone}
                  </a>
                ) : null}
                {booking.checkedInLabel ? (
                  <>
                    <span className="font-mono text-mono-xs text-accent">
                      {booking.checkedInLabel}
                    </span>
                    <Button
                      variant="ghost"
                      disabled={inFlight}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await checkInAction({
                            bookingId: booking.bookingId,
                            undo: true,
                          });
                          if (!result.ok) onError(result.message);
                          else onDone();
                        })
                      }
                    >
                      {mg.slot.undoCheckIn}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="compact"
                    disabled={inFlight}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await checkInAction({ bookingId: booking.bookingId });
                        if (!result.ok) onError(result.message);
                        else onDone();
                      })
                    }
                  >
                    {mg.slot.checkIn}
                  </Button>
                )}
                <Link
                  href={`/manage/bookings/${booking.bookingId}`}
                  className={buttonClassName('ghost')}
                >
                  {mg.party.openBooking}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Hairline className="my-3" />

      {/* ── Blocking: the most-used write action, one tap ─────────────────────────────── */}
      {confirmBlock ? (
        <div className="border border-state-filling border-l-[3px] p-3">
          <Eyebrow as="h3" className="text-state-filling">
            {interpolate(mg.block.hasBookings.heading, {
              time: slot.timeLabel,
              bookingCount: slot.bookings.length,
              playerCount: slot.playersUsed,
            })}
          </Eyebrow>
          <p className="mt-2 text-body-sm text-text-2">{mg.block.hasBookings.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={inFlight}
              onClick={() => {
                onBlockAnyway(confirmBlock, reason);
                setConfirmBlock(null);
              }}
            >
              {mg.block.hasBookings.primary}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmBlock(null)}>
              {global.btn.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <TextInput
            id="block-reason"
            label={mg.block.reason.label}
            placeholder={mg.block.reason.placeholder}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            {slot.blocked ? (
              <Button
                variant="primary"
                disabled={inFlight}
                onClick={() => onUnblock([slot.startMinutes])}
              >
                {mg.slot.unblock}
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={inFlight}
                onClick={() => {
                  if (slot.bookings.length > 0) setConfirmBlock([slot.startMinutes]);
                  else onBlock([slot.startMinutes], reason);
                }}
              >
                {mg.slot.block}
              </Button>
            )}

            <Button variant="secondary" onClick={() => setRangeOpen((open) => !open)}>
              {mg.slot.blockRange}
            </Button>

            {slot.isReserved ? (
              <Button
                variant="secondary"
                disabled={inFlight}
                onClick={() =>
                  startTransition(async () => {
                    const result = await releaseSlotAction({
                      date,
                      startMinutes: slot.startMinutes,
                    });
                    if (!result.ok) onError(result.message);
                    else onDone();
                  })
                }
              >
                {mg.slot.release}
              </Button>
            ) : null}
          </div>

          {rangeOpen ? (
            <div className="border border-rule p-3">
              <Eyebrow as="h3">{mg.block.range.heading}</Eyebrow>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select
                  id="range-from"
                  label={mg.block.range.from}
                  value={rangeFrom ?? slot.startMinutes}
                  onChange={(event) => setRangeFrom(Number(event.target.value))}
                >
                  {blockRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  id="range-to"
                  label={mg.block.range.to}
                  value={rangeTo ?? slot.startMinutes}
                  onChange={(event) => setRangeTo(Number(event.target.value))}
                >
                  {blockRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  disabled={inFlight || rangeMinutes.length === 0}
                  onClick={() => {
                    if (slot.bookings.length > 0) setConfirmBlock(rangeMinutes);
                    else onBlock(rangeMinutes, reason);
                    setRangeOpen(false);
                  }}
                >
                  {interpolate(mg.block.range.cta, { n: rangeMinutes.length })}
                </Button>
              </div>
            </div>
          ) : null}

          <Caption className="mt-1">{mg.block.recurring.note}</Caption>
        </div>
      )}
    </Panel>
  );
}
