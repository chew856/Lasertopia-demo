import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "./cx";
import { ChevronDown } from "./marks";
import { FieldLabel } from "./typography";
import { ValidationMessage } from "./validation-message";

/**
 * Select — DESIGN §5.3.
 *
 * 48px, sunken fill, 1px interactive boundary, `appearance: none`, and a 40px chevron zone
 * divided from the value by a full-height 1px rule. The chevron is the inline SVG from
 * `marks.tsx` — never an emoji, never a font glyph.
 *
 * The options list is the **native control**. On a phone that is the correct answer: it is
 * accessible, it is what the user already knows, and it costs nothing. DESIGN §5.3 only
 * sanctions a custom listbox on the manager board, which is a separate component and not this
 * one.
 *
 * A price inside the value should be rendered by the caller in the mono face where the option
 * text allows it; a native `<option>` cannot carry mixed type, so option labels are plain text
 * and the mono treatment applies to the summary line that follows the field.
 */

export interface SelectProps
  extends Omit<ComponentPropsWithoutRef<"select">, "className" | "id"> {
  id: string;
  label: ReactNode;
  helper?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Select({
  id,
  label,
  helper,
  error,
  children,
  className,
  ...rest
}: SelectProps) {
  const describedBy =
    [helper ? `${id}-helper` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cx("flex flex-col", className)}>
      <FieldLabel htmlFor={id} className="mb-2">
        {label}
      </FieldLabel>

      <div
        className={cx(
          "relative flex h-12 w-full items-stretch border bg-sunken md:h-11",
          error ? "border-state-full border-l-[3px]" : "border-border",
        )}
      >
        <select
          {...rest}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            "w-full appearance-none bg-transparent pl-3.5 pr-13 text-body text-text",
            "disabled:cursor-not-allowed disabled:text-text-3",
          )}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center",
            "border-l text-text-2",
            error ? "border-l-state-full" : "border-l-border",
          )}
        >
          <ChevronDown />
        </span>
      </div>

      {helper ? (
        <p id={`${id}-helper`} className="mt-1.5 text-caption text-text-3">
          {helper}
        </p>
      ) : null}
      {error ? (
        <ValidationMessage tone="error" id={`${id}-error`} className="mt-2">
          {error}
        </ValidationMessage>
      ) : null}
    </div>
  );
}
