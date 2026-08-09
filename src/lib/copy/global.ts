/**
 * Global copy — COPY.md §1 (microcopy, units, shared vocabulary, price summary lines)
 * and §2 (global chrome, venue facts, shared controls).
 *
 * COPY.md is the only place product strings live. Nothing here is paraphrased and nothing
 * here is invented: every value below is transcribed verbatim from the deck. If a screen
 * needs a sentence that is not here, that is a bug in COPY.md — raise it, do not write one.
 *
 * Two mechanical notes:
 *
 * 1. `{placeholder}` tokens are left in the strings exactly as the deck writes them. Fill
 *    them with `interpolate()` from `./interpolate`, never with template concatenation —
 *    the helper is what turns a forgotten value into a loud failure instead of a customer
 *    reading a literal `{phone}`.
 *
 * 2. COPY.md's `fmt.*` keys (§1) are formatting *rules*, not strings, so they are not in
 *    this file. They are implemented once in `src/lib/format.ts`; the mapping from key to
 *    helper is documented at the top of that file.
 *
 * A handful of deck keys collide when nested — `global.phone` is a string and
 * `global.phone.label` is another string one level below it. Where that happens the leaf is
 * renamed and the original deck key is named in a trailing comment, so the deck remains
 * greppable from the code.
 */

// ─── §1.1 Units and pluralisation ────────────────────────────────────────────────────────
// `one` / `other` follow Intl.PluralRules category names. Read them through
// `unitLabel()` / `formatCount()` in src/lib/format.ts rather than indexing by hand.

export const unit = {
  /** Party flow. Includes the birthday guest of honour. */
  guest: { one: "guest", other: "guests" },
  /** Laser tag flow. A person in the arena. */
  player: { one: "player", other: "players" },
  game: { one: "game", other: "games" },
  /** Arena seats are called **spots** to customers, **seats** never. */
  spot: { one: "spot", other: "spots" },
  room: { one: "room", other: "rooms" },
  day: { one: "day", other: "days" },
  pizza: { one: "pizza", other: "pizzas" },
  card: { one: "card", other: "cards" },
  booking: { one: "booking", other: "bookings" },
  party: { one: "party", other: "parties" },
} as const;

// ─── §1.2 Shared vocabulary — use these words, not synonyms ──────────────────────────────

export const vocab = {
  /** Never: slot, time slot, booking block. */
  window: "party window",
  /** Never: session, round, match. */
  game: "game",
  /** Never: the field, the course, the pitch. */
  arena: "the arena",
  /** Never: birthday kid, celebrant. */
  honoree: "birthday guest of honour",
  /** Never: booker, purchaser, customer (in customer-facing copy). */
  organiser: "organiser",
  /** Never: down payment, retainer. */
  deposit: "deposit",
  /** Never: reception, the till, the counter. */
  desk: "the front desk",
  /** Never: reservation — a hold is not a booking. */
  hold: "hold",
} as const;

// ─── §1.3 Price summary lines (both flows) ───────────────────────────────────────────────

export const sum = {
  heading: "What it costs",
  line: {
    /** Laser tag line item. */
    games: "{games} × {unit.game} · {players} {unit.player}",
    perPerson: "{perPerson} per person",
    package: "{packageName} · {baseGuests} guests included",
    /** Shown only when {extraCount} > 0. */
    extraGuests: "{extraCount} extra guests × {extraRate}",
    /** The audit line. Always shown beside the package total. */
    extraGuestsMath: "{basePrice} + {extraCount} × {extraRate}", // sum.line.extraGuests.math
  },
  subtotal: "Subtotal, before tax",
  /** Manitoba GST 5% + PST 7%. Rate is a setting. */
  tax: "GST + PST ({taxRate}%)",
  /** Pizzas and wings are published tax-inclusive. */
  foodSubtotal: "Food and drink, tax included",
  /** Sits under the food subtotal so the tax line is auditable. */
  foodNote: "Pizza and wing prices already include tax.",
  total: "Total",
  /** Laser tag only. Sits beside the subtotal, not as a footnote. */
  plusTax: "plus tax",
  depositDue: "Deposit due now",
  depositPaid: "Deposit paid",
  balanceDue: "Balance due on the day",
  /** Laser tag confirmation. */
  dueAtDesk: "Due at the front desk",
  /** Laser tag, G1/G4/G5. */
  noCard: "Pay at the front desk. No card needed now.",
  /** Email footer and review screens. */
  currencyNote: "All prices in Canadian dollars.",
} as const;

// ─── §2.1 Identity and venue facts ───────────────────────────────────────────────────────

export const hours = {
  heading: "When we're open",
  monThu: "Monday to Thursday · 12:00 PM – 9:00 PM",
  fri: "Friday · 12:00 PM – 10:00 PM",
  sat: "Saturday · 12:00 PM – 9:00 PM",
  sun: "Sunday · 12:00 PM – 7:00 PM",
  /** Explains the 10–12 window. */
  partyNote: "Weekend mornings from 10:00 AM are reserved for private parties.",
} as const;

// ─── §2.2 The three standing rules — one canonical wording each ──────────────────────────
// These appear on many screens. Do not paraphrase them per screen.

export const rule = {
  shoes: "Clean closed-toed shoes are required in the arena.",
  /** Chip / list form. */
  shoesShort: "Clean closed-toed shoes", // global.rule.shoes.short
  nutFree: "Our facility is nut-free.",
  outsideFood: "No outside food, drinks or cake.",
  /** Use where one line is needed. */
  nutFreeCombined:
    "Our facility is nut-free, and we can't allow outside food, drinks or cake.",
  cutoff:
    "Online booking closes {cutoffMinutes} minutes before a game starts, so we can look after walk-ins.",
  /** Chip / list form. */
  cutoffShort: "Booking closes {cutoffMinutes} minutes before a game", // global.rule.cutoff.short
  arrive: "Arrive 15 minutes early so we can get you signed in.",
  /** Laser tag only. */
  payDesk: "Pay at the front desk. No card needed now.",
  arenaCap: "Our arena holds {arenaCap} players at a time.",
  ageBand:
    "Two parties share each two-hour window, and we seat them within {ageBand} years of each other.",
} as const;

// ─── §2.3 Buttons and shared controls ────────────────────────────────────────────────────

export const btn = {
  /** Default forward action. */
  continue: "Continue",
  back: "Back",
  edit: "Edit",
  /** Never "Retry". */
  retry: "Try again",
  /** Dismiss a dialog. Never used for cancelling a booking. */
  cancel: "Cancel",
  close: "Close",
  done: "Done",
  save: "Save changes",
  /** Transient confirmation. */
  saved: "Saved",
  /** G4 primary. */
  confirmBooking: "Confirm booking",
  /** P6 primary. */
  reserveDeposit: "Reserve with a {deposit} deposit",
  /** P7 primary. */
  payDeposit: "Pay {deposit} deposit",
  addToCalendar: "Add to calendar",
  /** Party confirmation. Free downloadable invitations are a stated package inclusion. */
  downloadInvitations: "Download Lasertopia invitations",
  changeOrCancel: "Change date or cancel",
  cancelBooking: "Cancel this booking",
  bookAgain: "Book again",
  lookUpBooking: "Find my booking",
  pickAnotherDate: "Pick another date",
  pickAnotherTime: "Pick another time",
  /** Recovery action in time-based errors. */
  takeTime: "Take {time}",
  /** Recovery action in window-based errors. */
  takeWindow: "Take {altWindow1}",
  goToDate: "Go to {altDate1}",
  goToMonth: "Go to {nextMonth}",
  reduceGroup: "Change group size",
  editGuestCount: "Edit guest count",
  holdAgain: "Hold {time} again",
  holdWindowAgain: "Hold {window} again",
  /** Offered once per draft. */
  extendHold: "Need more time? Add 5 minutes",
  /** P4, above the options. */
  skipExtras: "No extras — continue",
  print: "Print",
  printSheet: "Print party sheet",
  printAllSheets: "Print today's party sheets",
} as const;

// ─── §2.4 The hold bar (sticky, both flows) ──────────────────────────────────────────────

export const hold = {
  label: "Held for you",
  /** Monospace countdown. */
  countdown: "{holdRemaining} left",
  /** {holdMinutes} = 7 for games. */
  gamesExplain:
    "We're holding {gameBlock} for {holdMinutes} minutes while you finish.", // hold.games.explain
  /** {holdMinutes} = 10 for parties. */
  partyExplain:
    "We're holding {window} on {dateShort} for {holdMinutes} minutes while you finish.", // hold.party.explain
  extended: "Added 5 minutes. You have {holdRemaining} left.",
  /** Shown when the extend control is spent. */
  extendUsed:
    "We've already added time once. If it runs out we'll check whether it's still open.",
  /** Fires at 60 seconds. aria-live="polite". */
  expiringSoon: "Under a minute left on your hold.",
} as const;

// ─── §2.5 Status bands (booking pages) ───────────────────────────────────────────────────

export const status = {
  /** Uppercase per DESIGN §5.6 state words. */
  confirmed: "CONFIRMED",
  pendingDeposit: "DEPOSIT PENDING",
  cancelled: "CANCELLED",
  completed: "COMPLETED",
  cancelledOn: "Cancelled on {date}.",
  completedOn: "This booking was on {date}.",
  pendingDepositBody:
    "We're holding this party until the {deposit} deposit is recorded. Finish the deposit, or call {phone} and we'll take it over the phone.", // status.pendingDeposit.body
} as const;

// ─── §2.6 Generic loading and progress ───────────────────────────────────────────────────
// Every one of these is screen-reader text. The visual is a static hatch block
// (DESIGN §6.3) — never a shimmer.

export const loading = {
  times: "Loading game times…",
  calendar: "Loading party windows…",
  saving: "Saving…",
  /** P7 button progress label. */
  reserving: "Reserving your party…",
  /** G4 button progress label. */
  confirming: "Confirming your booking…",
  /** Manager. */
  board: "Loading the board…",
} as const;

// ─── The one object the surfaces import ──────────────────────────────────────────────────

export const global = {
  // §2.1 — identity and venue facts
  /** Wordmark. Not "Lasertopia" alone — this is not the marketing site. */
  productName: "Lasertopia Booking",
  venueName: "Lasertopia",
  address: "Unit #5 – 1140 Waverley Street, Winnipeg, MB",
  /** Sticky bars, chips. */
  addressShort: "1140 Waverley Street",
  phone: "204-474-5900",
  /** Tap-to-call button label. */
  phoneCall: "Call {phone}", // global.phone.label
  /** Used only in cutoff states. */
  phoneCallWalkin: "Call {phone} — walk-ins welcome", // global.phone.labelWalkin
  marketingLink: "Back to lasertopia.ca",
  /** Footer, email. */
  timezoneNote: "All times are Winnipeg time.",

  hours,
  rule,
  unit,
  vocab,
  btn,
  sum,
  hold,
  status,
  loading,
} as const;

export type Global = typeof global;
