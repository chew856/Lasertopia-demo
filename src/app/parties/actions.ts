"use server";

/**
 * Every write the party flow makes.
 *
 * The contract for all of them is STRATEGY §0's: **the server is the only authority.** Each
 * action re-derives the guest count, the window fit, the room configuration, the game times and
 * the price from the engine at the moment it runs. Nothing a client posted about money or
 * inventory is written; the only things taken from the request are the customer's own choices —
 * how many guests, which window, which package, which extras, their contact details — and each
 * of those is re-validated before it lands.
 *
 * Failures come back as designed states, never exceptions: a `FormState` with per-field
 * problems for input, or a `rejection` carrying an engine `BookingErrorCode` for the structural
 * ones the screens render as whole panels with their own recovery actions.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { interpolate, party } from "@/lib/copy";
import { formatDateLong, formatDateShort, formatMoney, formatTimeRange } from "@/lib/format";
import {
  computePartyPrice,
  localDateOf,
  type BookingErrorCode,
  type Catalog,
  type EngineConfig,
  type Rejection,
} from "@/lib/domain";

import { findAlternatives } from "./_lib/alternatives";
import { loadDayState } from "./_lib/day-state";
import {
  cancelParty,
  createHeldDraft,
  loadDraft,
  loadPartyByReference,
  recordDeposit,
  rehold,
  requestNewDate,
  selectionsOf,
  setDraftAcknowledgements,
  setDraftDetails,
  setDraftExtras,
  setDraftPackage,
  sweepExpiredHolds,
} from "./_lib/draft";
import { formValuesFrom, parseExtrasForm } from "./_lib/extras";
import { guestCeiling, parsePartyIntent } from "./_lib/fit";
import {
  GUESTS_FIELD_ID,
  NAME_ON_FILE_FIELD_ID,
  CHANGE_DATES_FIELD_ID,
  AGE_FIELD_ID,
  type WindowSelection,
} from "./_lib/field-ids";
import { readChecked, readText, type FormState } from "./_lib/form-state";
import { presentRejection } from "./_lib/rejection";
import { validateAcknowledgements, validateDetails } from "./_lib/validate";
import { loadVenue, packageByCode } from "./_lib/venue";

/** The one generic failure sentence, with its phone number filled in. §8.23. */
function genericFailure(config: EngineConfig): FormState {
  return {
    problems: [],
    rejection: {
      code: "CONFIG_INVALID",
      title: party.err.server.generic.title,
      body: interpolate(party.err.server.generic.body, { phone: config.venuePhone }),
    },
  };
}

function namedFailure(body: string): FormState {
  return {
    problems: [],
    rejection: { code: "CONFIG_INVALID", title: party.err.server.generic.title, body },
  };
}

/**
 * Turn an engine rejection into the §8 panel a parent reads, with the nearest windows that do
 * fit already computed. STRATEGY §0: we never reject without offering the alternatives the same
 * engine can find.
 */
async function rejectionState(
  error: Rejection,
  ctx: {
    now: Date;
    date: string;
    partyWindowId: string;
    guests: number;
    honoreeAge: number;
    catalog: Catalog;
    config: EngineConfig;
    addOnName?: string;
    packageName?: string;
    totalLabel?: string;
    atReview?: boolean;
  },
): Promise<FormState> {
  const window = ctx.catalog.partyWindows.find((w) => w.id === ctx.partyWindowId) ?? null;
  const needsAlternatives = ALTERNATIVE_CODES.has(error.code);
  const alternatives = needsAlternatives
    ? await findAlternatives({
        now: ctx.now,
        guests: ctx.guests,
        honoreeAge: ctx.honoreeAge,
        catalog: ctx.catalog,
        config: ctx.config,
        limit: 2,
        exclude: { date: ctx.date, partyWindowId: ctx.partyWindowId },
      })
    : [];

  const existingAges = error.detail.existingAges;
  const otherAge =
    Array.isArray(existingAges) && typeof existingAges[0] === "number"
      ? existingAges[0]
      : undefined;
  const remaining = error.detail.remainingCapacity ?? error.detail.windowMaxGuests;

  const presented = presentRejection(error.code, {
    config: ctx.config,
    guests: ctx.guests,
    honoreeAge: ctx.honoreeAge,
    windowLabel: window ? formatTimeRange(window.startMinutes, window.endMinutes) : "",
    dateShort: formatDateShort(ctx.date),
    dateLong: formatDateLong(ctx.date),
    roomMax: typeof remaining === "number" ? remaining : 0,
    otherAge,
    alternatives: alternatives.map((a) => a.formatted),
    addOnName: ctx.addOnName,
    packageName: ctx.packageName,
    totalLabel: ctx.totalLabel,
    nextDateShort: alternatives[0]?.dateShort,
    atReview: ctx.atReview,
  });

  return {
    problems: [],
    rejection: { code: error.code, title: presented.title, body: presented.body },
  };
}

/** Codes whose §8 body names `{altWindow1}` / `{altWindow2}` and therefore needs a scan. */
const ALTERNATIVE_CODES: ReadonlySet<BookingErrorCode> = new Set([
  "NO_ROOM_CONFIG",
  "WINDOW_FULL",
  "AGE_GAP_EXCEEDED",
  "NO_GAME_CAPACITY",
  "ARENA_FULL",
  "ROOM_DOUBLE_BOOKED",
  "MIN_LEAD_TIME_NOT_MET",
]);

// ─── P1 — /parties ────────────────────────────────────────────────────────────────────────

export async function startPartyDraft(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { catalog, config } = await loadVenue();
  const rawGuests = readText(form, "guests");
  const rawAge = readText(form, "age");

  const intent = parsePartyIntent({ guests: rawGuests, age: rawAge }, catalog, config);
  if (!intent.ok) {
    // Over the ceiling is not a field error (R-25 / §8.8): it is the "call us" path, with a
    // real phone number and an offer to book the largest party we can actually host.
    if (intent.problems.some((p) => p.code === "guestsMax")) {
      return redirect(`/parties/enquiry?guests=${encodeURIComponent(rawGuests)}`);
    }
    return {
      problems: intent.problems.map((problem) => {
        switch (problem.code) {
          case "guestsMin":
            return { fieldId: GUESTS_FIELD_ID, message: party.err.field.guests.min };
          case "ageRequired":
            return { fieldId: AGE_FIELD_ID, message: party.err.field.age.required };
          default:
            return {
              fieldId: AGE_FIELD_ID,
              message: interpolate(party.err.field.age.range, { phone: config.venuePhone }),
            };
        }
      }),
      values: { guests: rawGuests, age: rawAge },
    };
  }

  return redirect(`/parties/date?guests=${intent.value.guests}&age=${intent.value.honoreeAge}`);
}

// ─── P2 — /parties/date ───────────────────────────────────────────────────────────────────

/**
 * Placing the hold. `createHeldDraft` plans the window from scratch and claims the room-slots
 * and the arena seats through the same transaction a confirmation uses, so losing the race here
 * is a `ROOM_DOUBLE_BOOKED` rejection with real alternatives, not a stack trace.
 */
export async function selectWindow(selection: WindowSelection): Promise<FormState> {
  const { catalog, config } = await loadVenue();
  const now = new Date();

  const intent = parsePartyIntent(
    { guests: String(selection.guests), age: String(selection.honoreeAge) },
    catalog,
    config,
  );
  if (!intent.ok) return namedFailure(party.err.server.startDraft);

  await sweepExpiredHolds(now);
  const dayState = await loadDayState(selection.date, now, catalog, config);

  const created = await createHeldDraft({
    now,
    date: selection.date,
    guests: intent.value.guests,
    honoreeAge: intent.value.honoreeAge,
    partyWindowId: selection.partyWindowId,
    catalog,
    config,
    dayState,
  });

  if (!created.ok) {
    return rejectionState(created.error, {
      now,
      date: selection.date,
      partyWindowId: selection.partyWindowId,
      guests: intent.value.guests,
      honoreeAge: intent.value.honoreeAge,
      catalog,
      config,
    });
  }

  return redirect(`/parties/${created.value.id}/package`);
}

// ─── P3 — package ─────────────────────────────────────────────────────────────────────────

export async function choosePackage(form: FormData): Promise<void> {
  const draftId = readText(form, "draftId");
  const code = readText(form, "packageCode");

  const { catalog } = await loadVenue();
  const draft = await loadDraft(draftId);
  const packageRecord = packageByCode(catalog, code);
  if (!draft || !packageRecord) {
    redirect(`/parties/${encodeURIComponent(draftId)}/package?problem=UNKNOWN_REFERENCE`);
    return;
  }

  // R-46: a package switch can strand an add-on. The names come back so P4 can say so.
  const { removed } = await setDraftPackage(draft, packageRecord, catalog);
  revalidatePath(`/parties/${draft.id}`, "layout");
  redirect(
    removed.length > 0
      ? `/parties/${draft.id}/extras?removed=${encodeURIComponent(removed.join(","))}`
      : `/parties/${draft.id}/extras`,
  );
}

// ─── P4 — extras ──────────────────────────────────────────────────────────────────────────

export async function saveExtras(_previous: FormState, form: FormData): Promise<FormState> {
  const draftId = readText(form, "draftId");
  const intent = readText(form, "intent");

  const { catalog, config } = await loadVenue();
  const draft = await loadDraft(draftId);
  if (!draft) return genericFailure(config);

  const packageRecord = packageByCode(catalog, draft.packageCode);
  if (!packageRecord) return genericFailure(config);

  const parsed = parseExtrasForm(formValuesFrom(form), catalog, packageRecord, draft.guests);
  // "No extras — continue" clears the basket rather than quietly keeping what was ticked.
  const selections = intent === "skip" ? [] : parsed.selections;
  const saved = await setDraftExtras(draft, {
    selections,
    foodChoice: parsed.foodChoice,
    packageRecord,
    catalog,
    config,
  });

  if (!saved.ok) {
    const addOnCode = saved.error.detail.addOnCode;
    return rejectionState(saved.error, {
      now: new Date(),
      date: draft.date,
      partyWindowId: draft.partyWindowId,
      guests: draft.guests,
      honoreeAge: draft.honoreeAge,
      catalog,
      config,
      addOnName:
        typeof addOnCode === "string"
          ? (catalog.addOns.find((a) => a.code === addOnCode)?.name ?? addOnCode)
          : undefined,
      packageName: packageRecord.name,
    });
  }

  revalidatePath(`/parties/${draft.id}`, "layout");
  if (intent === "continue" || intent === "skip") {
    return redirect(`/parties/${draft.id}/details`);
  }

  return {
    problems: [],
    notice: interpolate(party.p4.runningTotal, {
      total: formatMoney(saved.value.totalCents),
    }),
  };
}

// ─── P5 — details ─────────────────────────────────────────────────────────────────────────

export async function saveDetails(_previous: FormState, form: FormData): Promise<FormState> {
  const { config } = await loadVenue();
  const draft = await loadDraft(readText(form, "draftId"));
  if (!draft) return genericFailure(config);

  const values = {
    customerName: readText(form, "customerName"),
    customerPhone: readText(form, "customerPhone"),
    customerEmail: readText(form, "customerEmail"),
    honoreeName: readText(form, "honoreeName"),
    notes: readText(form, "notes"),
  };

  const problems = validateDetails(values);
  if (problems.length > 0) return { problems, values };

  await setDraftDetails(draft, values);
  revalidatePath(`/parties/${draft.id}`, "layout");
  return redirect(`/parties/${draft.id}/review`);
}

// ─── P6 — review ──────────────────────────────────────────────────────────────────────────

/**
 * The guest count stays editable at review (STRATEGY §3.2), and editing it re-runs the whole
 * fit check against the held window. A count that no longer fits does not silently fail and
 * does not drop the hold: `rehold` plans before it releases, so the original window survives a
 * rejected edit and `err.roomFit.atReview` can truthfully offer to keep it.
 */
export async function editGuestCount(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { catalog, config } = await loadVenue();
  const draft = await loadDraft(readText(form, "draftId"));
  if (!draft) return genericFailure(config);

  const intent = parsePartyIntent(
    { guests: readText(form, "guests"), age: String(draft.honoreeAge) },
    catalog,
    config,
  );
  if (!intent.ok) {
    const overCeiling = intent.problems.some((p) => p.code === "guestsMax");
    return {
      problems: [
        {
          fieldId: GUESTS_FIELD_ID,
          message: overCeiling
            ? interpolate(party.err.field.guests.max, {
                maxGuests: guestCeiling(catalog, config),
                phone: config.venuePhone,
              })
            : party.err.field.guests.min,
        },
      ],
    };
  }

  const now = new Date();
  await sweepExpiredHolds(now);
  const moved = await rehold(draft, {
    now,
    date: draft.date,
    partyWindowId: draft.partyWindowId,
    guests: intent.value.guests,
    honoreeAge: draft.honoreeAge,
    catalog,
    config,
  });

  if (!moved.ok) {
    const state = await rejectionState(moved.error, {
      now,
      date: draft.date,
      partyWindowId: draft.partyWindowId,
      guests: intent.value.guests,
      honoreeAge: draft.honoreeAge,
      catalog,
      config,
      atReview: true,
    });
    return { ...state, values: { guests: String(intent.value.guests) } };
  }

  const packageRecord = packageByCode(catalog, moved.value.packageCode);
  const repriced = packageRecord
    ? computePartyPrice({
        packageRecord,
        guests: moved.value.guests,
        addOns: selectionsOf(moved.value),
        foodChoice: moved.value.foodChoice,
        catalog,
        config,
        depositAppliedCents: config.depositAmountCents,
      })
    : null;

  revalidatePath(`/parties/${draft.id}`, "layout");
  return {
    problems: [],
    notice:
      repriced && repriced.ok
        ? interpolate(party.p6.editGuestsUpdated, {
            guests: moved.value.guests,
            total: formatMoney(repriced.value.totalCents),
          })
        : undefined,
  };
}

export async function reserveParty(_previous: FormState, form: FormData): Promise<FormState> {
  const { config } = await loadVenue();
  const draft = await loadDraft(readText(form, "draftId"));
  if (!draft) {
    return namedFailure(
      interpolate(party.err.server.confirmParty, { phone: config.venuePhone }),
    );
  }

  const acks = {
    house: readChecked(form, "ackHouse"),
    deposit: readChecked(form, "ackDeposit"),
    headcount: readChecked(form, "ackHeadcount"),
  };
  const problems = validateAcknowledgements(acks);
  if (problems.length > 0) return { problems };

  // R-44 / R-45. One checkbox covers all three house rules because `p6.ack.house.body` states
  // all three; both stored flags come from it so the manager's sheet reflects what was agreed.
  await setDraftAcknowledgements(draft, { shoes: acks.house, food: acks.house });
  revalidatePath(`/parties/${draft.id}`, "layout");
  return redirect(`/parties/${draft.id}/deposit`);
}

// ─── P7 — deposit ─────────────────────────────────────────────────────────────────────────

export async function payDeposit(_previous: FormState, form: FormData): Promise<FormState> {
  const nameOnFile = readText(form, "nameOnFile");
  const { catalog, config } = await loadVenue();

  if (nameOnFile.length === 0) {
    return {
      problems: [
        { fieldId: NAME_ON_FILE_FIELD_ID, message: party.err.field.nameOnFile.required },
      ],
    };
  }

  const draft = await loadDraft(readText(form, "draftId"));
  if (!draft) {
    return namedFailure(
      interpolate(party.err.server.confirmParty, { phone: config.venuePhone }),
    );
  }

  const packageRecord = packageByCode(catalog, draft.packageCode);
  if (!packageRecord) return genericFailure(config);

  const now = new Date();
  await sweepExpiredHolds(now);

  const outcome = await recordDeposit(draft, {
    now,
    nameOnFile,
    packageRecord,
    catalog,
    config,
  });

  if (!outcome.ok) {
    const state = await rejectionState(outcome.error, {
      now,
      date: draft.date,
      partyWindowId: draft.partyWindowId,
      guests: draft.guests,
      honoreeAge: draft.honoreeAge,
      catalog,
      config,
    });
    return { ...state, values: { nameOnFile } };
  }

  revalidatePath(`/parties/booking/${outcome.value.reference}`, "layout");
  return redirect(
    `/parties/booking/${outcome.value.reference}${outcome.value.alreadyRecorded ? "" : "?new=1"}`,
  );
}

// ─── P9 — change or cancel ────────────────────────────────────────────────────────────────

export async function submitDateChangeRequest(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { config } = await loadVenue();
  const reference = readText(form, "reference");
  const dates = readText(form, "dates");
  const notes = readText(form, "notes");

  const booking = await loadPartyByReference(reference);
  if (!booking) {
    return namedFailure(
      interpolate(party.err.server.changeRequest, { phone: config.venuePhone }),
    );
  }

  if (dates.length === 0) {
    return {
      problems: [{ fieldId: CHANGE_DATES_FIELD_ID, message: party.p9.request.dates.help }],
      values: { notes },
    };
  }

  await requestNewDate(booking, { dates, notes });
  revalidatePath(`/parties/booking/${booking.reference}`, "layout");
  return redirect(`/parties/booking/${booking.reference}/change?sent=1`);
}

export async function cancelBooking(_previous: FormState, form: FormData): Promise<FormState> {
  const { config } = await loadVenue();
  const booking = await loadPartyByReference(readText(form, "reference"));
  if (!booking) {
    return namedFailure(
      interpolate(party.err.server.changeRequest, { phone: config.venuePhone }),
    );
  }

  const outcome = await cancelParty(booking, { now: new Date(), config });
  if (!outcome.ok) {
    return namedFailure(
      interpolate(party.err.server.changeRequest, { phone: config.venuePhone }),
    );
  }

  revalidatePath(`/parties/booking/${booking.reference}`, "layout");
  return redirect(`/parties/booking/${booking.reference}/change?cancelled=1`);
}

/** The venue-local date "today", resolved server-side. Never the browser's clock (STRATEGY §0). */
export async function venueToday(): Promise<string> {
  const { config } = await loadVenue();
  return localDateOf(new Date(), config.timezone);
}
