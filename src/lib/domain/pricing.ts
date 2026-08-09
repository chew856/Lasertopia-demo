/**
 * Price computation (R-08, R-40, R-51, R-55, R-67, R-68).
 *
 * The awkward part of this venue's pricing is that it is MIXED: laser tag, packages, extra
 * guests, QBIX and arcade cards are quoted before tax, while pizzas and wings are quoted with
 * tax already inside. Applying one rate to the whole subtotal would over-charge the food, so
 * the two families are kept in separate accumulators all the way to the total and shown as
 * separate lines, which is also what makes the tax line auditable.
 */

import type { EngineConfig } from './config';
import { ok, type Result } from './errors';
import {
  ZERO,
  addMoney,
  cents,
  multiplyMoney,
  subtractMoney,
  taxOn,
  type Cents,
} from './money';
import { validateAddOnSelection, type AddOnSelection, type ResolvedAddOn } from './addons';
import { includedCupcakeCount, includedHotDogCount, includedPizzaCount } from './pizza';
import type { Catalog, FoodChoice, PackageRecord } from './types';

export interface PriceLine {
  code: string;
  name: string;
  detail: string | null;
  quantity: number;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
  /** R-51: true means the price already contains tax and must not be taxed again. */
  taxIncluded: boolean;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  packageBaseCents: Cents;
  extraGuestCount: number;
  extraGuestsCents: Cents;
  /** packageBase + extraGuests + every tax-EXCLUSIVE add-on line. */
  preTaxSubtotalCents: Cents;
  taxCents: Cents;
  /** Pizzas and wings: already tax-inclusive, added after tax. */
  taxIncludedTotalCents: Cents;
  totalCents: Cents;
  depositAppliedCents: Cents;
  balanceDueCents: Cents;
  /** R-68: frozen onto the booking so a later price change never moves an existing total. */
  taxRateMilliPercentSnapshot: number;
  includedPizzaCount: number;
  includedHotDogCount: number;
  includedCupcakeCount: number;
  warnings: string[];
}

export interface PartyPriceRequest {
  packageRecord: PackageRecord;
  guests: number;
  addOns?: readonly AddOnSelection[];
  foodChoice?: FoodChoice;
  catalog: Catalog;
  config: EngineConfig;
  /** R-55: normally CFG.depositAmount. Pass ZERO for a quote before checkout. */
  depositAppliedCents?: Cents;
}

/**
 * R-40 — extras = max(0, guests - CFG.packageBaseGuests) x package.extraGuestPrice.
 * Guests below the base pay the full base price with no discount (OQ-22): the package
 * "accommodates 10 guests", it is not "at least 10".
 */
export function extraGuestCount(guests: number, packageRecord: PackageRecord): number {
  return Math.max(0, guests - packageRecord.baseGuests);
}

function lineFor(resolved: ResolvedAddOn, guests: number): PriceLine {
  const { addOn, selection } = resolved;
  const unit = cents(addOn.priceCents + resolved.optionPriceDeltaCents);
  const quantity = addOn.pricingMode === 'PER_GUEST' ? Math.min(selection.quantity, guests) : selection.quantity;
  return {
    code: addOn.code,
    name: addOn.name,
    detail: resolved.optionLabel,
    quantity,
    unitPriceCents: unit,
    // Rounding is applied once at each add-on line total (R-67); with integer cents and an
    // integer quantity, that multiplication is already exact.
    lineTotalCents: multiplyMoney(unit, quantity),
    taxIncluded: addOn.taxIncluded,
  };
}

/**
 * R-67 — total calculation, in order:
 *
 *   preTaxSubtotal   = packageBase + extraGuests + SUM(tax-exclusive add-on lines)
 *   taxIncludedTotal = SUM(tax-inclusive add-on lines)          # pizzas, wings
 *   tax              = round2(preTaxSubtotal x CFG.taxRatePercent / 100)
 *   total            = preTaxSubtotal + tax + taxIncludedTotal
 *   balanceDue       = total - depositApplied
 */
export function computePartyPrice(req: PartyPriceRequest): Result<PriceBreakdown> {
  const { packageRecord, guests, catalog, config } = req;

  const resolvedResult = validateAddOnSelection({
    selections: req.addOns ?? [],
    packageRecord,
    guests,
    catalog,
    config,
  });
  if (!resolvedResult.ok) return resolvedResult;
  const resolved = resolvedResult.value;

  const foodChoice: FoodChoice = req.foodChoice ?? (packageRecord.includesPizza ? 'PIZZA' : 'NONE');
  const pizzasResult = includedPizzaCount({ guests, packageRecord, tiers: catalog.pizzaTiers, foodChoice });
  if (!pizzasResult.ok) return pizzasResult;

  const packageBase = cents(packageRecord.basePriceCents);
  const extras = extraGuestCount(guests, packageRecord);
  const extraGuestsCents = multiplyMoney(cents(packageRecord.extraGuestPriceCents), extras);

  const lines: PriceLine[] = [
    {
      code: packageRecord.code,
      name: packageRecord.name,
      detail: `Includes ${packageRecord.baseGuests} guests`,
      quantity: 1,
      unitPriceCents: packageBase,
      lineTotalCents: packageBase,
      taxIncluded: false,
    },
  ];
  if (extras > 0) {
    lines.push({
      code: `${packageRecord.code}_EXTRA_GUEST`,
      name: 'Extra guests',
      detail: `${extras} over the ${packageRecord.baseGuests} included`,
      quantity: extras,
      unitPriceCents: cents(packageRecord.extraGuestPriceCents),
      lineTotalCents: extraGuestsCents,
      taxIncluded: false,
    });
  }
  for (const r of resolved) lines.push(lineFor(r, guests));

  const preTaxAddOns = lines
    .filter((l) => !l.taxIncluded && l.code !== packageRecord.code && !l.code.endsWith('_EXTRA_GUEST'))
    .reduce<Cents>((sum, l) => addMoney(sum, l.lineTotalCents), ZERO);

  const preTaxSubtotal = addMoney(packageBase, extraGuestsCents, preTaxAddOns);
  const taxIncludedTotal = lines
    .filter((l) => l.taxIncluded)
    .reduce<Cents>((sum, l) => addMoney(sum, l.lineTotalCents), ZERO);

  const tax = taxOn(preTaxSubtotal, config.taxRateMilliPercent);
  const total = addMoney(preTaxSubtotal, tax, taxIncludedTotal);
  const deposit = req.depositAppliedCents ?? ZERO;

  return ok({
    lines,
    packageBaseCents: packageBase,
    extraGuestCount: extras,
    extraGuestsCents,
    preTaxSubtotalCents: preTaxSubtotal,
    taxCents: tax,
    taxIncludedTotalCents: taxIncludedTotal,
    totalCents: total,
    depositAppliedCents: deposit,
    balanceDueCents: subtractMoney(total, deposit),
    taxRateMilliPercentSnapshot: config.taxRateMilliPercent,
    includedPizzaCount: pizzasResult.value,
    includedHotDogCount: includedHotDogCount(guests, packageRecord, config, foodChoice),
    includedCupcakeCount: includedCupcakeCount(guests, packageRecord, config),
    warnings: [],
  });
}

export interface PublicGamePrice {
  players: number;
  games: number;
  pricePerPersonCents: Cents;
  preTaxSubtotalCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  taxRateMilliPercentSnapshot: number;
}

/** R-08 — per person, tax-exclusive: 1 game $8.49, 2 games $15.49, 3 games $21.49. */
export function computePublicGamePrice(args: {
  players: number;
  games: number;
  catalog: Catalog;
  config: EngineConfig;
}): Result<PublicGamePrice> {
  const pricing = args.catalog.gamePricing.find((p) => p.gameCount === args.games);
  if (!pricing) {
    return {
      ok: false,
      error: {
        code: 'INVALID_GAME_COUNT',
        message: `We only price ${args.catalog.gamePricing.map((p) => p.gameCount).join(', ')} games. Choose one of those.`,
        detail: { games: args.games },
      },
    };
  }
  const perPerson = cents(pricing.pricePerPersonCents);
  const preTax = multiplyMoney(perPerson, args.players);
  const tax = pricing.taxIncluded ? ZERO : taxOn(preTax, args.config.taxRateMilliPercent);
  return ok({
    players: args.players,
    games: args.games,
    pricePerPersonCents: perPerson,
    preTaxSubtotalCents: preTax,
    taxCents: tax,
    totalCents: addMoney(preTax, tax),
    taxRateMilliPercentSnapshot: args.config.taxRateMilliPercent,
  });
}

/** Package prices for the package screen, computed for the ACTUAL guest count (STRATEGY P3). */
export function quotePackages(args: {
  guests: number;
  catalog: Catalog;
  config: EngineConfig;
}): { packageRecord: PackageRecord; extraGuests: number; preTaxSubtotalCents: Cents }[] {
  return args.catalog.packages
    .filter((p) => p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((packageRecord) => {
      const extras = extraGuestCount(args.guests, packageRecord);
      return {
        packageRecord,
        extraGuests: extras,
        preTaxSubtotalCents: addMoney(
          cents(packageRecord.basePriceCents),
          multiplyMoney(cents(packageRecord.extraGuestPriceCents), extras),
        ),
      };
    });
}
