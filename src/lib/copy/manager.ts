/**
 * Manager backend copy — COPY.md §13, including the printable party sheet (§13.9).
 *
 * Also carries the two other decks only this surface renders:
 *   * §6  `/manage-booking` — the public "find your booking" screen (`lookup.*`)
 *   * §8.26 lookup / access errors, and the `empty.mg.*` / `empty.booking.*` states from §9
 *
 * Every string is transcribed verbatim from the deck. `{placeholder}` tokens are left in
 * place and filled with `interpolate()` at the call site — never with concatenation.
 *
 * Three mechanical notes:
 *
 * 1. **Deck keys that collide when nested are renamed, and the original key is named in a
 *    trailing comment.** `mg.booking.cancel` is a string and `mg.booking.cancel.heading` is
 *    another string one level below it, which no object can express; the leaf becomes
 *    `cancel.cta`. `copy/global.ts` uses the same convention.
 *
 * 2. **Keys whose deck value is only a reference to another deck key are not repeated
 *    here.** `mg.party.printSheet` is `{btn.printSheet}` and `mg.slots.save` is `{btn.save}`;
 *    both are read from `@/lib/copy/global` at the call site, so the wording lives in exactly
 *    one place.
 *
 * 3. `TODO_COPY` at the foot lists the strings this surface needs that the deck does not
 *    contain. Each one is marked, not smuggled in as if it were specified.
 */

// ─── §13.1 `/manage/login` ───────────────────────────────────────────────────────────────

const login = {
  title: "Staff sign in",
  heading: "Staff sign in",
  email: { label: "Email" },
  password: { label: "Password" },
  cta: "Sign in",
  /** Never says which half was wrong. */
  error: "That email and password don't match an account. Check both and try again.",
  locked: "Too many attempts. Wait 5 minutes, or ask a manager to reset your password.",
  server: "We couldn't sign you in — the system didn't respond. Try again.",
  signedOut: "Signed out.",
  expired: "Your session ended. Sign in again to get back to the board.",
} as const;

// ─── §13.2 `/manage/schedule` — the board ────────────────────────────────────────────────

const board = {
  title: "Schedule",
  /** Date control. */
  today: "TODAY",
  prevDay: "Previous day",
  nextDay: "Next day",
  view: { day: "Day", week: "Week" },
  /** Lowercase, quiet, monospace number. */
  updated: "updated {secondsAgo}s ago",
  refresh: "Refresh now",
  /** Badge on bookings that arrived this shift. */
  new: "NEW",
  lane: {
    arena: "ARENA",
    arenaCap: "max {arenaCap}", // mg.board.lane.arena.cap
    roomCap: "max {roomMax}", // mg.board.lane.room.cap
  },
  capacity: "{playerCount} / {arenaCap}",
  /** Now-line chip. */
  now: "NOW",
  marker: {
    party: "PARTY",
    blocked: "BLOCKED",
    override: "OVERRIDE",
    past: "PAST",
  },
  addBooking: "+ Booking",
  header: {
    nextArrivals: "Next arrivals",
    nextArrivalsNone: "Nothing arriving in the next hour", // mg.board.header.nextArrivals.none
    parties: "Parties today",
    deposits: "Deposits outstanding",
    /** Must be impossible to miss. */
    allergies: "Allergy flags today",
    overrides: "Overrides today",
  },
  week: {
    heading: "Week of {dateIso}",
    readOnly: "Week view is for planning. Open a day to make changes.",
    openDay: "Open {dateIso}",
  },
} as const;

// ─── §13.3 Board popovers and one-tap actions ────────────────────────────────────────────

const slot = {
  /** Arena row popover. */
  heading: "{time} · {playerCount} / {arenaCap}",
  bookings: {
    heading: "Booked in",
    none: "Nobody booked in yet.",
    row: "{name} · {players} {unit} · {code}", // mg.slot.booking.row, {unit.player}
  },
  checkIn: "Check in",
  checkedIn: "Checked in {time}",
  undoCheckIn: "Undo check-in",
  block: "Block this game",
  unblock: "Unblock",
  blockRange: "Block a range",
  blocked: {
    by: "Blocked by {staffName} at {time}",
    reason: "Reason: {notes}",
    /** Optional, typed after the fact. */
    noReason: "No reason given. Add one",
  },
  /** Force-release a reserved party time (R-23c). */
  release: "Release to the public",
  partyHold: "Held for {honoree}'s party, {window}",
} as const;

const party = {
  /** Party block popover. */
  heading: "{honoree} · turning {age} · {guests} guests",
  package: "{packageName} · {roomNames}",
  games: "Games {gameTimes}",
  /** Tap-to-call. */
  organiser: "{name} · {phone}",
  /** Heavy, always visible when present. */
  allergyFlag: "ALLERGIES — {notes}",
  depositCollected: "Deposit collected",
  depositRecorded: "{deposit} recorded by {staffName} at {time}",
  editGuests: "Edit guests",
  openBooking: "Open booking",
} as const;

// ─── §13.4 Blocking ──────────────────────────────────────────────────────────────────────

const block = {
  range: {
    heading: "Block a range of games",
    from: "From",
    to: "To",
    cta: "Block {n} games",
  },
  reason: {
    label: "Reason (optional)",
    placeholder: "Party expanding, maintenance, staffing",
  },
  /** 10-second undo toast. */
  done: "Blocked {time}.",
  undo: "Undo",
  undone: "Unblocked {time}.",
  hasBookings: {
    heading: "{time} has {bookingCount} bookings ({playerCount} players)",
    /** Never silently orphan a customer. */
    body:
      "Blocking stops new bookings on this game. It does not cancel the ones already in — those customers still expect to play.",
    primary: "Block anyway",
    secondary: "See the bookings first",
  },
  recurring: {
    note:
      "For a block that repeats every week, use Party windows instead — the board is for today's exceptions.",
  },
} as const;

// ─── §13.5 Capacity override ─────────────────────────────────────────────────────────────

const override = {
  /** Never the word "force". */
  heading: "Override a limit",
  room: {
    /** Restates specifically what is being broken. */
    body:
      "The {window} room set holds {roomMax}. You're booking {guests}. Overriding puts {n} guests over room capacity.",
  },
  arena: {
    body:
      "{time} has {playerCount} of {arenaCap} players. Adding {players} puts {n} over the arena cap.",
    confirm: {
      /** Second explicit confirmation — STRATEGY §4.4. */
      heading: "Confirm going over the arena cap",
      /** Shows who else is affected. */
      body:
        "The {arenaCap}-player cap is a safety and experience limit, not a policy. {time} would have {playerCount} players. Also booked in that game: {list}.",
    },
  },
  age: {
    body:
      "This window has a party for a {otherAge}-year-old. Yours is turning {age} — {n} years apart, and we match within {ageBand}.",
    confirm: {
      heading: "Confirm breaking the age match",
      body:
        "Another family has already booked this window for a {otherAge}-year-old on the understanding that the ages would match. They are {name}, {phone}. Overriding affects their party too.",
    },
  },
  reason: {
    label: "Reason (required)",
    help: "This goes on the booking, on the board and in the activity log with your name.",
    chip1: "Manager approved",
    chip2: "Correcting a staff error",
    chip3: "Phone booking",
    chip4: "Regular customer",
    chip5: "Special arrangement",
    /** Reveals the free-text field. */
    other: "Something else",
  },
  cta: "Override and book",
  confirm: { yes: "I understand — override" },
  /** R-13. */
  blocked: {
    room:
      "Room double-booking can't be overridden — two parties can't be in one room. Pick another room or move the other booking.",
  },
  badge: {
    /** Badge on the board slot for the rest of the day. */
    word: "OVERRIDE", // mg.override.badge
    detail: "Overridden by {staffName} · {notes}",
  },
} as const;

// ─── §13.6 Add a booking (phone / walk-in) ───────────────────────────────────────────────

const add = {
  heading: "Add a booking",
  type: { games: "Laser tag", party: "Party" },
  /** CFG.cutoffAppliesToManager = false */
  cutoffNote:
    "The {cutoffMinutes}-minute online cutoff doesn't apply here — you can book right up to the game.",
  customerName: { label: "Customer name" },
  phone: { label: "Phone" },
  email: {
    label: "Email (optional for a walk-in)",
    help: "Without an email there's no confirmation to send.",
  },
  source: {
    label: "Taken by",
    phone: "Phone",
    walkin: "Walk-in",
    inPerson: "At the desk",
  },
  /** Creates the party in DEPOSIT PENDING. */
  depositLater: "Take the deposit later",
  depositNow: "Deposit collected now",
  cta: "Create booking",
  done: "Booked. {code}",
} as const;

// ─── §13.7 `/manage/bookings` — list and search ──────────────────────────────────────────

const bookings = {
  title: "Bookings",
  search: {
    label: "Search bookings",
    /** Autofocused. */
    placeholder: "Name, phone, email, booking code",
    help: "Also matches the birthday guest of honour's name.",
  },
  filter: {
    type: {
      label: "Type", // mg.bookings.filter.type
      all: "All",
      games: "Laser tag",
      party: "Parties",
    },
    status: {
      label: "Status", // mg.bookings.filter.status
      confirmed: "Confirmed",
      pending: "Deposit pending",
      cancelled: "Cancelled",
      completed: "Completed",
    },
    dateFrom: "From",
    dateTo: "To",
  },
  default: "Showing today and forward",
  pinned: {
    /** Pinned to the top with an amber marker. */
    heading: "Deposits outstanding",
    body: "{n} parties are confirmed in the diary with no deposit recorded.",
  },
  col: {
    date: "Date",
    time: "Time",
    type: "Type",
    name: "Name",
    size: "Guests / players",
    status: "Status",
    deposit: "Deposit",
  },
  /** `aria-label` on the phone icon. */
  call: "Call {name}",
  resultCount: "{n} bookings",
  loadMore: "Show more",
} as const;

// ─── §13.8 `/manage/bookings/[id]` — detail ──────────────────────────────────────────────

const booking = {
  title: "{code}",
  heading: {
    party: "{honoree}'s party · {dateIso} · {window}",
    games: "{name} · {dateIso} · {gameTimes}",
  },
  section: {
    when: "When",
    who: "Who",
    rooms: "Rooms",
    games: "Games",
    package: "Package and extras",
    money: "Money",
    notes: "Allergies and notes",
    log: "Activity",
  },
  edit: {
    date: "Change date or window",
    guests: "Change guest count",
    package: "Change package",
    extras: "Change extras",
    contact: "Edit contact details",
    notes: "Edit allergies and notes",
    recheck:
      "Changing this re-runs the full fit check: rooms, the {ageBand}-year age match and the arena. We'll show you what would break before anything saves.",
    wouldBreak: {
      heading: "This change doesn't fit",
      /** `{reason}` is the manager-facing rejection sentence from §8. */
      body:
        "{reason} Fix it by picking a different window, adding a room, or overriding with a reason.",
      addRoom: "Add {roomNames}",
      override: "Override with a reason",
    },
  },
  deposit: {
    status: {
      pending: "Not recorded",
      paid: "{deposit} recorded {dateIso} by {staffName}",
      giftcard: "Converted to gift card {code} on {dateIso}",
      forfeited: "Forfeited on {dateIso}",
    },
    method: {
      label: "How was it paid?",
      cash: "Cash",
      card: "Card at the desk",
      etransfer: "e-Transfer",
      /** Canadian spelling. */
      cheque: "Cheque",
    },
    record: "Record deposit",
  },
  price: {
    override: "Price was overridden — {notes}",
    /** R-68. */
    snapshot: "Prices locked in on {dateIso}. Later price changes don't affect this booking.",
  },
  log: {
    created: "Created via the website",
    createdStaff: "Created by {staffName} — {notes}",
    deposit: "Deposit recorded by {staffName}",
    guests: "Guest count changed from {from} to {to} by {staffName}", // mg.booking.log.guests, {n} to {n}
    override: "Override by {staffName} — {notes}",
    blocked: "Game blocked by {staffName}",
    cancelled: "Cancelled by {staffName} — {notes}",
    rescheduled: "Moved from {from} to {to} by {staffName}", // mg.booking.log.rescheduled, {dateIso} to {dateIso}
    checkIn: "Checked in by {staffName}",
  },
  cancel: {
    /** Bottom, visually quiet. */
    cta: "Cancel booking", // mg.booking.cancel
    heading: "Cancel {code}?",
    /** ≥14 days. */
    partyOutside:
      "This party is {daysAway} days away. Under our policy the {deposit} deposit becomes a gift card. Cancelling frees {roomNames} for {window} and releases the game times {gameTimes}.", // mg.booking.cancel.party.outside
    /** <14 days. */
    partyInside:
      "This party is {daysAway} days away — inside the {noticeDays}-day window. Under our policy the {deposit} deposit is forfeited. If the customer would rather move the date, do that instead and the {deposit} carries over.", // mg.booking.cancel.party.inside
    /** Manager discretion inside 14 days. Requires a reason. */
    giftcardToggle: "Issue a gift card anyway",
    reason: { label: "Reason (required)" },
    games: "This frees {players} players at {gameTimes} on {dateIso}. Nothing was charged.",
    /** Checked by default. */
    notify: "Email the customer",
    confirm: "Cancel the booking",
    keep: "Keep it",
  },
  reschedule: {
    cta: "Move to a new date", // mg.booking.reschedule
    /** R-59. */
    inside:
      "Inside {noticeDays} days this is a staff-only move. The {deposit} carries to the new date. The new date is checked from scratch — rooms, age match and arena.",
    /** R-60. */
    failed: "{reason} The original booking hasn't changed.",
  },
} as const;

// ─── §13.10 `/manage/rooms` ──────────────────────────────────────────────────────────────

const rooms = {
  title: "Rooms",
  heading: "Party rooms",
  intro:
    "Your physical rooms and how many guests each holds. Renaming or resizing a room takes effect on new bookings straight away.",
  col: { name: "Name", capacity: "Capacity", active: "In use" },
  add: "Add a room",
  /** Seeded names are placeholders — §14. */
  namePlaceholder: "Room name as staff and customers see it",
  deactivate: {
    cta: "Take out of use", // mg.rooms.deactivate
    /** Names the affected bookings. */
    warning:
      "{n} future bookings use {roomNames}: {list}. Taking it out of use doesn't cancel them, but no new booking can go in it.",
  },
  shrink: {
    warning:
      "{n} future bookings in {roomNames} have more than {roomMax} guests: {list}. Those bookings will be over capacity.",
  },
  remove: {
    blocked:
      "{roomNames} has future bookings in it and can't be deleted. Take it out of use instead, or move the bookings first.", // mg.rooms.delete.blocked
  },
} as const;

const config = {
  heading: "Room combinations",
  /** R-27, plainly stated. */
  intro:
    "When one party needs more than one room, these are the combinations you offer and how many guests each holds. The combined figure is set here — it isn't the two room capacities added together.",
  col: { rooms: "Rooms", capacity: "Holds", slots: "Rooms used", offered: "Offered" },
  /** Surfaces OQ-05 / OQ-06 to the manager. */
  capacityHelp:
    "Rooms 1 and 2 hold 26 people as two parties, but you've told us one party across both is capped at 20. Change that here if it isn't right.",
} as const;

// ─── §13.11 `/manage/slots` — party windows and reserved game times ──────────────────────

const slots = {
  title: "Party windows",
  heading: "Party windows and reserved game times",
  intro:
    "For each day of the week: the two-hour party windows, which rooms each one can use, and the game times each party in that window gets.",
  day: { label: "Day" },
  window: {
    add: "Add a window",
    time: "Window",
    rooms: "Rooms available",
  },
  sets: {
    heading: "Game times per party",
    intro:
      "Each party booked into this window gets one of these sets. Set 1 goes to the first party, set 2 to the second.",
    add: "Add a set",
    /** Surfaces OQ-08 / OQ-11. */
    empty:
      "No game times set for this window. Parties booked here get times picked automatically from what's free — set them here if you'd rather choose.",
    time: { add: "Add a time" },
  },
  preview: {
    heading: "What this would change",
    /** Warn before save. */
    body: "{n} future dates are affected. {n2} existing bookings would no longer fit: {list}.", // mg.slots.preview.body, {n} twice
    none: "No existing bookings are affected.",
  },
  validation: {
    /** R-07. */
    outsideHours:
      "{window} falls outside your opening hours for {day}. Change the hours, or the window.",
    gameOutside:
      "{time} is outside the {window} window. A party can't play a game before it arrives or after it leaves.",
  },
} as const;

// ─── §13.12 `/manage/closures` ───────────────────────────────────────────────────────────

const closures = {
  title: "Closures and hours",
  heading: "Closures and changed hours",
  intro:
    "Close a date entirely, or give it different hours. Anything already booked on that date is listed before you save.",
  add: "Add a closure",
  date: { label: "Date" },
  type: { closed: "Closed all day", hours: "Different hours" },
  open: { label: "Opens" },
  close: { label: "Closes" },
  reason: { label: "Reason (shown to no one, kept for your records)" },
  stranded: {
    heading: "{n} bookings are on this date",
    body:
      "{list}. Closing the date does not cancel them or tell the customers. Call them, or cancel each booking, before you save this.",
    proceed: "Save the closure anyway",
    review: "See the bookings first",
  },
  hoursNarrow: "The new hours cut off {n} game times that are already booked: {list}.",
} as const;

// ─── §13.13 `/manage/settings` ───────────────────────────────────────────────────────────

const settings = {
  title: "Settings",
  section: {
    booking: "Booking rules",
    money: "Prices",
    text: "Policy wording",
    notify: "Notifications",
  },
  cutoff: {
    label: "Online booking cutoff",
    help:
      "How many minutes before a game we stop taking online bookings, so the desk can look after walk-ins. Staff bookings ignore this.",
    unit: "minutes",
  },
  arenaCap: {
    label: "Arena capacity",
    help: "The most players in the arena in one game. Groups over this play in separate games.",
    unit: "players",
  },
  maxGuests: { label: "Largest party bookable online", unit: "guests" },
  gamesHorizon: { label: "How far ahead laser tag can be booked" },
  partyHorizon: { label: "How far ahead parties can be booked" },
  horizon: { unit: { days: "days", months: "months" } },
  partyLead: {
    label: "Minimum notice for a party",
    /** Assumption — §14, R6. */
    help:
      "Time we need to order food, set the room and book a host. Assumed {leadHours} hours — confirm this.",
  },
  consecutive: {
    label: "Multi-game bookings take back-to-back start times",
    /** Assumption — §14, R2. */
    help:
      "On: two games means two starts 15 minutes apart. Off: customers pick any two times in the day.",
  },
  holdGames: { label: "How long a game time is held during booking" },
  holdParty: { label: "How long a party window is held during booking" },
  ageBand: {
    label: "Age matching",
    help: "The biggest age difference allowed between two parties sharing a window.",
    unit: "years",
  },
  reservedRelease: {
    label: "Release unclaimed party game times to the public",
    /** Assumption — §14, OQ-28. */
    help:
      "How close to the date we give up on selling a party and open its game times to walk-ins.",
  },
  gamePrices: {
    label: "Laser tag, per person",
    help: "These prices are shown to customers as plus tax.",
  },
  packages: { label: "Packages" },
  package: {
    base: "Base price",
    extra: "Extra guest",
    included: "Guests included",
    roomMinutes: "Room time",
    includesFood: "Includes food",
    games: "Games included",
  },
  pizzaTiers: {
    label: "Pizzas by guest count",
    /** R-41. */
    help:
      "Every guest count from 1 up must be covered exactly once. We'll flag any gap or overlap before you save.",
    error:
      "Guest counts {list} are covered twice, and {list2} aren't covered at all. Fix the ranges before saving.", // mg.settings.pizzaTiers.error, {list} twice
  },
  addons: { label: "Add-ons" },
  addon: {
    price: "Price",
    taxIncluded: "Price includes tax",
    eligible: "Available with",
  },
  tax: {
    label: "Tax rate",
    /** Assumption — §14, OQ-20. */
    help:
      "Applied to packages, extra guests and any add-on not already marked tax-inclusive. Pizza and wing prices already include tax.",
  },
  deposit: { label: "Party deposit" },
  notice: {
    label: "Change and cancellation notice",
    help:
      "Cancel or change with this much notice and the deposit becomes a gift card. Inside it, the deposit is forfeited or moves to a new date.",
    unit: "days",
  },
  policyText: {
    label: "Deposit and cancellation policy shown to customers",
    warning:
      "This is a legal commitment to your customers. Changing it does not change bookings already made — they keep the wording they agreed to.",
  },
  notifyEmail: { label: "Send new booking alerts to" },
  /** R-68. */
  saved:
    "Saved. New bookings use these straight away; existing bookings keep the prices they were booked at.",
  validation: { generic: "{field} needs a value between {min} and {max}." }, // {n} and {n}
} as const;

// ─── §13.14 `/manage/activity` ───────────────────────────────────────────────────────────

const activity = {
  title: "Activity",
  heading: "Activity log",
  intro:
    "Every override, cancellation, block and capacity change, with who did it and when. Read-only.",
  filter: {
    all: "Everything",
    overrides: "Overrides",
    cancellations: "Cancellations",
    blocks: "Blocks",
    settings: "Settings changes",
  },
  row: "{dateIso} {time} · {staffName} · {notes}",
  openBooking: "Open {code}",
} as const;

// ─── §13.15 Manager toasts and confirmations ─────────────────────────────────────────────

const toast = {
  saved: "Saved.",
  /** 10 seconds. */
  undo: "Undo",
  undone: "Undone.",
  checkedIn: "{name} checked in.",
  depositRecorded: "{deposit} recorded for {honoree}'s party.",
  printQueued: "Sent to your printer.",
  copied: "Copied.",
  emailSent: "Confirmation sent to {email}.",
  emailFailed:
    "The confirmation email didn't send. The booking is fine — resend it from the booking page, or read the code out over the phone.",
} as const;

const confirm = {
  discard: {
    heading: "Discard your changes?",
    body: "Nothing here has been saved yet.",
    yes: "Discard",
    no: "Keep editing",
  },
} as const;

const error = {
  saveFailed:
    "That didn't save. Nothing has changed. Try again — and if it fails twice, take a photo of the screen and tell whoever runs the system.",
  stale:
    "Someone else changed this booking while you had it open. We've reloaded it so you're not working from an old copy.",
  permission: "Your account can't do that. Ask a manager.",
} as const;

// ─── §6 `/manage-booking` — Look up a booking ────────────────────────────────────────────

export const lookup = {
  title: "Find your booking",
  heading: "Find your booking",
  sub:
    "Your booking code is in your confirmation email. It starts with LT- for laser tag or PT- for a party.",
  code: { label: "Booking code", placeholder: "PT-4KJ2QW9X" },
  contact: {
    label: "Email or mobile number on the booking",
    help: "We ask for both so nobody else can open your booking with just the code.",
  },
  noCode: "Don't have your code? Call {phone} and we'll find you.",
} as const;

// ─── §8.26 Lookup, access and rate limiting ──────────────────────────────────────────────

export const lookupError = {
  notFound: {
    title: "We couldn't find that booking",
    body:
      "Check the code against your confirmation email — the letters and numbers are case-insensitive, but the LT- or PT- prefix matters. If the email's gone, call {phone} with your name and date and we'll find it.",
  },
  mismatch: {
    title: "That code and contact don't match",
    /** Deliberately does not confirm which half was right. */
    body:
      "The booking code exists, but the email or phone number isn't the one on it. Try the other one, or call {phone}.",
  },
  rateLimit: {
    title: "Too many tries",
    body:
      "We've paused lookups from this device for a few minutes to keep bookings private. Call {phone} and we'll pull it up for you straight away.",
  },
} as const;

// ─── §9 Empty states this surface renders ────────────────────────────────────────────────

export const empty = {
  /** Confirmation page and party sheet. An affirmative statement staff can trust. */
  noAllergies: "None recorded.", // empty.booking.noAllergies
  board: {
    noBookings: {
      title: "Nothing booked today.",
      body:
        "No parties and no laser tag bookings on {dateIso}. Walk-ins still work at the desk — add them with + Booking.",
    },
    closed: {
      title: "We're closed on {dateIso}.",
      body: "This date has a closure on it. Open Closures to change it.",
      action: "Open closures",
    },
  },
  week: {
    nothing: {
      title: "Nothing scheduled this week.",
      body: "No bookings between {from} and {to}. Use the arrows to look at another week.", // {dateIso} and {dateIso}
      action: "Go to this week",
    },
  },
  search: {
    /** Query echoed so a typo is visible. */
    title: 'No bookings match "{query}".',
    body:
      "Search matches booking codes, first and last names, the birthday guest of honour's name, phone numbers in any format, and email. Try a phone number or a booking code.",
    action: "Clear search",
  },
  filter: {
    title: "No bookings match these filters.",
    body: "Nothing is {status} between {from} and {to}.", // {dateIso} and {dateIso}
    action: "Clear filters",
  },
  deposits: {
    title: "No deposits outstanding.",
    body: "Every confirmed party has its {deposit} recorded.",
  },
  allergies: {
    title: "No allergies flagged today.",
    body: "No party today has anything in its allergies box. Our facility is nut-free regardless.",
  },
  activity: {
    title: "Nothing logged yet.",
    body:
      "Overrides, cancellations, capacity edits and blocks all show up here with who did them and when.",
  },
  sheets: {
    title: "No party sheets for {dateIso}.",
    body: "There are no parties booked on this date, so there's nothing to print.",
  },
  closures: {
    title: "No closures set.",
    body:
      "Add a closure for a holiday or a day with different hours. Bookings already on that date are listed before anything is saved.",
    action: "Add a closure",
  },
} as const;

// ─── §13.9 Printable party sheet ─────────────────────────────────────────────────────────
// Black on white, one page, readable at arm's length on a clipboard in a loud room.

export const sheet = {
  honoree: {
    /** Largest thing on the page. */
    name: "{honoree}", // sheet.honoree
    age: "turning {age}",
  },
  /** Second largest, monospace. */
  date: "{dateIso}",
  arrival: { label: "ARRIVAL", value: "{startTime}" },
  window: { label: "WINDOW", value: "{window}" },
  room: { label: "ROOM", value: "{roomNames}" },
  guests: { label: "GUESTS", value: "{guests}" },
  package: { label: "PACKAGE" },
  roomTime: { label: "ROOM TIME" },
  games: {
    /** Boxed, monospace. */
    label: "GAME TIMES",
    /** Only when the party exceeds the arena cap. */
    split: "Split into {n} arena groups — see below",
  },
  food: {
    label: "FOOD",
    /** `{list}` is the toppings in order. */
    pizza: "{pizzaCount} large pizzas — {list}",
    hotdogs: "Hot dogs — {n}",
    cupcakes: "Cupcakes — {n}",
    wings: "Wings — {n}, {list}",
    none: "No food on this package",
    cakeNote: "NO OUTSIDE CAKE — cupcakes only",
  },
  addons: {
    label: "ADD-ONS",
    qbix: "QBIX 5D — {n} people",
    arcadeMatch: "5-Up match cards — {n}",
    arcadeTimeplay:
      "45-min Time Play cards — {n} (no prize points, not valid on claw machines or QBIX)",
    /** Around The World. */
    funcard: "$10 fun card per guest — {n} cards",
    frenzy: "Lazer Frenzy — included",
    typhoon: "Typhoon Experience — included",
    none: "None",
  },
  allergies: {
    /** Heavy-ruled box, always printed. */
    label: "ALLERGIES / NOTES",
    /** Prints even when empty — an affirmative statement staff can trust. */
    none: "None recorded",
    /** Always printed inside the box. */
    nutFree: "FACILITY IS NUT-FREE",
  },
  organiser: { label: "ORGANISER", value: "{name} · {phone}" },
  checklist: {
    /** Printed checkboxes and blank time fields. */
    label: "HOST CHECKLIST",
    roomSet: "Room set",
    arrived: "Guests arrived",
    game1: "Game 1",
    game2: "Game 2",
    food: "Food served",
    cake: "Cupcakes",
    merch: "Merch to guest of honour",
    prizes: "Prizes",
    cleared: "Room cleared",
    /** Blank line beside each item. */
    timeField: "Time",
  },
  host: { label: "HOST" },
  money: {
    /** Small, at the foot. */
    deposit: "Deposit {deposit} — {status}",
    balance: "Balance due today {balance}",
  },
  code: "{code}",
  printedAt: "Printed {dateIso} {time}",
  day: {
    heading: "Party sheets — {dateIso}",
    count: "{n} parties",
    /** Screen-only instruction, not printed. */
    pageBreakNote: "One party per page.",
  },
} as const;

// ─── The one object the manager surface imports ──────────────────────────────────────────

export const mg = {
  login,
  board,
  slot,
  party,
  block,
  override,
  add,
  bookings,
  booking,
  rooms,
  config,
  slots,
  closures,
  settings,
  activity,
  toast,
  confirm,
  error,
} as const;

/**
 * Strings this surface renders that COPY.md does not contain. Each one is a gap in the deck,
 * marked here rather than written into a component as if it were specified.
 *
 * TODO(copy): add these to COPY.md §13 and delete this object.
 */
export const TODO_COPY = {
  /** Nav: ends the session. §13.1 has `mg.login.signedOut` but no control label. */
  signOut: "Sign out",
  /** Nav: the §4.2 "buried" group — rooms, windows, closures, settings. */
  setupGroup: "Setup",
  /** `ScheduleBoard` requires a grid accessible name; §13.2 has no `mg.board.label`. */
  boardGridLabel: "Schedule board for {dateIso}",
  /** The arena lane's own column header sub-label when a slot has no bookings. */
  slotOpen: "OPEN",
  /** `/manage/day/[date]/sheets` back link. */
  backToBoard: "Back to the board",
  /** `/manage/slots` weekly hours block. §13.12 covers per-date closures, not the template. */
  openingHours: "Opening hours",
  firstGame: "First public game",
  lastGame: "Last public game",
  /** All template times are stored as minutes from local midnight; the form says so. */
  minutesHelp: "Minutes from midnight",
  /** Login: the fail-closed state when the staff credentials env vars are unset. */
  notConfigured:
    "Staff sign-in isn't configured on this server. Set MANAGER_SESSION_SECRET, MANAGER_EMAIL and MANAGER_PASSWORD_HASH — see .env.example — then restart.",
} as const;

export const manager = {
  mg,
  sheet,
  lookup,
  lookupError,
  empty,
  TODO_COPY,
} as const;

export type ManagerCopy = typeof manager;
