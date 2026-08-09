"use server";

import { redirect } from "next/navigation";

import { global } from "@/lib/copy";
import {
  BookingConflictError,
  commitBookingInventory,
  releaseBookingInventory,
} from "@/lib/db/booking-repository";
import { prisma } from "@/lib/db/client";
import {
  computePublicGamePrice,
  cutoffPassed,
  generateGameSlots,
  localDateOf,
  planPublicBooking,
  zonedTimeToUtc,
  type EngineConfig,
  type PublicBookingPlan,
} from "@/lib/domain";

import type {
  CancelState,
  ConfirmState,
  DetailsState,
  ExtendState,
  SelectState,
  StartState,
} from "./_lib/action-state";
import { generateBookingCode, normaliseBookingCode } from "./_lib/booking-code";
import { createDraft, getDraft, holdExpired, putDraft, type LaserTagDraft } from "./_lib/draft";
import { buildGamesConfirmationEmail, deliverGamesConfirmation } from "./_lib/email";
import {
  LASER_TAG_HOME,
  confirmation,
  detailsStep,
  reviewStep,
  timeStep,
  timeStepRejected,
} from "./_lib/routes";
import { parseBoundedInteger, parseCalendarDate, validateDetails } from "./_lib/validate";
import { loadDayStates, loadVenue } from "./_lib/venue";

/**
 * The write path for the laser tag flow.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 * ------------------------------------
 * Nothing the client sends is trusted. Not the price, not the seat count, not the slot, not
 * the cutoff. Every action re-derives the answer from the catalog, the database and the
 * server's clock, and `planPublicBooking` runs again at the moment of commit — so a tab left
 * open for two hours, an edited form field, or a race against another customer all end in a
 * designed rejection rather than a booking that should not exist (STRATEGY §0, "two-phase
 * validation").
 *
 * A rejection redirects back to the step that can explain it, carrying the engine's code in
 * the URL. The sentence a customer reads needs alternatives computed from the same engine
 * call that refused them, and computing those on the client would mean shipping the day's
 * whole availability picture to the browser.
 *
 * Each action is a thin wrapper around a `run*` function that returns a decision instead of
 * navigating. `redirect()` signals by throwing, and a `try/catch` around it would swallow the
 * navigation and render a server error over a successful booking; keeping the throw out of
 * the try block entirely is simpler than catching and re-throwing it correctly every time.
 */

/** The extension is worded into COPY.md `btn.extendHold` ("Add 5 minutes"), so it is five. */
const HOLD_EXTENSION_MINUTES = 5;

type Outcome<S> = { redirectTo: string } | { state: S };

async function bounds() {
  const { config } = await loadVenue();
  return { maxPlayers: config.arenaCapacity, maxGames: config.maxGamesPerPublicBooking };
}

function holdUntil(now: Date, config: EngineConfig): number {
  return now.getTime() + config.bookingHoldMinutes * 60_000;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// G1 — players and games
// ─────────────────────────────────────────────────────────────────────────────────────────

async function runStart(formData: FormData): Promise<Outcome<StartState>> {
  try {
    const { config, catalog } = await loadVenue();
    // Bounded, strict integer parsing: the two numbers that decide what the grid is even
    // asked come off a form, and "6.5" or "26" must be a refusal rather than a rounded guess.
    const raw = String(formData.get("players") ?? "");
    const players = parseBoundedInteger(raw, { min: 1, max: config.arenaCapacity });
    const games = parseBoundedInteger(String(formData.get("games") ?? ""), {
      min: 1,
      max: config.maxGamesPerPublicBooking,
    });

    if (players === null) {
      const anyInteger = parseBoundedInteger(raw, { min: 1, max: Number.MAX_SAFE_INTEGER });
      return { state: { error: anyInteger === null ? "PLAYERS_MIN" : "PLAYERS_MAX" } };
    }
    if (games === null || !catalog.gamePricing.some((pricing) => pricing.gameCount === games)) {
      return { state: { error: "GAMES" } };
    }

    const draft = await createDraft(
      { players, games, now: new Date() },
      { maxPlayers: config.arenaCapacity, maxGames: config.maxGamesPerPublicBooking },
    );
    return { redirectTo: timeStep(draft.id) };
  } catch (error) {
    console.error("[laser-tag] startBooking failed", error);
    return { state: { error: "SERVER" } };
  }
}

export async function startBooking(_previous: StartState, formData: FormData): Promise<StartState> {
  const outcome = await runStart(formData);
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome.state;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// G2 — choosing a start
// ─────────────────────────────────────────────────────────────────────────────────────────

async function planFor(args: {
  players: number;
  games: number;
  date: string;
  startMinutes: number;
  now: Date;
}) {
  const { catalog, config } = await loadVenue();
  const dayStates = await loadDayStates({ dates: [args.date], now: args.now, catalog });
  const dayState = dayStates.get(args.date) ?? {
    date: args.date,
    partyBookings: [],
    publicBookings: [],
    blockedSlotMinutes: [],
  };
  return {
    catalog,
    config,
    dayState,
    result: planPublicBooking({
      now: args.now,
      date: args.date,
      players: args.players,
      games: args.games,
      channel: "ONLINE",
      catalog,
      config,
      dayState,
      startMinutes: args.startMinutes,
    }),
  };
}

async function runSelect(formData: FormData): Promise<Outcome<SelectState>> {
  try {
    const now = new Date();
    const limits = await bounds();
    const draftId = String(formData.get("draftId") ?? "");
    const draft = await getDraft(draftId, limits);
    if (!draft) return { redirectTo: LASER_TAG_HOME };

    const date = parseCalendarDate(formData.get("date"));
    const startMinutes = parseBoundedInteger(formData.get("startMinutes"), {
      min: 0,
      max: 24 * 60 - 1,
    });
    const gamesRaw = formData.get("games");
    const games =
      gamesRaw === null
        ? draft.games
        : parseBoundedInteger(gamesRaw, { min: 1, max: limits.maxGames });

    if (games === null) return { state: { rejected: "INVALID_GAME_COUNT" } };
    if (date === null || startMinutes === null) {
      return { state: { rejected: "SLOT_DOES_NOT_EXIST" } };
    }

    const { config, result } = await planFor({
      players: draft.players,
      games,
      date,
      startMinutes,
      now,
    });

    if (!result.ok) {
      return {
        redirectTo: timeStepRejected(draft.id, {
          date,
          rejected: result.error.code,
          start: startMinutes,
        }),
      };
    }

    await putDraft(
      {
        ...draft,
        games,
        date,
        startMinutes,
        heldUntil: holdUntil(now, config),
        // A fresh choice earns a fresh extension: the "once" in COPY.md `hold.extendUsed` is
        // once per held time, not once per browser.
        holdExtended: false,
      },
      limits,
    );

    // COPY.md `err.cutoff.atSubmit.action.primary` promises the move "keeps everything else",
    // so a recovery launched from the review screen has to land back on the review screen —
    // sending an already-filled-in customer back through the details form would break that
    // promise for no reason.
    const filled = validateDetails(draft).ok;
    return {
      redirectTo:
        formData.get("then") === "review" && filled ? reviewStep(draft.id) : detailsStep(draft.id),
    };
  } catch (error) {
    console.error("[laser-tag] selectStart failed", error);
    return { state: { rejected: "CONFIG_INVALID" } };
  }
}

/**
 * Take a start time. Re-validates the whole consecutive block against fresh data before it
 * touches the draft, so a cell that was open at render but has since filled cannot be carried
 * forward into the rest of the flow.
 */
export async function selectStart(_previous: SelectState, formData: FormData): Promise<SelectState> {
  const outcome = await runSelect(formData);
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome.state;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// The hold countdown
// ─────────────────────────────────────────────────────────────────────────────────────────

/** COPY.md `btn.extendHold` — offered once per held time, then `hold.extendUsed` explains. */
export async function extendHold(_previous: ExtendState, formData: FormData): Promise<ExtendState> {
  const limits = await bounds();
  const draft = await getDraft(String(formData.get("draftId") ?? ""), limits);
  if (!draft || draft.heldUntil === null) return { heldUntil: null, spent: true };
  if (draft.holdExtended) return { heldUntil: draft.heldUntil, spent: true };

  const heldUntil = draft.heldUntil + HOLD_EXTENSION_MINUTES * 60_000;
  await putDraft({ ...draft, heldUntil, holdExtended: true }, limits);
  return { heldUntil, spent: true };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// G3 — details
// ─────────────────────────────────────────────────────────────────────────────────────────

async function runSaveDetails(formData: FormData): Promise<Outcome<DetailsState>> {
  try {
    const limits = await bounds();
    const draft = await getDraft(String(formData.get("draftId") ?? ""), limits);
    if (!draft) return { redirectTo: LASER_TAG_HOME };

    const validated = validateDetails({
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    if (!validated.ok) return { state: { errors: validated.errors, serverError: false } };

    await putDraft({ ...draft, ...validated.value }, limits);
    return { redirectTo: reviewStep(draft.id) };
  } catch (error) {
    console.error("[laser-tag] saveDetails failed", error);
    return { state: { errors: {}, serverError: true } };
  }
}

export async function saveDetails(
  _previous: DetailsState,
  formData: FormData,
): Promise<DetailsState> {
  const outcome = await runSaveDetails(formData);
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome.state;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// G4 — confirm
// ─────────────────────────────────────────────────────────────────────────────────────────

async function runConfirm(formData: FormData): Promise<Outcome<ConfirmState>> {
  const draftId = String(formData.get("draftId") ?? "");
  try {
    const now = new Date();
    const limits = await bounds();
    const draft = await getDraft(draftId, limits);
    if (!draft) return { redirectTo: LASER_TAG_HOME };

    // Idempotent on the draft: a double tap, or a retry after a timeout, lands on the booking
    // that already exists. COPY.md `err.server.retrySafe` promises exactly this.
    if (draft.bookingCode) return { redirectTo: confirmation(draft.bookingCode, { isNew: true }) };

    if (formData.get("ack") !== "on") {
      return { state: { ackMissing: true, serverError: false } };
    }
    if (draft.date === null || draft.startMinutes === null) {
      return { redirectTo: timeStep(draft.id) };
    }
    if (holdExpired(draft, now)) return { redirectTo: detailsStep(draft.id) };

    const details = validateDetails({
      name: draft.name,
      phone: draft.phone,
      email: draft.email,
      note: draft.note,
    });
    if (!details.ok) return { redirectTo: detailsStep(draft.id) };

    const { config, catalog, result } = await planFor({
      players: draft.players,
      games: draft.games,
      date: draft.date,
      startMinutes: draft.startMinutes,
      now,
    });

    if (!result.ok) {
      const seats = result.error.detail.seatsRemaining;
      return {
        redirectTo: reviewStep(draft.id, {
          rejected: result.error.code,
          seats: typeof seats === "number" ? seats : undefined,
        }),
      };
    }

    const price = computePublicGamePrice({
      players: draft.players,
      games: draft.games,
      catalog,
      config,
    });
    if (!price.ok) throw new Error(`Pricing failed after planning succeeded: ${price.error.code}`);

    const code = await createGamesBooking({
      draft,
      details: details.value,
      plan: result.value,
      price: price.value,
      config,
      now,
    });

    await putDraft({ ...draft, bookingCode: code }, limits);
    return { redirectTo: confirmation(code, { isNew: true }) };
  } catch (error) {
    if (error instanceof BookingConflictError) {
      console.warn("[laser-tag] confirmBooking lost a race:", error.rejection.code);
      return { redirectTo: reviewStep(draftId, { rejected: error.rejection.code }) };
    }
    console.error("[laser-tag] confirmBooking failed", error);
    return { state: { ackMissing: false, serverError: true } };
  }
}

/**
 * Write the booking.
 *
 * The order is not arbitrary: acknowledge → re-plan against the current second → create the
 * row → claim the arena seats inside a transaction. The seat claim is the only step that can
 * lose a race, and `commitBookingInventory` re-sums the slot inside the same transaction as
 * the insert, so two customers taking the last four spots cannot both win.
 */
export async function confirmBooking(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const outcome = await runConfirm(formData);
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome.state;
}

async function createGamesBooking(args: {
  draft: LaserTagDraft;
  details: { name: string; phone: string; email: string; note: string };
  plan: PublicBookingPlan;
  price: { preTaxSubtotalCents: number; taxCents: number; totalCents: number };
  config: EngineConfig;
  now: Date;
}): Promise<string> {
  const { draft, details, plan, price, config, now } = args;
  const { catalog } = await loadVenue();
  const starts = plan.arenaGroups.flatMap((group) => group.startMinutes);

  // Materialise the slot rows FIRST, with the mode the templates say they have.
  // `commitBookingInventory` creates any missing GameSlot itself, but it stamps a party mode
  // on it — correct for the party flow it was written for, wrong for a public game. Creating
  // them here means it finds them and the schedule board reads the truth.
  const generated = new Map(
    generateGameSlots({ date: plan.date, catalog, config }).map((slot) => [slot.startMinutes, slot]),
  );
  for (const startMinutes of starts) {
    const slot = generated.get(startMinutes);
    await prisma.gameSlot.upsert({
      where: { date_startMinutes: { date: plan.date, startMinutes } },
      create: {
        date: plan.date,
        startMinutes,
        startsAtUtc: zonedTimeToUtc(plan.date, startMinutes, config.timezone),
        mode: slot?.mode ?? "PUBLIC",
      },
      update: {},
    });
  }

  // Eight random characters. A collision is a one-in-a-trillion event that must still not
  // produce a 500 on the last screen of a booking.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateBookingCode();
    const clash = await prisma.booking.findUnique({
      where: { reference: code },
      select: { id: true },
    });
    if (clash) continue;

    const booking = await prisma.booking.create({
      data: {
        reference: code,
        type: "PUBLIC_GAME",
        status: "CONFIRMED",
        date: plan.date,
        customerName: details.name,
        customerEmail: details.email,
        customerPhone: details.phone,
        notes: details.note.length > 0 ? details.note : null,
        createdVia: "ONLINE",
        preTaxSubtotalCents: price.preTaxSubtotalCents,
        taxCents: price.taxCents,
        taxIncludedTotalCents: 0,
        totalCents: price.totalCents,
        taxRateMilliPercentSnapshot: config.taxRateMilliPercent,
        // One checkbox, both policies — COPY.md `g4.ack.body` states both in its label.
        acknowledgedShoePolicy: true,
        acknowledgedFoodPolicy: true,
        publicGame: {
          create: {
            playerCount: draft.players,
            gameCount: draft.games,
            pricePerPersonCentsSnapshot: plan.pricePerPersonCents,
          },
        },
      },
      select: { id: true },
    });

    try {
      await commitBookingInventory(prisma, {
        bookingId: booking.id,
        roomSlots: [],
        games: plan.arenaGroups.flatMap((group) =>
          group.startMinutes.map((startMinutes) => ({
            startMinutes,
            arenaGroupIndex: group.arenaGroupIndex,
            playerCount: group.playerCount,
            partyGameSetId: null,
            // No party game set claimed this time. R-21 reverts a `MANAGER` assignment to
            // PUBLIC on cancellation, which is the right behaviour for a public booking.
            assignmentSource: "MANAGER" as const,
          })),
        ),
        date: plan.date,
        config,
        now,
      });
    } catch (error) {
      // The seats went between planning and committing. Take the row back out: a booking that
      // owns no games would sit on the manager's board as a real one.
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => undefined);
      throw error;
    }

    await prisma.bookingChangeLog.create({
      data: {
        bookingId: booking.id,
        action: "CREATED",
        actorType: "CUSTOMER",
        afterJson: JSON.stringify({
          players: draft.players,
          games: draft.games,
          date: plan.date,
          startMinutes: starts,
        }),
      },
    });

    deliverGamesConfirmation(
      buildGamesConfirmationEmail({
        code,
        name: details.name,
        email: details.email,
        date: plan.date,
        startMinutes: starts,
        players: draft.players,
        // Laser tag is quoted plus tax, so the figure the customer sees is the subtotal.
        totalCents: price.preTaxSubtotalCents,
        address: global.address,
        phone: config.venuePhone,
        cutoffMinutes: config.onlineCutoffMinutes,
        link: confirmation(code),
        currentYear: Number(localDateOf(now, config.timezone).slice(0, 4)),
      }),
    );

    return code;
  }

  throw new Error("Could not allocate a unique booking code after five attempts.");
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// G5 — cancellation
// ─────────────────────────────────────────────────────────────────────────────────────────

async function runCancel(formData: FormData): Promise<Outcome<CancelState>> {
  try {
    const now = new Date();
    const { config } = await loadVenue();
    const code = normaliseBookingCode(String(formData.get("code") ?? ""));

    const booking = await prisma.booking.findUnique({
      where: { reference: code },
      include: { games: { include: { gameSlot: { select: { startsAtUtc: true } } } } },
    });
    if (!booking || booking.type !== "PUBLIC_GAME") return { redirectTo: LASER_TAG_HOME };
    if (booking.status === "CANCELLED") return { redirectTo: confirmation(code, { cancelled: true }) };

    const firstStart = booking.games
      .map((game) => game.gameSlot.startsAtUtc)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (firstStart && cutoffPassed({ now, startsAtUtc: firstStart, channel: "ONLINE", config })) {
      return { state: { tooLate: true, serverError: false } };
    }

    await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    // Deleting the inventory rows is what actually returns the spots to the arena; the audit
    // trail is the change log, not a tombstoned booking game (R-21, R-62).
    await releaseBookingInventory(prisma, booking.id);
    await prisma.bookingChangeLog.create({
      data: { bookingId: booking.id, action: "CANCELLED", actorType: "CUSTOMER" },
    });
    return { redirectTo: confirmation(code, { cancelled: true }) };
  } catch (error) {
    console.error("[laser-tag] cancelBooking failed", error);
    return { state: { tooLate: false, serverError: true } };
  }
}

/**
 * Free cancellation up to the cutoff — STRATEGY §3.1: there is no money at stake, and a
 * released spot is worth more than a punitive rule. The cutoff is re-checked here and not
 * only in the UI, so a stale tab cannot cancel a game that has already gone to walk-ins.
 */
export async function cancelBooking(
  _previous: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const outcome = await runCancel(formData);
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome.state;
}
