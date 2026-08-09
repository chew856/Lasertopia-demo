'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db/client';
import { releaseBookingInventory } from '@/lib/db/booking-repository';
import {
  cents,
  evaluateCancellation,
  generateGameSlots,
  giftCardCodeFor,
  splitArenaGroups,
  zonedTimeToUtc,
  type GameSlotMode,
} from '@/lib/domain';

import { recordChange } from './audit';
import { encodeBlockMeta, parseBlockMeta } from './blocks';
import { loadCatalog, loadConfig } from './catalog';
import { requireStaff, signIn, signOut } from './auth';
import { assessGuestChange, isReasonAcceptable, overrideSummary, type Breach } from './override';
import { parseSettingsSubmission, parseTierSubmission, readCheckbox } from './settings-form';

/**
 * Every staff mutation. One file, one directive, and one rule applied without exception:
 *
 *   **`requireStaff()` is the first line of every exported function.**
 *
 * A Server Action is a public POST endpoint — it is reachable without ever rendering the page
 * that calls it, so the layout guard is not the authorisation boundary, this is. The same
 * applies to re-validation: the UI's job is to make rejection rare, and the action's job is to
 * make it impossible, so nothing below trusts a number the form supplied.
 */

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; needsAcknowledgement?: boolean; breaches?: Breach[] };

const BOARD_PATH = '/manage/schedule';

function refreshBoard(): void {
  revalidatePath(BOARD_PATH);
  revalidatePath('/manage/bookings');
  revalidatePath('/manage/activity');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────────────────────────

export type LoginState = { error: 'invalid' | 'locked' | 'unconfigured' | 'server' | null };

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const outcome = await signIn(email, password);
  if (outcome.ok) {
    redirect(BOARD_PATH);
  }
  return { error: outcome.ok ? null : outcome.reason };
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect('/manage/login?reason=signedOut');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Blocking — STRATEGY §4.3
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Blocking removes a game from sale. It never cancels a booking, so a slot that already has
 * players in it requires `acknowledge` — re-checked here, not merely in the dialog.
 */
export async function blockSlotsAction(args: {
  date: string;
  startMinutes: number[];
  reason: string;
  acknowledge?: boolean;
}): Promise<ActionResult> {
  const session = await requireStaff();
  if (args.startMinutes.length === 0) {
    return { ok: false, message: 'Pick at least one game time to block.' };
  }

  const [config, catalog] = await Promise.all([loadConfig(), loadCatalog()]);
  const generated = generateGameSlots({ date: args.date, catalog, config });
  const modeByMinute = new Map<number, GameSlotMode>(generated.map((s) => [s.startMinutes, s.mode]));

  const unknown = args.startMinutes.filter((minutes) => !modeByMinute.has(minutes));
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `There is no game at ${unknown.join(', ')} on ${args.date}, so it can't be blocked. Reload the board — the day's hours may have changed.`,
    };
  }

  const committed = await prisma.bookingGame.findMany({
    where: {
      gameSlot: { date: args.date, startMinutes: { in: args.startMinutes } },
      booking: { status: { in: ['HOLD', 'CONFIRMED'] } },
    },
    select: { bookingId: true, playerCount: true, gameSlot: { select: { startMinutes: true } } },
  });

  if (committed.length > 0 && args.acknowledge !== true) {
    const players = committed.reduce((total, row) => total + row.playerCount, 0);
    const bookings = new Set(committed.map((row) => row.bookingId)).size;
    return {
      ok: false,
      needsAcknowledgement: true,
      message: `${bookings} bookings (${players} players) are already in these games. Blocking stops new bookings; it does not cancel them.`,
    };
  }

  const at = new Date().toISOString();
  for (const startMinutes of args.startMinutes) {
    const existing = await prisma.gameSlot.findUnique({
      where: { date_startMinutes: { date: args.date, startMinutes } },
      select: { id: true, mode: true, blockedReason: true },
    });
    if (existing?.mode === 'BLOCKED') continue;

    const previousMode = (existing?.mode as GameSlotMode | undefined) ?? modeByMinute.get(startMinutes) ?? 'PUBLIC';
    const blockedReason = encodeBlockMeta({
      reason: args.reason.trim(),
      byId: session.sub,
      byName: session.name,
      atIso: at,
      previousMode,
    });

    if (existing) {
      await prisma.gameSlot.update({
        where: { id: existing.id },
        data: { mode: 'BLOCKED', blockedReason },
      });
    } else {
      await prisma.gameSlot.create({
        data: {
          date: args.date,
          startMinutes,
          startsAtUtc: zonedTimeToUtc(args.date, startMinutes, config.timezone),
          mode: 'BLOCKED',
          blockedReason,
        },
      });
    }
  }

  refreshBoard();
  return { ok: true };
}

export async function unblockSlotsAction(args: {
  date: string;
  startMinutes: number[];
}): Promise<ActionResult> {
  await requireStaff();
  const [config, catalog] = await Promise.all([loadConfig(), loadCatalog()]);
  const generated = generateGameSlots({ date: args.date, catalog, config });
  const modeByMinute = new Map<number, GameSlotMode>(generated.map((s) => [s.startMinutes, s.mode]));

  for (const startMinutes of args.startMinutes) {
    const existing = await prisma.gameSlot.findUnique({
      where: { date_startMinutes: { date: args.date, startMinutes } },
      select: { id: true, mode: true, blockedReason: true },
    });
    if (!existing || existing.mode !== 'BLOCKED') continue;

    // Restore what the slot was, not what it looks like it should be: guessing PUBLIC here
    // would release a reserved party time to walk-ins as a side effect of an undo.
    const meta = parseBlockMeta(existing.blockedReason);
    const restored = meta.previousMode ?? modeByMinute.get(startMinutes) ?? 'PUBLIC';
    await prisma.gameSlot.update({
      where: { id: existing.id },
      data: { mode: restored, blockedReason: null },
    });
  }

  refreshBoard();
  return { ok: true };
}

/** COPY.md `mg.slot.blocked.noReason` — "No reason given. Add one". Typed after the fact. */
export async function setBlockReasonAction(args: {
  date: string;
  startMinutes: number;
  reason: string;
}): Promise<ActionResult> {
  const session = await requireStaff();
  const existing = await prisma.gameSlot.findUnique({
    where: { date_startMinutes: { date: args.date, startMinutes: args.startMinutes } },
    select: { id: true, mode: true, blockedReason: true },
  });
  if (!existing || existing.mode !== 'BLOCKED') {
    return { ok: false, message: 'That game is not blocked any more. Reload the board.' };
  }
  const meta = parseBlockMeta(existing.blockedReason);
  await prisma.gameSlot.update({
    where: { id: existing.id },
    data: {
      blockedReason: encodeBlockMeta({
        reason: args.reason.trim(),
        byId: meta.byId ?? session.sub,
        byName: meta.byName ?? session.name,
        atIso: meta.atIso ?? new Date().toISOString(),
        previousMode: meta.previousMode ?? 'PUBLIC',
      }),
    },
  });
  refreshBoard();
  return { ok: true };
}

/** R-23c — force a reserved party game time back to the public. */
export async function releaseSlotAction(args: {
  date: string;
  startMinutes: number;
}): Promise<ActionResult> {
  await requireStaff();
  const config = await loadConfig();
  await prisma.gameSlot.upsert({
    where: { date_startMinutes: { date: args.date, startMinutes: args.startMinutes } },
    create: {
      date: args.date,
      startMinutes: args.startMinutes,
      startsAtUtc: zonedTimeToUtc(args.date, args.startMinutes, config.timezone),
      mode: 'PUBLIC',
      releasedToPublicAt: new Date(),
    },
    update: { mode: 'PUBLIC', releasedToPublicAt: new Date(), blockedReason: null },
  });
  refreshBoard();
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Booking actions
// ─────────────────────────────────────────────────────────────────────────────────────────

export async function checkInAction(args: {
  bookingId: string;
  undo?: boolean;
}): Promise<ActionResult> {
  const session = await requireStaff();
  const booking = await prisma.booking.findUnique({
    where: { id: args.bookingId },
    select: { id: true },
  });
  if (!booking) return { ok: false, message: 'That booking no longer exists. Reload the board.' };

  await recordChange(prisma, {
    bookingId: booking.id,
    action: args.undo === true ? 'CHECK_IN_UNDONE' : 'CHECKED_IN',
    session,
  });
  refreshBoard();
  return { ok: true };
}

export async function recordDepositAction(args: {
  bookingId: string;
  method: string;
}): Promise<ActionResult> {
  const session = await requireStaff();
  const config = await loadConfig();
  const booking = await prisma.booking.findUnique({
    where: { id: args.bookingId },
    select: { id: true, reference: true, deposit: { select: { id: true } } },
  });
  if (!booking) return { ok: false, message: 'That booking no longer exists.' };

  const amountCents = config.depositAmountCents;
  // Never a card number: R-53 says no card data is ever stored, so what is recorded is the
  // fact of payment, the method and who took it.
  const simulatedReference = `DESK-${args.method.toUpperCase()}-${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    if (booking.deposit) {
      await tx.deposit.update({
        where: { id: booking.deposit.id },
        data: { status: 'RECORDED', amountCents, simulatedReference, recordedAt: new Date() },
      });
    } else {
      await tx.deposit.create({
        data: { bookingId: booking.id, amountCents, status: 'RECORDED', simulatedReference },
      });
    }
    await recordChange(tx, {
      bookingId: booking.id,
      action: 'DEPOSIT_RESOLVED',
      session,
      reason: args.method,
      after: { amountCents, method: args.method },
    });
  });

  refreshBoard();
  revalidatePath(`/manage/bookings/${booking.id}`);
  return { ok: true };
}

export async function saveNotesAction(args: {
  bookingId: string;
  notes: string;
}): Promise<ActionResult> {
  const session = await requireStaff();
  const booking = await prisma.booking.findUnique({
    where: { id: args.bookingId },
    select: { id: true, notes: true },
  });
  if (!booking) return { ok: false, message: 'That booking no longer exists.' };

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { notes: args.notes.trim() || null } });
    await recordChange(tx, {
      bookingId: booking.id,
      action: 'NOTES_CHANGED',
      session,
      before: { notes: booking.notes },
      after: { notes: args.notes.trim() },
    });
  });

  revalidatePath(`/manage/bookings/${booking.id}`);
  refreshBoard();
  return { ok: true };
}

/**
 * Change a party's guest count — STRATEGY §4.2 ("re-runs fit; if it no longer fits, offers
 * rooms to add or an override") and §4.4.
 *
 * The fit is re-computed from the database every time. `overrideReason` is required before
 * anything over a limit will save, and the arena breach additionally requires `confirmed`.
 */
export async function changeGuestCountAction(args: {
  bookingId: string;
  guests: number;
  overrideReason?: string;
  confirmed?: boolean;
}): Promise<ActionResult> {
  const session = await requireStaff();
  const config = await loadConfig();

  const booking = await prisma.booking.findUnique({
    where: { id: args.bookingId },
    include: {
      party: { include: { roomConfiguration: true, partyWindow: true } },
      games: { include: { gameSlot: true } },
    },
  });
  if (!booking?.party) {
    return { ok: false, message: 'Only a party booking has a guest count.' };
  }
  if (!Number.isInteger(args.guests) || args.guests < config.minPartyGuests) {
    return {
      ok: false,
      message: `A party needs at least ${config.minPartyGuests} guests. Cancel it instead if nobody is coming.`,
    };
  }

  const startMinutes = booking.games.map((game) => game.gameSlot.startMinutes);
  const others = await prisma.bookingGame.findMany({
    where: {
      gameSlot: { date: booking.date, startMinutes: { in: startMinutes } },
      bookingId: { not: booking.id },
      booking: { status: { in: ['HOLD', 'CONFIRMED'] } },
    },
    select: {
      playerCount: true,
      gameSlot: { select: { startMinutes: true } },
      booking: { select: { customerName: true } },
    },
  });

  // The group split can change with the head count (28 guests is two arena groups, 24 is one).
  // A change that alters the number of groups changes the game assignment itself, which is a
  // re-plan rather than an edit, so it is refused with a specific instruction.
  const currentGroups = new Set(booking.games.map((game) => game.arenaGroupIndex)).size;
  const newGroupSizes = splitArenaGroups(args.guests, config);
  if (newGroupSizes.length !== currentGroups) {
    return {
      ok: false,
      message: `${args.guests} guests would play in ${newGroupSizes.length} arena groups instead of ${currentGroups}, which changes the game times. Move the party to a new window instead.`,
    };
  }

  const assessment = assessGuestChange({
    guests: args.guests,
    roomCapacity: booking.party.roomConfiguration.capacity,
    arenaCapacity: config.arenaCapacity,
    slots: booking.games.map((game) => {
      const sameSlot = others.filter((row) => row.gameSlot.startMinutes === game.gameSlot.startMinutes);
      return {
        startMinutes: game.gameSlot.startMinutes,
        otherPlayers: sameSlot.reduce((total, row) => total + row.playerCount, 0),
        otherNames: sameSlot.map((row) => row.booking.customerName),
        groupPlayers: newGroupSizes[Math.min(game.arenaGroupIndex, newGroupSizes.length - 1)],
      };
    }),
  });

  if (!assessment.fits) {
    if (!args.overrideReason || !isReasonAcceptable(args.overrideReason)) {
      return {
        ok: false,
        message: 'A reason is required before a limit can be overridden.',
        breaches: assessment.breaches,
      };
    }
    if (assessment.requiresSecondConfirmation && args.confirmed !== true) {
      return {
        ok: false,
        message: 'The arena cap is a safety limit. Confirm explicitly before going over it.',
        breaches: assessment.breaches,
      };
    }
  }

  const summary = assessment.fits ? null : overrideSummary(assessment.breaches, args.overrideReason ?? '');
  const previous = booking.party.guestCount;

  await prisma.$transaction(async (tx) => {
    await tx.partyBooking.update({
      where: { bookingId: booking.id },
      data: { guestCount: args.guests },
    });
    for (const game of booking.games) {
      await tx.bookingGame.update({
        where: { id: game.id },
        data: {
          playerCount: newGroupSizes[Math.min(game.arenaGroupIndex, newGroupSizes.length - 1)],
        },
      });
    }
    if (summary) {
      await tx.booking.update({ where: { id: booking.id }, data: { overrideReason: summary } });
      await recordChange(tx, {
        bookingId: booking.id,
        action: 'OVERRIDDEN',
        session,
        reason: summary,
        before: { guestCount: previous },
        after: { guestCount: args.guests },
      });
    }
    await recordChange(tx, {
      bookingId: booking.id,
      action: 'GUESTS_CHANGED',
      session,
      reason: args.overrideReason ?? null,
      before: { guestCount: previous },
      after: { guestCount: args.guests },
    });
  });

  refreshBoard();
  revalidatePath(`/manage/bookings/${booking.id}`);
  return { ok: true };
}

/**
 * Cancel — STRATEGY §4.6: "cancel restates the deposit consequence in dollars before it will
 * proceed". The consequence is recomputed here from `evaluateCancellation`, so a stale page
 * cannot talk the server into the wrong outcome.
 */
export async function cancelBookingAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const bookingId = String(formData.get('bookingId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const giftCardAnyway = formData.get('giftCardAnyway') !== null;

  if (!isReasonAcceptable(reason)) {
    redirect(`/manage/bookings/${bookingId}?error=reason`);
  }

  const config = await loadConfig();
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { party: true, deposit: true, games: { include: { gameSlot: true } } },
  });
  if (!booking) redirect('/manage/bookings?error=missing');
  if (booking.status === 'CANCELLED') redirect(`/manage/bookings/${bookingId}?saved=1`);

  const startsAtUtc =
    booking.party?.windowStartsAtUtc ??
    booking.games.map((game) => game.gameSlot.startsAtUtc).sort((a, b) => a.getTime() - b.getTime())[0] ??
    new Date();

  const outcome = evaluateCancellation({
    now: new Date(),
    eventStartsAtUtc: startsAtUtc,
    depositAmountCents: cents(booking.deposit?.amountCents ?? 0),
    config,
  });

  // Inventory is released first and outside the transaction below: `releaseBookingInventory`
  // opens its own transaction, and Prisma does not nest them.
  await releaseBookingInventory(prisma, booking.id);

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });

    if (booking.deposit && booking.deposit.status === 'RECORDED') {
      const issueGiftCard = outcome.depositStatus === 'CONVERTED_TO_GIFT_CARD' || giftCardAnyway;
      await tx.deposit.update({
        where: { id: booking.deposit.id },
        data: {
          status: issueGiftCard ? 'CONVERTED_TO_GIFT_CARD' : 'FORFEITED',
          resolvedAt: new Date(),
        },
      });
      if (issueGiftCard) {
        const issuedAt = new Date();
        await tx.giftCard.create({
          data: {
            code: giftCardCodeFor(booking.reference, issuedAt),
            amountCents: booking.deposit.amountCents,
            issuedFromBookingId: booking.id,
            issuedAt,
          },
        });
      }
    }

    await recordChange(tx, {
      bookingId: booking.id,
      action: 'CANCELLED',
      session,
      reason,
      after: {
        noticeDays: outcome.notice.noticeDays,
        depositOutcome: outcome.depositStatus,
        giftCardAnyway,
      },
    });
  });

  refreshBoard();
  revalidatePath(`/manage/bookings/${booking.id}`);
  redirect(`/manage/bookings/${booking.id}?saved=1`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// The buried tier — rooms, windows, closures, settings
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Stamps the actor onto every registry row it writes, which is what `/manage/activity` reads. */
export async function saveSettingsAction(formData: FormData): Promise<void> {
  const session = await requireStaff();

  const stored = await prisma.setting.findMany({
    select: { key: true, value: true, valueType: true },
  });
  const submitted: Record<string, string> = {};
  for (const row of stored) {
    const raw = formData.get(row.key);
    if (raw !== null) submitted[row.key] = String(raw);
  }
  // An unchecked checkbox sends nothing at all, so every boolean field on the page also emits
  // a hidden `bool` marker naming itself. Without it, "off" is indistinguishable from "this
  // key wasn't on the page", and a partial save would silently flip every boolean to false.
  for (const key of formData.getAll('bool').map(String)) {
    submitted[key] = readCheckbox(formData, key);
  }

  const { rows, errors } = parseSettingsSubmission(submitted, stored);
  if (errors.length > 0) {
    redirect(`/manage/settings?error=${encodeURIComponent(errors[0].message)}`);
  }

  const changed = rows.filter((row) => {
    const before = stored.find((s) => s.key === row.key);
    return before === undefined || before.value !== row.value;
  });

  for (const row of changed) {
    await prisma.setting.update({
      where: { key: row.key },
      data: { value: row.value, updatedByUserId: session.sub },
    });
  }

  revalidatePath('/manage/settings');
  refreshBoard();
  redirect('/manage/settings?saved=1');
}

export async function savePizzaTiersAction(formData: FormData): Promise<void> {
  await requireStaff();
  const ids = formData.getAll('tierIndex').map(String);
  const rows = ids.map((index) => ({
    minGuests: String(formData.get(`tier:${index}:min`) ?? ''),
    maxGuests: String(formData.get(`tier:${index}:max`) ?? ''),
    pizzaCount: String(formData.get(`tier:${index}:count`) ?? ''),
  }));

  const { tiers, errors } = parseTierSubmission(rows);
  if (errors.length > 0) {
    redirect(`/manage/settings?error=${encodeURIComponent(errors[0])}#pizza-tiers`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.pizzaTier.deleteMany({});
    for (const tier of tiers) {
      await tx.pizzaTier.create({ data: tier });
    }
  });

  revalidatePath('/manage/settings');
  redirect('/manage/settings?saved=1#pizza-tiers');
}

export async function saveRoomsAction(formData: FormData): Promise<void> {
  await requireStaff();
  const ids = formData.getAll('roomId').map(String);

  for (const id of ids) {
    const name = String(formData.get(`room:${id}:name`) ?? '').trim();
    const capacity = Number.parseInt(String(formData.get(`room:${id}:capacity`) ?? ''), 10);
    const isActive = formData.get(`room:${id}:active`) !== null;
    if (name === '' || !Number.isInteger(capacity) || capacity < 0) {
      redirect(`/manage/rooms?error=${encodeURIComponent(`${id} needs a name and a whole-number capacity.`)}`);
    }
    await prisma.room.update({ where: { id }, data: { name, capacity, isActive } });
  }

  revalidatePath('/manage/rooms');
  refreshBoard();
  redirect('/manage/rooms?saved=1');
}

export async function addRoomAction(formData: FormData): Promise<void> {
  await requireStaff();
  const name = String(formData.get('name') ?? '').trim();
  const capacity = Number.parseInt(String(formData.get('capacity') ?? ''), 10);
  if (name === '' || !Number.isInteger(capacity) || capacity <= 0) {
    redirect('/manage/rooms?error=' + encodeURIComponent('A new room needs a name and a capacity.'));
  }

  const count = await prisma.room.count();
  await prisma.room.create({
    data: {
      // Room ids are natural keys in the seed (`RM1`…), so a new one follows the same shape
      // rather than a cuid that reads as noise in every export and every log line.
      id: `RM${count + 1}-${Date.now().toString(36).toUpperCase()}`,
      name,
      capacity,
      isActive: true,
      sortOrder: count + 1,
    },
  });

  revalidatePath('/manage/rooms');
  redirect('/manage/rooms?saved=1');
}

export async function saveRoomConfigurationsAction(formData: FormData): Promise<void> {
  await requireStaff();
  const ids = formData.getAll('configId').map(String);
  for (const id of ids) {
    const capacity = Number.parseInt(String(formData.get(`config:${id}:capacity`) ?? ''), 10);
    const isActive = formData.get(`config:${id}:active`) !== null;
    if (!Number.isInteger(capacity) || capacity <= 0) {
      redirect(`/manage/rooms?error=${encodeURIComponent(`${id} needs a whole-number capacity.`)}#combinations`);
    }
    await prisma.roomConfiguration.update({ where: { id }, data: { capacity, isActive } });
  }
  revalidatePath('/manage/rooms');
  refreshBoard();
  redirect('/manage/rooms?saved=1#combinations');
}

export async function saveOperatingHoursAction(formData: FormData): Promise<void> {
  await requireStaff();
  const days = formData.getAll('dayOfWeek').map((value) => Number.parseInt(String(value), 10));

  for (const day of days) {
    const opens = Number.parseInt(String(formData.get(`hours:${day}:opens`) ?? ''), 10);
    const closes = Number.parseInt(String(formData.get(`hours:${day}:closes`) ?? ''), 10);
    const first = Number.parseInt(String(formData.get(`hours:${day}:first`) ?? ''), 10);
    const last = Number.parseInt(String(formData.get(`hours:${day}:last`) ?? ''), 10);
    const isOpen = formData.get(`hours:${day}:open`) !== null;

    if (![opens, closes, first, last].every(Number.isInteger) || closes <= opens || last < first) {
      redirect(`/manage/slots?error=${encodeURIComponent('Opening hours must be times, and close must be after open.')}#hours`);
    }
    await prisma.operatingHours.update({
      where: { dayOfWeek: day },
      data: {
        opensMinutes: opens,
        closesMinutes: closes,
        firstPublicGameMinutes: first,
        lastPublicGameMinutes: last,
        isOpen,
      },
    });
  }

  revalidatePath('/manage/slots');
  refreshBoard();
  redirect('/manage/slots?saved=1#hours');
}

/**
 * Party windows and their reserved game times — brief gap #3, and the single most important
 * screen for making the 36 open questions data edits instead of rebuilds.
 *
 * Times arrive as one comma-separated field per set rather than as a row per time: a manager
 * editing "17:15, 17:45" wants to retype a line, not add and delete rows.
 */
export async function savePartyWindowsAction(formData: FormData): Promise<void> {
  await requireStaff();
  const windowIds = formData.getAll('windowId').map(String);

  const windows = await prisma.partyWindow.findMany({
    where: { id: { in: windowIds } },
    include: { gameSets: { include: { times: true } } },
  });

  for (const window of windows) {
    const start = Number.parseInt(String(formData.get(`window:${window.id}:start`) ?? ''), 10);
    const end = Number.parseInt(String(formData.get(`window:${window.id}:end`) ?? ''), 10);
    const isActive = formData.get(`window:${window.id}:active`) !== null;

    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) {
      redirect(`/manage/slots?error=${encodeURIComponent(`${window.label} must end after it starts.`)}`);
    }

    await prisma.partyWindow.update({
      where: { id: window.id },
      data: { startMinutes: start, endMinutes: end, isActive },
    });

    for (const set of window.gameSets) {
      const raw = String(formData.get(`set:${set.id}:times`) ?? '').trim();
      const minutes = raw === '' ? [] : raw.split(',').map((part) => parseTimeField(part));
      if (minutes.some((value) => value === null)) {
        redirect(`/manage/slots?error=${encodeURIComponent(`Game times for ${window.label} must be 24-hour times like 17:15.`)}`);
      }
      const parsed = [...new Set(minutes as number[])].sort((a, b) => a - b);
      const outside = parsed.filter((value) => value < start || value >= end);
      if (outside.length > 0) {
        redirect(
          `/manage/slots?error=${encodeURIComponent(`A game time falls outside ${window.label}. A party can't play before it arrives or after it leaves.`)}`,
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.partyGameSetTime.deleteMany({ where: { partyGameSetId: set.id } });
        for (const [index, startMinutes] of parsed.entries()) {
          await tx.partyGameSetTime.create({
            data: { partyGameSetId: set.id, sortOrder: index, startMinutes, source: 'MANAGER' },
          });
        }
      });
    }

    // Which room combinations this window sells (`WindowOffering.isOffered`, OQ-10 / OQ-14).
    const offerings = await prisma.windowOffering.findMany({ where: { partyWindowId: window.id } });
    for (const offering of offerings) {
      const offered = formData.get(`offering:${offering.id}`) !== null;
      if (offered !== offering.isOffered) {
        await prisma.windowOffering.update({ where: { id: offering.id }, data: { isOffered: offered } });
      }
    }
  }

  revalidatePath('/manage/slots');
  refreshBoard();
  redirect('/manage/slots?saved=1');
}

/** `17:15` → 1035. Returns null rather than throwing so the caller can name the field. */
function parseTimeField(text: string): number | null {
  const match = /^\s*(\d{1,2}):([0-5]\d)\s*$/.exec(text);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  if (hours > 23) return null;
  return hours * 60 + Number.parseInt(match[2], 10);
}

export async function saveClosureAction(formData: FormData): Promise<void> {
  await requireStaff();
  const date = String(formData.get('date') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const blocksPublic = formData.get('blocksPublic') !== null;
  const blocksParties = formData.get('blocksParties') !== null;
  const acknowledged = formData.get('acknowledge') !== null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect('/manage/closures?error=' + encodeURIComponent('A closure needs a date like 2026-12-25.'));
  }
  if (!blocksPublic && !blocksParties) {
    redirect(
      '/manage/closures?error=' +
        encodeURIComponent('A closure has to stop something — pick laser tag, parties, or both.'),
    );
  }

  const stranded = await prisma.booking.count({
    where: { date, status: { in: ['HOLD', 'CONFIRMED'] } },
  });
  if (stranded > 0 && !acknowledged) {
    redirect(`/manage/closures?stranded=${stranded}&date=${date}`);
  }

  await prisma.closure.upsert({
    where: { date },
    create: { date, reason: reason || 'Closed', blocksPublic, blocksParties },
    update: { reason: reason || 'Closed', blocksPublic, blocksParties },
  });

  revalidatePath('/manage/closures');
  refreshBoard();
  redirect('/manage/closures?saved=1');
}

export async function deleteClosureAction(formData: FormData): Promise<void> {
  await requireStaff();
  const date = String(formData.get('date') ?? '');
  await prisma.closure.deleteMany({ where: { date } });
  revalidatePath('/manage/closures');
  refreshBoard();
  redirect('/manage/closures?saved=1');
}

export async function savePackagesAction(formData: FormData): Promise<void> {
  await requireStaff();
  const ids = formData.getAll('packageId').map(String);

  for (const id of ids) {
    const base = parseMoneyField(String(formData.get(`package:${id}:base`) ?? ''));
    const extra = parseMoneyField(String(formData.get(`package:${id}:extra`) ?? ''));
    const included = Number.parseInt(String(formData.get(`package:${id}:included`) ?? ''), 10);
    const roomMinutes = Number.parseInt(String(formData.get(`package:${id}:roomMinutes`) ?? ''), 10);
    const games = Number.parseInt(String(formData.get(`package:${id}:games`) ?? ''), 10);
    const includesPizza = formData.get(`package:${id}:pizza`) !== null;

    if (base === null || extra === null || !Number.isInteger(included) || !Number.isInteger(roomMinutes) || !Number.isInteger(games)) {
      redirect(`/manage/settings?error=${encodeURIComponent('Package prices must be amounts like 259.50, and the counts whole numbers.')}#packages`);
    }
    await prisma.package.update({
      where: { id },
      data: {
        basePriceCents: base,
        extraGuestPriceCents: extra,
        baseGuests: included,
        roomMinutes,
        gamesIncluded: games,
        includesPizza,
      },
    });
  }

  revalidatePath('/manage/settings');
  redirect('/manage/settings?saved=1#packages');
}

export async function saveGamePricingAction(formData: FormData): Promise<void> {
  await requireStaff();
  const counts = formData.getAll('gameCount').map((value) => Number.parseInt(String(value), 10));
  for (const gameCount of counts) {
    const price = parseMoneyField(String(formData.get(`price:${gameCount}`) ?? ''));
    if (price === null) {
      redirect(`/manage/settings?error=${encodeURIComponent('Laser tag prices must be amounts like 8.49.')}#game-prices`);
    }
    await prisma.gameSlotPricing.update({
      where: { gameCount },
      data: { pricePerPersonCents: price },
    });
  }
  revalidatePath('/manage/settings');
  redirect('/manage/settings?saved=1#game-prices');
}

export async function saveAddOnsAction(formData: FormData): Promise<void> {
  await requireStaff();
  const ids = formData.getAll('addOnId').map(String);
  for (const id of ids) {
    const price = parseMoneyField(String(formData.get(`addon:${id}:price`) ?? ''));
    const taxIncluded = formData.get(`addon:${id}:taxIncluded`) !== null;
    const isActive = formData.get(`addon:${id}:active`) !== null;
    if (price === null) {
      redirect(`/manage/settings?error=${encodeURIComponent('Add-on prices must be amounts like 3.95.')}#addons`);
    }
    await prisma.addOn.update({ where: { id }, data: { priceCents: price, taxIncluded, isActive } });
  }
  revalidatePath('/manage/settings');
  redirect('/manage/settings?saved=1#addons');
}

/** `259.50` → 25950. Null on anything else, so the caller can name the field it came from. */
function parseMoneyField(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, '0'), 10);
}
