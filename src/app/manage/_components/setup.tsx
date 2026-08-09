import type { ReactNode } from 'react';

import { Eyebrow, Hairline, ValidationMessage, buttonClassName, cx } from '@/components/ui';
import { manager } from '@/lib/copy/manager';
import { global } from '@/lib/copy/global';

/**
 * Shared furniture for the four buried-tier screens — STRATEGY §4.2's third tier.
 *
 * "Anything she does less than once a month is behind a settings page and **may be a full
 * form**." So these are full forms with real labels, native controls and a Save button, not
 * inline-editing cleverness. They are also all plain `<form action={serverAction}>`: no client
 * component, so they submit and validate with scripting disabled, which matters most on the
 * screens that decide what the public flows are allowed to sell.
 */

const { mg } = manager;

export function SetupPage({
  title,
  intro,
  saved,
  error,
  children,
}: {
  title: string;
  intro?: string;
  saved?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <>
      <h1 className="font-display text-display-2 text-text">{title}</h1>
      {intro ? <p className="mt-2 max-w-[68ch] text-body text-text-2">{intro}</p> : null}

      {saved ? (
        <ValidationMessage tone="success" className="mt-4">
          {mg.settings.saved}
        </ValidationMessage>
      ) : null}
      {error ? (
        <ValidationMessage tone="error" className="mt-4">
          {error}
        </ValidationMessage>
      ) : null}

      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </>
  );
}

export function SetupSection({
  id,
  title,
  intro,
  children,
}: {
  id?: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border border-rule p-4">
      <Eyebrow as="h2">{title}</Eyebrow>
      {intro ? <p className="mt-2 max-w-[68ch] text-body-sm text-text-2">{intro}</p> : null}
      <Hairline className="my-3" />
      {children}
    </section>
  );
}

/**
 * A labelled native input. Deliberately not `TextInput`: these screens put four or five fields
 * on one 44px row, and the kit's field is a 48px stacked block built for the booking flow.
 */
export function Field({
  name,
  label,
  defaultValue,
  type = 'text',
  helper,
  inputMode,
  className,
  required,
  id: idProp,
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  type?: string;
  helper?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
  className?: string;
  required?: boolean;
  /**
   * Override the derived id. Two forms on one page can legitimately both have a `reason`
   * field; without this they render the same `f-reason` and BOTH labels resolve to the first
   * input, so tapping the second form's label focuses the first form's box.
   */
  id?: string;
}) {
  const id = idProp ?? `f-${name.replace(/[^A-Za-z0-9]+/g, '-')}`;
  return (
    <div className={cx('flex min-w-0 flex-col', className)}>
      <label htmlFor={id} className="mb-1 font-display text-label uppercase text-text-2">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        defaultValue={defaultValue}
        aria-describedby={helper ? `${id}-help` : undefined}
        className="h-11 w-full border border-border bg-sunken px-3 text-body text-text"
      />
      {helper ? (
        <p id={`${id}-help`} className="mt-1 max-w-[56ch] text-caption text-text-3">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A checkbox that also emits its own presence marker.
 *
 * An unchecked box sends nothing at all, which is indistinguishable from "this field was not
 * on the page" — and a partial save that cannot tell those apart silently flips every boolean
 * to false. The hidden `markerName` field is what makes "off" a value.
 */
export function CheckField({
  name,
  label,
  defaultChecked,
  markerName,
  helper,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  markerName?: string;
  helper?: string;
}) {
  const id = `c-${name.replace(/[^A-Za-z0-9]+/g, '-')}`;
  return (
    <div className="flex min-w-0 flex-col justify-end">
      {markerName ? <input type="hidden" name={markerName} value={name} /> : null}
      <label htmlFor={id} className="flex min-h-11 items-center gap-2 text-body-sm text-text">
        <input
          id={id}
          name={name}
          type="checkbox"
          value="true"
          defaultChecked={defaultChecked}
          className="size-5 border border-border bg-sunken"
        />
        {label}
      </label>
      {helper ? <p className="text-caption text-text-3">{helper}</p> : null}
    </div>
  );
}

export function SaveButton({ label = global.btn.save }: { label?: string }) {
  return (
    <div className="mt-4">
      <button type="submit" className={buttonClassName('secondary')}>
        {label}
      </button>
    </div>
  );
}
