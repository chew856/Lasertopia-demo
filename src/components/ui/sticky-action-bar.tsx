import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * The phone sticky bar — DESIGN §4.7 and §5.9.
 *
 * 72px tall, `raised` surface, a 1px **interactive-weight** top rule (it bounds a control, so
 * it is `border`, not `rule`), the total on the left and the primary action on the right.
 *
 * It disappears at `lg`, where the order summary becomes a rail and the bar would be a second
 * copy of the same number. Pass `hideAtLg={false}` for a bar that is not a summary — a manager
 * save bar, for instance.
 *
 * `env(safe-area-inset-bottom)` keeps the action clear of the iOS home indicator; without it
 * the 48px primary loses about 34px of its target on a modern iPhone.
 */
export function StickyActionBar({
  children,
  action,
  hideAtLg = true,
  className,
}: {
  /** The left side: total, hold countdown, context line. */
  children: ReactNode;
  /** The right side: exactly one primary button. */
  action?: ReactNode;
  hideAtLg?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "sticky bottom-0 z-20 border-t border-border bg-raised",
        "pb-[env(safe-area-inset-bottom)]",
        hideAtLg && "lg:hidden",
        className,
      )}
    >
      <div className="mx-auto flex min-h-18 w-full max-w-page items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-col gap-1">{children}</div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
