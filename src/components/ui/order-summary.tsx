import type { ReactNode } from "react";

import { cx } from "./cx";
import { Eyebrow } from "./typography";

/**
 * Order summary panel — DESIGN §5.9.
 *
 * Amounts are right-aligned in a fixed 88px column so the decimal points line up all the way
 * down the panel. That column is the entire reason a mono face is in this system.
 *
 * The currency symbol is omitted per line and stated once in the header context — it costs
 * 8px a row and adds nothing. Pass amounts through `formatMoneyPlain`, not `formatMoney`.
 *
 * Two structural rules from the spec:
 *
 * - **The deposit block is mandatory on every screen where the summary appears.** The 14-day
 *   policy is a real financial term and gets permanent typographic space, not a tooltip.
 * - **The empty panel keeps its height.** The layout must not jump when the first item lands.
 *   Pass `minHeight` when the surrounding grid needs it pinned.
 *
 * Tax is mixed in this product: packages, extra guests, QBIX and arcade cards are quoted
 * before tax, pizzas and wings with tax already inside. Render the tax-exclusive lines, then
 * the tax line, then the tax-inclusive food lines — the engine's `taxIncluded` flag per line
 * is what tells you which is which.
 */

export interface OrderLine {
  id: string;
  /** COPY.md `sum.line.*`, already interpolated. */
  description: ReactNode;
  /** Quantity column. Formatted; omit for a line that has none. */
  quantity?: string;
  /** `formatMoneyPlain(25950)` → "259.50". No symbol. */
  amount: string;
}

export interface OrderSummaryProps {
  /** COPY.md `sum.heading` — "What it costs". Rendered as the panel eyebrow. */
  heading: string;
  /** Optional currency context beside the heading, e.g. "CAD". Stated once, never per row. */
  currencyNote?: string;
  lines: readonly OrderLine[];
  /** Subtotal and tax rows. COPY.md `sum.subtotal`, `sum.tax`, `sum.foodSubtotal`. */
  totalsBefore?: ReadonlyArray<{ id: string; label: ReactNode; amount: string }>;
  /** The grand total. Its amount is the one `mono-xl` figure on the screen. */
  total?: { label: string; amount: string };
  /** The deposit block. `note` carries the 14-day policy and is not optional in practice. */
  deposit?: { label: string; amount: string; note: ReactNode };
  /** Shown in place of the lines when nothing is selected. COPY.md supplies the sentence. */
  emptyLabel?: string;
  className?: string;
}

const ROW = "grid grid-cols-[1fr_48px_88px] items-center gap-2";

export function OrderSummary({
  heading,
  currencyNote,
  lines,
  totalsBefore,
  total,
  deposit,
  emptyLabel,
  className,
}: OrderSummaryProps) {
  return (
    <section
      aria-label={heading}
      className={cx("border border-rule bg-raised", className)}
    >
      <header className="flex items-baseline justify-between gap-3 p-4">
        <Eyebrow as="h2">{heading}</Eyebrow>
        {currencyNote ? (
          <span className="font-display text-tag uppercase text-text-3">{currencyNote}</span>
        ) : null}
      </header>

      <div className="border-t border-rule px-4">
        {lines.length === 0 ? (
          <p className="py-4 text-body-sm text-text-3">{emptyLabel}</p>
        ) : (
          <ul className="py-2">
            {lines.map((line) => (
              <li key={line.id} className={cx(ROW, "min-h-8")}>
                <span className="min-w-0 text-[0.8125rem] leading-[1.4] text-text">
                  {line.description}
                </span>
                <span className="text-right font-mono text-mono-sm tabular-nums text-text-2">
                  {line.quantity}
                </span>
                <span className="text-right font-mono text-mono-sm tabular-nums text-text">
                  {line.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalsBefore && totalsBefore.length > 0 ? (
        <div className="border-t border-rule px-4 py-2">
          <ul>
            {totalsBefore.map((row) => (
              <li key={row.id} className={cx(ROW, "min-h-8")}>
                <span className="col-span-2 min-w-0 text-[0.8125rem] leading-[1.4] text-text-2">
                  {row.label}
                </span>
                <span className="text-right font-mono text-mono-sm tabular-nums text-text-2">
                  {row.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {total ? (
        <div className={cx(ROW, "border-t border-border px-4 py-4")}>
          <span className="col-span-2 font-display text-button uppercase text-text">
            {total.label}
          </span>
          <span className="text-right font-mono-w text-mono-xl tabular-nums text-text">
            {total.amount}
          </span>
        </div>
      ) : null}

      {deposit ? (
        <div className="border-t border-rule border-l-[3px] border-l-accent bg-accent-wash p-4">
          <div className={ROW}>
            <span className="col-span-2 font-display text-button uppercase text-text">
              {deposit.label}
            </span>
            <span className="text-right font-mono text-mono-md tabular-nums text-text">
              {deposit.amount}
            </span>
          </div>
          <p className="mt-2 max-w-[56ch] text-caption text-text">{deposit.note}</p>
        </div>
      ) : null}
    </section>
  );
}
