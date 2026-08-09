/**
 * Pizza tiers (R-41, R-42, R-43).
 *
 * The brief's original table has a gap (11 guests undefined) and two overlaps (20 and 25 each
 * appear in two rows). That is why this is a validated lookup table and not a chain of ifs:
 * the validation is what makes the bug visible instead of silently resolving to whichever row
 * happened to be checked first.
 */

import type { EngineConfig } from './config';
import { ok, reject, type Result } from './errors';
import type { PackageRecord, PizzaTierRecord } from './types';

export interface TierValidationProblem {
  kind: 'OVERLAP' | 'GAP' | 'INVERTED' | 'NON_POSITIVE';
  message: string;
}

/**
 * R-41 — tiers MUST be contiguous and non-overlapping. Run this on save in the manager
 * backend; the brief's original rows would fail it, which is exactly the point.
 */
export function validatePizzaTiers(tiers: readonly PizzaTierRecord[]): TierValidationProblem[] {
  const problems: TierValidationProblem[] = [];
  const sorted = [...tiers].sort((a, b) => a.minGuests - b.minGuests);

  for (const tier of sorted) {
    if (tier.maxGuests < tier.minGuests) {
      problems.push({
        kind: 'INVERTED',
        message: `Tier ${tier.minGuests}-${tier.maxGuests} ends before it starts.`,
      });
    }
    if (tier.pizzaCount < 0) {
      problems.push({
        kind: 'NON_POSITIVE',
        message: `Tier ${tier.minGuests}-${tier.maxGuests} has a negative pizza count.`,
      });
    }
  }

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (current.minGuests <= previous.maxGuests) {
      problems.push({
        kind: 'OVERLAP',
        message: `Guest count ${current.minGuests} falls in both the ${previous.minGuests}-${previous.maxGuests} tier and the ${current.minGuests}-${current.maxGuests} tier.`,
      });
    } else if (current.minGuests > previous.maxGuests + 1) {
      problems.push({
        kind: 'GAP',
        message: `Guest counts ${previous.maxGuests + 1}-${current.minGuests - 1} are not covered by any pizza tier.`,
      });
    }
  }

  return problems;
}

/** The tier row covering a guest count, or null when the tiers do not reach that far. */
export function pizzaTierFor(guests: number, tiers: readonly PizzaTierRecord[]): PizzaTierRecord | null {
  return tiers.find((t) => guests >= t.minGuests && guests <= t.maxGuests) ?? null;
}

/**
 * R-42 — the tier applies only to packages where `includesPizza` is true. Under the seeded
 * default (OQ-02) that is GREAT_ADVENTURE and AROUND_THE_WORLD; TRAVELER parties get 0
 * included pizzas and see pizza offered as a paid add-on.
 *
 * A guest count below the smallest tier (fewer than 10 guests) gets the smallest tier's
 * count, because the package "accommodates 10 guests" and its food does not shrink.
 */
export function includedPizzaCount(args: {
  guests: number;
  packageRecord: PackageRecord;
  tiers: readonly PizzaTierRecord[];
  foodChoice?: 'PIZZA' | 'HOT_DOGS' | 'NONE';
}): Result<number> {
  const { guests, packageRecord, tiers } = args;
  if (!packageRecord.includesPizza) return ok(0);
  // R-43: choosing hot dogs replaces the pizza allotment entirely.
  if (args.foodChoice === 'HOT_DOGS' || args.foodChoice === 'NONE') return ok(0);

  const problems = validatePizzaTiers(tiers);
  if (problems.length > 0) {
    return reject('CONFIG_INVALID', `The pizza tiers are inconsistent: ${problems[0].message}`, {
      problems: problems.map((p) => p.message),
    });
  }

  const sorted = [...tiers].sort((a, b) => a.minGuests - b.minGuests);
  if (sorted.length === 0) return ok(0);
  if (guests < sorted[0].minGuests) return ok(sorted[0].pizzaCount);

  const tier = pizzaTierFor(guests, sorted);
  if (!tier) {
    return reject(
      'CONFIG_INVALID',
      `No pizza tier covers ${guests} guests. Extend the top tier in the manager backend.`,
      { guests, maxTierGuests: sorted[sorted.length - 1].maxGuests },
    );
  }
  return ok(tier.pizzaCount);
}

/** R-43 / OQ-19: hot dogs replace the pizza allotment at CFG.hotDogsPerGuest each. */
export function includedHotDogCount(
  guests: number,
  packageRecord: PackageRecord,
  config: EngineConfig,
  foodChoice: 'PIZZA' | 'HOT_DOGS' | 'NONE',
): number {
  if (!packageRecord.includesHotDogOption || foodChoice !== 'HOT_DOGS') return 0;
  return guests * config.hotDogsPerGuest;
}

/** R-44 / OQ-19: cupcakes are included with the two food packages; quantity is a default. */
export function includedCupcakeCount(
  guests: number,
  packageRecord: PackageRecord,
  config: EngineConfig,
): number {
  return packageRecord.includesCupcakes ? guests * config.cupcakesPerGuest : 0;
}
