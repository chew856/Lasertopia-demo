"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Caption, MonoValue, cx } from "@/components/ui";
import { global, interpolate } from "@/lib/copy";
import { formatCountdown } from "@/lib/format";

import { EXTEND_INITIAL } from "../_lib/action-state";
import { extendHold } from "../actions";

/**
 * The hold countdown — COPY.md §2.4.
 *
 * The clock ticks here and only here. Everything else in the flow takes `now` from the
 * server, because a laptop with a wrong clock must not be able to talk itself into a booking;
 * a countdown is the one place the browser's clock is the right one to read, since it is
 * measuring the customer's own remaining time and the server re-checks the hold at every step
 * regardless of what this says.
 *
 * At zero it refreshes the route rather than deciding anything: the server owns whether the
 * time is still available and which half of `err.holdExpired.games.*` the customer should be
 * reading.
 *
 * WHAT THIS HOLD IS. It reserves the customer's place in the flow, not the seats in the
 * arena — see `_lib/draft.ts` for why, and the handover for what that costs.
 */
export function HoldBar({
  draftId,
  heldUntil,
  holdMinutes,
  gameBlock,
  alreadyExtended,
  className,
}: {
  draftId: string;
  /** Epoch milliseconds. */
  heldUntil: number;
  holdMinutes: number;
  /** `fmt.block` — "6:00 → 6:30 PM". */
  gameBlock: string;
  alreadyExtended: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [state, formAction, extending] = useActionState(extendHold, EXTEND_INITIAL);
  const deadline = state.heldUntil ?? heldUntil;
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((deadline - Date.now()) / 1000)),
  );

  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (secondsLeft === 0) router.refresh();
  }, [secondsLeft, router]);

  const spent = alreadyExtended || state.spent;

  return (
    <section className={cx("border border-rule border-l-[3px] border-l-accent bg-raised p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-label uppercase text-text-2">{global.hold.label}</p>
        <MonoValue step="md" className={secondsLeft <= 60 ? "text-state-filling" : "text-accent"}>
          {interpolate(global.hold.countdown, { holdRemaining: formatCountdown(secondsLeft) })}
        </MonoValue>
      </div>

      <p className="mt-2 max-w-[56ch] text-body-sm text-text-2">
        {interpolate(global.hold.gamesExplain, { gameBlock, holdMinutes })}
      </p>

      {/* Fires once at a minute left. Polite, because it is a nudge and not an error. */}
      <p aria-live="polite" className="sr-only">
        {secondsLeft > 0 && secondsLeft <= 60 ? global.hold.expiringSoon : ""}
      </p>

      {spent ? (
        <Caption className="mt-3">{global.hold.extendUsed}</Caption>
      ) : (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="draftId" value={draftId} />
          <Button type="submit" variant="ghost" fullWidth={false} pending={extending} pendingLabel={global.loading.saving}>
            {global.btn.extendHold}
          </Button>
        </form>
      )}

      {state.heldUntil !== null && state.spent && !alreadyExtended ? (
        <p aria-live="polite" className="mt-2 text-caption text-accent">
          {interpolate(global.hold.extended, { holdRemaining: formatCountdown(secondsLeft) })}
        </p>
      ) : null}
    </section>
  );
}
