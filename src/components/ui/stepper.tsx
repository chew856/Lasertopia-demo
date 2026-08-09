import type { ReactNode } from "react";

import { cx } from "./cx";
import { FieldLabel } from "./typography";

/**
 * Stepper — DESIGN §5.4. Guest count, player count, add-on quantity.
 *
 * Geometry: 48px tall, 48×48 minus and plus, a 72px value cell between 1px interactive rules.
 * Both controls clear the 44px minimum on their own.
 *
 * Four things this component does that a plain pair of buttons does not:
 *
 * 1. **The number never animates.** No slide, no fade, no roll. A count that moves is a count
 *    you cannot compare against the tile beside it.
 * 2. **The value is a real `<input type="number">`**, so it is directly editable and reachable
 *    by keyboard rather than requiring fourteen taps to get from 6 to 20.
 * 3. **The bound is announced, not just enforced.** At `max`, plus takes `aria-disabled`, the
 *    6px hatch and `cursor: not-allowed` — it stays focusable so a screen-reader user can find
 *    it and hear why, rather than having it vanish from the tab order.
 * 4. **The capacity hint is part of the component**, not a footnote. It is a live constraint
 *    from the brief and it changes with the selected room or slot — DESIGN principle 6.
 *
 * The glyphs are `−` (U+2212) and `+` drawn as text, per the spec. They are not icons.
 *
 * Controlled: pass `value` and `onChange`. No internal state, so no `"use client"` here — the
 * caller owns the state and therefore the boundary.
 */

export interface StepperProps {
  id: string;
  /** COPY.md label, e.g. `g1.players.label`. */
  label: string;
  /** Hides the label visually but keeps it for assistive tech — add-on quantity rows. */
  labelHidden?: boolean;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** COPY.md `aria-label` for minus, e.g. `g1.players.decrease` — "One fewer player". */
  decreaseLabel: string;
  /** COPY.md `aria-label` for plus, e.g. `p1.guests.increase` — "One more guest". */
  increaseLabel: string;
  /** COPY.md capacity hint, e.g. `g1.players.atCap` or `p1.guests.hint.twoRooms`. */
  hint?: ReactNode;
  /**
   * 48px default; 44px inside an add-on quantity row.
   *
   * DESIGN §5.8 specifies 40px here, which contradicts §5's own >=44px floor and §8's
   * "measure the stepper buttons" gate. Every compact instance is a customer surface reached
   * on a phone — add-on quantity, and the guest-count editor on the review screen, which
   * moves the price — so the floor wins and §5.8 needs correcting. The row is `min-h-18`
   * (72px), so nothing reflows.
   */
  size?: "default" | "compact";
  disabled?: boolean;
  className?: string;
}

const SIZE = {
  default: { frame: "h-12", control: "w-12", value: "w-18 text-mono-lg" },
  compact: { frame: "h-11", control: "w-11", value: "w-16 text-mono-md" },
} as const;

const CONTROL_BASE = cx(
  "flex shrink-0 items-center justify-center font-mono text-mono-lg text-text select-none",
  "transition-colors duration-[var(--duration-fast)] ease-out",
  "hover:bg-raised active:translate-y-px",
  "aria-disabled:cursor-not-allowed aria-disabled:text-text-3 aria-disabled:bg-[image:var(--hatch-6)]",
  "aria-disabled:hover:bg-transparent aria-disabled:hover:bg-[image:var(--hatch-6)] aria-disabled:active:translate-y-0",
);

export function Stepper({
  id,
  label,
  labelHidden = false,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  hint,
  size = "default",
  disabled = false,
  className,
}: StepperProps) {
  const dims = SIZE[size];
  const atMin = disabled || value <= min;
  const atMax = disabled || value >= max;

  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div className={cx("flex flex-col", className)}>
      <FieldLabel htmlFor={id} className={labelHidden ? "sr-only" : "mb-2"}>
        {label}
      </FieldLabel>

      <div
        className={cx(
          "inline-flex w-fit items-stretch border border-border bg-canvas",
          dims.frame,
          disabled && "border-rule bg-[image:var(--hatch-6)]",
        )}
      >
        <button
          type="button"
          aria-label={decreaseLabel}
          aria-disabled={atMin || undefined}
          onClick={atMin ? undefined : () => onChange(clamp(value - 1))}
          className={cx(CONTROL_BASE, dims.control, "border-r border-border")}
        >
          {"−"}
        </button>

        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={1}
          disabled={disabled}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            if (Number.isNaN(next)) return;
            onChange(clamp(next));
          }}
          className={cx(
            "min-w-0 bg-transparent text-center font-mono tabular-nums text-text",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            "disabled:cursor-not-allowed disabled:text-text-3",
            dims.value,
          )}
        />

        <button
          type="button"
          aria-label={increaseLabel}
          aria-disabled={atMax || undefined}
          onClick={atMax ? undefined : () => onChange(clamp(value + 1))}
          className={cx(CONTROL_BASE, dims.control, "border-l border-border")}
        >
          +
        </button>
      </div>

      {/*
        DESIGN §5.4: an `aria-live` region announces the value. The visible number is inside an
        input, whose value changes are not announced on their own when they move under a button
        press rather than a keystroke.
      */}
      <output htmlFor={id} aria-live="polite" className="sr-only">
        {`${label}: ${value}`}
      </output>

      {hint ? <p className="mt-2 max-w-[56ch] text-caption text-text-3">{hint}</p> : null}
    </div>
  );
}
