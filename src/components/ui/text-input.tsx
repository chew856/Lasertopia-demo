import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "./cx";
import { FieldLabel } from "./typography";
import { ValidationMessage } from "./validation-message";

/**
 * Text input — DESIGN §5.2.
 *
 * 48px on phone, 44px from `md`, sunken fill, an **interactive-weight** 1px boundary (3.77:1;
 * the decorative `rule` is never the only edge of a control), 14px padding-x.
 *
 * Two rules worth stating out loud:
 *
 * - **Filled is not a state.** No colour change when a value is present; it is noise.
 * - **`font-size` is never below 16px.** `text-body` is 1rem exactly. iOS zooms the viewport
 *   on focus below that, which throws the whole 360px layout out.
 *
 * Error adds a 3px left border to the existing 1px box, so the field is distinguishable by
 * edge weight in greyscale, not only by colour — and the message below carries the words.
 */

const FIELD_BASE = cx(
  "w-full border bg-sunken px-3.5 text-body text-text",
  "transition-colors duration-[var(--duration-fast)] ease-out",
  "hover:border-text-3",
  "disabled:cursor-not-allowed disabled:border-rule disabled:bg-canvas disabled:text-text-3 disabled:bg-[image:var(--hatch-6)]",
);

const FIELD_REST = "border-border";
const FIELD_ERROR = "border-state-full border-l-[3px]";

interface FieldFrameProps {
  id: string;
  label: ReactNode;
  helper?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

function FieldFrame({ id, label, helper, error, children, className }: FieldFrameProps) {
  return (
    <div className={cx("flex flex-col", className)}>
      <FieldLabel htmlFor={id} className="mb-2">
        {label}
      </FieldLabel>
      {children}
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

function describedBy(id: string, helper: unknown, error: unknown): string | undefined {
  const ids = [helper ? `${id}-helper` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export interface TextInputProps
  extends Omit<ComponentPropsWithoutRef<"input">, "className" | "id"> {
  id: string;
  /** COPY.md label, e.g. `g3.name.label`. Rendered uppercase in the display face. */
  label: ReactNode;
  /** COPY.md helper, e.g. `g3.phone.help`. */
  helper?: ReactNode;
  /** COPY.md error string. Names the fix, not the fault. */
  error?: string;
  /** Wrapper class, for grid placement. The control's own styling is not overridable. */
  className?: string;
}

export function TextInput({
  id,
  label,
  helper,
  error,
  className,
  type = "text",
  ...rest
}: TextInputProps) {
  return (
    <FieldFrame id={id} label={label} helper={helper} error={error} className={className}>
      <input
        {...rest}
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, helper, error)}
        className={cx(FIELD_BASE, "h-12 md:h-11", error ? FIELD_ERROR : FIELD_REST)}
      />
    </FieldFrame>
  );
}

export interface TextAreaProps
  extends Omit<ComponentPropsWithoutRef<"textarea">, "className" | "id"> {
  id: string;
  label: ReactNode;
  helper?: ReactNode;
  error?: string;
  className?: string;
}

/**
 * The multiline form of §5.2, for the notes fields both flows ask for (allergies, "anything we
 * should know"). DESIGN does not draw one; everything here is the input's own treatment with
 * `min-height` in place of a fixed height.
 */
export function TextArea({
  id,
  label,
  helper,
  error,
  className,
  rows = 4,
  ...rest
}: TextAreaProps) {
  return (
    <FieldFrame id={id} label={label} helper={helper} error={error} className={className}>
      <textarea
        {...rest}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, helper, error)}
        className={cx(FIELD_BASE, "min-h-24 py-3", error ? FIELD_ERROR : FIELD_REST)}
      />
    </FieldFrame>
  );
}
