import { interpolate } from '@/lib/copy';
import { manager } from '@/lib/copy/manager';
import type { EngineConfig } from '@/lib/domain';
import {
  formatDuration,
  formatMoney,
  formatPhone,
  formatTime,
  formatTimeRange,
  venueDateOf,
  venueMinutesOf,
} from '@/lib/format';

import type { BookingWithDetail } from '../_lib/catalog';
import { buildSheet, type AddOnLine, type FoodLine } from '../_lib/sheet';

import './print-sheet.css';

/**
 * One printed party sheet — COPY.md §13.9, in STRATEGY §4.7's order of size.
 *
 * Everything the host needs and nothing they do not. The two items that must never be missed
 * are the honoree's name (largest thing on the page) and the allergy box (heavy-ruled, and it
 * prints "None recorded" rather than nothing, because an empty box reads as an omission).
 *
 * Derivation happens in `_lib/sheet.ts`, which is pure and tested: how many pizzas, which
 * add-ons, whether the party splits into two arena groups, and what is still owed. This file
 * only formats.
 */

const { sheet } = manager;

const CHECKLIST = [
  sheet.checklist.roomSet,
  sheet.checklist.arrived,
  sheet.checklist.game1,
  sheet.checklist.game2,
  sheet.checklist.food,
  sheet.checklist.cake,
  sheet.checklist.merch,
  sheet.checklist.prizes,
  sheet.checklist.cleared,
] as const;

function foodLine(line: FoodLine): string {
  switch (line.kind) {
    case 'pizza':
      return interpolate(sheet.food.pizza, {
        pizzaCount: line.count,
        list: line.options.length > 0 ? line.options.join(', ') : sheet.addons.none,
      });
    case 'hotdogs':
      return interpolate(sheet.food.hotdogs, { n: line.count });
    case 'cupcakes':
      return interpolate(sheet.food.cupcakes, { n: line.count });
    case 'wings':
      return interpolate(sheet.food.wings, {
        n: line.count,
        list: line.options.length > 0 ? line.options.join(', ') : sheet.addons.none,
      });
    case 'none':
      return sheet.food.none;
  }
}

function addOnLine(line: AddOnLine): string {
  switch (line.kind) {
    case 'qbix':
      return interpolate(sheet.addons.qbix, { n: line.count });
    case 'arcadeMatch':
      return interpolate(sheet.addons.arcadeMatch, { n: line.count });
    case 'arcadeTimeplay':
      return interpolate(sheet.addons.arcadeTimeplay, { n: line.count });
    case 'funcard':
      return interpolate(sheet.addons.funcard, { n: line.count });
    case 'frenzy':
      return sheet.addons.frenzy;
    case 'typhoon':
      return sheet.addons.typhoon;
  }
}

const DEPOSIT_WORD: Record<string, string> = {
  pending: manager.mg.booking.deposit.status.pending,
  recorded: manager.mg.bookings.filter.status.confirmed,
  giftcard: manager.mg.booking.cancel.giftcardToggle,
  forfeited: manager.mg.bookings.filter.status.cancelled,
};

export function PartySheet({
  booking,
  config,
  printedAt,
}: {
  booking: BookingWithDetail;
  config: EngineConfig;
  printedAt: Date;
}) {
  const party = booking.party;
  if (!party) return null;

  const model = buildSheet({
    guestCount: party.guestCount,
    foodChoice: party.foodChoice,
    includedPizzaCount: party.includedPizzaCount,
    package: {
      includesPizza: party.packageRef.includesPizza,
      includesCupcakes: party.packageRef.includesCupcakes,
      includesHotDogOption: party.packageRef.includesHotDogOption,
      includesLazerFrenzy: party.packageRef.includesLazerFrenzy,
      includesTyphoon: party.packageRef.includesTyphoon,
      funCardCentsPerGuest: party.packageRef.funCardCentsPerGuest,
    },
    hotDogsPerGuest: config.hotDogsPerGuest,
    cupcakesPerGuest: config.cupcakesPerGuest,
    games: booking.games.map((game) => ({
      startMinutes: game.gameSlot.startMinutes,
      arenaGroupIndex: game.arenaGroupIndex,
    })),
    addOns: booking.addOns.map((line) => ({
      code: line.addOn.code,
      quantity: line.quantity,
      optionLabel: line.option?.label ?? null,
    })),
    notes: booking.notes,
    totalCents: booking.totalCents,
    deposit: booking.deposit
      ? { amountCents: booking.deposit.amountCents, status: booking.deposit.status }
      : null,
  });

  const windowLabel = formatTimeRange(
    party.partyWindow.startMinutes,
    party.partyWindow.endMinutes,
  );
  const roomNames = booking.roomSlots.map((slot) => slot.room.name).join(' + ') || '—';

  let phone = booking.customerPhone;
  try {
    phone = formatPhone(booking.customerPhone);
  } catch {
    phone = booking.customerPhone;
  }

  return (
    <article className="sheet-page">
      <p className="sheet-honoree">{interpolate(sheet.honoree.name, { honoree: party.honoreeName })}</p>
      <p className="sheet-age">{interpolate(sheet.honoree.age, { age: party.honoreeAge })}</p>
      <p className="sheet-date">{interpolate(sheet.date, { dateIso: booking.date })}</p>

      <hr className="sheet-rule" />

      <div className="sheet-facts">
        <div>
          <p className="sheet-label">{sheet.arrival.label}</p>
          <p className="sheet-value">
            {interpolate(sheet.arrival.value, {
              startTime: formatTime(party.partyWindow.startMinutes),
            })}
          </p>
        </div>
        <div>
          <p className="sheet-label">{sheet.window.label}</p>
          <p className="sheet-value">{interpolate(sheet.window.value, { window: windowLabel })}</p>
        </div>
        <div>
          <p className="sheet-label">{sheet.room.label}</p>
          <p className="sheet-value">{interpolate(sheet.room.value, { roomNames })}</p>
        </div>
        <div>
          <p className="sheet-label">{sheet.guests.label}</p>
          <p className="sheet-value">
            {interpolate(sheet.guests.value, { guests: party.guestCount })}
          </p>
        </div>
        <div>
          <p className="sheet-label">{sheet.package.label}</p>
          <p className="sheet-value">{party.packageRef.name}</p>
        </div>
        <div>
          <p className="sheet-label">{sheet.roomTime.label}</p>
          <p className="sheet-value">{formatDuration(party.packageRef.roomMinutes)}</p>
        </div>
      </div>

      <hr className="sheet-rule-thin" />

      <section className="sheet-section">
        <p className="sheet-label">{sheet.games.label}</p>
        {model.arenaGroups.length === 0 ? (
          <p className="sheet-value">—</p>
        ) : (
          model.arenaGroups.map((group) => (
            <ul key={group.index} className="sheet-games">
              {group.startMinutes.map((minutes) => (
                <li key={minutes} className="sheet-game">
                  {formatTime(minutes)}
                </li>
              ))}
            </ul>
          ))
        )}
        {model.isSplit ? (
          <p className="sheet-age">
            {interpolate(sheet.games.split, { n: model.arenaGroups.length })}
          </p>
        ) : null}
      </section>

      <hr className="sheet-rule-thin" />

      <section className="sheet-section">
        <p className="sheet-label">{sheet.food.label}</p>
        <ul className="sheet-list">
          {model.food.map((line) => (
            <li key={line.kind}>{foodLine(line)}</li>
          ))}
        </ul>
        <p className="sheet-nutfree">{sheet.food.cakeNote}</p>
      </section>

      <section className="sheet-section">
        <p className="sheet-label">{sheet.addons.label}</p>
        <ul className="sheet-list">
          {model.addOns.length === 0 ? (
            <li>{sheet.addons.none}</li>
          ) : (
            model.addOns.map((line) => <li key={line.kind}>{addOnLine(line)}</li>)
          )}
        </ul>
      </section>

      {/* The heavy-ruled box prints whether or not there is anything in it. */}
      <section className="sheet-allergies">
        <p className="sheet-label">{sheet.allergies.label}</p>
        <p className="sheet-allergies-body">{model.allergies ?? sheet.allergies.none}</p>
        <p className="sheet-nutfree">{sheet.allergies.nutFree}</p>
      </section>

      <section className="sheet-section">
        <p className="sheet-label">{sheet.organiser.label}</p>
        <p className="sheet-value">
          {interpolate(sheet.organiser.value, { name: booking.customerName, phone })}
        </p>
      </section>

      <hr className="sheet-rule-thin" />

      <section className="sheet-section">
        <p className="sheet-label">{sheet.checklist.label}</p>
        <ul className="sheet-checklist">
          {CHECKLIST.map((item) => (
            <li key={item} className="sheet-check">
              <span className="sheet-box" aria-hidden="true" />
              <span>{item}</span>
              <span className="sheet-timefield">{sheet.checklist.timeField}</span>
            </li>
          ))}
        </ul>
        <p className="sheet-hostline">{sheet.host.label}</p>
      </section>

      <div className="sheet-foot">
        <span>
          {interpolate(sheet.money.deposit, {
            deposit: formatMoney(model.depositAmountCents),
            status: DEPOSIT_WORD[model.depositState] ?? model.depositState,
          })}
        </span>
        <span>
          {interpolate(sheet.money.balance, { balance: formatMoney(model.balanceDueCents) })}
        </span>
        <span>{interpolate(sheet.code, { code: booking.reference })}</span>
        <span>
          {interpolate(sheet.printedAt, {
            dateIso: venueDateOf(printedAt),
            time: formatTime(venueMinutesOf(printedAt)),
          })}
        </span>
      </div>
    </article>
  );
}
