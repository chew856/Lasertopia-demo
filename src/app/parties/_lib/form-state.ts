/**
 * The one shape every party server action returns to a form.
 *
 * `problems` feeds `FormErrorSummary` above the submit button and `TextInput`'s `error` prop
 * under the field, which is DESIGN §5.10's rule: a field-level failure is stated twice, once
 * where it can be fixed and once where the submit was pressed.
 *
 * `rejection` carries an engine `BookingErrorCode` for the failures that are not a field at
 * all — a lost race, a lapsed hold, a window that stopped fitting. Those get a whole panel with
 * their own recovery actions, never a red line under a text box.
 */

import type { BookingErrorCode } from "@/lib/domain";

export interface FieldProblem {
  /** The `id` of the control, so `FormErrorSummary` can link to it. */
  fieldId: string;
  message: string;
}

export interface FormState {
  problems: FieldProblem[];
  /** A non-blocking sentence: an add-on removed, a guest count re-fitted. */
  notice?: string;
  /**
   * Set when the engine said no for a structural reason. `title` and `body` are already
   * resolved to COPY.md §8 prose on the server — a screen never renders a code or the engine's
   * own English, and `body` is null only where the deck's sentence needs alternatives that do
   * not exist (see `_lib/rejection.ts`).
   */
  rejection?: { code: BookingErrorCode; title: string; body: string | null };
  /** Echo of what was submitted, so a failed form re-renders filled in. */
  values?: Record<string, string>;
}

export const EMPTY_FORM_STATE: FormState = { problems: [] };

export function problemsFor(state: FormState, fieldId: string): string | undefined {
  return state.problems.find((p) => p.fieldId === fieldId)?.message;
}

export function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function readChecked(form: FormData, name: string): boolean {
  return form.get(name) !== null;
}
