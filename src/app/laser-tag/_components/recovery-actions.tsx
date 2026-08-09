"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, ButtonLink, buttonClassName } from "@/components/ui";
import { formatPhoneHref } from "@/lib/format";

import { SELECT_INITIAL } from "../_lib/action-state";
import type { PanelAction } from "../_lib/rejections";
import { LASER_TAG_HOME, PARTY_HOME, timeStep } from "../_lib/routes";
import { selectStart } from "../actions";

/**
 * The recovery buttons on the screens that are not the grid — G3's expired hold, G4's
 * submit-time rejections.
 *
 * "Take 8:30 PM" here does the same server work that taking a tile does: it re-validates the
 * whole block and re-places the hold. There is no shortcut that skips the check, because the
 * moment a recovery trusts its own suggestion is the moment a customer can be handed a slot
 * that filled while they were reading about the last one.
 *
 * `then="review"` is what keeps COPY.md's promise that a move "keeps everything else": a
 * customer who has already filled the form in goes back to the review screen, not through it
 * again.
 */
export function RecoveryActions({
  draftId,
  date,
  actions,
  phone,
  then,
}: {
  draftId: string;
  date: string;
  actions: readonly PanelAction[];
  phone: string;
  then?: "review";
}) {
  const [, formAction, pending] = useActionState(selectStart, SELECT_INITIAL);

  return (
    <>
      {actions.map((action, index) => {
        const key = `${action.kind}-${index}`;
        const variant = action.variant === "primary" ? "primary" : "secondary";

        switch (action.kind) {
          case "takeTime":
          case "oneGame":
            return (
              <form key={key} action={formAction}>
                <input type="hidden" name="draftId" value={draftId} />
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="startMinutes" value={action.startMinutes ?? ""} />
                {action.kind === "oneGame" ? (
                  <input type="hidden" name="games" value="1" />
                ) : null}
                {then ? <input type="hidden" name="then" value={then} /> : null}
                <Button type="submit" variant={variant} fullWidth={false} pending={pending}>
                  {action.label}
                </Button>
              </form>
            );
          case "goToDate":
            return (
              <Link
                key={key}
                href={timeStep(draftId, { date: action.date ?? date })}
                className={buttonClassName(variant)}
              >
                {action.label}
              </Link>
            );
          case "call":
          case "callWalkIn":
            return (
              <ButtonLink key={key} variant={variant} href={formatPhoneHref(phone)}>
                {action.label}
              </ButtonLink>
            );
          case "reduceGroup":
            return (
              <Link key={key} href={LASER_TAG_HOME} className={buttonClassName(variant)}>
                {action.label}
              </Link>
            );
          case "bookParty":
            return (
              <Link key={key} href={PARTY_HOME} className={buttonClassName(variant)}>
                {action.label}
              </Link>
            );
        }
      })}
    </>
  );
}
