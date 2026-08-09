# Lasertopia Booking Platform — Rules Specification

**Status:** v1.0 — derived entirely from `BRIEF.md`. No fact appears here that is not in the
brief or explicitly marked as a **DEFAULT** (a decision I made because the brief is silent or
self-contradictory) or **DERIVED** (a value computed by a stated algorithm from brief data).

**Audience:** the venue manager (must be able to read every rule and every seeded table) and a
junior developer (must be able to implement without asking a question that this document could
have answered).

**Reading conventions**

- All times are **local Winnipeg time**, `America/Winnipeg`, written in 24-hour `HH:MM`.
  A 12-hour gloss is given the first time a set of times is introduced.
- Rule IDs are `R-NN`. Configuration keys are `CFG.name`. Open questions are `OQ-NN`.
- **MUST** = enforced server-side, test-assertable. **SHOULD** = UI guidance, not a hard gate.
- Every number in this document that a manager could plausibly want to change lives in the
  **Configuration Registry** (§2.0) or in a **seeded table** (§3). Nothing in §3 or §2.0 may be
  written as a constant in application code.
- Where the brief is silent I say so in the rule itself and raise an `OQ`. I have not quietly
  invented anything.

---

## 1. Domain glossary

These terms are used in exactly one sense for the rest of this document, and downstream
documents (schema, engine, UI, tests) must use the same words.

| Term | Definition |
|---|---|
| **Game slot** | One 15-minute laser tag start time on one calendar date. Identified by `(date, startTime)`, e.g. `2026-08-08 13:15`. A game slot is the unit the arena capacity cap is applied to. Game slots exist on the cadence `CFG.gameIntervalMinutes` (15). |
| **Game slot mode** | The state of a game slot on a given date: `PUBLIC` (bookable online by the general public), `PARTY_HELD` (owned by one or more party bookings; the public may not book it), `PARTY_ONLY` (exists only to serve parties and never releases to the public — used for the weekend 10:15–11:00 games), or `BLOCKED` (manager-closed). |
| **Party window** | A named two-hour room booking period on a day of the week, e.g. *Saturday 13:00–15:00*. **This is the canonical term.** The brief calls this a "2-hour slot" and the project intake called it a "party slot" — both are retired here because the brief also uses "time slot" to mean something completely different (see *room-slot*). A party window is a template attached to a day of week; it is instantiated on a date when a booking is made. |
| **Room** | One physical, named party room with one `capacity` integer. Rooms are inventory: they exist independently of any window and can be added, renamed, resized or deactivated by the manager. |
| **Room-slot** | **One room, for one party window, on one date.** This is what the brief means every time it says "time slot" in the room-capacity section — e.g. *"If over 14 guests, book two time slots"* means *use two rooms in the same two-hour window*, not *book two separate two-hour windows*. The brief proves this itself: *"There is also a **third time slot** for 10–12 whose room holds up to 18"* — a third room-slot inside the 10–12 window. |
| **Room configuration** | A named, bookable unit made of one or more rooms, carrying its own explicit `capacity` and its own `roomSlotsConsumed` count. A configuration's capacity is **not** the sum of its rooms' capacities (see R-27 and OQ-05): `Room 1 (14) + Room 2 (12)` is a configuration with capacity **20**, not 26. Configurations are the thing a customer actually books. |
| **Reserved game time** | A game slot that the manager has pre-designated as belonging to a party window rather than to the public. Reserved game times are configuration data attached to a party window, never constants. |
| **Party game set** | An ordered list of reserved game times that one party booking receives together, e.g. Mon–Fri 17:00–19:00 Set 1 = `[17:15, 18:15]`. A party window has one set per party it can host. This is the model the brief's gap #3 asks for. |
| **Arena group** | A subset of one booking's players who enter the arena together for one game slot. A booking has one arena group unless its player count exceeds `CFG.arenaCapacity` (25), in which case it is split (R-64). |
| **Guest** | A person counted for room capacity, package pricing and pizza tiers. The Birthday Guest of Honour is a guest: a package for "10 guests" is 9 friends + the honoree; a room for "14 guests" is 13 friends + the honoree. |
| **Player** | A person occupying one of the 25 arena places in one game slot. **DEFAULT:** for a party booking, players = guests (every guest plays). See OQ-24 — non-playing adults are not modelled. |
| **Public booking** | A customer-facing laser tag booking of 1–3 games for N players, not attached to a party. |
| **Party booking** | A customer-facing birthday booking: one package, one party window, one date, one room configuration, one honoree age, N guests, add-ons, and a $50 deposit. |
| **Honoree age** | The Birthday Guest of Honour's age, used for the 2-year pairing rule. **DEFAULT:** the age the honoree is turning. See OQ-25. |

**Terms deliberately retired:** "2-hour slot", "party slot", "time slot", "largest party room
set". Each is ambiguous in the source. Use *party window*, *room-slot*, and *room configuration*.

---

## 2. Rules

### 2.0 Configuration registry

Every value below is a stored, manager-editable setting. **None may be hardcoded.** Seed values
marked *provisional* need manager confirmation (see §5).

| Key | Seed | Meaning |
|---|---|---|
| `CFG.timezone` | `America/Winnipeg` | All rule evaluation happens in this zone. |
| `CFG.gameIntervalMinutes` | `15` | Laser tag cadence. |
| `CFG.gameDurationMinutes` | `15` | *provisional* — used to decide whether a game fits inside a party window. |
| `CFG.arenaCapacity` | `25` | Max concurrent players in one game slot. |
| `CFG.onlineCutoffMinutes` | `90` | No online public booking within this many minutes of game start. |
| `CFG.cutoffAppliesToManager` | `false` | Manager backend may book inside the cutoff (this is the whole point of the request — walk-ins). |
| `CFG.maxGamesPerPublicBooking` | `3` | Only 1/2/3 games are priced. |
| `CFG.publicGamesMustBeConsecutive` | `true` | *provisional* — a 2- or 3-game booking takes consecutive slots. |
| `CFG.lastGameStartOffsetMinutes` | `15` | *provisional* — last public game starts this long before closing. |
| `CFG.reservedReleaseLeadMinutes` | `10080` (7 days) | *provisional* — how close to the date an unclaimed reserved game time opens to the public. |
| `CFG.partyGameMinGapMinutes` | `30` | Minimum spacing between a party's own games **when auto-assigned**. Manager-configured sets are exempt (R-22). |
| `CFG.autoAssignedGamesBlockPublic` | `true` | Auto-assigned party games become `PARTY_HELD` (the brief: *"we sometimes have to book off other time slots for parties as well"*). |
| `CFG.partiesMayShareGameSlot` | `true` | *provisional* — two party bookings may occupy one game slot if capacity and age rules pass. |
| `CFG.publicMayJoinPartyHeldSlot` | `false` | The public can never enter a party-held game. |
| `CFG.maxAgeDifferenceYears` | `2` | Pairing rule. |
| `CFG.packageBaseGuests` | `10` | Guests included in every package price. |
| `CFG.maxPartyGuests` | `28` | Hard ceiling. |
| `CFG.windowChangeoverMinutes` | `0` | *provisional* — cleanup buffer between two bookings of the same room. |
| `CFG.depositAmount` | `50.00` | Non-refundable event deposit. |
| `CFG.changeNoticeDays` | `14` | The 2-week reschedule/cancel boundary. |
| `CFG.taxRatePercent` | `12.0` | *provisional* — applied to tax-exclusive lines only. Must be confirmed (OQ-20). |
| `CFG.bookingHoldMinutes` | `15` | *provisional* — how long an in-progress booking holds inventory. |

Also configuration, held as tables in §3 and §2.6: rooms, room configurations, window→configuration
offerings, party windows, reserved game times / party game sets, operating hours, package prices,
extra-guest prices, pizza tiers, add-on prices and eligibility.

---

### 2.1 Calendar, operating hours and game slot generation

**R-01** All rule evaluation MUST use `CFG.timezone`. Stored timestamps are UTC; every comparison
a customer can observe (cutoffs, the 14-day boundary, window starts) MUST be computed after
conversion to Winnipeg local time, so that DST transitions do not shift a game time.

**R-02** Public operating hours are configuration, seeded from the verified facts:

| Day | Opens | Closes | Public game slots (seeded, `CFG.lastGameStartOffsetMinutes = 15`) |
|---|---|---|---|
| Monday | 12:00 | 21:00 | 12:00 → 20:45 |
| Tuesday | 12:00 | 21:00 | 12:00 → 20:45 |
| Wednesday | 12:00 | 21:00 | 12:00 → 20:45 |
| Thursday | 12:00 | 21:00 | 12:00 → 20:45 |
| Friday | 12:00 | 22:00 | 12:00 → 21:45 |
| Saturday | 12:00 | 21:00 | 12:00 → 20:45 |
| Sunday | 12:00 | 19:00 | 12:00 → 18:45 |

**R-03** For a given date, the system MUST generate one game slot every `CFG.gameIntervalMinutes`
from the day's first game start to its last game start inclusive. The brief is silent on when the
last game of the day starts; the seeded rule is `close − CFG.lastGameStartOffsetMinutes` (OQ-29).

**R-04** **Weekend party-only morning.** On Saturday and Sunday, exactly four additional game slots
exist before opening: **10:15, 10:30, 10:45, 11:00** (10:15am, 10:30am, 10:45am, 11:00am). These
slots MUST be created with mode `PARTY_ONLY`. They MUST never be offered to the public, on any
lead time, whether or not a party has claimed them. Public hours begin at 12:00 (R-02).

**R-05** No game slots exist on Saturday or Sunday between 11:15 and 11:45 inclusive. The brief
enumerates exactly four morning game times and public play starts at 12:00. This is a literal
reading with a real consequence — the 11:00–13:00 party window has almost no game times of its
own (see OQ-11). A manager can add these slots as data if the reading is wrong.

**R-06** A `Closure` record for a date MUST suppress all game slots and block all party windows on
that date. The brief lists no holiday closures; this exists so the manager can add them (OQ-27).

**R-07** Every party window in §3 MUST fall inside that day's building hours **or** inside the
weekend party-only morning. A window that satisfies neither is a configuration error and MUST fail
validation at save time rather than at booking time.

---

### 2.2 Public laser tag booking

**R-08** A public booking has: date, start game slot, `games ∈ {1,2,3}`, `players ≥ 1`. Pricing is
per person and tax-exclusive: 1 game **$8.49**, 2 games **$15.49**, 3 games **$21.49**.
`subtotal = pricePerPerson(games) × players`.

**R-09** All games in one public booking MUST be on the same date (the published prices are
"same-day play"). With `CFG.publicGamesMustBeConsecutive = true`, a booking of N games takes slots
`T, T+15, … T+15(N−1)`; every one of them MUST independently satisfy R-11 and R-12.

**R-10 — The 90-minute online cutoff.** An **online** public booking MUST be rejected with
`ONLINE_CUTOFF` if `now > startTime − CFG.onlineCutoffMinutes`, where `startTime` is the **first**
game slot of the booking, compared in `CFG.timezone`. Boundary: `now == startTime − 90min` is
**accepted** (the rule is strictly-greater-than). This is the walk-in protection the manager asked
for: it reserves the last 90 minutes of every game slot for the front desk.

**R-11** A public booking MUST be rejected if the target slot's mode is not `PUBLIC`:
`PARTY_HELD` → `SLOT_HELD_FOR_PARTY`; `PARTY_ONLY` → `PARTY_ONLY_WINDOW`; `BLOCKED` →
`SLOT_UNAVAILABLE`. `CFG.publicMayJoinPartyHeldSlot = false` makes this absolute.

**R-12 — Arena capacity.** For every game slot, `Σ players across all bookings assigned to that
slot ≤ CFG.arenaCapacity (25)`. A booking that would breach this MUST be rejected with
`ARENA_FULL` and the UI SHOULD report the remaining headroom.

**R-13** The manager backend MUST be able to create a booking that violates R-10 (walk-ins) but MUST
NOT be able to violate R-12 (arena capacity) or R-30 (room double-booking) without an explicit,
logged override flag. Capacity is physical; the cutoff is only a policy.

**R-14** A public booking whose player count exceeds `CFG.arenaCapacity` MUST be split into arena
groups by R-64, same as a party.

---

### 2.3 Reserved game times and release to the public

**R-15** Reserved game times MUST be stored as **party game sets** attached to a `(day of week,
party window)` pair — an ordered list of times per set, one set per party the window can host.
They MUST NOT be a flat hardcoded list. The seeded sets are in §3.4.

**R-16** When a party booking is created, it claims the lowest-index party game set of its window
that is not already claimed on that date, and receives that set's times as its game times.
A configured time that has already been sold to the public (because it was released under R-18)
MUST be dropped from what the party receives — R-20 forbids taking it back — and R-17 backfills the
shortfall.

**R-17 — Auto-extension.** If the claimed set has fewer times than the package requires
(`package.gamesIncluded`, seeded 2), or the window has no configured sets at all, the system MUST
append game slots by this deterministic algorithm, and MUST mark each appended slot `PARTY_HELD`
when `CFG.autoAssignedGamesBlockPublic = true`:

> Repeat until the party has `gamesIncluded` times:
> take the **earliest** game slot `T` on that date such that
> (a) `T ≥ window.start` and `T + CFG.gameDurationMinutes ≤ window.end`;
> (b) `T ≥ lastAssignedTime + CFG.partyGameMinGapMinutes` (skip this test for the party's first game);
> (c) `T` is not a configured time of any other party game set on that date, **in any window** —
>     auto-extension may never consume another window's reserved inventory;
> (d) `T` has no existing public booking;
> (e) arena headroom at `T` ≥ this arena group's size (R-12);
> (f) if `T` already has another party on it, `CFG.partiesMayShareGameSlot` is true and R-36 (age) passes.
> If no such `T` exists, reject the booking with `NO_GAME_CAPACITY`.

This rule is the direct implementation of the manager's line *"We sometimes have to book off other
time slots for parties as well."*

**R-18 — Release to the public.** A reserved game time `G` in set `S` of window `W` on date `D` is
publicly bookable **iff both**:
1. no party booking on `D` has claimed `S`; **and**
2. **either** (a) `W` has no remaining bookable room configuration on `D` — no further party can be
   sold into that window, so its remaining reserved times are dead inventory — **or**
   (b) `now ≥ G − CFG.reservedReleaseLeadMinutes` (seeded 7 days).

Otherwise `G` stays `PARTY_HELD` and R-11 rejects public bookings on it.

**R-19** R-18 MUST NOT apply to `PARTY_ONLY` slots (weekend 10:15–11:00). Those never release
(R-04). This is the approved default from the brief's gap #4.

**R-20** Once a game slot has at least one **public** booking, it MUST NOT be converted to
`PARTY_HELD`. R-17(d) enforces this at assignment time. A party arriving later simply gets a
different time. Rationale: never cancel a sold public game to make room for a party.

**R-21** When a party booking is cancelled, every game slot it held MUST be re-evaluated: slots that
came from its configured set revert to `PARTY_HELD` and become releasable again under R-18; slots
that were auto-appended under R-17 revert to `PUBLIC`.

**R-22** Manager-configured times inside a party game set are exempt from
`CFG.partyGameMinGapMinutes`. The brief's own weekend morning data (10:15 and 10:45, 30 minutes
apart) and Sunday 15:00/15:15 (15 minutes apart) would otherwise be invalid. The gap rule exists
only to keep *auto-assigned* times sensible.

**R-23** The manager backend MUST be able to (a) edit any set's times, (b) add or remove sets,
(c) force-release a specific reserved time on a specific date, and (d) block any game slot on any
date. All four are data operations, not deploys.

---

### 2.4 Party windows, rooms and allocation

**R-24** A party booking selects exactly one `(date, party window)` and one **room configuration**
offered in that window on that day (§3.3).

**R-25 — Allocation is by capacity, deterministically.** Given `guests` and a
`(date, window)`, the system MUST choose the offered configuration that is available on that date
and satisfies `capacity ≥ guests`, ranked by:
1. **fewest `roomSlotsConsumed`** (leave as much of the window sellable as possible);
2. then **smallest `capacity`** (leave the big rooms for big parties);
3. then lowest configured `priority` (stable tie-break).

If no offered configuration satisfies `capacity ≥ guests`, reject with `NO_ROOM_CONFIG` and name,
in the error, the windows on nearby dates whose maximum capacity would fit. If no configuration
anywhere satisfies it, reject with `EXCEEDS_MAX_PARTY_SIZE` naming `CFG.maxPartyGuests` (28) and
the venue phone number 204-474-5900.

**R-26 — Room-slots consumed.** `roomSlotsConsumed` is the number of physical rooms the
configuration occupies. Seeded consequences, straight from the brief: **≤14 guests → 1 room-slot;
15–20 → 2 room-slots; 21–28 → 3 room-slots** (except where a single larger room is offered — the
18-capacity room serves 15–18 guests in **1** room-slot, which is why R-25 ranks by room-slots
first).

**R-27** A configuration's `capacity` is an explicit stored integer that **overrides** the sum of
its rooms' capacities. `Room 1 (14) + Room 2 (12)` has configuration capacity **20**, because the
brief says two room-slots hold up to 20. The engine MUST read `configuration.capacity` and MUST NOT
sum room capacities. See OQ-05/OQ-06 — this is the brief's most surprising number.

**R-28** "Two parties per two-hour slot" is **not** implemented as a counter. The number of parties
a window can host is an emergent property of how many room-slots its offered configurations leave
free. `CFG.maxPartiesPerWindow` exists as an optional hard cap and is seeded `null` (unlimited).
This matters because the weekend 10:00–12:00 window has **three** room-slots (OQ-07).

**R-29 — Room-slot records are physical.** Confirming a party booking MUST write one
`BookingRoomSlot` row per room in the chosen configuration, each carrying the concrete
`(roomId, date, startAt, endAt)` of the party window.

**R-30 — No physical double-booking.** Two `BookingRoomSlot` rows for the same room on the same
date MUST NOT overlap, where overlap means
`aStart < bEnd + CFG.windowChangeoverMinutes AND bStart < aEnd + CFG.windowChangeoverMinutes`.
Touching boundaries (13:00 end / 13:00 start) do **not** overlap at the seeded 0-minute changeover.
**This rule, not the window definition, is what makes overlapping windows safe** — Sunday 15:00–17:00
and 16:00–18:00 can both be sold only because §3 assigns them physically different rooms.

**R-31 — Two independent constraints.** Room availability (R-30) and arena capacity (R-12) MUST be
evaluated separately, in that order, and a booking MUST pass both. Neither implies the other: a
window can have a free room and no arena headroom, or arena headroom and no free room. This is the
brief's gap #5 and it is the reason the two checks live in different tables.

**R-32** `roomMinutes` is a package attribute, not a window attribute. The Traveler is seeded at 90
minutes of room time inside a 120-minute party window; the room-slot is still held for the full
window (R-29), because the room cannot be re-sold for the remaining 30 minutes. See OQ-02.

**R-33** Rooms, room capacities, room configurations and window→configuration offerings MUST all be
manager-editable records. Adding a sixth room, resizing a room from 14 to 16, or offering the
18-capacity room on Saturday afternoon MUST each be a data change with no deploy.

---

### 2.5 Party pairing and the age rule

**R-34** A party booking MUST record the honoree's age as an integer.

**R-35 — Same-window age rule.** For any two party bookings on the same date in the same party
window, `|ageA − ageB| ≤ CFG.maxAgeDifferenceYears` (2). Violation → reject the incoming booking
with `AGE_GAP_EXCEEDED`, naming the existing party's age band. Boundary: a difference of **exactly
2 is allowed** (7 and 9 pass; 7 and 11 fail).

**R-36 — Shared-game age rule.** The same test MUST also be applied to any two party bookings
assigned to the same game slot, even when they come from *different* party windows (Sunday
15:00–17:00 and 16:00–18:00 overlap in time). Rationale: the age rule exists because these children
share the arena; if they share a game they must satisfy it.

**R-37** With three parties in one window (weekend 10:00–12:00), the rule MUST be applied
**pairwise to all pairs**, not just to "the two parties". The brief only ever describes two.

**R-38** Cancelling a party booking MUST release its age constraint immediately. Bookings in
progress hold the constraint for `CFG.bookingHoldMinutes`.

---

### 2.6 Packages, guests, pizza

**R-39** Packages are configuration records, seeded from the verified price list:

| Code | Name | Base price | Extra guest | Games | Room minutes | Food included | Arcade card eligible |
|---|---|---|---|---|---|---|---|
| `TRAVELER` | The Traveler | $224.50 | $22.45 | 2 | 90 | **none** (DEFAULT, OQ-02) | yes |
| `GREAT_ADVENTURE` | The Great Adventure | $259.50 | $25.95 | 2 | 120 | pizza **or** hot dogs, cupcakes | yes |
| `AROUND_THE_WORLD` | Around The World | $359.50 | $35.95 | 2 | 120 | pizza **or** hot dogs, cupcakes | **no** |

All three also include: private party room, VIP host, soft drinks, popcorn, party supplies,
setup/cleanup, merch for the honoree, free downloadable invitations. `AROUND_THE_WORLD` additionally
includes Lazer Frenzy, the Typhoon Experience ride, and a $10 fun card per guest.

**R-40 — Extra guests.** `extras = max(0, guests − CFG.packageBaseGuests) × package.extraGuestPrice`.
Guests below 10 pay the full base price with no discount (DEFAULT — the brief says the package
"accommodates 10 guests", not "at least 10"; OQ-22).

**R-41 — Pizza tiers.** Pizza count is a lookup in an editable tier table, seeded with the
**approved** resolution of the brief's gap and overlaps (OQ-01):

| Guests | Pizzas |
|---|---|
| 10–11 | 2 |
| 12–15 | 3 |
| 16–20 | 4 |
| 21–25 | 5 |
| 26–30 | 6 |

Tiers MUST be validated as contiguous and non-overlapping on save; the brief's original rows
(11 undefined, 20 in two rows, 25 in two rows) would fail that validation, which is the point.

**R-42** The pizza tier MUST only be applied to packages where `includesPizza = true`. Under the
seeded default that is `GREAT_ADVENTURE` and `AROUND_THE_WORLD` only. `TRAVELER` parties get 0
included pizzas and see pizza offered as a paid add-on. **This is a revenue-material default and
OQ-02 must be answered before launch.**

**R-43** Where the package offers "pizza **or** hot dogs", choosing hot dogs MUST replace the pizza
allotment. The brief gives no hot dog quantities; the seeded default is `1 per guest` and it is an
open question (OQ-19).

**R-44** No outside food, drinks or cakes are permitted, and the facility is nut-free. The booking
flow MUST require an explicit acknowledgement of both before a party booking can be confirmed, and
MUST NOT offer a "bring your own cake" option. Cupcakes are included with `GREAT_ADVENTURE` and
`AROUND_THE_WORLD`; quantity is unstated (OQ-19).

**R-45** The arena requires clean closed-toed shoes. Both booking flows MUST show this and require
acknowledgement at checkout.

---

### 2.7 Add-ons

Add-ons are configuration records with a code, a pricing mode, a price, a `taxIncluded` flag and a
package eligibility list.

| Code | Name | Pricing | Price | Tax | Eligible packages |
|---|---|---|---|---|---|
| `ARCADE_5UP_MATCH` | 5-Up Arcade Card (match) | per guest | $5.00 loaded, matched 1:1 | *provisional* excl. | `TRAVELER`, `GREAT_ADVENTURE` |
| `ARCADE_TIMEPLAY_45` | 45-minute Arcade Time Play card | per guest | $5.00 | *provisional* excl. | `TRAVELER`, `GREAT_ADVENTURE` |
| `QBIX_5D` | QBIX 5D | per person | $3.95 | *provisional* excl. | all |
| `PIZZA_CHEESE` | Extra Large Cheese pizza | per unit | $22.39 | **included** | all |
| `PIZZA_1TOP` | Extra Large 1-Topping pizza | per unit | $24.63 | **included** | all |
| `PIZZA_2TOP` | Extra Large 2-Topping pizza | per unit | $26.87 | **included** | all |
| `WINGS_8` | 8 wings | per unit | $10.07 | **included** | all |
| `WINGS_16` | 16 wings | per unit | $19.03 | **included** | all |
| `WINGS_24` | 24 wings | per unit | $29.11 | **included** | all |

Option lists (editable): pizza toppings `Pepperoni, Bacon, Hawaiian`; wing sauces `Louisiana, Dry,
Sweet Chili, Honey Garlic, Salt and Pepper, Lemon Pepper, Honey Garlic BBQ`.

**R-46 — Arcade card eligibility.** `ARCADE_5UP_MATCH` and `ARCADE_TIMEPLAY_45` MUST be rejected on
`AROUND_THE_WORLD` with `ADDON_NOT_ELIGIBLE`. The brief restricts them to Traveler and Great
Adventure; Around The World already includes a $10 fun card per guest.

**R-47 — Arcade cards are mutually exclusive per guest.** The brief says "**OR**". A booking MUST
NOT carry both `ARCADE_5UP_MATCH` and `ARCADE_TIMEPLAY_45` for the same guest. Seeded default:
the two are mutually exclusive for the whole booking (a booking picks one variant and a quantity
`≤ guests`), because per-guest identity is not otherwise modelled. OQ-16.

**R-48 — 5-Up match mechanics.** The guest loads an amount and Lasertopia matches it 1:1, with the
**match capped at $20**. Seeded default: loads are $5 increments in the range $5–$20, so the maximum
outcome is $20 loaded + $20 bonus = $40 of arcade value. The brief's phrasing ("Guest spends $5,
Lasertopia matches with $5 Bonus Cash. Matched up to $20") supports but does not prove this. OQ-15.

**R-49 — Arcade Time Play card restrictions.** The 45-minute Time Play card MUST be described as:
unlimited arcade time play for 45 minutes, **earns no prize points**, and **does not work on Claw
Machines or QBIX**. If a booking has both `ARCADE_TIMEPLAY_45` and `QBIX_5D`, the UI MUST warn that
the Time Play card does not cover QBIX (the two are still both purchasable — QBIX is paid separately).

**R-50 — QBIX.** $3.95 per person, addable to any package. The ride seats up to 5. The brief gives
no session length and no scheduling model, so QBIX is seeded as a **priced line item with no
schedule**; a party of 20 buying QBIX generates 4 ride groups of 5 operationally but the system does
not allocate ride times. OQ-17.

**R-51 — Extra pizzas and wings are priced tax-included** and MUST NOT have `CFG.taxRatePercent`
applied to them. Totals MUST show tax-exclusive lines and tax-inclusive lines separately so the
tax line is auditable.

**R-52** Every add-on price, eligibility list and option list MUST be manager-editable, and adding a
new add-on MUST NOT require a deploy.

---

### 2.8 Deposit, reschedule, cancellation

**R-53** A party booking MUST NOT reach status `CONFIRMED` without a recorded deposit of
`CFG.depositAmount` ($50.00), non-refundable. Checkout is **simulated**: the system records the
deposit and its status; no card data is captured and no payment SDK is used.

**R-54** The deposit is **per party booking**, once, regardless of how many room-slots the booking
consumes (a 28-guest booking consuming 3 room-slots pays one $50 deposit). DEFAULT — the brief says
"a non refundable deposit of $50.00 is required" per event. OQ-14.

**R-55** The deposit MUST be applied against the booking total. `balanceDue = total − depositAmount`.

**R-56 — The 14-day boundary.** Let `noticeDays = floor((eventStart − now) in whole days)` computed
in `CFG.timezone`, where `eventStart` is the start of the booking's party window on its date. The
boundary test is `noticeDays ≥ CFG.changeNoticeDays` (14). **Exactly 14 days counts as sufficient
notice** — the brief says "at least 2 weeks", so `≥` is used, while its later phrase "within 14 days
or less" would imply `>`. The chosen reading favours the customer; it is OQ-13.

**R-57 — Cancel with ≥14 days notice.** Allowed self-serve. Booking → `CANCELLED`. The $50 deposit
MUST be converted to a **gift card** for the same $50, usable in the facility, and the deposit
record moves to status `CONVERTED_TO_GIFT_CARD`. No cash refund is ever issued.

**R-58 — Cancel with <14 days notice.** The deposit is **forfeited**: deposit status
`FORFEITED`, no gift card. The customer MUST be offered the alternative in R-59 before the
cancellation is finalised.

**R-59 — Reschedule.** Self-serve rescheduling requires `noticeDays ≥ 14` ("we require at least 2
weeks notice"); the deposit carries to the new date. Inside 14 days the verbatim policy also offers
"the choice to move to a new rescheduled date", which contradicts the 2-week requirement.
**DEFAULT:** inside 14 days, rescheduling is permitted but only as a **manager backend action**, not
self-serve, and the deposit carries. OQ-12.

**R-60** A reschedule MUST be validated as a fresh booking against the new date: room availability
(R-30), arena capacity (R-12), the age rule (R-35/R-36) and game assignment (R-16/R-17) are all
re-evaluated. If the new date fails, the reschedule MUST be rejected and the original booking left
untouched.

**R-61** Gift cards issued under R-57 MUST record `code, amount, issuedFromBookingId, issuedAt` and a
redemption state. The brief states no expiry and no transferability rules (OQ-14).

**R-62** Every deposit state change, cancellation, reschedule and manager override MUST be written
to an append-only `BookingChangeLog` with actor, timestamp and before/after values.

---

### 2.9 Arena splitting and totals

**R-63 — Arena cap.** `CFG.arenaCapacity = 25` players in any one game slot, counted across every
booking on that slot (R-12).

**R-64 — Splitting.** A booking whose player count `P > CFG.arenaCapacity` MUST be split into
`ceil(P / CFG.arenaCapacity)` arena groups, sized as evenly as possible (28 → 14 + 14; 26 → 13 + 13).
Each arena group MUST be assigned its **own** game slots — a split booking of 2 games needs
`groups × games` distinct game slots, and two groups of the same booking MUST NOT share a slot
(sharing would put all `P` players in the arena at once, which is what the split exists to prevent).

**R-65** Assignment for a split booking: group 1 claims the window's lowest free party game set,
group 2 the next, and R-17 auto-extends whichever runs short. A split booking therefore consumes
the game inventory of two parties even though it is one booking — which is consistent, since it also
consumes the room-slots of two or three.

**R-66** A booking MUST be rejected with `NO_GAME_CAPACITY` if R-17 cannot find enough conforming
slots inside the party window for all of its arena groups. This is a real failure mode at weekend
10:00–12:00, where only four game slots exist in total (OQ-09).

**R-67 — Total calculation order.** For any booking:

```
preTaxSubtotal   = packageBase + extraGuests + Σ(tax-exclusive add-on lines)
taxIncludedTotal = Σ(tax-inclusive add-on lines)          # pizzas, wings
tax              = round2(preTaxSubtotal × CFG.taxRatePercent / 100)
total            = preTaxSubtotal + tax + taxIncludedTotal
balanceDue       = total − depositApplied
```

Rounding is half-up to 2 decimals, applied once at the tax line and once at each add-on line total.
`CFG.taxRatePercent` is *provisional* and must be confirmed (OQ-20) — the brief states tax treatment
only for laser tag ("not included") and for pizza/wings ("included"), and says nothing about package
or QBIX tax.

**R-68** Prices in effect MUST be snapshotted onto the booking at confirmation time. Changing a
package price or an add-on price later MUST NOT alter an existing booking's total.

**R-69** Every rejection MUST return a machine-readable code and a human sentence that says what
went wrong and what to do about it. The seeded codes are: `ONLINE_CUTOFF`, `SLOT_HELD_FOR_PARTY`,
`PARTY_ONLY_WINDOW`, `SLOT_UNAVAILABLE`, `ARENA_FULL`, `NO_ROOM_CONFIG`, `EXCEEDS_MAX_PARTY_SIZE`,
`AGE_GAP_EXCEEDED`, `NO_GAME_CAPACITY`, `ADDON_NOT_ELIGIBLE`, `ROOM_DOUBLE_BOOKED`,
`NOTICE_PERIOD_NOT_MET`, `VENUE_CLOSED`.

**R-70** Every rule in this section MUST be enforced server-side. Client-side checks are a courtesy
only; the availability API and the booking API MUST both re-validate.

---

## 3. Seeded room inventory

### 3.1 The interpretation problem, and the interpretation chosen

The brief describes rooms **per party window**, never as inventory. Two readings are possible:

**Interpretation A (chosen).** Overlapping party windows use **physically different rooms**. The
venue therefore has **five** party rooms, and each window is mapped to a disjoint subset of them
during any moment the windows overlap.

**Interpretation B (rejected).** There are only two or three party rooms and all windows draw from
one shared pool; overlapping windows are alternatives that in practice cannot both be sold.

**Why A.** The brief's gap #5 states that party windows genuinely overlap (Sunday 15:00–17:00 with
16:00–18:00, and every 10:00–12:00 with 11:00–13:00) and that room capacity and arena capacity are
two independent constraints to be enforced separately. That instruction is only meaningful if both
overlapping windows can actually be sold at the same time. It also says two parties run per window.
Under B, Saturday at 11:30 would need 3 room-slots (10:00–12:00) plus 2 room-slots (11:00–13:00)
from a pool of 2–3 rooms — impossible, and the platform would have to refuse bookings the venue
can take. Under A, every capacity sentence in the brief is reproduced exactly and no physical room
is ever double-booked.

**Cost of being wrong.** If the venue really has fewer rooms, the fix is deleting rows from the
`Room` and `WindowOffering` tables — no code changes. That asymmetry is why A is the safer seed.
**OQ-04 asks the manager for the real room count and names; this is the single highest-priority
question in this document.**

Two further readings I had to commit to:

- **"largest party room set holds up to 14"** (used for Monday–Friday 17:00–19:00 and every
  Saturday/Sunday afternoon window) and **"two different size party rooms: one max 12, one max 14"**
  (used for Monday–Friday 18:00–20:00 and the 11:00–13:00 / 15:00–17:00 windows) describe **the same
  shape of room pair** — a 14 and a 12 — narrated two different ways. The first phrasing emphasises
  what happens when they are combined (20); the second emphasises using them as two separate
  parties. This is why every window in §3.3 is served by a 14 + 12 pair.
- **"the largest party room can hold up to 18"** (Mon–Fri 18:00–20:00) and **"a third time slot for
  10–12 whose room holds up to 18"** (weekend mornings) refer to **one single 18-capacity room**,
  not to a combination. The brief uses the word "largest" for both a 14 and an 18, which is exactly
  why the number must be data and not an adjective.

### 3.2 `rooms` table (seed)

Names are **placeholders**. The brief never names a room. The manager must rename these to match
the real rooms; renaming is a data edit.

| ID | Display name | Capacity | Active | Notes |
|---|---|---|---|---|
| `RM1` | Party Room 1 | 14 | yes | The "largest party room set" 14 in afternoon/early-evening windows |
| `RM2` | Party Room 2 | 12 | yes | Pairs with `RM1` |
| `RM3` | Party Room 3 | 14 | yes | The 14 in the "two different size party rooms" windows |
| `RM4` | Party Room 4 | 12 | yes | The 12 in the same windows |
| `RM5` | Grand Party Room | 18 | yes | The single 18-capacity room ("largest party room… up to 18"; the weekend third room-slot) |

A manager may add `RM6`, change `RM5` to 20, or set `RM4.active = false`. Nothing in the engine
reads a room by name or by hardcoded id.

### 3.3 `room_configurations` table (seed)

`capacity` is authoritative and overrides the sum of member room capacities (R-27).

| ID | Member rooms | Sum of member capacities | **Configuration capacity** | Room-slots consumed | Source sentence in brief |
|---|---|---|---|---|---|
| `CFG-A-12` | `RM2` | 12 | **12** | 1 | "one room max 12" |
| `CFG-A-14` | `RM1` | 14 | **14** | 1 | "largest party room set holds up to 14 guests (13 friends + honoree)" |
| `CFG-A-20` | `RM1` + `RM2` | 26 | **20** | 2 | "If over 14 guests, book two time slots. This can hold up to 20 guests." |
| `CFG-B-12` | `RM4` | 12 | **12** | 1 | "One room max 12" |
| `CFG-B-14` | `RM3` | 14 | **14** | 1 | "the other max 14" |
| `CFG-B-20` | `RM3` + `RM4` | 26 | **20** | 2 | *not stated by the brief for these windows* — seeded **offered = false**, see OQ-10 |
| `CFG-G-18` | `RM5` | 18 | **18** | 1 | "the largest party room can hold up to 18" / "third time slot… holds up to 18" |
| `CFG-A-28` | `RM1` + `RM2` + `RM5` | 44 | **28** | 3 | "Over 20 guests: up to 28 guests, which takes 3 time slots" |
| `CFG-B-28` | `RM3` + `RM4` + `RM5` | 44 | **28** | 3 | same sentence, applied to the evening room set |

The gap between "sum of member capacities" and "configuration capacity" is deliberate and is the
brief's own arithmetic: two rooms sold as two parties hold 26 people, but the same two rooms sold as
one party hold 20. See **OQ-05** and **OQ-06** — I have reproduced the numbers without being able to
explain them.

### 3.4 Party windows, offered configurations and reserved game times — all seven days

Legend: **RS** = room-slots consumed. Configurations are listed in R-25 preference order for a
mid-size party. "Sets" are party game sets (R-15); times in **bold** are verbatim from the brief,
times in *italics* are **DERIVED at booking time by R-17** and are shown here only to make the
worked examples reproducible.

#### Monday, Tuesday, Wednesday, Thursday, Friday (identical)

| Party window | Offered configurations (capacity / RS) | Max guests | Physical rooms | Party game sets |
|---|---|---|---|---|
| **17:00–19:00** (5–7pm) | `CFG-A-12` 12/1 · `CFG-A-14` 14/1 · `CFG-A-20` 20/2 | 20 | `RM1`, `RM2` | Set 1 = **17:15, 18:15** · Set 2 = **17:30, 18:45** |
| **18:00–20:00** (6–8pm) | `CFG-B-12` 12/1 · `CFG-B-14` 14/1 · `CFG-G-18` 18/1 · `CFG-B-28` 28/3 · *(`CFG-B-20` 20/2 — offered = false)* | 28 | `RM3`, `RM4`, `RM5` | *none configured* — all times auto-assigned by R-17 |

All four Monday–Friday reserved times are consumed: **17:15, 17:30, 18:15, 18:45**. They are split
**interleaved** (Set 1 takes the 1st and 3rd, Set 2 the 2nd and 4th) rather than sequentially, so
each party's two games are spread across its two hours instead of being back to back at 17:15 and
17:30. This is an interpretation (OQ-03) and is one table edit to change.

The 18:00–20:00 window has **no reserved times at all** in the brief even though it is a listed
party window and every package includes 2 games. R-17 covers it; **OQ-08** asks the manager to
supply the real ones.

#### Saturday

| Party window | Offered configurations (capacity / RS) | Max guests | Physical rooms | Party game sets |
|---|---|---|---|---|
| **10:00–12:00** | `CFG-A-12` 12/1 · `CFG-A-14` 14/1 · `CFG-G-18` 18/1 · `CFG-A-20` 20/2 · `CFG-A-28` 28/3 | 28 | `RM1`, `RM2`, `RM5` | Set 1 = **10:15, 10:45** · Set 2 = **10:30, 11:00** · Set 3 = *none available* (OQ-09) |
| **11:00–13:00** | `CFG-B-12` 12/1 · `CFG-B-14` 14/1 · *(`CFG-B-20` — offered = false)* | 14 | `RM3`, `RM4` | *none configured* (OQ-11) |
| **13:00–15:00** | `CFG-A-12` 12/1 · `CFG-A-14` 14/1 · `CFG-A-20` 20/2 | 20 | `RM1`, `RM2` | Set 1 = **13:15**, *14:00* · Set 2 = **13:45**, *14:15* |
| **15:00–17:00** | `CFG-B-12` 12/1 · `CFG-B-14` 14/1 · *(`CFG-B-20` — offered = false)* | 14 | `RM3`, `RM4` | Set 1 = **15:15**, *16:00* · Set 2 = **15:45**, *16:15* |
| **17:00–19:00** | `CFG-A-12` 12/1 · `CFG-A-14` 14/1 · `CFG-A-20` 20/2 | 20 | `RM1`, `RM2` | Set 1 = **17:15**, *18:00* · Set 2 = **17:45**, *18:15* |

All six Saturday reserved times are consumed: **13:15, 13:45, 15:15, 15:45, 17:15, 17:45**. Each
afternoon/evening window gets exactly **two** reserved times, but hosts **two parties needing two
games each** — so the brief supplies only half the times required. R-17 fills the rest.

#### Sunday

| Party window | Offered configurations (capacity / RS) | Max guests | Physical rooms | Party game sets |
|---|---|---|---|---|
| **10:00–12:00** | `CFG-A-12` 12/1 · `CFG-A-14` 14/1 · `CFG-G-18` 18/1 · `CFG-A-20` 20/2 · `CFG-A-28` 28/3 | 28 | `RM1`, `RM2`, `RM5` | Set 1 = **10:15, 10:45** · Set 2 = **10:30, 11:00** · Set 3 = *none available* (OQ-09) |
| **11:00–13:00** | `CFG-B-12` 12/1 · `CFG-B-14` 14/1 · *(`CFG-B-20` — offered = false)* | 14 | `RM3`, `RM4` | *none configured* (OQ-11) |
| **13:00–15:00** | `CFG-A-12` 12/1 · `CFG-A-14` 14/1 · `CFG-A-20` 20/2 | 20 | `RM1`, `RM2` | Set 1 = **13:15**, *14:00* · Set 2 = **13:45**, *14:15* |
| **15:00–17:00** | `CFG-B-12` 12/1 · `CFG-B-14` 14/1 · *(`CFG-B-20` — offered = false)* | 14 | `RM3`, `RM4` | Set 1 = **15:00**, *15:30* · Set 2 = **15:15**, *15:45* |
| **16:00–18:00** | `CFG-A-12` 12/1 · `CFG-A-14` 14/1 · `CFG-A-20` 20/2 | 20 | `RM1`, `RM2` | Set 1 = **16:15**, *17:00* · Set 2 = **16:45**, *17:15* |

All six Sunday reserved times are consumed: **13:15, 13:45, 15:00, 15:15, 16:15, 16:45**.

### 3.5 Proof that no physical room is ever double-booked

The only room pairs that matter are those in windows that genuinely overlap in time.

| Overlapping pair | Overlap period | Rooms in window A | Rooms in window B | Disjoint? |
|---|---|---|---|---|
| Mon–Fri 17:00–19:00 / 18:00–20:00 | 18:00–19:00 | `RM1`, `RM2` | `RM3`, `RM4`, `RM5` | yes |
| Sat 10:00–12:00 / 11:00–13:00 | 11:00–12:00 | `RM1`, `RM2`, `RM5` | `RM3`, `RM4` | yes |
| Sun 10:00–12:00 / 11:00–13:00 | 11:00–12:00 | `RM1`, `RM2`, `RM5` | `RM3`, `RM4` | yes |
| Sun 15:00–17:00 / 16:00–18:00 | 16:00–17:00 | `RM3`, `RM4` | `RM1`, `RM2` | yes |

All other same-day windows only touch at a boundary (Sat 11:00–13:00 ends as 13:00–15:00 begins),
which R-30 treats as non-overlapping at the seeded 0-minute changeover. Peak simultaneous room use
is **5 rooms**, on Saturday and Sunday between 11:00 and 12:00. That is why the seed has five rooms
and not fewer.

### 3.6 Verification: every capacity sentence in the brief, reproduced

| Brief sentence | Reproduced by | ✓ |
|---|---|---|
| Mon–Fri 5–7: "largest party room set holds up to 14 (13 friends + honoree)" | `CFG-A-14` = 14 | ✓ |
| Mon–Fri 5–7: "over 14 → two time slots… up to 20" | `CFG-A-20` = 20, RS 2 | ✓ |
| Mon–Fri 6–8: "One room max 12, the other max 14" | `CFG-B-12` = 12, `CFG-B-14` = 14 | ✓ |
| Mon–Fri 6–8: "the largest party room can hold up to 18" | `CFG-G-18` = 18 | ✓ |
| Sat/Sun 10–12: "holds up to 14 · over 14 → two slots, up to 20" | `CFG-A-14`, `CFG-A-20` | ✓ |
| Sat/Sun 10–12: "third time slot… holds up to 18" | `CFG-G-18` offered as the 3rd room-slot | ✓ |
| Sat/Sun 10–12: games at 10:15, 10:30, 10:45, 11:00 | Sets 1 & 2, mode `PARTY_ONLY` (R-04) | ✓ |
| Sat/Sun 11–1: "two rooms: one max 12, one max 14" | `CFG-B-12`, `CFG-B-14` | ✓ |
| Sat 1–3, Sat 5–7, Sun 1–3, Sun 4–6: "largest holds 14 · two slots up to 20" | `CFG-A-14`, `CFG-A-20` | ✓ |
| Sat 3–5, Sun 3–5: "two rooms: one max 12, one max 14" | `CFG-B-12`, `CFG-B-14` | ✓ |
| "Over 20 guests: up to 28 guests, which takes 3 time slots" | `CFG-A-28` / `CFG-B-28`, capacity 28, RS 3 | ✓ |
| "The arena holds a maximum of 25 players at a time" | `CFG.arenaCapacity` = 25 (R-63) | ✓ |
| "Groups over 25 must be split into 2 laser tag game groups" | R-64 | ✓ |
| Every reserved game time (4 Mon–Fri, 6 Sat, 6 Sun) | §3.4 sets, all 16 accounted for | ✓ |
| Every party window (2 Mon–Fri, 5 Sat, 5 Sun) | §3.4 | ✓ |

**Known consequence to flag to the manager:** under the literal seed, a 28-guest party is bookable
in only **three** windows — Saturday 10:00–12:00, Sunday 10:00–12:00, and Monday–Friday 18:00–20:00.
Saturday 13:00–15:00 tops out at 20 and Saturday 11:00–13:00 tops out at 14. See OQ-07 and OQ-10.

---

## 4. Worked examples

Every example assumes an otherwise empty calendar unless it says otherwise, and uses the seeded
configuration in §2.0 and §3. Tax is shown at the *provisional* 12% (OQ-20); it is a single line so
QA can re-baseline it by changing one number. Money rounds half-up to 2 decimals.

---

### WE-01 — 10 guests, Tuesday, The Great Adventure

| | |
|---|---|
| **Inputs** | Tue 2026-09-15 · window 17:00–19:00 · 10 guests · honoree age 8 · `GREAT_ADVENTURE` · no add-ons |
| **Room allocation** | Configurations with capacity ≥ 10: `CFG-A-12` (12, RS 1), `CFG-A-14` (14, RS 1), `CFG-A-20` (20, RS 2). R-25 ranks fewest room-slots first (tie), then smallest capacity → **`CFG-A-12` → room `RM2`** |
| **Room-slots consumed** | **1 of 2**. `RM1` stays free, so a second party can still book this window subject to R-35 |
| **Pizzas** | 10 guests → tier 10–11 → **2 Large 1-Topping** (included) |
| **Game times** | Claims Set 1 → **17:15 and 18:15** (both verbatim reserved times). Both marked `PARTY_HELD` |
| **Arena groups** | 10 ≤ 25 → **1 group of 10**. Arena headroom at 17:15 and 18:15 drops to 15 |
| **Price** | base 259.50 + extras 0 = **pre-tax 259.50** · tax 31.14 · **total 290.64** · deposit 50.00 · balance due 240.64 |
| **Result** | **ACCEPT** |

---

### WE-02 — 14 guests, Saturday 13:00–15:00, The Great Adventure

| | |
|---|---|
| **Inputs** | Sat 2026-09-19 · window 13:00–15:00 · 14 guests · honoree age 10 · `GREAT_ADVENTURE` |
| **Room allocation** | `CFG-A-12` (12) fails capacity. Candidates: `CFG-A-14` (14, RS 1), `CFG-A-20` (20, RS 2). Fewest room-slots wins → **`CFG-A-14` → room `RM1`** |
| **Room-slots consumed** | **1 of 2**. `RM2` (12) still sellable to a second party |
| **Pizzas** | 14 → tier 12–15 → **3** |
| **Game times** | Claims Set 1. Configured: **13:15**. Package needs 2 games, so R-17 appends: earliest T ≥ 13:45 that is not another set's configured time → 13:45 belongs to Set 2, skip → **14:00** (free, inside window, 14:00+15 = 14:15 ≤ 15:00). Result **13:15 and 14:00**, 14:00 becomes `PARTY_HELD` |
| **Arena groups** | 14 ≤ 25 → **1 group of 14** |
| **Price** | 259.50 + 4 × 25.95 (103.80) = **pre-tax 363.30** · tax 43.60 · **total 406.90** · balance due 356.90 |
| **Result** | **ACCEPT** |

---

### WE-03 — 15 guests, Saturday 13:00–15:00 (crosses the two-room-slot boundary)

| | |
|---|---|
| **Inputs** | Sat 2026-09-19 · window 13:00–15:00 · **15 guests** · honoree age 10 · `GREAT_ADVENTURE` · empty calendar |
| **Room allocation** | `CFG-A-14` (14) now fails by one guest. Only `CFG-A-20` (capacity 20, RS 2) fits → **rooms `RM1` + `RM2`** |
| **Room-slots consumed** | **2 of 2 — the window is now sold out.** No second party can book Saturday 13:00–15:00 on this date, so the age rule (R-35) never comes into play |
| **Pizzas** | 15 → tier 12–15 → **3** (same as 14 guests; the pizza boundary and the room boundary are in different places, which is worth showing the manager) |
| **Game times** | Claims Set 1 → **13:15** + R-17 append → **14:00** |
| **Side effect (R-18)** | Set 2 (**13:45** + its would-be append) is now unclaimable, because condition 2(a) is met — the window has no remaining bookable configuration. **13:45 releases to the public immediately**, without waiting for the 7-day lead |
| **Arena groups** | 15 ≤ 25 → **1 group of 15** |
| **Price** | 259.50 + 5 × 25.95 (129.75) = **pre-tax 389.25** · tax 46.71 · **total 435.96** · balance due 385.96 |
| **Result** | **ACCEPT.** Compared with WE-02, one extra guest costs $25.95 and costs the venue an entire second party |

---

### WE-04 — 22 guests, Sunday 10:00–12:00, Around The World

| | |
|---|---|
| **Inputs** | Sun 2026-09-20 · window 10:00–12:00 · 22 guests · honoree age 9 · `AROUND_THE_WORLD` |
| **Room allocation** | Capacity ≥ 22 leaves only `CFG-A-28` (capacity 28, RS 3) → **rooms `RM1` + `RM2` + `RM5`** |
| **Room-slots consumed** | **3 of 3 — the whole window.** Note `RM3`/`RM4` are untouched, so the overlapping Sunday 11:00–13:00 window is still fully sellable (R-30, §3.5) |
| **Pizzas** | 22 → tier 21–25 → **5** |
| **Game times** | Claims Set 1 → **10:15 and 10:45**, both mode `PARTY_ONLY` |
| **Arena groups** | 22 ≤ 25 → **1 group of 22**. Headroom at 10:15 is 3 — but R-04 means no public booking can use it anyway |
| **Unused inventory** | Set 2 (10:30, 11:00) goes unused. It does **not** release to the public: R-19 blocks `PARTY_ONLY` slots from ever releasing |
| **Price** | 359.50 + 12 × 35.95 (431.40) = **pre-tax 790.90** · tax 94.91 · **total 885.81** · balance due 835.81 |
| **Result** | **ACCEPT** |

---

### WE-05 — 28 guests, Saturday 10:00–12:00 (three room-slots + arena split)

| | |
|---|---|
| **Inputs** | Sat 2026-09-26 · window 10:00–12:00 · **28 guests** · honoree age 11 · `GREAT_ADVENTURE` |
| **Room allocation** | 28 = `CFG.maxPartyGuests`. Only `CFG-A-28` fits → **`RM1` + `RM2` + `RM5`** |
| **Room-slots consumed** | **3 of 3** |
| **Pizzas** | 28 → tier 26–30 → **6** |
| **Arena groups** | 28 > 25 → R-64 splits into `ceil(28/25) = 2` groups, sized as evenly as possible → **Group A = 14, Group B = 14** |
| **Game times** | 2 groups × 2 games = 4 slots needed, none shared between groups. Group A claims Set 1 → **10:15, 10:45**; Group B claims Set 2 → **10:30, 11:00**. This consumes exactly the four weekend morning game slots the brief lists |
| **Arena check** | 10:15 → 14 ≤ 25 ✓ · 10:30 → 14 ✓ · 10:45 → 14 ✓ · 11:00 → 14 ✓. At no instant are 28 players in the arena |
| **Price** | 259.50 + 18 × 25.95 (467.10) = **pre-tax 726.60** · tax 87.19 · **total 813.79** · balance due 763.79 |
| **Result** | **ACCEPT.** Only bookable in the three windows that own three room-slots (§3.6) |

---

### WE-06 — Second party into an occupied window, ages 7 and 9 (allowed)

| | |
|---|---|
| **Existing state** | Sat 2026-10-03 · window 15:00–17:00 · Party P1: 12 guests, honoree age **7**, `CFG-B-12` → room `RM4`, holds Set 1 = 15:15 + appended 16:00 |
| **Inputs** | Same date and window · 10 guests · honoree age **9** · `GREAT_ADVENTURE` |
| **Age check (R-35)** | \|7 − 9\| = 2 ≤ `CFG.maxAgeDifferenceYears` (2) → **passes on the boundary** |
| **Room allocation** | Capacity ≥ 10 and free: `CFG-B-12` is unavailable (`RM4` taken by P1); `CFG-B-14` free → **room `RM3`** (RS 1) |
| **Room-slots consumed** | **2 of 2** — window now sold out |
| **Pizzas** | 10 → **2** |
| **Game times** | Set 1 taken, so claims Set 2 → **15:45** + R-17 append: T ≥ 16:15, 16:00 held by P1 → **16:15** |
| **Arena groups** | 1 group of 10. Slot occupancy: 15:15 → 12 · 15:45 → 10 · 16:00 → 12 · 16:15 → 10. All ≤ 25 ✓ |
| **Shared-game check (R-36)** | The two parties never land on the same slot here, so R-36 is not exercised — but if they had, \|7−9\| = 2 would still pass |
| **Price** | 259.50 + 0 = **pre-tax 259.50** · tax 31.14 · **total 290.64** |
| **Result** | **ACCEPT** |

---

### WE-07 — Second party into the same window, ages 7 and 11 (rejected)

| | |
|---|---|
| **Existing state** | Identical to WE-06: P1 honoree age **7** in Saturday 15:00–17:00 |
| **Inputs** | Same date and window · 10 guests · honoree age **11** |
| **Age check (R-35)** | \|7 − 11\| = 4 > 2 → **fails** |
| **Room allocation** | Not attempted. R-35 is evaluated **before** room allocation so the customer is not shown a room that will then be pulled away |
| **Result** | **REJECT — `AGE_GAP_EXCEEDED`.** Customer message: *"Saturday 3:00pm–5:00pm on Oct 3 is already booked by a party for a 7-year-old. Parties sharing a two-hour window must be within 2 years in age. Try a different time — 1:00pm–3:00pm and 5:00pm–7:00pm are open — or call 204-474-5900."* The UI SHOULD pre-filter windows by the honoree's age before the customer picks, so this rejection is rare |

---

### WE-08 — Public laser tag booked 45 minutes before start (rejected)

| | |
|---|---|
| **Inputs** | Thu 2026-09-17 · 6 players · 1 game at **13:45** · booking attempted online at **13:00** local |
| **Cutoff check (R-10)** | `startTime − CFG.onlineCutoffMinutes` = 13:45 − 90 min = **12:15**. `now` (13:00) > 12:15 → **fails**. The customer is 45 minutes out; the cutoff needs 90 |
| **Rooms / pizzas** | n/a (public booking) |
| **Game times** | none assigned |
| **Arena groups** | none assigned. Note the arena had headroom — this rejection is **policy**, not capacity |
| **Price** | would have been 6 × $8.49 = $50.94 pre-tax; not charged |
| **Result** | **REJECT — `ONLINE_CUTOFF`.** Message: *"Online booking closes 90 minutes before each game. The 1:45pm game can't be booked online now — walk in, or call 204-474-5900. The next game you can book online today is 2:30pm."* |
| **Manager path** | Staff MAY create this booking in the backend: `CFG.cutoffAppliesToManager = false` (R-13). This is exactly the walk-in double-booking protection the manager asked for |
| **Boundary case for QA** | Booking the same game at exactly **12:15** MUST be **accepted** (R-10 uses strictly-greater-than); at 12:16 it MUST be rejected |

---

### WE-09 — Reserved 17:15 game on a Wednesday with no party booked (released to public)

| | |
|---|---|
| **Inputs** | Wed 2026-09-16 · public booking attempted on Sun 2026-09-13 at 19:00 (**3 days ahead**) · 6 players · **2 games starting 17:15** |
| **Slot status before** | 17:15 is Set 1 game 1 of the Mon–Fri 17:00–19:00 window → mode `PARTY_HELD`. 17:30 is Set 2 game 1 → also `PARTY_HELD` |
| **Release check (R-18)** | (1) No party booking on 2026-09-16 has claimed Set 1 or Set 2 ✓. (2b) `now` is 3 days out, within `CFG.reservedReleaseLeadMinutes` (7 days) ✓ → **both 17:15 and 17:30 release to the public** |
| **Cutoff check (R-10)** | 3 days > 90 minutes ✓ |
| **Game times assigned** | `CFG.publicGamesMustBeConsecutive` → **17:15 and 17:30** |
| **Arena groups** | 1 group of 6. Occupancy 6/25 at each slot |
| **Price** | 2-game rate $15.49 × 6 = **pre-tax 92.94** · tax 11.15 · **total 104.09** |
| **Result** | **ACCEPT** |
| **Knock-on (R-16, R-20)** | If a party then tries to book Wed 17:00–19:00, it claims Set 1 but **17:15 is dropped** — a sold public game is never taken back. It keeps **18:15** and R-17 appends: T ≥ 18:45 is Set 2's configured time → skip → **19:00**. The party plays 18:15 and 19:00 |
| **Contrast for QA** | The same public request made **10 days ahead** MUST be **rejected** with `SLOT_HELD_FOR_PARTY`, because R-18 condition 2 fails on both branches (a party could still book the window, and 10 days > the 7-day lead) |

---

### WE-10 — Saturday 10:15 game, public booking attempted (rejected)

| | |
|---|---|
| **Inputs** | Sat 2026-09-19 · public booking · 4 players · 1 game at **10:15** · attempted 3 weeks ahead, no party booked in the 10:00–12:00 window |
| **Slot status** | 10:15 exists (R-04) with mode **`PARTY_ONLY`** |
| **Release check** | **Not evaluated.** R-19 exempts `PARTY_ONLY` slots from R-18 entirely. Lead time, party occupancy and arena headroom are all irrelevant |
| **Rooms / pizzas / arena** | n/a |
| **Price** | not calculated |
| **Result** | **REJECT — `PARTY_ONLY_WINDOW`.** Message: *"Saturday mornings are reserved for birthday parties. We open to the public at 12:00pm — the first game you can book is 12:00pm. To book a party in this window, use the birthday party booking."* |
| **Why** | This is the approved default for the brief's gap #4: weekend 10:00–12:00 is party-only and public hours start at 12:00. The 10:15/10:30/10:45/11:00 games exist **only** to serve the parties in that window |

---

### WE-11 — 30 guests, any day (exceeds every configuration)

| | |
|---|---|
| **Inputs** | any date · any window · **30 guests** · `GREAT_ADVENTURE` |
| **Room allocation** | The largest configuration anywhere in §3.3 is `CFG-A-28` / `CFG-B-28` at capacity **28**. 30 > 28, on every day and in every window |
| **Room-slots consumed** | none |
| **Pizzas / games / arena** | not calculated |
| **Result** | **REJECT — `EXCEEDS_MAX_PARTY_SIZE`.** Message: *"Our largest party setup holds 28 guests. For 30 guests, please call us at 204-474-5900 so we can look at options."* The number 28 in that message MUST come from `CFG.maxPartyGuests`, so raising the ceiling changes the copy too |
| **QA boundary** | 28 guests → accept (WE-05). 29 guests → reject. The rejection must **not** be `NO_ROOM_CONFIG`; a distinct code lets the UI show "call us" rather than "try another time" |

---

### WE-12 — 16 guests, Saturday 11:00–13:00 (rejected — exposes an open question)

| | |
|---|---|
| **Inputs** | Sat 2026-10-10 · window **11:00–13:00** · 16 guests · honoree age 9 · `GREAT_ADVENTURE` · empty calendar |
| **Room allocation** | The brief describes this window as *"two different size party rooms: one max 12, one max 14"* and says nothing about combining them. Offered configurations are `CFG-B-12` (12) and `CFG-B-14` (14). `CFG-B-20` exists in the table but is seeded **offered = false**. Max capacity in this window is therefore **14** |
| **Room-slots consumed** | none |
| **Result** | **REJECT — `NO_ROOM_CONFIG`.** Message: *"Saturday 11:00am–1:00pm holds up to 14 guests. For 16, try Saturday 1:00pm–3:00pm (up to 20) or Saturday 10:00am–12:00pm (up to 28)."* |
| **Why this example exists** | Physically `RM3` + `RM4` are the same kind of pair as `RM1` + `RM2`, which *does* combine to 20. Enabling `CFG-B-20` in this window is a **single boolean flip** with no code change (R-33). I did **not** flip it, because the brief never says the venue does this and I will not quietly invent capacity. **This is OQ-10 and it is worth a two-minute phone call** — it currently costs the venue every 15–20 guest party on Saturday 11:00–13:00, Saturday 15:00–17:00, Sunday 11:00–13:00 and Sunday 15:00–17:00 |

---

### WE-13 — 12 guests, Wednesday 18:00–20:00, The Traveler with every add-on type

Included to exercise add-on pricing, eligibility, mixed tax treatment, and the auto-assignment
fallback in a window with no configured reserved times.

| | |
|---|---|
| **Inputs** | Wed 2026-10-14 · window **18:00–20:00** · 12 guests · honoree age 8 · `TRAVELER` · add-ons: `ARCADE_TIMEPLAY_45` × 12, `QBIX_5D` × 12, `PIZZA_1TOP` × 3 (Pepperoni), `WINGS_16` × 1 (Honey Garlic) |
| **Room allocation** | Capacity ≥ 12: `CFG-B-12` (12, RS 1), `CFG-B-14` (14, RS 1), `CFG-G-18` (18, RS 1), `CFG-B-28` (28, RS 3). All tie on room-slots except the last; smallest capacity wins → **`CFG-B-12` → room `RM4`** |
| **Room-slots consumed** | **1 of 3.** `RM3` and `RM5` remain sellable |
| **Room time** | `TRAVELER.roomMinutes = 90` → the guests have the room 18:00–19:30, but `RM4` is held for the full 18:00–20:00 window (R-32), because the venue cannot re-sell 30 minutes |
| **Pizzas included** | **0.** `TRAVELER.includesPizza = false` under the seeded default (R-42). The 3 pizzas here are a **paid add-on**, not the package's 3-pizza tier. **If OQ-02 resolves the other way, this booking gets 3 free pizzas and this line changes by $73.89** |
| **Add-on eligibility (R-46/R-47)** | `ARCADE_TIMEPLAY_45` is allowed on `TRAVELER` ✓. `ARCADE_5UP_MATCH` MUST NOT also be added (mutually exclusive). The UI warns that the Time Play card does not cover QBIX or Claw Machines (R-49) |
| **Game times** | This window has **no configured party game sets**. R-17 auto-assigns from 18:00: T1 = **18:00** (free; 18:15 and 18:45 are configured to the *17:00–19:00* window's sets and are skipped by R-17(c)). T2 ≥ 18:30 → 18:30 free → **18:30**. Both become `PARTY_HELD`. Both fall inside the Traveler's 90-minute room time ✓ |
| **Arena groups** | 12 ≤ 25 → **1 group of 12** |
| **Price** | package 224.50 + 2 × 22.45 (44.90) = 269.40 · Time Play 12 × 5.00 = 60.00 · QBIX 12 × 3.95 = 47.40 → **pre-tax 376.80** · tax 45.22 → 422.02 · tax-included food: pizzas 3 × 24.63 = 73.89 + wings 19.03 = **92.92** · **total 514.94** · deposit 50.00 · balance due 464.94 |
| **Result** | **ACCEPT** |
| **QA note** | Swapping the package to `AROUND_THE_WORLD` MUST reject the arcade card line with `ADDON_NOT_ELIGIBLE` while keeping QBIX (R-46) |

---

### WE-14 — Reschedule 10 days out, then cancel (deposit lifecycle)

| | |
|---|---|
| **Inputs** | Booking from WE-01 (Tue 2026-09-15 17:00–19:00). Customer requests a date change on **2026-09-05**, then cancels |
| **Notice calculation (R-56)** | Event start 2026-09-15 17:00 local. On 2026-09-05 at 12:00, whole days remaining = **10**. 10 < 14 → notice period **not met** |
| **Reschedule (R-59)** | Self-serve reschedule is **REJECTED — `NOTICE_PERIOD_NOT_MET`**. The verbatim policy also offers "the choice to move to a new rescheduled date", so the manager backend MAY perform the move and carry the $50 deposit. This contradiction is **OQ-12** |
| **Cancel (R-58)** | Cancelling at 10 days → deposit status **`FORFEITED`**, no gift card issued |
| **Contrast** | The same cancellation made on **2026-09-01** (14 whole days out) → R-56 passes on the boundary (`≥ 14`) → deposit status **`CONVERTED_TO_GIFT_CARD`**, a $50 in-facility gift card is issued (R-57) |
| **QA boundary** | Exactly 14 days → gift card. 13 days 23 hours → forfeit. This boundary is **OQ-13**; the brief supports both readings |
| **Audit** | Every state change writes a `BookingChangeLog` row (R-62) |

---

## 5. Open questions

Each entry gives: **what is ambiguous**, **the default I shipped**, and **the question to ask the
manager**. Priority: **P1** = answer before launch, the product is wrong without it. **P2** = answer
before launch, but a wrong default is recoverable. **P3** = polish.

### Structural — rooms and windows

**OQ-04 · P1 · How many party rooms are there, and what are they called?**
The brief never says. §3 seeds **five** rooms (14, 12, 14, 12, 18) because that is the minimum
inventory that reproduces every capacity sentence *and* lets overlapping windows both be sold
without double-booking a room (§3.1, §3.5). Room names are placeholders.
**Ask:** *"How many party rooms do you have, what do you call them, and what is each one's real
maximum? And when a Monday 5–7 party is in a room, which room does the 6–8 party use?"*
**This is the highest-value question in the document — every other room answer follows from it.**

**OQ-05 · P1 · Why do a 14-room and a 12-room combine to 20 rather than 26?**
The brief says two room-slots hold "up to 20". §3.3 stores 20 as an explicit override (R-27).
**Ask:** *"When you open two rooms up for one big party, why does the total drop to 20? Is it
seating, is it the host, or is it a rule of thumb?"* If it is a host/staffing limit rather than a
physical one, it belongs in a different config field and may vary by day.

**OQ-06 · P1 · The same two rooms hold 26 people as two parties but only 20 as one.**
Nobody has flagged this. A 14-guest party and a 12-guest party can occupy Rooms 1 and 2 at the same
time (26 people in the same two rooms), yet one party of 21 in those same rooms is refused because
the combined configuration caps at 20. Default: reproduce the brief exactly, both numbers as given.
**Ask:** *"Is 20 really the ceiling for one party across both rooms, when two parties totalling 26
already share them?"*

**OQ-07 · P1 · "Two parties per two-hour slot" vs. three room-slots on weekend mornings.**
The brief says two parties per window, then describes a **third** room-slot for Saturday and Sunday
10:00–12:00, and a 12 / 14 / 18 set for Monday–Friday 18:00–20:00. Default: no numeric cap
(`CFG.maxPartiesPerWindow = null`); the room inventory decides (R-28), so weekend mornings can take
three parties.
**Ask:** *"Can you actually run three parties at once on a Saturday morning, or is the third room
only for one big group that overflows?"*

**OQ-10 · P2 · Should the second room pair combine to 20 as well?**
Saturday/Sunday 11:00–13:00 and 15:00–17:00 and Monday–Friday 18:00–20:00 are described as "one max
12, one max 14" with no combining mentioned. Default: **not offered** (`CFG-B-20.offered = false`),
so those windows cap at 14 (see WE-12). I refused to invent capacity.
**Ask:** *"Can the 12 and the 14 in the later windows be opened up together for 15–20 guests, the
way they can at 5–7?"* This is currently costing every 15–20 guest booking in four windows.

**OQ-14 · P2 · Should the 18-capacity room be offered in more windows?**
The brief offers it only at Monday–Friday 18:00–20:00 and weekend 10:00–12:00. It is physically free
on Saturday and Sunday afternoons under the §3 seed.
**Ask:** *"Is the big room used for something else on weekend afternoons, or can parties book it?"*

**OQ-26 · P2 · Is there a cleanup buffer between two bookings of the same room?**
Saturday 11:00–13:00 ends exactly as 13:00–15:00 begins. Default `CFG.windowChangeoverMinutes = 0`.
**Ask:** *"How long do you need between one party leaving a room and the next arriving?"*

**OQ-27 · P3 · Holiday closures and special hours.**
The brief gives weekly hours only. Default: a `Closure` table, empty at seed (R-06).
**Ask:** *"Which days are you closed, and do any days have different hours?"*

**OQ-36 · P3 · Room display names.** Placeholders. **Ask for the real names** so staff and customers
see the same words.

### Structural — game times

**OQ-03 · P1 · Which reserved game time belongs to which party?**
Flagged in the brief. Default: party game sets (R-15), with Monday–Friday **interleaved** —
Set 1 = 17:15 + 18:15, Set 2 = 17:30 + 18:45 — so each party's two games are spread across its two
hours rather than run back to back at 17:15 and 17:30. Weekend mornings likewise: Set 1 = 10:15 +
10:45, Set 2 = 10:30 + 11:00.
**Ask:** *"When two parties are in at 5pm, which one plays at 5:15 and which at 5:30, and when is
each one's second game?"*

**OQ-08 · P1 · Monday–Friday 18:00–20:00 has no reserved game times at all.**
It is a listed party window, and every package includes 2 games, but all four Monday–Friday reserved
times (17:15, 17:30, 18:15, 18:45) fall inside the *17:00–19:00* window. Default: R-17 auto-assigns
from free slots inside 18:00–20:00 (first party gets 18:00 and 18:30) and blocks them from the
public.
**Ask:** *"What times do the 6–8pm parties play?"*

**OQ-09 · P1 · The third weekend-morning party has nowhere to play.**
Saturday and Sunday 10:00–12:00 offer three room-slots but only four game slots exist all morning
(10:15, 10:30, 10:45, 11:00), and the first two parties consume all four. A third party can only be
booked if it shares a game slot with another party within the 25-player arena cap and the 2-year age
rule (`CFG.partiesMayShareGameSlot = true`), otherwise R-66 rejects it with `NO_GAME_CAPACITY`.
**Nobody has flagged this; it makes the "third time slot" largely unsellable as written.**
**Ask:** *"If three parties are in on a Saturday morning, do some of them play together in the same
game, or do you run games at 11:15 and 11:30 as well?"*

**OQ-11 · P2 · The 11:00–13:00 weekend window has no game times of its own.**
Under the literal reading (R-05) no game slots exist between 11:15 and 11:45, and the four morning
slots belong to the 10:00–12:00 window. So an 11:00–13:00 party's games get auto-assigned at 12:00
and later — blocking the first public games of the day from walk-ins.
**Ask:** *"When do the 11am–1pm parties play? Should we be blocking 12:00 and 12:30 from the public
to give them games?"*

**OQ-21 · P1 · Can two different parties play in the same game?**
The brief never says. This determines the meaning of the 25-player cap: is it 25 across everyone in
the arena (yes — R-12 as written), and can two birthday groups be in there together? Default:
`CFG.partiesMayShareGameSlot = true`, subject to the arena cap and to the age rule being applied
across the shared slot (R-36). **Circumstantial evidence says yes:** the 2-year age rule only makes
sense if the two parties meet, and a 14-guest party plus a 12-guest party is 26 players — one over
the arena cap — which is precisely the kind of pair the rule would have to police.
**Ask:** *"When two parties are in at the same time, do they play laser tag together in one game, or
does each party get the arena to itself?"* If the answer is "to itself", `CFG.partiesMayShareGameSlot`
becomes false and OQ-09 gets worse, not better.

**OQ-28 · P2 · How far ahead should an unclaimed reserved game time open to the public?**
The brief says only "They open up if no party is scheduled". Releasing immediately would let the
public eat party inventory months ahead; never releasing wastes it. Default:
`CFG.reservedReleaseLeadMinutes = 10080` (**7 days**), plus immediate release once the window can no
longer be sold to a party (R-18 condition 2a, demonstrated in WE-03).
**Ask:** *"How close to the day do you want to give up on a party and sell those times to walk-ins —
a week? Three days?"*

**OQ-29 · P2 · When does the last game of the day start?**
The brief gives closing times, not last game times. Default: `close − 15 min` (Mon–Thu 20:45,
Fri 21:45, Sat 20:45, Sun 18:45).
**Ask:** *"What's the last game you'll start on a weeknight?"*

**OQ-23 · P3 · Are multi-game bookings consecutive, and can anyone book more than 3 games?**
Default: consecutive slots (12:00, 12:15, 12:30) and a maximum of 3, since only 1/2/3 games are
priced.
**Ask:** *"When someone buys 3 games, do they play them back to back?"*

### Packages, food and pricing

**OQ-01 · P1 · Pizza tiers.** Already approved in the brief: 10–11 → 2, 12–15 → 3, 16–20 → 4,
21–25 → 5, 26–30 → 6. Shipped as an editable table with contiguity validation (R-41).
**Ask, for confirmation only:** *"11 guests gets 2 pizzas and 20 gets 4 — correct?"*

**OQ-02 · P1 · The Traveler contradicts itself, twice.**
(a) **Food:** the website lists no food for The Traveler; the manager's brief says every package
includes 2 pizzas. Default: **The Traveler includes no food** (`includesPizza = false`), with pizza
sold as an add-on. Rationale: the website is the published customer promise and is the more specific
statement.
(b) **Duration:** The Traveler is 1.5 hours in the room, but every party window is 2 hours. Default:
the package shows 90 minutes of room time while the room-slot is held for the full 2 hours (R-32).
(c) **A third contradiction nobody flagged:** The Traveler includes **2 laser tag games**, and the
reserved game sets spread those games across a **2-hour** window (e.g. 17:15 and 18:15 — 60 minutes
apart). In a 90-minute room booking starting at 17:00 that still fits, but Set 2 (17:30 and 18:45)
puts the second game **15 minutes after the room time ends**. Under the seeded sets, a Traveler party
that draws Set 2 on a weeknight is scheduled to play after it has left the room.
**Ask:** *"Does The Traveler come with pizza or not? And if it's only 90 minutes in the room, when
do those guests play their two games?"*
**This is the single most launch-blocking pricing question in the document.**

**OQ-20 · P1 · Tax.** The brief says laser tag prices exclude tax and pizza/wings prices include it,
and says nothing about party packages, extra guests, QBIX or arcade cards. Default:
`CFG.taxRatePercent = 12.0` applied to all tax-exclusive lines; pizzas and wings excluded from the
tax calculation (R-51, R-67).
**Ask:** *"What tax rate do you charge on party packages, and are the package prices on your site
before or after tax?"* Every total in §4 moves if this changes.

**OQ-19 · P2 · Hot dogs and cupcakes have no quantities.**
"Pizza **or** hot dogs" and "cupcakes" are listed with no counts. Defaults: hot dogs = 1 per guest
(replacing the pizza allotment, R-43); cupcakes = 1 per guest.
**Ask:** *"How many hot dogs and how many cupcakes per guest?"*

**OQ-22 · P2 · What happens below 10 guests?**
Packages "accommodate 10 guests". Default: full base price, no discount, minimum 1 guest (R-40).
**Ask:** *"Is 10 a minimum you charge for, or will you do a smaller party for less?"*

**OQ-24 · P2 · Do non-playing adults count?**
The brief counts "guests" for both room capacity and package price, and is silent on parents and
siblings who are in the room but not in the arena. Default: guests = players; adults are not
modelled at all.
**Ask:** *"Do the parents who stay count toward the 14 in the room? Do they ever play?"* If adults
occupy room capacity but not arena capacity, the schema needs a second count and R-12 changes.

**OQ-25 · P3 · Honoree age.** Default: the age being turned, entered as an integer, required on
every party booking (needed for R-35 before a window can even be offered).
**Ask:** *"Do you go by the age they're turning?"*

**OQ-30 · P2 · Is there a minimum lead time for a party booking?**
The brief gives a 90-minute cutoff for laser tag and a 14-day change policy, but no minimum notice
for creating a party — yet pizzas have to be ordered. Default: none beyond the 90-minute cutoff.
**Ask:** *"What's the shortest notice you'll take a party booking on?"*

**OQ-31 · P3 · Allocation can strand the big-party option.**
R-25 gives a 10-guest party the 12-capacity room, which is efficient — but if the 12 and the 14 are
booked separately, the 20-capacity combination is gone for the day. The alternative is to hold the
large room back.
**Ask:** *"If a party of 10 books first, would you rather put them in the small room and keep the
big one free, or keep both rooms open in case a party of 18 calls?"*

**OQ-32 · P3 · Public laser tag payment, refunds and no-shows.**
The brief covers deposits for events only. Default: public bookings are recorded with a price and no
payment; no refund policy is implemented.
**Ask:** *"Do people pay for laser tag when they book online, or at the desk?"*

### Add-ons

**OQ-15 · P2 · 5-Up Arcade Card match mechanics.**
"Guest spends $5, Lasertopia matches with $5 Bonus Cash. Matched up to $20." Default: 1:1 match on
loads of $5 to $20 in $5 increments, so the maximum is $20 loaded + $20 bonus. Also unclear whether
the guest pays at booking or at the counter; default is charged at booking (R-48).
**Ask:** *"Is the match capped at $20 of bonus, and is the card bought online or at the desk?"*

**OQ-16 · P2 · Arcade card exclusivity granularity.**
The brief says "$5 match **OR** $5 Time Play card". Default: the choice is made once for the whole
booking, not per guest (R-47), because individual guests are not modelled.
**Ask:** *"Can some kids at the same party take the match and others take the 45-minute card?"*

**OQ-17 · P2 · Is "Typhoon Experience" the same attraction as QBIX 5D?**
Nobody has flagged this. The verified attraction list on lasertopia.ca is Laser Tag, Arcade, Party
Rooms, Lazer Frenzy, QBIX 5D, prizes and concession — **there is no Typhoon**. Yet Around The World
includes a "Typhoon Experience ride", and QBIX 5D is described as a motion ride with wind and motion
effects. If they are the same thing, the platform is currently offering to sell Around The World
customers a $3.95-per-person QBIX add-on for something their package already includes.
**Ask:** *"Is the Typhoon Experience the same ride as QBIX 5D? If so, should QBIX be hidden on
Around The World?"* Default until answered: they are treated as different, and QBIX remains
available on all packages (R-50).

**OQ-18 · P3 · Lazer Frenzy and Typhoon have no capacity or scheduling.**
Around The World includes both, and QBIX seats "up to 5 friends". None of the three has a stated
session length or group size limit. Default: all are priced/included line items with no scheduling;
a 20-guest Around The World party is not allocated ride times.
**Ask:** *"Do Lazer Frenzy, Typhoon and QBIX need to be scheduled into the two hours, or do the hosts
just take groups through?"*

**OQ-33 · P3 · "Hawaiian" is listed as a topping.**
It is normally two toppings (ham and pineapple). Default: Hawaiian is selectable at the 1-Topping
price. **Ask:** *"Does Hawaiian cost the 1-topping or 2-topping price?"*

**OQ-34 · P3 · Wing sauces.** Seven sauces are listed with no quantity rule. Default: one sauce per
wing order. **Ask:** *"Can they mix sauces on a 24-piece order?"*

**OQ-35 · P3 · "Merch for honoree" has no SKU, size or cost.** Default: included, not modelled.
**Ask:** *"Does the merch need a size or a choice at booking time?"*

### Deposit and policy

**OQ-12 · P1 · The cancellation policy contradicts itself on rescheduling inside 14 days.**
"If you need to change the date of your booking, we require at least 2 weeks notice" forbids it;
"you forfeit your deposit **or have the choice to move to a new rescheduled date**" permits it.
Default: self-serve reschedule requires ≥14 days; inside 14 days it is a manager-only backend action
with the deposit carried (R-59, WE-14).
**Ask:** *"Inside two weeks, can someone move their date, or is it forfeit only?"*

**OQ-13 · P2 · The boundary at exactly 14 days.**
"at least 2 weeks notice" implies ≥14 is fine; "cancelled before 14 days" and "within 14 days or
less" imply >14 is required. Default: **≥14 days counts as sufficient notice** (customer-favourable,
R-56).
**Ask:** *"If someone cancels exactly two weeks out, do they get the gift card?"*

**OQ-14 · P2 · Deposit scope, and gift card terms.**
The deposit is "$50.00 per event". Default: one $50 deposit per booking regardless of how many
room-slots it consumes — a 28-guest booking using 3 rooms still pays $50 (R-54). Gift cards have no
stated expiry or transferability.
**Ask:** *"Is it $50 no matter how big the party? And do the gift cards expire?"*

---

## 6. Proposed data model

Sufficient to write a Prisma schema. **ME** in the "Manager-editable" column means the manager
backend MUST expose the field for editing without a deploy. Money is stored as integer cents.
Times-of-day are stored as minutes-from-midnight integers (avoids date/timezone bugs on templates);
absolute instants are stored as UTC timestamps.

### 6.1 Configuration and inventory

**`Setting`** — single-row-per-key store for §2.0.
`key` (PK, string) · `value` (string) · `valueType` (enum: INT, DECIMAL, BOOL, STRING) ·
`description` · `updatedAt` · `updatedByUserId`. **All ME.**

**`Room`** — physical inventory.
`id` · `name` **ME** · `capacity` (int) **ME** · `isActive` (bool) **ME** · `sortOrder` **ME** ·
`notes` **ME**.
→ has many `RoomConfigurationRoom`, has many `BookingRoomSlot`.

**`RoomConfiguration`** — a bookable unit of one or more rooms (§3.3).
`id` · `code` · `name` **ME** · `capacity` (int) **ME, authoritative, overrides the member sum
(R-27)** · `roomSlotsConsumed` (int, MUST equal the member room count) · `priority` (int) **ME** ·
`isActive` **ME**.
→ has many `RoomConfigurationRoom`, has many `WindowOffering`, has many `PartyBooking`.

**`RoomConfigurationRoom`** — join.
`roomConfigurationId` · `roomId` · `sortOrder`. Unique on (`roomConfigurationId`, `roomId`).

**`PartyWindow`** — the 2-hour template (§3.4).
`id` · `dayOfWeek` (0–6) **ME** · `startMinutes` **ME** · `endMinutes` **ME** · `label` **ME** ·
`isActive` **ME** · `maxParties` (int, nullable — R-28) **ME**.
Unique on (`dayOfWeek`, `startMinutes`).
→ has many `WindowOffering`, has many `PartyGameSet`, has many `PartyBooking`.

**`WindowOffering`** — which configurations are sold in which window (§3.4).
`id` · `partyWindowId` · `roomConfigurationId` · `isOffered` (bool) **ME — this is the boolean in
OQ-10/OQ-14** · `priority` (int) **ME**. Unique on (`partyWindowId`, `roomConfigurationId`).

**`PartyGameSet`** — one party's reserved game times in a window (R-15).
`id` · `partyWindowId` · `setIndex` (int) · `isActive` **ME**. Unique on (`partyWindowId`,
`setIndex`).
→ has many `PartyGameSetTime`.

**`PartyGameSetTime`** — `id` · `partyGameSetId` · `sortOrder` · `startMinutes` **ME** ·
`source` (enum: BRIEF, MANAGER). Unique on (`partyGameSetId`, `startMinutes`).

**`OperatingHours`** — `id` · `dayOfWeek` (unique) · `opensMinutes` **ME** · `closesMinutes` **ME** ·
`firstPublicGameMinutes` **ME** · `lastPublicGameMinutes` **ME**.

**`PartyOnlyGameTime`** — the weekend 10:15–11:00 slots (R-04).
`id` · `dayOfWeek` · `startMinutes` **ME**. Unique on both. Materialises as mode `PARTY_ONLY`.

**`Closure`** — `id` · `date` (unique) **ME** · `reason` **ME** · `blocksParties` (bool) **ME** ·
`blocksPublic` (bool) **ME**.

**`Package`** — `id` · `code` · `name` **ME** · `basePriceCents` **ME** · `extraGuestPriceCents`
**ME** · `baseGuests` (int, 10) **ME** · `gamesIncluded` (int, 2) **ME** · `roomMinutes` **ME** ·
`includesPizza` (bool) **ME — OQ-02** · `includesCupcakes` **ME** · `includesHotDogOption` **ME** ·
`funCardCentsPerGuest` **ME** · `includesLazerFrenzy` **ME** · `includesTyphoon` **ME** ·
`arcadeCardEligible` **ME** · `descriptionMarkdown` **ME** · `isActive` **ME** · `sortOrder` **ME**.

**`PizzaTier`** — `id` · `minGuests` **ME** · `maxGuests` **ME** · `pizzaCount` **ME**. Validated
contiguous and non-overlapping on save (R-41).

**`AddOn`** — `id` · `code` · `name` **ME** · `pricingMode` (enum: PER_GUEST, PER_UNIT) **ME** ·
`priceCents` **ME** · `taxIncluded` (bool) **ME — R-51** · `requiresOptionChoice` (bool) **ME** ·
`exclusiveGroup` (string, nullable — the two arcade cards share one group, R-47) **ME** ·
`isActive` **ME** · `sortOrder` **ME**.
→ has many `AddOnPackageEligibility` (`addOnId`, `packageId`) **ME — R-46**;
→ has many `AddOnOption` (`id`, `addOnId`, `label` **ME**, `priceDeltaCents` **ME**, `sortOrder`) —
holds pizza toppings and wing sauces.

**`GameSlotPricing`** — `id` · `gameCount` (1/2/3, unique) **ME** · `pricePerPersonCents` **ME** ·
`taxIncluded` (false).

### 6.2 Materialised availability

**`GameSlot`** — one row per `(date, startTime)` (glossary; R-03).
`id` · `date` · `startMinutes` · `startsAtUtc` · `mode` (enum: PUBLIC, PARTY_HELD, PARTY_ONLY,
BLOCKED) · `sourcePartyGameSetId` (nullable — set when the slot came from a configured reserved
time) · `releasedToPublicAt` (nullable — audit of R-18) · `blockedReason` (nullable) **ME**.
Unique on (`date`, `startMinutes`). Index on (`date`, `mode`).
Generated ahead by a job and regenerated when `OperatingHours`, `PartyGameSet` or `Closure` change;
**existing bookings pin their slots and MUST survive regeneration.**
→ has many `BookingGame`.

Arena capacity (R-12) is `SUM(BookingGame.playerCount) WHERE gameSlotId = ?` ≤
`CFG.arenaCapacity`. It is **not** a stored counter; it is derived, and enforced inside the same
transaction as the insert with a row lock on `GameSlot`.

### 6.3 Bookings

**`Booking`** — base record for both flows.
`id` · `reference` (short human code) · `type` (enum: PUBLIC_GAME, PARTY) · `status` (enum: HOLD,
CONFIRMED, CANCELLED, COMPLETED, NO_SHOW) · `date` · `customerName` · `customerEmail` ·
`customerPhone` · `notes` **ME** · `createdVia` (enum: ONLINE, MANAGER) · `createdByUserId`
(nullable) · `holdExpiresAt` (nullable) · `preTaxSubtotalCents` · `taxCents` ·
`taxIncludedTotalCents` · `totalCents` · `taxRatePercentSnapshot` · `acknowledgedShoePolicy` ·
`acknowledgedFoodPolicy` · `createdAt` · `updatedAt`.
Money and `taxRatePercentSnapshot` are frozen at confirmation (R-68).

**`PublicGameBooking`** — 1:1 extension of `Booking` where `type = PUBLIC_GAME`.
`bookingId` (PK) · `playerCount` · `gameCount` (1–3) · `pricePerPersonCentsSnapshot`.

**`PartyBooking`** — 1:1 extension where `type = PARTY`.
`bookingId` (PK) · `partyWindowId` · `roomConfigurationId` · `packageId` · `guestCount` ·
`honoreeName` · `honoreeAge` (int — R-34) · `foodChoice` (enum: PIZZA, HOT_DOGS, NONE) ·
`includedPizzaCount` (snapshot of the tier lookup) · `claimedPartyGameSetIds` (via
`BookingGame.partyGameSetId`) · `packagePriceCentsSnapshot` · `extraGuestPriceCentsSnapshot`.
Index on (`date`, `partyWindowId`) — this is the query behind the age rule (R-35).

**`BookingRoomSlot`** — the physical room reservation (R-29). **This table is the room constraint.**
`id` · `bookingId` · `roomId` · `date` · `startsAtUtc` · `endsAtUtc`.
Index on (`roomId`, `date`). R-30 is enforced as an exclusion/overlap check inside the booking
transaction with a lock on the room rows; an application-level guard plus a Postgres exclusion
constraint on (`roomId`, `tstzrange(startsAtUtc, endsAtUtc)`) in production.
One row per member room of the chosen configuration — so a 3-room configuration writes 3 rows and
naturally consumes 3 room-slots.

**`BookingGame`** — the arena reservation (R-12, R-64). **This table is the arena constraint.**
`id` · `bookingId` · `gameSlotId` · `arenaGroupIndex` (0-based) · `playerCount` ·
`partyGameSetId` (nullable — which configured set this came from) · `assignmentSource` (enum:
CONFIGURED_SET, AUTO_APPENDED, MANAGER).
Unique on (`bookingId`, `gameSlotId`, `arenaGroupIndex`). Index on `gameSlotId`.
Two rows of the **same booking** MUST NOT share a `gameSlotId` across different `arenaGroupIndex`
values (R-64).

**`BookingAddOn`** — `id` · `bookingId` · `addOnId` · `quantity` · `addOnOptionId` (nullable) ·
`unitPriceCentsSnapshot` · `taxIncludedSnapshot` · `lineTotalCents`.

**`Deposit`** — `id` · `bookingId` (unique) · `amountCents` · `status` (enum: RECORDED, APPLIED,
FORFEITED, CONVERTED_TO_GIFT_CARD, CARRIED_FORWARD) · `simulatedReference` · `recordedAt` ·
`resolvedAt`. **No card data is ever stored** (R-53).

**`GiftCard`** — `id` · `code` (unique) · `amountCents` · `issuedFromBookingId` · `issuedAt` ·
`redeemedAt` (nullable) · `expiresAt` (nullable — OQ-14) · `isActive` **ME**.

**`BookingChangeLog`** — append-only (R-62).
`id` · `bookingId` · `action` (enum: CREATED, CONFIRMED, RESCHEDULED, CANCELLED, OVERRIDDEN,
ADDON_CHANGED, DEPOSIT_RESOLVED) · `actorType` (enum: CUSTOMER, MANAGER, SYSTEM) · `actorUserId`
(nullable) · `beforeJson` · `afterJson` · `reason` · `createdAt`.

**`ManagerUser`** — `id` · `email` (unique) · `passwordHash` · `name` · `role` (enum: MANAGER,
STAFF) · `isActive` · `lastLoginAt`. Auth.js credentials provider.

### 6.4 Relationship summary

```
Room ─┬─< RoomConfigurationRoom >─┬─ RoomConfiguration ─< WindowOffering >─ PartyWindow
      │                                      │                                   │
      └──────< BookingRoomSlot >─── Booking ─┘ (via PartyBooking)                │
                                        │                                   PartyGameSet
                                        │                                        │
                                        ├──< BookingGame >── GameSlot <───PartyGameSetTime
                                        ├──< BookingAddOn >── AddOn ─< AddOnPackageEligibility
                                        ├──1 Deposit ──1 GiftCard
                                        ├──< BookingChangeLog
                                        ├──1 PartyBooking ── Package ─< PizzaTier (lookup by guests)
                                        └──1 PublicGameBooking
```

**The two independent constraints (R-31) live in two different tables and must be checked in this
order inside one transaction:**
1. **Rooms** — `BookingRoomSlot` overlap on (`roomId`, time range) → `ROOM_DOUBLE_BOOKED`.
2. **Arena** — `SUM(BookingGame.playerCount)` per `GameSlot` → `ARENA_FULL`.
Neither is derivable from the other, which is why there is no single "capacity" column anywhere in
this schema.

### 6.5 Fields the manager backend must expose

Rooms and capacities · room configurations and their capacity overrides · which configurations are
offered in which window (`WindowOffering.isOffered`) · party windows and their times · party game
sets and their times · operating hours · party-only game times · closures · package prices, extra
guest prices, `includesPizza`, `roomMinutes` · pizza tiers · add-on prices, tax flags, eligibility
and option lists · laser tag per-person pricing · every key in the §2.0 Configuration Registry ·
per-date overrides: block a game slot, force-release a reserved game time, override the 90-minute
cutoff, override a booking with a logged reason.

**Nothing in that list may appear as a literal in application code.**
