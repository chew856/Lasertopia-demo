import type { ReactNode } from "react";

import { cx } from "./cx";
import { BangMark, CheckMark } from "./marks";
import { Eyebrow } from "./typography";

/**
 * Validation messages — DESIGN §5.10.
 *
 * Every message pairs a **distinct marker shape** with **explicit words**. Colour is the third
 * cue, never the first: a square-bang and a square-check are still different marks in
 * greyscale, and the sentence still says what to do with no colour at all.
 *
 * Announcement follows the tone: errors use `role="alert"` (assertive), warnings and
 * confirmations use `aria-live="polite"`. Validation fires on blur and on submit, never on
 * keystroke — that is the caller's timing, but it is why these render conditionally rather
 * than sitting in the DOM permanently.
 *
 * The 13px Chivo 500 the spec calls for has no `--text-*` token (the ramp runs 12px caption →
 * 14px body-sm), so the size is set as an arbitrary value here rather than snapped to a token.
 */

export type MessageTone = "error" | "success" | "warning";

const TONE: Record<MessageTone, { text: string; marker: string }> = {
  error: { text: "text-state-full", marker: "border-state-full text-state-full" },
  success: { text: "text-accent", marker: "border-accent text-accent" },
  warning: { text: "text-state-filling", marker: "border-state-filling text-state-filling" },
};

export interface ValidationMessageProps {
  tone: MessageTone;
  /** Wire this to the field's `aria-describedby`. `TextInput` does it for you. */
  id?: string;
  children: ReactNode;
  className?: string;
}

export function ValidationMessage({ tone, id, children, className }: ValidationMessageProps) {
  const { text, marker } = TONE[tone];
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : undefined}
      aria-live={tone === "error" ? undefined : "polite"}
      className={cx(
        "flex items-start gap-2 text-[0.8125rem] leading-[1.4] font-medium",
        text,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx("mt-0.5 flex size-4 shrink-0 items-center justify-center border-2", marker)}
      >
        {tone === "success" ? (
          <CheckMark className="size-2.5" />
        ) : (
          <BangMark className="size-2" />
        )}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export interface FormErrorSummaryProps {
  /** COPY.md supplies the heading; there is no generic one in §1/§2. */
  heading: string;
  /** Each failure, linked to the field it belongs to. */
  errors: ReadonlyArray<{ fieldId: string; message: string }>;
  className?: string;
}

/**
 * Form-level errors — DESIGN §5.10. A bordered block above the submit button, 3px left bar,
 * 12px padding, every failure a link to its field.
 *
 * `tabIndex={-1}` so the caller can move focus here on a failed submit; that is the one moment
 * a screen-reader user needs to land somewhere other than the top of the form.
 */
export function FormErrorSummary({ heading, errors, className }: FormErrorSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      tabIndex={-1}
      className={cx("border border-state-full border-l-[3px] p-3", className)}
    >
      <Eyebrow as="h2" className="text-state-full">
        {heading}
      </Eyebrow>
      <ul className="mt-2 flex flex-col gap-1">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a
              href={`#${error.fieldId}`}
              className="text-[0.8125rem] leading-[1.4] font-medium text-state-full underline decoration-1 underline-offset-4"
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
