import type { ReactNode } from "react";

import { cx } from "./cx";
import { HATCH_6 } from "./styles";

/**
 * Chips and badges — DESIGN §5.7 (status chip), §2.2 (state words), §5.7 (game-time chips).
 *
 * 24px tall, 1px border, 8px padding-x, `tag` type, uppercase. A tag is never the only carrier
 * of a state: it exists to put the literal word next to the structural marker, which is the
 * whole point of principle 3.
 */

export type TagTone = "neutral" | "accent" | "open" | "filling" | "full" | "party" | "blocked";

const OUTLINE: Record<TagTone, string> = {
  neutral: "border-rule text-text-2",
  accent: "border-accent text-accent",
  open: "border-state-open text-state-open",
  filling: "border-state-filling text-state-filling",
  full: "border-state-full text-state-full",
  party: "border-state-party text-state-party",
  blocked: "border-state-blocked text-state-blocked",
};

const SOLID: Record<TagTone, string> = {
  neutral: "border-raised-2 bg-raised-2 text-text",
  accent: "border-accent bg-accent text-ink",
  open: "border-state-open bg-state-open text-ink",
  filling: "border-state-filling bg-state-filling text-ink",
  full: "border-state-full bg-state-full text-ink",
  party: "border-state-party bg-state-party text-ink",
  blocked: "border-state-blocked bg-state-blocked text-ink",
};

export interface TagProps {
  tone?: TagTone;
  variant?: "outline" | "solid";
  /** Adds the 6px hatch behind the label. DESIGN §5.7 uses it on a `FULL` status chip. */
  hatched?: boolean;
  children: ReactNode;
  className?: string;
}

export function Tag({
  tone = "neutral",
  variant = "outline",
  hatched = false,
  children,
  className,
}: TagProps) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center border px-2 font-display text-tag uppercase whitespace-nowrap",
        variant === "solid" ? SOLID[tone] : OUTLINE[tone],
        hatched && HATCH_6,
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A figure chip — the reserved game times on a party-window card, a count badge, the board's
 * now-line time. 24px tall, `mono-xs`, decorative 1px rule.
 */
export function MonoChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center border border-rule px-2 font-mono text-mono-xs tabular-nums text-text whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
