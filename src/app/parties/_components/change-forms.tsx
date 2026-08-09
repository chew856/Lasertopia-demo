"use client";

import { useActionState, useState } from "react";

import {
  Button,
  FieldStack,
  MEASURE_BODY,
  TextArea,
  TextInput,
  ValidationMessage,
  cx,
} from "@/components/ui";
import { global, party } from "@/lib/copy";

import { cancelBooking, submitDateChangeRequest } from "../actions";
import { CHANGE_DATES_FIELD_ID } from "../_lib/field-ids";
import { EMPTY_FORM_STATE, problemsFor } from "../_lib/form-state";
import { CallLink, RejectionPanel } from "./flow-chrome";

/**
 * A date change is a **request**, not a self-serve rebook: the room, the age match and the
 * arena all have to be re-solved and staff may need to move the other party in the window
 * (STRATEGY §3.2 P9). The original booking is untouched until someone confirms, which is
 * exactly what the confirmation sentence promises.
 */
export function DateChangeRequestForm({ reference }: { reference: string }) {
  const [state, formAction, pending] = useActionState(
    submitDateChangeRequest,
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="reference" value={reference} />

      {state.rejection ? (
        <RejectionPanel
          title={state.rejection.title}
          body={state.rejection.body}
          actions={<CallLink />}
        />
      ) : null}

      <p className={cx("text-body-sm text-text-2", MEASURE_BODY)}>{party.p9.request.body}</p>

      <FieldStack gap="field">
        <TextInput
          id={CHANGE_DATES_FIELD_ID}
          name="dates"
          label={party.p9.request.dates.label}
          helper={party.p9.request.dates.help}
          error={problemsFor(state, CHANGE_DATES_FIELD_ID)}
        />
        <TextArea
          id="change-notes"
          name="notes"
          rows={3}
          label={party.p9.request.notes.label}
          defaultValue={state.values?.notes}
        />
      </FieldStack>

      <div>
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          pendingLabel={global.loading.saving}
        >
          {party.p9.request.cta}
        </Button>
      </div>
    </form>
  );
}

/**
 * Cancelling is always allowed; what changes is what happens to the $50. The outcome is
 * computed and stated in dollars **before** the button, and the confirmation restates it — this
 * is the sharpest edge in the product and it is never a surprise.
 */
export function CancelForm({
  reference,
  confirmHeading,
  confirmBody,
}: {
  reference: string;
  confirmHeading: string;
  confirmBody: string;
}) {
  const [state, formAction, pending] = useActionState(cancelBooking, EMPTY_FORM_STATE);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-col gap-3">
        {state.rejection ? (
          <RejectionPanel title={state.rejection.title} body={state.rejection.body} />
        ) : null}
        <div>
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
            {global.btn.cancelBooking}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 border border-state-full p-4">
      <input type="hidden" name="reference" value={reference} />
      <h3 className="font-display text-heading uppercase text-text">{confirmHeading}</h3>
      <p className={cx("text-body-sm text-text-2", MEASURE_BODY)}>{confirmBody}</p>

      {state.rejection ? (
        <ValidationMessage tone="error">{state.rejection.body ?? state.rejection.title}</ValidationMessage>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          {party.p9.cancel.confirm.no}
        </Button>
        <Button
          type="submit"
          variant="ghost"
          pending={pending}
          pendingLabel={global.loading.saving}
        >
          {party.p9.cancel.confirm.yes}
        </Button>
      </div>
    </form>
  );
}
