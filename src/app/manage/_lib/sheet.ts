/**
 * The printable party sheet's model — STRATEGY §4.7, COPY.md §13.9.
 *
 * A physical artifact for the floor, so everything a host reads off it is derived once, here,
 * and the page only formats. Pure: no Prisma, no React, no clock.
 *
 * The two things this file exists to get right are the ones a host cannot recover from:
 * the **arena groups** (a party over the cap plays in two groups at different times, and a
 * sheet that lists four times in one row sends the whole party into the arena at once), and
 * the **allergy box**, which prints "None recorded" rather than nothing — an affirmative
 * statement staff can trust is not the same as an empty box.
 */

export type FoodLineKind = 'pizza' | 'hotdogs' | 'cupcakes' | 'wings' | 'none';

export interface FoodLine {
  kind: FoodLineKind;
  count: number;
  /** Toppings or sauces, in the order they were ordered. */
  options: string[];
}

export type AddOnLineKind =
  | 'qbix'
  | 'arcadeMatch'
  | 'arcadeTimeplay'
  | 'funcard'
  | 'frenzy'
  | 'typhoon';

export interface AddOnLine {
  kind: AddOnLineKind;
  count: number;
}

export interface ArenaGroupLine {
  index: number;
  startMinutes: number[];
}

export type SheetDepositState = 'pending' | 'recorded' | 'giftcard' | 'forfeited';

export interface SheetInput {
  guestCount: number;
  foodChoice: string;
  includedPizzaCount: number;
  package: {
    includesPizza: boolean;
    includesCupcakes: boolean;
    includesHotDogOption: boolean;
    includesLazerFrenzy: boolean;
    includesTyphoon: boolean;
    funCardCentsPerGuest: number;
  };
  hotDogsPerGuest: number;
  cupcakesPerGuest: number;
  games: { startMinutes: number; arenaGroupIndex: number }[];
  addOns: { code: string; quantity: number; optionLabel: string | null }[];
  notes: string | null;
  totalCents: number;
  deposit: { amountCents: number; status: string } | null;
}

export interface SheetModel {
  arenaGroups: ArenaGroupLine[];
  /** True when the party plays in more than one arena group — `sheet.games.split`. */
  isSplit: boolean;
  food: FoodLine[];
  addOns: AddOnLine[];
  /** `null` prints `sheet.allergies.none`; it never prints an empty box. */
  allergies: string | null;
  depositState: SheetDepositState;
  depositAmountCents: number;
  balanceDueCents: number;
}

/** The `AddOn.code` values the sheet has a designed line for (COPY.md §13.9). */
const PIZZA_CODES = ['PIZZA_CHEESE', 'PIZZA_1TOP', 'PIZZA_2TOP'];
const WING_CODES = ['WINGS_8', 'WINGS_16', 'WINGS_24'];

export function buildArenaGroups(
  games: readonly { startMinutes: number; arenaGroupIndex: number }[],
): ArenaGroupLine[] {
  const byIndex = new Map<number, number[]>();
  for (const game of games) {
    const times = byIndex.get(game.arenaGroupIndex) ?? [];
    times.push(game.startMinutes);
    byIndex.set(game.arenaGroupIndex, times);
  }
  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, startMinutes]) => ({ index, startMinutes: startMinutes.sort((a, b) => a - b) }));
}

export function buildFoodLines(input: SheetInput): FoodLine[] {
  const lines: FoodLine[] = [];

  const pizzaAddOns = input.addOns.filter((line) => PIZZA_CODES.includes(line.code));
  const addedPizzaCount = pizzaAddOns.reduce((total, line) => total + line.quantity, 0);
  const pizzaCount =
    (input.package.includesPizza && input.foodChoice === 'PIZZA' ? input.includedPizzaCount : 0) +
    addedPizzaCount;

  if (pizzaCount > 0) {
    lines.push({
      kind: 'pizza',
      count: pizzaCount,
      options: pizzaAddOns
        .map((line) => line.optionLabel)
        .filter((label): label is string => typeof label === 'string' && label !== ''),
    });
  }

  if (input.package.includesHotDogOption && input.foodChoice === 'HOT_DOGS') {
    lines.push({
      kind: 'hotdogs',
      count: input.guestCount * input.hotDogsPerGuest,
      options: [],
    });
  }

  if (input.package.includesCupcakes) {
    lines.push({ kind: 'cupcakes', count: input.guestCount * input.cupcakesPerGuest, options: [] });
  }

  const wingLines = input.addOns.filter((line) => WING_CODES.includes(line.code));
  const wingCount = wingLines.reduce((total, line) => total + line.quantity, 0);
  if (wingCount > 0) {
    lines.push({
      kind: 'wings',
      count: wingCount,
      options: wingLines
        .map((line) => line.optionLabel)
        .filter((label): label is string => typeof label === 'string' && label !== ''),
    });
  }

  // An empty list is a fact the host needs stated, not an omission — The Traveler includes no
  // food, and a blank FOOD box reads as "we forgot to write it down".
  if (lines.length === 0) lines.push({ kind: 'none', count: 0, options: [] });
  return lines;
}

export function buildAddOnLines(input: SheetInput): AddOnLine[] {
  const lines: AddOnLine[] = [];
  const quantityOf = (code: string): number =>
    input.addOns
      .filter((line) => line.code === code)
      .reduce((total, line) => total + line.quantity, 0);

  const qbix = quantityOf('QBIX_5D');
  if (qbix > 0) lines.push({ kind: 'qbix', count: qbix });

  const match = quantityOf('ARCADE_5UP_MATCH');
  if (match > 0) lines.push({ kind: 'arcadeMatch', count: match });

  const timeplay = quantityOf('ARCADE_TIMEPLAY_45');
  if (timeplay > 0) lines.push({ kind: 'arcadeTimeplay', count: timeplay });

  if (input.package.funCardCentsPerGuest > 0) {
    lines.push({ kind: 'funcard', count: input.guestCount });
  }
  if (input.package.includesLazerFrenzy) lines.push({ kind: 'frenzy', count: 0 });
  if (input.package.includesTyphoon) lines.push({ kind: 'typhoon', count: 0 });

  return lines;
}

function depositStateOf(status: string | undefined): SheetDepositState {
  switch (status) {
    case 'RECORDED':
    case 'APPLIED':
    case 'CARRIED_FORWARD':
      return 'recorded';
    case 'CONVERTED_TO_GIFT_CARD':
      return 'giftcard';
    case 'FORFEITED':
      return 'forfeited';
    default:
      return 'pending';
  }
}

export function buildSheet(input: SheetInput): SheetModel {
  const arenaGroups = buildArenaGroups(input.games);
  const depositState = depositStateOf(input.deposit?.status);
  const depositAmountCents = input.deposit?.amountCents ?? 0;
  // Only money actually taken comes off the balance. A forfeited or gift-carded deposit is no
  // longer sitting against this booking, so the floor must still collect the full amount.
  const applied = depositState === 'recorded' ? depositAmountCents : 0;

  return {
    arenaGroups,
    isSplit: arenaGroups.length > 1,
    food: buildFoodLines(input),
    addOns: buildAddOnLines(input),
    allergies: input.notes && input.notes.trim() !== '' ? input.notes.trim() : null,
    depositState,
    depositAmountCents,
    balanceDueCents: Math.max(0, input.totalCents - applied),
  };
}
