/**
 * Class-name join. Twelve lines instead of a dependency, because that is all `clsx` does that
 * this system needs — there is no conditional-object syntax and no Tailwind merge, since every
 * component below composes from full literal class strings rather than building them.
 *
 * Full literals matter: Tailwind v4 scans source text for candidates, so a class assembled as
 * `` `bg-${tone}` `` produces no CSS. Every variant table in this directory maps to a complete
 * class string for exactly that reason.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
