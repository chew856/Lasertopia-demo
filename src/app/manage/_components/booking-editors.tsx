'use client';

import { useState, useTransition } from 'react';

import {
  Button,
  Caption,
  Eyebrow,
  Select,
  Stepper,
  TextArea,
  TextInput,
  ValidationMessage,
  cx,
} from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { global } from '@/lib/copy/global';
import { manager } from '@/lib/copy/manager';
import { party } from '@/lib/copy/party';

import { changeGuestCountAction, recordDepositAction, saveNotesAction } from '../_lib/actions';
import type { Breach } from '../_lib/override';

/**
 * The in-place editors on `/manage/bookings/[id]` — STRATEGY §4.6.
 *
 * The override flow is the reason these are client components. §4.4 requires the modal to be
 * *triggered only from an action that was rejected* and to restate what is being broken in
 * specific terms, which means the server has to answer first and the screen has to react to
 * that answer. So the sequence is always: try → server computes the breach → the reason field
 * appears with the real numbers in it → try again with the reason → for the arena, one more
 * explicit confirmation.
 *
 * Nothing here decides whether an override is allowed. It renders what the server said and
 * sends back what the manager typed; `changeGuestCountAction` re-runs the whole fit check.
 */

const { mg } = manager;

const REASON_CHIPS = [
  mg.override.reason.chip1,
  mg.override.reason.chip2,
  mg.override.reason.chip3,
  mg.override.reason.chip4,
  mg.override.reason.chip5,
] as const;

function breachSentence(
  breach: Breach,
  context: { windowLabel: string; ageBand: number; timeLabel: (startMinutes: number) => string },
): string {
  switch (breach.kind) {
    case 'room':
      return interpolate(mg.override.room.body, {
        window: context.windowLabel,
        roomMax: breach.roomMax,
        guests: breach.guests,
        n: breach.over,
      });
    case 'arena':
      return interpolate(mg.override.arena.body, {
        time: context.timeLabel(breach.startMinutes),
        playerCount: breach.playerCount,
        arenaCap: breach.arenaCapacity,
        players: breach.players,
        n: breach.over,
      });
    case 'age':
      return interpolate(mg.override.age.body, {
        otherAge: breach.otherAge,
        age: breach.age,
        n: breach.gap,
        ageBand: context.ageBand,
      });
  }
}

export function GuestCountEditor({
  bookingId,
  guests,
  minGuests,
  maxGuests,
  windowLabel,
  ageBand,
  timeLabels,
}: {
  bookingId: string;
  guests: number;
  minGuests: number;
  maxGuests: number;
  windowLabel: string;
  ageBand: number;
  /** `startMinutes` → formatted time, so the breach sentence never formats a clock itself. */
  timeLabels: Record<string, string>;
}) {
  const [value, setValue] = useState(guests);
  const [reason, setReason] = useState('');
  const [breaches, setBreaches] = useState<Breach[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  /** The engine speaks minutes; every clock on screen is formatted on the server. */
  const timeLabel = (startMinutes: number): string =>
    timeLabels[String(startMinutes)] ?? String(startMinutes);

  const needsSecondConfirmation =
    breaches?.some((breach) => breach.kind === 'arena' || breach.kind === 'age') ?? false;

  function submit(confirmed: boolean): void {
    setSaved(false);
    startTransition(async () => {
      const result = await changeGuestCountAction({
        bookingId,
        guests: value,
        overrideReason: reason.trim() === '' ? undefined : reason,
        confirmed,
      });
      if (result.ok) {
        setBreaches(null);
        setReason('');
        setMessage(null);
        setSaved(true);
        return;
      }
      setMessage(result.message);
      setBreaches(result.breaches ?? null);
    });
  }

  return (
    <div id="guests" className="flex flex-col gap-4">
      <Stepper
        id="guest-count"
        label={mg.booking.edit.guests}
        value={value}
        min={minGuests}
        max={maxGuests}
        onChange={setValue}
        // Both controls previously carried the same accessible name, so a screen reader
        // announced "Change guest count, button" twice with no way to tell minus from plus.
        decreaseLabel={party.p1.guests.decrease}
        increaseLabel={party.p1.guests.increase}
        hint={interpolate(mg.booking.edit.recheck, { ageBand })}
      />

      {breaches && breaches.length > 0 ? (
        <div className="border border-state-filling border-l-[3px] p-3">
          <Eyebrow as="h3" className="text-state-filling">
            {mg.override.heading}
          </Eyebrow>
          <ul className="mt-2 flex flex-col gap-2">
            {breaches.map((breach, index) => (
              <li key={`${breach.kind}-${index}`} className="text-body-sm text-text">
                {breachSentence(breach, { windowLabel, ageBand, timeLabel })}
                {breach.kind === 'arena' && breach.alsoBooked.length > 0 ? (
                  <span className="mt-1 block text-caption text-text-2">
                    {interpolate(mg.override.arena.confirm.body, {
                      arenaCap: breach.arenaCapacity,
                      time: timeLabel(breach.startMinutes),
                      playerCount: breach.playerCount,
                      list: breach.alsoBooked.join(', '),
                    })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            {REASON_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                aria-pressed={reason === chip}
                onClick={() => setReason(chip)}
                className={cx(
                  'inline-flex h-8 items-center border px-3 font-display text-tag uppercase',
                  reason === chip
                    ? 'border-accent bg-accent-wash text-accent'
                    : 'border-border text-text-2 hover:border-accent',
                )}
              >
                {chip}
              </button>
            ))}
          </div>

          <TextInput
            id="override-reason"
            className="mt-3"
            label={mg.override.reason.label}
            helper={mg.override.reason.help}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />

          {needsSecondConfirmation ? (
            <div className="mt-3 border border-state-full border-l-[3px] p-3">
              <Eyebrow as="h4" className="text-state-full">
                {mg.override.arena.confirm.heading}
              </Eyebrow>
              <Button
                variant="secondary"
                disabled={pending || reason.trim().length < 3}
                onClick={() => submit(true)}
              >
                {mg.override.confirm.yes}
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              disabled={pending || reason.trim().length < 3}
              onClick={() => submit(true)}
            >
              {mg.override.cta}
            </Button>
          )}
        </div>
      ) : null}

      {message && !breaches ? <ValidationMessage tone="error">{message}</ValidationMessage> : null}
      {saved ? <ValidationMessage tone="success">{mg.toast.saved}</ValidationMessage> : null}

      <div>
        <Button
          variant="secondary"
          disabled={pending || value === guests}
          onClick={() => submit(false)}
        >
          {global.btn.save}
        </Button>
      </div>
    </div>
  );
}

export function NotesEditor({ bookingId, notes }: { bookingId: string; notes: string }) {
  const [value, setValue] = useState(notes);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <TextArea
        id="booking-notes"
        label={mg.booking.edit.notes}
        value={value}
        rows={4}
        onChange={(event) => {
          setValue(event.target.value);
          setSaved(false);
        }}
      />
      <Caption>{global.rule.nutFree}</Caption>
      {error ? <ValidationMessage tone="error">{error}</ValidationMessage> : null}
      {saved ? <ValidationMessage tone="success">{mg.toast.saved}</ValidationMessage> : null}
      <div>
        <Button
          variant="secondary"
          disabled={pending || value === notes}
          onClick={() =>
            startTransition(async () => {
              const result = await saveNotesAction({ bookingId, notes: value });
              if (result.ok) {
                setSaved(true);
                setError(null);
              } else {
                setError(result.message);
              }
            })
          }
        >
          {global.btn.save}
        </Button>
      </div>
    </div>
  );
}

export function DepositRecorder({ bookingId }: { bookingId: string }) {
  const [method, setMethod] = useState<string>(mg.booking.deposit.method.cash);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <Select
        id="deposit-method"
        label={mg.booking.deposit.method.label}
        value={method}
        onChange={(event) => setMethod(event.target.value)}
      >
        {[
          mg.booking.deposit.method.cash,
          mg.booking.deposit.method.card,
          mg.booking.deposit.method.etransfer,
          mg.booking.deposit.method.cheque,
        ].map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      {error ? <ValidationMessage tone="error">{error}</ValidationMessage> : null}
      <div>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await recordDepositAction({ bookingId, method });
              if (!result.ok) setError(result.message);
            })
          }
        >
          {mg.booking.deposit.record}
        </Button>
      </div>
    </div>
  );
}
