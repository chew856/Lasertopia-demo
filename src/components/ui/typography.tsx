import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { cx } from "./cx";
import { MEASURE_SMALL } from "./styles";

/**
 * The small type primitives — DESIGN §3.
 *
 * Their whole job is to stop the display and mono faces being reached for by hand. A number
 * set in the body face, or an uppercase label with negative tracking, is the fastest way to
 * break the direction, and both are easy to do accidentally with raw utilities.
 */

/**
 * Section labels, order-summary headers, table headers. Archivo 700 12px +0.14em, uppercase.
 *
 * The class already uppercases, but pass the string uppercase too where COPY.md writes it
 * that way — DESIGN principle 3 asks for a literal uppercase word, not a CSS transform.
 */
export function Eyebrow({
  as: Tag = "p",
  children,
  className,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={cx("font-display text-eyebrow uppercase text-text-2", className)}>
      {children}
    </Tag>
  );
}

/**
 * Form field labels. Archivo 700 12px +0.12em, uppercase. Always paired with an `htmlFor`;
 * the input primitives below wire this for you.
 */
export function FieldLabel({
  children,
  className,
  ...rest
}: ComponentPropsWithoutRef<"label"> & { children: ReactNode }) {
  return (
    <label {...rest} className={cx("font-display text-label uppercase text-text-2", className)}>
      {children}
    </label>
  );
}

/**
 * Policy notes, capacity hints, validation-adjacent prose. Chivo 500 12px, capped at 56
 * characters per DESIGN §3.4.
 */
export function Caption({
  as: Tag = "p",
  children,
  className,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={cx("text-caption text-text-2", MEASURE_SMALL, className)}>{children}</Tag>
  );
}

export type MonoStep = "xl" | "lg" | "md" | "sm" | "xs";

/**
 * A figure. Every time, price, guest count, capacity and duration on screen goes through
 * here or through a component that uses it — DESIGN principle 1.
 *
 * `xl` is the only step at `wdth` 100 and is reserved for a grand total, one per screen.
 * Everything else runs at the axis minimum, `wdth` 75, because Martian Mono at 100 will not
 * fit a five-column capacity table on a 360px phone.
 */
const MONO_STEP: Record<MonoStep, string> = {
  xl: "font-mono-w text-mono-xl",
  lg: "font-mono text-mono-lg",
  md: "font-mono text-mono-md",
  sm: "font-mono text-mono-sm",
  xs: "font-mono text-mono-xs",
};

export function MonoValue({
  step = "md",
  as: Tag = "span",
  children,
  className,
}: {
  step?: MonoStep;
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return <Tag className={cx(MONO_STEP[step], "tabular-nums", className)}>{children}</Tag>;
}

/**
 * Mono sitting inline inside a Chivo sentence. Martian Mono has a large x-height and reads
 * about one step bigger at the same px value, so DESIGN §3.5 sets it to 0.92em.
 */
export function InlineMono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("font-mono text-[0.92em] tabular-nums", className)}>{children}</span>
  );
}
