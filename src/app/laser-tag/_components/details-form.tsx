"use client";

import { useActionState } from "react";

import {
  Button,
  Caption,
  FieldStack,
  FormErrorSummary,
  MonoValue,
  StickyActionBar,
  TextArea,
  TextInput,
  ValidationMessage,
} from "@/components/ui";
import { global, interpolate, laserTag } from "@/lib/copy";
import { formatCountdown } from "@/lib/format";

import { DETAILS_INITIAL } from "../_lib/action-state";
import type { FieldErrorCode } from "../_lib/validate";
import { saveDetails } from "../actions";

/**
 * Screen G3 — who's coming (STRATEGY §3.1).
 *
 * Three fields and a note, and the only interesting thing about it is where the errors go:
 * DESIGN §5.10 and STRATEGY both forbid a summary block at the top *instead of* per-field
 * messages, so every failing field carries its own sentence and the summary above the button
 * is an addition, not a substitute — it exists so a keyboard or screen-reader user landing on
 * a failed submit has one place to jump from.
 *
 * The autocomplete tokens are load-bearing, not decoration: without `tel` and `email` a phone
 * shows the wrong keyboard and a password manager fills the wrong box, which on a 30-second
 * booking is the difference between finishing and giving up.
 */

const FIELD_COPY: Record<FieldErrorCode, string> = {
  NAME_REQUIRED: laserTag.err.field.nameRequired,
  NAME_TOO_LONG: laserTag.err.field.nameTooLong,
  PHONE_REQUIRED: laserTag.err.field.phoneRequired,
  PHONE_INVALID: laserTag.err.field.phoneInvalid,
  EMAIL_REQUIRED: laserTag.err.field.emailRequired,
  EMAIL_INVALID: laserTag.err.field.emailInvalid,
  NOTE_TOO_LONG: laserTag.err.field.notesTooLong,
};

export function DetailsForm({
  draftId,
  defaults,
  holdSecondsRemaining,
}: {
  draftId: string;
  defaults: { name: string; phone: string; email: string; note: string };
  /** Feeds `err.server.saveDetails`, which promises the time is still held. */
  holdSecondsRemaining: number;
}) {
  const [state, formAction, pending] = useActionState(saveDetails, DETAILS_INITIAL);

  const errors = state.errors;
  const summary = [
    { fieldId: "lt-name", code: errors.name },
    { fieldId: "lt-phone", code: errors.phone },
    { fieldId: "lt-email", code: errors.email },
    { fieldId: "lt-note", code: errors.note },
  ].flatMap(({ fieldId, code }) => (code ? [{ fieldId, message: FIELD_COPY[code] }] : []));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-8">
      <input type="hidden" name="draftId" value={draftId} />

      <FieldStack>
        <TextInput
          id="lt-name"
          name="name"
          label={laserTag.g3.name.label}
          placeholder={laserTag.g3.name.placeholder}
          defaultValue={defaults.name}
          autoComplete="name"
          error={errors.name ? FIELD_COPY[errors.name] : undefined}
        />
        <TextInput
          id="lt-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          label={laserTag.g3.phone.label}
          helper={laserTag.g3.phone.help}
          placeholder={laserTag.g3.phone.placeholder}
          defaultValue={defaults.phone}
          autoComplete="tel"
          error={errors.phone ? FIELD_COPY[errors.phone] : undefined}
        />
        <TextInput
          id="lt-email"
          name="email"
          type="email"
          inputMode="email"
          label={laserTag.g3.email.label}
          helper={laserTag.g3.email.help}
          defaultValue={defaults.email}
          autoComplete="email"
          error={errors.email ? FIELD_COPY[errors.email] : undefined}
        />
        <TextArea
          id="lt-note"
          name="note"
          label={laserTag.g3.note.label}
          helper={laserTag.g3.note.help}
          defaultValue={defaults.note}
          error={errors.note ? FIELD_COPY[errors.note] : undefined}
        />
      </FieldStack>

      <Caption>{laserTag.g3.privacy}</Caption>

      {summary.length > 0 ? (
        <FormErrorSummary
          heading={interpolate(laserTag.err.formSummary, { n: summary.length })}
          errors={summary}
        />
      ) : null}

      {state.serverError ? (
        <ValidationMessage tone="error">
          {interpolate(laserTag.err.server.saveDetails, {
            holdRemaining: formatCountdown(holdSecondsRemaining),
          })}
        </ValidationMessage>
      ) : null}

      <StickyActionBar
        hideAtLg={false}
        action={
          <Button
            type="submit"
            variant="primary"
            pending={pending}
            pendingLabel={global.loading.saving}
          >
            {laserTag.g3.cta}
          </Button>
        }
      >
        <MonoValue step="sm" className="uppercase text-text-2">
          {global.hold.label}
        </MonoValue>
      </StickyActionBar>
    </form>
  );
}
