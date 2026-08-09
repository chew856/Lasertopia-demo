import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "./cx";
import { CheckMark } from "./marks";

/**
 * Checkbox — the box drawn in DESIGN §5.8, used on its own for the acknowledgement checkboxes
 * both review screens require (house rules, deposit policy, headcount).
 *
 * 24×24, 1px interactive boundary, sunken fill; checked is an accent fill with an ink tick in
 * 2px CSS-drawn strokes. The tick is hidden by setting the box's text colour to transparent
 * rather than by toggling opacity, so it inherits from the same `currentColor` the mark uses
 * and there is one state class instead of two.
 *
 * Everything is driven by CSS from the real `<input>`, which means the component works
 * controlled or uncontrolled and renders correctly on the server either way.
 *
 * The focus ring is on the **label**, not the box, so the hit area and the ring agree — the
 * whole label is the target. That is drawn with an outline rather than the global
 * `:focus-visible` because the focused element is the visually hidden input.
 */

const BOX = cx(
  "mt-0.5 flex size-6 shrink-0 items-center justify-center border border-border bg-sunken text-transparent",
  "transition-colors duration-[var(--duration-fast)] ease-out",
  "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-ink",
  "peer-focus-visible:border-2",
  "peer-disabled:border-rule peer-disabled:bg-[image:var(--hatch-6)] peer-disabled:text-text-3",
);

const LABEL = cx(
  "group flex min-h-11 cursor-pointer items-start gap-3 py-2",
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:text-text-3",
);

export interface CheckboxProps
  extends Omit<ComponentPropsWithoutRef<"input">, "className" | "id" | "type"> {
  id: string;
  /** COPY.md label, e.g. `g4.ack.label`. */
  label: ReactNode;
  /** COPY.md body that sits beside the checkbox, never in fine print — e.g. `g4.ack.body`. */
  description?: ReactNode;
  className?: string;
}

export function Checkbox({ id, label, description, className, ...rest }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cx(LABEL, className)}>
      <input {...rest} id={id} type="checkbox" className="peer sr-only" />
      <span aria-hidden="true" className={BOX}>
        <CheckMark className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body text-text">{label}</span>
        {description ? (
          <span className="mt-1 block max-w-[56ch] text-body-sm text-text-2">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
