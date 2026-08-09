"use client";

import { useActionState } from "react";

import {
  Button,
  Caption,
  Checkbox,
  MonoValue,
  StickyActionBar,
  ValidationMessage,
} from "@/components/ui";
import { global, interpolate, laserTag } from "@/lib/copy";
import { formatPhone } from "@/lib/format";

import { CONFIRM_INITIAL } from "../_lib/action-state";
import { confirmBooking } from "../actions";

/**
 * Screen G4's one control — the acknowledgement and the confirm button (STRATEGY §3.1).
 *
 * The acknowledgement is a real gate, not a formality: `err.field.ack.rules` is checked on
 * the server before anything is written, because "closed-toed shoes" is the rule most likely
 * to turn a family away at the door and the venue needs to be able to say it was shown.
 *
 * The button is idempotent by construction. A double tap, or a retry after a timeout, lands
 * on the booking that already exists rather than creating a second one — which is what makes
 * `err.server.retrySafe` ("trying again is safe") a true sentence rather than a hope.
 */
export function ReviewForm({
  draftId,
  ackBody,
  totalLabel,
  phone,
}: {
  draftId: string;
  /** `g4.ack.body` — both house rules, already composed from `global.rule.*`. */
  ackBody: string;
  /** The pre-tax subtotal, formatted. */
  totalLabel: string;
  phone: string;
}) {
  const [state, formAction, pending] = useActionState(confirmBooking, CONFIRM_INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="draftId" value={draftId} />

      <div>
        <Checkbox
          id="lt-ack"
          name="ack"
          label={laserTag.g4.ack.label}
          description={ackBody}
          aria-invalid={state.ackMissing || undefined}
        />
        {state.ackMissing ? (
          <ValidationMessage tone="error" className="mt-2">
            {laserTag.err.field.ackRules}
          </ValidationMessage>
        ) : null}
      </div>

      {state.serverError ? (
        <div>
          <ValidationMessage tone="error">
            {interpolate(laserTag.err.server.confirmGames, { phone: formatPhone(phone) })}
          </ValidationMessage>
          <Caption className="mt-2">{laserTag.err.server.retrySafe}</Caption>
        </div>
      ) : null}

      <StickyActionBar
        hideAtLg={false}
        action={
          <Button
            type="submit"
            variant="primary"
            pending={pending}
            pendingLabel={global.loading.confirming}
          >
            {global.btn.confirmBooking}
          </Button>
        }
      >
        <MonoValue step="md">{totalLabel}</MonoValue>
        <span className="text-caption text-text-2">{global.sum.plusTax}</span>
      </StickyActionBar>
    </form>
  );
}
