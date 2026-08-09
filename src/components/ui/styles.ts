/**
 * Class fragments that more than one component needs, written once.
 *
 * These are full literal Tailwind strings so the v4 scanner finds them. Everything binds to a
 * theme token; there is no hex in this directory.
 */

/**
 * The 45° hatch overlays from globals.css. 4px pitch marks a full slot, 6px pitch marks
 * anything disabled or blocked — DESIGN §2.2 and §5.
 *
 * `--hatch-*` lives on `:root`, not in `@theme`, so Tailwind generates no named utility for
 * it. The arbitrary background-image value is the only way to reach it, and it references a
 * variable rather than a colour.
 */
export const HATCH_4 = "bg-[image:var(--hatch-4)]";
export const HATCH_6 = "bg-[image:var(--hatch-6)]";

/**
 * DESIGN §5: disabled is never communicated by opacity alone. Text drops to `text-3` (still
 * ≥5.1:1), the boundary drops from the interactive `border` to the decorative `rule`, a 6px
 * hatch goes over the top, and the cursor says so.
 */
export const DISABLED_CONTROL =
  "disabled:cursor-not-allowed disabled:border-rule disabled:text-text-3 disabled:bg-transparent disabled:bg-[image:var(--hatch-6)]";

/** The same treatment for a control that stays focusable via `aria-disabled`. */
export const ARIA_DISABLED_CONTROL =
  "aria-disabled:cursor-not-allowed aria-disabled:border-rule aria-disabled:text-text-3 aria-disabled:bg-[image:var(--hatch-6)]";

/**
 * Surface and colour transitions. DESIGN §6.1 puts hover surface steps at 140ms; the press
 * `translateY(1px)` is deliberately untransitioned so the tap reads as instant.
 */
export const TRANSITION_SURFACE =
  "transition-colors duration-[var(--duration-fast)] ease-out";

/**
 * An inset ring drawn without a shadow property. DESIGN permits only 0-blur inset rings, and an
 * outline with a negative offset draws the same 2px inner edge with no shadow property and no
 * layout shift — which keeps the §8 shadow audit clean.
 */
export const INSET_RING_ACCENT = "outline-2 -outline-offset-2 outline-accent";

/** Body copy measure caps from DESIGN §3.4. */
export const MEASURE_BODY = "max-w-[68ch]";
export const MEASURE_SMALL = "max-w-[56ch]";

/**
 * The hairline grid from DESIGN §4.4: one rule-coloured background showing through 1px gaps,
 * so tile edges never double up or misalign. Children must set their own background.
 */
export const HAIRLINE_GRID = "grid gap-px bg-rule border border-rule";
