import type { ReactNode } from "react";

import { cx } from "./cx";
import { CheckMark } from "./marks";
import { Eyebrow } from "./typography";
import { HAIRLINE_GRID, HATCH_4, HATCH_6 } from "./styles";

/**
 * Time-slot tile — DESIGN §5.6, and the clearest expression of principle 3 in the system.
 *
 * Every state carries a structural marker **and** a literal uppercase word before it carries a
 * colour: a solid bar, four dashes, a hatch with a strikethrough, a corner notch. Screenshot
 * the grid, convert to greyscale, and all six states stay apart. That is the test.
 *
 * | State      | Marker                                    | Interactive |
 * |------------|-------------------------------------------|-------------|
 * | `open`     | solid 3px bar                             | yes         |
 * | `filling`  | dashed 3px bar, four dashes               | yes         |
 * | `full`     | 4px hatch + strikethrough on the time     | no          |
 * | `party`    | 12px triangular corner notch, top-right   | no          |
 * | `blocked`  | 6px hatch + strikethrough                 | no          |
 * | `tooSoon`  | 6px hatch + strikethrough (90-min rule)   | no          |
 *
 * Geometry: 76px minimum (84px from `md`), 12px padding, canvas fill, and **no border** — the
 * 1px grid gap in `SlotGrid` is the border, which is how the rules stay single-width and
 * aligned. The selected ring is an inward outline rather than a border for the same reason:
 * nothing may shift when a tile is chosen.
 *
 * Hover only ever moves the surface a step. It never touches the state colour, so hover can
 * never be mistaken for a state change.
 *
 * Non-interactive states use `aria-disabled` rather than `disabled`, so they keep their place
 * in the tab order and a screen-reader user can hear *why* 5:45 is unavailable instead of
 * finding a hole in the grid.
 */

export type SlotState = "open" | "filling" | "full" | "party" | "blocked" | "tooSoon";

const INTERACTIVE: Record<SlotState, boolean> = {
  open: true,
  filling: true,
  full: false,
  party: false,
  blocked: false,
  tooSoon: false,
};

const SURFACE: Record<SlotState, string> = {
  open: "bg-canvas",
  filling: "bg-canvas",
  full: cx("bg-sunken", HATCH_4),
  party: "bg-raised",
  blocked: cx("bg-canvas", HATCH_6),
  tooSoon: cx("bg-canvas", HATCH_6),
};

const BAR_COLOUR: Record<SlotState, string> = {
  open: "bg-state-open",
  filling: "bg-state-filling",
  full: "bg-state-full",
  party: "bg-state-party",
  blocked: "bg-state-blocked",
  tooSoon: "bg-state-blocked",
};

const WORD_COLOUR: Record<SlotState, string> = {
  open: "text-state-open",
  filling: "text-state-filling",
  full: "text-state-full",
  party: "text-state-party",
  blocked: "text-state-blocked",
  tooSoon: "text-state-blocked",
};

const TIME_COLOUR: Record<SlotState, string> = {
  open: "text-text",
  filling: "text-text",
  full: "text-text-3 line-through decoration-1",
  party: "text-text",
  blocked: "text-text-3 line-through decoration-1",
  tooSoon: "text-text-3 line-through decoration-1",
};

const DETAIL_COLOUR: Record<SlotState, string> = {
  open: "text-text-2",
  filling: "text-state-filling",
  full: "text-text-3",
  party: "text-text-2",
  blocked: "text-text-3",
  tooSoon: "text-text-3",
};

export interface SlotTileProps {
  /** Formatted by `formatTime` / `formatBlock`. Never assembled in the component. */
  time: string;
  state: SlotState;
  /** COPY.md state word — `OPEN`, `FILLING`, `FULL`, `PARTY HOLD`, `BLOCKED`, `TOO SOON`. */
  stateWord: string;
  /** COPY.md sub-line: `18 / 25 SPOTS`, `RESERVED`, `Maintenance`, `Walk-in window`. */
  detail?: ReactNode;
  /** The starts inside a multi-game block, from `formatBlockSub` — `6:00 · 6:15`. */
  subTimes?: string;
  selected?: boolean;
  /** COPY.md `g2.cell.state.selected` — `SELECTED`. Replaces `stateWord` when selected. */
  selectedWord?: string;
  /**
   * The whole accessible name, e.g. COPY.md `g2.cell.a11y` filled in:
   * "5:45 PM, full, 0 of 25 spots". It must include the state word.
   */
  a11yLabel: string;
  onSelect?: () => void;
  className?: string;
}

export function SlotTile({
  time,
  state,
  stateWord,
  detail,
  subTimes,
  selected = false,
  selectedWord,
  a11yLabel,
  onSelect,
  className,
}: SlotTileProps) {
  const interactive = INTERACTIVE[state];
  const word = selected && selectedWord ? selectedWord : stateWord;

  return (
    <button
      type="button"
      aria-label={a11yLabel}
      aria-pressed={interactive ? selected : undefined}
      aria-disabled={interactive ? undefined : true}
      onClick={interactive ? onSelect : undefined}
      className={cx(
        "relative flex min-h-19 flex-col justify-end gap-1 p-3 text-left md:min-h-21",
        "transition-colors duration-[var(--duration-fast)] ease-out",
        selected ? "bg-accent-wash outline-2 -outline-offset-2 outline-accent" : SURFACE[state],
        interactive
          ? "active:translate-y-px"
          : "cursor-not-allowed",
        interactive && !selected && "hover:bg-raised active:bg-raised-2",
        className,
      )}
    >
      {/* 3px state bar, flush to the tile's top edge. Solid for every state but `filling`. */}
      {state === "filling" ? (
        <span aria-hidden="true" className="absolute inset-x-0 top-0 flex h-[3px] gap-1">
          <span className="h-full flex-1 bg-state-filling" />
          <span className="h-full flex-1 bg-state-filling" />
          <span className="h-full flex-1 bg-state-filling" />
          <span className="h-full flex-1 bg-state-filling" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cx("absolute inset-x-0 top-0 h-[3px]", BAR_COLOUR[state])}
        />
      )}

      {/* 12px triangular corner notch — the party-hold marker. */}
      {state === "party" ? (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 size-3 bg-state-party [clip-path:polygon(100%_0,100%_100%,0_0)]"
        />
      ) : null}

      {/* 16px accent square with an ink tick — the third selected cue, after fill and word. */}
      {selected ? (
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 flex size-4 items-center justify-center bg-accent text-ink"
        >
          <CheckMark className="size-2.5" />
        </span>
      ) : null}

      <span
        aria-hidden="true"
        className={cx("font-mono text-mono-lg tabular-nums", TIME_COLOUR[state])}
      >
        {time}
      </span>

      {subTimes ? (
        <span aria-hidden="true" className="font-mono text-mono-xs tabular-nums text-text-3">
          {subTimes}
        </span>
      ) : null}

      <span
        aria-hidden="true"
        className={cx(
          "font-display text-tag uppercase",
          selected ? "text-accent" : WORD_COLOUR[state],
        )}
      >
        {word}
      </span>

      {detail ? (
        <span
          aria-hidden="true"
          className={cx(
            "font-mono text-mono-xs tabular-nums uppercase",
            selected ? "text-text-2" : DETAIL_COLOUR[state],
          )}
        >
          {detail}
        </span>
      ) : null}
    </button>
  );
}

/**
 * The tile grid — DESIGN §4.4 and §4.5.
 *
 * Games run every 15 minutes across a 7–10 hour day, so a day is 28–40 tiles: tiles, not a
 * list. Columns run 2 → 3 → 4 → 6 → 8 across the breakpoints, and the 1px `rule`-coloured
 * gap *is* the tile border, which is why `SlotTile` draws none of its own.
 *
 * There is no entrance animation here and there must not be one: DESIGN §6.3 rules out
 * staggered reveals on the slot grid explicitly.
 */
export function SlotGrid({
  label,
  children,
  className,
}: {
  /** COPY.md `g2.grid.label` — "Game start times for {date}". */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        HAIRLINE_GRID,
        "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The sticky hour header a 40-tile day needs to stay scannable — DESIGN §4.5. 32px, canvas
 * background so tiles scroll under it, 1px bottom rule.
 *
 * Render one per hour group, each followed by its own `SlotGrid`; an in-grid header would
 * break the column run.
 */
export function SlotHourHeader({
  children,
  className,
}: {
  /** COPY.md `g2.grid.hourHeading` — the hour, e.g. "6:00 PM". */
  children: ReactNode;
  className?: string;
}) {
  return (
    <Eyebrow
      as="h3"
      className={cx(
        "sticky top-0 z-10 flex h-8 items-center border-b border-rule bg-canvas",
        className,
      )}
    >
      {children}
    </Eyebrow>
  );
}
