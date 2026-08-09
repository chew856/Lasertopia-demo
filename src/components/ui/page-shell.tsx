import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Page and flow layout — DESIGN §4.3 and §4.7.
 *
 * Gutters are 16px base, 24px at `md`, 32px at `lg` and up, everywhere. Containers come off
 * the theme (`--container-flow` 544px, `--container-rail` 320px, `--container-page` 1144px)
 * rather than being retyped as pixel values.
 */

export type ShellWidth = "page" | "flow" | "board";

const WIDTH: Record<ShellWidth, string> = {
  page: "max-w-page",
  flow: "max-w-flow",
  /** Full bleed with a 960px floor; the manager board scrolls horizontally below that. */
  board: "max-w-none",
};

export function PageShell({
  width = "page",
  as: Tag = "div",
  children,
  className,
}: {
  width?: ShellWidth;
  as?: "div" | "main" | "section" | "header" | "footer";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={cx("mx-auto w-full px-4 md:px-6 lg:px-8", WIDTH[width], className)}>
      {children}
    </Tag>
  );
}

/**
 * The booking flow's two-column behaviour.
 *
 * Base through `md`: one column at `--container-flow`. The order summary is not in the flow at
 * all — it is a sticky bottom bar (see `StickyActionBar`).
 *
 * `lg` and up: `minmax(0, 34rem) 20rem` with a 48px gap, and the summary becomes a rail stuck
 * 24px from the top. Pass the summary panel as `rail`; it is hidden below `lg` so the bottom
 * bar is the single source of the total on a phone.
 */
export function FlowLayout({
  rail,
  children,
  className,
}: {
  rail?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "mx-auto w-full max-w-flow px-4 md:px-6 lg:grid lg:max-w-page lg:grid-cols-[minmax(0,34rem)_20rem] lg:gap-12 lg:px-8",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      {rail ? (
        <aside className="hidden lg:block">
          <div className="sticky top-6">{rail}</div>
        </aside>
      ) : null}
    </div>
  );
}

/**
 * Vertical rhythm inside a flow screen: 48px between sections, per DESIGN §4.7. Fields inside
 * a section stack at 24px — use `FieldStack`.
 */
export function FlowSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cx("py-12 first:pt-8", className)}>{children}</section>;
}

/** 24px between fields, 32px between form groups — DESIGN §4.1 and §4.7. */
export function FieldStack({
  gap = "field",
  children,
  className,
}: {
  gap?: "field" | "group";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col", gap === "group" ? "gap-8" : "gap-6", className)}>
      {children}
    </div>
  );
}
