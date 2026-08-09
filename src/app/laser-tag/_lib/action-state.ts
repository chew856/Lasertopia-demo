/**
 * The shapes the flow's server actions hand back to their forms.
 *
 * They live here rather than beside the actions because a `"use server"` module may export
 * nothing but async functions — a `const` in that file is a build error, not a style choice.
 */

import type { BookingErrorCode } from "@/lib/domain";

import type { DetailsErrors } from "./validate";

export type StartError = "PLAYERS_MIN" | "PLAYERS_MAX" | "GAMES" | "SERVER";

export interface StartState {
  error: StartError | null;
}

export interface SelectState {
  /** The engine's code when a choice was refused between render and submit. */
  rejected: BookingErrorCode | null;
}

export interface ExtendState {
  /** New expiry, epoch milliseconds, so the countdown updates without a navigation. */
  heldUntil: number | null;
  /** COPY.md `hold.extendUsed` — the offer is spent once it has been taken. */
  spent: boolean;
}

export interface DetailsState {
  errors: DetailsErrors;
  serverError: boolean;
}

export interface ConfirmState {
  /** COPY.md `err.field.ack.rules` — the one failure that belongs beside the checkbox. */
  ackMissing: boolean;
  serverError: boolean;
}

export interface CancelState {
  tooLate: boolean;
  serverError: boolean;
}

export const START_INITIAL: StartState = { error: null };
export const SELECT_INITIAL: SelectState = { rejected: null };
export const EXTEND_INITIAL: ExtendState = { heldUntil: null, spent: false };
export const DETAILS_INITIAL: DetailsState = { errors: {}, serverError: false };
export const CONFIRM_INITIAL: ConfirmState = { ackMissing: false, serverError: false };
export const CANCEL_INITIAL: CancelState = { tooLate: false, serverError: false };
