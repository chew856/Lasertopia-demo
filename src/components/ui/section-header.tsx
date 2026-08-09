import type { ReactNode } from "react";

import { cx } from "./cx";
import { Eyebrow } from "./typography";
import { MEASURE_BODY } from "./styles";

/**
 * Screen and section headings — DESIGN §3.3, §4.7, §8 ("headlines are left-aligned").
 *
 * Left-aligned, always. A centred hero with a centred paragraph under it is on the
 * anti-checklist by name.
 *
 * `display-1` is `wdth` 125, the expanded cut, and DESIGN §3.2 notes it stops being legible
 * below about 28px — so it is only ever used at its own size, one per page maximum.
 *
 * `display-2` is specified at `wdth` 112.5, for which the theme has no font token: §7 defines
 * only `--font-display` (100) and `--font-display-x` (125). The axis position is set inline
 * here rather than adding a token to globals.css, which is not this layer's file to edit.
 */

export type HeadingLevel = 1 | 2 | 3;

const HEADING_CLASS: Record<HeadingLevel, string> = {
  1: "font-display-x text-display-1 md:text-[3.5rem]",
  2: "font-display text-display-2 md:text-[2.5rem]",
  3: "font-display text-display-3",
};

const HEADING_VARIATION: Record<HeadingLevel, string | undefined> = {
  1: undefined,
  2: '"wdth" 112.5',
  3: undefined,
};

export interface SectionHeaderProps {
  /** DESIGN §3.3 `eyebrow` — a section label. COPY.md supplies the words. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** 1 for a flow entry screen (one per page), 2 for a step heading, 3 for a card title. */
  level?: HeadingLevel;
  /** Intro paragraph. `body-lg` at level 1, `body` below it. Capped at 68 characters. */
  description?: ReactNode;
  /** A trailing control — an "Edit" ghost button back to an earlier step, for instance. */
  action?: ReactNode;
  /** Renders the heading as an `h2`/`h3` while keeping the visual step. */
  headingTag?: "h1" | "h2" | "h3";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  level = 2,
  description,
  action,
  headingTag,
  className,
}: SectionHeaderProps) {
  const Tag = headingTag ?? (`h${level}` as "h1" | "h2" | "h3");
  const variation = HEADING_VARIATION[level];

  return (
    <header className={cx("flex flex-col gap-3", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <Tag
          className={cx(HEADING_CLASS[level], "text-text")}
          style={variation ? { fontVariationSettings: variation } : undefined}
        >
          {title}
        </Tag>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p
          className={cx(
            level === 1 ? "text-body-lg" : "text-body",
            "text-text-2",
            MEASURE_BODY,
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
