import Link from "next/link";
import type { ReactNode } from "react";

import { Caption, Eyebrow, Hairline, StepIndicator, cx } from "@/components/ui";
import { global, interpolate } from "@/lib/copy";
import { formatPhone, formatPhoneHref } from "@/lib/format";

/**
 * The chrome every screen in the laser tag flow shares: the step bar, the venue footer, and
 * the standing rules.
 *
 * Two of the strings here have no COPY.md key because they are DESIGN specifications rather
 * than product prose — the `STEP 2 / 4` readout (DESIGN §4.7 fixes the wording) and the
 * progress bar's accessible name. Both are declared once, here, and both are flagged in the
 * handover as keys COPY.md should own.
 */

/** DESIGN §4.7: the bar never carries the state alone, and this is the wording it specifies. */
export function stepLabel(current: number, total: number): string {
  return `STEP ${current} / ${total}`;
}

/** TODO(COPY.md): no key for the progress bar's accessible name. DESIGN §4.7 names it. */
const PROGRESS_A11Y_LABEL = "Booking progress";

export const FLOW_STEPS = 4;

export function FlowStep({
  current,
  className,
}: {
  current: number;
  className?: string;
}) {
  return (
    <StepIndicator
      current={current}
      total={FLOW_STEPS}
      label={stepLabel(current, FLOW_STEPS)}
      a11yLabel={PROGRESS_A11Y_LABEL}
      className={className}
    />
  );
}

/**
 * The three standing facts (COPY.md `g1.facts.*`), each of which is a `global.rule.*` string
 * so the wording cannot drift between the screens that quote it.
 */
export function StandingFacts({
  heading,
  cutoffMinutes,
  className,
}: {
  heading: string;
  cutoffMinutes: number;
  className?: string;
}) {
  return (
    <section className={cx("border-t border-rule pt-6", className)}>
      <Eyebrow as="h2">{heading}</Eyebrow>
      <ul className="mt-4 flex flex-col gap-3">
        {[
          interpolate(global.rule.cutoff, { cutoffMinutes }),
          global.rule.payDesk,
          global.rule.shoes,
        ].map((fact) => (
          <li key={fact} className="flex gap-3 text-body-sm text-text-2">
            <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-border" />
            <span className="max-w-[56ch]">{fact}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Address, phone and the timezone note. Present on every screen; never the loudest thing. */
export function FlowFooter({ phone, className }: { phone: string; className?: string }) {
  return (
    <footer className={cx("mt-12 border-t border-rule pt-6", className)}>
      <div className="flex flex-col gap-2 text-body-sm text-text-2">
        <p>{global.address}</p>
        <p>
          <a className="underline decoration-1 underline-offset-4 hover:text-accent" href={formatPhoneHref(phone)}>
            {interpolate(global.phoneCall, { phone: formatPhone(phone) })}
          </a>
        </p>
      </div>
      <Caption className="mt-3">{global.timezoneNote}</Caption>
    </footer>
  );
}

/** A quiet "Change" link back to an earlier step, per STRATEGY §3.1's edit affordances. */
export function EditLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center font-display text-button uppercase text-text-2 underline decoration-1 underline-offset-4 hover:text-accent"
    >
      {children}
    </Link>
  );
}

export { Hairline };
