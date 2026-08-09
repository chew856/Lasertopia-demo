"use client";

import { useState, useTransition } from "react";

import {
  Button,
  MEASURE_SMALL,
  PartyBayRow,
  PartyWindowCard,
  ValidationMessage,
  cx,
  type BayState,
  type TagTone,
} from "@/components/ui";
import { global } from "@/lib/copy";

import { selectWindow } from "../actions";
import type { FormState } from "../_lib/form-state";
import { CallLink, RejectionPanel } from "./flow-chrome";

/**
 * One window row, fully resolved on the server. The client never decides whether a window is
 * available and never writes the reason it is not — it renders what the engine and COPY.md
 * already agreed on.
 */
export interface WindowRowModel {
  partyWindowId: string;
  windowTime: string;
  available: boolean;
  status: { label: string; tone: TagTone; hatched?: boolean };
  bayState: BayState;
  stateWord: string;
  roomName: string | null;
  capacityLabel: string;
  a11yLabel: string;
  /** Null when the window is available. Never null when it is not. */
  reason: string | null;
  constraintNote: string | null;
  gamesNote: string | null;
  roomsNote: string | null;
}

export function WindowList({
  windows,
  date,
  guests,
  honoreeAge,
}: {
  windows: readonly WindowRowModel[];
  date: string;
  guests: number;
  honoreeAge: number;
}) {
  const [rejection, setRejection] = useState<FormState["rejection"] | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (partyWindowId: string) => {
    setRejection(null);
    startTransition(async () => {
      const result = await selectWindow({ date, partyWindowId, guests, honoreeAge });
      if (result?.rejection) setRejection(result.rejection);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {rejection ? (
        <RejectionPanel
          title={rejection.title}
          body={rejection.body}
          actions={<CallLink />}
        />
      ) : null}

      {windows.map((window) => (
        <PartyWindowCard
          key={window.partyWindowId}
          windowTime={window.windowTime}
          status={window.status}
          constraintNote={window.constraintNote ?? undefined}
          extraNote={
            window.available ? (
              <span className="flex flex-col gap-1">
                {window.gamesNote ? <span>{window.gamesNote}</span> : null}
                {window.roomsNote ? <span>{window.roomsNote}</span> : null}
              </span>
            ) : undefined
          }
          bays={
            window.available && window.roomName ? (
              <PartyBayRow
                roomName={window.roomName}
                capacity={window.capacityLabel}
                state={window.bayState}
                stateWord={pending ? global.loading.saving : window.stateWord}
                a11yLabel={window.a11yLabel}
                disabled={pending}
                onSelect={() => pick(window.partyWindowId)}
              />
            ) : (
              // Never a bare greyed-out row: the reason gets its own typographic slot, with
              // the venue's real numbers in it (DESIGN principle 6, STRATEGY §3.2 P2).
              <div className="flex flex-col gap-2 px-3 py-4">
                <p className="font-mono text-mono-sm tabular-nums text-text-3">
                  {window.capacityLabel}
                </p>
                <p className={cx("text-body-sm text-text-2", MEASURE_SMALL)}>{window.reason}</p>
              </div>
            )
          }
        />
      ))}
    </div>
  );
}

/** The "soonest that fits" shortcut — the single most useful control on P2 for a flexible parent. */
export function TakeWindowButton({
  label,
  date,
  partyWindowId,
  guests,
  honoreeAge,
  variant = "primary",
}: {
  label: string;
  date: string;
  partyWindowId: string;
  guests: number;
  honoreeAge: number;
  variant?: "primary" | "secondary";
}) {
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<FormState["rejection"] | null>(null);

  // `selectWindow` navigates on success and RETURNS a rejection on failure. Discarding that
  // return made every recovery button in the flow — including the two on the hold-expired
  // panel — appear to do nothing when the window went while the panel was on screen, which is
  // the exact failure the recovery panel exists to prevent.
  return (
    <span className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        pending={pending}
        pendingLabel={global.loading.saving}
        onClick={() => {
          setRefusal(null);
          startTransition(async () => {
            const result = await selectWindow({ date, partyWindowId, guests, honoreeAge });
            if (result?.rejection) setRefusal(result.rejection);
          });
        }}
      >
        {label}
      </Button>
      {refusal ? (
        <ValidationMessage tone="error" className={MEASURE_SMALL}>
          {refusal.body ? `${refusal.title} ${refusal.body}` : refusal.title}
        </ValidationMessage>
      ) : null}
    </span>
  );
}
