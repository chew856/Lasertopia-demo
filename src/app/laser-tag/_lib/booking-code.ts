/**
 * Booking codes — STRATEGY §0: `LT-XXXXXXXX` for games, eight random characters.
 *
 * The code is the customer's only credential: `/laser-tag/booking/[code]` is reachable by
 * anyone holding it, which is the point (no accounts, guest checkout) and also the reason it
 * is generated from a CSPRNG rather than from a counter or a timestamp.
 *
 * The alphabet drops `0/O` and `1/I`, because this code gets read down a phone line to the
 * front desk. Thirty-two symbols means five bits a character and no modulo bias.
 */

/** COPY.md `err.field.code.format` shows `LT-4KJ2QW9X`. */
export const GAMES_CODE_PREFIX = "LT";
export const CODE_LENGTH = 8;
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** `LT-` followed by eight alphabet characters, uppercase. */
export const CODE_PATTERN = /^LT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

/** Map random bytes onto the alphabet. Exported so the mapping is testable without a CSPRNG. */
export function codeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < CODE_LENGTH) {
    throw new Error(`A booking code needs ${CODE_LENGTH} bytes of entropy, received ${bytes.length}.`);
  }
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    // 32 symbols == 5 bits, so the low five bits of a byte are uniform. No modulo bias.
    out += CODE_ALPHABET[bytes[i] & 31];
  }
  return `${GAMES_CODE_PREFIX}-${out}`;
}

export function generateBookingCode(
  randomBytes: (length: number) => Uint8Array = (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
): string {
  return codeFromBytes(randomBytes(CODE_LENGTH));
}

/**
 * Normalise a code from a URL or a form. COPY.md `err.lookup.notFound.body` promises the
 * letters are case-insensitive but the `LT-` prefix matters, so casing is fixed here and the
 * prefix is not.
 */
export function normaliseBookingCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isGamesBookingCode(raw: string): boolean {
  return CODE_PATTERN.test(normaliseBookingCode(raw));
}
