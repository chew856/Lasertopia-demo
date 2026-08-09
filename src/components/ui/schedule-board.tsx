import type { CSSProperties } from "react";

import { cx } from "./cx";
import { HATCH_6 } from "./styles";

/**
 * Manager schedule board — DESIGN §5.12 and §4.6. The one desktop-first surface in the system.
 *
 * Layout is `96px repeat(rooms, minmax(160px, 1fr))`. The time gutter is sticky-left with a
 * 1px **interactive-weight** right rule; the header row is sticky-top; every body row is one
 * 15-minute game slot at 44px. Rows on the hour take a `border` rule and rows on the quarter
 * take a `rule` rule — that is how a manager finds 5:15 without counting.
 *
 * Below `md` the board is **not a grid at all**. It collapses to a single-column agenda of
 * 64px rows, because a manager on a phone is checking today, not editing the week. Both
 * renderings come from the same `chips` array; nothing is duplicated by the caller.
 *
 * The now-line is the only element on the board permitted to move, and it does not tween — the
 * position is recalculated, not animated. It also does not tick by itself: pass a new `now`
 * every 60 seconds from the surface that owns the clock, so this component stays free of
 * timers and stays server-renderable.
 *
 * A multi-game booking spans its rows as one continuous object. Rows are independent grids
 * (which is what keeps the sticky gutter and the per-row hover and focus states simple), so a
 * spanning chip is positioned out of its cell to the exact height of the games it occupies
 * rather than using `grid-row: span`.
 */

export type BoardChipState = "confirmed" | "filling" | "full" | "party" | "blocked";

const CHIP_TONE: Record<BoardChipState, string> = {
  confirmed: "border-state-open",
  filling: "border-state-filling",
  full: "border-state-full",
  party: "border-state-party",
  blocked: "border-state-blocked",
};

const CHIP_BAR: Record<BoardChipState, string> = {
  confirmed: "bg-state-open",
  filling: "bg-state-filling",
  full: "bg-state-full",
  party: "bg-state-party",
  blocked: "bg-state-blocked",
};

/** One 15-minute row, in pixels. Chip spans are derived from this, so it lives in one place. */
const ROW_HEIGHT = 44;

export interface BoardColumn {
  id: string;
  /** Room name. `eyebrow` in the header. */
  name: string;
  /** Already formatted — e.g. "max 14". COPY.md §13 supplies the wording. */
  capacityLabel: string;
}

export interface BoardRow {
  id: string;
  /** Already formatted by `formatTime`, e.g. "5:15 PM". */
  timeLabel: string;
  /** Hour boundaries take the heavier rule. */
  onHour?: boolean;
}

export interface BoardChip {
  id: string;
  columnId: string;
  /** The row this booking starts in. */
  rowId: string;
  /** How many 15-minute rows it occupies. Defaults to 1. */
  span?: number;
  state: BoardChipState;
  /** Booking name, truncated with an ellipsis. */
  name: string;
  /** Guest count, `mono-xs`. Already formatted. */
  countLabel?: string;
  /** The whole accessible name: "5:00 PM, Arena Room, Cheway, 10 guests, confirmed". */
  a11yLabel: string;
  onSelect?: () => void;
}

export interface ScheduleBoardProps {
  /** COPY.md §13 accessible name for the grid. */
  label: string;
  columns: readonly BoardColumn[];
  rows: readonly BoardRow[];
  chips: readonly BoardChip[];
  /**
   * The now-line. `rowId` is the row it sits above; `label` is the `mono-xs` gutter chip, e.g.
   * "5:38 PM". Recompute and re-render every 60 seconds from the caller.
   */
  now?: { rowId: string; label: string };
  className?: string;
}

function templateFor(columnCount: number): CSSProperties {
  return { gridTemplateColumns: `6rem repeat(${columnCount}, minmax(10rem, 1fr))` };
}

/** A single booking. Exported so a manager surface can render one outside the board. */
export function BoardBookingChip({
  chip,
  span = 1,
}: {
  chip: BoardChip;
  span?: number;
}) {
  const isBlocked = chip.state === "blocked";
  return (
    <button
      type="button"
      aria-label={chip.a11yLabel}
      onClick={chip.onSelect}
      style={{ height: span * ROW_HEIGHT - 8 }}
      className={cx(
        "absolute inset-x-1 top-1 z-10 flex items-center gap-2 overflow-hidden border bg-raised pr-2 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-out hover:bg-raised-2",
        CHIP_TONE[chip.state],
        isBlocked && HATCH_6,
      )}
    >
      <span aria-hidden="true" className={cx("h-full w-[3px] shrink-0", CHIP_BAR[chip.state])} />
      <span
        aria-hidden="true"
        className={cx("min-w-0 flex-1 truncate text-body-sm", isBlocked ? "text-text-3" : "text-text")}
      >
        {chip.name}
      </span>
      {chip.countLabel ? (
        <span
          aria-hidden="true"
          className="shrink-0 font-mono text-mono-xs tabular-nums text-text-2"
        >
          {chip.countLabel}
        </span>
      ) : null}
    </button>
  );
}

export function ScheduleBoard({
  label,
  columns,
  rows,
  chips,
  now,
  className,
}: ScheduleBoardProps) {
  const template = templateFor(columns.length);
  const byCell = new Map<string, BoardChip>();
  for (const chip of chips) byCell.set(`${chip.rowId}:${chip.columnId}`, chip);
  const columnName = new Map(columns.map((column) => [column.id, column.name]));
  const rowLabel = new Map(rows.map((row) => [row.id, row.timeLabel]));

  return (
    <div className={className}>
      {/* ── Desktop board ──────────────────────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto md:block">
        <div role="grid" aria-label={label} className="min-w-[960px]">
          <div
            role="row"
            style={template}
            className="sticky top-0 z-20 grid h-14 items-center border-b border-border bg-canvas"
          >
            <span
              role="columnheader"
              className="sticky left-0 z-10 h-full border-r border-border bg-canvas"
            />
            {columns.map((column) => (
              <span
                key={column.id}
                role="columnheader"
                className="flex h-full flex-col justify-center gap-1 border-r border-rule px-3"
              >
                <span className="font-display text-eyebrow uppercase text-text">
                  {column.name}
                </span>
                <span className="font-mono text-mono-xs tabular-nums text-text-2">
                  {column.capacityLabel}
                </span>
              </span>
            ))}
          </div>

          {rows.map((row) => (
            <div
              key={row.id}
              role="row"
              style={template}
              className={cx(
                "group/row relative grid h-11 border-t",
                row.onHour ? "border-t-border" : "border-t-rule",
                "hover:bg-raised",
                "focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-accent",
              )}
            >
              {now?.rowId === row.id ? (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 z-30 h-0.5 bg-accent"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute left-1 top-0 z-30 -translate-y-1/2 border border-accent bg-canvas px-1 font-mono text-mono-xs tabular-nums text-accent"
                  >
                    {now.label}
                  </span>
                </>
              ) : null}

              <span
                role="rowheader"
                className="sticky left-0 z-10 flex h-full items-center justify-end border-r border-border bg-canvas pr-3 font-mono text-mono-sm tabular-nums text-text-2 group-hover/row:bg-raised"
              >
                {row.timeLabel}
              </span>

              {columns.map((column) => {
                const chip = byCell.get(`${row.id}:${column.id}`);
                return (
                  <span
                    key={column.id}
                    role="gridcell"
                    className="relative h-full border-r border-rule"
                  >
                    {chip ? <BoardBookingChip chip={chip} span={chip.span ?? 1} /> : null}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Phone agenda ───────────────────────────────────────────────────────────── */}
      <ul aria-label={label} className="flex flex-col md:hidden">
        {chips.map((chip) => (
          <li
            key={chip.id}
            className="flex h-16 items-center gap-3 border-b border-rule px-3"
          >
            <span className="w-20 shrink-0 font-mono text-mono-sm tabular-nums text-text-2">
              {rowLabel.get(chip.rowId)}
            </span>
            <span aria-hidden="true" className={cx("h-10 w-[3px] shrink-0", CHIP_BAR[chip.state])} />
            <button
              type="button"
              aria-label={chip.a11yLabel}
              onClick={chip.onSelect}
              className="flex min-w-0 flex-1 flex-col items-start text-left"
            >
              <span aria-hidden="true" className="w-full truncate text-body-sm text-text">
                {chip.name}
              </span>
              <span
                aria-hidden="true"
                className="font-display text-tag uppercase text-text-2"
              >
                {columnName.get(chip.columnId)}
              </span>
            </button>
            {chip.countLabel ? (
              <span
                aria-hidden="true"
                className="shrink-0 font-mono text-mono-xs tabular-nums text-text-2"
              >
                {chip.countLabel}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
