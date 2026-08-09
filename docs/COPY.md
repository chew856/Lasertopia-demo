# Lasertopia Booking Platform — Copy Deck

**Author:** Copywriter
**Source of truth for facts:** `BRIEF.md`. Structure from `STRATEGY.md`. Reason codes from
`RULES.md` §2 and §5. Tone sits alongside `DESIGN.md` §1.

**This file is the only place product strings live.** The frontend imports from here. If a
sentence is needed and it is not in this file, that is a bug in this file — raise it, do not
write one.

---

## 0. How to use this deck

### 0.1 Conventions

- Keys are lowercase, dot-separated, and **stable**. Never reuse a key for a different string.
- `{placeholder}` = a value interpolated at render time. Every placeholder used anywhere is
  defined in §0.3.
- Strings are written in **Canadian English**: colour, centre, cheque, honour, organiser,
  apologise. Prices are **CAD**.
- **No emoji anywhere**, in any string, including manager surfaces and the printed sheet.
- **No exclamation marks.** There is not one in this deck and there should not be one in the
  product.
- Never blame the user. "That time has passed", not "You picked an invalid time".
- Numbers, times, prices and counts are set in Martian Mono by the design system and are visually
  separated from the words around them. Copy is written so it still reads correctly when the
  number is a different typeface — no sentence depends on the number being inline-styled.
- **Every error string does three things:** says what happened, says why in the venue's terms,
  and names the next action. Where staff are needed, the phone number appears.

### 0.2 Naming prefixes

| Prefix | Surface |
|---|---|
| `global.*` | Shared chrome, buttons, units, venue facts |
| `fmt.*` | Formatting rules (§1) |
| `home.*` | `/` router |
| `g1.*`–`g5.*` | Laser tag flow, screens G1–G5 |
| `p1.*`–`p9.*` | Party flow, screens P1–P9 |
| `lookup.*` | `/manage-booking` |
| `closed.*` | `/closed` |
| `sum.*` | Price summary lines, both flows |
| `err.*` | Errors and rejections, keyed by reason code (§8) |
| `empty.*` | Empty states (§9) |
| `policy.*` | Deposit, reschedule, cancellation, gift card (§10) |
| `pkg.*` | Package names, descriptions, inclusions (§11) |
| `addon.*` | Add-on names and descriptions |
| `email.*` | Transactional email (§12) |
| `mg.*` | Manager backend (§13) |
| `sheet.*` | Printable party sheet (§13.9) |

### 0.3 Placeholder registry

| Placeholder | Type | Example | Source |
|---|---|---|---|
| `{phone}` | string | `204-474-5900` | settings |
| `{address}` | string | `Unit #5 – 1140 Waverley Street, Winnipeg, MB` | settings |
| `{date}` | long date | `Saturday, August 22` | `fmt.date.long` |
| `{dateShort}` | short date | `Sat, Aug 22` | `fmt.date.short` |
| `{dateIso}` | ISO date | `2026-08-22` | manager surfaces only |
| `{time}` | clock time | `7:45 PM` | `fmt.time` |
| `{startTime}` / `{endTime}` | clock time | `1:00 PM` / `3:00 PM` | `fmt.time` |
| `{window}` | time range | `1:00 – 3:00 PM` | `fmt.range` |
| `{gameTimes}` | prose list of times | `1:15 PM and 1:45 PM` | `fmt.list.times` |
| `{gameBlock}` | game block | `6:00 → 6:30 PM` | `fmt.block` |
| `{players}` | integer | `6` | draft |
| `{guests}` | integer | `16` | draft |
| `{games}` | integer 1–3 | `2` | draft |
| `{seatsLeft}` | integer | `3` | engine |
| `{arenaCap}` | integer | `25` | `CFG.arenaCapacity` |
| `{maxGuests}` | integer | `28` | `CFG.maxPartyGuests` |
| `{baseGuests}` | integer | `10` | `CFG.packageBaseGuests` |
| `{roomMax}` | integer | `14` | engine (configuration capacity) |
| `{age}` | integer | `9` | draft (honoree age turning) |
| `{otherAge}` | integer | `5` | engine (existing party in the window) |
| `{ageBand}` | integer | `2` | `CFG.maxAgeDifferenceYears` |
| `{cutoffMinutes}` | integer | `90` | `CFG.onlineCutoffMinutes` |
| `{noticeDays}` | integer | `14` | `CFG.changeNoticeDays` |
| `{daysAway}` | integer | `9` | computed |
| `{leadHours}` | integer | `48` | `CFG.partyMinLeadHours` (assumption, §14) |
| `{code}` | booking code | `PT-4KJ2QW9X` | booking |
| `{honoree}` | first name | `Ada` | booking |
| `{name}` | full name | `Dana Cheway` | booking |
| `{packageName}` | string | `The Great Adventure` | settings |
| `{roomNames}` | prose list | `Party Room 1 and Party Room 2` | engine |
| `{roomTime}` | duration | `2 hours` | `fmt.duration` |
| `{perPerson}` | money | `$15.49` | settings |
| `{basePrice}` | money | `$259.50` | settings |
| `{extraRate}` | money | `$25.95` | settings |
| `{extraCount}` | integer | `6` | computed |
| `{subtotal}` / `{tax}` / `{total}` | money | `$415.20` | computed |
| `{taxRate}` | percent | `12` | `CFG.taxRatePercent` |
| `{deposit}` | money | `$50.00` | `CFG.depositAmount` |
| `{balance}` | money | `$377.02` | computed |
| `{holdRemaining}` | mm:ss | `4:12` | hold |
| `{holdMinutes}` | integer | `7` or `10` | settings |
| `{altTime1}` `{altTime2}` `{altTime3}` | clock times | `6:45 PM` | engine |
| `{altDate1}` `{altDate2}` | short dates | `Sun, Aug 23` | engine |
| `{altWindow1}` `{altWindow2}` | date + window | `Sun, Aug 23 · 1:00 – 3:00 PM` | engine |
| `{nextOpenDate}` | short date | `Mon, Aug 24` | engine |
| `{openTime}` / `{closeTime}` | clock time | `12:00 PM` / `9:00 PM` | settings |
| `{hoursLine}` | string | `12:00 PM – 9:00 PM` | settings |
| `{month}` / `{nextMonth}` | month name | `September` / `October` | calendar |
| `{monthCount}` | integer | `6` | engine |
| `{query}` | user's search text | `Nguyn` | input |
| `{staffName}` | string | `Priya` | session |
| `{minutesAgo}` / `{secondsAgo}` | integer | `8` | poll |
| `{pizzaCount}` | integer | `4` | pizza tier |
| `{addonName}` | string | `5-Up Arcade Card` | settings |
| `{bookingCount}` / `{playerCount}` | integer | `2` / `8` | engine |

**Rule for engineers:** every placeholder above is filled from server-computed data or settings.
None of them may be hardcoded in a component.

---

## 1. Microcopy: formats, units and shared vocabulary

These are formatting **rules**, not display strings. Implement once as helpers.

| Key | Rule | Example |
|---|---|---|
| `fmt.time` | 12-hour, no leading zero, uppercase meridiem, non-breaking space before it | `7:45 PM`, `12:00 PM` |
| `fmt.time.compact` | Used inside dense grids and chips; meridiem dropped when the group header carries it | `5:15` |
| `fmt.range` | En dash with a space either side. Meridiem shown once when both ends share it | `1:00 – 3:00 PM` · `10:00 AM – 12:00 PM` |
| `fmt.block` | A multi-game booking, first start → end of last game | `6:00 → 6:30 PM` |
| `fmt.block.sub` | The individual starts inside a block, middot separated | `6:00 · 6:15` |
| `fmt.date.long` | Weekday, month, day. Year appended only when it is not the current year | `Saturday, August 22` · `Saturday, August 22, 2027` |
| `fmt.date.short` | Abbreviated weekday, abbreviated month, day | `Sat, Aug 22` |
| `fmt.date.iso` | Manager surfaces, exports, URLs only. Never shown to customers | `2026-08-22` |
| `fmt.list.times` | Two items joined with "and"; three or more with commas and a final "and" | `1:15 PM and 1:45 PM` |
| `fmt.money` | Leading `$`, always two decimals, no space, no currency code in body copy | `$224.50` |
| `fmt.money.cad` | Where currency must be explicit (email footer, policy, receipts) | `$224.50 CAD` |
| `fmt.money.perPerson` | Price followed by the unit on its own | `$15.49 per person` |
| `fmt.percent` | Whole number unless the rate has decimals | `12%` |
| `fmt.duration.hours` | Whole hours | `2 hours` · `1 hour` |
| `fmt.duration.minutes` | Under 2 hours and not a whole hour, use minutes — never "1.5 hrs" | `90 minutes` |
| `fmt.countdown` | Minutes and seconds, no leading zero on minutes | `4:12` |
| `fmt.code` | Booking codes always uppercase, hyphen retained, never wrapped | `PT-4KJ2QW9X` |
| `fmt.phone` | Hyphenated, never parenthesised | `204-474-5900` |
| `fmt.capacity` | Used / cap, spaced slash | `14 / 25` |

### 1.1 Units and pluralisation

| Key | Singular | Plural | Notes |
|---|---|---|---|
| `unit.guest` | `guest` | `guests` | Party flow. Includes the birthday guest of honour. |
| `unit.player` | `player` | `players` | Laser tag flow. A person in the arena. |
| `unit.game` | `game` | `games` | |
| `unit.seat` | `spot` | `spots` | Arena seats are called **spots** to customers, **seats** never. |
| `unit.room` | `room` | `rooms` | |
| `unit.day` | `day` | `days` | |
| `unit.pizza` | `pizza` | `pizzas` | |
| `unit.card` | `card` | `cards` | |
| `unit.booking` | `booking` | `bookings` | |
| `unit.party` | `party` | `parties` | |

### 1.2 Shared vocabulary — use these words, not synonyms

| Key | Word | Never say |
|---|---|---|
| `vocab.window` | party window | slot, time slot, booking block |
| `vocab.game` | game | session, round, match |
| `vocab.arena` | the arena | the field, the course, the pitch |
| `vocab.honoree` | birthday guest of honour | birthday kid, celebrant |
| `vocab.organiser` | organiser | booker, purchaser, customer (in customer-facing copy) |
| `vocab.deposit` | deposit | down payment, retainer |
| `vocab.desk` | the front desk | reception, the till, the counter |
| `vocab.hold` | hold | reservation (a hold is not a booking) |

### 1.3 Price summary lines (both flows)

| Key | String | Notes |
|---|---|---|
| `sum.heading` | `What it costs` | |
| `sum.line.games` | `{games} × {unit.game} · {players} {unit.player}` | Laser tag line item |
| `sum.line.perPerson` | `{perPerson} per person` | |
| `sum.line.package` | `{packageName} · {baseGuests} guests included` | |
| `sum.line.extraGuests` | `{extraCount} extra guests × {extraRate}` | Shown only when `{extraCount}` > 0 |
| `sum.line.extraGuests.math` | `{basePrice} + {extraCount} × {extraRate}` | The audit line. Always shown beside the package total. |
| `sum.subtotal` | `Subtotal, before tax` | |
| `sum.tax` | `GST + PST ({taxRate}%)` | Manitoba GST 5% + PST 7%. Rate is a setting — see §14, OQ-20. |
| `sum.foodSubtotal` | `Food and drink, tax included` | Pizzas and wings are published tax-inclusive |
| `sum.foodNote` | `Pizza and wing prices already include tax.` | Sits under the food subtotal so the tax line is auditable |
| `sum.total` | `Total` | |
| `sum.plusTax` | `plus tax` | Laser tag only. Sits beside the subtotal, not as a footnote. |
| `sum.depositDue` | `Deposit due now` | |
| `sum.depositPaid` | `Deposit paid` | |
| `sum.balanceDue` | `Balance due on the day` | |
| `sum.dueAtDesk` | `Due at the front desk` | Laser tag confirmation |
| `sum.noCard` | `Pay at the front desk. No card needed now.` | Laser tag, G1/G4/G5 |
| `sum.currencyNote` | `All prices in Canadian dollars.` | Email footer and review screens |

---

## 2. Global chrome, venue facts and shared controls

### 2.1 Identity and venue facts

| Key | String | Notes |
|---|---|---|
| `global.productName` | `Lasertopia Booking` | Wordmark. Not "Lasertopia" alone — this is not the marketing site. |
| `global.venueName` | `Lasertopia` | |
| `global.address` | `Unit #5 – 1140 Waverley Street, Winnipeg, MB` | From BRIEF |
| `global.addressShort` | `1140 Waverley Street` | Sticky bars, chips |
| `global.phone` | `204-474-5900` | |
| `global.phone.label` | `Call {phone}` | Tap-to-call button label |
| `global.phone.labelWalkin` | `Call {phone} — walk-ins welcome` | Used only in cutoff states |
| `global.hours.heading` | `When we're open` | |
| `global.hours.monThu` | `Monday to Thursday · 12:00 PM – 9:00 PM` | |
| `global.hours.fri` | `Friday · 12:00 PM – 10:00 PM` | |
| `global.hours.sat` | `Saturday · 12:00 PM – 9:00 PM` | |
| `global.hours.sun` | `Sunday · 12:00 PM – 7:00 PM` | |
| `global.hours.partyNote` | `Weekend mornings from 10:00 AM are reserved for private parties.` | Explains the 10–12 window (BRIEF gap #4) |
| `global.marketingLink` | `Back to lasertopia.ca` | |
| `global.timezoneNote` | `All times are Winnipeg time.` | Footer, email |

### 2.2 The three standing rules — one canonical wording each

These appear on many screens. Do not paraphrase them per screen.

| Key | String | Notes |
|---|---|---|
| `global.rule.shoes` | `Clean closed-toed shoes are required in the arena.` | |
| `global.rule.shoes.short` | `Clean closed-toed shoes` | Chip / list form |
| `global.rule.nutFree` | `Our facility is nut-free.` | |
| `global.rule.outsideFood` | `No outside food, drinks or cake.` | |
| `global.rule.nutFreeCombined` | `Our facility is nut-free, and we can't allow outside food, drinks or cake.` | Use where one line is needed |
| `global.rule.cutoff` | `Online booking closes {cutoffMinutes} minutes before a game starts, so we can look after walk-ins.` | |
| `global.rule.cutoff.short` | `Booking closes {cutoffMinutes} minutes before a game` | Chip / list form |
| `global.rule.arrive` | `Arrive 15 minutes early so we can get you signed in.` | |
| `global.rule.payDesk` | `Pay at the front desk. No card needed now.` | Laser tag only |
| `global.rule.arenaCap` | `Our arena holds {arenaCap} players at a time.` | |
| `global.rule.ageBand` | `Two parties share each two-hour window, and we seat them within {ageBand} years of each other.` | |

### 2.3 Buttons and shared controls

| Key | String | Notes |
|---|---|---|
| `btn.continue` | `Continue` | Default forward action |
| `btn.back` | `Back` | |
| `btn.edit` | `Edit` | |
| `btn.retry` | `Try again` | Never "Retry" |
| `btn.cancel` | `Cancel` | Dismiss a dialog. Never used for cancelling a booking. |
| `btn.close` | `Close` | |
| `btn.done` | `Done` | |
| `btn.save` | `Save changes` | |
| `btn.saved` | `Saved` | Transient confirmation |
| `btn.confirmBooking` | `Confirm booking` | G4 primary |
| `btn.reserveDeposit` | `Reserve with a {deposit} deposit` | P6 primary |
| `btn.payDeposit` | `Pay {deposit} deposit` | P7 primary |
| `btn.addToCalendar` | `Add to calendar` | |
| `btn.downloadInvitations` | `Download Lasertopia invitations` | Party confirmation. Free downloadable invitations are a stated package inclusion. |
| `btn.changeOrCancel` | `Change date or cancel` | |
| `btn.cancelBooking` | `Cancel this booking` | |
| `btn.bookAgain` | `Book again` | |
| `btn.lookUpBooking` | `Find my booking` | |
| `btn.pickAnotherDate` | `Pick another date` | |
| `btn.pickAnotherTime` | `Pick another time` | |
| `btn.takeTime` | `Take {time}` | Recovery action in time-based errors |
| `btn.takeWindow` | `Take {altWindow1}` | Recovery action in window-based errors |
| `btn.goToDate` | `Go to {altDate1}` | |
| `btn.goToMonth` | `Go to {nextMonth}` | |
| `btn.reduceGroup` | `Change group size` | |
| `btn.editGuestCount` | `Edit guest count` | |
| `btn.holdAgain` | `Hold {time} again` | |
| `btn.holdWindowAgain` | `Hold {window} again` | |
| `btn.extendHold` | `Need more time? Add 5 minutes` | Offered once per draft |
| `btn.skipExtras` | `No extras — continue` | P4, above the options |
| `btn.print` | `Print` | |
| `btn.printSheet` | `Print party sheet` | |
| `btn.printAllSheets` | `Print today's party sheets` | |

### 2.4 The hold bar (sticky, both flows)

| Key | String | Notes |
|---|---|---|
| `hold.label` | `Held for you` | |
| `hold.countdown` | `{holdRemaining} left` | Monospace countdown |
| `hold.games.explain` | `We're holding {gameBlock} for {holdMinutes} minutes while you finish.` | `{holdMinutes}` = 7 for games |
| `hold.party.explain` | `We're holding {window} on {dateShort} for {holdMinutes} minutes while you finish.` | `{holdMinutes}` = 10 for parties |
| `hold.extended` | `Added 5 minutes. You have {holdRemaining} left.` | |
| `hold.extendUsed` | `We've already added time once. If it runs out we'll check whether it's still open.` | Shown when the extend control is spent |
| `hold.expiringSoon` | `Under a minute left on your hold.` | Fires at 60 seconds. `aria-live="polite"`. |

### 2.5 Status bands (booking pages)

| Key | String | Notes |
|---|---|---|
| `status.confirmed` | `CONFIRMED` | Uppercase per DESIGN §5.6 state words |
| `status.pendingDeposit` | `DEPOSIT PENDING` | |
| `status.cancelled` | `CANCELLED` | |
| `status.completed` | `COMPLETED` | |
| `status.cancelledOn` | `Cancelled on {date}.` | |
| `status.completedOn` | `This booking was on {date}.` | |
| `status.pendingDeposit.body` | `We're holding this party until the {deposit} deposit is recorded. Finish the deposit, or call {phone} and we'll take it over the phone.` | |

### 2.6 Generic loading and progress

| Key | String | Notes |
|---|---|---|
| `loading.times` | `Loading game times…` | Screen-reader text; the visual is a skeleton |
| `loading.calendar` | `Loading party windows…` | |
| `loading.saving` | `Saving…` | |
| `loading.reserving` | `Reserving your party…` | P7 button progress label |
| `loading.confirming` | `Confirming your booking…` | G4 button progress label |
| `loading.board` | `Loading the board…` | Manager |

---

## 3. `/` — Router

Not a landing page. No marketing copy.

| Key | String | Notes |
|---|---|---|
| `home.title` | `Lasertopia Booking` | Page `<title>`: `Book at Lasertopia — Winnipeg` |
| `home.intro` | `Book laser tag or a birthday party at our Waverley Street location.` | One line, no hero copy |
| `home.card.games.title` | `Book laser tag` | |
| `home.card.games.body` | `Pick your players, your games and a start time. Pay at the front desk.` | |
| `home.card.games.meta` | `From {perPerson} per person, plus tax` | `{perPerson}` = the 1-game price, $8.49 |
| `home.card.party.title` | `Book a birthday party` | |
| `home.card.party.body` | `Private room, laser tag and a VIP host. Three packages, from {basePrice} for {baseGuests} guests.` | `{basePrice}` = The Traveler, $224.50 |
| `home.card.party.meta` | `{deposit} deposit reserves your date` | |
| `home.manageLink` | `Manage an existing booking` | → `/manage-booking` |
| `home.contact.heading` | `Find us` | |
| `home.staffLink` | `Staff sign in` | → `/manage/login`. Small, in the footer. |

---

## 4. Laser tag flow (Surface 1)

### 4.1 Screen G1 — `/book/games` · Players & games

| Key | String | Notes |
|---|---|---|
| `g1.title` | `Laser tag` | Page `<title>`: `Book laser tag — Lasertopia` |
| `g1.heading` | `How many players, and how many games?` | |
| `g1.players.label` | `Players` | |
| `g1.players.help` | `Everyone going into the arena, including you.` | |
| `g1.players.decrease` | `One fewer player` | `aria-label` on the stepper's minus control |
| `g1.players.increase` | `One more player` | `aria-label` on the plus control |
| `g1.players.atCap` | `{arenaCap} is the most we can put in the arena at once.` | Shown when the stepper reaches the cap |
| `g1.games.label` | `Games` | |
| `g1.games.help` | `Each game runs 15 minutes. Two games means two back-to-back start times, and we'll show you both.` | Assumption — see §14, R2 |
| `g1.games.option1` | `1 game` | |
| `g1.games.option2` | `2 games` | |
| `g1.games.option3` | `3 games` | |
| `g1.games.price` | `{perPerson} per person` | On each card |
| `g1.games.groupTotal` | `{total} for {players} {unit.player}, plus tax` | Live total under the selected card |
| `g1.facts.heading` | `Before you pick a time` | |
| `g1.facts.cutoff` | `{global.rule.cutoff}` | |
| `g1.facts.pay` | `{global.rule.payDesk}` | |
| `g1.facts.shoes` | `{global.rule.shoes}` | |
| `g1.cta` | `Find a time` | Primary. More specific than "Continue". |

### 4.2 Screen G2 — `/book/games/[draftId]/time` · Date & time

| Key | String | Notes |
|---|---|---|
| `g2.title` | `Pick a time` | |
| `g2.heading` | `Pick a start time` | |
| `g2.context` | `{players} {unit.player} · {games} {unit.game}` | Persistent context line |
| `g2.context.edit` | `Change` | Links back to G1, keeps the draft |
| `g2.dateStrip.label` | `Choose a date` | `aria-label` on the scroller |
| `g2.dateStrip.today` | `Today` | Replaces the weekday on today's chip |
| `g2.dateStrip.tomorrow` | `Tomorrow` | |
| `g2.dateStrip.status.open` | `Open` | Status dot label, also the accessible name |
| `g2.dateStrip.status.limited` | `Limited` | |
| `g2.dateStrip.status.full` | `Full` | |
| `g2.dateStrip.status.closed` | `Closed` | |
| `g2.nextAvailable` | `Next available: {time}` | Chip, tappable, shown when today is selected |
| `g2.nextAvailable.action` | `Take {time}` | |
| `g2.grid.label` | `Game start times for {date}` | `aria-label` on the grid |
| `g2.grid.hourHeading` | `{time}` | Hour group headers, e.g. `6:00 PM` |
| `g2.cell.state.open` | `OPEN` | DESIGN §5.6 state word |
| `g2.cell.state.filling` | `FILLING` | |
| `g2.cell.state.full` | `FULL` | |
| `g2.cell.state.partyHold` | `PARTY HOLD` | |
| `g2.cell.state.partyHold.sub` | `RESERVED` | |
| `g2.cell.state.blocked` | `BLOCKED` | |
| `g2.cell.state.tooSoon` | `TOO SOON` | |
| `g2.cell.state.tooSoon.sub` | `Walk-in window` | |
| `g2.cell.state.selected` | `SELECTED` | |
| `g2.cell.spots` | `{seatsLeft} / {arenaCap} {unit.spot}` | |
| `g2.cell.spotsLeft` | `{seatsLeft} / {arenaCap} left` | Used in the FILLING state |
| `g2.cell.block.sub` | `{gameBlock.sub}` | e.g. `6:00 · 6:15` under a 2-game block |
| `g2.cell.a11y` | `{time}, {state}, {seatsLeft} of {arenaCap} spots` | Accessible name, per DESIGN §5.6 |
| `g2.warn.scarce` | `Only {seatsLeft} {unit.spot} left at this time.` | Non-blocking warning, DESIGN §5.10 |
| `g2.cta` | `Continue` | Enabled once a start is selected |
| `g2.selected.readback` | `{gameBlock} on {date}` | Under the grid once selected |
| `g2.holdPlaced` | `Held for you for {holdMinutes} minutes.` | Toast on selection |

### 4.3 Screen G3 — `/book/games/[draftId]/details` · Who's coming

| Key | String | Notes |
|---|---|---|
| `g3.title` | `Your details` | |
| `g3.heading` | `Who should we look for?` | |
| `g3.name.label` | `Name` | |
| `g3.name.placeholder` | `First and last name` | |
| `g3.phone.label` | `Mobile number` | |
| `g3.phone.help` | `In case we need to reach you about tonight.` | |
| `g3.phone.placeholder` | `204-555-0134` | |
| `g3.email.label` | `Email` | |
| `g3.email.help` | `Your booking code and confirmation go here.` | |
| `g3.note.label` | `Anything we should know? (optional)` | |
| `g3.note.help` | `Birthdays, first-timers, a group joining late — tell us and we'll be ready.` | |
| `g3.privacy` | `We use your details for this booking only. We don't sell them or add you to a mailing list.` | |
| `g3.cta` | `Review booking` | |

### 4.4 Screen G4 — `/book/games/[draftId]/review` · Confirm

| Key | String | Notes |
|---|---|---|
| `g4.title` | `Review` | |
| `g4.heading` | `Check this over` | |
| `g4.readback.date` | `{date}` | Largest thing on screen with the times |
| `g4.readback.times.one` | `{time}` | 1 game |
| `g4.readback.times.many` | `{gameTimes}` | 2–3 games, e.g. `6:00 PM and 6:15 PM` |
| `g4.readback.timesLabel` | `Your game {unit.game}` | |
| `g4.readback.players` | `{players} {unit.player}` | |
| `g4.readback.arrive` | `{global.rule.arrive}` | |
| `g4.price.perPerson` | `{perPerson} per person` | |
| `g4.price.subtotal` | `{subtotal}` | |
| `g4.price.plusTax` | `{sum.plusTax}` | |
| `g4.price.payDesk` | `{global.rule.payDesk}` | |
| `g4.ack.label` | `I've read the arena rules` | Checkbox label |
| `g4.ack.body` | `{global.rule.shoes} {global.rule.nutFreeCombined}` | Sits beside the checkbox, not in fine print |
| `g4.cta` | `{btn.confirmBooking}` | |
| `g4.editTime` | `Change time` | |
| `g4.editDetails` | `Change details` | |
| `g4.editPlayers` | `Change players or games` | |

### 4.5 Screen G5 — `/booking/[code]` · Laser tag confirmation

| Key | String | Notes |
|---|---|---|
| `g5.title` | `Booking {code}` | |
| `g5.heading.new` | `You're booked` | Only with `?new=1`. No exclamation mark. |
| `g5.heading.return` | `Your laser tag booking` | Returning visit |
| `g5.sub.new` | `We've emailed a copy to {email}.` | |
| `g5.code.label` | `Booking code` | |
| `g5.code.help` | `Give this at the front desk. Keep it handy — it's also how you look this booking up.` | |
| `g5.when.label` | `When` | |
| `g5.when.value` | `{date} · {gameTimes}` | |
| `g5.players.label` | `Players` | |
| `g5.due.label` | `{sum.dueAtDesk}` | |
| `g5.due.value` | `{total}, plus tax` | |
| `g5.due.note` | `{global.rule.payDesk}` | |
| `g5.arrive.heading` | `On the day` | |
| `g5.arrive.body` | `{global.rule.arrive}` | |
| `g5.rules.heading` | `House rules` | |
| `g5.rules.body` | `{global.rule.shoes}\n{global.rule.nutFree}\n{global.rule.outsideFood}` | Three lines |
| `g5.where.heading` | `Where` | |
| `g5.where.body` | `{address}` | |
| `g5.cancel.link` | `{btn.cancelBooking}` | Quiet, at the bottom |
| `g5.cancel.free` | `You can cancel free any time up to {cutoffMinutes} minutes before your game.` | |
| `g5.cancel.confirm.heading` | `Cancel {code}?` | |
| `g5.cancel.confirm.body` | `This frees up {players} {unit.player} at {time} on {date}. Nothing is charged either way.` | |
| `g5.cancel.confirm.yes` | `Cancel booking` | |
| `g5.cancel.confirm.no` | `Keep it` | |
| `g5.cancel.done` | `Cancelled. Those spots are back in the schedule.` | |
| `g5.cancel.tooLate` | `Your game starts in under {cutoffMinutes} minutes, so we can't cancel it online. Call {phone} and we'll take it off the list.` | |

---

## 5. Party flow (Surface 2)

### 5.1 Screen P1 — `/book/party` · Party size & age

| Key | String | Notes |
|---|---|---|
| `p1.title` | `Birthday party` | Page `<title>`: `Book a birthday party — Lasertopia` |
| `p1.heading` | `Tell us about the party` | |
| `p1.sub` | `Two questions first. They decide which windows we can offer you, so we ask before the calendar.` | |
| `p1.guests.label` | `How many guests, including the birthday guest of honour?` | |
| `p1.guests.help` | `Count everyone who'll be in the room and playing.` | |
| `p1.guests.decrease` | `One fewer guest` | `aria-label` |
| `p1.guests.increase` | `One more guest` | `aria-label` |
| `p1.guests.hint.base` | `{baseGuests} guests are included in every package.` | Shown at 10 or fewer |
| `p1.guests.hint.extra` | `{extraCount} guests over the {baseGuests} included — we'll price that on the package screen.` | 11 and up |
| `p1.guests.hint.twoRooms` | `Parties over 14 guests use two of our rooms together, so fewer windows will be open. We'll only show you windows where both rooms are free.` | Threshold comes from the rooms engine, not hardcoded |
| `p1.guests.hint.threeRooms` | `Parties over 20 guests use three rooms. These are rare and usually weekend mornings.` | |
| `p1.guests.hint.fits` | `{guests} guests fits our largest party room.` | Positive feedback where true |
| `p1.age.label` | `How old is the birthday guest of honour turning?` | |
| `p1.age.help` | `We seat two parties in the same two-hour window and match them within {ageBand} years of each other. Asking now means we only show you windows that actually work.` | |
| `p1.facts.heading` | `Good to know` | |
| `p1.facts.window` | `Parties run in two-hour windows.` | |
| `p1.facts.deposit` | `A {deposit} deposit reserves your date and comes off your balance.` | |
| `p1.facts.nutFree` | `{global.rule.nutFreeCombined}` | |
| `p1.pricePreview` | `Packages for {guests} guests start at {total}.` | `{total}` = Traveler priced for the real count |
| `p1.cta` | `See available dates` | |

### 5.2 Screen P2 — `/book/party/[draftId]/date` · Date & window

| Key | String | Notes |
|---|---|---|
| `p2.title` | `Pick a date` | |
| `p2.heading` | `Pick a date and a window` | |
| `p2.context` | `Showing windows for {guests} guests, turning {age}` | Persistent, above the calendar |
| `p2.context.edit` | `Edit` | Back to P1, draft preserved |
| `p2.calendar.label` | `{month} — party availability` | `aria-label` |
| `p2.calendar.prev` | `Previous month` | |
| `p2.calendar.next` | `Next month` | |
| `p2.date.status.open` | `Open` | |
| `p2.date.status.limited` | `One window left` | |
| `p2.date.status.full` | `No windows for this party` | Deliberate wording — the venue may not be full for a different party |
| `p2.date.status.closed` | `Closed` | |
| `p2.date.a11y` | `{date}, {status}` | |
| `p2.shortcut` | `Soonest that fits {guests} guests: {altWindow1}` | The single most useful control here |
| `p2.shortcut.action` | `Take this window` | |
| `p2.windows.heading` | `Windows on {date}` | |
| `p2.window.time` | `{window}` | Monospace |
| `p2.window.capacity` | `Fits up to {roomMax} guests` | |
| `p2.window.rooms` | `{roomNames}` | Shown once selected |
| `p2.window.select` | `Select` | |
| `p2.window.selected.games` | `Your two laser tag games: {gameTimes}` | Shown under the selected row before advancing |
| `p2.window.selected.rooms` | `We'll set you up in {roomNames}.` | |
| `p2.ageOk` | `Ages {age} and {otherAge} — within {ageBand} years. Both parties can share this window.` | Success message, DESIGN §5.10 |
| `p2.holdPlaced` | `Held for you for {holdMinutes} minutes.` | |
| `p2.cta` | `Choose a package` | |

### 5.3 Screen P3 — `/book/party/[draftId]/package` · Package

| Key | String | Notes |
|---|---|---|
| `p3.title` | `Choose a package` | |
| `p3.heading` | `Choose a package` | |
| `p3.sub` | `Priced for your {guests} guests, not the {baseGuests} on the sticker.` | |
| `p3.card.math` | `{basePrice} + {extraCount} × {extraRate}` | The audit line — always visible |
| `p3.card.total` | `{total}` | |
| `p3.card.totalNote` | `for {guests} guests, plus tax` | |
| `p3.card.baseOnly` | `{basePrice} for up to {baseGuests} guests, plus tax` | When `{extraCount}` is 0 |
| `p3.card.roomTime` | `{roomTime} in your private room` | `90 minutes` or `2 hours` |
| `p3.card.includes` | `Includes` | Heading on each card's list |
| `p3.card.mostBooked` | `Most booked` | Factual label on The Great Adventure. Manager-toggleable. Not urgency. |
| `p3.card.select` | `Choose {packageName}` | |
| `p3.shared.heading` | `Every package includes` | Stated once, below the three cards |
| `p3.shared.body` | `A VIP host · soft drinks · popcorn · party supplies · setup and cleanup · merch for the birthday guest of honour · free downloadable Lasertopia invitations` | Verbatim inclusions from BRIEF |
| `p3.roomNote` | `Your room is held for the full two-hour window either way — the room time is how long the party runs inside it.` | Explains Traveler's 90 minutes. Assumption — §14, R1. |
| `p3.cta` | `Continue` | |

### 5.4 Screen P4 — `/book/party/[draftId]/extras` · Extras

| Key | String | Notes |
|---|---|---|
| `p4.title` | `Extras` | |
| `p4.heading` | `Anything to add?` | |
| `p4.sub` | `All optional. You can add most of these on the day too.` | |
| `p4.skip` | `{btn.skipExtras}` | Full-width, above the options |
| `p4.food.heading` | `Food` | |
| `p4.food.included` | `Your package includes {pizzaCount} large 1-topping pizzas for {guests} guests.` | Great Adventure / Around The World |
| `p4.food.included.hotdogs` | `Prefer hot dogs? We'll swap the pizzas for hot dogs — one per guest.` | Quantity is an assumption — §14, OQ-19 |
| `p4.food.choice.label` | `Pizza or hot dogs?` | |
| `p4.food.choice.pizza` | `Pizza` | |
| `p4.food.choice.hotdogs` | `Hot dogs` | |
| `p4.food.notIncluded` | `The Traveler doesn't include food. For {guests} guests we'd suggest {pizzaCount} large pizzas.` | Assumption — §14, R1 |
| `p4.food.topping.label` | `Topping for pizza {n}` | |
| `p4.food.topping.options` | `Pepperoni · Bacon · Hawaiian` | |
| `p4.food.topping.cheese` | `Cheese, no topping` | |
| `p4.food.addPizza` | `Add another pizza` | |
| `p4.food.removePizza` | `Remove pizza {n}` | |
| `p4.food.line.included` | `{pizzaCount} included` | Derived caption on the quantity row |
| `p4.food.line.extra` | `{pizzaCount} included, {extraCount} extra` | |
| `p4.food.taxNote` | `Pizza and wing prices include tax.` | |
| `p4.wings.heading` | `Wings` | |
| `p4.wings.sauce.label` | `Sauce` | |
| `p4.wings.sauce.options` | `Louisiana · Dry · Sweet Chili · Honey Garlic · Salt and Pepper · Lemon Pepper · Honey Garlic BBQ` | |
| `p4.wings.sauce.help` | `One sauce per order.` | Assumption — §14, OQ-34 |
| `p4.qbix.heading` | `QBIX 5D` | |
| `p4.qbix.body` | `An immersive 5D game for up to 5 friends at a time, with wind, motion, sound and lighting that react to what's on screen.` | Verbatim substance from BRIEF |
| `p4.qbix.price` | `{perPerson} per person` | $3.95 |
| `p4.qbix.lineTotal` | `{total} for {guests} guests` | |
| `p4.arcade.heading` | `5-Up Arcade Card` | |
| `p4.arcade.question` | `Two ways to do arcade cards. Pick one.` | Presented as one question, not two products |
| `p4.arcade.match.label` | `Match card — {perPerson} per guest` | $5.00 |
| `p4.arcade.match.body` | `Each guest loads {perPerson} and Lasertopia matches it with the same in Bonus Cash. We match up to {total}.` | `{total}` = $20.00 match cap. Assumption — §14, OQ-15. |
| `p4.arcade.timeplay.label` | `45-minute Time Play card — {perPerson} per guest` | |
| `p4.arcade.timeplay.body` | `Unlimited arcade time play for 45 minutes. It earns no prize points and doesn't work on the claw machines or QBIX.` | Exclusions sit in the option, never in fine print |
| `p4.arcade.qty.label` | `How many cards?` | |
| `p4.arcade.qty.help` | `Up to one per guest.` | |
| `p4.arcade.notEligible` | `Not available with {packageName} — it already includes a $10 fun card for every guest.` | Around The World. Rendered disabled, never hidden. |
| `p4.warn.timeplayQbix` | `Heads up: the Time Play card doesn't cover QBIX, so QBIX is charged separately below.` | Warning, non-blocking (R-49) |
| `p4.runningTotal` | `Total so far: {total}` | Sticky bar |
| `p4.cta` | `Continue` | |

### 5.5 Screen P5 — `/book/party/[draftId]/details` · Your details

| Key | String | Notes |
|---|---|---|
| `p5.title` | `Your details` | |
| `p5.heading` | `Who's organising, and who's the birthday guest of honour?` | |
| `p5.organiser.name.label` | `Your name` | |
| `p5.organiser.phone.label` | `Mobile number` | |
| `p5.organiser.phone.help` | `Your host will call this number if anything changes.` | |
| `p5.organiser.email.label` | `Email` | |
| `p5.organiser.email.help` | `Your confirmation, your booking code and your invitations go here.` | |
| `p5.honoree.label` | `Birthday guest of honour's first name` | |
| `p5.honoree.help` | `It goes on the party sheet and on the room.` | |
| `p5.notes.label` | `Allergies and anything else we should know` | |
| `p5.notes.prompt` | `{global.rule.nutFreeCombined} Tell us about any other allergies and we'll brief your host.` | |
| `p5.notes.placeholder` | `Dairy allergy, a guest using a wheelchair, a surprise arrival — anything at all.` | |
| `p5.privacy` | `We use your details for this booking only. We don't sell them or add you to a mailing list.` | |
| `p5.cta` | `Review party` | |

### 5.6 Screen P6 — `/book/party/[draftId]/review` · Review

| Key | String | Notes |
|---|---|---|
| `p6.title` | `Review` | |
| `p6.heading` | `Check this over` | |
| `p6.when.heading` | `When` | |
| `p6.when.date` | `{date}` | |
| `p6.when.window` | `{window}` | |
| `p6.when.arrive` | `Arrive at {startTime}. Come 15 minutes early if you can, so we can get everyone signed in.` | Assumption — §14, R8 |
| `p6.when.games` | `Laser tag at {gameTimes}` | |
| `p6.when.roomTime` | `{roomTime} in your private room` | |
| `p6.who.heading` | `Who` | |
| `p6.who.guests` | `{guests} guests, including {honoree}` | |
| `p6.who.honoree` | `{honoree} is turning {age}` | |
| `p6.package.heading` | `Package` | |
| `p6.extras.heading` | `Extras` | |
| `p6.extras.none` | `No extras.` | |
| `p6.price.heading` | `Price` | |
| `p6.deposit.heading` | `{sum.depositDue}` | |
| `p6.deposit.value` | `{deposit}` | |
| `p6.balance.heading` | `{sum.balanceDue}` | |
| `p6.balance.value` | `{balance}` | |
| `p6.editGuests` | `{btn.editGuestCount}` | |
| `p6.editGuests.updated` | `Updated — {guests} guests, {total} total.` | Inline, no navigation |
| `p6.ack.heading` | `Three things to confirm` | |
| `p6.ack.house.label` | `I've read the house rules` | |
| `p6.ack.house.body` | `{global.rule.nutFree} {global.rule.outsideFood} {global.rule.shoes}` | |
| `p6.ack.deposit.label` | `I understand the deposit policy` | Visually the heaviest of the three |
| `p6.ack.deposit.body` | `{policy.deposit.ackBody}` | See §10 |
| `p6.ack.headcount.label` | `I'll confirm my final headcount at least 7 days before` | Assumption — §14, R5 |
| `p6.ack.headcount.body` | `We'll email you a reminder. Guests added on the day are charged the extra-guest rate if the room allows it.` | |
| `p6.cta` | `{btn.reserveDeposit}` | |
| `p6.ctaNote` | `Next screen takes the deposit. Nothing is charged until then.` | |

### 5.7 Screen P7 — `/book/party/[draftId]/deposit` · Deposit

| Key | String | Notes |
|---|---|---|
| `p7.title` | `Deposit` | |
| `p7.heading` | `Reserve the date` | |
| `p7.lineItem` | `{deposit} deposit for {honoree}'s party · {dateShort} · {window}` | |
| `p7.nameOnFile.label` | `Name for our records` | |
| `p7.nameOnFile.help` | `The name we'll have on the booking when you arrive.` | |
| `p7.notice.heading` | `How this deposit works` | |
| `p7.notice.body` | `We record this {deposit} against your booking. No card details are collected on this site — our team will confirm payment with you.` | Simulated checkout, per BRIEF's approved decisions |
| `p7.policyLine` | `{policy.deposit.oneLine}` | See §10 |
| `p7.cta` | `{btn.payDeposit}` | |
| `p7.progress` | `{loading.reserving}` | |

### 5.8 Screen P8 — `/booking/[code]` · Party confirmation

| Key | String | Notes |
|---|---|---|
| `p8.title` | `Booking {code}` | |
| `p8.heading.new` | `{honoree}'s party is booked` | |
| `p8.heading.return` | `{honoree}'s party` | |
| `p8.sub.new` | `We've emailed everything to {email}. Forward it to the other parents — it has the date, the time and what to expect.` | |
| `p8.code.label` | `Booking code` | |
| `p8.code.help` | `Quote this if you call us, and use it to look this booking up later.` | |
| `p8.when.heading` | `When` | |
| `p8.when.value` | `{date} · {window}` | |
| `p8.arrive.label` | `Arrive` | |
| `p8.arrive.value` | `{startTime}` | |
| `p8.arrive.note` | `Come 15 minutes early if you can.` | |
| `p8.games.label` | `Laser tag` | |
| `p8.games.value` | `{gameTimes}` | |
| `p8.room.label` | `Your room` | |
| `p8.room.value` | `{roomNames} · {roomTime}` | |
| `p8.guests.label` | `Guests` | |
| `p8.guests.value` | `{guests}, including {honoree}` | |
| `p8.package.label` | `Package` | |
| `p8.extras.label` | `Extras` | |
| `p8.money.heading` | `Money` | |
| `p8.money.total` | `Total {total}` | |
| `p8.money.paid` | `Deposit paid {deposit}` | |
| `p8.money.balance` | `Balance due on the day {balance}` | |
| `p8.allergies.heading` | `Allergies and notes` | |
| `p8.allergies.none` | `None recorded. If that changes, call {phone}.` | Affirmative, not blank |
| `p8.rules.heading` | `House rules` | |
| `p8.rules.body` | `{global.rule.nutFree}\n{global.rule.outsideFood}\n{global.rule.shoes}` | |
| `p8.where.heading` | `Where` | |
| `p8.forward.heading` | `Sending this to other parents?` | |
| `p8.forward.body` | `The email version has everything they need: date, arrival time, address and the house rules.` | |
| `p8.invitations` | `{btn.downloadInvitations}` | |
| `p8.change` | `{btn.changeOrCancel}` | |

### 5.9 Screen P9 — `/booking/[code]/change` · Change or cancel

The 14-day outcome is computed and stated **in dollars, before the buttons**.

| Key | String | Notes |
|---|---|---|
| `p9.title` | `Change or cancel` | |
| `p9.heading` | `Change or cancel {honoree}'s party` | |
| `p9.summary` | `{date} · {window} · {guests} guests · {packageName}` | |
| `p9.outside.heading` | `Your party is {daysAway} days away` | ≥14 days |
| `p9.outside.body` | `If you cancel now, your {deposit} deposit becomes a gift card you can use in our facility. If you'd rather move the date, we can do that instead and your {deposit} moves with you.` | |
| `p9.outside.actionPrimary` | `Request a new date` | |
| `p9.outside.actionSecondary` | `Cancel and issue a gift card` | |
| `p9.inside.heading` | `Your party is {daysAway} days away` | <14 days |
| `p9.inside.body` | `Inside {noticeDays} days the {deposit} deposit can't be refunded or turned into a gift card. You can move it to a new date and keep the {deposit} on that booking, or cancel and forfeit it.` | |
| `p9.inside.actionPrimary` | `Request a new date — keeps your {deposit}` | Visually primary |
| `p9.inside.actionSecondary` | `Cancel anyway` | |
| `p9.inside.rescheduleNote` | `Inside {noticeDays} days we move dates by hand, so this goes to our team rather than rebooking straight away. We'll call you.` | Assumption — §14, OQ-12 |
| `p9.request.heading` | `Request a new date` | |
| `p9.request.body` | `Tell us which dates could work and we'll check the rooms, the age matching and the arena, then confirm by phone or email. We usually come back the same day we're open.` | |
| `p9.request.dates.label` | `Dates that would work` | |
| `p9.request.dates.help` | `Two or three options helps us find one fast.` | |
| `p9.request.notes.label` | `Anything else we should know? (optional)` | |
| `p9.request.cta` | `Send request` | |
| `p9.request.done.heading` | `Request sent` | |
| `p9.request.done.body` | `Your original booking stays exactly as it is until we confirm a new date, so nothing is lost. We'll be in touch on {phone}.` | |
| `p9.cancel.confirm.heading` | `Cancel {honoree}'s party?` | |
| `p9.cancel.confirm.giftcard` | `Your {deposit} deposit becomes a gift card, and we'll email the code. This can't be undone — rebooking starts a new booking with a new deposit.` | ≥14 days |
| `p9.cancel.confirm.forfeit` | `Your {deposit} deposit is forfeited. This can't be undone. If you'd rather keep the {deposit}, move the date instead.` | <14 days |
| `p9.cancel.confirm.yes` | `Cancel the party` | |
| `p9.cancel.confirm.no` | `Keep my booking` | |
| `p9.cancel.done.giftcard.heading` | `Party cancelled` | |
| `p9.cancel.done.giftcard.body` | `Your {deposit} deposit is now a gift card for use in our facility. We've emailed the code to {email}.` | |
| `p9.cancel.done.forfeit.heading` | `Party cancelled` | |
| `p9.cancel.done.forfeit.body` | `Your booking is cancelled. As it was inside {noticeDays} days, the {deposit} deposit is forfeited. We've emailed a copy of this for your records.` | |
| `p9.policy.link` | `Read the full deposit and cancellation policy` | Expands §10 |

---

## 6. `/manage-booking` — Look up a booking

| Key | String | Notes |
|---|---|---|
| `lookup.title` | `Find your booking` | |
| `lookup.heading` | `Find your booking` | |
| `lookup.sub` | `Your booking code is in your confirmation email. It starts with LT- for laser tag or PT- for a party.` | |
| `lookup.code.label` | `Booking code` | |
| `lookup.code.placeholder` | `PT-4KJ2QW9X` | |
| `lookup.contact.label` | `Email or mobile number on the booking` | |
| `lookup.contact.help` | `We ask for both so nobody else can open your booking with just the code.` | |
| `lookup.cta` | `{btn.lookUpBooking}` | |
| `lookup.noCode` | `Don't have your code? Call {phone} and we'll find you.` | |

---

## 7. `/closed` — Nothing bookable

| Key | String | Notes |
|---|---|---|
| `closed.title` | `Booking is closed` | |
| `closed.heading` | `We're not taking online bookings right now` | |
| `closed.body` | `There's nothing available to book online at the moment. We're still here — call {phone} and we'll tell you what's on.` | |
| `closed.hours` | `{global.hours.monThu}\n{global.hours.fri}\n{global.hours.sat}\n{global.hours.sun}` | |
| `closed.cta` | `{global.phone.label}` | |

---

## 8. Errors and rejections — the master deck

**Every entry has `title`, `body`, and at least one action.** Body always covers: what happened ·
why · what to do. Actions are always real controls.

The `code` in each key matches the machine-readable reason code from `RULES.md` R-69 and the
state vocabulary in `STRATEGY.md` §3, so a rejection payload maps to copy with no lookup table
in the component.

### 8.1 `ONLINE_CUTOFF` / `CUTOFF` — inside the 90-minute walk-in window

| Key | String | Notes |
|---|---|---|
| `err.cutoff.title` | `That start is too soon to book online` | |
| `err.cutoff.body` | `Games start every 15 minutes, and we stop online booking {cutoffMinutes} minutes ahead so walk-ins aren't double-booked. It's {time} now, so the earliest we can book you online is {altTime1}. For anything sooner, call us at {phone} — walk-ins are welcome.` | First `{time}` is the current time. |
| `err.cutoff.action.primary` | `Take {altTime1}` | Keeps players, games and details |
| `err.cutoff.action.secondary` | `{global.phone.labelWalkin}` | |
| `err.cutoff.atSubmit.title` | `{time} has just moved inside our walk-in window` | The late failure at G4 |
| `err.cutoff.atSubmit.body` | `While you were filling this in, {time} came inside the {cutoffMinutes}-minute cutoff, so we can't book it online any more. The earliest online start is now {altTime1}. Nothing has been charged and your details are saved.` | |
| `err.cutoff.atSubmit.action.primary` | `Move my booking to {altTime1} — keeps everything else` | |
| `err.cutoff.atSubmit.action.secondary` | `{global.phone.labelWalkin}` | |
| `err.cutoff.cell.tag` | `TOO SOON` | Tile state word |
| `err.cutoff.cell.sub` | `Walk-in window` | |

### 8.2 `SLOT_HELD_FOR_PARTY` / `SLOT_RESERVED` — held for a birthday party

| Key | String | Notes |
|---|---|---|
| `err.partyHeld.title` | `{time} is held for a birthday party` | |
| `err.partyHeld.body` | `Some game times are set aside for parties. If no party books this one, it opens up to everyone — so it's worth checking back. Right now the closest games with room for {players} {unit.player} are {altTime1} and {altTime2}.` | |
| `err.partyHeld.action.primary` | `Take {altTime1}` | |
| `err.partyHeld.action.secondary` | `Take {altTime2}` | |
| `err.partyHeld.cell.tag` | `PARTY HOLD` | |
| `err.partyHeld.cell.sub` | `RESERVED` | |

### 8.3 `PARTY_ONLY_WINDOW` — weekend mornings

| Key | String | Notes |
|---|---|---|
| `err.partyOnly.title` | `We're closed to the public that morning` | |
| `err.partyOnly.body` | `Saturday and Sunday from 10:00 AM to 12:00 PM are private party time, and those games belong to the parties in the building. Doors open to everyone at {openTime}, and the first public game is at {altTime1}.` | Approved default, BRIEF gap #4 |
| `err.partyOnly.action.primary` | `Take {altTime1}` | |
| `err.partyOnly.action.secondary` | `Book a birthday party instead` | → `/book/party` |

### 8.4 `SLOT_UNAVAILABLE` / `SLOT_BLOCKED` — staff took it out of the schedule

| Key | String | Notes |
|---|---|---|
| `err.blocked.title` | `{time} isn't running today` | |
| `err.blocked.body` | `We've taken this game out of today's schedule. The nearest games with room for {players} {unit.player} are {altTime1} and {altTime2}.` | Never expose the internal block reason to customers |
| `err.blocked.action.primary` | `Take {altTime1}` | |
| `err.blocked.action.secondary` | `Take {altTime2}` | |
| `err.blocked.cell.tag` | `BLOCKED` | |

### 8.5 `ARENA_FULL` / `SOLD_OUT` — not enough spots in the arena

| Key | String | Notes |
|---|---|---|
| `err.arenaFull.title` | `{time} doesn't have room for {players}` | |
| `err.arenaFull.body` | `Our arena holds {arenaCap} players at a time, and {time} has {seatsLeft} {unit.spot} left. These have room for all {players} of you: {altTime1}, {altTime2}, {altTime3}.` | |
| `err.arenaFull.action.primary` | `Take {altTime1}` | |
| `err.arenaFull.action.secondary` | `{btn.reduceGroup}` | Returns to G1 keeping games and date |
| `err.arenaFull.cell.tag` | `FULL` | |
| `err.arenaFull.atSubmit.title` | `The last spots at {time} just went` | |
| `err.arenaFull.atSubmit.body` | `Someone booked the last {seatsLeft} {unit.spot} at {time} a moment ago. Nothing has been charged and your details are saved. These have room for {players}: {altTime1} and {altTime2}.` | |
| `err.arenaFull.atSubmit.action.primary` | `Move to {altTime1}` | |
| `err.arenaFull.atSubmit.action.secondary` | `Move to {altTime2}` | |

### 8.6 `PARTIAL_BLOCK` — the block of games doesn't fit

| Key | String | Notes |
|---|---|---|
| `err.partialBlock.title` | `{games} games won't fit starting at {time}` | |
| `err.partialBlock.body` | `Two games means two back-to-back starts. {time} works, but the {altTime1} game right after it doesn't have room for {players}. These blocks fit: {gameBlock} and {altWindow1}.` | Assumption — §14, R2 |
| `err.partialBlock.action.primary` | `Take {gameBlock}` | |
| `err.partialBlock.action.secondary` | `Book 1 game at {time} instead — {perPerson} per person` | |

### 8.7 `GROUP_TOO_LARGE` (laser tag) — over the arena cap

| Key | String | Notes |
|---|---|---|
| `err.groupTooLarge.games.title` | `Groups over {arenaCap} play in two game groups` | |
| `err.groupTooLarge.games.body` | `Our arena holds {arenaCap} players at a time, so a group bigger than that splits into two game groups back to back. We set that up with you over the phone so nobody gets separated from their friends. Call {phone}, or book {arenaCap} now and tell us about the rest.` | |
| `err.groupTooLarge.games.action.primary` | `{global.phone.label}` | |
| `err.groupTooLarge.games.action.secondary` | `Book {arenaCap} now` | |

### 8.8 `EXCEEDS_MAX_PARTY_SIZE` — over 28 guests

| Key | String | Notes |
|---|---|---|
| `err.maxPartySize.title` | `We can host up to {maxGuests} guests online` | |
| `err.maxPartySize.body` | `A party of {maxGuests} uses three of our rooms together, which is the most we can put through the online booking. For a bigger group we build something custom — call {phone} and we'll work it out with you.` | |
| `err.maxPartySize.action.primary` | `{global.phone.label}` | |
| `err.maxPartySize.action.secondary` | `Book for {maxGuests}` | |

### 8.9 `NO_ROOM_CONFIG` / `ROOM_FIT_FAIL` — no room combination fits

| Key | String | Notes |
|---|---|---|
| `err.roomFit.title` | `This window fits up to {roomMax} guests` | |
| `err.roomFit.body` | `Your party of {guests} needs two of our rooms opened up together, and one of them is already booked for {window}. Here's where {guests} does fit: {altWindow1} and {altWindow2}. If {roomMax} guests would work, this window is yours.` | `{roomMax}` = the configuration capacity actually available |
| `err.roomFit.action.primary` | `See dates that fit {guests} guests` | Jumps the calendar to the next such date |
| `err.roomFit.action.secondary` | `Book {roomMax} guests here instead` | Edits the count, re-validates, and says so |
| `err.roomFit.action.tertiary` | `{global.phone.label}` | |
| `err.roomFit.row` | `Fits up to {roomMax} — your party of {guests} needs two rooms, and one is already booked.` | The inline row reason on P2 |
| `err.roomFit.countChanged` | `Changed to {roomMax} guests. Your total is now {total}.` | Confirms the edit out loud |
| `err.roomFit.atReview.title` | `{window} on {dateShort} fits up to {roomMax} guests` | Guest count edited at P6 |
| `err.roomFit.atReview.body` | `To bring {guests}, you'd need a different window. Your hold on {window} is still live if you'd rather keep {roomMax}.` | |
| `err.roomFit.atReview.action.primary` | `Keep {roomMax} guests` | |
| `err.roomFit.atReview.action.secondary` | `Find a window for {guests}` | Returns to P2 with the new count, everything else preserved |

### 8.10 `AGE_GAP_EXCEEDED` / `AGE_CONFLICT` — the age band

**We never reveal the other family's name. Only the age.**

| Key | String | Notes |
|---|---|---|
| `err.ageConflict.title` | `This window is matched to a different age group` | |
| `err.ageConflict.body` | `Two parties share each two-hour window and play together, so we seat them within {ageBand} years of each other. This window already has a party for a {otherAge}-year-old, and your guest of honour is turning {age}. These work for a {age}-year-old: {altWindow1} and {altWindow2}.` | |
| `err.ageConflict.action.primary` | `Windows that fit a {age}-year-old on {dateShort}` | |
| `err.ageConflict.action.secondary` | `Take {altWindow1}` | |
| `err.ageConflict.row` | `Already matched to a {otherAge}-year-old's party — we seat parties within {ageBand} years of each other.` | Inline row reason on P2 |
| `err.ageConflict.dayNone` | `Every window on {dateShort} is matched to an age group that doesn't pair with {age}. The nearest that do: {altWindow1} and {altWindow2}.` | |

### 8.11 `WINDOW_FULL` — every room in the window is taken

| Key | String | Notes |
|---|---|---|
| `err.windowFull.title` | `{window} is fully booked` | |
| `err.windowFull.body` | `Both party rooms in this window already have parties in them. The nearest windows with room for {guests} guests: {altWindow1} and {altWindow2}.` | |
| `err.windowFull.action.primary` | `Take {altWindow1}` | |
| `err.windowFull.action.secondary` | `Take {altWindow2}` | |
| `err.windowFull.row` | `Both party rooms are booked for this window.` | Inline row reason |

### 8.12 `NO_GAME_CAPACITY` / `ARENA_CONFLICT` — no arena room during the window

| Key | String | Notes |
|---|---|---|
| `err.arenaConflict.title` | `The arena is full during this window's games` | |
| `err.arenaConflict.body` | `Your room would be free, but the arena only holds {arenaCap} players in one game and there isn't a run of games in {window} that can take {guests} guests. These windows have both a room and the arena time: {altWindow1} and {altWindow2}.` | Rare, but must never render as a generic "full" |
| `err.arenaConflict.action.primary` | `Take {altWindow1}` | |
| `err.arenaConflict.action.secondary` | `{global.phone.label}` | |
| `err.arenaConflict.row` | `Our arena is at capacity during this window's game times.` | Inline row reason |

### 8.13 `ADDON_NOT_ELIGIBLE` — add-on not available on this package

| Key | String | Notes |
|---|---|---|
| `err.addonNotEligible.title` | `The {addonName} doesn't come with {packageName}` | |
| `err.addonNotEligible.body` | `Around The World already includes a $10 fun card for every guest, so the arcade cards aren't sold alongside it. We've taken it off and your total is now {total}.` | Stated, never silently removed (R-46) |
| `err.addonNotEligible.action.primary` | `{btn.done}` | |
| `err.addonNotEligible.action.secondary` | `Choose a different package` | Back to P3 |
| `err.addonNotEligible.row` | `Not available with {packageName}.` | Disabled add-on row caption. Row stays visible. |
| `err.addonExclusive.title` | `Pick one arcade card, not both` | |
| `err.addonExclusive.body` | `The match card and the 45-minute Time Play card are two ways of doing the same thing, so a booking takes one or the other. Choosing one clears the other.` | R-47. Assumption — §14, OQ-16. |

### 8.14 `NOTICE_PERIOD_NOT_MET` — not enough notice

| Key | String | Notes |
|---|---|---|
| `err.noticeParty.title` | `That date is too soon for a party` | |
| `err.noticeParty.body` | `Parties need at least {leadHours} hours' notice — we order the food, set the room and book your host. The soonest we can take online is {altDate1}. For anything sooner, call {phone} and we'll see what we can do.` | Assumption — §14, R6 / OQ-30 |
| `err.noticeParty.action.primary` | `Go to {altDate1}` | |
| `err.noticeParty.action.secondary` | `{global.phone.label}` | |
| `err.noticeChange.title` | `We're too close to your party to change it online` | |
| `err.noticeChange.body` | `Your party is in under 48 hours, so changes go through our team rather than the website. Call {phone} and we'll sort it out with you.` | |
| `err.noticeChange.action.primary` | `{global.phone.label}` | |
| `err.noticeReschedule.title` | `Moving a date inside {noticeDays} days is done by hand` | |
| `err.noticeReschedule.body` | `Inside {noticeDays} days we have to re-check the rooms, the age matching and the arena, and we may need to move the other party in your window. Send us a request and we'll confirm by phone. Your {deposit} moves with you.` | Assumption — §14, OQ-12 |
| `err.noticeReschedule.action.primary` | `Request a new date` | |

### 8.15 `DAY_FULL` — the date has nothing for this booking

| Key | String | Notes |
|---|---|---|
| `err.dayFull.games.title` | `{date} is full for a group of {players}` | |
| `err.dayFull.games.body` | `Every game that day is either booked out or hasn't got room for {players} {unit.player}. The nearest days with room: {altDate1} from {altTime1}, and {altDate2} from {altTime2}.` | |
| `err.dayFull.games.action.primary` | `{btn.goToDate}` | |
| `err.dayFull.games.action.secondary` | `Go to {altDate2}` | |
| `err.dayFull.party.title` | `No windows on {date} fit {guests} guests turning {age}` | |
| `err.dayFull.party.body` | `The rooms that fit {guests} are taken, or the parties already in are outside the {ageBand}-year age match. The nearest that do work: {altWindow1} and {altWindow2}.` | |
| `err.dayFull.party.action.primary` | `Take {altWindow1}` | |
| `err.dayFull.party.action.secondary` | `Take {altWindow2}` | |
| `err.dayFull.party.action.tertiary` | `Would {roomMax} guests work? Two windows open up` | Only when reducing the count genuinely helps |

### 8.16 `DAY_CLOSED` / `VENUE_CLOSED`

| Key | String | Notes |
|---|---|---|
| `err.dayClosed.title` | `We're closed on {date}` | |
| `err.dayClosed.body` | `Nothing is running that day. We're next open {nextOpenDate}, {hoursLine}.` | |
| `err.dayClosed.action.primary` | `Go to {nextOpenDate}` | |
| `err.dayClosed.weekendMorning.title` | `Public games start at {openTime}` | |
| `err.dayClosed.weekendMorning.body` | `Saturday and Sunday mornings are private party time from 10:00 AM, and doors open to everyone at {openTime}. The first game you can book that day is {altTime1}.` | Approved default, BRIEF gap #4 |
| `err.dayClosed.weekendMorning.action.primary` | `Take {altTime1}` | |
| `err.dayClosed.weekendMorning.action.secondary` | `Book a birthday party instead` | |
| `err.dayClosed.hoursLine` | `{date}: {hoursLine}` | Repeated wherever hours are quoted |

### 8.17 `HORIZON` — outside the booking window

| Key | String | Notes |
|---|---|---|
| `err.past.title` | `That date has passed` | Never "you selected an invalid date" |
| `err.past.body` | `We've moved you to today instead.` | Auto-corrected, stated |
| `err.horizon.games.title` | `We're not taking online games that far ahead yet` | |
| `err.horizon.games.body` | `Laser tag opens for booking 60 days ahead. {date} isn't open yet — try again nearer the time, or call {phone} for a big group.` | Assumption — §14, R9 |
| `err.horizon.party.title` | `That date isn't open for parties yet` | |
| `err.horizon.party.body` | `Party bookings open 12 months ahead. For anything further out, call {phone} and we'll pencil you in.` | Assumption — §14, R9 |
| `err.horizon.action.primary` | `{global.phone.label}` | |

### 8.18 `MONTH_EMPTY` — nothing in this month

| Key | String | Notes |
|---|---|---|
| `err.monthEmpty.title` | `No windows in {month} fit {guests} guests` | |
| `err.monthEmpty.body` | `Every window that could take {guests} guests turning {age} is already booked this month. {nextMonth} has {monthCount}.` | |
| `err.monthEmpty.action.primary` | `{btn.goToMonth}` | |

### 8.19 `HOLD_EXPIRED` — the soft hold lapsed

| Key | String | Notes |
|---|---|---|
| `err.holdExpired.games.title` | `Your hold on {time} ran out` | |
| `err.holdExpired.games.body.stillOpen` | `We only hold a time for {holdMinutes} minutes so it doesn't sit locked up. Good news — {time} is still open. Everything you've filled in is saved.` | |
| `err.holdExpired.games.action.stillOpen` | `{btn.holdAgain}` | |
| `err.holdExpired.games.body.gone` | `We only hold a time for {holdMinutes} minutes, and {time} was taken while the hold was down. Everything you've filled in is saved. The closest with room for {players}: {altTime1} and {altTime2}.` | |
| `err.holdExpired.games.action.gone` | `Take {altTime1}` | |
| `err.holdExpired.party.title` | `Your hold on {window} ran out` | |
| `err.holdExpired.party.body.stillOpen` | `We only hold a window for {holdMinutes} minutes so it doesn't sit locked up. {window} on {dateShort} is still open, and everything you've filled in is saved.` | |
| `err.holdExpired.party.action.stillOpen` | `{btn.holdWindowAgain}` | |
| `err.holdExpired.party.body.gone` | `We only hold a window for {holdMinutes} minutes, and this one was booked while the hold was down. Nothing has been charged and everything you've filled in is saved. These fit {guests} guests: {altWindow1} and {altWindow2}.` | |
| `err.holdExpired.party.action.gone` | `Take {altWindow1}` | |
| `err.holdExpired.action.repick` | `Pick a different time` | Games |
| `err.holdExpired.action.repickWindow` | `Pick another window` | Party |

### 8.20 `RACE_LOST` — someone else committed first

| Key | String | Notes |
|---|---|---|
| `err.raceLost.grid.body` | `{time} filled up while you were looking. The grid is up to date now.` | Toast over the grid, selection cleared |
| `err.raceLost.calendar.body` | `That window was booked a moment ago. We've refreshed the calendar.` | |
| `err.raceLost.atSubmit.title` | `We're very sorry — {window} was just confirmed for another party` | Near-impossible with the hold; still designed |
| `err.raceLost.atSubmit.body` | `Your hold didn't take, and we know how much of your evening this took. **Nothing has been charged.** Everything you've entered is saved. These fit {guests} guests turning {age}: {altWindow1} and {altWindow2}. If neither works, call {phone} and we'll find you something.` | Bold on "Nothing has been charged" is intentional |
| `err.raceLost.atSubmit.action.primary` | `Move to {altWindow1}` | |
| `err.raceLost.atSubmit.action.secondary` | `Move to {altWindow2}` | |
| `err.raceLost.atSubmit.action.tertiary` | `{global.phone.label}` | |

### 8.21 `ROOM_DOUBLE_BOOKED` — internal conflict caught at commit

| Key | String | Notes |
|---|---|---|
| `err.roomDoubleBooked.title` | `That room was taken a moment ago` | Customer-facing wording; never expose the internal conflict |
| `err.roomDoubleBooked.body` | `The room for {window} was confirmed for another party while you were finishing up. Nothing has been charged. These fit {guests} guests: {altWindow1} and {altWindow2}.` | |
| `err.roomDoubleBooked.action.primary` | `Take {altWindow1}` | |
| `err.roomDoubleBooked.action.secondary` | `{global.phone.label}` | |
| `err.roomDoubleBooked.manager.title` | `{roomNames} is already booked for that time` | Manager-facing version, names the room |
| `err.roomDoubleBooked.manager.body` | `{roomNames} has a party in it from {startTime} to {endTime} on {dateIso}. Room double-booking can't be overridden — pick a different room, a different window, or move the other booking first.` | R-13: capacity is physical |

### 8.22 Deposit and payment failure

| Key | String | Notes |
|---|---|---|
| `err.deposit.title` | `We couldn't finish your reservation` | |
| `err.deposit.body` | `Something went wrong on our side recording the {deposit} deposit. Nothing has been charged and every detail you entered is saved. Try again — or call {phone} and we'll finish it for you in a minute.` | |
| `err.deposit.action.primary` | `{btn.retry}` | Idempotent on the draft id |
| `err.deposit.action.secondary` | `{global.phone.label}` | |
| `err.deposit.alreadyPaid.title` | `This deposit is already recorded` | Double-submit / refresh |
| `err.deposit.alreadyPaid.body` | `We've got your {deposit} against booking {code}. Nothing was taken twice.` | |
| `err.deposit.alreadyPaid.action.primary` | `See my booking` | |
| `err.deposit.expired.title` | `This booking is no longer waiting on a deposit` | |
| `err.deposit.expired.body` | `It's either already confirmed or it was cancelled. Look it up with your booking code, or call {phone}.` | |

### 8.23 `SERVER_ERROR` — unexpected failure

Never a bare "Something went wrong". Each surface names what is safe.

| Key | String | Notes |
|---|---|---|
| `err.server.generic.title` | `That didn't work, and it's on us` | |
| `err.server.generic.body` | `Something failed on our side. Nothing has been charged and nothing is lost. Try again, and if it happens twice call {phone} — we can book anything on this site by hand.` | |
| `err.server.generic.action.primary` | `{btn.retry}` | |
| `err.server.generic.action.secondary` | `{global.phone.label}` | |
| `err.server.startDraft` | `We couldn't start your booking. Nothing was saved, so try again — it usually works second time.` | G1 / P1 |
| `err.server.loadTimes` | `We couldn't load game times for {date}. Your group size and game choice are saved. Try again, or call {phone}.` | G2 |
| `err.server.loadCalendar` | `We couldn't load availability for {month}. Your party details are saved. Try again, or call {phone}.` | P2 |
| `err.server.loadPackages` | `We couldn't load the packages. Your window is still held for {holdRemaining}. Try again.` | P3 |
| `err.server.saveDetails` | `We couldn't save your details. Your time is still held for {holdRemaining}. Try again.` | G3 / P5 |
| `err.server.confirmGames` | `Your booking didn't go through, and you haven't paid anything. Try again, or call {phone} and we'll book it by hand.` | G4 |
| `err.server.confirmParty` | `Your party wasn't booked and nothing has been charged. Try again, or call {phone} and we'll book it by hand.` | P6 |
| `err.server.changeRequest` | `We couldn't send your request. Call {phone} and we'll sort it out — your booking hasn't changed.` | P9 |
| `err.server.lookup` | `We couldn't look that up just now. Try again, or call {phone} with your booking code.` | `/manage-booking` |
| `err.server.retrySafe` | `Trying again is safe — it can't create a second booking.` | Caption under any idempotent Retry |
| `err.notFound.title` | `We couldn't find that page` | 404 |
| `err.notFound.body` | `The link may be old or mistyped. Start a new booking, or look up an existing one with your booking code.` | |
| `err.notFound.action.primary` | `Start a booking` | |
| `err.notFound.action.secondary` | `{btn.lookUpBooking}` | |

### 8.24 `OFFLINE` — network failure

| Key | String | Notes |
|---|---|---|
| `err.offline.title` | `You're offline` | |
| `err.offline.body` | `Your choices are saved on this device. We'll pick up where you left off the moment you're back.` | |
| `err.offline.grid` | `Showing times from {minutesAgo} minutes ago — you're offline. We'll refresh as soon as you're back.` | Last grid stays visible, dimmed |
| `err.offline.calendar` | `You're offline, so these windows may be out of date. We'll refresh when you're back.` | |
| `err.offline.action` | `Waiting for a connection…` | Button label while disabled. No spinner text. |
| `err.offline.recovered` | `Back online. Refreshed just now.` | |
| `err.timeout.title` | `That's taking longer than it should` | |
| `err.timeout.body` | `We didn't hear back from our system. Nothing has been charged. Try again, or call {phone}.` | |

### 8.25 `FIELD_INVALID` — field-level validation

Per DESIGN §5.10: shown under the field, on blur and again on submit. Names the fix, not the fault.

| Key | String | Notes |
|---|---|---|
| `err.field.name.required` | `Enter a name so we know who to look for.` | |
| `err.field.name.tooLong` | `That's longer than we can print. Keep it under 80 characters.` | |
| `err.field.phone.required` | `Enter a phone number we can reach you at, like 204-555-0134.` | |
| `err.field.phone.invalid` | `That doesn't look like a Canadian or US number. Try it like 204-555-0134.` | |
| `err.field.email.required` | `We send your confirmation here — please add an email.` | |
| `err.field.email.invalid` | `Check that email — it's missing an @ or a domain.` | |
| `err.field.players.min` | `Enter at least 1 player.` | |
| `err.field.players.max` | `{arenaCap} players is the most that can be in the arena at once.` | |
| `err.field.games.required` | `Pick 1, 2 or 3 games.` | |
| `err.field.guests.min` | `Enter at least 1 guest.` | |
| `err.field.guests.max` | `{maxGuests} guests is the most we can host online. For more, call {phone}.` | |
| `err.field.age.required` | `We need the birthday age to match your party with a compatible one.` | |
| `err.field.age.range` | `Enter an age between 3 and 17. For older groups, call {phone} and we'll set it up.` | Assumption — §14, OQ-25 |
| `err.field.honoree.required` | `Add the birthday guest of honour's first name — it goes on the party sheet.` | |
| `err.field.topping.required` | `Pick a topping for pizza {n}, or choose cheese.` | |
| `err.field.sauce.required` | `Pick a sauce for your wings.` | |
| `err.field.notes.tooLong` | `That's more than we can store. Keep it under 500 characters, and tell your host the rest on the day.` | |
| `err.field.ack.rules` | `Please confirm you've read the arena rules.` | |
| `err.field.ack.deposit` | `Please confirm you've read the deposit policy.` | |
| `err.field.ack.headcount` | `Please confirm you'll give us a final headcount.` | |
| `err.field.nameOnFile.required` | `Add the name we should have on the booking.` | |
| `err.field.code.required` | `Enter your booking code — it's in your confirmation email.` | |
| `err.field.code.format` | `Booking codes look like LT-4KJ2QW9X or PT-4KJ2QW9X.` | |
| `err.field.contact.required` | `Enter the email or phone number on the booking.` | |
| `err.form.summary` | `{n} things need a look before we can continue.` | Form-level block above the submit button, per DESIGN §5.10 |

### 8.26 Lookup, access and rate limiting

| Key | String | Notes |
|---|---|---|
| `err.lookup.notFound.title` | `We couldn't find that booking` | |
| `err.lookup.notFound.body` | `Check the code against your confirmation email — the letters and numbers are case-insensitive, but the LT- or PT- prefix matters. If the email's gone, call {phone} with your name and date and we'll find it.` | |
| `err.lookup.notFound.action.primary` | `{btn.retry}` | |
| `err.lookup.notFound.action.secondary` | `{global.phone.label}` | |
| `err.lookup.mismatch.title` | `That code and contact don't match` | |
| `err.lookup.mismatch.body` | `The booking code exists, but the email or phone number isn't the one on it. Try the other one, or call {phone}.` | Deliberately does not confirm which half was right |
| `err.lookup.rateLimit.title` | `Too many tries` | |
| `err.lookup.rateLimit.body` | `We've paused lookups from this device for a few minutes to keep bookings private. Call {phone} and we'll pull it up for you straight away.` | |
| `err.code.notFound.title` | `We couldn't find booking {code}` | Direct `/booking/[code]` visit |
| `err.code.notFound.body` | `Check the code from your email, or look it up with your phone number.` | |
| `err.code.notFound.action.primary` | `{btn.lookUpBooking}` | |

---

## 9. Empty states

Per DESIGN §5.11: left-aligned, states **why** in the venue's real terms, offers exactly one
next action. No illustrations, no mascots.

| Key | String | Notes |
|---|---|---|
| `empty.g2.noGames.title` | `No games on this date.` | |
| `empty.g2.noGames.body` | `{date} doors open at {openTime}, and the 10:00 AM – 12:00 PM window is reserved for parties. Try another date, or call {phone}.` | The DESIGN §5.11 reference case |
| `empty.g2.noGames.action` | `{btn.pickAnotherDate}` | |
| `empty.p2.pickDate.title` | `Pick a date to see party windows.` | Before any date is tapped |
| `empty.p2.pickDate.body` | `We'll only show you windows with a room big enough for {guests} guests and a party age that matches {age}.` | |
| `empty.p2.pickDate.action` | `{p2.shortcut}` | The "soonest that fits" shortcut is the one action |
| `empty.p2.noWindows.title` | `No windows on this date.` | |
| `empty.p2.noWindows.body` | `{date} has no two-hour party windows. Parties run weekday evenings and through the day at weekends.` | |
| `empty.p2.noWindows.action` | `{btn.pickAnotherDate}` | |
| `empty.p4.noExtras.title` | `Nothing added yet.` | |
| `empty.p4.noExtras.body` | `Everything here is optional, and you can add most of it on the day.` | |
| `empty.booking.noAllergies` | `None recorded.` | Confirmation page and party sheet. An affirmative statement staff can trust. |
| `empty.mg.board.noBookings.title` | `Nothing booked today.` | |
| `empty.mg.board.noBookings.body` | `No parties and no laser tag bookings on {dateIso}. Walk-ins still work at the desk — add them with + Booking.` | |
| `empty.mg.board.noBookings.action` | `{mg.board.addBooking}` | |
| `empty.mg.board.closed.title` | `We're closed on {dateIso}.` | |
| `empty.mg.board.closed.body` | `This date has a closure on it. Open Closures to change it.` | |
| `empty.mg.board.closed.action` | `Open closures` | |
| `empty.mg.week.nothing.title` | `Nothing scheduled this week.` | |
| `empty.mg.week.nothing.body` | `No bookings between {dateIso} and {dateIso}. Use the arrows to look at another week.` | |
| `empty.mg.week.nothing.action` | `Go to this week` | |
| `empty.mg.search.title` | `No bookings match "{query}".` | Query echoed so a typo is visible |
| `empty.mg.search.body` | `Search matches booking codes, first and last names, the birthday guest of honour's name, phone numbers in any format, and email. Try a phone number or a booking code.` | |
| `empty.mg.search.action` | `Clear search` | |
| `empty.mg.filter.title` | `No bookings match these filters.` | |
| `empty.mg.filter.body` | `Nothing is {status} between {dateIso} and {dateIso}.` | |
| `empty.mg.filter.action` | `Clear filters` | |
| `empty.mg.deposits.title` | `No deposits outstanding.` | |
| `empty.mg.deposits.body` | `Every confirmed party has its {deposit} recorded.` | |
| `empty.mg.allergies.title` | `No allergies flagged today.` | |
| `empty.mg.allergies.body` | `No party today has anything in its allergies box. Our facility is nut-free regardless.` | |
| `empty.mg.activity.title` | `Nothing logged yet.` | |
| `empty.mg.activity.body` | `Overrides, cancellations, capacity edits and blocks all show up here with who did them and when.` | |
| `empty.mg.sheets.title` | `No party sheets for {dateIso}.` | |
| `empty.mg.sheets.body` | `There are no parties booked on this date, so there's nothing to print.` | |
| `empty.mg.closures.title` | `No closures set.` | |
| `empty.mg.closures.body` | `Add a closure for a holiday or a day with different hours. Bookings already on that date are listed before anything is saved.` | |
| `empty.mg.closures.action` | `Add a closure` | |

---

## 10. Policy language

**Do not edit these for tone.** They must match `BRIEF.md` in substance exactly. The verbatim
source is reproduced in `policy.full.source` and everything else is a faithful restatement, not a
softening.

### 10.1 Deposit

| Key | String | Notes |
|---|---|---|
| `policy.deposit.heading` | `Deposit` | |
| `policy.deposit.oneLine` | `A non-refundable {deposit} deposit is required for every party booking, and it comes off your balance.` | P7 above the button |
| `policy.deposit.body` | `Every party booking takes a non-refundable {deposit} deposit. The deposit reserves your room and your window, and it is applied against your total — your balance on the day is your total less the {deposit}.` | |
| `policy.deposit.ackBody` | `The {deposit} deposit is non-refundable. Cancel or change the date {noticeDays} or more days before your party and the {deposit} becomes a gift card you can use in our facility. Inside {noticeDays} days you forfeit the deposit, or you can move it to a rescheduled date.` | P6 acknowledgement 2. This is the whole policy in one paragraph. |
| `policy.deposit.perBooking` | `One {deposit} deposit per party, however many rooms it uses.` | Assumption — §14, OQ-14 |
| `policy.deposit.simulated` | `No card details are collected on this site. We record your deposit against the booking and our team confirms payment with you.` | |

### 10.2 Rescheduling

| Key | String | Notes |
|---|---|---|
| `policy.reschedule.heading` | `Changing your date` | |
| `policy.reschedule.body` | `We need at least {noticeDays} days' notice to change the date of a booking. With {noticeDays} or more days' notice you can request a new date here and your {deposit} moves to it. Inside {noticeDays} days, a date change is handled by our team rather than online — call {phone}. Your {deposit} still moves to the new date.` | Assumption on the inside-14-days path — §14, OQ-12 |
| `policy.reschedule.reValidated` | `Any new date is checked from scratch: room size, the {ageBand}-year age match with the other party in the window, and the arena. If the new date doesn't work, your original booking stays exactly as it was.` | R-60 |

### 10.3 Cancellation and gift card

| Key | String | Notes |
|---|---|---|
| `policy.cancel.heading` | `Cancelling` | |
| `policy.cancel.outside` | `Cancel {noticeDays} or more days before your party and your non-refundable {deposit} deposit is added to a gift card that can be used in our facility.` | R-57 |
| `policy.cancel.inside` | `Cancel within {noticeDays} days of your party and you forfeit the deposit, or you can choose to move it to a rescheduled date.` | R-58 / R-59 |
| `policy.cancel.noCash` | `We don't issue cash refunds on deposits.` | R-57 |
| `policy.cancel.boundary` | `Exactly {noticeDays} days counts as enough notice.` | Customer-favourable reading. Assumption — §14, OQ-13. |
| `policy.giftcard.heading` | `Gift cards` | |
| `policy.giftcard.body` | `A gift card issued from a cancelled deposit is worth {deposit} and can be used anywhere in our facility. We email the code when the cancellation goes through.` | |
| `policy.giftcard.terms` | `We'll confirm the gift card's terms when we issue it.` | The brief states no expiry or transferability rules — do not invent any. §14, OQ-14. |
| `policy.games.cancel` | `Laser tag bookings are free to cancel any time up to {cutoffMinutes} minutes before the game. Nothing is charged when you book.` | |

### 10.4 House rules

| Key | String | Notes |
|---|---|---|
| `policy.house.heading` | `House rules` | |
| `policy.house.nutFree` | `Our facility is nut-free. Please don't bring anything containing nuts.` | |
| `policy.house.outsideFood` | `No outside food, drinks or cake. This includes birthday cakes — cupcakes come with The Great Adventure and Around The World.` | |
| `policy.house.shoes` | `Clean closed-toed shoes are required in the arena. Bare feet, sandals and outdoor boots aren't allowed on the floor.` | |
| `policy.house.allergies` | `Tell us about any allergy when you book and we'll brief your host.` | |

### 10.5 Verbatim source

| Key | String | Notes |
|---|---|---|
| `policy.full.heading` | `Deposit and cancellation policy` | |
| `policy.full.source` | `For event bookings, a non refundable deposit of $50.00 is required. If you need to change the date of your booking, we require at least 2 weeks notice. Should you need to cancel your booking, please give at least 2 weeks prior to your event. Your non-refundable $50.00 deposit will be added to a GIFT CARD that can be used in our facility if cancelled before 14 days of the party date. If you cancel your booking or change the date within 14 days or less of your event, you forfeit your deposit or have the choice to move to a new rescheduled date.` | **Verbatim from BRIEF. Do not edit, reflow or correct spelling.** Rendered on the full-policy page beneath the restatement. |
| `policy.full.note` | `The wording above is our published policy. Everything on this page says the same thing in plainer terms.` | |

### 10.6 Privacy

| Key | String | Notes |
|---|---|---|
| `policy.privacy.short` | `We use your details for this booking only. We don't sell them or add you to a mailing list.` | |
| `policy.privacy.staff` | `Your name, phone number and any allergy note are visible to our staff so they can run your party.` | |

---

## 11. Packages and add-ons

### 11.1 Package names

| Key | String | Notes |
|---|---|---|
| `pkg.TRAVELER.name` | `The Traveler` | Spelling is the venue's own — one L. Do not "correct" to Traveller. |
| `pkg.GREAT_ADVENTURE.name` | `The Great Adventure` | |
| `pkg.AROUND_THE_WORLD.name` | `Around The World` | |

### 11.2 The Traveler — $224.50

| Key | String | Notes |
|---|---|---|
| `pkg.TRAVELER.tagline` | `The essentials, done properly.` | |
| `pkg.TRAVELER.price` | `$224.50 for {baseGuests} guests` | |
| `pkg.TRAVELER.extra` | `$22.45 per extra guest` | |
| `pkg.TRAVELER.roomTime` | `90 minutes in your private room` | |
| `pkg.TRAVELER.inc.room` | `Private party room` | |
| `pkg.TRAVELER.inc.games` | `2 laser tag games` | |
| `pkg.TRAVELER.inc.merch` | `Merch for the birthday guest of honour` | |
| `pkg.TRAVELER.foodNote` | `No food included — add pizza or wings on the next screen.` | Assumption — §14, R1 / OQ-02. Flips to "pizza included" if the manager says otherwise. |

### 11.3 The Great Adventure — $259.50

| Key | String | Notes |
|---|---|---|
| `pkg.GREAT_ADVENTURE.tagline` | `The one most families book.` | Factual — matches the "Most booked" label |
| `pkg.GREAT_ADVENTURE.price` | `$259.50 for {baseGuests} guests` | |
| `pkg.GREAT_ADVENTURE.extra` | `$25.95 per extra guest` | |
| `pkg.GREAT_ADVENTURE.roomTime` | `2 hours in your private room` | |
| `pkg.GREAT_ADVENTURE.inc.room` | `Private party room` | |
| `pkg.GREAT_ADVENTURE.inc.games` | `2 laser tag games` | |
| `pkg.GREAT_ADVENTURE.inc.food` | `Pizza or hot dogs` | |
| `pkg.GREAT_ADVENTURE.inc.cupcakes` | `Cupcakes` | |
| `pkg.GREAT_ADVENTURE.inc.merch` | `Merch for the birthday guest of honour` | |
| `pkg.GREAT_ADVENTURE.foodNote` | `{pizzaCount} large 1-topping pizzas for {guests} guests, or hot dogs instead.` | Pizza count from the tier table |

### 11.4 Around The World — $359.50

| Key | String | Notes |
|---|---|---|
| `pkg.AROUND_THE_WORLD.tagline` | `Everything we've got.` | |
| `pkg.AROUND_THE_WORLD.price` | `$359.50 for {baseGuests} guests` | |
| `pkg.AROUND_THE_WORLD.extra` | `$35.95 per extra guest` | |
| `pkg.AROUND_THE_WORLD.roomTime` | `2 hours in your private room` | |
| `pkg.AROUND_THE_WORLD.inc.room` | `Private party room` | |
| `pkg.AROUND_THE_WORLD.inc.games` | `2 laser tag games` | |
| `pkg.AROUND_THE_WORLD.inc.frenzy` | `Lazer Frenzy` | Winnipeg-exclusive attraction |
| `pkg.AROUND_THE_WORLD.inc.typhoon` | `The Typhoon Experience ride` | |
| `pkg.AROUND_THE_WORLD.inc.funcard` | `A $10 fun card for every guest` | |
| `pkg.AROUND_THE_WORLD.inc.food` | `Pizza or hot dogs` | |
| `pkg.AROUND_THE_WORLD.inc.cupcakes` | `Cupcakes` | |
| `pkg.AROUND_THE_WORLD.inc.merch` | `Merch for the birthday guest of honour` | |
| `pkg.AROUND_THE_WORLD.arcadeNote` | `The arcade cards aren't sold with this one — every guest already gets a $10 fun card.` | R-46 |

### 11.5 Shared inclusions — stated once

| Key | String | Notes |
|---|---|---|
| `pkg.shared.heading` | `Every package includes` | |
| `pkg.shared.host` | `A VIP host` | |
| `pkg.shared.drinks` | `Soft drinks` | |
| `pkg.shared.popcorn` | `Popcorn` | |
| `pkg.shared.supplies` | `Party supplies` | |
| `pkg.shared.setup` | `Setup and cleanup` | |
| `pkg.shared.invitations` | `Free downloadable Lasertopia invitations` | |
| `pkg.shared.guests` | `Every package is priced for {baseGuests} guests — that's 9 friends plus the birthday guest of honour.` | Verbatim substance from BRIEF |

### 11.6 Add-ons

| Key | String | Notes |
|---|---|---|
| `addon.ARCADE_5UP_MATCH.name` | `5-Up Arcade Card — match` | |
| `addon.ARCADE_5UP_MATCH.body` | `Each guest loads $5 and we match it with $5 in Bonus Cash. We match up to $20.` | Verbatim substance from BRIEF |
| `addon.ARCADE_5UP_MATCH.unit` | `per guest` | |
| `addon.ARCADE_TIMEPLAY_45.name` | `45-minute Arcade Time Play card` | |
| `addon.ARCADE_TIMEPLAY_45.body` | `Unlimited arcade time play for 45 minutes. Earns no prize points, and doesn't work on the claw machines or QBIX.` | R-49. The exclusions are part of the option, not fine print. |
| `addon.ARCADE_TIMEPLAY_45.unit` | `per guest` | |
| `addon.QBIX_5D.name` | `QBIX 5D` | |
| `addon.QBIX_5D.body` | `An immersive 5D interactive game for up to 5 friends, with several game modes and real-world effects — wind, motion, sound and lighting — reacting to what's on screen.` | Verbatim substance from BRIEF |
| `addon.QBIX_5D.unit` | `per person` | |
| `addon.PIZZA_CHEESE.name` | `Large cheese pizza` | |
| `addon.PIZZA_1TOP.name` | `Large 1-topping pizza` | |
| `addon.PIZZA_2TOP.name` | `Large 2-topping pizza` | |
| `addon.PIZZA.unit` | `each, tax included` | |
| `addon.PIZZA.toppingsLabel` | `Toppings` | |
| `addon.PIZZA.toppings` | `Pepperoni · Bacon · Hawaiian` | |
| `addon.WINGS_8.name` | `8 wings` | |
| `addon.WINGS_16.name` | `16 wings` | |
| `addon.WINGS_24.name` | `24 wings` | |
| `addon.WINGS.unit` | `each, tax included` | |
| `addon.WINGS.sauceLabel` | `Sauce` | |
| `addon.WINGS.sauces` | `Louisiana · Dry · Sweet Chili · Honey Garlic · Salt and Pepper · Lemon Pepper · Honey Garlic BBQ` | |

---

## 12. Email

Plain text and HTML share the same copy. No emoji. The party confirmation is the artifact a
parent forwards to other parents, so it reads as a standalone document.

### 12.1 Laser tag confirmation

| Key | String | Notes |
|---|---|---|
| `email.games.subject` | `Lasertopia — you're booked for {dateShort} at {time}` | |
| `email.games.preheader` | `Booking {code} · {players} {unit.player} · {gameTimes}` | |
| `email.games.heading` | `You're booked` | |
| `email.games.intro` | `Thanks {name} — here's everything for your laser tag booking at Lasertopia.` | |
| `email.games.code` | `Booking code: {code}` | Monospace in HTML |
| `email.games.when` | `When: {date}` | |
| `email.games.times` | `Games: {gameTimes}` | |
| `email.games.players` | `Players: {players}` | |
| `email.games.price` | `{total} plus tax, due at the front desk. No card needed now.` | |
| `email.games.where` | `Where: {address}` | |
| `email.games.arrive` | `Arrive 15 minutes early so we can get you signed in.` | |
| `email.games.rules.heading` | `Before you come` | |
| `email.games.rules.body` | `Clean closed-toed shoes are required in the arena.\nOur facility is nut-free.\nNo outside food, drinks or cake.` | |
| `email.games.cancel` | `Need to cancel? It's free any time up to {cutoffMinutes} minutes before your game: {link}` | |
| `email.games.help` | `Questions? Call {phone}.` | |
| `email.games.footer` | `Lasertopia · {address} · {phone}\nAll times are Winnipeg time. All prices in Canadian dollars.` | |

### 12.2 Party confirmation

| Key | String | Notes |
|---|---|---|
| `email.party.subject` | `Lasertopia — {honoree}'s party is booked for {dateShort}` | |
| `email.party.preheader` | `Booking {code} · {window} · {guests} guests · {packageName}` | |
| `email.party.heading` | `{honoree}'s party is booked` | |
| `email.party.intro` | `Thanks {name}. Everything for {honoree}'s birthday at Lasertopia is below. This email is safe to forward to the other parents — it has the date, the time, the address and what to expect.` | |
| `email.party.code` | `Booking code: {code}` | |
| `email.party.when.heading` | `When` | |
| `email.party.when` | `{date}\nParty window: {window}\nArrive: {startTime} — come 15 minutes early if you can\nLaser tag: {gameTimes}\nYour room: {roomNames}, {roomTime}` | |
| `email.party.who.heading` | `The party` | |
| `email.party.who` | `{guests} guests, including {honoree}, who is turning {age}.` | |
| `email.party.package.heading` | `Your package: {packageName}` | |
| `email.party.package.includes` | `Includes: {list}` | `{list}` built from `pkg.*.inc.*` |
| `email.party.shared` | `Every package includes a VIP host, soft drinks, popcorn, party supplies, setup and cleanup, merch for the birthday guest of honour, and free downloadable Lasertopia invitations.` | |
| `email.party.extras.heading` | `Extras` | |
| `email.party.extras.none` | `No extras added. You can add food or arcade cards any time before the day — call {phone}.` | |
| `email.party.money.heading` | `Money` | |
| `email.party.money` | `Total: {total}\nDeposit paid: {deposit}\nBalance due on the day: {balance}` | |
| `email.party.allergies.heading` | `Allergies and notes` | |
| `email.party.allergies.none` | `None recorded. If that changes, call {phone} and we'll brief your host.` | |
| `email.party.rules.heading` | `House rules — worth passing on` | |
| `email.party.rules.body` | `Our facility is nut-free.\nNo outside food, drinks or cake.\nClean closed-toed shoes are required in the arena.` | |
| `email.party.where` | `Where: {address}` | |
| `email.party.invitations` | `Download your free Lasertopia invitations: {link}` | |
| `email.party.policy.heading` | `Deposit and changes` | |
| `email.party.policy.body` | `{policy.deposit.ackBody}` | |
| `email.party.change` | `Change your date or cancel: {link}` | |
| `email.party.help` | `Questions? Call {phone}.` | |
| `email.party.footer` | `{email.games.footer}` | |

### 12.3 Headcount reminder (7 days out)

Assumption — §14, R5. Remove if the manager wants a hard lock at booking.

| Key | String | Notes |
|---|---|---|
| `email.headcount.subject` | `Lasertopia — final headcount for {honoree}'s party on {dateShort}` | |
| `email.headcount.heading` | `One week to go` | |
| `email.headcount.body` | `{honoree}'s party is on {date} at {window}. We've got you down for {guests} guests. If that's changed, call {phone} by {dateShort} so we can sort the room, the food and your host. Guests added on the day are charged the extra-guest rate if the room allows it.` | |
| `email.headcount.balance` | `Balance due on the day: {balance}` | |

### 12.4 Cancellation and gift card

| Key | String | Notes |
|---|---|---|
| `email.cancel.games.subject` | `Lasertopia — booking {code} cancelled` | |
| `email.cancel.games.body` | `Your laser tag booking for {date} at {time} is cancelled. Nothing was charged. Book again any time at {link}.` | |
| `email.cancel.party.giftcard.subject` | `Lasertopia — {honoree}'s party is cancelled, and your gift card` | |
| `email.cancel.party.giftcard.body` | `{honoree}'s party on {date} is cancelled. As you gave us {noticeDays} or more days' notice, your non-refundable {deposit} deposit has been added to a gift card you can use in our facility.\n\nGift card code: {code}\nValue: {deposit}\n\nWe'll confirm the card's terms when you use it. Questions? Call {phone}.` | Do not state expiry or transferability — the brief has no rule. §14, OQ-14. |
| `email.cancel.party.forfeit.subject` | `Lasertopia — {honoree}'s party is cancelled` | |
| `email.cancel.party.forfeit.body` | `{honoree}'s party on {date} is cancelled. As it was within {noticeDays} days of the date, the {deposit} deposit is forfeited, as set out in the policy you agreed to when booking.\n\nIf you'd still like to celebrate with us, call {phone} and we'll help you find a date.` | Clear, not apologetic. Do not soften the terms. |

### 12.5 Reschedule request

| Key | String | Notes |
|---|---|---|
| `email.reschedule.request.subject` | `Lasertopia — we've got your date change request for {honoree}'s party` | |
| `email.reschedule.request.body` | `We've received your request to move {honoree}'s party from {date}. Your current booking stays exactly as it is until we confirm a new date, so nothing is at risk. We'll call you on {phone} once we've checked the rooms, the age matching and the arena for the dates you gave us.` | |
| `email.reschedule.confirmed.subject` | `Lasertopia — {honoree}'s party has moved to {dateShort}` | |
| `email.reschedule.confirmed.body` | `{honoree}'s party is now on {date}, {window}. Your {deposit} deposit has moved with it. Laser tag: {gameTimes}. Your room: {roomNames}.\n\nEverything else is unchanged. Full details: {link}` | |

### 12.6 Manager notification

| Key | String | Notes |
|---|---|---|
| `email.mg.newParty.subject` | `New party — {dateShort} {window} · {honoree} turning {age} · {guests} guests` | |
| `email.mg.newParty.body` | `{packageName}. Organiser {name}, {phone}. Rooms {roomNames}. Games {gameTimes}. Deposit {deposit} recorded.\n\nAllergies and notes: {notes}\n\nOpen booking: {link}` | |
| `email.mg.newGames.subject` | `New laser tag — {dateShort} {time} · {players} players` | |
| `email.mg.changeRequest.subject` | `Date change request — {honoree}, {dateShort}` | |
| `email.mg.changeRequest.body` | `{name} ({phone}) wants to move {honoree}'s party from {date}, {window}.\n\nDates they suggested: {notes}\n\nNotice: {daysAway} days. Deposit: {deposit}, carries to the new date.\n\nOpen booking: {link}` | |

---

## 13. Manager backend

Priya is standing, on a tablet, with a queue in front of her. Manager copy is **shorter and more
direct** than customer copy. It uses the venue's internal vocabulary, names rooms and reasons
explicitly, and never softens a consequence.

### 13.1 `/manage/login`

| Key | String | Notes |
|---|---|---|
| `mg.login.title` | `Staff sign in` | |
| `mg.login.heading` | `Staff sign in` | |
| `mg.login.email.label` | `Email` | |
| `mg.login.password.label` | `Password` | |
| `mg.login.cta` | `Sign in` | |
| `mg.login.error` | `That email and password don't match an account. Check both and try again.` | Never says which half was wrong |
| `mg.login.locked` | `Too many attempts. Wait 5 minutes, or ask a manager to reset your password.` | |
| `mg.login.server` | `We couldn't sign you in — the system didn't respond. Try again.` | |
| `mg.login.signedOut` | `Signed out.` | |
| `mg.login.expired` | `Your session ended. Sign in again to get back to the board.` | |

### 13.2 `/manage/schedule` — the board

| Key | String | Notes |
|---|---|---|
| `mg.board.title` | `Schedule` | |
| `mg.board.today` | `TODAY` | Date control |
| `mg.board.prevDay` | `Previous day` | `aria-label` |
| `mg.board.nextDay` | `Next day` | `aria-label` |
| `mg.board.view.day` | `Day` | |
| `mg.board.view.week` | `Week` | |
| `mg.board.updated` | `updated {secondsAgo}s ago` | Lowercase, quiet, monospace number |
| `mg.board.refresh` | `Refresh now` | |
| `mg.board.new` | `NEW` | Badge on bookings that arrived this shift |
| `mg.board.lane.arena` | `ARENA` | |
| `mg.board.lane.arena.cap` | `max {arenaCap}` | |
| `mg.board.lane.room.cap` | `max {roomMax}` | |
| `mg.board.capacity` | `{playerCount} / {arenaCap}` | |
| `mg.board.now` | `NOW` | Now-line chip |
| `mg.board.marker.party` | `PARTY` | |
| `mg.board.marker.blocked` | `BLOCKED` | |
| `mg.board.marker.override` | `OVERRIDE` | |
| `mg.board.marker.past` | `PAST` | |
| `mg.board.addBooking` | `+ Booking` | |
| `mg.board.header.nextArrivals` | `Next arrivals` | |
| `mg.board.header.nextArrivals.none` | `Nothing arriving in the next hour` | |
| `mg.board.header.parties` | `Parties today` | |
| `mg.board.header.deposits` | `Deposits outstanding` | Tappable |
| `mg.board.header.allergies` | `Allergy flags today` | Tappable. Must be impossible to miss. |
| `mg.board.header.overrides` | `Overrides today` | |
| `mg.board.week.heading` | `Week of {dateIso}` | |
| `mg.board.week.readOnly` | `Week view is for planning. Open a day to make changes.` | |
| `mg.board.week.openDay` | `Open {dateIso}` | |

### 13.3 Board popovers and one-tap actions

| Key | String | Notes |
|---|---|---|
| `mg.slot.heading` | `{time} · {playerCount} / {arenaCap}` | Arena row popover |
| `mg.slot.bookings.heading` | `Booked in` | |
| `mg.slot.bookings.none` | `Nobody booked in yet.` | |
| `mg.slot.booking.row` | `{name} · {players} {unit.player} · {code}` | |
| `mg.slot.checkIn` | `Check in` | |
| `mg.slot.checkedIn` | `Checked in {time}` | |
| `mg.slot.undoCheckIn` | `Undo check-in` | |
| `mg.slot.block` | `Block this game` | |
| `mg.slot.unblock` | `Unblock` | |
| `mg.slot.blockRange` | `Block a range` | |
| `mg.slot.blocked.by` | `Blocked by {staffName} at {time}` | |
| `mg.slot.blocked.reason` | `Reason: {notes}` | |
| `mg.slot.blocked.noReason` | `No reason given. Add one` | Optional, typed after the fact |
| `mg.slot.release` | `Release to the public` | Force-release a reserved party time (R-23c) |
| `mg.slot.partyHold` | `Held for {honoree}'s party, {window}` | |
| `mg.party.heading` | `{honoree} · turning {age} · {guests} guests` | Party block popover |
| `mg.party.package` | `{packageName} · {roomNames}` | |
| `mg.party.games` | `Games {gameTimes}` | |
| `mg.party.organiser` | `{name} · {phone}` | Tap-to-call |
| `mg.party.allergyFlag` | `ALLERGIES — {notes}` | Heavy, always visible when present |
| `mg.party.depositCollected` | `Deposit collected` | One tap |
| `mg.party.depositRecorded` | `{deposit} recorded by {staffName} at {time}` | |
| `mg.party.editGuests` | `Edit guests` | |
| `mg.party.printSheet` | `{btn.printSheet}` | |
| `mg.party.openBooking` | `Open booking` | |

### 13.4 Blocking

| Key | String | Notes |
|---|---|---|
| `mg.block.range.heading` | `Block a range of games` | |
| `mg.block.range.from` | `From` | |
| `mg.block.range.to` | `To` | |
| `mg.block.range.cta` | `Block {n} games` | |
| `mg.block.reason.label` | `Reason (optional)` | |
| `mg.block.reason.placeholder` | `Party expanding, maintenance, staffing` | |
| `mg.block.done` | `Blocked {time}.` | 10-second undo toast |
| `mg.block.undo` | `Undo` | |
| `mg.block.undone` | `Unblocked {time}.` | |
| `mg.block.hasBookings.heading` | `{time} has {bookingCount} bookings ({playerCount} players)` | |
| `mg.block.hasBookings.body` | `Blocking stops new bookings on this game. It does not cancel the ones already in — those customers still expect to play.` | Never silently orphan a customer |
| `mg.block.hasBookings.primary` | `Block anyway` | |
| `mg.block.hasBookings.secondary` | `See the bookings first` | |
| `mg.block.recurring.note` | `For a block that repeats every week, use Party windows instead — the board is for today's exceptions.` | |

### 13.5 Capacity override

| Key | String | Notes |
|---|---|---|
| `mg.override.heading` | `Override a limit` | Never the word "force" |
| `mg.override.room.body` | `The {window} room set holds {roomMax}. You're booking {guests}. Overriding puts {n} guests over room capacity.` | Restates specifically what is being broken |
| `mg.override.arena.body` | `{time} has {playerCount} of {arenaCap} players. Adding {players} puts {n} over the arena cap.` | |
| `mg.override.age.body` | `This window has a party for a {otherAge}-year-old. Yours is turning {age} — {n} years apart, and we match within {ageBand}.` | |
| `mg.override.reason.label` | `Reason (required)` | |
| `mg.override.reason.help` | `This goes on the booking, on the board and in the activity log with your name.` | |
| `mg.override.reason.chip1` | `Manager approved` | |
| `mg.override.reason.chip2` | `Correcting a staff error` | |
| `mg.override.reason.chip3` | `Phone booking` | |
| `mg.override.reason.chip4` | `Regular customer` | |
| `mg.override.reason.chip5` | `Special arrangement` | |
| `mg.override.reason.other` | `Something else` | Reveals the free-text field |
| `mg.override.cta` | `Override and book` | |
| `mg.override.arena.confirm.heading` | `Confirm going over the arena cap` | Second explicit confirmation (STRATEGY §4.4) |
| `mg.override.arena.confirm.body` | `The {arenaCap}-player cap is a safety and experience limit, not a policy. {time} would have {playerCount} players. Also booked in that game: {list}.` | Shows who else is affected |
| `mg.override.age.confirm.heading` | `Confirm breaking the age match` | |
| `mg.override.age.confirm.body` | `Another family has already booked this window for a {otherAge}-year-old on the understanding that the ages would match. They are {name}, {phone}. Overriding affects their party too.` | |
| `mg.override.confirm.yes` | `I understand — override` | |
| `mg.override.confirm.no` | `{btn.cancel}` | |
| `mg.override.blocked.room` | `Room double-booking can't be overridden — two parties can't be in one room. Pick another room or move the other booking.` | R-13 |
| `mg.override.badge` | `OVERRIDE` | Badge on the board slot for the rest of the day |
| `mg.override.badge.detail` | `Overridden by {staffName} · {notes}` | |

### 13.6 Add a booking (phone / walk-in)

| Key | String | Notes |
|---|---|---|
| `mg.add.heading` | `Add a booking` | |
| `mg.add.type.games` | `Laser tag` | |
| `mg.add.type.party` | `Party` | |
| `mg.add.cutoffNote` | `The {cutoffMinutes}-minute online cutoff doesn't apply here — you can book right up to the game.` | `CFG.cutoffAppliesToManager = false` |
| `mg.add.customerName.label` | `Customer name` | |
| `mg.add.phone.label` | `Phone` | |
| `mg.add.email.label` | `Email (optional for a walk-in)` | |
| `mg.add.email.help` | `Without an email there's no confirmation to send.` | |
| `mg.add.source.label` | `Taken by` | |
| `mg.add.source.phone` | `Phone` | |
| `mg.add.source.walkin` | `Walk-in` | |
| `mg.add.source.inPerson` | `At the desk` | |
| `mg.add.depositLater` | `Take the deposit later` | Creates the party in DEPOSIT PENDING |
| `mg.add.depositNow` | `Deposit collected now` | |
| `mg.add.cta` | `Create booking` | |
| `mg.add.done` | `Booked. {code}` | |

### 13.7 `/manage/bookings` — list and search

| Key | String | Notes |
|---|---|---|
| `mg.bookings.title` | `Bookings` | |
| `mg.bookings.search.label` | `Search bookings` | |
| `mg.bookings.search.placeholder` | `Name, phone, email, booking code` | Autofocused |
| `mg.bookings.search.help` | `Also matches the birthday guest of honour's name.` | |
| `mg.bookings.filter.type` | `Type` | |
| `mg.bookings.filter.type.all` | `All` | |
| `mg.bookings.filter.type.games` | `Laser tag` | |
| `mg.bookings.filter.type.party` | `Parties` | |
| `mg.bookings.filter.status` | `Status` | |
| `mg.bookings.filter.status.confirmed` | `Confirmed` | |
| `mg.bookings.filter.status.pending` | `Deposit pending` | |
| `mg.bookings.filter.status.cancelled` | `Cancelled` | |
| `mg.bookings.filter.status.completed` | `Completed` | |
| `mg.bookings.filter.dateFrom` | `From` | |
| `mg.bookings.filter.dateTo` | `To` | |
| `mg.bookings.default` | `Showing today and forward` | |
| `mg.bookings.pinned.heading` | `Deposits outstanding` | Pinned to the top with an amber marker |
| `mg.bookings.pinned.body` | `{n} parties are confirmed in the diary with no deposit recorded.` | |
| `mg.bookings.col.date` | `Date` | |
| `mg.bookings.col.time` | `Time` | |
| `mg.bookings.col.type` | `Type` | |
| `mg.bookings.col.name` | `Name` | |
| `mg.bookings.col.size` | `Guests / players` | |
| `mg.bookings.col.status` | `Status` | |
| `mg.bookings.col.deposit` | `Deposit` | |
| `mg.bookings.call` | `Call {name}` | `aria-label` on the phone icon |
| `mg.bookings.resultCount` | `{n} bookings` | |
| `mg.bookings.loadMore` | `Show more` | |

### 13.8 `/manage/bookings/[id]` — detail

| Key | String | Notes |
|---|---|---|
| `mg.booking.title` | `{code}` | |
| `mg.booking.heading.party` | `{honoree}'s party · {dateIso} · {window}` | |
| `mg.booking.heading.games` | `{name} · {dateIso} · {gameTimes}` | |
| `mg.booking.section.when` | `When` | |
| `mg.booking.section.who` | `Who` | |
| `mg.booking.section.rooms` | `Rooms` | |
| `mg.booking.section.games` | `Games` | |
| `mg.booking.section.package` | `Package and extras` | |
| `mg.booking.section.money` | `Money` | |
| `mg.booking.section.notes` | `Allergies and notes` | |
| `mg.booking.section.log` | `Activity` | |
| `mg.booking.edit.date` | `Change date or window` | |
| `mg.booking.edit.guests` | `Change guest count` | |
| `mg.booking.edit.package` | `Change package` | |
| `mg.booking.edit.extras` | `Change extras` | |
| `mg.booking.edit.contact` | `Edit contact details` | |
| `mg.booking.edit.notes` | `Edit allergies and notes` | |
| `mg.booking.edit.recheck` | `Changing this re-runs the full fit check: rooms, the {ageBand}-year age match and the arena. We'll show you what would break before anything saves.` | |
| `mg.booking.edit.wouldBreak.heading` | `This change doesn't fit` | |
| `mg.booking.edit.wouldBreak.body` | `{reason} Fix it by picking a different window, adding a room, or overriding with a reason.` | `{reason}` is the manager-facing rejection sentence from §8 |
| `mg.booking.edit.wouldBreak.addRoom` | `Add {roomNames}` | |
| `mg.booking.edit.wouldBreak.override` | `Override with a reason` | |
| `mg.booking.deposit.status.pending` | `Not recorded` | |
| `mg.booking.deposit.status.paid` | `{deposit} recorded {dateIso} by {staffName}` | |
| `mg.booking.deposit.status.giftcard` | `Converted to gift card {code} on {dateIso}` | |
| `mg.booking.deposit.status.forfeited` | `Forfeited on {dateIso}` | |
| `mg.booking.deposit.method.label` | `How was it paid?` | |
| `mg.booking.deposit.method.cash` | `Cash` | |
| `mg.booking.deposit.method.card` | `Card at the desk` | |
| `mg.booking.deposit.method.etransfer` | `e-Transfer` | |
| `mg.booking.deposit.method.cheque` | `Cheque` | Canadian spelling |
| `mg.booking.deposit.record` | `Record deposit` | |
| `mg.booking.price.override` | `Price was overridden — {notes}` | |
| `mg.booking.price.snapshot` | `Prices locked in on {dateIso}. Later price changes don't affect this booking.` | R-68 |
| `mg.booking.log.created` | `Created via the website` | |
| `mg.booking.log.createdStaff` | `Created by {staffName} — {notes}` | |
| `mg.booking.log.deposit` | `Deposit recorded by {staffName}` | |
| `mg.booking.log.guests` | `Guest count changed from {n} to {n} by {staffName}` | |
| `mg.booking.log.override` | `Override by {staffName} — {notes}` | |
| `mg.booking.log.blocked` | `Game blocked by {staffName}` | |
| `mg.booking.log.cancelled` | `Cancelled by {staffName} — {notes}` | |
| `mg.booking.log.rescheduled` | `Moved from {dateIso} to {dateIso} by {staffName}` | |
| `mg.booking.log.checkIn` | `Checked in by {staffName}` | |
| `mg.booking.cancel` | `Cancel booking` | Bottom, visually quiet |
| `mg.booking.cancel.heading` | `Cancel {code}?` | |
| `mg.booking.cancel.party.outside` | `This party is {daysAway} days away. Under our policy the {deposit} deposit becomes a gift card. Cancelling frees {roomNames} for {window} and releases the game times {gameTimes}.` | ≥14 days |
| `mg.booking.cancel.party.inside` | `This party is {daysAway} days away — inside the {noticeDays}-day window. Under our policy the {deposit} deposit is forfeited. If the customer would rather move the date, do that instead and the {deposit} carries over.` | <14 days |
| `mg.booking.cancel.giftcardToggle` | `Issue a gift card anyway` | Manager discretion inside 14 days. Requires a reason. |
| `mg.booking.cancel.reason.label` | `Reason (required)` | |
| `mg.booking.cancel.games` | `This frees {players} players at {gameTimes} on {dateIso}. Nothing was charged.` | |
| `mg.booking.cancel.notify` | `Email the customer` | Checked by default |
| `mg.booking.cancel.confirm` | `Cancel the booking` | |
| `mg.booking.cancel.keep` | `Keep it` | |
| `mg.booking.reschedule` | `Move to a new date` | |
| `mg.booking.reschedule.inside` | `Inside {noticeDays} days this is a staff-only move. The {deposit} carries to the new date. The new date is checked from scratch — rooms, age match and arena.` | R-59 |
| `mg.booking.reschedule.failed` | `{reason} The original booking hasn't changed.` | R-60 |

### 13.9 Printable party sheet — `/manage/bookings/[id]/sheet`

Black on white, one page, readable at arm's length on a clipboard in a loud room. No emoji, no
colour dependence, no screenshot of the app.

| Key | String | Notes |
|---|---|---|
| `sheet.honoree` | `{honoree}` | Largest thing on the page |
| `sheet.honoree.age` | `turning {age}` | |
| `sheet.date` | `{dateIso}` | Second largest, monospace |
| `sheet.arrival.label` | `ARRIVAL` | |
| `sheet.arrival.value` | `{startTime}` | |
| `sheet.window.label` | `WINDOW` | |
| `sheet.window.value` | `{window}` | |
| `sheet.room.label` | `ROOM` | |
| `sheet.room.value` | `{roomNames}` | |
| `sheet.guests.label` | `GUESTS` | |
| `sheet.guests.value` | `{guests}` | |
| `sheet.package.label` | `PACKAGE` | |
| `sheet.roomTime.label` | `ROOM TIME` | |
| `sheet.games.label` | `GAME TIMES` | Boxed, monospace |
| `sheet.games.split` | `Split into {n} arena groups — see below` | Only when the party exceeds the arena cap |
| `sheet.food.label` | `FOOD` | |
| `sheet.food.pizza` | `{pizzaCount} large pizzas — {list}` | `{list}` is the toppings in order |
| `sheet.food.hotdogs` | `Hot dogs — {n}` | |
| `sheet.food.cupcakes` | `Cupcakes — {n}` | |
| `sheet.food.wings` | `Wings — {n}, {list}` | |
| `sheet.food.none` | `No food on this package` | |
| `sheet.food.cakeNote` | `NO OUTSIDE CAKE — cupcakes only` | |
| `sheet.addons.label` | `ADD-ONS` | |
| `sheet.addons.qbix` | `QBIX 5D — {n} people` | |
| `sheet.addons.arcadeMatch` | `5-Up match cards — {n}` | |
| `sheet.addons.arcadeTimeplay` | `45-min Time Play cards — {n} (no prize points, not valid on claw machines or QBIX)` | |
| `sheet.addons.funcard` | `$10 fun card per guest — {n} cards` | Around The World |
| `sheet.addons.frenzy` | `Lazer Frenzy — included` | |
| `sheet.addons.typhoon` | `Typhoon Experience — included` | |
| `sheet.addons.none` | `None` | |
| `sheet.allergies.label` | `ALLERGIES / NOTES` | Heavy-ruled box, always printed |
| `sheet.allergies.none` | `None recorded` | Prints even when empty — an affirmative statement staff can trust |
| `sheet.allergies.nutFree` | `FACILITY IS NUT-FREE` | Always printed inside the box |
| `sheet.organiser.label` | `ORGANISER` | |
| `sheet.organiser.value` | `{name} · {phone}` | |
| `sheet.checklist.label` | `HOST CHECKLIST` | Printed checkboxes and blank time fields |
| `sheet.checklist.roomSet` | `Room set` | |
| `sheet.checklist.arrived` | `Guests arrived` | |
| `sheet.checklist.game1` | `Game 1` | |
| `sheet.checklist.game2` | `Game 2` | |
| `sheet.checklist.food` | `Food served` | |
| `sheet.checklist.cake` | `Cupcakes` | |
| `sheet.checklist.merch` | `Merch to guest of honour` | |
| `sheet.checklist.prizes` | `Prizes` | |
| `sheet.checklist.cleared` | `Room cleared` | |
| `sheet.checklist.timeField` | `Time` | Blank line beside each item |
| `sheet.host.label` | `HOST` | Blank line |
| `sheet.money.deposit` | `Deposit {deposit} — {status}` | Small, at the foot |
| `sheet.money.balance` | `Balance due today {balance}` | |
| `sheet.code` | `{code}` | Foot of the page |
| `sheet.printedAt` | `Printed {dateIso} {time}` | |
| `sheet.day.heading` | `Party sheets — {dateIso}` | `/manage/day/[date]/sheets` |
| `sheet.day.count` | `{n} parties` | |
| `sheet.day.pageBreakNote` | `One party per page.` | Screen-only instruction, not printed |

### 13.10 `/manage/rooms`

| Key | String | Notes |
|---|---|---|
| `mg.rooms.title` | `Rooms` | |
| `mg.rooms.heading` | `Party rooms` | |
| `mg.rooms.intro` | `Your physical rooms and how many guests each holds. Renaming or resizing a room takes effect on new bookings straight away.` | |
| `mg.rooms.col.name` | `Name` | |
| `mg.rooms.col.capacity` | `Capacity` | |
| `mg.rooms.col.active` | `In use` | |
| `mg.rooms.add` | `Add a room` | |
| `mg.rooms.namePlaceholder` | `Room name as staff and customers see it` | Seeded names are placeholders — §14 |
| `mg.rooms.deactivate` | `Take out of use` | |
| `mg.rooms.deactivate.warning` | `{n} future bookings use {roomNames}: {list}. Taking it out of use doesn't cancel them, but no new booking can go in it.` | Names the affected bookings |
| `mg.rooms.shrink.warning` | `{n} future bookings in {roomNames} have more than {roomMax} guests: {list}. Those bookings will be over capacity.` | |
| `mg.rooms.delete.blocked` | `{roomNames} has future bookings in it and can't be deleted. Take it out of use instead, or move the bookings first.` | |
| `mg.config.heading` | `Room combinations` | |
| `mg.config.intro` | `When one party needs more than one room, these are the combinations you offer and how many guests each holds. The combined figure is set here — it isn't the two room capacities added together.` | R-27, plainly stated |
| `mg.config.col.rooms` | `Rooms` | |
| `mg.config.col.capacity` | `Holds` | |
| `mg.config.col.slots` | `Rooms used` | |
| `mg.config.col.offered` | `Offered` | |
| `mg.config.capacityHelp` | `Rooms 1 and 2 hold 26 people as two parties, but you've told us one party across both is capped at 20. Change that here if it isn't right.` | Surfaces OQ-05 / OQ-06 to the manager |

### 13.11 `/manage/slots` — party windows and reserved game times

| Key | String | Notes |
|---|---|---|
| `mg.slots.title` | `Party windows` | |
| `mg.slots.heading` | `Party windows and reserved game times` | |
| `mg.slots.intro` | `For each day of the week: the two-hour party windows, which rooms each one can use, and the game times each party in that window gets.` | |
| `mg.slots.day.label` | `Day` | |
| `mg.slots.window.add` | `Add a window` | |
| `mg.slots.window.time` | `Window` | |
| `mg.slots.window.rooms` | `Rooms available` | |
| `mg.slots.sets.heading` | `Game times per party` | |
| `mg.slots.sets.intro` | `Each party booked into this window gets one of these sets. Set 1 goes to the first party, set 2 to the second.` | |
| `mg.slots.sets.add` | `Add a set` | |
| `mg.slots.sets.empty` | `No game times set for this window. Parties booked here get times picked automatically from what's free — set them here if you'd rather choose.` | Surfaces OQ-08 / OQ-11 |
| `mg.slots.sets.time.add` | `Add a time` | |
| `mg.slots.preview.heading` | `What this would change` | |
| `mg.slots.preview.body` | `{n} future dates are affected. {n} existing bookings would no longer fit: {list}.` | Warn before save |
| `mg.slots.preview.none` | `No existing bookings are affected.` | |
| `mg.slots.save` | `{btn.save}` | |
| `mg.slots.validation.outsideHours` | `{window} falls outside your opening hours for {day}. Change the hours, or the window.` | R-07 |
| `mg.slots.validation.gameOutside` | `{time} is outside the {window} window. A party can't play a game before it arrives or after it leaves.` | |

### 13.12 `/manage/closures`

| Key | String | Notes |
|---|---|---|
| `mg.closures.title` | `Closures and hours` | |
| `mg.closures.heading` | `Closures and changed hours` | |
| `mg.closures.intro` | `Close a date entirely, or give it different hours. Anything already booked on that date is listed before you save.` | |
| `mg.closures.add` | `Add a closure` | |
| `mg.closures.date.label` | `Date` | |
| `mg.closures.type.closed` | `Closed all day` | |
| `mg.closures.type.hours` | `Different hours` | |
| `mg.closures.open.label` | `Opens` | |
| `mg.closures.close.label` | `Closes` | |
| `mg.closures.reason.label` | `Reason (shown to no one, kept for your records)` | |
| `mg.closures.stranded.heading` | `{n} bookings are on this date` | |
| `mg.closures.stranded.body` | `{list}. Closing the date does not cancel them or tell the customers. Call them, or cancel each booking, before you save this.` | |
| `mg.closures.stranded.proceed` | `Save the closure anyway` | |
| `mg.closures.stranded.review` | `See the bookings first` | |
| `mg.closures.hoursNarrow` | `The new hours cut off {n} game times that are already booked: {list}.` | |

### 13.13 `/manage/settings`

Every number the flows use lives here. Nothing is hardcoded.

| Key | String | Notes |
|---|---|---|
| `mg.settings.title` | `Settings` | |
| `mg.settings.section.booking` | `Booking rules` | |
| `mg.settings.cutoff.label` | `Online booking cutoff` | |
| `mg.settings.cutoff.help` | `How many minutes before a game we stop taking online bookings, so the desk can look after walk-ins. Staff bookings ignore this.` | |
| `mg.settings.cutoff.unit` | `minutes` | |
| `mg.settings.arenaCap.label` | `Arena capacity` | |
| `mg.settings.arenaCap.help` | `The most players in the arena in one game. Groups over this play in separate games.` | |
| `mg.settings.arenaCap.unit` | `players` | |
| `mg.settings.maxGuests.label` | `Largest party bookable online` | |
| `mg.settings.maxGuests.unit` | `guests` | |
| `mg.settings.gamesHorizon.label` | `How far ahead laser tag can be booked` | |
| `mg.settings.partyHorizon.label` | `How far ahead parties can be booked` | |
| `mg.settings.horizon.unit.days` | `days` | |
| `mg.settings.horizon.unit.months` | `months` | |
| `mg.settings.partyLead.label` | `Minimum notice for a party` | |
| `mg.settings.partyLead.help` | `Time we need to order food, set the room and book a host. Assumed {leadHours} hours — confirm this.` | Assumption — §14, R6 |
| `mg.settings.consecutive.label` | `Multi-game bookings take back-to-back start times` | |
| `mg.settings.consecutive.help` | `On: two games means two starts 15 minutes apart. Off: customers pick any two times in the day.` | Assumption — §14, R2 |
| `mg.settings.holdGames.label` | `How long a game time is held during booking` | |
| `mg.settings.holdParty.label` | `How long a party window is held during booking` | |
| `mg.settings.ageBand.label` | `Age matching` | |
| `mg.settings.ageBand.help` | `The biggest age difference allowed between two parties sharing a window.` | |
| `mg.settings.ageBand.unit` | `years` | |
| `mg.settings.reservedRelease.label` | `Release unclaimed party game times to the public` | |
| `mg.settings.reservedRelease.help` | `How close to the date we give up on selling a party and open its game times to walk-ins.` | Assumption — §14, OQ-28 |
| `mg.settings.section.money` | `Prices` | |
| `mg.settings.gamePrices.label` | `Laser tag, per person` | |
| `mg.settings.gamePrices.help` | `These prices are shown to customers as plus tax.` | |
| `mg.settings.packages.label` | `Packages` | |
| `mg.settings.package.base` | `Base price` | |
| `mg.settings.package.extra` | `Extra guest` | |
| `mg.settings.package.included` | `Guests included` | |
| `mg.settings.package.roomMinutes` | `Room time` | |
| `mg.settings.package.includesFood` | `Includes food` | |
| `mg.settings.package.games` | `Games included` | |
| `mg.settings.pizzaTiers.label` | `Pizzas by guest count` | |
| `mg.settings.pizzaTiers.help` | `Every guest count from 1 up must be covered exactly once. We'll flag any gap or overlap before you save.` | R-41 |
| `mg.settings.pizzaTiers.error` | `Guest counts {list} are covered twice, and {list} aren't covered at all. Fix the ranges before saving.` | |
| `mg.settings.addons.label` | `Add-ons` | |
| `mg.settings.addon.price` | `Price` | |
| `mg.settings.addon.taxIncluded` | `Price includes tax` | |
| `mg.settings.addon.eligible` | `Available with` | |
| `mg.settings.tax.label` | `Tax rate` | |
| `mg.settings.tax.help` | `Applied to packages, extra guests and any add-on not already marked tax-inclusive. Pizza and wing prices already include tax.` | Assumption — §14, OQ-20 |
| `mg.settings.deposit.label` | `Party deposit` | |
| `mg.settings.notice.label` | `Change and cancellation notice` | |
| `mg.settings.notice.help` | `Cancel or change with this much notice and the deposit becomes a gift card. Inside it, the deposit is forfeited or moves to a new date.` | |
| `mg.settings.notice.unit` | `days` | |
| `mg.settings.section.text` | `Policy wording` | |
| `mg.settings.policyText.label` | `Deposit and cancellation policy shown to customers` | |
| `mg.settings.policyText.warning` | `This is a legal commitment to your customers. Changing it does not change bookings already made — they keep the wording they agreed to.` | |
| `mg.settings.section.notify` | `Notifications` | |
| `mg.settings.notifyEmail.label` | `Send new booking alerts to` | |
| `mg.settings.saved` | `Saved. New bookings use these straight away; existing bookings keep the prices they were booked at.` | R-68 |
| `mg.settings.validation.generic` | `{field} needs a value between {n} and {n}.` | |

### 13.14 `/manage/activity`

| Key | String | Notes |
|---|---|---|
| `mg.activity.title` | `Activity` | |
| `mg.activity.heading` | `Activity log` | |
| `mg.activity.intro` | `Every override, cancellation, block and capacity change, with who did it and when. Read-only.` | |
| `mg.activity.filter.all` | `Everything` | |
| `mg.activity.filter.overrides` | `Overrides` | |
| `mg.activity.filter.cancellations` | `Cancellations` | |
| `mg.activity.filter.blocks` | `Blocks` | |
| `mg.activity.filter.settings` | `Settings changes` | |
| `mg.activity.row` | `{dateIso} {time} · {staffName} · {notes}` | |
| `mg.activity.openBooking` | `Open {code}` | |

### 13.15 Manager toasts and confirmations

| Key | String | Notes |
|---|---|---|
| `mg.toast.saved` | `Saved.` | |
| `mg.toast.undo` | `Undo` | 10 seconds |
| `mg.toast.undone` | `Undone.` | |
| `mg.toast.checkedIn` | `{name} checked in.` | |
| `mg.toast.depositRecorded` | `{deposit} recorded for {honoree}'s party.` | |
| `mg.toast.printQueued` | `Sent to your printer.` | |
| `mg.toast.copied` | `Copied.` | |
| `mg.toast.emailSent` | `Confirmation sent to {email}.` | |
| `mg.toast.emailFailed` | `The confirmation email didn't send. The booking is fine — resend it from the booking page, or read the code out over the phone.` | |
| `mg.confirm.discard.heading` | `Discard your changes?` | |
| `mg.confirm.discard.body` | `Nothing here has been saved yet.` | |
| `mg.confirm.discard.yes` | `Discard` | |
| `mg.confirm.discard.no` | `Keep editing` | |
| `mg.error.saveFailed` | `That didn't save. Nothing has changed. Try again — and if it fails twice, take a photo of the screen and tell whoever runs the system.` | |
| `mg.error.stale` | `Someone else changed this booking while you had it open. We've reloaded it so you're not working from an old copy.` | |
| `mg.error.permission` | `Your account can't do that. Ask a manager.` | |

---

## 14. Assumptions baked into this copy

Where `STRATEGY.md` §6 or `RULES.md` §5 flags an open question, this deck writes copy for the
**assumed** answer. If the manager answers differently, the keys listed change. All of them are
data or copy edits — none is a rebuild.

| Ref | Assumption written into the copy | Keys that change if wrong |
|---|---|---|
| **R1 / OQ-02** | The Traveler includes **no food** and **90 minutes** of room time inside a 2-hour window. Pizza is a paid add-on. | `pkg.TRAVELER.foodNote`, `pkg.TRAVELER.roomTime`, `p4.food.notIncluded`, `p3.roomNote` |
| **R2 / OQ-23** | "2 games" means **two consecutive** 15-minute starts. | `g1.games.help`, `err.partialBlock.*`, `mg.settings.consecutive.*` |
| **R3** | The ±2-year age rule applies to parties in the **same window** only. | `err.ageConflict.body`, `global.rule.ageBand` — the copy would name the shared game time instead of the window |
| **R4** | "Two time slots" means **two rooms in one window**, not two consecutive windows. | `p1.guests.hint.twoRooms`, `p1.guests.hint.threeRooms`, `err.roomFit.*` |
| **R5** | Final headcount is confirmed **7 days out**; guests added on the day pay the extra-guest rate if the room allows. | `p6.ack.headcount.*`, `email.headcount.*` |
| **R6 / OQ-30** | Parties need **48 hours'** notice; the 90-minute cutoff is games-only. | `err.noticeParty.body`, `mg.settings.partyLead.help` |
| **R7 / OQ-20** | Package and extra-guest prices are **plus tax** at **12%** (GST 5% + PST 7%); pizza and wings are tax-inclusive as published. | `sum.tax`, `sum.foodNote`, `p3.card.totalNote`, `mg.settings.tax.help` |
| **R8** | Arrival = window start; organiser asked to come **15 minutes** early. | `p6.when.arrive`, `p8.arrive.note`, `global.rule.arrive` |
| **R9** | Horizon: **60 days** laser tag, **12 months** parties. | `err.horizon.games.body`, `err.horizon.party.body` |
| **OQ-12** | Inside 14 days a date change is a **staff-handled request**, not self-serve, and the deposit carries. | `p9.inside.*`, `policy.reschedule.body`, `err.noticeReschedule.*` |
| **OQ-13** | **Exactly 14 days counts as enough notice** (customer-favourable). | `policy.cancel.boundary` |
| **OQ-14** | One `$50` deposit per party regardless of room count. Gift cards: **no expiry or transferability stated**, because the brief states none. | `policy.deposit.perBooking`, `policy.giftcard.terms` |
| **OQ-15** | Arcade match is 1:1 in $5 increments, capped at a **$20 match**. | `p4.arcade.match.body`, `addon.ARCADE_5UP_MATCH.body` |
| **OQ-16** | The arcade card choice is made **once for the whole booking**, not per guest. | `err.addonExclusive.body`, `p4.arcade.question` |
| **OQ-17** | The Typhoon Experience and QBIX 5D are treated as **different attractions**, so QBIX stays purchasable on Around The World. | `pkg.AROUND_THE_WORLD.inc.typhoon`, `p4.qbix.*` — if they are the same ride, QBIX must be hidden on that package and this copy withdrawn |
| **OQ-19** | Hot dogs and cupcakes at **1 per guest**. | `p4.food.included.hotdogs`, `sheet.food.hotdogs`, `sheet.food.cupcakes` |
| **OQ-25** | Honoree age is the age being **turned**, range 3–17. | `p1.age.label`, `err.field.age.range` |
| **OQ-34** | **One sauce per wing order.** | `p4.wings.sauce.help` |
| **OQ-36** | Room names are **placeholders** (`Party Room 1`…`Grand Party Room`). Every customer-facing string uses `{roomNames}` so a rename is a data edit. | none — but the seeded names appear to customers until they are changed |

---

## 15. Facts this deck needed and the specs do not contain

Flagged for the manager. Nothing below has been invented — where a string needed one of these,
it was written to work without it.

1. **The tax rate is provisional.** `RULES.md` seeds 12% and marks it unconfirmed. `sum.tax` says
   `GST + PST ({taxRate}%)`, which is correct for Manitoba if the rate is 5% + 7%. If the venue
   charges something else, or if package prices are already tax-inclusive, this label and every
   total change.
2. **Room names are placeholders.** `sheet.room.value`, `p2.window.rooms` and `p8.room.value` print
   whatever is in the rooms table. Until a manager renames them, customers see "Party Room 1".
3. **Gift card terms.** The brief states no expiry, no transferability and no redemption rules.
   `policy.giftcard.terms` deliberately says only that terms are confirmed at issue. **Do not add
   terms to this string without a manager decision** — it is a consumer commitment.
4. **There is no stated refund position for laser tag.** `policy.games.cancel` says cancellation is
   free because nothing is charged at booking (`OQ-32`). If the venue starts taking payment online,
   that string needs a real refund policy behind it.
5. **No stated policy for no-shows**, for either surface. No copy exists for it and none was
   invented.
6. **Manitoba tax naming.** `sum.tax` renders `GST + PST`. If the venue's receipts say `GST + RST`
   (Manitoba's retail sales tax is sometimes written RST), change this one label to match the
   till — a customer comparing the screen to their receipt must see the same words.
