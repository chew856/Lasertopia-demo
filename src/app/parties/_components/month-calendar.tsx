"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, MonthGrid, type DateOption } from "@/components/ui";
import { party } from "@/lib/copy";
import type { LocalDateString } from "@/lib/domain";

/**
 * The month calendar. Selection and month navigation are URL changes, not client state, so the
 * hardware back button walks back through dates correctly and every date is a shareable,
 * server-rendered, re-validated view (STRATEGY §0, route-per-step).
 *
 * The marks on the cells are computed for *this* party. `p2.date.status.full` is worded "No
 * windows for this party" for exactly that reason — the venue may be wide open for somebody
 * else's guest count.
 */
export function MonthCalendar({
  label,
  days,
  selected,
  hrefFor,
  prevHref,
  nextHref,
}: {
  label: string;
  days: readonly DateOption[];
  selected?: LocalDateString;
  hrefFor: (date: LocalDateString) => string;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const go = (href: string) => startTransition(() => router.push(href));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={prevHref === null}
          onClick={prevHref ? () => go(prevHref) : undefined}
        >
          {party.p2.calendar.prev}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={nextHref === null}
          onClick={nextHref ? () => go(nextHref) : undefined}
        >
          {party.p2.calendar.next}
        </Button>
      </div>

      <MonthGrid
        label={label}
        days={days}
        selected={selected}
        onSelect={(date) => go(hrefFor(date))}
        onMonthChange={(delta) => {
          const href = delta === -1 ? prevHref : nextHref;
          if (href) go(href);
        }}
      />
    </div>
  );
}
