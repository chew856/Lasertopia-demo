"use client";

import { useEffect, useState } from "react";

import { Caption, MonoValue } from "@/components/ui";
import { global, interpolate } from "@/lib/copy";
import { formatCountdown } from "@/lib/format";

/**
 * The hold countdown.
 *
 * Seeded from a server-computed number of seconds and ticked locally, so there is no hydration
 * mismatch and no client clock is ever trusted for a decision — the countdown is a courtesy;
 * the hold's real expiry is `holdExpiresAt` on the row, checked server-side on every render.
 */
export function HoldCountdown({ initialSeconds }: { initialSeconds: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
    if (initialSeconds <= 0) return;
    const timer = setInterval(() => {
      setSeconds((current) => (current <= 0 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [initialSeconds]);

  return (
    <span className="flex flex-col gap-0.5">
      <Caption>{global.hold.label}</Caption>
      <MonoValue step="sm">
        {interpolate(global.hold.countdown, { holdRemaining: formatCountdown(seconds) })}
      </MonoValue>
      {seconds > 0 && seconds <= 60 ? (
        <span aria-live="polite" className="text-caption text-state-filling">
          {global.hold.expiringSoon}
        </span>
      ) : null}
    </span>
  );
}
