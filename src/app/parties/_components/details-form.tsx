"use client";

import { useActionState } from "react";

import {
  Button,
  Caption,
  FieldStack,
  FormErrorSummary,
  StickyActionBar,
  TextArea,
  TextInput,
} from "@/components/ui";
import { global, party } from "@/lib/copy";

import { saveDetails } from "../actions";
import { EMPTY_FORM_STATE, problemsFor } from "../_lib/form-state";
import { DETAIL_FIELD_IDS, MAX_NOTES_LENGTH, formSummaryMessage } from "../_lib/validate";

export interface DetailsDefaults {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  honoreeName: string;
  notes: string;
}

/**
 * Screen P5. One autocomplete-friendly column, per-field messages that name the fix rather
 * than the fault, and an allergies box with the nut-free prompt attached to it — the rule is
 * stated where the answer is given, not in a policy page nobody opens.
 */
export function DetailsForm({
  draftId,
  defaults,
}: {
  draftId: string;
  defaults: DetailsDefaults;
}) {
  const [state, formAction, pending] = useActionState(saveDetails, EMPTY_FORM_STATE);
  const value = (key: keyof DetailsDefaults) => state.values?.[key] ?? defaults[key];

  return (
    <form action={formAction} className="flex flex-col gap-10">
      <input type="hidden" name="draftId" value={draftId} />

      {state.problems.length > 0 ? (
        <FormErrorSummary
          heading={formSummaryMessage(state.problems)}
          errors={state.problems}
        />
      ) : null}

      <FieldStack gap="field">
        <TextInput
          id={DETAIL_FIELD_IDS.name}
          name="customerName"
          label={party.p5.organiser.name.label}
          autoComplete="name"
          defaultValue={value("customerName")}
          error={problemsFor(state, DETAIL_FIELD_IDS.name)}
        />
        <TextInput
          id={DETAIL_FIELD_IDS.phone}
          name="customerPhone"
          label={party.p5.organiser.phone.label}
          helper={party.p5.organiser.phone.help}
          inputMode="tel"
          autoComplete="tel"
          defaultValue={value("customerPhone")}
          error={problemsFor(state, DETAIL_FIELD_IDS.phone)}
        />
        <TextInput
          id={DETAIL_FIELD_IDS.email}
          name="customerEmail"
          label={party.p5.organiser.email.label}
          helper={party.p5.organiser.email.help}
          inputMode="email"
          autoComplete="email"
          defaultValue={value("customerEmail")}
          error={problemsFor(state, DETAIL_FIELD_IDS.email)}
        />
        <TextInput
          id={DETAIL_FIELD_IDS.honoree}
          name="honoreeName"
          label={party.p5.honoree.label}
          helper={party.p5.honoree.help}
          autoComplete="off"
          defaultValue={value("honoreeName")}
          error={problemsFor(state, DETAIL_FIELD_IDS.honoree)}
        />
        <TextArea
          id={DETAIL_FIELD_IDS.notes}
          name="notes"
          rows={4}
          maxLength={MAX_NOTES_LENGTH}
          label={party.p5.notes.label}
          helper={party.p5.notes.prompt}
          placeholder={party.p5.notes.placeholder}
          defaultValue={value("notes")}
          error={problemsFor(state, DETAIL_FIELD_IDS.notes)}
        />
      </FieldStack>

      <Caption>{party.p5.privacy}</Caption>

      <StickyActionBar
        hideAtLg={false}
        action={
          <Button
            type="submit"
            variant="primary"
            pending={pending}
            pendingLabel={global.loading.saving}
          >
            {party.p5.cta}
          </Button>
        }
      >
        <Caption>{global.timezoneNote}</Caption>
      </StickyActionBar>
    </form>
  );
}
