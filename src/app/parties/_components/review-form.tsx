"use client";

import { useActionState, useState } from "react";

import {
  Button,
  Checkbox,
  Eyebrow,
  FormErrorSummary,
  MEASURE_BODY,
  StickyActionBar,
  Stepper,
  ValidationMessage,
  cx,
} from "@/components/ui";
import { global, party } from "@/lib/copy";

import { editGuestCount, reserveParty } from "../actions";
import { GUESTS_FIELD_ID } from "../_lib/field-ids";
import { EMPTY_FORM_STATE, problemsFor } from "../_lib/form-state";
import { ACK_FIELD_IDS, formSummaryMessage } from "../_lib/validate";
import { RejectionPanel } from "./flow-chrome";

/**
 * The guest count stays editable at review, and the edit re-runs the whole fit check against
 * the held window (STRATEGY §3.2 P6). A rejected edit keeps the hold, which is why the panel
 * can offer "keep {roomMax} guests" as a real option rather than an apology.
 */
export function GuestCountEditor({
  draftId,
  guests,
  min,
  max,
}: {
  draftId: string;
  guests: number;
  min: number;
  max: number;
}) {
  const [state, formAction, pending] = useActionState(editGuestCount, EMPTY_FORM_STATE);
  const [value, setValue] = useState(guests);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="guests" value={value} />

      <div className="flex flex-wrap items-end gap-4">
        <Stepper
          id={GUESTS_FIELD_ID}
          label={global.btn.editGuestCount}
          size="compact"
          value={value}
          min={min}
          max={max}
          onChange={setValue}
          decreaseLabel={party.p1.guests.decrease}
          increaseLabel={party.p1.guests.increase}
        />
        <Button
          type="submit"
          variant="secondary"
          pending={pending}
          pendingLabel={global.loading.saving}
        >
          {global.btn.save}
        </Button>
      </div>

      {problemsFor(state, GUESTS_FIELD_ID) ? (
        <ValidationMessage tone="error">
          {problemsFor(state, GUESTS_FIELD_ID)}
        </ValidationMessage>
      ) : null}

      {state.notice ? (
        <ValidationMessage tone="success">{state.notice}</ValidationMessage>
      ) : null}

      {state.rejection ? (
        <RejectionPanel title={state.rejection.title} body={state.rejection.body} />
      ) : null}
    </form>
  );
}

/**
 * The three acknowledgements. They are separate controls because they carry different weight:
 * the house rules (R-44/R-45), the deposit policy — the sharpest edge in the product — and the
 * headcount promise. Each has its own message when it is missed.
 */
export function AcknowledgementForm({
  draftId,
  depositAckBody,
  ctaLabel,
}: {
  draftId: string;
  depositAckBody: string;
  ctaLabel: string;
}) {
  const [state, formAction, pending] = useActionState(reserveParty, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="draftId" value={draftId} />

      {state.problems.length > 0 ? (
        <FormErrorSummary
          heading={formSummaryMessage(state.problems)}
          errors={state.problems}
        />
      ) : null}

      {state.rejection ? (
        <RejectionPanel title={state.rejection.title} body={state.rejection.body} />
      ) : null}

      <div className="flex flex-col gap-6">
        <Eyebrow as="h2">{party.p6.ack.heading}</Eyebrow>

        <div>
          <Checkbox
            id={ACK_FIELD_IDS.house}
            name="ackHouse"
            label={party.p6.ack.house.label}
            description={party.p6.ack.house.body}
          />
          {problemsFor(state, ACK_FIELD_IDS.house) ? (
            <ValidationMessage tone="error" className="mt-2">
              {problemsFor(state, ACK_FIELD_IDS.house)}
            </ValidationMessage>
          ) : null}
        </div>

        {/* Visually the heaviest of the three: it is the only one that costs money. */}
        <div className="border-l-[3px] border-l-accent bg-accent-wash p-4">
          <Checkbox
            id={ACK_FIELD_IDS.deposit}
            name="ackDeposit"
            label={party.p6.ack.deposit.label}
            description={<span className={cx("block", MEASURE_BODY)}>{depositAckBody}</span>}
          />
          {problemsFor(state, ACK_FIELD_IDS.deposit) ? (
            <ValidationMessage tone="error" className="mt-2">
              {problemsFor(state, ACK_FIELD_IDS.deposit)}
            </ValidationMessage>
          ) : null}
        </div>

        <div>
          <Checkbox
            id={ACK_FIELD_IDS.headcount}
            name="ackHeadcount"
            label={party.p6.ack.headcount.label}
            description={party.p6.ack.headcount.body}
          />
          {problemsFor(state, ACK_FIELD_IDS.headcount) ? (
            <ValidationMessage tone="error" className="mt-2">
              {problemsFor(state, ACK_FIELD_IDS.headcount)}
            </ValidationMessage>
          ) : null}
        </div>
      </div>

      <StickyActionBar
        hideAtLg={false}
        action={
          <Button
            type="submit"
            variant="primary"
            pending={pending}
            pendingLabel={global.loading.reserving}
          >
            {ctaLabel}
          </Button>
        }
      >
        <span className="text-caption text-text-2">{party.p6.ctaNote}</span>
      </StickyActionBar>
    </form>
  );
}
