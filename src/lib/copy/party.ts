/**
 * Party flow copy — COPY.md §5, screens P1–P9, plus the party-relevant slices of
 * §8 (errors), §9 (empty states), §10 (policy), §11 (packages and add-ons) and §12.2 (email).
 *
 * Owned by the party surface team. Every string below is transcribed from the deck verbatim,
 * keeping the deck's key structure (`p1.*` … `p9.*`) as nested namespaces. `{placeholder}`
 * tokens are left in place and filled with `interpolate()` at the call site — never with
 * template concatenation, which is what turns a forgotten value into a loud failure instead of
 * a customer reading a literal `{deposit}`.
 *
 * Nothing from §1 or §2 is duplicated here — those are in `./global`. Where the deck composes a
 * string out of a `global.*` key (`p6.ack.house.body`, `p5.notes.prompt`) the composition is
 * either a direct reference to the `./global` export or, where the deck interleaves prose, the
 * expanded literal with the source keys named in a comment. Both keep the deck greppable from
 * the code; a runtime concatenation would not, because it widens the literal type that
 * `interpolate` reads its placeholder names from.
 *
 * §8's error deck is shared between the two public flows. Only the codes a party booking can
 * actually produce are transcribed here; the laser tag surface owns its own subset.
 */

import { rule } from "./global";

/**
 * Flow chrome.
 *
 * TODO(COPY.md) — the deck has no progress-indicator strings, and `StepIndicator` requires both
 * a visible label and an accessible name (the bar may never carry the state alone). Raise with
 * the copywriter; these two are the only strings on this surface the deck does not own.
 */
const flow = {
  step: "STEP {current} / {total}",
  a11y: "Booking progress",
} as const;

// ─── §5.1 Screen P1 — /parties · Party size & age ─────────────────────────────────────────

const p1 = {
  /** Page <title>: `Book a birthday party — Lasertopia`. */
  title: "Birthday party",
  heading: "Tell us about the party",
  sub: "Two questions first. They decide which windows we can offer you, so we ask before the calendar.",
  guests: {
    label: "How many guests, including the birthday guest of honour?",
    help: "Count everyone who'll be in the room and playing.",
    /** aria-label */
    decrease: "One fewer guest",
    /** aria-label */
    increase: "One more guest",
    hint: {
      /** Shown at the base guest count or fewer. */
      base: "{baseGuests} guests are included in every package.",
      /** Above the base guest count. */
      extra:
        "{extraCount} guests over the {baseGuests} included — we'll price that on the package screen.",
      /** Rendered when the rooms engine says this count needs two room-slots. */
      twoRooms:
        "Parties over 14 guests use two of our rooms together, so fewer windows will be open. We'll only show you windows where both rooms are free.",
      /** Rendered when the rooms engine says this count needs three room-slots. */
      threeRooms:
        "Parties over 20 guests use three rooms. These are rare and usually weekend mornings.",
      /** Positive feedback where true: one room-slot, but only the largest room fits. */
      fits: "{guests} guests fits our largest party room.",
    },
  },
  age: {
    label: "How old is the birthday guest of honour turning?",
    help: "We seat two parties in the same two-hour window and match them within {ageBand} years of each other. Asking now means we only show you windows that actually work.",
  },
  facts: {
    heading: "Good to know",
    window: "Parties run in two-hour windows.",
    deposit: "A {deposit} deposit reserves your date and comes off your balance.",
    /** `p1.facts.nutFree` = `{global.rule.nutFreeCombined}` */
    nutFree: rule.nutFreeCombined,
  },
  /** {total} = the cheapest package priced for the real guest count. */
  pricePreview: "Packages for {guests} guests start at {total}.",
  cta: "See available dates",
} as const;

// ─── §5.2 Screen P2 — /parties/date · Date & window ───────────────────────────────────────

const p2 = {
  title: "Pick a date",
  heading: "Pick a date and a window",
  /** Persistent, above the calendar. */
  context: "Showing windows for {guests} guests, turning {age}",
  /** Back to P1, draft preserved. */
  contextEdit: "Edit", // p2.context.edit
  calendar: {
    /** aria-label */
    label: "{month} — party availability",
    prev: "Previous month",
    next: "Next month",
  },
  date: {
    status: {
      open: "Open",
      limited: "One window left",
      /** Deliberate wording — the venue may not be full for a different party. */
      full: "No windows for this party",
      closed: "Closed",
    },
    a11y: "{date}, {status}",
  },
  /** The single most useful control on this screen. */
  shortcut: "Soonest that fits {guests} guests: {altWindow1}",
  shortcutAction: "Take this window", // p2.shortcut.action
  windows: { heading: "Windows on {date}" },
  window: {
    /** Monospace. */
    time: "{window}",
    capacity: "Fits up to {roomMax} guests",
    /** Shown once selected. */
    rooms: "{roomNames}",
    select: "Select",
    selected: {
      /** Shown under the selected row before advancing. */
      games: "Your two laser tag games: {gameTimes}",
      rooms: "We'll set you up in {roomNames}.",
    },
    /**
     * TODO(COPY.md §5.2) — the deck supplies no state words or status chips for the party bay
     * rows, and `PartyBayRow`/`PartyWindowCard` require both. These are transcribed from
     * DESIGN.md §5.7's component spec, which is the only other place they are written down.
     * Raise with the copywriter so §5.2 owns them.
     */
    state: {
      open: "OPEN",
      partyHold: "PARTY HOLD",
      full: "FULL",
      blocked: "BLOCKED",
    },
    status: {
      oneBayOpen: "1 BAY OPEN",
      baysOpen: "{n} BAYS OPEN",
      full: "FULL",
    },
  },
  /** Success message, DESIGN §5.10. */
  ageOk:
    "Ages {age} and {otherAge} — within {ageBand} years. Both parties can share this window.",
  holdPlaced: "Held for you for {holdMinutes} minutes.",
  cta: "Choose a package",
} as const;

// ─── §5.3 Screen P3 — /parties/[draftId]/package · Package ────────────────────────────────

const p3 = {
  title: "Choose a package",
  heading: "Choose a package",
  sub: "Priced for your {guests} guests, not the {baseGuests} on the sticker.",
  card: {
    /** The audit line — always visible. */
    math: "{basePrice} + {extraCount} × {extraRate}",
    total: "{total}",
    totalNote: "for {guests} guests, plus tax",
    /** When {extraCount} is 0. */
    baseOnly: "{basePrice} for up to {baseGuests} guests, plus tax",
    roomTime: "{roomTime} in your private room",
    includes: "Includes",
    /** Factual label. Manager-toggleable. Not urgency. */
    mostBooked: "Most booked",
    select: "Choose {packageName}",
  },
  shared: {
    /** Stated once, below the three cards. */
    heading: "Every package includes",
    body: "A VIP host · soft drinks · popcorn · party supplies · setup and cleanup · merch for the birthday guest of honour · free downloadable Lasertopia invitations",
  },
  roomNote:
    "Your room is held for the full two-hour window either way — the room time is how long the party runs inside it.",
  cta: "Continue",
} as const;

// ─── §5.4 Screen P4 — /parties/[draftId]/extras · Extras ──────────────────────────────────

const p4 = {
  title: "Extras",
  heading: "Anything to add?",
  sub: "All optional. You can add most of these on the day too.",
  /** `p4.skip` = `{btn.skipExtras}` — read it off `global.btn.skipExtras`. */
  food: {
    heading: "Food",
    /** Great Adventure / Around The World. */
    included:
      "Your package includes {pizzaCount} large 1-topping pizzas for {guests} guests.",
    includedHotdogs:
      "Prefer hot dogs? We'll swap the pizzas for hot dogs — one per guest.", // p4.food.included.hotdogs
    choice: {
      label: "Pizza or hot dogs?",
      pizza: "Pizza",
      hotdogs: "Hot dogs",
    },
    notIncluded:
      "The Traveler doesn't include food. For {guests} guests we'd suggest {pizzaCount} large pizzas.",
    topping: {
      label: "Topping for pizza {n}",
      options: "Pepperoni · Bacon · Hawaiian",
      cheese: "Cheese, no topping",
    },
    addPizza: "Add another pizza",
    removePizza: "Remove pizza {n}",
    line: {
      /** Derived caption on the quantity row. */
      included: "{pizzaCount} included",
      extra: "{pizzaCount} included, {extraCount} extra",
    },
    taxNote: "Pizza and wing prices include tax.",
  },
  wings: {
    heading: "Wings",
    sauce: {
      label: "Sauce",
      options:
        "Louisiana · Dry · Sweet Chili · Honey Garlic · Salt and Pepper · Lemon Pepper · Honey Garlic BBQ",
      help: "One sauce per order.",
    },
  },
  qbix: {
    heading: "QBIX 5D",
    body: "An immersive 5D game for up to 5 friends at a time, with wind, motion, sound and lighting that react to what's on screen.",
    price: "{perPerson} per person",
    lineTotal: "{total} for {guests} guests",
  },
  arcade: {
    heading: "5-Up Arcade Card",
    /** Presented as one question, not two products. */
    question: "Two ways to do arcade cards. Pick one.",
    match: {
      label: "Match card — {perPerson} per guest",
      body: "Each guest loads {perPerson} and Lasertopia matches it with the same in Bonus Cash. We match up to {total}.",
    },
    timeplay: {
      label: "45-minute Time Play card — {perPerson} per guest",
      /** Exclusions sit in the option, never in fine print. */
      body: "Unlimited arcade time play for 45 minutes. It earns no prize points and doesn't work on the claw machines or QBIX.",
    },
    qty: {
      label: "How many cards?",
      help: "Up to one per guest.",
    },
    /** Rendered disabled, never hidden. */
    notEligible:
      "Not available with {packageName} — it already includes a $10 fun card for every guest.",
  },
  warn: {
    /** Warning, non-blocking (R-49). */
    timeplayQbix:
      "Heads up: the Time Play card doesn't cover QBIX, so QBIX is charged separately below.",
  },
  /** Sticky bar. */
  runningTotal: "Total so far: {total}",
  cta: "Continue",
} as const;

// ─── §5.5 Screen P5 — /parties/[draftId]/details · Your details ───────────────────────────

const p5 = {
  title: "Your details",
  heading: "Who's organising, and who's the birthday guest of honour?",
  organiser: {
    name: { label: "Your name" },
    phone: {
      label: "Mobile number",
      help: "Your host will call this number if anything changes.",
    },
    email: {
      label: "Email",
      help: "Your confirmation, your booking code and your invitations go here.",
    },
  },
  honoree: {
    label: "Birthday guest of honour's first name",
    help: "It goes on the party sheet and on the room.",
  },
  notes: {
    label: "Allergies and anything else we should know",
    /** `p5.notes.prompt` = `{global.rule.nutFreeCombined} Tell us about any other allergies and we'll brief your host.` */
    prompt:
      "Our facility is nut-free, and we can't allow outside food, drinks or cake. Tell us about any other allergies and we'll brief your host.",
    placeholder:
      "Dairy allergy, a guest using a wheelchair, a surprise arrival — anything at all.",
  },
  privacy:
    "We use your details for this booking only. We don't sell them or add you to a mailing list.",
  cta: "Review party",
} as const;

// ─── §5.6 Screen P6 — /parties/[draftId]/review · Review ──────────────────────────────────

const p6 = {
  title: "Review",
  heading: "Check this over",
  when: {
    heading: "When",
    date: "{date}",
    window: "{window}",
    arrive:
      "Arrive at {startTime}. Come 15 minutes early if you can, so we can get everyone signed in.",
    games: "Laser tag at {gameTimes}",
    roomTime: "{roomTime} in your private room",
  },
  who: {
    heading: "Who",
    guests: "{guests} guests, including {honoree}",
    honoree: "{honoree} is turning {age}",
  },
  package: { heading: "Package" },
  extras: { heading: "Extras", none: "No extras." },
  price: { heading: "Price" },
  /** `p6.deposit.heading` = `{sum.depositDue}`, `p6.balance.heading` = `{sum.balanceDue}`. */
  deposit: { value: "{deposit}" },
  balance: { value: "{balance}" },
  /** `p6.editGuests` = `{btn.editGuestCount}`. */
  editGuestsUpdated: "Updated — {guests} guests, {total} total.", // p6.editGuests.updated
  ack: {
    heading: "Three things to confirm",
    house: {
      label: "I've read the house rules",
      /** `{global.rule.nutFree} {global.rule.outsideFood} {global.rule.shoes}` */
      body: "Our facility is nut-free. No outside food, drinks or cake. Clean closed-toed shoes are required in the arena.",
    },
    deposit: {
      /** Visually the heaviest of the three. */
      label: "I understand the deposit policy",
      /** `p6.ack.deposit.body` = `{policy.deposit.ackBody}` — the reference is below. */
    },
    headcount: {
      label: "I'll confirm my final headcount at least 7 days before",
      body: "We'll email you a reminder. Guests added on the day are charged the extra-guest rate if the room allows it.",
    },
  },
  /** `p6.cta` = `{btn.reserveDeposit}`. */
  ctaNote: "Next screen takes the deposit. Nothing is charged until then.",
} as const;

// ─── §5.7 Screen P7 — /parties/[draftId]/deposit · Deposit ────────────────────────────────

const p7 = {
  title: "Deposit",
  heading: "Reserve the date",
  lineItem: "{deposit} deposit for {honoree}'s party · {dateShort} · {window}",
  nameOnFile: {
    label: "Name for our records",
    help: "The name we'll have on the booking when you arrive.",
  },
  notice: {
    heading: "How this deposit works",
    body: "We record this {deposit} against your booking. No card details are collected on this site — our team will confirm payment with you.",
  },
  /** `p7.policyLine` = `{policy.deposit.oneLine}`, `p7.cta` = `{btn.payDeposit}`,
   *  `p7.progress` = `{loading.reserving}`. */
} as const;

// ─── §5.8 Screen P8 — /parties/booking/[code] · Party confirmation ────────────────────────

const p8 = {
  title: "Booking {code}",
  heading: {
    new: "{honoree}'s party is booked",
    return: "{honoree}'s party",
  },
  sub: {
    new: "We've emailed everything to {email}. Forward it to the other parents — it has the date, the time and what to expect.",
  },
  code: {
    label: "Booking code",
    help: "Quote this if you call us, and use it to look this booking up later.",
  },
  when: { heading: "When", value: "{date} · {window}" },
  arrive: {
    label: "Arrive",
    value: "{startTime}",
    note: "Come 15 minutes early if you can.",
  },
  games: { label: "Laser tag", value: "{gameTimes}" },
  room: { label: "Your room", value: "{roomNames} · {roomTime}" },
  guests: { label: "Guests", value: "{guests}, including {honoree}" },
  package: { label: "Package" },
  extras: { label: "Extras" },
  money: {
    heading: "Money",
    total: "Total {total}",
    paid: "Deposit paid {deposit}",
    balance: "Balance due on the day {balance}",
  },
  allergies: {
    heading: "Allergies and notes",
    /** Affirmative, not blank. */
    none: "None recorded. If that changes, call {phone}.",
  },
  /** `p8.rules.body` is the three `global.rule.*` sentences, one per line. */
  rules: { heading: "House rules" },
  where: { heading: "Where" },
  forward: {
    heading: "Sending this to other parents?",
    body: "The email version has everything they need: date, arrival time, address and the house rules.",
  },
  /** `p8.invitations` = `{btn.downloadInvitations}`, `p8.change` = `{btn.changeOrCancel}`. */
} as const;

// ─── §5.9 Screen P9 — /parties/booking/[code]/change · Change or cancel ───────────────────

const p9 = {
  title: "Change or cancel",
  heading: "Change or cancel {honoree}'s party",
  summary: "{date} · {window} · {guests} guests · {packageName}",
  /** ≥ CFG.changeNoticeDays. */
  outside: {
    heading: "Your party is {daysAway} days away",
    body: "If you cancel now, your {deposit} deposit becomes a gift card you can use in our facility. If you'd rather move the date, we can do that instead and your {deposit} moves with you.",
    actionPrimary: "Request a new date",
    actionSecondary: "Cancel and issue a gift card",
  },
  /** < CFG.changeNoticeDays. */
  inside: {
    heading: "Your party is {daysAway} days away",
    body: "Inside {noticeDays} days the {deposit} deposit can't be refunded or turned into a gift card. You can move it to a new date and keep the {deposit} on that booking, or cancel and forfeit it.",
    /** Visually primary. */
    actionPrimary: "Request a new date — keeps your {deposit}",
    actionSecondary: "Cancel anyway",
    rescheduleNote:
      "Inside {noticeDays} days we move dates by hand, so this goes to our team rather than rebooking straight away. We'll call you.",
  },
  request: {
    heading: "Request a new date",
    body: "Tell us which dates could work and we'll check the rooms, the age matching and the arena, then confirm by phone or email. We usually come back the same day we're open.",
    dates: {
      label: "Dates that would work",
      help: "Two or three options helps us find one fast.",
    },
    notes: { label: "Anything else we should know? (optional)" },
    cta: "Send request",
    done: {
      heading: "Request sent",
      body: "Your original booking stays exactly as it is until we confirm a new date, so nothing is lost. We'll be in touch on {phone}.",
    },
  },
  cancel: {
    confirm: {
      heading: "Cancel {honoree}'s party?",
      /** ≥ CFG.changeNoticeDays. */
      giftcard:
        "Your {deposit} deposit becomes a gift card, and we'll email the code. This can't be undone — rebooking starts a new booking with a new deposit.",
      /** < CFG.changeNoticeDays. */
      forfeit:
        "Your {deposit} deposit is forfeited. This can't be undone. If you'd rather keep the {deposit}, move the date instead.",
      yes: "Cancel the party",
      no: "Keep my booking",
    },
    done: {
      giftcard: {
        heading: "Party cancelled",
        body: "Your {deposit} deposit is now a gift card for use in our facility. We've emailed the code to {email}.",
      },
      forfeit: {
        heading: "Party cancelled",
        body: "Your booking is cancelled. As it was inside {noticeDays} days, the {deposit} deposit is forfeited. We've emailed a copy of this for your records.",
      },
    },
  },
  policy: { link: "Read the full deposit and cancellation policy" },
} as const;

// ─── §8 Errors and rejections — the codes a party booking can produce ─────────────────────

const err = {
  /** §8.8 EXCEEDS_MAX_PARTY_SIZE */
  maxPartySize: {
    title: "We can host up to {maxGuests} guests online",
    body: "A party of {maxGuests} uses three of our rooms together, which is the most we can put through the online booking. For a bigger group we build something custom — call {phone} and we'll work it out with you.",
    action: {
      /** `{global.phone.label}` */
      secondary: "Book for {maxGuests}",
    },
  },

  /** §8.9 NO_ROOM_CONFIG / ROOM_FIT_FAIL */
  roomFit: {
    title: "This window fits up to {roomMax} guests",
    body: "Your party of {guests} needs two of our rooms opened up together, and one of them is already booked for {window}. Here's where {guests} does fit: {altWindow1} and {altWindow2}. If {roomMax} guests would work, this window is yours.",
    action: {
      primary: "See dates that fit {guests} guests",
      secondary: "Book {roomMax} guests here instead",
    },
    /** The inline row reason on P2. */
    row: "Fits up to {roomMax} — your party of {guests} needs two rooms, and one is already booked.",
    /** Confirms the edit out loud. */
    countChanged: "Changed to {roomMax} guests. Your total is now {total}.",
    atReview: {
      title: "{window} on {dateShort} fits up to {roomMax} guests",
      body: "To bring {guests}, you'd need a different window. Your hold on {window} is still live if you'd rather keep {roomMax}.",
      action: {
        primary: "Keep {roomMax} guests",
        secondary: "Find a window for {guests}",
      },
    },
  },

  /** §8.10 AGE_GAP_EXCEEDED / AGE_CONFLICT. We never reveal the other family's name. */
  ageConflict: {
    title: "This window is matched to a different age group",
    body: "Two parties share each two-hour window and play together, so we seat them within {ageBand} years of each other. This window already has a party for a {otherAge}-year-old, and your guest of honour is turning {age}. These work for a {age}-year-old: {altWindow1} and {altWindow2}.",
    action: {
      primary: "Windows that fit a {age}-year-old on {dateShort}",
      secondary: "Take {altWindow1}",
    },
    /** Inline row reason on P2. */
    row: "Already matched to a {otherAge}-year-old's party — we seat parties within {ageBand} years of each other.",
    dayNone:
      "Every window on {dateShort} is matched to an age group that doesn't pair with {age}. The nearest that do: {altWindow1} and {altWindow2}.",
  },

  /** §8.11 WINDOW_FULL */
  windowFull: {
    title: "{window} is fully booked",
    body: "Both party rooms in this window already have parties in them. The nearest windows with room for {guests} guests: {altWindow1} and {altWindow2}.",
    action: { primary: "Take {altWindow1}", secondary: "Take {altWindow2}" },
    row: "Both party rooms are booked for this window.",
  },

  /** §8.12 NO_GAME_CAPACITY / ARENA_CONFLICT */
  arenaConflict: {
    title: "The arena is full during this window's games",
    body: "Your room would be free, but the arena only holds {arenaCap} players in one game and there isn't a run of games in {window} that can take {guests} guests. These windows have both a room and the arena time: {altWindow1} and {altWindow2}.",
    action: { primary: "Take {altWindow1}" },
    row: "Our arena is at capacity during this window's game times.",
  },

  /** §8.13 ADDON_NOT_ELIGIBLE / ADDON_EXCLUSIVE_CONFLICT */
  addonNotEligible: {
    title: "The {addonName} doesn't come with {packageName}",
    body: "Around The World already includes a $10 fun card for every guest, so the arcade cards aren't sold alongside it. We've taken it off and your total is now {total}.",
    action: { secondary: "Choose a different package" },
    /** Disabled add-on row caption. Row stays visible. */
    row: "Not available with {packageName}.",
  },
  addonExclusive: {
    title: "Pick one arcade card, not both",
    body: "The match card and the 45-minute Time Play card are two ways of doing the same thing, so a booking takes one or the other. Choosing one clears the other.",
  },

  /** §8.14 NOTICE_PERIOD_NOT_MET */
  noticeParty: {
    title: "That date is too soon for a party",
    body: "Parties need at least {leadHours} hours' notice — we order the food, set the room and book your host. The soonest we can take online is {altDate1}. For anything sooner, call {phone} and we'll see what we can do.",
    action: { primary: "Go to {altDate1}" },
  },
  noticeChange: {
    title: "We're too close to your party to change it online",
    body: "Your party is in under 48 hours, so changes go through our team rather than the website. Call {phone} and we'll sort it out with you.",
  },
  noticeReschedule: {
    title: "Moving a date inside {noticeDays} days is done by hand",
    body: "Inside {noticeDays} days we have to re-check the rooms, the age matching and the arena, and we may need to move the other party in your window. Send us a request and we'll confirm by phone. Your {deposit} moves with you.",
    action: { primary: "Request a new date" },
  },

  /** §8.15 DAY_FULL, party variant */
  dayFull: {
    title: "No windows on {date} fit {guests} guests turning {age}",
    body: "The rooms that fit {guests} are taken, or the parties already in are outside the {ageBand}-year age match. The nearest that do work: {altWindow1} and {altWindow2}.",
    action: {
      primary: "Take {altWindow1}",
      secondary: "Take {altWindow2}",
      /** Only when reducing the count genuinely helps. */
      tertiary: "Would {roomMax} guests work? Two windows open up",
    },
  },

  /** §8.16 DAY_CLOSED / VENUE_CLOSED */
  dayClosed: {
    title: "We're closed on {date}",
    body: "Nothing is running that day. We're next open {nextOpenDate}, {hoursLine}.",
    action: { primary: "Go to {nextOpenDate}" },
  },

  /** §8.17 HORIZON, party variant */
  horizon: {
    title: "That date isn't open for parties yet",
    body: "Party bookings open 12 months ahead. For anything further out, call {phone} and we'll pencil you in.",
  },
  past: {
    /** Never "you selected an invalid date". */
    title: "That date has passed",
    body: "We've moved you to today instead.",
  },

  /** §8.18 MONTH_EMPTY */
  monthEmpty: {
    title: "No windows in {month} fit {guests} guests",
    body: "Every window that could take {guests} guests turning {age} is already booked this month. {nextMonth} has {monthCount}.",
  },

  /** §8.19 HOLD_EXPIRED, party variant */
  holdExpired: {
    title: "Your hold on {window} ran out",
    body: {
      stillOpen:
        "We only hold a window for {holdMinutes} minutes so it doesn't sit locked up. {window} on {dateShort} is still open, and everything you've filled in is saved.",
      gone: "We only hold a window for {holdMinutes} minutes, and this one was booked while the hold was down. Nothing has been charged and everything you've filled in is saved. These fit {guests} guests: {altWindow1} and {altWindow2}.",
    },
    action: {
      /** `{btn.holdWindowAgain}` */
      gone: "Take {altWindow1}",
      repickWindow: "Pick another window",
    },
  },

  /** §8.20 RACE_LOST */
  raceLost: {
    calendar: "That window was booked a moment ago. We've refreshed the calendar.",
    atSubmit: {
      title: "We're very sorry — {window} was just confirmed for another party",
      /** The emphasis on "Nothing has been charged" is intentional. */
      body: "Your hold didn't take, and we know how much of your evening this took. Nothing has been charged. Everything you've entered is saved. These fit {guests} guests turning {age}: {altWindow1} and {altWindow2}. If neither works, call {phone} and we'll find you something.",
      bodyEmphasis: "Nothing has been charged.",
      action: { primary: "Move to {altWindow1}", secondary: "Move to {altWindow2}" },
    },
  },

  /** §8.21 ROOM_DOUBLE_BOOKED — customer-facing wording; never expose the internal conflict. */
  roomDoubleBooked: {
    title: "That room was taken a moment ago",
    body: "The room for {window} was confirmed for another party while you were finishing up. Nothing has been charged. These fit {guests} guests: {altWindow1} and {altWindow2}.",
    action: { primary: "Take {altWindow1}" },
  },

  /** §8.22 Deposit and payment failure */
  deposit: {
    title: "We couldn't finish your reservation",
    body: "Something went wrong on our side recording the {deposit} deposit. Nothing has been charged and every detail you entered is saved. Try again — or call {phone} and we'll finish it for you in a minute.",
    alreadyPaid: {
      title: "This deposit is already recorded",
      body: "We've got your {deposit} against booking {code}. Nothing was taken twice.",
      action: { primary: "See my booking" },
    },
    expired: {
      title: "This booking is no longer waiting on a deposit",
      body: "It's either already confirmed or it was cancelled. Look it up with your booking code, or call {phone}.",
    },
  },

  /** §8.23 SERVER_ERROR — never a bare "Something went wrong". */
  server: {
    generic: {
      title: "That didn't work, and it's on us",
      body: "Something failed on our side. Nothing has been charged and nothing is lost. Try again, and if it happens twice call {phone} — we can book anything on this site by hand.",
    },
    startDraft:
      "We couldn't start your booking. Nothing was saved, so try again — it usually works second time.",
    loadCalendar:
      "We couldn't load availability for {month}. Your party details are saved. Try again, or call {phone}.",
    loadPackages:
      "We couldn't load the packages. Your window is still held for {holdRemaining}. Try again.",
    saveDetails:
      "We couldn't save your details. Your time is still held for {holdRemaining}. Try again.",
    confirmParty:
      "Your party wasn't booked and nothing has been charged. Try again, or call {phone} and we'll book it by hand.",
    changeRequest:
      "We couldn't send your request. Call {phone} and we'll sort it out — your booking hasn't changed.",
    /** Caption under any idempotent Retry. */
    retrySafe: "Trying again is safe — it can't create a second booking.",
  },

  /** §8.24 OFFLINE */
  offline: {
    title: "You're offline",
    body: "Your choices are saved on this device. We'll pick up where you left off the moment you're back.",
    /** Last calendar stays visible, dimmed. */
    calendar:
      "You're offline, so these windows may be out of date. We'll refresh when you're back.",
    /** Button label while disabled. No spinner text. */
    action: "Waiting for a connection…",
  },

  /** §8.25 FIELD_INVALID — names the fix, not the fault. */
  field: {
    name: {
      required: "Enter a name so we know who to look for.",
      tooLong: "That's longer than we can print. Keep it under 80 characters.",
    },
    phone: {
      required: "Enter a phone number we can reach you at, like 204-555-0134.",
      invalid: "That doesn't look like a Canadian or US number. Try it like 204-555-0134.",
    },
    email: {
      required: "We send your confirmation here — please add an email.",
      invalid: "Check that email — it's missing an @ or a domain.",
    },
    guests: {
      min: "Enter at least 1 guest.",
      max: "{maxGuests} guests is the most we can host online. For more, call {phone}.",
    },
    age: {
      required: "We need the birthday age to match your party with a compatible one.",
      range:
        "Enter an age between 3 and 17. For older groups, call {phone} and we'll set it up.",
    },
    honoree: {
      required:
        "Add the birthday guest of honour's first name — it goes on the party sheet.",
    },
    topping: { required: "Pick a topping for pizza {n}, or choose cheese." },
    sauce: { required: "Pick a sauce for your wings." },
    notes: {
      tooLong:
        "That's more than we can store. Keep it under 500 characters, and tell your host the rest on the day.",
    },
    ack: {
      rules: "Please confirm you've read the arena rules.",
      deposit: "Please confirm you've read the deposit policy.",
      headcount: "Please confirm you'll give us a final headcount.",
    },
    nameOnFile: { required: "Add the name we should have on the booking." },
  },
  /** Form-level block above the submit button, per DESIGN §5.10. */
  formSummary: "{n} things need a look before we can continue.", // err.form.summary

  /** §8.23 — 404. */
  notFound: {
    title: "We couldn't find that page",
    body: "The link may be old or mistyped. Start a new booking, or look up an existing one with your booking code.",
    action: { primary: "Start a booking", secondary: "Find my booking" },
  },

  /** §8.26 Direct /booking/[code] visit */
  codeNotFound: {
    title: "We couldn't find booking {code}",
    body: "Check the code from your email, or look it up with your phone number.",
  },
} as const;

// ─── §9 Empty states ──────────────────────────────────────────────────────────────────────

const empty = {
  p2: {
    /** Before any date is tapped. */
    pickDate: {
      title: "Pick a date to see party windows.",
      body: "We'll only show you windows with a room big enough for {guests} guests and a party age that matches {age}.",
      /** `empty.p2.pickDate.action` = `{p2.shortcut}` — the soonest-that-fits shortcut. */
    },
    noWindows: {
      title: "No windows on this date.",
      body: "{date} has no two-hour party windows. Parties run weekday evenings and through the day at weekends.",
      /** `empty.p2.noWindows.action` = `{btn.pickAnotherDate}`. */
    },
  },
  p4: {
    noExtras: {
      title: "Nothing added yet.",
      body: "Everything here is optional, and you can add most of it on the day.",
    },
  },
  booking: {
    /** Confirmation page and party sheet. An affirmative statement staff can trust. */
    noAllergies: "None recorded.",
  },
} as const;

// ─── §10 Policy language — do not edit these for tone ─────────────────────────────────────

const policy = {
  deposit: {
    heading: "Deposit",
    /** P7, above the button. */
    oneLine:
      "A non-refundable {deposit} deposit is required for every party booking, and it comes off your balance.",
    body: "Every party booking takes a non-refundable {deposit} deposit. The deposit reserves your room and your window, and it is applied against your total — your balance on the day is your total less the {deposit}.",
    /** P6 acknowledgement 2. This is the whole policy in one paragraph. */
    ackBody:
      "The {deposit} deposit is non-refundable. Cancel or change the date {noticeDays} or more days before your party and the {deposit} becomes a gift card you can use in our facility. Inside {noticeDays} days you forfeit the deposit, or you can move it to a rescheduled date.",
    perBooking: "One {deposit} deposit per party, however many rooms it uses.",
    simulated:
      "No card details are collected on this site. We record your deposit against the booking and our team confirms payment with you.",
  },
  reschedule: {
    heading: "Changing your date",
    body: "We need at least {noticeDays} days' notice to change the date of a booking. With {noticeDays} or more days' notice you can request a new date here and your {deposit} moves to it. Inside {noticeDays} days, a date change is handled by our team rather than online — call {phone}. Your {deposit} still moves to the new date.",
    reValidated:
      "Any new date is checked from scratch: room size, the {ageBand}-year age match with the other party in the window, and the arena. If the new date doesn't work, your original booking stays exactly as it was.",
  },
  cancel: {
    heading: "Cancelling",
    outside:
      "Cancel {noticeDays} or more days before your party and your non-refundable {deposit} deposit is added to a gift card that can be used in our facility.",
    inside:
      "Cancel within {noticeDays} days of your party and you forfeit the deposit, or you can choose to move it to a rescheduled date.",
    noCash: "We don't issue cash refunds on deposits.",
    /** Customer-favourable reading. */
    boundary: "Exactly {noticeDays} days counts as enough notice.",
  },
  giftcard: {
    heading: "Gift cards",
    body: "A gift card issued from a cancelled deposit is worth {deposit} and can be used anywhere in our facility. We email the code when the cancellation goes through.",
    /** The brief states no expiry or transferability rules — do not invent any. */
    terms: "We'll confirm the gift card's terms when we issue it.",
  },
  house: {
    heading: "House rules",
    nutFree: "Our facility is nut-free. Please don't bring anything containing nuts.",
    outsideFood:
      "No outside food, drinks or cake. This includes birthday cakes — cupcakes come with The Great Adventure and Around The World.",
    shoes:
      "Clean closed-toed shoes are required in the arena. Bare feet, sandals and outdoor boots aren't allowed on the floor.",
    allergies: "Tell us about any allergy when you book and we'll brief your host.",
  },
  full: {
    heading: "Deposit and cancellation policy",
    /** VERBATIM FROM BRIEF. Do not edit, reflow or correct spelling. */
    source:
      "For event bookings, a non refundable deposit of $50.00 is required. If you need to change the date of your booking, we require at least 2 weeks notice. Should you need to cancel your booking, please give at least 2 weeks prior to your event. Your non-refundable $50.00 deposit will be added to a GIFT CARD that can be used in our facility if cancelled before 14 days of the party date. If you cancel your booking or change the date within 14 days or less of your event, you forfeit your deposit or have the choice to move to a new rescheduled date.",
    note: "The wording above is our published policy. Everything on this page says the same thing in plainer terms.",
  },
  privacy: {
    short:
      "We use your details for this booking only. We don't sell them or add you to a mailing list.",
    staff:
      "Your name, phone number and any allergy note are visible to our staff so they can run your party.",
  },
} as const;

// ─── §11 Packages and add-ons ─────────────────────────────────────────────────────────────

const pkg = {
  TRAVELER: {
    /** Spelling is the venue's own — one L. Do not "correct" to Traveller. */
    name: "The Traveler",
    tagline: "The essentials, done properly.",
    price: "$224.50 for {baseGuests} guests",
    extra: "$22.45 per extra guest",
    roomTime: "90 minutes in your private room",
    inc: {
      room: "Private party room",
      games: "2 laser tag games",
      merch: "Merch for the birthday guest of honour",
    },
    foodNote: "No food included — add pizza or wings on the next screen.",
  },
  GREAT_ADVENTURE: {
    name: "The Great Adventure",
    /** Factual — matches the "Most booked" label. */
    tagline: "The one most families book.",
    price: "$259.50 for {baseGuests} guests",
    extra: "$25.95 per extra guest",
    roomTime: "2 hours in your private room",
    inc: {
      room: "Private party room",
      games: "2 laser tag games",
      food: "Pizza or hot dogs",
      cupcakes: "Cupcakes",
      merch: "Merch for the birthday guest of honour",
    },
    /** Pizza count from the tier table. */
    foodNote: "{pizzaCount} large 1-topping pizzas for {guests} guests, or hot dogs instead.",
  },
  AROUND_THE_WORLD: {
    name: "Around The World",
    tagline: "Everything we've got.",
    price: "$359.50 for {baseGuests} guests",
    extra: "$35.95 per extra guest",
    roomTime: "2 hours in your private room",
    inc: {
      room: "Private party room",
      games: "2 laser tag games",
      /** Winnipeg-exclusive attraction. */
      frenzy: "Lazer Frenzy",
      typhoon: "The Typhoon Experience ride",
      funcard: "A $10 fun card for every guest",
      food: "Pizza or hot dogs",
      cupcakes: "Cupcakes",
      merch: "Merch for the birthday guest of honour",
    },
    arcadeNote:
      "The arcade cards aren't sold with this one — every guest already gets a $10 fun card.",
  },
  shared: {
    heading: "Every package includes",
    host: "A VIP host",
    drinks: "Soft drinks",
    popcorn: "Popcorn",
    supplies: "Party supplies",
    setup: "Setup and cleanup",
    invitations: "Free downloadable Lasertopia invitations",
    guests:
      "Every package is priced for {baseGuests} guests — that's 9 friends plus the birthday guest of honour.",
  },
} as const;

const addon = {
  ARCADE_5UP_MATCH: {
    name: "5-Up Arcade Card — match",
    body: "Each guest loads $5 and we match it with $5 in Bonus Cash. We match up to $20.",
    unit: "per guest",
  },
  ARCADE_TIMEPLAY_45: {
    name: "45-minute Arcade Time Play card",
    /** R-49. The exclusions are part of the option, not fine print. */
    body: "Unlimited arcade time play for 45 minutes. Earns no prize points, and doesn't work on the claw machines or QBIX.",
    unit: "per guest",
  },
  QBIX_5D: {
    name: "QBIX 5D",
    body: "An immersive 5D interactive game for up to 5 friends, with several game modes and real-world effects — wind, motion, sound and lighting — reacting to what's on screen.",
    unit: "per person",
  },
  PIZZA_CHEESE: { name: "Large cheese pizza" },
  PIZZA_1TOP: { name: "Large 1-topping pizza" },
  PIZZA_2TOP: { name: "Large 2-topping pizza" },
  PIZZA: {
    unit: "each, tax included",
    toppingsLabel: "Toppings",
    toppings: "Pepperoni · Bacon · Hawaiian",
  },
  WINGS_8: { name: "8 wings" },
  WINGS_16: { name: "16 wings" },
  WINGS_24: { name: "24 wings" },
  WINGS: {
    unit: "each, tax included",
    sauceLabel: "Sauce",
    sauces:
      "Louisiana · Dry · Sweet Chili · Honey Garlic · Salt and Pepper · Lemon Pepper · Honey Garlic BBQ",
  },
} as const;

// ─── §12.2 Party confirmation email ───────────────────────────────────────────────────────

const email = {
  subject: "Lasertopia — {honoree}'s party is booked for {dateShort}",
  preheader: "Booking {code} · {window} · {guests} guests · {packageName}",
  heading: "{honoree}'s party is booked",
  intro:
    "Thanks {name}. Everything for {honoree}'s birthday at Lasertopia is below. This email is safe to forward to the other parents — it has the date, the time, the address and what to expect.",
  code: "Booking code: {code}",
  when: {
    heading: "When",
    body: "{date}\nParty window: {window}\nArrive: {startTime} — come 15 minutes early if you can\nLaser tag: {gameTimes}\nYour room: {roomNames}, {roomTime}",
  },
  who: {
    heading: "The party",
    body: "{guests} guests, including {honoree}, who is turning {age}.",
  },
  package: {
    heading: "Your package: {packageName}",
    includes: "Includes: {list}",
  },
  shared:
    "Every package includes a VIP host, soft drinks, popcorn, party supplies, setup and cleanup, merch for the birthday guest of honour, and free downloadable Lasertopia invitations.",
  extras: {
    heading: "Extras",
    none: "No extras added. You can add food or arcade cards any time before the day — call {phone}.",
  },
  money: {
    heading: "Money",
    body: "Total: {total}\nDeposit paid: {deposit}\nBalance due on the day: {balance}",
  },
  allergies: {
    heading: "Allergies and notes",
    none: "None recorded. If that changes, call {phone} and we'll brief your host.",
  },
  rules: {
    heading: "House rules — worth passing on",
    body: "Our facility is nut-free.\nNo outside food, drinks or cake.\nClean closed-toed shoes are required in the arena.",
  },
  where: "Where: {address}",
  invitations: "Download your free Lasertopia invitations: {link}",
  policy: { heading: "Deposit and changes", body: policy.deposit.ackBody },
  change: "Change your date or cancel: {link}",
  help: "Questions? Call {phone}.",
} as const;

// ─── The one object the surface imports ───────────────────────────────────────────────────

export const party = {
  flow,
  p1,
  p2,
  p3,
  p4,
  p5,
  /** `p6.ack.deposit.body` is `policy.deposit.ackBody`; it is reachable both ways. */
  p6: { ...p6, ack: { ...p6.ack, deposit: { ...p6.ack.deposit, body: policy.deposit.ackBody } } },
  p7: { ...p7, policyLine: policy.deposit.oneLine },
  p8,
  p9,
  err,
  empty,
  policy,
  pkg,
  addon,
  email,
} as const;

export type PartyCopy = typeof party;

/** Package codes the deck writes copy for. Seeded packages that are not here are a COPY bug. */
export type PackageCopyCode = keyof Pick<
  typeof pkg,
  "TRAVELER" | "GREAT_ADVENTURE" | "AROUND_THE_WORLD"
>;

/** Add-on codes the deck writes copy for. */
export type AddOnCopyCode = keyof Pick<
  typeof addon,
  | "ARCADE_5UP_MATCH"
  | "ARCADE_TIMEPLAY_45"
  | "QBIX_5D"
  | "PIZZA_CHEESE"
  | "PIZZA_1TOP"
  | "PIZZA_2TOP"
  | "WINGS_8"
  | "WINGS_16"
  | "WINGS_24"
>;
