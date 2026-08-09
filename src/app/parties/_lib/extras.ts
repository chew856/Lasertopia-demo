/**
 * Screen P4's add-on model: grouping, form field names, and parsing a POST back into engine
 * `AddOnSelection`s.
 *
 * Pure. Grouping is derived from add-on *data*, never from a list of codes typed here:
 * pizzas and wings are the tax-inclusive lines (R-51), the two arcade cards are the ones that
 * share an `exclusiveGroup` (R-47), and everything else is its own row. Adding a ninth add-on
 * in the manager backend must not require this file to change.
 *
 * Validation is deliberately NOT duplicated here. Eligibility, quantity caps, exclusivity and
 * option choice all belong to `validateAddOnSelection`, and this parser's job is only to turn
 * form fields into the shape that function takes — so a crafted POST meets the same rules as a
 * tap.
 */

import { party } from "@/lib/copy";
import type {
  AddOnRecord,
  AddOnSelection,
  Catalog,
  FoodChoice,
  PackageRecord,
} from "@/lib/domain";
import { eligibleAddOns } from "@/lib/domain";

export interface AddOnGroups {
  /** Tax-inclusive lines: pizzas and wings (R-51). */
  food: AddOnRecord[];
  /** The mutually exclusive arcade cards (R-47). */
  arcade: AddOnRecord[];
  /** Everything else — QBIX today. */
  other: AddOnRecord[];
}

export function groupAddOns(catalog: Catalog, packageRecord: PackageRecord): AddOnGroups {
  const eligible = eligibleAddOns(catalog, packageRecord);
  return {
    food: eligible.filter((a) => a.taxIncluded),
    arcade: eligible.filter((a) => !a.taxIncluded && a.exclusiveGroup !== null),
    other: eligible.filter((a) => !a.taxIncluded && a.exclusiveGroup === null),
  };
}

/**
 * Add-ons this package cannot be sold. R-46's arcade cards on Around The World are the case
 * that matters: they still render, disabled, with the reason — never hidden (DESIGN §5.8).
 */
export function ineligibleAddOns(catalog: Catalog, packageRecord: PackageRecord): AddOnRecord[] {
  const eligible = new Set(eligibleAddOns(catalog, packageRecord).map((a) => a.code));
  return catalog.addOns
    .filter((a) => a.isActive && !eligible.has(a.code))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ─── Form field names ─────────────────────────────────────────────────────────────────────

export const FOOD_CHOICE_FIELD = "foodChoice";
export const ARCADE_CHOICE_FIELD = "arcadeChoice";

export function onField(code: string): string {
  return `addon:${code}:on`;
}
export function qtyField(code: string): string {
  return `addon:${code}:qty`;
}
export function optionField(code: string): string {
  return `addon:${code}:option`;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────────────────

/** A plain record so this is testable without a `FormData` or a request. */
export type FormValues = Record<string, string | undefined>;

export function formValuesFrom(form: FormData): FormValues {
  const out: FormValues = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function positiveInteger(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;
  const value = Number.parseInt(trimmed, 10);
  return value > 0 ? value : fallback;
}

export interface ParsedExtras {
  selections: AddOnSelection[];
  foodChoice: FoodChoice;
}

/**
 * Build the engine's selection list from a submitted extras form.
 *
 * The arcade cards arrive as one radio (`arcadeChoice`) rather than two checkboxes, because
 * COPY.md §5.4 presents them as one question — but a hand-rolled POST can still send both, and
 * that is left for `validateAddOnSelection` to reject with `ADDON_EXCLUSIVE_CONFLICT`.
 */
export function parseExtrasForm(
  values: FormValues,
  catalog: Catalog,
  packageRecord: PackageRecord,
  guests: number,
): ParsedExtras {
  const groups = groupAddOns(catalog, packageRecord);
  const selections: AddOnSelection[] = [];

  const push = (addOn: AddOnRecord, defaultQuantity: number) => {
    const quantity = positiveInteger(values[qtyField(addOn.code)], defaultQuantity);
    const optionId = values[optionField(addOn.code)]?.trim();
    selections.push({
      addOnCode: addOn.code,
      quantity,
      ...(optionId ? { addOnOptionId: optionId } : {}),
    });
  };

  for (const addOn of [...groups.food, ...groups.other]) {
    if (values[onField(addOn.code)] !== "on") continue;
    push(addOn, addOn.pricingMode === "PER_GUEST" ? guests : 1);
  }

  const arcadeChoice = values[ARCADE_CHOICE_FIELD]?.trim();
  if (arcadeChoice) {
    const chosen = groups.arcade.find((a) => a.code === arcadeChoice);
    if (chosen) push(chosen, guests);
  }

  const rawFood = values[FOOD_CHOICE_FIELD]?.trim();
  const foodChoice: FoodChoice =
    rawFood === "HOT_DOGS" && packageRecord.includesHotDogOption
      ? "HOT_DOGS"
      : packageRecord.includesPizza
        ? "PIZZA"
        : "NONE";

  return { selections, foodChoice };
}

/** Selections already stored on a draft, back in form-value shape, so P4 re-renders checked. */
export function formValuesForSelections(
  selections: readonly AddOnSelection[],
  foodChoice: FoodChoice,
  arcadeCodes: readonly string[],
): FormValues {
  const values: FormValues = { [FOOD_CHOICE_FIELD]: foodChoice };
  for (const selection of selections) {
    if (arcadeCodes.includes(selection.addOnCode)) {
      values[ARCADE_CHOICE_FIELD] = selection.addOnCode;
    } else {
      values[onField(selection.addOnCode)] = "on";
    }
    values[qtyField(selection.addOnCode)] = String(selection.quantity);
    if (selection.addOnOptionId) values[optionField(selection.addOnCode)] = selection.addOnOptionId;
  }
  return values;
}

// ─── Display names ────────────────────────────────────────────────────────────────────────

const ADDON_COPY: Record<string, string> = {
  ARCADE_5UP_MATCH: party.addon.ARCADE_5UP_MATCH.name,
  ARCADE_TIMEPLAY_45: party.addon.ARCADE_TIMEPLAY_45.name,
  QBIX_5D: party.addon.QBIX_5D.name,
  PIZZA_CHEESE: party.addon.PIZZA_CHEESE.name,
  PIZZA_1TOP: party.addon.PIZZA_1TOP.name,
  PIZZA_2TOP: party.addon.PIZZA_2TOP.name,
  WINGS_8: party.addon.WINGS_8.name,
  WINGS_16: party.addon.WINGS_16.name,
  WINGS_24: party.addon.WINGS_24.name,
};

const ADDON_BODY: Record<string, string> = {
  ARCADE_5UP_MATCH: party.addon.ARCADE_5UP_MATCH.body,
  ARCADE_TIMEPLAY_45: party.addon.ARCADE_TIMEPLAY_45.body,
  QBIX_5D: party.addon.QBIX_5D.body,
};

const ADDON_UNIT: Record<string, string> = {
  ARCADE_5UP_MATCH: party.addon.ARCADE_5UP_MATCH.unit,
  ARCADE_TIMEPLAY_45: party.addon.ARCADE_TIMEPLAY_45.unit,
  QBIX_5D: party.addon.QBIX_5D.unit,
  PIZZA_CHEESE: party.addon.PIZZA.unit,
  PIZZA_1TOP: party.addon.PIZZA.unit,
  PIZZA_2TOP: party.addon.PIZZA.unit,
  WINGS_8: party.addon.WINGS.unit,
  WINGS_16: party.addon.WINGS.unit,
  WINGS_24: party.addon.WINGS.unit,
};

/**
 * The deck's name for an add-on, falling back to the seeded catalog name. The fallback is not
 * invented copy — a manager-added add-on carries its own name as configuration (CLAUDE.md), and
 * COPY.md §11.6 only covers the nine that shipped.
 */
export function addOnName(addOn: AddOnRecord): string {
  return ADDON_COPY[addOn.code] ?? addOn.name;
}

export function addOnBody(addOn: AddOnRecord): string | null {
  return ADDON_BODY[addOn.code] ?? null;
}

export function addOnUnit(addOn: AddOnRecord): string | null {
  return ADDON_UNIT[addOn.code] ?? null;
}

/** The option-picker's label: toppings for pizza, sauce for wings. */
export function addOnOptionLabel(addOn: AddOnRecord): string {
  if (addOn.code.startsWith("WINGS")) return party.addon.WINGS.sauceLabel;
  return party.addon.PIZZA.toppingsLabel;
}
