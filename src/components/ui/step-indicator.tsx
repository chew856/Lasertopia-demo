import { cx } from "./cx";
import { MonoValue } from "./typography";

/**
 * Flow step indicator — DESIGN §4.7.
 *
 * A full-width row of 4px segments with 1px gaps above the heading. Complete segments are
 * accent, the current segment is accent and 6px tall, upcoming segments are `rule`.
 *
 * The bar alone never carries the state: it is always paired with a `mono-xs` label. That
 * label's wording ("STEP 2 / 4") is a DESIGN specification with no COPY.md key, so it is a
 * required prop — the surface team passes the string it owns.
 */
export interface StepIndicatorProps {
  /** 1-based. */
  current: number;
  total: number;
  /** The `mono-xs` readout, e.g. `STEP 2 / 4`. Never omitted — the bar is not enough. */
  label: string;
  /** Accessible name for the progress role, e.g. "Booking progress". */
  a11yLabel: string;
  className?: string;
}

export function StepIndicator({
  current,
  total,
  label,
  a11yLabel,
  className,
}: StepIndicatorProps) {
  const steps = Array.from({ length: total }, (_, index) => index + 1);

  return (
    <div
      className={cx("flex flex-col gap-2", className)}
      role="group"
      aria-label={a11yLabel}
    >
      <div className="flex items-end gap-px" aria-hidden="true">
        {steps.map((step) => (
          <span
            key={step}
            className={cx(
              "flex-1",
              step === current
                ? "h-1.5 bg-accent"
                : step < current
                  ? "h-1 bg-accent"
                  : "h-1 bg-rule",
            )}
          />
        ))}
      </div>
      <MonoValue step="xs" className="uppercase text-text-2">
        {label}
      </MonoValue>
    </div>
  );
}
