import Link from "next/link";
import type { ReactNode } from "react";

import {
  BangMark,
  ButtonLink,
  Caption,
  Eyebrow,
  Hairline,
  MEASURE_BODY,
  MonoValue,
  OrderSummary,
  SectionHeader,
  StepIndicator,
  buttonClassName,
  cx,
} from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { formatPhoneHref } from "@/lib/format";

import type { SummaryModel } from "../_lib/money-lines";

/** P1–P7. The deposit screen is the seventh and last (STRATEGY §3.2). */
export const TOTAL_STEPS = 7;

export function FlowStepHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div>
      <StepIndicator
        current={step}
        total={TOTAL_STEPS}
        label={interpolate(party.flow.step, { current: step, total: TOTAL_STEPS })}
        a11yLabel={party.flow.a11y}
      />
      <SectionHeader
        className="mt-6"
        level={1}
        headingTag="h1"
        title={title}
        description={description}
      />
    </div>
  );
}

/**
 * A structural rejection: a window that stopped fitting, a lost race, a lapsed hold.
 *
 * Every one of these states names what happened, why in the venue's terms, and the next action
 * as a real control (STRATEGY §0's failure-copy contract). It is never a bare sentence and
 * never a greyed-out control with no explanation.
 */
export function RejectionPanel({
  title,
  body,
  actions,
  tone = "error",
}: {
  title: ReactNode;
  body: ReactNode;
  actions?: ReactNode;
  tone?: "error" | "notice";
}) {
  return (
    <section
      aria-live="polite"
      className={cx(
        "border bg-raised p-4 md:p-6",
        tone === "error" ? "border-state-full" : "border-accent",
      )}
    >
      <div className="flex gap-3">
        <BangMark
          className={cx(
            "mt-0.5 size-5 shrink-0",
            tone === "error" ? "text-state-full" : "text-accent",
          )}
        />
        <div className="min-w-0">
          <h2 className="font-display text-heading uppercase text-text">{title}</h2>
          <p className={cx("mt-2 text-body-sm text-text-2", MEASURE_BODY)}>{body}</p>
          {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

/** Tap-to-call. Always a real `tel:` control, never a phone number a parent has to retype. */
export function CallLink({
  variant = "secondary",
  walkIn = false,
}: {
  variant?: "primary" | "secondary" | "ghost";
  walkIn?: boolean;
}) {
  return (
    <a href={formatPhoneHref(global.phone)} className={buttonClassName(variant)}>
      {interpolate(walkIn ? global.phoneCallWalkin : global.phoneCall, {
        phone: global.phone,
      })}
    </a>
  );
}

/**
 * The standing facts block. DESIGN principle 6: the capacity rule, the age-matching rule and
 * the deposit policy each get their own typographic slot in the layout, not a tooltip.
 */
export function FactList({ heading, facts }: { heading: string; facts: readonly string[] }) {
  return (
    <section aria-label={heading} className="border border-rule bg-raised p-4 md:p-6">
      <Eyebrow as="h2">{heading}</Eyebrow>
      <ul className="mt-4 flex flex-col gap-3">
        {facts.map((fact) => (
          <li key={fact} className={cx("text-body-sm text-text-2", MEASURE_BODY)}>
            {fact}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The order summary, wherever it appears. The deposit block is mandatory (DESIGN §5.9). */
export function SummaryRail({ model }: { model: SummaryModel }) {
  return (
    <div className="flex flex-col gap-4">
      <OrderSummary
        heading={model.heading}
        currencyNote={model.currencyNote}
        lines={model.lines}
        totalsBefore={model.totalsBefore}
        total={model.total}
        deposit={model.deposit}
        emptyLabel={model.emptyLabel}
      />
      {model.extraGuestMath ? (
        <Caption className="font-mono text-mono-sm tabular-nums text-text-2">
          {model.extraGuestMath}
        </Caption>
      ) : null}
      {model.totalsBefore.some((row) => row.id === "food") ? (
        <Caption>{global.sum.foodNote}</Caption>
      ) : null}
    </div>
  );
}

/** A labelled figure — window time, arrival time, guest count. Numbers are the product. */
export function FactRow({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <Eyebrow as="dt">{label}</Eyebrow>
      <dd>
        <MonoValue step="md">{value}</MonoValue>
        {note ? <p className="mt-1 text-body-sm text-text-2">{note}</p> : null}
      </dd>
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label?: string }) {
  return (
    <Link href={href} className="text-body-sm text-text-2 underline underline-offset-4">
      {label ?? global.btn.back}
    </Link>
  );
}

export function StepDivider() {
  return <Hairline tone="rule" />;
}

export { ButtonLink };
