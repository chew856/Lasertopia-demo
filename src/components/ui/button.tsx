import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "./cx";
import { DISABLED_CONTROL, TRANSITION_SURFACE } from "./styles";

/**
 * Buttons — DESIGN §5.1.
 *
 * Four variants, one focus treatment (the global `:focus-visible` in globals.css draws both
 * the 2px outer ring and the 2px inset ring; nothing here fights it), and one hard rule from
 * the spec: **there is never more than one primary button on a screen.**
 *
 * No `"use client"`. A button with no handler renders on the server; the moment a caller
 * passes `onClick` it is doing so from its own client component, which is where the boundary
 * belongs.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "compact";

const BASE = cx(
  "inline-flex items-center justify-center gap-2 border text-center align-middle select-none",
  "font-display text-button uppercase",
  TRANSITION_SURFACE,
  "active:translate-y-px disabled:active:translate-y-0",
);

/**
 * Heights are the touch targets: 48px primary on phone / 44px from `md`, 44px everywhere else.
 * `compact` is 36px and is the one documented exception — DESIGN §5.1 specifies it for the
 * manager board, which is a mouse-and-keyboard surface.
 */
const VARIANT: Record<ButtonVariant, string> = {
  primary: cx(
    "h-12 px-5 md:h-11",
    "border-accent bg-accent text-ink",
    "hover:border-accent-press hover:bg-accent-press",
    "active:border-accent-press active:bg-accent-press",
    DISABLED_CONTROL,
  ),
  secondary: cx(
    "h-11 px-4",
    "border-border bg-transparent text-text",
    "hover:border-accent hover:bg-raised",
    "active:bg-raised-2",
    DISABLED_CONTROL,
  ),
  ghost: cx(
    "h-11 px-2",
    "border-transparent bg-transparent text-text-2",
    "hover:text-text hover:underline hover:decoration-1 hover:underline-offset-4",
    "disabled:cursor-not-allowed disabled:text-text-3 disabled:no-underline",
  ),
  compact: cx(
    "h-9 px-3 text-tag",
    "border-border bg-transparent text-text",
    "hover:border-accent hover:bg-raised",
    "active:bg-raised-2",
    DISABLED_CONTROL,
  ),
};

/** DESIGN §5.1: primary buttons are full-width below `md`. */
const WIDTH = {
  full: "w-full",
  auto: "w-auto",
  primaryDefault: "w-full md:w-auto",
} as const;

/**
 * The variant class string on its own, for the cases a `<button>` is the wrong element —
 * a `next/link`, an `<a href="tel:…">`, a file-download anchor.
 *
 * ```tsx
 * <Link href="/book/games" className={buttonClassName("primary")}>Find a time</Link>
 * ```
 */
export function buttonClassName(
  variant: ButtonVariant = "secondary",
  options: { fullWidth?: boolean } = {},
): string {
  const width =
    options.fullWidth === true
      ? WIDTH.full
      : options.fullWidth === false
        ? WIDTH.auto
        : variant === "primary"
          ? WIDTH.primaryDefault
          : WIDTH.auto;
  return cx(BASE, VARIANT[variant], width);
}

export interface ButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "className"> {
  variant?: ButtonVariant;
  /** Overrides the default: full-width below `md` for `primary`, intrinsic for the rest. */
  fullWidth?: boolean;
  /**
   * In-flight submit. Disables the control, sets `aria-busy`, and swaps the label for
   * `pendingLabel` — pass one of COPY.md §2.6's progress strings, e.g. `loading.confirming`.
   */
  pending?: boolean;
  pendingLabel?: string;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  fullWidth,
  pending = false,
  pendingLabel,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled === true || pending}
      aria-busy={pending || undefined}
      className={buttonClassName(variant, { fullWidth })}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export interface ButtonLinkProps extends Omit<ComponentPropsWithoutRef<"a">, "className"> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

/** The same geometry on an anchor, for navigation and `tel:` actions. */
export function ButtonLink({
  variant = "secondary",
  fullWidth,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a {...rest} className={buttonClassName(variant, { fullWidth })}>
      {children}
    </a>
  );
}
