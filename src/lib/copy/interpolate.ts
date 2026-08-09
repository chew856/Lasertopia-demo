/**
 * `{placeholder}` substitution for COPY.md strings.
 *
 * COPY.md §0.3 registers every placeholder in the deck and states the rule for engineers:
 * each one is filled from server-computed data or settings, and none may be hardcoded in a
 * component. This helper is how that rule is enforced at the call site.
 *
 * Two properties matter more than convenience:
 *
 * 1. **The placeholder names are typed.** `interpolate` reads them straight out of the
 *    string literal, so `interpolate(global.rule.cutoff, { cutoffMinutes: 90 })` compiles and
 *    `{ cutoffMinuets: 90 }` does not. This only works because `copy/global.ts` is `as const`;
 *    pass a widened `string` and the checking degrades to "any record", never to an error.
 *
 * 2. **A missing value is loud.** In development it throws. In production it logs and renders
 *    the string with the placeholder removed. What it never does is ship `Call {phone}` to a
 *    customer, which is the actual failure mode this exists to prevent.
 */

/** Placeholder syntax: `{name}`, where a name may be dotted (`{unit.game}`). */
const PLACEHOLDER = /\{([A-Za-z0-9_.]+)\}/g;

/**
 * The placeholder names inside a string literal type.
 *
 * Degrades to `never` for a widened `string`, which makes `Values<string>` an empty record
 * rather than a compile error — deliberate, so runtime-assembled templates still work.
 */
export type Placeholders<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Name extends `${string}{${string}` // an unmatched brace is not a placeholder
      ? Placeholders<Rest>
      : Name | Placeholders<Rest>
    : never;

/** What a placeholder may be filled with. Numbers are stringified with `String()`. */
export type PlaceholderValue = string | number;

/** The values object a given template requires. */
export type Values<S extends string> = Record<Placeholders<S>, PlaceholderValue>;

export class MissingCopyValueError extends Error {
  /** The placeholder names that had no value, without braces. */
  readonly missing: readonly string[];
  /** The template that could not be filled. */
  readonly template: string;

  constructor(template: string, missing: readonly string[]) {
    super(
      `Copy string is missing ${missing.length === 1 ? "a value" : "values"} for ` +
        `${missing.map((name) => `{${name}}`).join(", ")} in "${template}". ` +
        `Pass every placeholder the string declares — they are registered in COPY.md §0.3 ` +
        `and each one is filled from server-computed data or settings, never hardcoded. ` +
        `An unfilled placeholder renders as literal braces to a customer.`,
    );
    this.name = "MissingCopyValueError";
    this.template = template;
    this.missing = missing;
  }
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Fill a COPY.md string.
 *
 * ```ts
 * interpolate(global.rule.cutoff, { cutoffMinutes: config.onlineCutoffMinutes })
 * // "Online booking closes 90 minutes before a game starts, so we can look after walk-ins."
 * ```
 *
 * Strings with no placeholders need no second argument:
 *
 * ```ts
 * interpolate(global.btn.continue)  // "Continue"
 * ```
 *
 * @throws {MissingCopyValueError} in development when any placeholder has no value.
 */
export function interpolate<S extends string>(
  template: S,
  ...args: [Placeholders<S>] extends [never] ? [values?: Values<S>] : [values: Values<S>]
): string {
  const values = (args[0] ?? {}) as Record<string, PlaceholderValue | undefined>;
  const missing: string[] = [];

  const filled = template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = values[name];
    if (value === undefined || value === null || value === "") {
      missing.push(name);
      return "";
    }
    return String(value);
  });

  if (missing.length > 0) {
    if (isDevelopment()) {
      throw new MissingCopyValueError(template, missing);
    }
    // Production: never render braces at a customer. Log the fault, ship the prose.
    console.error(`[copy] ${new MissingCopyValueError(template, missing).message}`);
  }

  return filled;
}

/** The placeholder names a string declares, in order of first appearance, without braces. */
export function placeholdersIn(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER)) {
    seen.add(match[1]);
  }
  return [...seen];
}

/** Whether a string still contains an unfilled `{placeholder}`. Useful in tests. */
export function hasPlaceholders(template: string): boolean {
  PLACEHOLDER.lastIndex = 0;
  return PLACEHOLDER.test(template);
}
