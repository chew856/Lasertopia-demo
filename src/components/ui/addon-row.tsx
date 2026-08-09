import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "./cx";
import { CheckMark } from "./marks";

/**
 * Add-on toggle row — DESIGN §5.8.
 *
 * The whole 72px row is the `<label>`, so the tap target is the row and not the 24px box. Two
 * cues mark a checked row, never one: a `raised` fill **and** a 3px accent left bar. The bar is
 * a transparent 3px border at rest, so selecting one shifts nothing.
 *
 * Unavailable add-ons render **disabled with a reason**, never hidden — a parent comparing
 * packages needs to see what they would be giving up, which is why the 5-Up Arcade Card still
 * appears under *Around The World* with the caption explaining why it is greyed.
 *
 * The quantity stepper is a slot rather than a built-in: it appears only when checked, and
 * whether it appears at all depends on the add-on. Pass a `<Stepper size="compact">`.
 *
 * The `<input>` is a direct grid child (out of flow, so it claims no cell) specifically so the
 * checkbox square can be its CSS sibling — that is what lets the checked and focused states be
 * pure CSS and work with or without React state.
 */

export interface AddOnToggleRowProps
  extends Omit<ComponentPropsWithoutRef<"input">, "className" | "id" | "type" | "name"> {
  id: string;
  /** COPY.md add-on name, e.g. `p4.qbix.heading`. */
  name: ReactNode;
  /** The `name` attribute on the underlying checkbox, for uncontrolled form submission. */
  inputName?: string;
  /** COPY.md description, e.g. `p4.qbix.body`. */
  description?: ReactNode;
  /** Already formatted — `formatMoney(395)`. Rendered in the mono face, right-aligned. */
  price?: string;
  /** The unit under the price: "per person", "each". COPY.md supplies the words. */
  priceUnit?: string;
  /** COPY.md reason this add-on cannot be taken, e.g. `p4.arcade.notEligible`. */
  unavailableReason?: ReactNode;
  /** A `<Stepper size="compact">`. Render it only when the row is checked. */
  quantity?: ReactNode;
  /** COPY.md derived line, e.g. `p4.food.line.extra` — "3 included, 1 extra". */
  derivedLine?: ReactNode;
  className?: string;
}

export function AddOnToggleRow({
  id,
  name,
  inputName,
  description,
  price,
  priceUnit,
  unavailableReason,
  quantity,
  derivedLine,
  disabled,
  className,
  ...rest
}: AddOnToggleRowProps) {
  const isDisabled = disabled === true;
  const hasFooter = Boolean(quantity) || Boolean(derivedLine);

  return (
    <label
      htmlFor={id}
      className={cx(
        "grid min-h-18 grid-cols-[24px_1fr_auto] content-start items-start gap-x-3 gap-y-3",
        "border-b border-rule border-l-[3px] border-l-transparent px-3 py-3",
        "transition-colors duration-[var(--duration-fast)] ease-out",
        !isDisabled && "cursor-pointer has-[:checked]:border-l-accent has-[:checked]:bg-raised",
        isDisabled && "cursor-not-allowed bg-[image:var(--hatch-6)]",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        className,
      )}
    >
      <input
        {...rest}
        id={id}
        name={inputName}
        type="checkbox"
        disabled={disabled}
        className="peer sr-only"
      />

      <span
        aria-hidden="true"
        className={cx(
          "flex size-6 shrink-0 items-center justify-center border bg-sunken text-transparent",
          "transition-colors duration-[var(--duration-fast)] ease-out",
          isDisabled
            ? "border-rule bg-[image:var(--hatch-6)]"
            : "border-border peer-checked:border-accent peer-checked:bg-accent peer-checked:text-ink peer-focus-visible:border-2",
        )}
      >
        <CheckMark className="size-3.5" />
      </span>

      <span className="min-w-0">
        <span className={cx("block text-body", isDisabled ? "text-text-3" : "text-text")}>
          {name}
        </span>
        {description ? (
          <span
            className={cx(
              "mt-1 block max-w-[56ch] text-body-sm",
              isDisabled ? "text-text-3" : "text-text-2",
            )}
          >
            {description}
          </span>
        ) : null}
        {unavailableReason ? (
          <span className="mt-1 block max-w-[56ch] text-caption text-text-3">
            {unavailableReason}
          </span>
        ) : null}
      </span>

      <span className="flex shrink-0 flex-col items-end text-right">
        {price ? (
          <span
            className={cx(
              "font-mono text-mono-md tabular-nums",
              isDisabled ? "text-text-3" : "text-text",
            )}
          >
            {price}
          </span>
        ) : null}
        {priceUnit ? <span className="mt-0.5 text-caption text-text-3">{priceUnit}</span> : null}
      </span>

      {hasFooter ? (
        <span className="col-start-2 col-end-4 flex flex-col gap-2">
          {quantity}
          {derivedLine ? <span className="text-caption text-text-3">{derivedLine}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
