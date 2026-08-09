/**
 * The laser tag draft — the customer's in-progress booking, addressed by an unguessable
 * `draftId` in the URL (STRATEGY §0, "Draft + soft hold").
 *
 * WHERE IT LIVES, AND WHY THAT IS SAFE
 * ------------------------------------
 * The draft is stored in an httpOnly cookie, not a table: `prisma/schema.prisma` has no draft
 * model and the schema is not this surface's to change. That is only acceptable because of a
 * rule the whole flow is built on — **nothing derived is ever read back from the draft.** The
 * draft carries the customer's *inputs* (how many players, which games, which start, their
 * name); price, availability, seat counts and the cutoff are recomputed server-side from the
 * catalog and the clock on every render and again at submit. A customer who edits the cookie
 * can change what they are asking for; they cannot change the answer, because the answer is
 * never in the cookie.
 *
 * Cookies can only be written from a server action or a route handler, never from a server
 * component. Every mutation below therefore runs inside `../actions.ts`; pages read only.
 *
 * WHAT THIS IS NOT
 * ----------------
 * `heldUntil` is a countdown, not a reservation: it does not take the seats out of the
 * arena. STRATEGY §0 asks for a hold that occupies inventory for 7 minutes, which needs a
 * `HOLD` booking row and a sweeper to release it — both outside this surface's files. The
 * flow behaves correctly without it (every screen re-validates, and the `HOLD_EXPIRED` state
 * is real and reachable); what it loses is protection against losing the slot mid-checkout on
 * a busy evening. That gap is reported rather than papered over.
 */

import { cookies } from "next/headers";

import { parseBoundedInteger, parseCalendarDate } from "./validate";

/** The most recent drafts a browser keeps. Enough for the back button and a second tab. */
const MAX_DRAFTS = 3;
const COOKIE_NAME = "lt_draft";
/** Two hours. Long enough to finish, short enough that a shared computer forgets. */
const COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;

export interface LaserTagDraft {
  id: string;
  players: number;
  games: number;
  /** `"YYYY-MM-DD"` in venue-local time, or null before a start is chosen. */
  date: string | null;
  startMinutes: number | null;
  /** Epoch milliseconds. Null until a start is chosen. */
  heldUntil: number | null;
  /** COPY.md `hold.extendUsed` — the extension is offered once per draft. */
  holdExtended: boolean;
  name: string;
  phone: string;
  email: string;
  note: string;
  /** Set once the booking is written. Makes Confirm idempotent against a double tap. */
  bookingCode: string | null;
  createdAt: number;
}

/** Server-side rejection carried back into the draft so the next render can show it. */
export type DraftFlag = "RACE_LOST" | "HOLD_REPLACED" | null;

function emptyDraft(id: string, players: number, games: number, createdAt: number): LaserTagDraft {
  return {
    id,
    players,
    games,
    date: null,
    startMinutes: null,
    heldUntil: null,
    holdExtended: false,
    name: "",
    phone: "",
    email: "",
    note: "",
    bookingCode: null,
    createdAt,
  };
}

/**
 * A draft id is a bearer token for an in-progress booking, so it is generated the same way a
 * booking code is: from the platform CSPRNG, never from a counter or a timestamp.
 */
export function newDraftId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function readString(source: Record<string, unknown>, key: string, maxLength: number): string {
  const value = source[key];
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

/**
 * Parse one entry out of the cookie. Every field is bounded, because the cookie is a value the
 * browser holds and therefore a value an attacker controls; nothing downstream may assume a
 * number is a number.
 */
function parseDraft(raw: unknown, bounds: { maxPlayers: number; maxGames: number }): LaserTagDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const source = raw as Record<string, unknown>;

  const id = typeof source.id === "string" && /^[a-f0-9]{32}$/.test(source.id) ? source.id : null;
  const players = parseBoundedInteger(source.players, { min: 1, max: bounds.maxPlayers });
  const games = parseBoundedInteger(source.games, { min: 1, max: bounds.maxGames });
  if (id === null || players === null || games === null) return null;

  const date = parseCalendarDate(source.date);
  const startMinutes = parseBoundedInteger(source.startMinutes, { min: 0, max: 24 * 60 - 1 });
  const heldUntil = typeof source.heldUntil === "number" && Number.isFinite(source.heldUntil)
    ? source.heldUntil
    : null;
  const createdAt = typeof source.createdAt === "number" && Number.isFinite(source.createdAt)
    ? source.createdAt
    : 0;
  const bookingCode = typeof source.bookingCode === "string" ? source.bookingCode.slice(0, 16) : null;

  return {
    id,
    players,
    games,
    // A start time without a date is meaningless; drop both rather than carry half a choice.
    date: date !== null && startMinutes !== null ? date : null,
    startMinutes: date !== null && startMinutes !== null ? startMinutes : null,
    heldUntil,
    holdExtended: source.holdExtended === true,
    name: readString(source, "name", 200),
    phone: readString(source, "phone", 40),
    email: readString(source, "email", 254),
    note: readString(source, "note", 1000),
    bookingCode,
    createdAt,
  };
}

async function readAll(bounds: { maxPlayers: number; maxGames: number }): Promise<LaserTagDraft[]> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => parseDraft(entry, bounds))
      .filter((draft): draft is LaserTagDraft => draft !== null);
  } catch {
    // A malformed cookie is indistinguishable from no cookie, and recovering by starting the
    // flow again is better than a 500 on a booking screen.
    return [];
  }
}

export async function getDraft(
  id: string,
  bounds: { maxPlayers: number; maxGames: number },
): Promise<LaserTagDraft | null> {
  const drafts = await readAll(bounds);
  return drafts.find((draft) => draft.id === id) ?? null;
}

/** Write a draft, newest first, keeping at most `MAX_DRAFTS`. Server actions only. */
export async function putDraft(
  draft: LaserTagDraft,
  bounds: { maxPlayers: number; maxGames: number },
): Promise<void> {
  const existing = await readAll(bounds);
  const next = [draft, ...existing.filter((entry) => entry.id !== draft.id)].slice(0, MAX_DRAFTS);
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function createDraft(
  args: { players: number; games: number; now: Date },
  bounds: { maxPlayers: number; maxGames: number },
): Promise<LaserTagDraft> {
  const draft = emptyDraft(newDraftId(), args.players, args.games, args.now.getTime());
  await putDraft(draft, bounds);
  return draft;
}

/** Whether the countdown on a chosen start has run out. Takes `now`; reads no clock. */
export function holdExpired(draft: LaserTagDraft, now: Date): boolean {
  if (draft.startMinutes === null || draft.date === null) return false;
  return draft.heldUntil === null || draft.heldUntil <= now.getTime();
}

/** Whole seconds left on the countdown, floored at zero. */
export function holdSecondsRemaining(draft: LaserTagDraft, now: Date): number {
  if (draft.heldUntil === null) return 0;
  return Math.max(0, Math.floor((draft.heldUntil - now.getTime()) / 1000));
}
