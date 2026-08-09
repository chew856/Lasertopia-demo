import type { ReactNode } from "react";

import { cx } from "@/components/ui";

/**
 * The shape every rejection in this flow renders into — STRATEGY §0's failure copy contract:
 * what happened, why in the venue's terms, and the next action as a real control.
 *
 * It is a panel and not a modal on purpose. A modal over the time grid would trap focus and
 * hide the alternatives the body is telling the customer about; this sits in the flow, takes
 * focus, and leaves the grid visible underneath.
 *
 * `tone` changes the left bar only. `blocking` (a rejection) takes the full-state colour;
 * `informational` (a standing explanation, like weekend mornings) takes the accent. Neither
 * carries meaning alone — the title says what happened in words.
 */
export function ReasonPanel({
  title,
  body,
  tone = "blocking",
  headingId,
  children,
  className,
  ...rest
}: {
  title: string;
  body: string;
  tone?: "blocking" | "informational";
  headingId?: string;
  /** The actions. At least one, always a real control. */
  children?: ReactNode;
  className?: string;
  tabIndex?: number;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      {...rest}
      role="group"
      aria-labelledby={headingId}
      className={cx(
        "border border-rule border-l-[3px] bg-raised p-4 md:p-6",
        tone === "blocking" ? "border-l-state-full" : "border-l-accent",
        className,
      )}
    >
      <h3 id={headingId} className="font-display text-display-3 text-text">
        {title}
      </h3>
      <p className="mt-3 max-w-[68ch] text-body-sm text-text-2">{body}</p>
      {children ? <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div> : null}
    </div>
  );
}
