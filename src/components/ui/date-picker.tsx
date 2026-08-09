"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { dayOfWeekFor, type LocalDateString } from "@/lib/domain/time";
import { formatDayNumber, formatWeekday } from "@/lib/format";

import { cx } from "./cx";
import { HATCH_6 } from "./styles";

/**
 * Date picker — DESIGN §5.5. Phone-first: a horizontally scrolling week strip, with a month
 * grid behind a toggle.
 *
 * This is the one primitive in the directory that carries `"use client"`, and it earns it:
 * roving `tabindex` needs refs and imperative focus, which cannot be expressed declaratively.
 * Everything else here is data in, callbacks out.
 *
 * Three things the spec is strict about and this implements:
 *
 * - **Selected carries three cues** — accent fill, a 3px top bar, and `aria-selected="true"`.
 * - **Unavailable dates are visible, not missing** — `text-3`, a 6px hatch, a strikethrough on
 *   the number and `aria-disabled="true"`. A date you cannot book still tells you it exists.
 * - **The whole control is one tab stop.** Arrows move by day, `Home`/`End` go to the bounds of
 *   the focused week, and in the month grid `PageUp`/`PageDown` change month.
 *
 * Weekday and day-number strings come from `src/lib/format.ts`, so a date is never assembled
 * with string arithmetic here. `weekdayOverride` is how "Today" and "Tomorrow" get in — those
 * are COPY.md strings and the caller owns them.
 *
 * `scroll-snap` falls back to instant snapping under `prefers-reduced-motion`, which the
 * blanket rule in globals.css already handles.
 */

export type DateAvailability = "open" | "limited" | "none" | "closed";

/** The status bar under each date: what is bookable, at a glance. DESIGN §5.5. */
const STATUS_BAR: Record<DateAvailability, string> = {
  open: "bg-accent",
  limited: "bg-state-filling",
  none: "bg-rule",
  closed: "bg-rule",
};

export interface DateOption {
  date: LocalDateString;
  availability: DateAvailability;
  /** COPY.md status word — `g2.dateStrip.status.*` or `p2.date.status.*`. */
  statusLabel: string;
  /** COPY.md replacement for the weekday, e.g. `g2.dateStrip.today` — "Today". */
  weekdayOverride?: string;
  /** Draws the 1px dotted underline under the number. */
  isToday?: boolean;
  disabled?: boolean;
  /** Overrides the composed accessible name. COPY.md `p2.date.a11y` — "{date}, {status}". */
  a11yLabel?: string;
}

function accessibleName(day: DateOption): string {
  return day.a11yLabel ?? `${formatWeekday(day.date)} ${formatDayNumber(day.date)}, ${day.statusLabel}`;
}

/** Monday-first column index, 0–6. The strip and the grid both read weeks Mon → Sun. */
function mondayIndex(date: LocalDateString): number {
  return (dayOfWeekFor(date) + 6) % 7;
}

function firstEnabled(days: readonly DateOption[]): number {
  const index = days.findIndex((day) => day.disabled !== true);
  return index === -1 ? 0 : index;
}

function nextEnabled(
  days: readonly DateOption[],
  from: number,
  step: number,
): number {
  for (let index = from + step; index >= 0 && index < days.length; index += step) {
    if (days[index].disabled !== true) return index;
  }
  return from;
}

function weekBound(days: readonly DateOption[], from: number, edge: "start" | "end"): number {
  const target = edge === "start" ? 0 : 6;
  const step = edge === "start" ? -1 : 1;
  let index = from;
  while (index >= 0 && index < days.length && mondayIndex(days[index].date) !== target) {
    const next = index + step;
    if (next < 0 || next >= days.length) break;
    index = next;
  }
  return index;
}

interface RovingOptions {
  days: readonly DateOption[];
  selected?: LocalDateString;
}

function useRoving({ days, selected }: RovingOptions) {
  const [focusDate, setFocusDate] = useState<LocalDateString | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const fromFocus = focusDate ? days.findIndex((day) => day.date === focusDate) : -1;
  const fromSelected = selected ? days.findIndex((day) => day.date === selected) : -1;
  const active = fromFocus !== -1 ? fromFocus : fromSelected !== -1 ? fromSelected : firstEnabled(days);

  const moveTo = (index: number) => {
    const clamped = Math.min(days.length - 1, Math.max(0, index));
    setFocusDate(days[clamped]?.date ?? null);
    refs.current[clamped]?.focus();
  };

  return { active, moveTo, refs };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Week strip — the phone default
// ─────────────────────────────────────────────────────────────────────────────────────────

export interface DateStripProps {
  /** COPY.md `g2.dateStrip.label` — the accessible name of the scroller. */
  label: string;
  days: readonly DateOption[];
  selected?: LocalDateString;
  onSelect: (date: LocalDateString) => void;
  className?: string;
}

export function DateStrip({ label, days, selected, onSelect, className }: DateStripProps) {
  const { active, moveTo, refs } = useRoving({ days, selected });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
        moveTo(nextEnabled(days, active, 1));
        break;
      case "ArrowLeft":
        moveTo(nextEnabled(days, active, -1));
        break;
      case "Home":
        moveTo(weekBound(days, active, "start"));
        break;
      case "End":
        moveTo(weekBound(days, active, "end"));
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      role="listbox"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cx(
        "flex snap-x snap-mandatory gap-px overflow-x-auto border border-rule bg-rule",
        className,
      )}
    >
      {days.map((day, index) => {
        const isSelected = day.date === selected;
        const isDisabled = day.disabled === true;
        return (
          <button
            key={day.date}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="option"
            aria-label={accessibleName(day)}
            aria-selected={isSelected}
            aria-disabled={isDisabled || undefined}
            tabIndex={index === active ? 0 : -1}
            onClick={isDisabled ? undefined : () => onSelect(day.date)}
            className={cx(
              "relative flex h-18 w-14 shrink-0 snap-start flex-col items-center justify-center gap-1",
              "transition-colors duration-[var(--duration-fast)] ease-out",
              isSelected
                ? "bg-accent text-ink"
                : isDisabled
                  ? cx("cursor-not-allowed bg-canvas text-text-3", HATCH_6)
                  : "bg-canvas text-text hover:bg-raised",
            )}
          >
            {isSelected ? (
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-ink" />
            ) : null}

            <span aria-hidden="true" className="font-display text-tag uppercase">
              {day.weekdayOverride ?? formatWeekday(day.date, "short")}
            </span>

            <span
              aria-hidden="true"
              className={cx(
                "font-mono text-mono-lg tabular-nums",
                isSelected && "font-bold",
                isDisabled && "line-through decoration-1",
                day.isToday && !isSelected && "border-b border-dotted border-current",
              )}
            >
              {formatDayNumber(day.date)}
            </span>

            <span
              aria-hidden="true"
              className={cx("absolute inset-x-0 bottom-0 h-1", STATUS_BAR[day.availability])}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Month grid — behind the toggle on phone, the default on the party calendar
// ─────────────────────────────────────────────────────────────────────────────────────────

export interface MonthGridProps {
  /** COPY.md `p2.calendar.label` — "{month} — party availability". */
  label: string;
  /** One month of dates in calendar order. Leading blanks are computed, not passed. */
  days: readonly DateOption[];
  selected?: LocalDateString;
  onSelect: (date: LocalDateString) => void;
  /** `PageUp` / `PageDown`. Wire to COPY.md `p2.calendar.prev` / `p2.calendar.next` controls. */
  onMonthChange?: (delta: -1 | 1) => void;
  className?: string;
}

export function MonthGrid({
  label,
  days,
  selected,
  onSelect,
  onMonthChange,
  className,
}: MonthGridProps) {
  const { active, moveTo, refs } = useRoving({ days, selected });

  // Weekday headings are derived from the data rather than hardcoded, so they stay in the
  // product's locale and there is no seventh string to keep in sync.
  const headings = Array.from({ length: 7 }, (_, column) => {
    const sample = days.find((day) => mondayIndex(day.date) === column);
    return sample ? formatWeekday(sample.date, "short") : "";
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
        moveTo(nextEnabled(days, active, 1));
        break;
      case "ArrowLeft":
        moveTo(nextEnabled(days, active, -1));
        break;
      case "ArrowDown":
        moveTo(Math.min(days.length - 1, active + 7));
        break;
      case "ArrowUp":
        moveTo(Math.max(0, active - 7));
        break;
      case "Home":
        moveTo(weekBound(days, active, "start"));
        break;
      case "End":
        moveTo(weekBound(days, active, "end"));
        break;
      case "PageUp":
        onMonthChange?.(-1);
        break;
      case "PageDown":
        onMonthChange?.(1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // Real ARIA rows: a month is weeks of seven, not one long row that happens to wrap. Grid
  // navigation and "row 3 of 6" announcements both depend on this being structural.
  const weeks: Array<Array<{ day: DateOption; index: number } | null>> = [];
  let week: Array<{ day: DateOption; index: number } | null> =
    days.length > 0 ? Array.from({ length: mondayIndex(days[0].date) }, () => null) : [];

  days.forEach((day, index) => {
    week.push({ day, index });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  });
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <div
      role="grid"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx("flex flex-col gap-px border border-rule bg-rule", className)}
    >
      <div role="row" className="grid grid-cols-7 gap-px">
        {headings.map((heading, column) => (
          <span
            key={column}
            role="columnheader"
            className="flex h-8 items-center justify-center bg-canvas font-display text-tag uppercase text-text-2"
          >
            {heading}
          </span>
        ))}
      </div>

      {weeks.map((cells, weekIndex) => (
        <div key={weekIndex} role="row" className="grid grid-cols-7 gap-px">
          {cells.map((cell, column) => {
            if (!cell) {
              return (
                <span key={column} role="gridcell" className="min-h-11 bg-canvas" />
              );
            }
            const { day, index } = cell;
            const isSelected = day.date === selected;
            const isDisabled = day.disabled === true;
            return (
              <button
                key={day.date}
                ref={(node) => {
                  refs.current[index] = node;
                }}
                type="button"
                role="gridcell"
                aria-label={accessibleName(day)}
                aria-selected={isSelected}
                aria-disabled={isDisabled || undefined}
                tabIndex={index === active ? 0 : -1}
                onClick={isDisabled ? undefined : () => onSelect(day.date)}
                className={cx(
                  "relative flex min-h-11 min-w-11 flex-col items-center justify-center",
                  "transition-colors duration-[var(--duration-fast)] ease-out",
                  isSelected
                    ? "bg-accent text-ink"
                    : isDisabled
                      ? cx("cursor-not-allowed bg-canvas text-text-3", HATCH_6)
                      : "bg-canvas text-text hover:bg-raised",
                )}
              >
                {isSelected ? (
                  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-ink" />
                ) : null}

                <span
                  aria-hidden="true"
                  className={cx(
                    "font-mono text-mono-md tabular-nums",
                    isSelected && "font-bold",
                    isDisabled && "line-through decoration-1",
                    day.isToday && !isSelected && "border-b border-dotted border-current",
                  )}
                >
                  {formatDayNumber(day.date)}
                </span>

                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute inset-x-0 bottom-0 h-[3px]",
                    STATUS_BAR[day.availability],
                  )}
                />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
