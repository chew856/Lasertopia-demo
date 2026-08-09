/**
 * The party draft: a `Booking` row in `HOLD` with real inventory behind it.
 *
 * STRATEGY §0 asks for a server-side draft addressed by an unguessable id, and a soft hold on
 * the room-slots and the arena seats the moment a window is chosen. Both are the same row here:
 * the draft **is** the booking, created at P2 with `status = HOLD` and a `holdExpiresAt`, and
 * promoted to `CONFIRMED` when the deposit is recorded. That is what makes the hold visible to
 * every other customer — an in-memory draft could not hold a room against a second parent.
 *
 * Consequences that are deliberate:
 *
 *  - The hold claims inventory through `commitBookingInventory`, so the R-30 unique index and
 *    the R-12 arena sum guard the hold exactly as they guard a confirmation. Losing that race
 *    is a designed state (`ROOM_DOUBLE_BOOKED`), not an exception.
 *  - A draft carries a *provisional* package until P3, because `PartyBooking.packageId` is
 *    required and the game assignment already assumes the most demanding active package. The
 *    package only moves money; it never moves inventory.
 *  - Everything is re-planned from the engine at every write. Nothing a client posts —
 *    price, room configuration, guest count, window — is trusted; the numbers written to the
 *    row are the numbers the engine just computed.
 */

import { randomInt } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import {
  BookingConflictError,
  commitBookingInventory,
  releaseBookingInventory,
  type GameClaim,
  type RoomSlotClaim,
} from "@/lib/db/booking-repository";
import {
  ZERO,
  cents,
  checkDepositForConfirmation,
  computePartyPrice,
  eligibleAddOns,
  evaluateCancellation,
  giftCardCodeFor,
  ok,
  planPartyBooking,
  reject,
  type AddOnSelection,
  type BookingChannel,
  type Catalog,
  type Cents,
  type DayState,
  type EngineConfig,
  type FoodChoice,
  type GameAssignmentSource,
  type LocalDateString,
  type PackageRecord,
  type PartyBookingPlan,
  type PriceBreakdown,
  type Result,
} from "@/lib/domain";

import { loadDayState } from "./day-state";
import { provisionalPackage } from "./venue";

const CHANNEL: BookingChannel = "ONLINE";

/** Unambiguous alphabet: no O/0, no I/1. A code gets read down a phone line. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newReference(): string {
  let out = "";
  for (let i = 0; i < 8; i += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `PT-${out}`;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Shapes
// ─────────────────────────────────────────────────────────────────────────────────────────

export interface DraftAddOnLine {
  addOnId: string;
  addOnCode: string;
  quantity: number;
  addOnOptionId: string | null;
  unitPriceCents: number;
  lineTotalCents: number;
  taxIncluded: boolean;
}

export interface PartyDraft {
  id: string;
  reference: string;
  status: string;
  date: LocalDateString;
  guests: number;
  honoreeAge: number;
  honoreeName: string;
  partyWindowId: string;
  windowStartsAtUtc: Date;
  windowEndsAtUtc: Date;
  roomConfigurationId: string;
  roomIds: string[];
  packageCode: string;
  packagePriceCentsSnapshot: number;
  extraGuestPriceCentsSnapshot: number;
  foodChoice: FoodChoice;
  includedPizzaCount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  holdExpiresAt: Date | null;
  acknowledgedShoePolicy: boolean;
  acknowledgedFoodPolicy: boolean;
  addOns: DraftAddOnLine[];
  gameTimes: number[];
  totals: {
    preTaxSubtotalCents: number;
    taxCents: number;
    taxIncludedTotalCents: number;
    totalCents: number;
    taxRateMilliPercentSnapshot: number;
  };
  deposit: { amountCents: number; status: string; recordedAt: Date } | null;
}

export function selectionsOf(draft: PartyDraft): AddOnSelection[] {
  return draft.addOns.map((line) => ({
    addOnCode: line.addOnCode,
    quantity: line.quantity,
    ...(line.addOnOptionId ? { addOnOptionId: line.addOnOptionId } : {}),
  }));
}

/** A hold that has run out. The draft survives so P3–P6 can offer to take the window again. */
export function holdExpired(draft: PartyDraft, now: Date): boolean {
  if (draft.status !== "HOLD") return false;
  if (draft.holdExpiresAt === null) return false;
  return draft.holdExpiresAt.getTime() <= now.getTime() || draft.roomIds.length === 0;
}

export function holdSecondsRemaining(draft: PartyDraft, now: Date): number {
  if (draft.holdExpiresAt === null) return 0;
  return Math.max(0, Math.floor((draft.holdExpiresAt.getTime() - now.getTime()) / 1000));
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────────────────────────────────────────────────

const DRAFT_INCLUDE = {
  party: true,
  roomSlots: { select: { roomId: true } },
  games: { include: { gameSlot: { select: { startMinutes: true } } } },
  addOns: { include: { addOn: { select: { code: true } } } },
  deposit: true,
} as const;

type BookingWithParty = Prisma.BookingGetPayload<{ include: typeof DRAFT_INCLUDE }>;

function toDraft(booking: BookingWithParty): PartyDraft | null {
  if (!booking.party) return null;
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    date: booking.date,
    guests: booking.party.guestCount,
    honoreeAge: booking.party.honoreeAge,
    honoreeName: booking.party.honoreeName,
    partyWindowId: booking.party.partyWindowId,
    windowStartsAtUtc: booking.party.windowStartsAtUtc,
    windowEndsAtUtc: booking.party.windowEndsAtUtc,
    roomConfigurationId: booking.party.roomConfigurationId,
    roomIds: booking.roomSlots.map((slot) => slot.roomId),
    packageCode: "",
    packagePriceCentsSnapshot: booking.party.packagePriceCentsSnapshot,
    extraGuestPriceCentsSnapshot: booking.party.extraGuestPriceCentsSnapshot,
    foodChoice: booking.party.foodChoice as FoodChoice,
    includedPizzaCount: booking.party.includedPizzaCount,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    notes: booking.notes ?? "",
    holdExpiresAt: booking.holdExpiresAt,
    acknowledgedShoePolicy: booking.acknowledgedShoePolicy,
    acknowledgedFoodPolicy: booking.acknowledgedFoodPolicy,
    addOns: booking.addOns.map((line) => ({
      addOnId: line.addOnId,
      addOnCode: line.addOn.code,
      quantity: line.quantity,
      addOnOptionId: line.addOnOptionId,
      unitPriceCents: line.unitPriceCentsSnapshot,
      lineTotalCents: line.lineTotalCents,
      taxIncluded: line.taxIncludedSnapshot,
    })),
    gameTimes: [...new Set(booking.games.map((g) => g.gameSlot.startMinutes))].sort(
      (a, b) => a - b,
    ),
    totals: {
      preTaxSubtotalCents: booking.preTaxSubtotalCents,
      taxCents: booking.taxCents,
      taxIncludedTotalCents: booking.taxIncludedTotalCents,
      totalCents: booking.totalCents,
      taxRateMilliPercentSnapshot: booking.taxRateMilliPercentSnapshot,
    },
    deposit: booking.deposit
      ? {
          amountCents: booking.deposit.amountCents,
          status: booking.deposit.status,
          recordedAt: booking.deposit.recordedAt,
        }
      : null,
  };
}

async function withPackageCode(draft: PartyDraft, packageId: string): Promise<PartyDraft> {
  const record = await prisma.package.findUnique({
    where: { id: packageId },
    select: { code: true },
  });
  return { ...draft, packageCode: record?.code ?? "" };
}

export async function loadDraft(draftId: string): Promise<PartyDraft | null> {
  if (!draftId || draftId.length > 64) return null;
  const booking = await prisma.booking.findFirst({
    where: { id: draftId, type: "PARTY" },
    include: DRAFT_INCLUDE,
  });
  if (!booking?.party) return null;
  const draft = toDraft(booking);
  return draft ? withPackageCode(draft, booking.party.packageId) : null;
}

export async function loadPartyByReference(reference: string): Promise<PartyDraft | null> {
  const normalised = reference.trim().toUpperCase();
  if (!/^PT-[A-Z0-9]{4,16}$/.test(normalised)) return null;
  const booking = await prisma.booking.findFirst({
    where: { reference: normalised, type: "PARTY" },
    include: DRAFT_INCLUDE,
  });
  if (!booking?.party) return null;
  const draft = toDraft(booking);
  return draft ? withPackageCode(draft, booking.party.packageId) : null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Hold hygiene
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Release inventory behind lapsed party holds.
 *
 * Necessary, not cosmetic: `BookingRoomSlot` carries a unique index on `(roomId, startsAtUtc)`,
 * so a dead hold's rows would keep blocking a real booking of the same room even though the
 * availability query already ignores them. The `Booking` row is kept — the customer's details
 * survive so `err.holdExpired.party` can honestly say "everything you've filled in is saved".
 */
export async function sweepExpiredHolds(now: Date): Promise<void> {
  try {
    const expired = await prisma.booking.findMany({
      where: {
        type: "PARTY",
        status: "HOLD",
        holdExpiresAt: { lt: now },
        roomSlots: { some: {} },
      },
      select: { id: true },
      take: 50,
    });
    for (const booking of expired) {
      await releaseBookingInventory(prisma, booking.id);
    }
  } catch {
    // Hygiene must never take a booking screen down. A missed sweep costs one stale row; the
    // availability query already excludes the booking, and the next request retries.
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Writing
// ─────────────────────────────────────────────────────────────────────────────────────────

interface PlanInput {
  now: Date;
  date: LocalDateString;
  guests: number;
  honoreeAge: number;
  partyWindowId: string;
  catalog: Catalog;
  config: EngineConfig;
  dayState: DayState;
  packageCode?: string;
  excludeBookingId?: string;
}

function claimsFor(
  plan: PartyBookingPlan,
  date: LocalDateString,
): { roomSlots: RoomSlotClaim[]; games: GameClaim[] } {
  return {
    roomSlots: plan.selection.roomIds.map((roomId) => ({
      roomId,
      date,
      startMinutes: plan.window.startMinutes,
      endMinutes: plan.window.endMinutes,
    })),
    games: plan.arenaGroups.flatMap((group) =>
      group.times.map((time) => ({
        startMinutes: time.startMinutes,
        arenaGroupIndex: group.arenaGroupIndex,
        playerCount: group.playerCount,
        partyGameSetId: time.partyGameSetId,
        assignmentSource: time.source as GameAssignmentSource,
      })),
    ),
  };
}

function conflictToResult(error: unknown): Result<never> {
  if (error instanceof BookingConflictError) {
    return { ok: false, error: error.rejection };
  }
  throw error;
}

/**
 * P2's Select. Plans the window from scratch, writes the booking, and claims the inventory in
 * one transaction. If the claim loses its race the booking row is removed again, so a failed
 * hold leaves nothing behind.
 */
export async function createHeldDraft(input: PlanInput): Promise<Result<PartyDraft>> {
  const plan = planPartyBooking({ ...input, channel: CHANNEL });
  if (!plan.ok) return plan;

  const provisional = provisionalPackage(input.catalog);
  if (!provisional) {
    return reject("CONFIG_INVALID", undefined, {});
  }

  const holdExpiresAt = new Date(
    input.now.getTime() + input.config.bookingHoldMinutes * 60_000,
  );

  let bookingId: string | null = null;
  try {
    const booking = await prisma.booking.create({
      data: {
        reference: newReference(),
        type: "PARTY",
        status: "HOLD",
        date: input.date,
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        createdVia: "ONLINE",
        holdExpiresAt,
        party: {
          create: {
            partyWindowId: plan.value.window.id,
            roomConfigurationId: plan.value.selection.configuration.id,
            packageId: provisional.id,
            guestCount: input.guests,
            honoreeName: "",
            honoreeAge: input.honoreeAge,
            foodChoice: provisional.includesPizza ? "PIZZA" : "NONE",
            packagePriceCentsSnapshot: provisional.basePriceCents,
            extraGuestPriceCentsSnapshot: provisional.extraGuestPriceCents,
            windowStartsAtUtc: plan.value.startsAtUtc,
            windowEndsAtUtc: plan.value.endsAtUtc,
          },
        },
        changeLog: {
          create: { action: "CREATED", actorType: "CUSTOMER" },
        },
      },
      select: { id: true },
    });
    bookingId = booking.id;

    const claims = claimsFor(plan.value, input.date);
    await commitBookingInventory(prisma, {
      bookingId: booking.id,
      roomSlots: claims.roomSlots,
      games: claims.games,
      date: input.date,
      config: input.config,
      now: input.now,
    });
  } catch (error) {
    if (bookingId) {
      await prisma.booking.delete({ where: { id: bookingId } }).catch(() => undefined);
    }
    return conflictToResult(error);
  }

  const draft = await loadDraft(bookingId);
  return draft ? ok(draft) : reject("UNKNOWN_REFERENCE", undefined, {});
}

/**
 * Move an existing draft onto a different window, guest count or date — P6's "edit guest count"
 * and P2's re-pick after an expired hold both land here.
 *
 * The plan is computed *before* anything is released, so a re-fit that fails leaves the
 * existing hold untouched. That is what `err.roomFit.atReview.body` promises when it says
 * "Your hold on {window} is still live".
 */
export async function rehold(
  draft: PartyDraft,
  input: {
    now: Date;
    date: LocalDateString;
    partyWindowId: string;
    guests: number;
    honoreeAge: number;
    catalog: Catalog;
    config: EngineConfig;
  },
): Promise<Result<PartyDraft>> {
  const dayState = await loadDayState(input.date, input.now, input.catalog, input.config);
  const plan = planPartyBooking({
    now: input.now,
    date: input.date,
    guests: input.guests,
    honoreeAge: input.honoreeAge,
    partyWindowId: input.partyWindowId,
    channel: CHANNEL,
    catalog: input.catalog,
    config: input.config,
    dayState,
    excludeBookingId: draft.id,
  });
  if (!plan.ok) return plan;

  const holdExpiresAt = new Date(
    input.now.getTime() + input.config.bookingHoldMinutes * 60_000,
  );

  try {
    const claims = claimsFor(plan.value, input.date);
    // `replaceExisting` does the release inside the claim's own transaction. Releasing first
    // as a separate transaction would leave the rooms unheld in between, so a claim that then
    // lost its race would destroy the hold this function promises to leave untouched.
    await commitBookingInventory(prisma, {
      bookingId: draft.id,
      roomSlots: claims.roomSlots,
      games: claims.games,
      date: input.date,
      config: input.config,
      now: input.now,
      replaceExisting: true,
    });
  } catch (error) {
    return conflictToResult(error);
  }

  await prisma.booking.update({
    where: { id: draft.id },
    data: {
      date: input.date,
      holdExpiresAt,
      party: {
        update: {
          partyWindowId: plan.value.window.id,
          roomConfigurationId: plan.value.selection.configuration.id,
          guestCount: input.guests,
          honoreeAge: input.honoreeAge,
          windowStartsAtUtc: plan.value.startsAtUtc,
          windowEndsAtUtc: plan.value.endsAtUtc,
        },
      },
    },
  });

  const updated = await loadDraft(draft.id);
  return updated ? ok(updated) : reject("UNKNOWN_REFERENCE", undefined, {});
}

/**
 * P3. Switching package can strand an add-on (R-46: the arcade cards are not sold with Around
 * The World). Those lines are removed and their names returned so P4 can *say so* rather than
 * silently dropping them — COPY.md `err.addonNotEligible.body`.
 */
export async function setDraftPackage(
  draft: PartyDraft,
  packageRecord: PackageRecord,
  catalog: Catalog,
): Promise<{ removed: string[] }> {
  const stillEligible = new Set(eligibleAddOns(catalog, packageRecord).map((a) => a.code));
  const removed = draft.addOns.filter((line) => !stillEligible.has(line.addOnCode));

  await prisma.$transaction(async (tx) => {
    if (removed.length > 0) {
      await tx.bookingAddOn.deleteMany({
        where: { bookingId: draft.id, addOnId: { in: removed.map((r) => r.addOnId) } },
      });
    }
    await tx.partyBooking.update({
      where: { bookingId: draft.id },
      data: {
        packageId: packageRecord.id,
        packagePriceCentsSnapshot: packageRecord.basePriceCents,
        extraGuestPriceCentsSnapshot: packageRecord.extraGuestPriceCents,
        foodChoice: packageRecord.includesPizza ? "PIZZA" : "NONE",
      },
    });
  });

  return { removed: removed.map((r) => r.addOnCode) };
}

/**
 * P4. The selection is priced by the engine first; only a selection the engine accepts is
 * written, which is what makes `ADDON_NOT_ELIGIBLE`, `ADDON_EXCLUSIVE_CONFLICT`,
 * `ADDON_QUANTITY_INVALID` and `ADDON_OPTION_INVALID` reachable from a crafted POST as well as
 * from the form.
 */
export async function setDraftExtras(
  draft: PartyDraft,
  input: {
    selections: AddOnSelection[];
    foodChoice: FoodChoice;
    packageRecord: PackageRecord;
    catalog: Catalog;
    config: EngineConfig;
  },
): Promise<Result<PriceBreakdown>> {
  const priced = computePartyPrice({
    packageRecord: input.packageRecord,
    guests: draft.guests,
    addOns: input.selections,
    foodChoice: input.foodChoice,
    catalog: input.catalog,
    config: input.config,
    depositAppliedCents: ZERO,
  });
  if (!priced.ok) return priced;

  const byCode = new Map(input.catalog.addOns.map((a) => [a.code, a]));

  await prisma.$transaction(async (tx) => {
    await tx.bookingAddOn.deleteMany({ where: { bookingId: draft.id } });
    for (const line of priced.value.lines) {
      const addOn = byCode.get(line.code);
      if (!addOn) continue; // package and extra-guest lines are not add-ons
      const selection = input.selections.find((s) => s.addOnCode === line.code);
      await tx.bookingAddOn.create({
        data: {
          bookingId: draft.id,
          addOnId: addOn.id,
          quantity: line.quantity,
          addOnOptionId: selection?.addOnOptionId ?? null,
          unitPriceCentsSnapshot: line.unitPriceCents,
          taxIncludedSnapshot: line.taxIncluded,
          lineTotalCents: line.lineTotalCents,
        },
      });
    }
    await tx.partyBooking.update({
      where: { bookingId: draft.id },
      data: {
        foodChoice: input.foodChoice,
        includedPizzaCount: priced.value.includedPizzaCount,
      },
    });
  });

  return priced;
}

export async function setDraftDetails(
  draft: PartyDraft,
  details: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    honoreeName: string;
    notes: string;
  },
): Promise<void> {
  await prisma.booking.update({
    where: { id: draft.id },
    data: {
      customerName: details.customerName,
      customerEmail: details.customerEmail,
      customerPhone: details.customerPhone,
      notes: details.notes,
      party: { update: { honoreeName: details.honoreeName } },
    },
  });
}

export async function setDraftAcknowledgements(
  draft: PartyDraft,
  acks: { shoes: boolean; food: boolean },
): Promise<void> {
  await prisma.booking.update({
    where: { id: draft.id },
    data: {
      acknowledgedShoePolicy: acks.shoes,
      acknowledgedFoodPolicy: acks.food,
    },
  });
}

export interface DepositOutcome {
  reference: string;
  alreadyRecorded: boolean;
}

/**
 * P7. The simulated checkout (R-53): the deposit is *recorded*, no card data is captured, and
 * the booking is only promoted to `CONFIRMED` once it exists.
 *
 * Everything is re-derived here — the window is re-planned against fresh state and the price is
 * recomputed from settings — because this is the only moment that turns a hold into money owed.
 * A second submit finds the existing `Deposit` and returns the same booking rather than
 * creating a second party.
 */
export async function recordDeposit(
  draft: PartyDraft,
  input: {
    now: Date;
    nameOnFile: string;
    packageRecord: PackageRecord;
    catalog: Catalog;
    config: EngineConfig;
  },
): Promise<Result<DepositOutcome>> {
  if (draft.deposit) {
    return ok({ reference: draft.reference, alreadyRecorded: true });
  }
  if (draft.status !== "HOLD") {
    return reject("UNKNOWN_REFERENCE", undefined, { reference: draft.reference });
  }

  const dayState = await loadDayState(draft.date, input.now, input.catalog, input.config);
  const plan = planPartyBooking({
    now: input.now,
    date: draft.date,
    guests: draft.guests,
    honoreeAge: draft.honoreeAge,
    partyWindowId: draft.partyWindowId,
    packageCode: input.packageRecord.code,
    channel: CHANNEL,
    catalog: input.catalog,
    config: input.config,
    dayState,
    excludeBookingId: draft.id,
  });
  if (!plan.ok) return plan;

  const priced = computePartyPrice({
    packageRecord: input.packageRecord,
    guests: draft.guests,
    addOns: selectionsOf(draft),
    foodChoice: draft.foodChoice,
    catalog: input.catalog,
    config: input.config,
    depositAppliedCents: input.config.depositAmountCents,
  });
  if (!priced.ok) return priced;

  const depositCheck = checkDepositForConfirmation({
    recordedDepositCents: input.config.depositAmountCents,
    config: input.config,
  });
  if (!depositCheck.ok) return depositCheck;

  // Re-claim the inventory the plan just chose, before anything is promoted to CONFIRMED.
  //
  // Not belt-and-braces: `payDeposit` runs `sweepExpiredHolds` immediately before this, so a
  // customer who leaves the deposit screen open past the hold arrives here with their rooms
  // and games already deleted. Re-planning alone would then confirm a party that owns no room
  // — the physical room stays sellable and two parties end up in it (R-29, R-30). Committing
  // here re-takes the rooms, or loses the race honestly with ROOM_DOUBLE_BOOKED.
  try {
    const claims = claimsFor(plan.value, draft.date);
    await commitBookingInventory(prisma, {
      bookingId: draft.id,
      roomSlots: claims.roomSlots,
      games: claims.games,
      date: draft.date,
      config: input.config,
      now: input.now,
      replaceExisting: true,
    });
  } catch (error) {
    return conflictToResult(error);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.deposit.create({
        data: {
          bookingId: draft.id,
          amountCents: input.config.depositAmountCents,
          status: "RECORDED",
          simulatedReference: `SIM-${draft.reference}`,
        },
      });
      await tx.booking.update({
        where: { id: draft.id },
        data: {
          status: "CONFIRMED",
          holdExpiresAt: null,
          customerName: input.nameOnFile,
          // The re-plan above is authoritative for which rooms were just claimed, so the
          // stored configuration has to follow it rather than the one chosen at P2.
          party: { update: { roomConfigurationId: plan.value.selection.configuration.id } },
          preTaxSubtotalCents: priced.value.preTaxSubtotalCents,
          taxCents: priced.value.taxCents,
          taxIncludedTotalCents: priced.value.taxIncludedTotalCents,
          totalCents: priced.value.totalCents,
          taxRateMilliPercentSnapshot: priced.value.taxRateMilliPercentSnapshot,
        },
      });
      await tx.bookingChangeLog.create({
        data: {
          bookingId: draft.id,
          action: "CONFIRMED",
          actorType: "CUSTOMER",
          reason: "Simulated deposit recorded",
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // A concurrent double-submit already recorded it. Idempotent by design.
      return ok({ reference: draft.reference, alreadyRecorded: true });
    }
    return conflictToResult(error);
  }

  return ok({ reference: draft.reference, alreadyRecorded: false });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// P9 — change and cancel
// ─────────────────────────────────────────────────────────────────────────────────────────

export async function cancelParty(
  draft: PartyDraft,
  input: { now: Date; config: EngineConfig },
): Promise<Result<{ giftCardCode: string | null }>> {
  if (draft.status === "CANCELLED") {
    return reject("UNKNOWN_REFERENCE", undefined, { reference: draft.reference });
  }

  const outcome = evaluateCancellation({
    now: input.now,
    eventStartsAtUtc: draft.windowStartsAtUtc,
    depositAmountCents: cents(draft.deposit?.amountCents ?? 0),
    config: input.config,
  });

  // R-61 has one code format and it lives in the engine. A local template here minted a
  // different code for an online cancellation than `cancelBookingAction` mints at the desk,
  // so the front desk could not look up the code the customer was reading out.
  const giftCardCode =
    outcome.depositStatus === "CONVERTED_TO_GIFT_CARD" && draft.deposit
      ? giftCardCodeFor(draft.reference, input.now)
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.bookingRoomSlot.deleteMany({ where: { bookingId: draft.id } });
    await tx.bookingGame.deleteMany({ where: { bookingId: draft.id } });
    await tx.booking.update({
      where: { id: draft.id },
      data: { status: "CANCELLED", holdExpiresAt: null },
    });
    if (draft.deposit) {
      await tx.deposit.update({
        where: { bookingId: draft.id },
        data: { status: outcome.depositStatus, resolvedAt: input.now },
      });
    }
    if (giftCardCode && draft.deposit) {
      await tx.giftCard.create({
        data: {
          code: giftCardCode,
          amountCents: draft.deposit.amountCents,
          issuedFromBookingId: draft.id,
        },
      });
    }
    await tx.bookingChangeLog.create({
      data: {
        bookingId: draft.id,
        action: "CANCELLED",
        actorType: "CUSTOMER",
        reason: outcome.message,
        afterJson: JSON.stringify({
          depositStatus: outcome.depositStatus,
          noticeDays: outcome.notice.noticeDays,
        }),
      },
    });
  });

  return ok({ giftCardCode });
}

/**
 * A date change is a *request*, not a self-serve rebook (STRATEGY §3.2 P9): the room, age and
 * arena fit have to be re-solved and the manager may need to move the other party in the
 * window. The original booking is deliberately left exactly as it is.
 *
 * There is no `ChangeRequest` table in the schema, so the request is appended to the
 * append-only `BookingChangeLog` where the manager backend already reads.
 */
export async function requestNewDate(
  draft: PartyDraft,
  input: { dates: string; notes: string },
): Promise<void> {
  await prisma.bookingChangeLog.create({
    data: {
      bookingId: draft.id,
      action: "RESCHEDULED",
      actorType: "CUSTOMER",
      reason: "Date change requested online — awaiting staff confirmation",
      afterJson: JSON.stringify({
        requestedDates: input.dates.slice(0, 500),
        notes: input.notes.slice(0, 500),
        status: "REQUESTED",
      }),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Frozen money (R-68)
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Rebuild a `PriceBreakdown` from the snapshots on a confirmed booking.
 *
 * R-68 freezes money at confirmation, so a confirmation page must NOT re-price from today's
 * settings — a manager raising the extra-guest rate must not change what an existing customer
 * sees they owe. Every figure below is a stored column.
 */
export function breakdownFromSnapshot(
  draft: PartyDraft,
  packageRecord: PackageRecord,
  addOnNames: Map<string, string>,
): PriceBreakdown {
  const extraGuestCount = Math.max(0, draft.guests - packageRecord.baseGuests);
  const extraGuestsCents = cents(draft.extraGuestPriceCentsSnapshot * extraGuestCount);

  const lines: PriceBreakdown["lines"] = [
    {
      code: packageRecord.code,
      name: packageRecord.name,
      detail: `Includes ${packageRecord.baseGuests} guests`,
      quantity: 1,
      unitPriceCents: cents(draft.packagePriceCentsSnapshot),
      lineTotalCents: cents(draft.packagePriceCentsSnapshot),
      taxIncluded: false,
    },
  ];
  if (extraGuestCount > 0) {
    lines.push({
      code: `${packageRecord.code}_EXTRA_GUEST`,
      name: "Extra guests",
      detail: null,
      quantity: extraGuestCount,
      unitPriceCents: cents(draft.extraGuestPriceCentsSnapshot),
      lineTotalCents: extraGuestsCents,
      taxIncluded: false,
    });
  }
  for (const line of draft.addOns) {
    lines.push({
      code: line.addOnCode,
      name: addOnNames.get(line.addOnCode) ?? line.addOnCode,
      detail: null,
      quantity: line.quantity,
      unitPriceCents: cents(line.unitPriceCents),
      lineTotalCents: cents(line.lineTotalCents),
      taxIncluded: line.taxIncluded,
    });
  }

  const depositApplied: Cents = cents(draft.deposit?.amountCents ?? 0);
  const total = cents(draft.totals.totalCents);

  return {
    lines,
    packageBaseCents: cents(draft.packagePriceCentsSnapshot),
    extraGuestCount,
    extraGuestsCents,
    preTaxSubtotalCents: cents(draft.totals.preTaxSubtotalCents),
    taxCents: cents(draft.totals.taxCents),
    taxIncludedTotalCents: cents(draft.totals.taxIncludedTotalCents),
    totalCents: total,
    depositAppliedCents: depositApplied,
    balanceDueCents: cents(total - depositApplied),
    taxRateMilliPercentSnapshot: draft.totals.taxRateMilliPercentSnapshot,
    includedPizzaCount: draft.includedPizzaCount,
    includedHotDogCount: 0,
    includedCupcakeCount: 0,
    warnings: [],
  };
}
