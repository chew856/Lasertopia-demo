/**
 * Field validation for P5, P7 and P9 — the only screens with free-text input.
 *
 * Pure, and deliberately conservative. The phone check accepts anything that reduces to a
 * 10-digit North American number (COPY.md `err.field.phone.invalid` names that shape), and the
 * email check looks for the two things the copy promises to look for: an `@` and a domain.
 * Neither pretends to be an RFC parser — a validator that rejects a real address is worse than
 * one that lets an unusual one through to a human.
 */

import { interpolate, party } from "@/lib/copy";
import type { FieldProblem } from "./form-state";

export const MAX_NAME_LENGTH = 80;
export const MAX_NOTES_LENGTH = 500;

export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return local.length === 10;
}

export function isValidEmail(raw: string): boolean {
  const at = raw.indexOf("@");
  if (at <= 0 || at !== raw.lastIndexOf("@")) return false;
  const domain = raw.slice(at + 1);
  if (/\s/.test(raw)) return false;
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

export interface DetailsInput {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  honoreeName: string;
  notes: string;
}

/** Field ids match the rendered control ids so `FormErrorSummary` can link straight to them. */
export const DETAIL_FIELD_IDS = {
  name: "organiser-name",
  phone: "organiser-phone",
  email: "organiser-email",
  honoree: "honoree-name",
  notes: "party-notes",
} as const;

export function validateDetails(input: DetailsInput): FieldProblem[] {
  const problems: FieldProblem[] = [];

  if (input.customerName.length === 0) {
    problems.push({ fieldId: DETAIL_FIELD_IDS.name, message: party.err.field.name.required });
  } else if (input.customerName.length > MAX_NAME_LENGTH) {
    problems.push({ fieldId: DETAIL_FIELD_IDS.name, message: party.err.field.name.tooLong });
  }

  if (input.customerPhone.length === 0) {
    problems.push({ fieldId: DETAIL_FIELD_IDS.phone, message: party.err.field.phone.required });
  } else if (!isValidPhone(input.customerPhone)) {
    problems.push({ fieldId: DETAIL_FIELD_IDS.phone, message: party.err.field.phone.invalid });
  }

  if (input.customerEmail.length === 0) {
    problems.push({ fieldId: DETAIL_FIELD_IDS.email, message: party.err.field.email.required });
  } else if (!isValidEmail(input.customerEmail)) {
    problems.push({ fieldId: DETAIL_FIELD_IDS.email, message: party.err.field.email.invalid });
  }

  if (input.honoreeName.length === 0) {
    problems.push({
      fieldId: DETAIL_FIELD_IDS.honoree,
      message: party.err.field.honoree.required,
    });
  }

  if (input.notes.length > MAX_NOTES_LENGTH) {
    problems.push({ fieldId: DETAIL_FIELD_IDS.notes, message: party.err.field.notes.tooLong });
  }

  return problems;
}

export const ACK_FIELD_IDS = {
  house: "ack-house",
  deposit: "ack-deposit",
  headcount: "ack-headcount",
} as const;

/**
 * R-44 / R-45 require an explicit acknowledgement of the nut-free rule, the no-outside-food
 * rule and the closed-toed-shoe rule before a party can be confirmed. They are three separate
 * checkboxes because they carry different weight, so they get three separate messages.
 */
export function validateAcknowledgements(acks: {
  house: boolean;
  deposit: boolean;
  headcount: boolean;
}): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (!acks.house) {
    problems.push({ fieldId: ACK_FIELD_IDS.house, message: party.err.field.ack.rules });
  }
  if (!acks.deposit) {
    problems.push({ fieldId: ACK_FIELD_IDS.deposit, message: party.err.field.ack.deposit });
  }
  if (!acks.headcount) {
    problems.push({ fieldId: ACK_FIELD_IDS.headcount, message: party.err.field.ack.headcount });
  }
  return problems;
}

/** The §8.25 form-level block: "{n} things need a look before we can continue." */
export function formSummaryMessage(problems: readonly FieldProblem[]): string {
  return interpolate(party.err.formSummary, { n: problems.length });
}
