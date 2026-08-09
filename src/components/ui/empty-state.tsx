import type { ReactNode } from "react";

import { cx } from "./cx";
import { SlashMark } from "./marks";
import { MEASURE_SMALL } from "./styles";

/**
 * Empty state — DESIGN §5.11.
 *
 * **Left-aligned.** A centred empty state with a big friendly icon is the single most
 * recognisable generated-UI pattern there is, and it is on the anti-checklist by name.
 *
 * The mark is a 64×64 box with a 2px CSS-drawn diagonal. No illustration, no mascot, no emoji.
 *
 * Every empty state must state **why** it is empty in the venue's real terms — "Sunday doors
 * open at 12:00 PM and the 10:00 AM–12:00 PM window is reserved for parties", not "Nothing
 * here yet" — and offer exactly one next action. Both come from COPY.md §9; there is no
 * default and no fallback, because a generic one would be worse than none.
 */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  /** COPY.md `empty.*` title. `display-3`. */
  title: ReactNode;
  /** COPY.md `empty.*` body, naming the real constraint. Capped at 56 characters. */
  body: ReactNode;
  /** Exactly one action — a secondary button. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("border border-rule px-6 py-8", className)}>
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center border border-border text-border"
      >
        <SlashMark className="size-16" />
      </span>

      <h2 className="mt-6 font-display text-display-3 text-text">{title}</h2>
      <p className={cx("mt-2 text-body-sm text-text-2", MEASURE_SMALL)}>{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/**
 * Loading placeholder — DESIGN §6.3.
 *
 * A static 6px hatch block at the component's real dimensions with a `mono-xs` `LOADING`
 * label. **Nothing pulses.** Skeleton shimmer is banned outright, and so is any entrance
 * animation on the block itself.
 *
 * `label` is the screen-reader sentence from COPY.md §2.6 (`loading.times`,
 * `loading.calendar`, `loading.board`). The visible `LOADING` word is a DESIGN-specified state
 * word, the same class of string as `OPEN` and `FULL`, and has no COPY.md key.
 */
export function LoadingBlock({
  label,
  className,
}: {
  /** COPY.md §2.6, e.g. `loading.times` — "Loading game times…". */
  label: string;
  /** Set the real dimensions of whatever is loading, e.g. `min-h-19`. */
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "flex min-h-19 items-end border border-rule bg-canvas p-3 bg-[image:var(--hatch-6)]",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="font-mono text-mono-xs uppercase text-text-3">
        LOADING
      </span>
    </div>
  );
}
