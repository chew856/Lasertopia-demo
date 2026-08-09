/**
 * Field validation for the laser tag flow — the server's half of COPY.md §8.25.
 *
 * These functions return **codes**, not sentences. The copy for each code lives in
 * `@/lib/copy` and some of it needs interpolating with a setting (`{arenaCap}`), so the
 * mapping happens at the render site and this module stays a pure, testable predicate layer
 * with no copy and no clock in it.
 *
 * Everything here also runs on the server at submit. The client form uses the same functions
 * so the two can never disagree, but the browser's answer is a courtesy: the server's is the
 * one that decides whether a booking is written.
 */

/** COPY.md `err.field.name.tooLong` states the number, so it is stated once here. */
export const MAX_NAME_LENGTH = 80;
/** COPY.md `err.field.notes.tooLong`. */
export const MAX_NOTE_LENGTH = 500;

export type DetailsFieldName = "name" | "phone" | "email" | "note";

export type FieldErrorCode =
  | "NAME_REQUIRED"
  | "NAME_TOO_LONG"
  | "PHONE_REQUIRED"
  | "PHONE_INVALID"
  | "EMAIL_REQUIRED"
  | "EMAIL_INVALID"
  | "NOTE_TOO_LONG";

export type DetailsErrors = Partial<Record<DetailsFieldName, FieldErrorCode>>;

export interface DetailsInput {
  name: string;
  phone: string;
  email: string;
  note: string;
}

/**
 * A North American number reduced to its ten significant digits, or `null` when it is not one.
 *
 * The NANP rules applied are the two that actually reject typos: an area code and an exchange
 * code both start 2–9. A leading country-code `1` is dropped. Anything else about formatting —
 * spaces, dots, brackets, `+1` — is the customer's business, not ours.
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(local)) return null;
  return local;
}

/**
 * Syntactic email validity, at the strictness COPY.md `err.field.email.invalid` describes:
 * "it's missing an @ or a domain". A local part, an `@`, and a dotted domain whose last label
 * is alphabetic. Deliverability is not knowable here and is not claimed.
 */
export function isValidEmail(raw: string): boolean {
  const value = raw.trim();
  if (value.length === 0 || value.length > 254) return false;
  return /^[^\s@,;]+@[^\s@.,;]+(\.[^\s@.,;]+)*\.[A-Za-z]{2,}$/.test(value);
}

export interface ValidatedDetails {
  name: string;
  /** Ten digits, no punctuation. `formatPhone` adds the hyphens at the edge. */
  phone: string;
  email: string;
  note: string;
}

/**
 * The whole G3 form. Validation is per-field and every failing field is reported at once —
 * DESIGN §5.10 forbids a summary block that hides which field is wrong, and a form that
 * reveals its problems one at a time is worse than one that reveals them together.
 */
export function validateDetails(
  input: DetailsInput,
): { ok: true; value: ValidatedDetails } | { ok: false; errors: DetailsErrors } {
  const name = input.name.trim();
  const email = input.email.trim();
  const note = input.note.trim();
  const errors: DetailsErrors = {};

  if (name.length === 0) errors.name = "NAME_REQUIRED";
  else if (name.length > MAX_NAME_LENGTH) errors.name = "NAME_TOO_LONG";

  const phone = normalisePhone(input.phone);
  if (input.phone.trim().length === 0) errors.phone = "PHONE_REQUIRED";
  else if (phone === null) errors.phone = "PHONE_INVALID";

  if (email.length === 0) errors.email = "EMAIL_REQUIRED";
  else if (!isValidEmail(email)) errors.email = "EMAIL_INVALID";

  if (note.length > MAX_NOTE_LENGTH) errors.note = "NOTE_TOO_LONG";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, phone: phone as string, email, note } };
}

/**
 * Coerce an untrusted integer from a form field or a cookie.
 *
 * Everything the customer sends arrives as a string, and a draft cookie is a value the browser
 * holds — so it is a value the browser can edit. Nothing downstream may assume otherwise;
 * this is the one place a non-integer becomes `null` rather than a `NaN` that survives three
 * function calls and lands in a booking row.
 */
export function parseBoundedInteger(
  raw: unknown,
  bounds: { min: number; max: number },
): number | null {
  let value: number;
  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "string") {
    // Deliberately not `Number.parseInt`: it reads "6.5" as 6 and "6 players" as 6, which
    // turns a tampered or malformed value into a plausible-looking booking instead of a
    // rejection. A whole number is a whole number or it is nothing.
    if (!/^-?\d+$/.test(raw.trim())) return null;
    value = Number.parseInt(raw.trim(), 10);
  } else {
    return null;
  }
  if (!Number.isInteger(value)) return null;
  if (value < bounds.min || value > bounds.max) return null;
  return value;
}

/** `"2026-08-22"` or `null`. Rejects `2026-02-30` by round-tripping through UTC. */
export function parseCalendarDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return raw;
}
