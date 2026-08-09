/**
 * Screen P4's pure logic: how add-ons are grouped and how a submitted form becomes the engine's
 * `AddOnSelection` list.
 *
 * The grouping is deliberately derived from add-on *data* rather than from a list of codes, so
 * a manager adding a tenth add-on does not need a deploy: pizzas and wings are the tax-inclusive
 * lines (R-51) and the arcade cards are the ones sharing an `exclusiveGroup` (R-47).
 *
 * The parser is also the crafted-POST boundary. It never validates — that is
 * `validateAddOnSelection`'s job — so these tests check that it faithfully passes a hostile
 * payload through to the engine rather than silently sanitising it into something legal.
 */

import { describe, expect, it } from 'vitest';

import {
  ARCADE_CHOICE_FIELD,
  FOOD_CHOICE_FIELD,
  addOnName,
  addOnOptionLabel,
  addOnUnit,
  formValuesForSelections,
  groupAddOns,
  ineligibleAddOns,
  onField,
  optionField,
  parseExtrasForm,
  qtyField,
} from '@/app/parties/_lib/extras';
import { computePartyPrice } from '@/lib/domain';

import { addOnOptionId, catalog, config, packageByCode } from './helpers';

const traveler = packageByCode('TRAVELER');
const aroundTheWorld = packageByCode('AROUND_THE_WORLD');

describe('groupAddOns', () => {
  it('puts every tax-inclusive line in food and nothing else', () => {
    const groups = groupAddOns(catalog, traveler);
    expect(groups.food.every((a) => a.taxIncluded)).toBe(true);
    expect(groups.food.map((a) => a.code)).toEqual(
      expect.arrayContaining(['PIZZA_CHEESE', 'PIZZA_1TOP', 'WINGS_8']),
    );
  });

  it('groups the two arcade cards together by their exclusive group, not by name', () => {
    const groups = groupAddOns(catalog, traveler);
    expect(groups.arcade.map((a) => a.code).sort()).toEqual([
      'ARCADE_5UP_MATCH',
      'ARCADE_TIMEPLAY_45',
    ]);
    expect(new Set(groups.arcade.map((a) => a.exclusiveGroup))).toEqual(new Set(['ARCADE_CARD']));
  });

  it('leaves QBIX on its own', () => {
    expect(groupAddOns(catalog, traveler).other.map((a) => a.code)).toEqual(['QBIX_5D']);
  });

  it('offers no arcade cards on Around The World (R-46) but still lists them as ineligible', () => {
    expect(groupAddOns(catalog, aroundTheWorld).arcade).toEqual([]);
    const blocked = ineligibleAddOns(catalog, aroundTheWorld).map((a) => a.code);
    expect(blocked).toContain('ARCADE_5UP_MATCH');
    expect(blocked).toContain('ARCADE_TIMEPLAY_45');
  });

  it('has nothing ineligible on a package that takes everything', () => {
    expect(ineligibleAddOns(catalog, traveler)).toEqual([]);
  });
});

describe('parseExtrasForm', () => {
  it('ignores an add-on whose checkbox is not on', () => {
    const parsed = parseExtrasForm(
      { [qtyField('QBIX_5D')]: '10' },
      catalog,
      traveler,
      10,
    );
    expect(parsed.selections).toEqual([]);
  });

  it('defaults a per-guest add-on to the guest count and a per-unit one to 1', () => {
    const parsed = parseExtrasForm(
      { [onField('QBIX_5D')]: 'on', [onField('PIZZA_CHEESE')]: 'on' },
      catalog,
      traveler,
      16,
    );
    expect(parsed.selections).toEqual(
      expect.arrayContaining([
        { addOnCode: 'QBIX_5D', quantity: 16 },
        { addOnCode: 'PIZZA_CHEESE', quantity: 1 },
      ]),
    );
  });

  it('carries the chosen topping through as an option id', () => {
    const pepperoni = addOnOptionId('PIZZA_1TOP', 'Pepperoni');
    const parsed = parseExtrasForm(
      {
        [onField('PIZZA_1TOP')]: 'on',
        [qtyField('PIZZA_1TOP')]: '4',
        [optionField('PIZZA_1TOP')]: pepperoni,
      },
      catalog,
      traveler,
      16,
    );
    expect(parsed.selections).toEqual([
      { addOnCode: 'PIZZA_1TOP', quantity: 4, addOnOptionId: pepperoni },
    ]);
  });

  it('falls back to a sane quantity rather than trusting junk', () => {
    const parsed = parseExtrasForm(
      { [onField('QBIX_5D')]: 'on', [qtyField('QBIX_5D')]: '-3' },
      catalog,
      traveler,
      12,
    );
    expect(parsed.selections[0].quantity).toBe(12);
  });

  it('takes the arcade card from the radio, never from a checkbox', () => {
    const parsed = parseExtrasForm(
      {
        [ARCADE_CHOICE_FIELD]: 'ARCADE_TIMEPLAY_45',
        [qtyField('ARCADE_TIMEPLAY_45')]: '8',
      },
      catalog,
      traveler,
      10,
    );
    expect(parsed.selections).toEqual([{ addOnCode: 'ARCADE_TIMEPLAY_45', quantity: 8 }]);
  });

  it('drops an arcade choice the package cannot be sold', () => {
    const parsed = parseExtrasForm(
      { [ARCADE_CHOICE_FIELD]: 'ARCADE_5UP_MATCH' },
      catalog,
      aroundTheWorld,
      10,
    );
    expect(parsed.selections).toEqual([]);
  });

  it('resolves the food choice from the package, not from the posted value alone', () => {
    // The Traveler includes no food (R-42), so a posted "HOT_DOGS" cannot conjure any.
    expect(
      parseExtrasForm({ [FOOD_CHOICE_FIELD]: 'HOT_DOGS' }, catalog, traveler, 10).foodChoice,
    ).toBe('NONE');
    expect(
      parseExtrasForm(
        { [FOOD_CHOICE_FIELD]: 'HOT_DOGS' },
        catalog,
        packageByCode('GREAT_ADVENTURE'),
        10,
      ).foodChoice,
    ).toBe('HOT_DOGS');
  });

  it('produces a selection the engine actually accepts', () => {
    const parsed = parseExtrasForm(
      { [onField('QBIX_5D')]: 'on', [ARCADE_CHOICE_FIELD]: 'ARCADE_TIMEPLAY_45' },
      catalog,
      traveler,
      12,
    );
    const priced = computePartyPrice({
      packageRecord: traveler,
      guests: 12,
      addOns: parsed.selections,
      foodChoice: parsed.foodChoice,
      catalog,
      config,
    });
    expect(priced.ok).toBe(true);
  });

  it('hands a hostile double-arcade payload to the engine rather than silently fixing it', () => {
    // Both cards can only arrive from a crafted POST. The parser must not sanitise it away:
    // R-47 is the engine's rule and ADDON_EXCLUSIVE_CONFLICT is a designed customer state.
    const priced = computePartyPrice({
      packageRecord: traveler,
      guests: 10,
      addOns: [
        { addOnCode: 'ARCADE_5UP_MATCH', quantity: 10, addOnOptionId: addOnOptionId('ARCADE_5UP_MATCH', 'Load $5 (matched with $5)') },
        { addOnCode: 'ARCADE_TIMEPLAY_45', quantity: 10 },
      ],
      catalog,
      config,
    });
    expect(priced.ok).toBe(false);
    if (priced.ok) return;
    expect(priced.error.code).toBe('ADDON_EXCLUSIVE_CONFLICT');
  });
});

describe('round-tripping a saved basket back into the form', () => {
  it('re-checks non-arcade rows and re-selects the arcade radio', () => {
    const values = formValuesForSelections(
      [
        { addOnCode: 'QBIX_5D', quantity: 12 },
        { addOnCode: 'ARCADE_TIMEPLAY_45', quantity: 12 },
      ],
      'NONE',
      ['ARCADE_5UP_MATCH', 'ARCADE_TIMEPLAY_45'],
    );
    expect(values[onField('QBIX_5D')]).toBe('on');
    expect(values[onField('ARCADE_TIMEPLAY_45')]).toBeUndefined();
    expect(values[ARCADE_CHOICE_FIELD]).toBe('ARCADE_TIMEPLAY_45');
    expect(values[qtyField('QBIX_5D')]).toBe('12');
  });
});

describe('display names', () => {
  it('prefers the copy deck name over the seeded catalog name', () => {
    const pizza = catalog.addOns.find((a) => a.code === 'PIZZA_CHEESE');
    expect(pizza?.name).toBe('Extra Large Cheese pizza');
    expect(addOnName(pizza!)).toBe('Large cheese pizza');
  });

  it('falls back to the catalog name for an add-on the deck has never seen', () => {
    const invented = { ...catalog.addOns[0], code: 'NEW_THING', name: 'Bouncy castle' };
    expect(addOnName(invented)).toBe('Bouncy castle');
    expect(addOnUnit(invented)).toBeNull();
  });

  it('labels the wings picker as sauce and everything else as toppings', () => {
    const wings = catalog.addOns.find((a) => a.code === 'WINGS_8')!;
    const pizza = catalog.addOns.find((a) => a.code === 'PIZZA_1TOP')!;
    expect(addOnOptionLabel(wings)).toBe('Sauce');
    expect(addOnOptionLabel(pizza)).toBe('Toppings');
  });
});
