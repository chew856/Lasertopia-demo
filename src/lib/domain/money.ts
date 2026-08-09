/**
 * Money — integer cents, always. Never a float.
 *
 * Every price in RULES.md becomes cents here. `0.1 + 0.2 !== 0.3` is not an academic
 * curiosity when the output is a customer's balance due, so this module is the only place
 * that is allowed to touch currency arithmetic and it never uses a fractional intermediate.
 */

declare const CENTS: unique symbol;

/** A branded integer number of cents. Construct only via `cents()` or `parseMoney()`. */
export type Cents = number & { readonly [CENTS]: true };

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** Assert an integer and brand it. */
export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new MoneyError(
      `Money must be an integer number of cents, received ${value}. ` +
        `Use parseMoney("12.34") to convert a decimal price string.`,
    );
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`Money value ${value} exceeds the safe integer range.`);
  }
  return value as Cents;
}

export const ZERO: Cents = 0 as Cents;

const MONEY_PATTERN = /^(-)?(\d{1,15})(?:\.(\d{1,2}))?$/;

/**
 * Parse a decimal price string ("259.50", "$8.49", "22.4") into cents, without ever
 * producing a float. Accepts an optional leading `$` and thousands separators.
 */
export function parseMoney(text: string): Cents {
  const cleaned = text.trim().replace(/^\$/, '').replace(/,/g, '');
  const match = MONEY_PATTERN.exec(cleaned);
  if (!match) {
    throw new MoneyError(
      `"${text}" is not a valid money amount. Expected something like "259.50" with at most 2 decimal places.`,
    );
  }
  const [, sign, whole, fraction = ''] = match;
  const fractionCents = Number.parseInt((fraction + '00').slice(0, 2), 10);
  const total = Number.parseInt(whole, 10) * 100 + fractionCents;
  return cents(sign === '-' ? -total : total);
}

/** "$259.50". Negative amounts render as "-$12.00". */
export function formatMoney(value: Cents, options: { symbol?: string } = {}): string {
  const symbol = options.symbol ?? '$';
  const negative = value < 0;
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${negative ? '-' : ''}${symbol}${whole}.${String(remainder).padStart(2, '0')}`;
}

/** "259.50" — no symbol, for form fields and CSV. */
export function formatMoneyPlain(value: Cents): string {
  return formatMoney(value, { symbol: '' });
}

export function addMoney(...values: Cents[]): Cents {
  return cents(values.reduce<number>((sum, v) => sum + v, 0));
}

export function subtractMoney(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

/** Multiply by an integer quantity (guests, units, players). */
export function multiplyMoney(value: Cents, quantity: number): Cents {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError(`Quantity must be a non-negative integer, received ${quantity}.`);
  }
  return cents(value * quantity);
}

/**
 * Integer half-up division. `roundHalfUp(7, 2) === 4`, `roundHalfUp(-7, 2) === -4`.
 * Half-up means "away from zero at exactly .5", which is what R-67 specifies.
 */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (denominator <= 0 || !Number.isInteger(denominator)) {
    throw new MoneyError(`Denominator must be a positive integer, received ${denominator}.`);
  }
  if (!Number.isSafeInteger(numerator)) {
    throw new MoneyError(`Rounding numerator ${numerator} exceeds the safe integer range.`);
  }
  const sign = numerator < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(numerator) * 2 + denominator) / (denominator * 2));
}

/**
 * Tax rates are held as thousandths of a percent so the whole calculation stays integral:
 * 12.0% -> 12000. `parseRateToMilliPercent("12.0")` does the conversion at config load.
 */
export const MILLI_PERCENT_SCALE = 100_000; // percent -> fraction (100) x milli (1000)

export function parseRateToMilliPercent(text: string): number {
  const match = /^(\d{1,4})(?:\.(\d{1,3}))?$/.exec(text.trim());
  if (!match) {
    throw new MoneyError(
      `"${text}" is not a valid percentage rate. Expected something like "12" or "12.0" (max 3 decimal places).`,
    );
  }
  const [, whole, fraction = ''] = match;
  return Number.parseInt(whole, 10) * 1000 + Number.parseInt((fraction + '000').slice(0, 3), 10);
}

export function formatMilliPercent(rate: number): string {
  const whole = Math.floor(rate / 1000);
  const fraction = String(rate % 1000).padStart(3, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}%` : `${whole}%`;
}

/**
 * R-67: `tax = round2(preTaxSubtotal x rate)`, rounded half-up, applied ONCE at the tax line.
 */
export function taxOn(preTax: Cents, rateMilliPercent: number): Cents {
  if (!Number.isInteger(rateMilliPercent) || rateMilliPercent < 0) {
    throw new MoneyError(
      `Tax rate must be a non-negative integer in milli-percent (12.0% = 12000), received ${rateMilliPercent}.`,
    );
  }
  return cents(roundHalfUp(preTax * rateMilliPercent, MILLI_PERCENT_SCALE));
}
