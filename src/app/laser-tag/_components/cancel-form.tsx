"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, ButtonLink, ValidationMessage, buttonClassName } from "@/components/ui";
import { global, interpolate, laserTag } from "@/lib/copy";
import { formatPhone, formatPhoneHref } from "@/lib/format";

import { CANCEL_INITIAL } from "../_lib/action-state";
import { cancelBooking } from "../actions";

/**
 * Cancellation — free up to the cutoff, one tap plus a confirm step (STRATEGY §3.1).
 *
 * Two steps and not one: the confirm sentence states in the venue's own terms what the
 * cancellation frees up and that nothing is charged either way, which is information a
 * customer cannot get from a button label. Past the cutoff the server refuses and
 * `g5.cancel.tooLate` sends them to the phone, because at that point a human has to take the
 * game off the list.
 */
export function CancelForm({
  code,
  confirmBody,
  keepHref,
  phone,
  cutoffMinutes,
}: {
  code: string;
  confirmBody: string;
  /** Where "Keep it" goes — the booking page without the confirm step. */
  keepHref: string;
  phone: string;
  /** `CFG.onlineCutoffMinutes`. Never typed into a component; always passed in. */
  cutoffMinutes: number;
}) {
  const [state, formAction, pending] = useActionState(cancelBooking, CANCEL_INITIAL);

  if (state.tooLate) {
    return (
      <div className="flex flex-col gap-4">
        <ValidationMessage tone="error">
          {interpolate(laserTag.g5.cancel.tooLate, {
            cutoffMinutes,
            phone: formatPhone(phone),
          })}
        </ValidationMessage>
        <ButtonLink href={formatPhoneHref(phone)}>
          {interpolate(global.phoneCall, { phone: formatPhone(phone) })}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="code" value={code} />
      <p className="max-w-[56ch] text-body-sm text-text-2">{confirmBody}</p>

      {state.serverError ? (
        <ValidationMessage tone="error">
          {interpolate(laserTag.err.server.genericBody, { phone: formatPhone(phone) })}
        </ValidationMessage>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={keepHref} className={buttonClassName("primary")}>
          {laserTag.g5.cancel.confirmNo}
        </Link>
        <Button type="submit" variant="secondary" fullWidth={false} pending={pending} pendingLabel={global.loading.saving}>
          {laserTag.g5.cancel.confirmYes}
        </Button>
      </div>
    </form>
  );
}
