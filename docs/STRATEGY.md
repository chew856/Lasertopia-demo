# Lasertopia Booking Platform — Product Strategy & Flow Spec

**Author:** Strategist
**Source of truth:** `BRIEF.md`. Nothing here invents a business fact; where the brief is
silent I state the assumption explicitly in §6.
**Scope:** three surfaces only — laser tag booking, birthday party booking, manager
backend. No marketing pages, no About, no gallery, no SEO. lasertopia.ca is untouched
and links into this product.

**Two north stars, and every decision below is subordinate to them:**

1. A parent completes a party booking on a phone in **under four minutes**.
2. Staff **never leave the schedule board** during a shift.

---

## 0. Global rules that apply to every screen

These are stated once so the flow specs don't repeat them.

**Timezone.** All times are `America/Winnipeg`, resolved **server-side**. Never trust the
client clock — the 90-minute cutoff is a money rule and a laptop with a wrong clock must
not be able to book a game that starts in 20 minutes.

**Server-side is the only authority.** Every constraint (cutoff, arena cap, room fit, age
band, blocked slots, closures, guest ceilings) is enforced in a server action at submit,
not merely reflected in the UI. The UI's job is to make rejection rare; the server's job
is to make it impossible.

**Two-phase validation.** Every constraint is checked twice: once when the option list is
built (so impossible options are never offered), and again at the moment of commit (so a
race, a stale tab, or a ticking cutoff can't slip through). A commit-time rejection is a
first-class designed state, not an error page.

**No accounts for customers.** Guest checkout only. Identity is `booking code + phone or
email`. Asking a parent to make a password is a minute of the four we have.

**Draft + soft hold.** Both flows create a server-side draft on the first commit of real
data, addressed by an unguessable `draftId` in the URL. When a customer selects a
specific time (games) or window (party), the server places a **soft hold** on the
inventory: **7 minutes** for laser tag, **10 minutes** for parties. The hold is visible as
a countdown in the sticky bar. It can be extended **once** by the customer ("Need more
time? +5 minutes") and is released automatically on expiry. Without this, the last screen
of the party flow is a coin flip on a busy Saturday, and losing at the last screen after
three minutes of work is the single worst outcome this product can produce.

**Route-per-step.** Each step is its own App Router segment, not client state in a wizard
component. This makes the phone's hardware back button work correctly, makes each step
resumable from a link, and lets each step be a server component that re-validates on
render.

**Failure copy contract.** Every failure state names **(a)** what happened, **(b)** why,
in the venue's terms, and **(c)** the next action, as a tappable control. A bare "Error"
or a silently greyed-out cell is a defect. Strings below are intent + example; the copy
agent may sharpen the wording but may not remove any of the three parts.

**Recovery-by-alternative.** Whenever we reject a choice, we offer the nearest valid
alternatives computed by the same engine that rejected it — never "try another time."

**Booking codes.** `LT-XXXXXXXX` (games) and `PT-XXXXXXXX` (parties), 8 random
characters, monospace everywhere. Long enough to be an unguessable bearer token for the
confirmation page; short enough to read over the phone to a guest.

**Money.** All prices displayed in monospace. Laser tag prices are **plus tax** and shown
as such. Package prices are shown as a subtotal with a tax line (see §6, Risk R7). No
card is ever collected for laser tag. The party $50 deposit uses the simulated checkout
described in §3.2.

---

## 1. Users and jobs

Four users. Each is grounded in a constraint that actually exists in the brief.

### 1.1 Dana — parent booking a 9-year-old's party, three weeks out, on a phone

**Context.** Standing in a kitchen at 9:40pm with the phone in one hand. Found Lasertopia
from lasertopia.ca. Has a rough guest list on a fridge notepad: "about 14, maybe 16."

**Arrives knowing:** the birthday child's age, roughly how many kids, two or three dates
that could work (a Saturday, ideally early afternoon), and a budget instinct rather than a
budget number.

**Does not know:** that Lasertopia has multiple party rooms of different sizes; that
16 guests behaves completely differently from 14; that two parties share a two-hour window
and are matched by age; that the facility is nut-free; that room time is 1.5 or 2 hours
depending on package.

**Anxious about:** picking a time that a dozen other parents can't make; committing $50
non-refundably before checking with anyone; a kid with a nut allergy; not knowing whether
"party of 16" is even a thing here; getting to the end and being told to call.

**"Done" looks like:** a confirmation on screen and in her inbox with the date, arrival
time, room time, what's included, the total, what she owes on the day, the nut-free and
closed-toed-shoes rules, and a phone number — plus something she can forward to the other
parents. She should never have needed to know what a "room-slot" is.

**Design consequence:** guest count and honoree age are asked **first** (§3.2), the
price recomputes for her actual headcount rather than showing the 10-guest sticker price,
and every unavailable window states its reason in her language ("this window already has a
party of 5-year-olds").

### 1.2 Marcus — 16-year-old booking two games for six friends on Friday night

**Context.** Group chat, 5:50pm on a Friday, deciding where to go tonight. Booking on a
phone with 30 seconds of patience.

**Arrives knowing:** roughly how many people ("six of us, maybe seven"), that they want to
play "a couple of games," and that they want to come **soon**.

**Does not know:** the 90-minute walk-in cutoff; that 2 games means two consecutive
15-minute starts; that the arena holds 25 at a time; that some evening slots are held for
parties.

**Anxious about:** getting there and being told to wait; his friend count changing; paying
before he's sure everyone's coming.

**"Done" looks like:** a time, a code, a price per person, and no card entered. He will
pay at the desk.

**Design consequence:** the laser tag flow is four screens with no payment; the 90-minute
cutoff is explained **before** he picks a time, not after; the soonest bookable start is
surfaced immediately ("Next available: 7:45 PM"); and a group of 6 that can't fit a
2-game consecutive block gets told exactly which start times do work.

### 1.3 Priya — the front-desk manager, Saturday 11:20am

**Context.** Standing. A 10–12 party is mid-way, an 11–1 party just arrived, four walk-ins
are at the counter, the phone is ringing, and a party parent wants to add four guests.
She is on a tablet or a desk browser, and she is not going to navigate a menu tree.

**Arrives knowing:** the whole day in her head, roughly. She wants the screen to confirm
it, not re-explain it.

**Anxious about:** double-booking the arena; a party arriving that nobody printed a sheet
for; taking a phone booking into a slot she's already promised to someone; forgetting an
allergy.

**"Done" looks like:** the board on screen all shift, refreshing itself, and every action
she needs reachable from it — block off 3:15 and 3:30 because a party is expanding, print
the 1–3 party sheet, look up "Nguyen," take a phone booking that exceeds the room by one
guest with a reason logged.

**Design consequence:** §4 is a board-first backend. Blocking a game slot is **one tap**.
Room configuration lives in settings and is expected to be touched twice a year.

### 1.4 Sam — evening shift staff and the "boring Tuesday" case

**Context.** Mon–Thu evening, one 5–7 party, a handful of walk-ins. Sam is less
experienced than Priya and will follow whatever the screen says.

**Arrives knowing:** less. Needs the party sheet to be self-explanatory and the check-in
action to be obvious.

**Anxious about:** doing something irreversible.

**"Done" looks like:** party sheet printed, guests checked in, nothing broken.

**Design consequence:** destructive actions (cancel, override, delete) require a second
step and a reason; everything else is undoable with a 10-second toast. The party sheet is
a physical artifact that works with no screen at all.

---

## 2. Route map

Next.js 15 App Router. `(public)` and `(manage)` route groups. Middleware protects
`/manage/*` except `/manage/login`.

### 2.1 Public routes

| Route | Auth | Purpose / renders |
|---|---|---|
| `/` | public | **Router, not a landing page.** Title, two large choice cards (Book Laser Tag / Book a Birthday Party), a "Manage an existing booking" link, address + phone, and a link back to lasertopia.ca. No hero, no marketing copy, no gallery. Server component; static. |
| `/book/games` | public | Laser tag **step 1**: players + number of games. Renders the group/game selector and the standing rules (90-minute cutoff, pay at the desk). |
| `/book/games/[draftId]/time` | public | Laser tag **step 2**: date strip + 15-minute time grid, availability computed for the chosen players × games. Placing a hold happens here. |
| `/book/games/[draftId]/details` | public | Laser tag **step 3**: name, phone, email, optional note. |
| `/book/games/[draftId]/review` | public | Laser tag **step 4**: read-back, price, rules acknowledgement, confirm. Re-validates on render and on submit. |
| `/book/party` | public | Party **step 1**: guest count + honoree age. **The constraint-gathering screen.** |
| `/book/party/[draftId]/date` | public | Party **step 2**: month calendar + windows for the selected date, each with a status and a reason. Places the hold. |
| `/book/party/[draftId]/package` | public | Party **step 3**: three packages priced for the real guest count. |
| `/book/party/[draftId]/extras` | public | Party **step 4**: food, arcade cards, QBIX. Skippable in one tap. |
| `/book/party/[draftId]/details` | public | Party **step 5**: contact, honoree first name, allergies/notes. |
| `/book/party/[draftId]/review` | public | Party **step 6**: full itemised read-back + policy acknowledgements. |
| `/book/party/[draftId]/deposit` | public | Party **step 7**: simulated $50 deposit checkout. |
| `/booking/[code]` | public (code-gated) | Confirmation and the customer's permanent view of a booking. `?new=1` shows the success treatment. Renders differently for games vs party. |
| `/booking/[code]/change` | public (code-gated) | Cancel or request a date change, with the 14-day outcome computed live and stated before the button. |
| `/manage-booking` | public | Lookup form: booking code + (email or phone). On success redirects to `/booking/[code]`. Rate-limited. |
| `/closed` | public | Rendered when the venue has no bookable inventory at all in the browsing window (a full closure). Explains and gives the phone number. |

**Route handlers (public):** `POST /api/holds/[draftId]/extend`, `GET /api/availability/games`, `GET /api/availability/party` — the latter two exist so the date strip and calendar can update without a full navigation. They take the same server engine as the page render, never a second implementation.

### 2.2 Manager routes

| Route | Auth | Purpose / renders |
|---|---|---|
| `/manage/login` | public | Auth.js credentials form. |
| `/manage` | staff | Redirect → `/manage/schedule?date=today`. |
| `/manage/schedule` | staff | **The board.** `?date=YYYY-MM-DD&view=day\|week`. Arena lane + room lanes, live capacity, all shift actions. Default landing and default tab. |
| `/manage/bookings` | staff | List + search. `?q=&type=&status=&from=&to=`. |
| `/manage/bookings/[id]` | staff | Single booking: full detail, edit, deposit status, cancel, activity log. |
| `/manage/bookings/[id]/sheet` | staff | **Printable party sheet.** Light-on-white print layout, one page. |
| `/manage/day/[date]/sheets` | staff | Print all party sheets for a date in one job — the Saturday-morning action. |
| `/manage/rooms` | staff | Rooms inventory (name, capacity, active) and the window→room mapping. |
| `/manage/slots` | staff | Party windows per weekday and the **ordered reserved game-time list** attached to each window. Never hardcoded. |
| `/manage/closures` | staff | Date-level closures, modified hours, and standing blocks. |
| `/manage/settings` | staff | Cutoff minutes, arena cap, booking horizon, packages + prices, extra-guest rates, pizza tiers, add-on prices, policy text, notification email. |
| `/manage/activity` | staff | Audit feed: overrides (with reasons), cancellations, capacity edits, blocks. Read-only. |

**Route handler (manage):** `GET /api/manage/schedule?date=&view=` — polled by the board every 25s. Returns the whole board payload including a server timestamp so the board can render "updated 8s ago."

---

## 3. Screen-by-screen flow specs

### State vocabulary

Used throughout so each screen table stays short. Every one of these has designed copy and
a designed recovery action; none may render as a bare error.

| Code | Meaning |
|---|---|
| `EMPTY` | Nothing to show yet (no date chosen, no results) |
| `LOADING` | Server work in flight |
| `OK` | Normal render |
| `FIELD_INVALID` | Client-side-catchable input problem, echoed by the server |
| `SERVER_ERROR` | Unexpected failure |
| `OFFLINE` | Network unreachable |
| `DAY_CLOSED` | Venue closed that date, or date outside posted hours |
| `DAY_FULL` | Date has zero viable options for **this** request |
| `HORIZON` | Date beyond the booking horizon or in the past |
| `CUTOFF` | Inside the 90-minute walk-in window |
| `SOLD_OUT` | Arena seats remaining < players requested |
| `PARTIAL_BLOCK` | The first game fits but a later consecutive game does not |
| `SLOT_RESERVED` | Held for a party and not released |
| `SLOT_BLOCKED` | Staff blocked it ad hoc |
| `GROUP_TOO_LARGE` | Above the online ceiling (25 players / 28 guests) |
| `ROOM_FIT_FAIL` | No combination of free rooms in this window fits the guest count |
| `WINDOW_FULL` | Every room-slot in the window is taken |
| `AGE_CONFLICT` | Existing party in the window is outside the ±2-year band |
| `ARENA_CONFLICT` | The party's game times can't seat the party inside the 25-player cap |
| `HOLD_EXPIRED` | The soft hold lapsed |
| `RACE_LOST` | Someone committed the same inventory during this session |

---

### 3.1 Surface 1 — Laser tag booking flow

**Shape:** 4 screens + confirmation. No payment. Target: **90 seconds**.

**The two structural decisions:**

1. **Players and game count are chosen before the time grid.** A group of 6 booking 2
   games needs 6 arena seats in **two consecutive 15-minute slots**. A grid rendered
   without knowing "6" and "2" would show green cells that reject on submit. Same
   principle as the party flow (§3.2) and the same justification: one grid cannot be
   simultaneously true for a solo player booking one game and for a group of 12 booking
   three.
2. **"N games" means N consecutive 15-minute starts** (e.g. 6:00 and 6:15). This is how
   the venue physically runs and it is what makes server-side arena accounting possible.
   The customer sees both times explicitly, never "2 games" alone. (See §6, Risk R2 —
   this is a manager-settable behaviour.)

---

#### Screen G1 — `/book/games` · Players & games

**Sees / decides:** two questions on one screen. "How many players?" (stepper, default 2,
range 1–25) and "How many games?" (three cards: 1 game $8.49/person · 2 games
$15.49/person · 3 games $21.49/person, with the per-person price and the group total both
live in monospace). Below: three standing facts — bookings close 90 minutes before start
time; pay at the front desk, no card needed now; clean closed-toed shoes required.

**Data loaded:** prices and the arena cap from settings. Nothing user-specific. This screen
is static and instant — the flow's first paint must never wait on availability.

**Server-validated before advancing:** players is an integer 1–arena cap; games ∈ {1,2,3};
a draft is created and its id returned.

| State | What renders | Recovery |
|---|---|---|
| `OK` | As above. Total updates as the stepper moves. | — |
| `FIELD_INVALID` (players = 0) | Inline under the stepper: "Enter at least 1 player." | Stepper is already focused |
| `GROUP_TOO_LARGE` (>25) | The stepper stops at 25 and reveals a panel: "Our arena holds 25 players at a time. Groups over 25 play in two separate game groups — we'll set that up with you over the phone." with a tap-to-call `204-474-5900` button and a "Book 25 now" option. | Call, or book 25 and phone about the rest |
| `SERVER_ERROR` on Continue | Inline above the button: "We couldn't start your booking. Try again — nothing was saved." + Retry | Retry (idempotent) |
| `OFFLINE` | "You're offline. Your choices are saved on this device." Button disabled with a spinner-free label. | Auto-retries on reconnect |

---

#### Screen G2 — `/book/games/[draftId]/time` · Date & time

**Sees / decides:** the whole availability picture for *their* group size and game count.

- **Date strip** at the top: horizontally scrolling, next N days (horizon, default 60),
  each showing weekday, date, and a status dot — open / limited / full / closed. Changing
  the date is one tap and does not navigate away.
- **Time grid** below: 15-minute starts for the selected day, grouped by hour, each cell
  showing the start time in monospace and seats remaining when it is scarce ("4 left").
  For 2- and 3-game bookings the cell label reads as a block: `6:00 → 6:30` with a
  sub-label "6:00 · 6:15".
- **"Next available"** chip pinned above the grid when today is selected — one tap jumps
  to the soonest legal start. This is the single most valuable control for Marcus.

**Data loaded:** for `(date, players, games)`, the server returns every 15-minute start in
the day's operating window with a status and, when unavailable, a coded reason. Reasons are
computed from: operating hours + closures; the reserved-party-time list for that weekday
(a reserved time is **available** if no party occupies it); staff blocks; the 90-minute
cutoff; and arena seats remaining across all N consecutive slots.

**Validated server-side before advancing:** the chosen start is within operating hours and
not in a closure; every one of the N consecutive slots exists, is not reserved-and-taken,
is not blocked, and has ≥ players seats remaining; start is ≥ 90 minutes from now; a hold
is created for 7 minutes across all N slots.

| State | What renders | Recovery |
|---|---|---|
| `LOADING` | Grid skeleton with the correct number of rows so the page does not jump. Date strip stays interactive. | — |
| `OK` | Grid as described. | — |
| `EMPTY` (no date selected) | Not possible — today, or the first open day, is preselected. | — |
| `CUTOFF` (per cell, today) | Cell rendered struck-through with a small "closed" mark; not tappable but **tapped state is handled**: a sheet says "Bookings close 90 minutes before a game so we can look after walk-ins. It's 6:12 PM, so the earliest we can book you online is **7:45 PM**." with [Take 7:45 PM] and [Call 204-474-5900 — walk-ins welcome]. | Jump to next legal start, or call |
| `SLOT_RESERVED` | Cell shows "Party" in small caps. Tap sheet: "This game is held for a birthday party. If the party doesn't book, it opens up — check back, or pick a nearby time." + the two nearest open starts. | Take a nearby time |
| `SLOT_BLOCKED` | Cell shows "Unavailable." Tap sheet: "We've taken this game out of the schedule. Nearest open games: 6:45 PM, 7:00 PM." | Take a nearby time |
| `SOLD_OUT` | Cell greyed with "Full." Tap sheet: "6:15 PM has 3 seats left and you need 6. Games with room for 6: 6:45 PM, 7:00 PM, 7:15 PM." + [Book 3 now and add the rest at the desk] is **not** offered — it creates a floor problem. Instead: [Reduce group size]. | Take another time, or reduce the group |
| `PARTIAL_BLOCK` (2–3 game blocks) | Cell greyed. Tap sheet: "6:15 PM works, but the 6:30 PM game right after it is full — two games need back-to-back starts. Blocks that fit: 6:45 → 7:15 PM, 7:15 → 7:45 PM." + [Book 1 game at 6:15 instead — $8.49/person]. | Shift the block, or drop to 1 game |
| `DAY_FULL` | Grid replaced by a panel: "Saturday Aug 22 is fully booked for a group of 6. The nearest days with room: **Sun Aug 23** (from 1:15 PM), **Mon Aug 24** (from 12:00 PM)." Two tappable day chips. | Jump to a day that works |
| `DAY_CLOSED` | "We're closed Saturday mornings for private parties — public games start at 12:00 PM." (weekend 10–12) or "We're closed that day." Both list the day's real hours and the next open day. | Pick an open day |
| `HORIZON` | Date strip simply ends; if a deep link supplies a past date: "That date has passed. Showing today instead." and today loads. | Auto-corrected |
| `RACE_LOST` on selection | Toast over the grid: "6:15 PM filled up while you were looking. The grid is up to date now." Grid refreshes in place, selection cleared. | Pick again from fresh data |
| `SERVER_ERROR` | Grid area shows: "We couldn't load times for Saturday. Your group size and game choice are saved." + [Try again] and the phone number. | Retry |
| `OFFLINE` | Last successful grid stays visible, dimmed, with a banner: "Showing times from 2 minutes ago — you're offline. We'll refresh when you're back." Selection disabled. | Reconnect |

---

#### Screen G3 — `/book/games/[draftId]/details` · Who's coming

**Sees / decides:** name, mobile phone, email, optional note. Sticky bar shows the held
booking (date, start block, players, total) and the hold countdown.

**Validated server-side:** name non-empty; phone parses as a North American number; email
is syntactically valid and required (it carries the confirmation); the hold is still live.

| State | What renders | Recovery |
|---|---|---|
| `OK` / `LOADING` | Standard. Autocomplete tokens set so phone keyboards and password managers fill correctly. | — |
| `FIELD_INVALID` | Per-field, under the field, on blur and again on submit: "Enter a phone number we can reach you at, like 204-555-0134." Never a summary block at the top only. | Field is focused |
| `HOLD_EXPIRED` | Full-screen takeover before the form: "Your 7:00 PM hold expired. It's still open — want it back?" [Hold 7:00 PM again] (re-checks and re-holds) / [Pick a different time]. If it is no longer open: "7:00 PM was taken. Closest with room for 6: 7:30 PM." | Re-hold or re-pick |
| `SERVER_ERROR` | "We couldn't save your details. Your time is still held for 4:12." + Retry. | Retry |

---

#### Screen G4 — `/book/games/[draftId]/review` · Confirm

**Sees / decides:** a read-back — date, both start times spelled out, players, per-person
price, subtotal, "plus tax", and **"Pay at the front desk — no card needed now."** Rules
acknowledgement checkbox covering closed-toed shoes and the nut-free / no-outside-food
policy. One primary button: **Confirm booking**.

**Re-validated at render and again at submit:** the entire availability check from G2, plus
the cutoff recomputed at the current second, plus the hold.

| State | What renders | Recovery |
|---|---|---|
| `OK` | As above, with the hold countdown in the sticky bar. | — |
| `FIELD_INVALID` | Acknowledgement unchecked: "Please confirm you've read the arena rules." under the checkbox. | — |
| `CUTOFF` **at submit** | The critical late failure. Full panel replacing the button: "7:00 PM is now inside our 90-minute walk-in window, so we can't book it online. The earliest online start is **8:30 PM**." [Move my booking to 8:30 PM — keeps everything else] · [Call 204-474-5900 — walk-ins are welcome] | One tap to shift; details are preserved |
| `SOLD_OUT` / `RACE_LOST` at submit | "Someone booked the last 4 seats at 7:00 PM a moment ago. These have room for 6: **7:30 PM**, **7:45 PM**." Two one-tap buttons that keep name, phone, email. | One tap to move |
| `HOLD_EXPIRED` | As G3. | Re-hold |
| `SERVER_ERROR` | "Your booking didn't go through and nothing was charged — you haven't paid anything. Try again, or call us and we'll book it by hand." + Retry + tap-to-call. Retry is **idempotent** on the draft id so a double-tap cannot create two bookings. | Retry or call |

---

#### Screen G5 — `/booking/[code]?new=1` · Confirmed

**Sees:** booking code in large monospace; date and both start times; players; amount due
at the desk; address; "arrive 15 minutes early"; shoes + nut-free rules; tap-to-call;
[Add to calendar]; [Cancel this booking]. Email sent with the same content.

| State | What renders | Recovery |
|---|---|---|
| `OK` | As above. | — |
| Code not found / wrong code | "We couldn't find booking LT-XXXXXXXX. Check the code from your email, or look it up with your phone number." → link to `/manage-booking`. | Lookup |
| Already cancelled | The record renders with a `CANCELLED` band and the cancellation date. | [Book again] prefilled |
| Past booking | Renders with a `COMPLETED` band. | [Book again] |

**Cancellation (games):** free, any time before the cutoff, one tap with a confirm step,
because there is no money at stake and a released seat is worth more than a punitive rule.

---

### 3.2 Surface 2 — Birthday party booking flow

**Shape:** 7 screens. Target: **under 4 minutes**, which the step budget below is designed
to hit.

#### THE central decision: guest count and honoree age are collected **before** date and time

**Recommendation: guest count first. This is not a preference; the alternative is not
implementable correctly.**

The argument:

- A window's availability is **not a property of the window**. It is a function of
  `(window, guestCount, honoreeAge)`. Saturday 11am–1pm has two rooms, max 12 and max 14.
  If a party of 10 is already in the 12-room, that window is **perfectly available** to a
  party of 14 and **impossible** for a party of 16 — because 16 needs both rooms and only
  one is free. One calendar cell, two opposite truths. A grid rendered before we know the
  guest count is therefore **guaranteed to be wrong for some users**, and the ones it is
  wrong for are the high-value large bookings.
- The same is true of age. Two parties share a two-hour window and their ages must be
  within two years. A window holding a booked party of 6-year-olds is open to a 7-year-old
  and closed to a 12-year-old. Age is a **filter on the calendar**, not a detail field.
- Guest count is the parent's **cheapest** piece of information and her **most stable**.
  She knows "about 14" before she knows which Saturday. Date is what she is willing to flex
  — headcount is not. Asking for the flexible thing first and the fixed thing second is
  backwards.
- The failure mode of the other ordering is the worst one available: the parent invests in
  choosing a date, commits emotionally to Saturday the 22nd at 1pm, and *then* gets told it
  doesn't fit. That is a dead end at the emotional peak of the flow, and the only honest
  recovery is "start over."
- Cost of getting it right: **one screen, two fields, ~15 seconds**, with a sensible
  default of 10 guests (the package base) already selected.

**Consequences we accept and mitigate:**

- The first screen is a form rather than something appealing. Mitigated by making it one
  short screen with big controls, live feedback that *rewards* input ("14 guests fits our
  largest party room"), and prices previewed the moment a count is entered.
- Guest counts change. Mitigated by making guest count **editable from the review screen
  and from the confirmation page**, with re-validation and a specific message when the new
  count no longer fits the held window (below), rather than a silent failure.

**Rejected alternative:** date-first with a post-hoc guest-count filter that re-renders the
calendar. It is the same computation with an extra round trip, an extra chance to render a
lie, and a back-button trail through invalidated choices. No.

---

#### Screen P1 — `/book/party` · Party size & age

**Sees / decides:**
- "How many guests, including the birthday guest of honour?" — stepper, default **10**,
  range 6–28. Live helper text under it, driven by the rooms engine, not hardcoded:
  - 10: "Included in every package."
  - 12: "2 guests over the 10 included — priced on the next screen."
  - 16: "Parties over 14 use two of our rooms together, so fewer time windows will be open. We'll only show you windows where both rooms are free."
  - 22: "Parties over 20 use three rooms. These are rare — usually weekend mornings."
- "How old is the birthday guest of honour turning?" — stepper/select, 3–17, with a short
  reason attached because the question is unusual: *"We seat two parties of similar ages
  in the same two-hour window, so we ask up front — it means we only show you windows that
  actually work."*
- Standing facts, three lines: 2-hour party windows · $50 deposit to reserve, applied to
  your balance · nut-free facility, no outside food, drinks or cake.

**Data loaded:** room inventory (for max online guest count and the helper thresholds),
package base guest count. No availability yet.

**Validated server-side:** guestCount integer within [min, onlineMax]; honoreeAge within
[3,17]; draft created.

| State | What renders | Recovery |
|---|---|---|
| `OK` | As above. | — |
| `FIELD_INVALID` (age blank) | "We need the birthday age to match your party with a compatible one." | Field focused |
| `GROUP_TOO_LARGE` (>28) | Stepper stops at 28 and reveals: "We can host up to 28 guests, which uses three of our rooms. For a bigger group, call us — we'll build something custom." + tap-to-call + [Book for 28]. | Call, or 28 |
| `SERVER_ERROR` | "We couldn't start your booking. Nothing was saved — try again." | Retry |

---

#### Screen P2 — `/book/party/[draftId]/date` · Date & window

**This screen is the product.** It is where the constraint engine becomes visible, and it
must never grey something out without saying why.

**Sees / decides:**
- **Month calendar**, current month first, arrows to advance to the horizon. Each date
  carries one of four marks: **open** (at least one window fits this party), **limited**
  (exactly one window fits), **full** (no window fits this party — note the wording,
  because the venue may not be full for a different party), **closed**.
- Tapping a date reveals **window rows below the calendar** — full-width, one per two-hour
  window on that date, each showing the window time in monospace, the number of guests it
  can hold for this booking, and either a Select action or a stated reason.
- A persistent line above the calendar restates the constraint being applied: **"Showing
  windows for 16 guests, turning 9."** with an [Edit] link back to P1 that preserves the
  draft. This is essential — a parent seeing a lot of grey must be able to see *why* in one
  glance and act on it.

**Data loaded:** for `(month, guestCount, honoreeAge)` the engine returns per date a
rollup, and per window: status, the room combination that would be allocated, the effective
capacity of that combination, the party's proposed game times, and a reason code when
unavailable. Physical room contention across **overlapping windows** (Sat 10–12 vs 11–1;
Sun 3–5 vs 4–6) is resolved by the engine, not the UI.

**Validated server-side before advancing:** the window is open on that date; a room
combination exists whose combined capacity ≥ guestCount and whose rooms are free for the
window's full span *including overlap with adjacent windows*; every already-booked party in
the window is within ±2 years of the honoree; the party's game times can seat guestCount
inside the 25-player arena cap; the date is within the horizon and beyond the minimum lead
time; a 10-minute hold is placed on the room combination **and** the arena seats.

| State | What renders | Recovery |
|---|---|---|
| `LOADING` | Calendar renders immediately with a skeleton status layer; dates become tappable as statuses land. Never a blank month. | — |
| `EMPTY` (no date tapped) | Under the calendar: "Pick a date to see party windows." Plus a shortcut row: **"Soonest that fits 16 guests: Sat Aug 22, 1–3 PM"** as a one-tap button — the single most useful control on the screen for a flexible parent. | Tap the shortcut |
| `OK` | Window rows, e.g. `1:00 – 3:00 PM · fits up to 20 guests · [Select]`. Under a selected row, before advancing: "Your two laser tag games: **1:15 PM** and **1:45 PM**." | — |
| `ROOM_FIT_FAIL` (per window) | Row is inactive with the reason **on the row**, not hidden: "Fits up to 14 — your party of 16 needs two rooms and one is already booked." Tapping the row opens a sheet with: [See dates where 16 fits] (jumps the calendar to the next such date) · [Book 14 guests here instead] (edits the count, re-validates, and says so plainly) · [Call us]. | Change date, or change count |
| `AGE_CONFLICT` (per window) | "This window already has a party for a 5-year-old, and we seat parties within two years of each other." + sheet: [See windows that fit a 9-year-old on this date] · [Nearest date and time: Sun Aug 23, 1–3 PM]. **We never reveal the other family's name — only the age.** | Move date/time |
| `WINDOW_FULL` | "Both party rooms are booked for this window." + nearest alternatives. | Move |
| `ARENA_CONFLICT` | "Our arena is at capacity during this window's game times." + nearest alternatives. Rare; must still be explained rather than shown as generic "full". | Move |
| `DAY_FULL` | Instead of empty window rows: "Saturday Aug 22 has no windows that fit 16 guests turning 9. Nearest that do: **Sun Aug 23, 10 AM–12 PM** · **Sat Aug 29, 1–3 PM**." Two one-tap buttons. Plus [Would 14 guests work? Two windows open up]. | Jump date, or reduce count |
| `DAY_CLOSED` | "We're closed that day." with the next open date. | Jump |
| `HORIZON` / lead time | Dates before the minimum lead render as: "Parties need at least 48 hours' notice to set up. For something sooner, call 204-474-5900." | Call |
| `MONTH_EMPTY` | Whole month unavailable for this party: "No windows in September fit 16 guests. October has 6." + [Go to October]. | Jump month |
| `RACE_LOST` at Select | "That window was booked a moment ago." Calendar and rows refresh in place; the taken row updates with its new reason. | Pick again |
| `SERVER_ERROR` | "We couldn't load availability. Your party details are saved." + Retry + phone. | Retry |
| `OFFLINE` | Calendar dims with "You're offline — these times may be out of date." Selection disabled. | Reconnect |

---

#### Screen P3 — `/book/party/[draftId]/package` · Package

**Sees / decides:** three package cards, **priced for the actual guest count** — this is the
point of asking first. For 16 guests: The Traveler `$224.50 + 6 × $22.45 = $359.20`, The
Great Adventure `$259.50 + 6 × $25.95 = $415.20`, Around The World `$359.50 + 6 × $35.95 =
$575.20`. The arithmetic is shown, not just the total, so the parent can audit it. Each
card lists inclusions verbatim from the brief plus the room time (1.5 hrs / 2 hrs / 2 hrs).
Every package card states the shared inclusions once, below the three cards, not three
times.

Sticky bar: window + date + guest count + hold countdown.

**Data loaded:** packages, base price, extra-guest rate, included guest count, room minutes,
whether food is included — all from settings, never hardcoded.

**Validated server-side:** package exists and is active; hold is live.

| State | What renders | Recovery |
|---|---|---|
| `OK` | Three cards, middle one (Great Adventure) marked "Most booked" — a factual label the manager can toggle, not a fake urgency device. | — |
| `HOLD_EXPIRED` | "Your 1–3 PM hold expired — it's still open." [Hold it again] / [Pick another window]. If gone: nearest alternatives. | Re-hold or re-pick |
| `SERVER_ERROR` | "We couldn't load packages. Your window is held for 6:41." + Retry | Retry |

---

#### Screen P4 — `/book/party/[draftId]/extras` · Extras (skippable)

**Sees / decides:** the revenue screen, kept to one tap of cost if she wants none.
Top control: **[No extras — continue]** as a full-width secondary button, *above* the
options, so skipping is faster than reading.

Options, each collapsed to a single line with a toggle:
- **Food.** If the package includes pizza: "Your package includes **4 large 1-topping
  pizzas** for 16 guests" with topping selects (Pepperoni / Bacon / Hawaiian) and
  [Add another pizza] priced from the brief. If the package includes no food (The
  Traveler — see §6 R1): "Add pizza for your party — 4 large 1-topping recommended for 16
  guests."
- **Wings.** 8 / 16 / 24 with prices.
- **QBIX 5D** — $3.95/person, with the line total computed for the guest count.
- **5-Up Arcade Card** — only rendered for Traveler and Great Adventure (per the brief).
  Two mutually exclusive choices presented as a single question, because presenting them as
  two products confuses: "$5 per guest, matched with $5 bonus cash (matched up to $20)" or
  "$5 per guest for 45 minutes of unlimited arcade time play — no prize points, and not
  valid on claw machines or QBIX." The exclusion text is **not** fine print; it sits in the
  option.

**Validated server-side:** arcade card only on eligible packages; pizza counts ≥ the
package-included count; QBIX quantity ≤ guest count; toppings from the allowed set.

| State | What renders | Recovery |
|---|---|---|
| `OK` / `EMPTY` | Everything off by default; running total in the sticky bar updates on each toggle. | — |
| `FIELD_INVALID` | "Pick a topping for pizza 3." inline. | Focus |
| Ineligible add-on via stale state | "The 5-Up Arcade Card isn't available with Around The World — we've removed it. Your total is now $575.20." Stated, not silent. | None needed |
| `SERVER_ERROR` | Retry, with selections preserved. | Retry |

---

#### Screen P5 — `/book/party/[draftId]/details` · Your details

**Sees / decides:** organiser name, mobile, email; **birthday guest of honour's first
name** (it goes on the party sheet and the room); allergies & notes with an explicit
prompt: *"Our facility is nut-free and we can't allow outside food, drinks or cake. Tell us
about any other allergies and we'll brief your host."*

**Validated server-side:** name, phone, email present and well-formed; honoree first name
present; notes length-capped and stored as plain text.

| State | What renders | Recovery |
|---|---|---|
| `OK` | Autocomplete-friendly single column. | — |
| `FIELD_INVALID` | Per-field, specific: "We send your confirmation and party sheet here — please add an email." | Focus |
| `HOLD_EXPIRED` | As P3, with all entered details preserved through the re-hold. | Re-hold |
| `SERVER_ERROR` | "We couldn't save your details. Your window is held for 3:20." | Retry |

---

#### Screen P6 — `/book/party/[draftId]/review` · Review

**Sees / decides:** the whole booking in one scroll, in this order: date + window + arrival
time; the two game times; guest count and honoree name/age; room time (1.5 or 2 hrs);
package with its inclusions; extras; **itemised price with the extra-guest maths visible**;
tax line; **$50 deposit due now**; **balance due on the day**.

Then three acknowledgement checkboxes, separate because they carry different weight:
1. Nut-free facility; no outside food, drinks or cake; clean closed-toed shoes in the arena.
2. The $50 deposit is non-refundable. Cancel or change the date **14+ days** before and the
   $50 becomes a gift card for use in the facility. **Inside 14 days**, the deposit is
   forfeited, or it can be moved to a rescheduled date.
3. Final guest count confirmation (see §6 R5) — "I'll confirm my final headcount at least 7
   days before."

**Guest count is editable here.** [Edit guest count] re-runs the fit check against the held
window.

**Re-validated on render and at submit:** the complete P2 check plus the hold plus pricing
recomputation from server-side settings (never from posted client totals).

| State | What renders | Recovery |
|---|---|---|
| `OK` | As above. Primary button: **Reserve with $50 deposit**. | — |
| Guest count edited, still fits | "Updated — 14 guests, $359.20 total." Inline, no navigation. | — |
| Guest count edited, `ROOM_FIT_FAIL` | "1–3 PM on Aug 22 fits up to 14 guests. To bring 18, you'd need a different window." [Keep 14 guests] · [Find a window for 18] (returns to P2 with the new count, preserving everything else). | Two clear paths |
| `FIELD_INVALID` | Unchecked acknowledgement is highlighted individually with the reason. | Focus |
| `RACE_LOST` / `WINDOW_FULL` at submit | Should be near-impossible because of the hold; if it happens: "We're very sorry — 1–3 PM was just confirmed for another party and your hold didn't take. **Nothing has been charged.** These fit your party: Sat Aug 22 **3–5 PM** · Sun Aug 23 **1–3 PM**." One-tap moves that preserve everything else, plus tap-to-call. | Move, or call |
| `HOLD_EXPIRED` | As P3. | Re-hold |
| `SERVER_ERROR` | "Your party wasn't booked and nothing was charged. Try again, or call 204-474-5900 and we'll book it by hand." Idempotent retry keyed on the draft. | Retry or call |

---

#### Screen P7 — `/book/party/[draftId]/deposit` · Deposit (simulated)

**Sees / decides:** a focused checkout panel — one line ("$50.00 deposit for [name]'s party,
Sat Aug 22, 1–3 PM"), a name-on-file field, and **Pay $50 deposit**. A clearly worded
notice, not hidden: *"This deposit is recorded against your booking. No card details are
collected on this site — our team will confirm payment with you."* The policy summary
repeats in one line above the button.

**Validated server-side:** booking is in `PENDING_DEPOSIT`; the hold or the confirmed
inventory still holds; deposit amount comes from settings. On success: `Deposit` record
created (amount, method `SIMULATED`, timestamp), booking → `CONFIRMED`, hold converted to a
real reservation, confirmation email sent, manager notified.

| State | What renders | Recovery |
|---|---|---|
| `OK` | As above. | — |
| `LOADING` | Button becomes a labelled progress state ("Reserving your party…"), form locks, **no double-submit possible**. | — |
| `SERVER_ERROR` | "We couldn't complete your reservation and nothing was charged. Your details are saved — try again, or call us and we'll finish it for you." + Retry + tap-to-call. | Retry or call |
| Double-submit / refresh | Idempotency key on the draft returns the existing booking and redirects to `/booking/[code]` rather than creating a second party. | Automatic |

---

#### Screen P8 — `/booking/[code]?new=1` · Confirmed

**Sees:** booking code in large monospace; the honoree's name and date; arrival time and
window; **game times**; room time; guest count; package and extras; total, deposit paid,
balance due on the day; allergies as recorded; the nut-free / no-outside-food /
closed-toed-shoes rules; address and tap-to-call; [Add to calendar]; [Download Lasertopia
invitations]; [Change date or cancel].

Email carries the same content — this is the artifact Dana forwards to the other parents.

---

#### Screen P9 — `/booking/[code]/change` · Change or cancel

The 14-day policy is the sharpest edge in this product, so the **outcome is computed and
stated before the button, in dollars**:

- **≥14 days out:** "Your party is 21 days away. If you cancel now, your $50 deposit
  becomes a **gift card** you can use in the facility. If you'd rather move the date, we
  can do that too." → [Request a new date] · [Cancel and issue gift card]
- **<14 days out:** "Your party is **9 days** away. Inside 14 days, the $50 deposit can't
  be refunded or turned into a gift card. You can **move it to a new date** and keep the
  $50 on that booking, or cancel and forfeit it." → [Request a new date — keeps your $50]
  (visually primary) · [Cancel anyway]

Date changes are a **request**, not a self-serve rebook — the room/age/arena fit has to be
re-solved and the manager may need to move the other party in the window. The request
posts to the board as an action item and confirms by phone or email. This is honest about
how the venue actually works and avoids a self-serve path that can strand a booking between
two windows.

| State | What renders | Recovery |
|---|---|---|
| `OK` | As above. | — |
| Already cancelled | Status band + what happened to the deposit. | [Book again] |
| Inside 48h of the party | "We're too close to your party to change it online — please call 204-474-5900." | Call |
| `SERVER_ERROR` | "We couldn't submit your request. Call 204-474-5900 and we'll sort it out." | Call |

---

### 3.3 Time budget check (party flow, phone)

| Step | Target |
|---|---|
| P1 size & age (default 10 preselected) | 0:15 |
| P2 date + window (shortcut chip or 2 taps) | 0:45 |
| P3 package | 0:20 |
| P4 extras (skip = 1 tap; engaged = 0:50) | 0:05–0:50 |
| P5 details (autofill) | 0:50 |
| P6 review + 3 checkboxes | 0:40 |
| P7 deposit | 0:20 |
| **Total** | **3:15 – 4:00** |

The budget is why extras is skip-first, why there is no account, and why guest count is a
stepper with a default rather than a free-text field.

---

## 4. Manager backend spec

**Design premise:** Priya is standing, on a tablet or a desk browser, with a queue in front
of her. The measure of success is that she does not navigate. `/manage/schedule` is the
landing route, the default tab, and the place every action returns to.

### 4.1 `/manage/schedule` — the board

**Layout.** A date control at the top (◀ TODAY ▶, a date picker, and a Day/Week toggle).
Below it, a single scrollable time-axis grid running the day's operating span:

- **Arena lane** (leftmost, always visible, sticky): one row per 15-minute game start.
  Each row shows the time in monospace and **seats used / cap** (`14/25`) with a fill bar.
  Rows carry markers: `PARTY` (reserved for a party window), `BLOCKED` (staff), `OVERRIDE`
  (capacity overridden, with a badge), `PAST` (dimmed).
- **Room lanes**: one column per active room. Party bookings render as blocks spanning
  their two-hour window, labelled with honoree name, age, guest count, package, and a
  deposit indicator. A party occupying two or three rooms renders as one block spanning
  those columns, which makes the "16 guests uses two rooms" reality visible at a glance.
- **Overlapping windows** (Sat 10–12 / 11–1) render as genuinely overlapping blocks on the
  time axis, because that is the physical truth Priya is managing.

**Header strip — the shift dashboard, always on screen, never a separate page:**
next 3 arrivals with times and names · today's party count · **deposits outstanding**
(count, tappable) · **allergy flags today** (count, tappable — this must be impossible to
miss) · overrides today · a "updated 8s ago" indicator.

**Live.** Polls `/api/manage/schedule` every 25 seconds. New bookings that arrive during
the shift get a `NEW` badge that clears when tapped. No manual refresh button is needed but
one exists.

**Week view** is a compressed 7-column read-only overview for planning ("is the 22nd
heavy?"), with a tap to open a day. All actions live in Day view.

### 4.2 One click vs. two clicks vs. buried

| Action | Cost | Where |
|---|---|---|
| See a game slot's seats and who's booked | **1 tap** | Tap the arena row → popover |
| **Block a game slot** ("we sometimes book off other slots for parties") | **1 tap** | Popover → [Block]. Applies instantly, 10-second undo toast. Optional reason typed after the fact. |
| Unblock | **1 tap** | Same popover |
| **Block a range** | **2 taps** | [Block range] in the popover → from/to time → apply. For "we need 3:15 through 4:00 for a party." |
| Print a party sheet | **1 tap** | Party block → [Print sheet] |
| Print all of today's party sheets | **1 tap** | Header strip → [Print today's sheets] |
| See a customer's phone number | **1 tap** | Party/booking block popover, number is tap-to-call |
| Mark deposit collected | **1 tap** | Party popover → [Deposit collected] (records method + staff + time) |
| Check a booking in | **1 tap** | Arena row popover, per booking |
| **Add a phone/walk-in booking** | **2 taps** | Board → [+ Booking] → a modal that runs the *same* engine as the public flow, with a staff-only "Override" affordance |
| **Capacity override** | **2 taps + reason** | Modal, reason **required** (see below) |
| Cancel a booking | **2 taps + confirm** | Booking detail; shows the deposit consequence before confirming |
| Edit a party's guest count | **2 taps** | Party block → [Edit guests] → re-runs fit; if it no longer fits, offers rooms to add or an override |
| Search all bookings | **1 tap to the page** | `/manage/bookings` |
| Rooms & capacities | **buried** | `/manage/rooms` — touched twice a year |
| Party windows & reserved game times | **buried** | `/manage/slots` |
| Prices, packages, pizza tiers, cutoff minutes, arena cap, horizon | **buried** | `/manage/settings` |
| Closures / holiday hours | **buried** | `/manage/closures` |

**Rule:** anything Priya does more than once a shift is one tap from the board. Anything she
does less than once a month is behind a settings page and may be a full form.

### 4.3 Blocking, in detail

Blocking is the manager's most-used write action and it exists because of one verbatim line
in the brief: *"We sometimes have to book off other time slots for parties as well."*

- A block is an inventory record with `date`, `startTime`, optional `endTime`, optional
  `reason`, `createdBy`, `createdAt`. It removes the slot from public availability
  immediately.
- Blocking a slot that **already has bookings** is allowed but requires acknowledgement:
  "6:15 PM has 2 bookings (8 players). Blocking it stops new bookings but does not cancel
  them." → [Block anyway] · [See the bookings first]. We never silently orphan a customer.
- Blocks are visible on the board with the reason on hover/tap, and appear in
  `/manage/activity`.
- Recurring blocks (every Tuesday 5:15) live in `/manage/slots`, not on the board — the
  board is for today's exceptions.

### 4.4 Capacity override

Used when Priya knowingly exceeds a computed limit — a room by one guest, the arena by two
players, a window's age band for a family that asked.

- Modal, triggered only from an action that was rejected. It **restates what is being
  broken in specific terms**: "The 1–3 PM room set holds 14. You're booking 16. Overriding
  puts 2 guests over room capacity." Never a generic "force."
- **Reason is required.** Preset chips — Manager approved · Correcting a staff error ·
  Phone booking · Regular customer · Special arrangement — plus a free-text field. Presets
  make it one extra tap in the common case, which is what keeps the field honest.
- Recorded with staff identity and timestamp, surfaced on the booking, badged on the board
  slot for the rest of that day, and listed in `/manage/activity`.
- **Two limits are never overridable without a second, explicit confirmation**: the arena's
  25-player cap (it is a safety/experience limit) and the ±2-year age band (it affects
  another family who already booked). Both show who else is affected before confirming.

### 4.5 `/manage/bookings` — list & search

- Single search field, autofocused, matching **booking code, last name, first name, phone
  (any format), email, and honoree name**. One field; Priya types "Nguyen" or "204555"
  or "PT-4KJ2QW9X" and it works.
- Default view: **today and forward**, newest bookings first, with a type filter (Games /
  Parties / All) and a status filter (Confirmed / Pending deposit / Cancelled / Completed).
  A date range for the rest.
- Row: date · time · type · name · guests/players · status · deposit · a tap-to-call phone
  icon. Monospace for every time, count and price.
- **Pending-deposit parties are pinned to the top** with an amber marker when any exist —
  this is money on the floor.
- Empty state: "No bookings match 'Nguyn'. Try a phone number or booking code." — with the
  query echoed so a typo is visible.

### 4.6 `/manage/bookings/[id]` — detail

Everything about one booking, editable in place: date/window (edit re-runs the full fit
check and shows what would break), guest count, package, extras, contact, allergies,
deposit status and method, price breakdown with any override noted, and a chronological
activity log (created via web / deposit recorded / guest count changed by Priya / override
with reason). [Print sheet] and [Cancel booking] at the bottom; cancel restates the deposit
consequence in dollars before it will proceed.

### 4.7 Printable party sheet — `/manage/bookings/[id]/sheet`

A **physical artifact for the floor**, not a screenshot of the app. Print stylesheet:
black on white, no dark canvas, one page, high contrast, large type, readable at arm's
length on a clipboard in a loud room.

Contents, in order of size:
1. **Honoree first name + age turning** — largest thing on the page.
2. **Date · arrival time · window · room name(s)** — monospace, second largest.
3. **Guest count** and package name.
4. **Game times** — boxed, monospace. The host's schedule anchors.
5. **Food** — pizza count and toppings, wings and sauces, cake note ("no outside cake").
6. **Add-ons** — QBIX (yes/no + count), arcade cards (which type), fun cards.
7. **ALLERGIES / NOTES** — in a heavy-ruled box even when empty (an empty box prints
   "None recorded", which is an affirmative statement staff can trust).
8. **Organiser name + phone.**
9. **Host checklist** with printed checkboxes and blank time fields: room set · guests
   arrived · game 1 · game 2 · food served · cake/cupcakes · merch to honoree · prizes ·
   room cleared. Plus a blank "Host:" line.
10. Balance due on the day and deposit status, small, at the foot.

`/manage/day/[date]/sheets` prints all of a date's sheets with a page break between them —
the Saturday-morning ritual, one tap from the board header.

### 4.8 Rooms, windows and settings (the buried tier)

- **`/manage/rooms`** — a real inventory table: name, capacity, active. Add or resize a room
  without a code change (brief gap #6). A room in use by a future booking cannot be deleted
  or shrunk below a booked party without a warning that names the affected bookings.
- **`/manage/slots`** — per weekday: the two-hour party windows, which rooms each window can
  use, and the **ordered list of reserved game times** attached to each window (brief gap
  #3). Editing shows a preview of which future dates it would change and warns if any
  existing booking would be invalidated.
- **`/manage/closures`** — one-off closures and modified hours, with a warning listing any
  bookings the closure would strand.
- **`/manage/settings`** — cutoff minutes (default 90), arena cap (default 25), booking
  horizon, minimum party lead time, package definitions and prices, extra-guest rates,
  included guest count, room minutes per package, whether a package includes food, pizza
  tiers, add-on prices and eligibility, deposit amount, cancellation window (14 days),
  policy text. **Every number in §3 comes from here.** Nothing in the flow may be hardcoded.

---

## 5. Information hierarchy per screen

Ranked most → least dominant. The Visual Concept agent should size, weight and place from
these lists; anything not listed is chrome.

**`/` router** — 1. The two choice cards (equal weight, full width on mobile) · 2. "Book
Lasertopia" wordmark/title · 3. Manage an existing booking · 4. Phone + address · 5. Link
back to lasertopia.ca.

**G1 players & games** — 1. The three game-count cards with per-person price ·
2. The player stepper · 3. Live group total · 4. Continue · 5. The three standing facts
(cutoff, pay at desk, shoes) — present but quiet.

**G2 time grid** — 1. The time grid itself; it should occupy most of the viewport ·
2. The date strip · 3. "Next available" chip when today is selected · 4. Seats-remaining
counts inside scarce cells · 5. The persistent "6 players · 2 games" context line ·
6. Sticky footer with total.

**G3 details** — 1. The three fields · 2. Sticky summary with the held time and countdown ·
3. Continue · 4. Privacy/one-line reassurance.

**G4 review** — 1. Date and the two start times, monospace, largest thing on screen ·
2. **Confirm booking** · 3. Price and "plus tax" · 4. "Pay at the front desk" ·
5. Players · 6. Rules acknowledgement · 7. Edit links.

**G5/P8 confirmation** — 1. Booking code, monospace, huge · 2. Date + time(s) · 3. What to
do on arrival (arrive 15 early, shoes, address) · 4. Amount due at the desk / balance ·
5. Tap-to-call · 6. Add to calendar, invitations, change/cancel.

**P1 size & age** — 1. Guest stepper with its live helper line · 2. Age control with its
one-line reason · 3. Continue · 4. The three standing facts (2-hour windows, $50 deposit,
nut-free) · 5. Package price preview.

**P2 date & window** — 1. The window rows for the selected date — **these carry the
decision and the reasons, and must be the visual anchor, not a footnote under the
calendar** · 2. The calendar grid · 3. The "Showing windows for 16 guests, turning 9 ·
Edit" context line · 4. The "Soonest that fits" shortcut · 5. Month navigation · 6. Sticky
footer.

**P3 package** — 1. The three package cards · 2. Computed total per card with the
extra-guest arithmetic shown · 3. Inclusions list per card · 4. Shared inclusions block ·
5. Room time · 6. Sticky bar with window + countdown.

**P4 extras** — 1. **[No extras — continue]** · 2. Food row (highest attach rate) ·
3. Running total in the sticky bar · 4. QBIX · 5. Wings · 6. Arcade card with its
exclusions.

**P5 details** — 1. Contact fields · 2. Honoree first name · 3. Allergies box with the
nut-free prompt · 4. Continue · 5. Sticky summary.

**P6 review** — 1. Date, window, arrival time, game times · 2. **$50 deposit due now /
balance due on the day** · 3. Itemised total with extra-guest maths · 4. Guest count +
honoree · 5. The three acknowledgements — the cancellation one visually heavier than the
other two · 6. Package and extras detail · 7. Edit links.

**P7 deposit** — 1. The $50 amount and what it's for · 2. **Pay $50 deposit** · 3. The
"no card details collected" notice · 4. One-line policy restatement · 5. Booking summary.

**P9 change/cancel** — 1. The **computed outcome sentence in dollars** ("your $50 becomes a
gift card" / "you'd forfeit $50") · 2. The two action buttons, with the non-punitive one
primary · 3. The booking summary · 4. Phone number · 5. Full policy text.

**`/manage/schedule`** — 1. **The arena lane's seats-used numbers and the party blocks** —
this is the shift, and it should read from two metres away · 2. The date control and
Day/Week toggle · 3. The header strip (next arrivals, deposits outstanding, allergy flags)
· 4. Block/override badges on affected rows · 5. The "updated Ns ago" indicator ·
6. Navigation to other manage pages — deliberately recessive; leaving the board is not the
happy path.

**`/manage/bookings`** — 1. The search field · 2. Pinned pending-deposit rows · 3. The
result rows (date/time monospace, name, count, status) · 4. Filters · 5. Pagination.

**`/manage/bookings/[id]`** — 1. Name, date, window, guest count · 2. Allergies/notes ·
3. Deposit status and balance · 4. Package and extras · 5. [Print sheet] · 6. Activity log ·
7. Cancel, at the bottom, visually quiet.

**Party sheet (print)** — as enumerated in §4.7; the honoree's name and the allergy box are
the two things a host must never miss.

---

## 6. Risks and open questions

Each item: the ambiguity, the assumption I designed against, and what changes if the
manager answers differently. **R1–R5 materially change the flow.**

**R1 — The Traveler contradiction (brief gap #2). MATERIAL.**
The website says The Traveler has no food and 1.5 hours in the room; the manager says every
package includes 2 pizzas and parties run on 2-hour slots.
**Assumed:** The Traveler includes **no food** and **1.5 hours of room time inside a
2-hour room-slot** (the extra 30 minutes is turnover). Pizza is a paid add-on for Traveler.
**Why:** it preserves the published price ladder — if Traveler already included pizza,
Great Adventure's +$35 buys almost nothing, and the whole package structure collapses.
**If wrong:** P4's food module flips from "add pizza" to "choose your toppings" for
Traveler, and package copy on P3 changes. Both are settings-driven
(`package.includesFood`, `package.roomMinutes`), so the change is a data edit, not a
rebuild. **This needs a direct answer from the manager before launch.**

**R2 — Does "2 games" mean two *consecutive* 15-minute starts? MATERIAL.**
The brief never says. The reserved party times suggest parties get non-adjacent games
(Mon–Fri 6:15 and 6:45).
**Assumed:** public bookings take **N consecutive starts**; parties take the times from
their window's ordered reserved list, which may be non-adjacent.
**If wrong** (public games can be spread): G2's `PARTIAL_BLOCK` state largely disappears,
the grid becomes a multi-select of individual game times, and more inventory becomes
bookable. This is the second-largest flow variable in the project. Make it a setting:
`games.consecutiveRequired`.

**R3 — Does the ±2-year age rule apply to parties in *overlapping* windows? MATERIAL.**
The brief says "the two parties sharing a slot." Saturday 10–12 and 11–1 overlap by an
hour; their guests are in the building together and may share the arena.
**Assumed:** the rule applies to parties in the **same window** only. Room contention across
overlapping windows *is* enforced (a room booked 10–12 is unavailable 11–1) — that is
physical and non-negotiable.
**If the rule should follow shared *game times* instead:** P2 shows more `AGE_CONFLICT`
rows and the copy changes to name the game time rather than the window. Worth asking
directly: *"If a 6-year-old's party is in 10–12 and a 13-year-old's is in 11–1, is that a
problem?"*

**R4 — "Book two time slots" for 15–20 guests: two rooms in one window, or two consecutive
windows? MATERIAL.**
**Assumed:** two **room-slots within the same two-hour window** (a party of 16 uses both
rooms 1–3 PM; it does not run 1–5 PM). This is the only reading consistent with "two
parties per slot," with "over 20 takes 3 time slots" (up to 28), and with Saturday 10–12
having a "third time slot."
**If wrong** (it means consecutive windows), P2's window rows become window *pairs*, the
whole availability grid changes shape, and the party's duration and game times change. This
is the highest-impact ambiguity in the brief. **Ask first.**

**R5 — Final headcount policy. MATERIAL to pricing and to the floor.**
The brief has no rule for headcount changes between booking and party day.
**Assumed:** capacity is reserved for the **booked** count; the organiser confirms final
headcount **7 days out** (acknowledged on P6, prompted by an automated email); guests added
on the day are charged the extra-guest rate **if the room allows**, and staff use an
override if it doesn't.
**If the manager wants a hard lock** (or charges for the booked count regardless), P6's
third acknowledgement and the reminder email change, and the manage-booking page gains an
"update guest count" action with its own fit check.

**R6 — 90-minute cutoff: does it apply to parties too?**
The brief attaches it to laser tag ("when we have walk-ins, we are not double booking").
**Assumed:** parties have a separate, longer **minimum lead time of 48 hours** (setup,
food ordering, staffing); the 90-minute rule is games-only. Both are settings.
**If the manager wants a different party lead time**, only a number changes — low risk.

**R7 — Are package prices tax-inclusive?**
Laser tag prices are explicitly "taxes NOT included"; pizza and wings are explicitly
"prices include tax." Package prices are unstated.
**Assumed:** package base and extra-guest prices are **plus tax**, shown as a tax line on
P6; pizza/wings add-ons are shown tax-inclusive as published, and labelled as such so the
receipt is auditable.
**If wrong:** a display-only change on P3/P6, but it changes every number a customer sees —
confirm before launch.

**R8 — What arrival time should a party be told?**
Windows are 2 hours; guests need to be greeted and seated.
**Assumed:** the confirmation shows **arrival = window start** and asks the organiser to
arrive **15 minutes early**. Games are shown from the window's reserved game-time list.
**If the venue prefers a 15-minute grace start**, it is a settings offset.

**R9 — How far ahead can people book?**
**Assumed:** 60 days for laser tag, 12 months for parties, both settings.
Low risk; affects only the length of the date strip and the calendar's month range.

**R10 — Does a party consume public arena seats at its game times, or is the arena
exclusively the party's?**
**Assumed:** the party's guests consume seats against the 25-player cap, and remaining seats
in those game slots stay publicly bookable **unless** the slot is on the reserved list and
the party has claimed it. This maximises inventory and matches "reserved slots open up if no
party is scheduled."
**If parties get the arena exclusively**, reserved slots simply disappear from public
availability when claimed — a smaller change, one flag in the engine.

**R11 — Saturday/Sunday 10am–12pm is party-only (brief gap #4).**
**Assumed** as approved in the brief: no public laser tag booking in that window; the 10:15
/ 10:30 / 10:45 / 11:00 games belong to the morning parties. G2 renders that window with
the specific `DAY_CLOSED` copy quoted in §3.1 rather than hiding it — a customer who tries
to book Saturday at 11am deserves an explanation, not an absence.

**R12 — Communication channel.**
**Assumed:** email is the confirmation channel and is required; phone is required for staff
to reach the customer. No SMS in v1.
**If SMS is wanted** (likely valuable for the 90-minute-cutoff crowd), it is additive and
does not change any flow.

---

## 7. What is deliberately not in scope

Stated so it does not creep in: no marketing or content pages, no homepage hero, no About,
no gallery, no SEO surface, no customer accounts, no real payment processing, no waivers,
no gift-card purchase flow (gift cards are issued by staff under the cancellation policy),
no arcade or QBIX standalone booking, no group/corporate enquiry form, no loyalty. If any
of these is wanted, it is a separate brief.
