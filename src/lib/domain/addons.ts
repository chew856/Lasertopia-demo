/**
 * Add-on eligibility and quantity rules (R-46 to R-52).
 *
 * Eligibility is a data relation, not a switch statement: adding a new add-on, or changing
 * which packages it is sold against, must be a row edit with no deploy.
 */

import type { EngineConfig } from './config';
import { ok, reject, type Result } from './errors';
import { formatMoney, cents } from './money';
import type { AddOnRecord, Catalog, PackageRecord } from './types';

export interface AddOnSelection {
  addOnCode: string;
  quantity: number;
  /** Required when the add-on has `requiresOptionChoice` (topping, sauce, 5-Up load). */
  addOnOptionId?: string;
}

export interface ResolvedAddOn {
  addOn: AddOnRecord;
  selection: AddOnSelection;
  optionLabel: string | null;
  optionPriceDeltaCents: number;
}

export function findAddOn(catalog: Catalog, code: string): AddOnRecord | null {
  return catalog.addOns.find((a) => a.code === code && a.isActive) ?? null;
}

export function isAddOnEligible(addOn: AddOnRecord, packageRecord: PackageRecord): boolean {
  return addOn.eligiblePackageCodes.includes(packageRecord.code);
}

/** The add-ons a package may be sold — drives which cards the extras screen renders at all. */
export function eligibleAddOns(catalog: Catalog, packageRecord: PackageRecord): AddOnRecord[] {
  return catalog.addOns
    .filter((a) => a.isActive && isAddOnEligible(a, packageRecord))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Validate a whole add-on selection against a package and guest count.
 *
 * R-46 — the two arcade cards are rejected on AROUND_THE_WORLD with ADDON_NOT_ELIGIBLE; that
 *        package already includes a $10 fun card per guest.
 * R-47 — the two arcade cards share an `exclusiveGroup`, so a booking may carry one of them,
 *        not both. The brief says "OR".
 * R-50 — QBIX is a priced line item with no schedule; it is eligible on every package.
 */
export function validateAddOnSelection(args: {
  selections: readonly AddOnSelection[];
  packageRecord: PackageRecord;
  guests: number;
  catalog: Catalog;
  config: EngineConfig;
}): Result<ResolvedAddOn[]> {
  const { selections, packageRecord, guests, catalog, config } = args;
  const resolved: ResolvedAddOn[] = [];
  const seenGroups = new Map<string, string>();
  const seenCodes = new Set<string>();

  for (const selection of selections) {
    const addOn = findAddOn(catalog, selection.addOnCode);
    if (!addOn) {
      return reject(
        'UNKNOWN_REFERENCE',
        `"${selection.addOnCode}" is no longer available. Refresh the extras and pick again.`,
        { addOnCode: selection.addOnCode },
      );
    }

    if (seenCodes.has(addOn.code)) {
      return reject(
        'ADDON_QUANTITY_INVALID',
        `${addOn.name} appears twice. Combine it into one line with the total quantity.`,
        { addOnCode: addOn.code },
      );
    }
    seenCodes.add(addOn.code);

    if (!isAddOnEligible(addOn, packageRecord)) {
      return reject(
        'ADDON_NOT_ELIGIBLE',
        `${addOn.name} is not available with ${packageRecord.name}. Remove it, or switch packages.`,
        { addOnCode: addOn.code, packageCode: packageRecord.code },
      );
    }

    if (!Number.isInteger(selection.quantity) || selection.quantity < 1) {
      return reject(
        'ADDON_QUANTITY_INVALID',
        `Choose how many ${addOn.name} you want — at least 1, or remove the line.`,
        { addOnCode: addOn.code, quantity: selection.quantity },
      );
    }

    if (addOn.pricingMode === 'PER_GUEST' && selection.quantity > guests) {
      return reject(
        'ADDON_QUANTITY_INVALID',
        `${addOn.name} is priced per guest, so you cannot buy more than your ${guests} guests.`,
        { addOnCode: addOn.code, quantity: selection.quantity, guests },
      );
    }

    // Per-unit lines (pizzas, wings) had no ceiling at all, so a hand-rolled POST could put a
    // six-figure quantity on a booking — and a quantity large enough to leave the safe integer
    // range made `multiplyMoney` throw rather than reject. `CFG.maxPartyGuests` is the venue's
    // own largest party and is a generous bound on any single food line; it is a safety rail,
    // not a priced rule, and the real per-line limit is a question for the manager.
    if (addOn.pricingMode !== 'PER_GUEST' && selection.quantity > config.maxPartyGuests) {
      return reject(
        'ADDON_QUANTITY_INVALID',
        `You cannot order more than ${config.maxPartyGuests} of ${addOn.name} online. Call us for a larger order.`,
        { addOnCode: addOn.code, quantity: selection.quantity, maxQuantity: config.maxPartyGuests },
      );
    }

    if (addOn.exclusiveGroup) {
      const existing = seenGroups.get(addOn.exclusiveGroup);
      if (existing) {
        return reject(
          'ADDON_EXCLUSIVE_CONFLICT',
          `You can pick one arcade card option, not both — ${existing} or ${addOn.name}.`,
          { addOnCode: addOn.code, conflictsWith: existing, exclusiveGroup: addOn.exclusiveGroup },
        );
      }
      seenGroups.set(addOn.exclusiveGroup, addOn.name);
    }

    let optionLabel: string | null = null;
    let optionPriceDeltaCents = 0;
    if (addOn.requiresOptionChoice) {
      const option = addOn.options.find((o) => o.id === selection.addOnOptionId);
      if (!option) {
        return reject(
          'ADDON_OPTION_INVALID',
          `Choose an option for ${addOn.name}: ${addOn.options.map((o) => o.label).join(', ')}.`,
          { addOnCode: addOn.code, options: addOn.options.map((o) => o.label) },
        );
      }
      optionLabel = option.label;
      optionPriceDeltaCents = option.priceDeltaCents;

      // R-48: the 5-Up load moves in CFG.arcadeMatchIncrement steps between the min and max.
      if (addOn.exclusiveGroup === 'ARCADE_CARD') {
        const load = addOn.priceCents + option.priceDeltaCents;
        const inRange = load >= config.arcadeMatchMinCents && load <= config.arcadeMatchMaxCents;
        const onIncrement = (load - config.arcadeMatchMinCents) % config.arcadeMatchIncrementCents === 0;
        if (!inRange || !onIncrement) {
          return reject(
            'ADDON_OPTION_INVALID',
            `Arcade card loads run from ${formatMoney(cents(config.arcadeMatchMinCents))} to ${formatMoney(cents(config.arcadeMatchMaxCents))} in ${formatMoney(cents(config.arcadeMatchIncrementCents))} steps.`,
            { addOnCode: addOn.code, loadCents: load },
          );
        }
      }
    }

    resolved.push({ addOn, selection, optionLabel, optionPriceDeltaCents });
  }

  return ok(resolved);
}

/**
 * R-49 — the 45-minute Time Play card does not work on Claw Machines or QBIX. Both are still
 * purchasable (QBIX is paid separately); this is a warning the UI must show, not a rejection.
 */
export function addOnWarnings(resolved: readonly ResolvedAddOn[]): string[] {
  const codes = new Set(resolved.map((r) => r.addOn.code));
  const warnings: string[] = [];
  if (codes.has('ARCADE_TIMEPLAY_45')) {
    warnings.push(
      'The 45-minute Time Play card earns no prize points, and does not work on Claw Machines or QBIX.',
    );
  }
  if (codes.has('ARCADE_TIMEPLAY_45') && codes.has('QBIX_5D')) {
    warnings.push('QBIX is paid separately — the Time Play card does not cover it.');
  }
  return warnings;
}

/** R-48 — what the guest actually walks away with: their load plus the 1:1 match, capped. */
export function arcadeMatchValueCents(loadCents: number, config: EngineConfig): number {
  const match = Math.min(loadCents, config.arcadeMatchMaxCents);
  return loadCents + match;
}
