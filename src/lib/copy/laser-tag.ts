/**
 * Laser tag flow copy — COPY.md §4 (screens G1–G5), plus the keys the laser tag surface is
 * the only consumer of: §7 (`/closed`), the laser-tag half of §8 (errors and rejections),
 * §9's `empty.g2.*`, and §12.1 (the confirmation email).
 *
 * Owned by the laser tag surface team. Every string below is transcribed verbatim from the
 * deck. `{placeholder}` tokens are left exactly as written and filled with `interpolate()`
 * at the call site — never with template concatenation, so a forgotten value is a loud
 * failure instead of a customer reading a literal `{phone}`.
 *
 * Two transcription rules, applied consistently:
 *
 * 1. **A deck value that is only a reference to another key is not duplicated here.** COPY.md
 *    writes `g1.facts.cutoff` as `{global.rule.cutoff}` and `g4.cta` as `{btn.confirmBooking}`.
 *    Re-typing those sentences would let the two copies drift, so the call site reads
 *    `global.rule.cutoff` / `global.btn.confirmBooking` directly. The deck key is named in a
 *    comment wherever that happens, so COPY.md stays greppable from the code.
 *
 * 2. **A deck value that is a bare passthrough of one formatted figure is not a string.**
 *    `g4.readback.date` is `{date}` and `g4.price.subtotal` is `{subtotal}`; those render
 *    through `src/lib/format.ts`. Composite values that put figures together with punctuation
 *    (`g5.when.value`) are real strings and are here.
 *
 * Nothing from §1 or §2 belongs in this file — those are already in `./global`.
 */

// ─── §4.1 Screen G1 — players & games ────────────────────────────────────────────────────

export const g1 = {
  title: "Laser tag",
  /** The document title for the step. COPY.md §4.1 notes column. */
  documentTitle: "Book laser tag — Lasertopia",
  heading: "How many players, and how many games?",
  players: {
    label: "Players",
    help: "Everyone going into the arena, including you.",
    /** `aria-label` on the stepper's minus control. */
    decrease: "One fewer player",
    /** `aria-label` on the plus control. */
    increase: "One more player",
    /** Shown when the stepper reaches the cap. */
    atCap: "{arenaCap} is the most we can put in the arena at once.",
  },
  games: {
    label: "Games",
    help: "Each game runs 15 minutes. Two games means two back-to-back start times, and we'll show you both.",
    option1: "1 game",
    option2: "2 games",
    option3: "3 games",
    /** On each card. */
    price: "{perPerson} per person",
    /** Live total under the selected card. */
    groupTotal: "{total} for {players} {unit.player}, plus tax",
  },
  facts: {
    heading: "Before you pick a time",
    // g1.facts.cutoff = {global.rule.cutoff}
    // g1.facts.pay    = {global.rule.payDesk}
    // g1.facts.shoes  = {global.rule.shoes}
  },
  /** Primary. More specific than "Continue". */
  cta: "Find a time",
} as const;

// ─── §4.2 Screen G2 — date & time ────────────────────────────────────────────────────────

export const g2 = {
  title: "Pick a time",
  heading: "Pick a start time",
  /** Persistent context line. */
  context: "{players} {unit.player} · {games} {unit.game}",
  /** Links back to G1, keeps the draft. */
  contextEdit: "Change", // g2.context.edit
  dateStrip: {
    /** `aria-label` on the scroller. */
    label: "Choose a date",
    /** Replaces the weekday on today's chip. */
    today: "Today",
    tomorrow: "Tomorrow",
    status: {
      /** Status dot label, also the accessible name. */
      open: "Open",
      limited: "Limited",
      full: "Full",
      closed: "Closed",
    },
  },
  /** Chip, tappable, shown when today is selected. */
  nextAvailable: "Next available: {time}",
  nextAvailableAction: "Take {time}", // g2.nextAvailable.action
  grid: {
    /** `aria-label` on the grid. */
    label: "Game start times for {date}",
    // g2.grid.hourHeading = {time}
  },
  cell: {
    state: {
      /** DESIGN §5.6 state words. */
      open: "OPEN",
      filling: "FILLING",
      full: "FULL",
      partyHold: "PARTY HOLD",
      partyHoldSub: "RESERVED", // g2.cell.state.partyHold.sub
      blocked: "BLOCKED",
      tooSoon: "TOO SOON",
      tooSoonSub: "Walk-in window", // g2.cell.state.tooSoon.sub
      selected: "SELECTED",
    },
    spots: "{seatsLeft} / {arenaCap} {unit.spot}",
    /** Used in the FILLING state. */
    spotsLeft: "{seatsLeft} / {arenaCap} left",
    // g2.cell.block.sub = {gameBlock.sub}, from formatBlockSub()
    /** Accessible name, per DESIGN §5.6. */
    a11y: "{time}, {state}, {seatsLeft} of {arenaCap} spots",
  },
  /** Non-blocking warning, DESIGN §5.10. */
  warn: {
    scarce: "Only {seatsLeft} {unit.spot} left at this time.",
  },
  /** Enabled once a start is selected. */
  cta: "Continue",
  /** Under the grid once selected. */
  selectedReadback: "{gameBlock} on {date}", // g2.selected.readback
  /** Toast on selection. */
  holdPlaced: "Held for you for {holdMinutes} minutes.", // g2.holdPlaced
} as const;

// ─── §4.3 Screen G3 — who's coming ───────────────────────────────────────────────────────

export const g3 = {
  title: "Your details",
  heading: "Who should we look for?",
  name: {
    label: "Name",
    placeholder: "First and last name",
  },
  phone: {
    label: "Mobile number",
    help: "In case we need to reach you about tonight.",
    placeholder: "204-555-0134",
  },
  email: {
    label: "Email",
    help: "Your booking code and confirmation go here.",
  },
  note: {
    label: "Anything we should know? (optional)",
    help: "Birthdays, first-timers, a group joining late — tell us and we'll be ready.",
  },
  privacy:
    "We use your details for this booking only. We don't sell them or add you to a mailing list.",
  cta: "Review booking",
} as const;

// ─── §4.4 Screen G4 — confirm ────────────────────────────────────────────────────────────

export const g4 = {
  title: "Review",
  heading: "Check this over",
  readback: {
    // g4.readback.date       = {date}
    // g4.readback.times.one  = {time}
    // g4.readback.times.many = {gameTimes}
    timesLabel: "Your game {unit.game}", // g4.readback.timesLabel
    players: "{players} {unit.player}",
    // g4.readback.arrive = {global.rule.arrive}
  },
  price: {
    perPerson: "{perPerson} per person",
    // g4.price.subtotal = {subtotal}
    // g4.price.plusTax  = {sum.plusTax}
    // g4.price.payDesk  = {global.rule.payDesk}
  },
  ack: {
    /** Checkbox label. */
    label: "I've read the arena rules",
    // g4.ack.body = "{global.rule.shoes} {global.rule.nutFreeCombined}"
  },
  // g4.cta = {btn.confirmBooking}
  editTime: "Change time",
  editDetails: "Change details",
  editPlayers: "Change players or games",
} as const;

// ─── §4.5 Screen G5 — laser tag confirmation ─────────────────────────────────────────────

export const g5 = {
  title: "Booking {code}",
  heading: {
    /** Only with `?new=1`. No exclamation mark. */
    new: "You're booked",
    /** Returning visit. */
    return: "Your laser tag booking",
  },
  sub: {
    new: "We've emailed a copy to {email}.",
  },
  code: {
    label: "Booking code",
    help: "Give this at the front desk. Keep it handy — it's also how you look this booking up.",
  },
  when: {
    label: "When",
    value: "{date} · {gameTimes}",
  },
  players: {
    label: "Players",
  },
  due: {
    // g5.due.label = {sum.dueAtDesk}
    value: "{total}, plus tax",
    // g5.due.note = {global.rule.payDesk}
  },
  arrive: {
    heading: "On the day",
    // g5.arrive.body = {global.rule.arrive}
  },
  rules: {
    heading: "House rules",
    // g5.rules.body = "{global.rule.shoes}\n{global.rule.nutFree}\n{global.rule.outsideFood}"
  },
  where: {
    heading: "Where",
    // g5.where.body = {address}
  },
  cancel: {
    // g5.cancel.link = {btn.cancelBooking}
    free: "You can cancel free any time up to {cutoffMinutes} minutes before your game.",
    confirmHeading: "Cancel {code}?", // g5.cancel.confirm.heading
    confirmBody:
      "This frees up {players} {unit.player} at {time} on {date}. Nothing is charged either way.", // g5.cancel.confirm.body
    confirmYes: "Cancel booking", // g5.cancel.confirm.yes
    confirmNo: "Keep it", // g5.cancel.confirm.no
    done: "Cancelled. Those spots are back in the schedule.",
    tooLate:
      "Your game starts in under {cutoffMinutes} minutes, so we can't cancel it online. Call {phone} and we'll take it off the list.",
  },
} as const;

// ─── §7 `/closed` — nothing bookable ─────────────────────────────────────────────────────

export const closed = {
  title: "Booking is closed",
  heading: "We're not taking online bookings right now",
  body: "There's nothing available to book online at the moment. We're still here — call {phone} and we'll tell you what's on.",
  // closed.hours = the four global.hours lines
  // closed.cta   = {global.phone.label}
} as const;

// ─── §8 Errors and rejections — the laser tag half of the master deck ─────────────────────
// Every entry has a title, a body and at least one action. The body always covers what
// happened, why in the venue's terms, and what to do. The `code` in each key matches the
// engine's BookingErrorCode, so a rejection payload maps to copy with no lookup table.

/** §8.1 `ONLINE_CUTOFF` / `CUTOFF` — inside the 90-minute walk-in window. */
const cutoff = {
  title: "That start is too soon to book online",
  /** First `{time}` is the current time. */
  body: "Games start every 15 minutes, and we stop online booking {cutoffMinutes} minutes ahead so walk-ins aren't double-booked. It's {time} now, so the earliest we can book you online is {altTime1}. For anything sooner, call us at {phone} — walk-ins are welcome.",
  /** Keeps players, games and details. */
  actionPrimary: "Take {altTime1}",
  // err.cutoff.action.secondary = {global.phone.labelWalkin}
  atSubmit: {
    /** The late failure at G4. */
    title: "{time} has just moved inside our walk-in window",
    body: "While you were filling this in, {time} came inside the {cutoffMinutes}-minute cutoff, so we can't book it online any more. The earliest online start is now {altTime1}. Nothing has been charged and your details are saved.",
    actionPrimary: "Move my booking to {altTime1} — keeps everything else",
    // err.cutoff.atSubmit.action.secondary = {global.phone.labelWalkin}
  },
  /** Tile state word. */
  cellTag: "TOO SOON",
  cellSub: "Walk-in window",
} as const;

/** §8.2 `SLOT_HELD_FOR_PARTY` / `SLOT_RESERVED` — held for a birthday party. */
const partyHeld = {
  title: "{time} is held for a birthday party",
  body: "Some game times are set aside for parties. If no party books this one, it opens up to everyone — so it's worth checking back. Right now the closest games with room for {players} {unit.player} are {altTime1} and {altTime2}.",
  actionPrimary: "Take {altTime1}",
  actionSecondary: "Take {altTime2}",
  cellTag: "PARTY HOLD",
  cellSub: "RESERVED",
} as const;

/** §8.3 `PARTY_ONLY_WINDOW` — weekend mornings. Approved default, BRIEF gap #4. */
const partyOnly = {
  title: "We're closed to the public that morning",
  body: "Saturday and Sunday from 10:00 AM to 12:00 PM are private party time, and those games belong to the parties in the building. Doors open to everyone at {openTime}, and the first public game is at {altTime1}.",
  actionPrimary: "Take {altTime1}",
  /** Links to the party flow. */
  actionSecondary: "Book a birthday party instead",
} as const;

/** §8.4 `SLOT_UNAVAILABLE` / `SLOT_BLOCKED` — staff took it out of the schedule. */
const blocked = {
  title: "{time} isn't running today",
  /** Never expose the internal block reason to customers. */
  body: "We've taken this game out of today's schedule. The nearest games with room for {players} {unit.player} are {altTime1} and {altTime2}.",
  actionPrimary: "Take {altTime1}",
  actionSecondary: "Take {altTime2}",
  cellTag: "BLOCKED",
} as const;

/** §8.5 `ARENA_FULL` / `SOLD_OUT` — not enough spots in the arena. */
const arenaFull = {
  title: "{time} doesn't have room for {players}",
  body: "Our arena holds {arenaCap} players at a time, and {time} has {seatsLeft} {unit.spot} left. These have room for all {players} of you: {altTime1}, {altTime2}, {altTime3}.",
  actionPrimary: "Take {altTime1}",
  // err.arenaFull.action.secondary = {btn.reduceGroup}
  cellTag: "FULL",
  atSubmit: {
    title: "The last spots at {time} just went",
    body: "Someone booked the last {seatsLeft} {unit.spot} at {time} a moment ago. Nothing has been charged and your details are saved. These have room for {players}: {altTime1} and {altTime2}.",
    actionPrimary: "Move to {altTime1}",
    actionSecondary: "Move to {altTime2}",
  },
} as const;

/** §8.6 `PARTIAL_BLOCK` — the block of games doesn't fit. Assumption — §14, R2. */
const partialBlock = {
  title: "{games} games won't fit starting at {time}",
  body: "Two games means two back-to-back starts. {time} works, but the {altTime1} game right after it doesn't have room for {players}. These blocks fit: {gameBlock} and {altWindow1}.",
  actionPrimary: "Take {gameBlock}",
  actionSecondary: "Book 1 game at {time} instead — {perPerson} per person",
} as const;

/** §8.7 `GROUP_TOO_LARGE` (laser tag) — over the arena cap. */
const groupTooLarge = {
  title: "Groups over {arenaCap} play in two game groups",
  body: "Our arena holds {arenaCap} players at a time, so a group bigger than that splits into two game groups back to back. We set that up with you over the phone so nobody gets separated from their friends. Call {phone}, or book {arenaCap} now and tell us about the rest.",
  // err.groupTooLarge.games.action.primary = {global.phone.label}
  actionSecondary: "Book {arenaCap} now",
} as const;

/** §8.15 `DAY_FULL` — the date has nothing for this booking. */
const dayFull = {
  title: "{date} is full for a group of {players}",
  body: "Every game that day is either booked out or hasn't got room for {players} {unit.player}. The nearest days with room: {altDate1} from {altTime1}, and {altDate2} from {altTime2}.",
  // err.dayFull.games.action.primary = {btn.goToDate}
  actionSecondary: "Go to {altDate2}",
} as const;

/** §8.16 `DAY_CLOSED` / `VENUE_CLOSED`. */
const dayClosed = {
  title: "We're closed on {date}",
  body: "Nothing is running that day. We're next open {nextOpenDate}, {hoursLine}.",
  actionPrimary: "Go to {nextOpenDate}",
  weekendMorning: {
    title: "Public games start at {openTime}",
    /** Approved default, BRIEF gap #4. */
    body: "Saturday and Sunday mornings are private party time from 10:00 AM, and doors open to everyone at {openTime}. The first game you can book that day is {altTime1}.",
    actionPrimary: "Take {altTime1}",
    actionSecondary: "Book a birthday party instead",
  },
  /** Repeated wherever hours are quoted. */
  hoursLine: "{date}: {hoursLine}",
} as const;

/** §8.17 `HORIZON` — outside the booking window. */
const past = {
  /** Never "you selected an invalid date". */
  title: "That date has passed",
  /** Auto-corrected, stated. */
  body: "We've moved you to today instead.",
} as const;

/** §8.17, games half. Assumption — §14, R9. */
const horizon = {
  title: "We're not taking online games that far ahead yet",
  body: "Laser tag opens for booking 60 days ahead. {date} isn't open yet — try again nearer the time, or call {phone} for a big group.",
  // err.horizon.action.primary = {global.phone.label}
} as const;

/** §8.19 `HOLD_EXPIRED` — the soft hold lapsed. */
const holdExpired = {
  title: "Your hold on {time} ran out",
  bodyStillOpen:
    "We only hold a time for {holdMinutes} minutes so it doesn't sit locked up. Good news — {time} is still open. Everything you've filled in is saved.", // err.holdExpired.games.body.stillOpen
  // err.holdExpired.games.action.stillOpen = {btn.holdAgain}
  bodyGone:
    "We only hold a time for {holdMinutes} minutes, and {time} was taken while the hold was down. Everything you've filled in is saved. The closest with room for {players}: {altTime1} and {altTime2}.", // err.holdExpired.games.body.gone
  actionGone: "Take {altTime1}", // err.holdExpired.games.action.gone
  /** Games. */
  actionRepick: "Pick a different time", // err.holdExpired.action.repick
} as const;

/** §8.20 `RACE_LOST` — someone else committed first. */
const raceLost = {
  /** Toast over the grid, selection cleared. */
  gridBody: "{time} filled up while you were looking. The grid is up to date now.",
} as const;

/** §8.23 `SERVER_ERROR`. Never a bare "Something went wrong". */
const server = {
  genericTitle: "That didn't work, and it's on us",
  genericBody:
    "Something failed on our side. Nothing has been charged and nothing is lost. Try again, and if it happens twice call {phone} — we can book anything on this site by hand.",
  // err.server.generic.action.primary   = {btn.retry}
  // err.server.generic.action.secondary = {global.phone.label}
  /** G1. */
  startDraft:
    "We couldn't start your booking. Nothing was saved, so try again — it usually works second time.",
  /** G2. */
  loadTimes:
    "We couldn't load game times for {date}. Your group size and game choice are saved. Try again, or call {phone}.",
  /** G3. */
  saveDetails: "We couldn't save your details. Your time is still held for {holdRemaining}. Try again.",
  /** G4. */
  confirmGames:
    "Your booking didn't go through, and you haven't paid anything. Try again, or call {phone} and we'll book it by hand.",
  /** Caption under any idempotent Retry. */
  retrySafe: "Trying again is safe — it can't create a second booking.",
} as const;

/** §8.24 `OFFLINE` — network failure. */
const offline = {
  title: "You're offline",
  body: "Your choices are saved on this device. We'll pick up where you left off the moment you're back.",
  /** Last grid stays visible, dimmed. */
  grid: "Showing times from {minutesAgo} minutes ago — you're offline. We'll refresh as soon as you're back.",
  /** Button label while disabled. No spinner text. */
  action: "Waiting for a connection…",
  recovered: "Back online. Refreshed just now.",
} as const;

/** §8.25 `FIELD_INVALID` — the laser tag fields. Names the fix, not the fault. */
const field = {
  nameRequired: "Enter a name so we know who to look for.",
  nameTooLong: "That's longer than we can print. Keep it under 80 characters.",
  phoneRequired: "Enter a phone number we can reach you at, like 204-555-0134.",
  phoneInvalid: "That doesn't look like a Canadian or US number. Try it like 204-555-0134.",
  emailRequired: "We send your confirmation here — please add an email.",
  emailInvalid: "Check that email — it's missing an @ or a domain.",
  playersMin: "Enter at least 1 player.",
  playersMax: "{arenaCap} players is the most that can be in the arena at once.",
  gamesRequired: "Pick 1, 2 or 3 games.",
  notesTooLong:
    "That's more than we can store. Keep it under 500 characters, and tell your host the rest on the day.",
  ackRules: "Please confirm you've read the arena rules.",
} as const;

/** §8.26 direct `/booking/[code]` visit. */
const codeNotFound = {
  title: "We couldn't find booking {code}",
  body: "Check the code from your email, or look it up with your phone number.",
  // err.code.notFound.action.primary = {btn.lookUpBooking}
} as const;

export const err = {
  cutoff,
  partyHeld,
  partyOnly,
  blocked,
  arenaFull,
  partialBlock,
  groupTooLarge,
  dayFull,
  dayClosed,
  past,
  horizon,
  holdExpired,
  raceLost,
  server,
  offline,
  field,
  codeNotFound,
  /** Form-level block above the submit button, per DESIGN §5.10. */
  formSummary: "{n} things need a look before we can continue.", // err.form.summary
} as const;

// ─── §9 Empty states — the laser tag grid ────────────────────────────────────────────────

export const empty = {
  g2: {
    noGamesTitle: "No games on this date.",
    /** The DESIGN §5.11 reference case. */
    noGamesBody:
      "{date} doors open at {openTime}, and the 10:00 AM – 12:00 PM window is reserved for parties. Try another date, or call {phone}.",
    // empty.g2.noGames.action = {btn.pickAnotherDate}
  },
} as const;

// ─── §12.1 Laser tag confirmation email ──────────────────────────────────────────────────

export const email = {
  games: {
    subject: "Lasertopia — you're booked for {dateShort} at {time}",
    preheader: "Booking {code} · {players} {unit.player} · {gameTimes}",
    heading: "You're booked",
    intro: "Thanks {name} — here's everything for your laser tag booking at Lasertopia.",
    /** Monospace in HTML. */
    code: "Booking code: {code}",
    when: "When: {date}",
    times: "Games: {gameTimes}",
    players: "Players: {players}",
    price: "{total} plus tax, due at the front desk. No card needed now.",
    where: "Where: {address}",
    arrive: "Arrive 15 minutes early so we can get you signed in.",
    rulesHeading: "Before you come",
    /** Three lines. */
    rulesBody:
      "Clean closed-toed shoes are required in the arena.\nOur facility is nut-free.\nNo outside food, drinks or cake.",
    cancel: "Need to cancel? It's free any time up to {cutoffMinutes} minutes before your game: {link}",
    help: "Questions? Call {phone}.",
    footer:
      "Lasertopia · {address} · {phone}\nAll times are Winnipeg time. All prices in Canadian dollars.",
  },
} as const;

// ─── The one object the surface imports ──────────────────────────────────────────────────

export const laserTag = {
  g1,
  g2,
  g3,
  g4,
  g5,
  closed,
  err,
  empty,
  email,
} as const;

export type LaserTagCopy = typeof laserTag;
