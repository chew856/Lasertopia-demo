import Link from "next/link";

import { buttonClassName } from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";

import { presentHoldExpired } from "../_lib/rejection";
import type { AlternativeWindow } from "../_lib/alternatives";
import type { EngineConfig } from "@/lib/domain";

import { CallLink, RejectionPanel } from "./flow-chrome";
import { TakeWindowButton } from "./window-list";

/**
 * The lapsed-hold state (§8.19), shared by P3–P6.
 *
 * Two bodies, because the recovery genuinely differs: if the window is still free we offer to
 * take it again, and if it went we name the nearest windows that fit. Everything the customer
 * typed is still on the draft either way, which is what the copy promises.
 */
export function HoldExpiredPanel({
  config,
  guests,
  honoreeAge,
  windowLabel,
  dateShort,
  date,
  partyWindowId,
  stillOpen,
  alternatives,
}: {
  config: EngineConfig;
  guests: number;
  honoreeAge: number;
  windowLabel: string;
  dateShort: string;
  date: string;
  partyWindowId: string;
  stillOpen: boolean;
  alternatives: readonly AlternativeWindow[];
}) {
  const presented = presentHoldExpired(
    {
      config,
      guests,
      windowLabel,
      dateShort,
      alternatives: alternatives.map((a) => a.formatted),
    },
    stillOpen,
  );

  return (
    <RejectionPanel
      title={presented.title}
      body={presented.body}
      actions={
        <>
          {stillOpen ? (
            <TakeWindowButton
              label={interpolate(global.btn.holdWindowAgain, { window: windowLabel })}
              date={date}
              partyWindowId={partyWindowId}
              guests={guests}
              honoreeAge={honoreeAge}
            />
          ) : (
            alternatives.map((alternative) => (
              <TakeWindowButton
                key={`${alternative.date}-${alternative.partyWindowId}`}
                label={interpolate(global.btn.takeWindow, {
                  altWindow1: alternative.formatted,
                })}
                date={alternative.date}
                partyWindowId={alternative.partyWindowId}
                guests={guests}
                honoreeAge={honoreeAge}
                variant="secondary"
              />
            ))
          )}
          <Link
            href={`/parties/date?guests=${guests}&age=${honoreeAge}&date=${date}`}
            className={buttonClassName("ghost")}
          >
            {party.err.holdExpired.action.repickWindow}
          </Link>
          <CallLink variant="ghost" />
        </>
      }
    />
  );
}
