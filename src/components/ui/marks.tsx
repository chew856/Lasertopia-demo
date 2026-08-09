/**
 * The four drawn marks this system is allowed to use.
 *
 * DESIGN §8 is explicit: chevrons, checkmarks and the bang marker are CSS-drawn or inline SVG
 * with 2px strokes — not an icon font, not an emoji. There are no other icons in this product.
 *
 * Each mark ships at its design size in its own viewBox, so `strokeWidth={2}` really is 2
 * device-independent pixels rather than 2 scaled user units. Size them by picking the mark,
 * not by scaling one; a check drawn at 14px and displayed at 24px has 3.4px strokes.
 *
 * All four inherit `currentColor` and are `aria-hidden` — they never carry meaning on their
 * own. Every state that uses one also carries its literal uppercase word.
 */

interface MarkProps {
  className?: string;
}

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
} as const;

/** Select chevron. 10×6, 2px strokes — DESIGN §5.3. Never an emoji, never a font glyph. */
export function ChevronDown({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 10 6"
      width={10}
      height={6}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...STROKE}
      strokeLinecap="square"
    >
      <path d="M1 1L5 5L9 1" />
    </svg>
  );
}

/** Month-navigation chevron, drawn from the same 2px vocabulary. */
export function ChevronSide({ className, direction }: MarkProps & { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 6 10"
      width={6}
      height={10}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...STROKE}
      strokeLinecap="square"
    >
      <path d={direction === "left" ? "M5 1L1 5L5 9" : "M1 1L5 5L1 9"} />
    </svg>
  );
}

/** Checkbox tick and the selected-tile tick. 14×14, 2px strokes — DESIGN §5.8. */
export function CheckMark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      width={14}
      height={14}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...STROKE}
      strokeLinecap="square"
    >
      <path d="M2 7.5L5.5 11L12 3.5" />
    </svg>
  );
}

/** The validation bang. 2px strokes inside the 16×16 marker square — DESIGN §5.10. */
export function BangMark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 10 10"
      width={10}
      height={10}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...STROKE}
      strokeLinecap="butt"
    >
      <path d="M5 1V6" />
      <path d="M5 8.5V9.5" />
    </svg>
  );
}

/** The empty-state slash. 64×64 box, 2px diagonal — DESIGN §5.11. No illustration, no mascot. */
export function SlashMark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={64}
      height={64}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...STROKE}
      strokeLinecap="butt"
    >
      <path d="M4 4L60 60" />
    </svg>
  );
}
