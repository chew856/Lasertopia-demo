/**
 * `PriceBreakdown` → `OrderSummary` props.
 *
 * Pure. Two rules do all the work here and both come from R-51 / R-67:
 *
 *  1. **Tax is mixed and must be shown that way.** Package, extra guests, QBIX and the arcade
 *     cards are quoted before tax; pizzas and wings already contain it. Rendering one subtotal
 *     and one tax line would over-charge the food on screen, so the tax-exclusive lines, the
 *     tax line, and then the tax-inclusive food subtotal are three separate rows.
 *  2. **Totals are displayed, never recomputed.** Every figure below comes off the breakdown
 *     the engine returned. Nothing here adds two amounts together.
 */

import type { OrderLine } from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import {
  formatMoney,
  formatMoneyPlain,
  formatPercentFromMilli,
} from "@/lib/format";
import type { EngineConfig, PackageRecord, PriceBreakdown } from "@/lib/domain";

export interface SummaryModel {
  heading: string;
  currencyNote: string;
  lines: OrderLine[];
  totalsBefore: { id: string; label: string; amount: string }[];
  total: { label: string; amount: string };
  deposit: { label: string; amount: string; note: string };
  emptyLabel: string;
  /** The audit line — `$259.50 + 6 × $25.95`. Rendered beside the package, never hidden. */
  extraGuestMath: string | null;
}

export interface SummaryOptions {
  breakdown: PriceBreakdown;
  packageRecord: PackageRecord;
  guests: number;
  config: EngineConfig;
  /** `true` once the deposit is recorded — flips "due now" to "paid". */
  depositPaid?: boolean;
}

export function buildSummary({
  breakdown,
  packageRecord,
  guests,
  config,
  depositPaid = false,
}: SummaryOptions): SummaryModel {
  const lines: OrderLine[] = [];

  for (const line of breakdown.lines) {
    const isPackage = line.code === packageRecord.code;
    const isExtraGuests = line.code === `${packageRecord.code}_EXTRA_GUEST`;

    const description = isPackage
      ? interpolate(global.sum.line.package, {
          packageName: packageRecord.name,
          baseGuests: packageRecord.baseGuests,
        })
      : isExtraGuests
        ? interpolate(global.sum.line.extraGuests, {
            extraCount: breakdown.extraGuestCount,
            extraRate: formatMoney(packageRecord.extraGuestPriceCents),
          })
        : line.detail
          ? `${line.name} · ${line.detail}`
          : line.name;

    lines.push({
      id: `${line.code}-${lines.length}`,
      description,
      quantity: line.quantity > 1 ? `×${line.quantity}` : undefined,
      amount: formatMoneyPlain(line.lineTotalCents),
    });
  }

  const totalsBefore: SummaryModel["totalsBefore"] = [
    {
      id: "subtotal",
      label: global.sum.subtotal,
      amount: formatMoneyPlain(breakdown.preTaxSubtotalCents),
    },
    {
      id: "tax",
      label: interpolate(global.sum.tax, {
        taxRate: formatPercentFromMilli(breakdown.taxRateMilliPercentSnapshot).replace("%", ""),
      }),
      amount: formatMoneyPlain(breakdown.taxCents),
    },
  ];

  if (breakdown.taxIncludedTotalCents > 0) {
    totalsBefore.push({
      id: "food",
      label: global.sum.foodSubtotal,
      amount: formatMoneyPlain(breakdown.taxIncludedTotalCents),
    });
  }

  return {
    heading: global.sum.heading,
    currencyNote: global.sum.currencyNote,
    lines,
    totalsBefore,
    total: { label: global.sum.total, amount: formatMoneyPlain(breakdown.totalCents) },
    deposit: {
      label: depositPaid ? global.sum.depositPaid : global.sum.depositDue,
      amount: formatMoneyPlain(
        depositPaid ? breakdown.depositAppliedCents : config.depositAmountCents,
      ),
      note: interpolate(party.policy.deposit.oneLine, {
        deposit: formatMoney(config.depositAmountCents),
      }),
    },
    emptyLabel: party.empty.p4.noExtras.body,
    extraGuestMath:
      breakdown.extraGuestCount > 0
        ? interpolate(global.sum.line.extraGuestsMath, {
            basePrice: formatMoney(packageRecord.basePriceCents),
            extraCount: breakdown.extraGuestCount,
            extraRate: formatMoney(packageRecord.extraGuestPriceCents),
          })
        : null,
  };
}

/**
 * The P3 card figure: base + extras for the *actual* guest count, with the arithmetic shown.
 * STRATEGY §3.2 P3 is explicit that the sum is displayed, not just the answer, so a parent can
 * audit it — the sticker price for 10 guests is not the price she will pay.
 */
export function packageCardMaths(
  packageRecord: PackageRecord,
  guests: number,
  preTaxSubtotalCents: number,
): { math: string | null; total: string; note: string } {
  const extraCount = Math.max(0, guests - packageRecord.baseGuests);
  return {
    math:
      extraCount > 0
        ? interpolate(party.p3.card.math, {
            basePrice: formatMoney(packageRecord.basePriceCents),
            extraCount,
            extraRate: formatMoney(packageRecord.extraGuestPriceCents),
          })
        : null,
    total: formatMoney(preTaxSubtotalCents),
    note:
      extraCount > 0
        ? interpolate(party.p3.card.totalNote, { guests })
        : interpolate(party.p3.card.baseOnly, {
            basePrice: formatMoney(packageRecord.basePriceCents),
            baseGuests: packageRecord.baseGuests,
          }),
  };
}
