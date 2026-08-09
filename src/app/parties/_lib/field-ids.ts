/**
 * Control ids shared between the server actions and the forms that post to them.
 *
 * They live here rather than in `actions.ts` because a `"use server"` module may export
 * nothing but async functions — a single exported constant makes the whole module invalid and
 * every action in it unreachable.
 *
 * The ids are load-bearing, not cosmetic: `FormErrorSummary` links each message to its control
 * by id, which is DESIGN §5.10's rule that a failure is stated where it can be fixed as well as
 * where the submit was pressed.
 */

export const GUESTS_FIELD_ID = "guest-count";
export const AGE_FIELD_ID = "honoree-age";
export const NAME_ON_FILE_FIELD_ID = "name-on-file";
export const CHANGE_DATES_FIELD_ID = "change-dates";

/** What P2 posts when a parent taps a window. Re-validated server-side before anything is held. */
export interface WindowSelection {
  date: string;
  partyWindowId: string;
  guests: number;
  honoreeAge: number;
}
