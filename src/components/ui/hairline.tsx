import { cx } from "./cx";

/**
 * A 1px rule — DESIGN §2 and principle 2: structure comes from hairlines, never shadows.
 *
 * The `tone` is not cosmetic. `rule` measures 1.43:1 and is **decorative only**: table rules,
 * grid gaps, card edges. `border` measures 3.77:1 and is the only tone permitted where the
 * line is the boundary of something interactive. DESIGN §2.3 names this as the most common way
 * the system gets broken.
 */
export function Hairline({
  tone = "rule",
  className,
}: {
  tone?: "rule" | "border";
  className?: string;
}) {
  return (
    <hr
      className={cx(
        "border-0 border-t",
        tone === "border" ? "border-t-border" : "border-t-rule",
        className,
      )}
    />
  );
}
