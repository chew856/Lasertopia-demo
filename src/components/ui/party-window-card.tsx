import type { ReactNode } from "react";

import { cx } from "./cx";
import { Eyebrow } from "./typography";
import { MonoChip, Tag, type TagTone } from "./tag";

/**
 * Party-window card — DESIGN §5.7.
 *
 * One 2-hour window with its bays, capacities, age-matching constraint and reserved game
 * times. The card itself is a `<section>` named by the window time and is **not** clickable;
 * the bay rows are. A card that is both a container and a button is the pattern that produces
 * a nested-interactive accessibility failure.
 *
 * The age-compatibility line is the point of principle 6: the ±2-year rule gets its own
 * typographic slot inside the component it constrains, with the real number in it, rather than
 * living in a tooltip and failing validation at step four.
 */

export type BayState = "open" | "party" | "full" | "blocked";

const BAY_BAR: Record<BayState, string> = {
  open: "bg-state-open",
  party: "bg-state-party",
  full: "bg-state-full",
  blocked: "bg-state-blocked",
};

const BAY_WORD: Record<BayState, string> = {
  open: "text-state-open",
  party: "text-state-party",
  full: "text-state-full",
  blocked: "text-state-blocked",
};

export interface PartyBayRowProps {
  /** COPY.md / catalog room name. Rendered uppercase in the `heading` step. */
  roomName: string;
  /** Already formatted — `formatCapacity(10, 14)` gives "10 / 14". */
  capacity: string;
  state: BayState;
  /** COPY.md state word — `OPEN`, `PARTY HOLD`, `FULL`, `BLOCKED`. */
  stateWord: string;
  /** The existing party's age band, e.g. "AGES 7–9". Only where a bay is held. */
  ageLabel?: string;
  /** The whole accessible name. Include the room, the capacity and the state word. */
  a11yLabel: string;
  disabled?: boolean;
  onSelect?: () => void;
}

/**
 * A bay inside a window. Grid is `3px 1fr 72px 96px` from `sm`; below that the capacity and
 * state stack onto a second line rather than being squeezed — a 360px phone cannot hold four
 * columns and stay above 44px.
 */
export function PartyBayRow({
  roomName,
  capacity,
  state,
  stateWord,
  ageLabel,
  a11yLabel,
  disabled = false,
  onSelect,
}: PartyBayRowProps) {
  return (
    <button
      type="button"
      aria-label={a11yLabel}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
      className={cx(
        "grid w-full min-h-14 grid-cols-[3px_1fr_auto] items-center gap-x-3 gap-y-1 py-2 pr-3 text-left",
        "sm:grid-cols-[3px_1fr_72px_96px]",
        "transition-colors duration-[var(--duration-fast)] ease-out",
        disabled ? "cursor-not-allowed" : "hover:bg-raised-2 active:translate-y-px",
      )}
    >
      <span aria-hidden="true" className={cx("h-full min-h-10 w-[3px]", BAY_BAR[state])} />

      <span
        className={cx(
          "min-w-0 truncate font-display text-heading uppercase",
          disabled ? "text-text-3" : "text-text",
        )}
        aria-hidden="true"
      >
        {roomName}
      </span>

      <span
        aria-hidden="true"
        className="font-mono text-mono-sm tabular-nums text-text-2 sm:text-left"
      >
        {capacity}
      </span>

      <span
        aria-hidden="true"
        className="col-start-2 flex flex-col gap-0.5 sm:col-start-4 sm:items-start"
      >
        {ageLabel ? (
          <span className="font-display text-tag uppercase text-text-2">{ageLabel}</span>
        ) : null}
        <span className={cx("font-display text-tag uppercase", BAY_WORD[state])}>
          {stateWord}
        </span>
      </span>
    </button>
  );
}

export interface PartyWindowCardProps {
  /** Already formatted — `formatTimeRange(780, 900)` gives "1:00 – 3:00 PM". */
  windowTime: string;
  /** Day and duration, e.g. "Monday · 2 hours". The caller composes it from COPY + format. */
  meta?: ReactNode;
  /** Top-right status chip, e.g. "1 BAY OPEN" / "FULL". COPY.md supplies the words. */
  status?: { label: string; tone: TagTone; hatched?: boolean };
  /** `PartyBayRow` children. */
  bays: ReactNode;
  /**
   * The age-matching constraint, stated with its real number. Shown **only** when a bay is
   * held — COPY.md `global.rule.ageBand` or the screen's own wording.
   */
  constraintNote?: ReactNode;
  /** Extra caption, e.g. the over-14 two-window note. */
  extraNote?: ReactNode;
  /** Eyebrow above the game chips, e.g. "GAMES". Owned by the surface team's COPY section. */
  gamesLabel?: string;
  /** Reserved game start times, already formatted by `formatTimeCompact`. */
  gameTimes?: readonly string[];
  className?: string;
}

export function PartyWindowCard({
  windowTime,
  meta,
  status,
  bays,
  constraintNote,
  extraNote,
  gamesLabel,
  gameTimes,
  className,
}: PartyWindowCardProps) {
  return (
    <section
      aria-label={windowTime}
      className={cx("border border-rule bg-raised", className)}
    >
      <header className="flex items-start justify-between gap-3 p-4 md:p-6">
        <div className="min-w-0">
          <p className="font-mono text-mono-lg tabular-nums text-text">{windowTime}</p>
          {meta ? <p className="mt-1 text-caption text-text-2">{meta}</p> : null}
        </div>
        {status ? (
          <Tag tone={status.tone} hatched={status.hatched} className="shrink-0">
            {status.label}
          </Tag>
        ) : null}
      </header>

      <div className="flex flex-col border-t border-rule [&>*+*]:border-t [&>*+*]:border-rule">
        {bays}
      </div>

      {constraintNote || extraNote || (gamesLabel && gameTimes && gameTimes.length > 0) ? (
        <div className="flex flex-col gap-4 border-t border-rule p-4 md:p-6">
          {constraintNote ? (
            <p className="max-w-[56ch] text-caption text-text-2">{constraintNote}</p>
          ) : null}
          {extraNote ? (
            <p className="max-w-[56ch] text-caption text-text-2">{extraNote}</p>
          ) : null}
          {gamesLabel && gameTimes && gameTimes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow as="h3">{gamesLabel}</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {gameTimes.map((time) => (
                  <MonoChip key={time}>{time}</MonoChip>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
