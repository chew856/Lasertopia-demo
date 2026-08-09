"use client";

import { useActionState } from "react";

import { Button, FieldStack, StickyActionBar, TextInput } from "@/components/ui";
import { global, party } from "@/lib/copy";

import { payDeposit } from "../actions";
import { NAME_ON_FILE_FIELD_ID } from "../_lib/field-ids";
import { EMPTY_FORM_STATE, problemsFor } from "../_lib/form-state";
import { CallLink, RejectionPanel } from "./flow-chrome";

/**
 * Screen P7 — the simulated checkout.
 *
 * No card fields exist on this form, by design (R-53): the deposit is *recorded* against the
 * booking and staff confirm payment. The submit is idempotent on the draft, so a double tap or
 * a refresh returns the same booking instead of creating a second party.
 */
export function DepositForm({
  draftId,
  defaultName,
  ctaLabel,
}: {
  draftId: string;
  defaultName: string;
  ctaLabel: string;
}) {
  const [state, formAction, pending] = useActionState(payDeposit, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="draftId" value={draftId} />

      {state.rejection ? (
        <RejectionPanel
          title={state.rejection.title}
          body={state.rejection.body}
          actions={<CallLink />}
        />
      ) : null}

      <FieldStack gap="field">
        <TextInput
          id={NAME_ON_FILE_FIELD_ID}
          name="nameOnFile"
          label={party.p7.nameOnFile.label}
          helper={party.p7.nameOnFile.help}
          autoComplete="name"
          defaultValue={state.values?.nameOnFile ?? defaultName}
          error={problemsFor(state, NAME_ON_FILE_FIELD_ID)}
        />
      </FieldStack>

      <StickyActionBar
        hideAtLg={false}
        action={
          <Button
            type="submit"
            variant="primary"
            disabled={pending}
            pending={pending}
            pendingLabel={global.loading.reserving}
          >
            {ctaLabel}
          </Button>
        }
      >
        <span className="text-caption text-text-2">{party.err.server.retrySafe}</span>
      </StickyActionBar>
    </form>
  );
}
