"use client";

import { useActionState, useState } from "react";

import {
  Button,
  Caption,
  FieldStack,
  FormErrorSummary,
  MonoValue,
  Select,
  StickyActionBar,
  Stepper,
  ValidationMessage,
} from "@/components/ui";
import { global, party } from "@/lib/copy";

import { startPartyDraft } from "../actions";
import { AGE_FIELD_ID, GUESTS_FIELD_ID } from "../_lib/field-ids";
import { EMPTY_FORM_STATE, problemsFor } from "../_lib/form-state";
import { formSummaryMessage } from "../_lib/validate";

/**
 * One guest count's server-computed consequences. Both the hints and the price are produced on
 * the server for every bookable count, so the stepper can give live feedback without a single
 * line of money arithmetic or room-fit logic running in the browser.
 */
export interface GuestOption {
  guests: number;
  hints: string[];
  pricePreview: string;
}

export function PartySizeForm({
  min,
  max,
  defaultGuests,
  defaultAge,
  ages,
  ageHelp,
  options,
}: {
  min: number;
  max: number;
  defaultGuests: number;
  defaultAge: string;
  ages: readonly number[];
  ageHelp: string;
  options: readonly GuestOption[];
}) {
  const [state, formAction, pending] = useActionState(startPartyDraft, EMPTY_FORM_STATE);
  const [guests, setGuests] = useState(defaultGuests);

  const option =
    options.find((o) => o.guests === guests) ?? options[options.length - 1] ?? null;

  return (
    <form action={formAction} className="flex flex-col gap-10">
      <input type="hidden" name="guests" value={guests} />

      {state.problems.length > 0 ? (
        <FormErrorSummary
          heading={formSummaryMessage(state.problems)}
          errors={state.problems}
        />
      ) : null}

      <FieldStack gap="group">
        <div>
          <Stepper
            id={GUESTS_FIELD_ID}
            label={party.p1.guests.label}
            value={guests}
            min={min}
            max={max}
            onChange={setGuests}
            decreaseLabel={party.p1.guests.decrease}
            increaseLabel={party.p1.guests.increase}
            hint={
              option ? (
                <span className="flex flex-col gap-1">
                  {option.hints.map((hint) => (
                    <span key={hint}>{hint}</span>
                  ))}
                </span>
              ) : undefined
            }
          />
          <Caption className="mt-3">{party.p1.guests.help}</Caption>
          {problemsFor(state, GUESTS_FIELD_ID) ? (
            <ValidationMessage tone="error" className="mt-3">
              {problemsFor(state, GUESTS_FIELD_ID)}
            </ValidationMessage>
          ) : null}
        </div>

        <Select
          id={AGE_FIELD_ID}
          name="age"
          label={party.p1.age.label}
          helper={ageHelp}
          error={problemsFor(state, AGE_FIELD_ID)}
          defaultValue={state.values?.age ?? defaultAge}
        >
          <option value="" />
          {ages.map((age) => (
            <option key={age} value={age}>
              {age}
            </option>
          ))}
        </Select>
      </FieldStack>

      <StickyActionBar
        hideAtLg={false}
        action={
          <Button
            type="submit"
            variant="primary"
            pending={pending}
            pendingLabel={global.loading.saving}
          >
            {party.p1.cta}
          </Button>
        }
      >
        {option ? <MonoValue step="sm">{option.pricePreview}</MonoValue> : null}
      </StickyActionBar>
    </form>
  );
}
