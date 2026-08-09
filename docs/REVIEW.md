# Code review — Lasertopia booking platform

**Reviewer:** adversarial QA pass over the whole repo.
**Baseline before review:** `tsc --noEmit` clean · `npm test` 384 passed / 16 files · `npm run build`
clean, 32 routes · design audit clean · no hardcoded credentials.

Those checks all pass and none of them can see anything in this document. Everything below was
found by reading code against `docs/RULES.md`, `docs/STRATEGY.md`, `docs/DESIGN.md` and
`docs/COPY.md`, and the two Critical/High inventory defects were **reproduced against a real
SQLite database** before being fixed.

Counts: **2 Critical · 9 High · 21 Medium · 12 Low.**
Fixed in this pass: **2 Critical, 8 High.** Left with a stated reason: **1 High** (F-11) and all
Medium/Low.

---

## 1. Findings

### Critical

| # | Where | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| **F-01** | `src/app/parties/_lib/draft.ts` `recordDeposit` (was ~line 615) | A party hold could be promoted to `CONFIRMED` **without holding any room or any game**. `payDeposit` (`src/app/parties/actions.ts:484`) calls `sweepExpiredHolds(now)`, which deletes the `BookingRoomSlot` and `BookingGame` rows of any lapsed hold — *including the draft it is about to confirm*. `recordDeposit` then re-planned (a pure computation) and flipped `status` to `CONFIRMED`, but never re-claimed inventory. Nothing in `payDeposit` or `recordDeposit` checked `holdExpired`. | **Reproduced.** A customer who leaves the deposit screen open past the 15-minute hold and then pays gets a CONFIRMED party owning zero rooms and zero games. The physical room stays sellable, so a second family books it: two parties, one room, both confirmed, and R-29/R-30 are silently violated. The manager's board shows a party with no room and no game times. | **FIXED.** `recordDeposit` now re-claims the planned room-slots and games through `commitBookingInventory({ replaceExisting: true })` *before* the confirm transaction. If the rooms went in the meantime it now loses the race honestly with `ROOM_DOUBLE_BOOKED` and its alternatives panel. `PartyBooking.roomConfigurationId` is updated to whatever the re-plan chose, so the stored configuration matches the rooms actually held. |
| **F-02** | `src/app/manage-booking/actions.ts:88` | On a **successful** lookup the action did `redirect(\`/booking/${reference}\`)`. There is no `/booking/[code]` route — the build's own route list has only `/laser-tag/booking/[code]` and `/parties/booking/[code]`. | Every customer who correctly enters their booking code *and* their phone or email lands on a bare 404. The entire public "find my booking" feature — the only self-serve route to cancel or request a date change — is dead on its happy path. Both surfaces link into it (`src/app/page.tsx`, `parties/not-found.tsx`, `laser-tag/booking/[code]/page.tsx`). The cause is visible in a comment at `laser-tag/booking/[code]/page.tsx:45`: each surface assumed the other would build the shared route. | **FIXED.** The action now selects `type` and redirects to `/parties/booking/…` or `/laser-tag/booking/…`. Same change also replaced a `findMany({ take: 500 })` + in-memory scan with an indexed `findFirst` on the reconstructed reference — see F-03. |

### High

| # | Where | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| **F-03** | `src/app/manage-booking/actions.ts` (old lines 78-85) | The lookup pulled the **first 500 bookings** with no `orderBy` and scanned them in memory for a matching reference. | Silently starts returning "not found" for perfectly valid codes once the venue has taken its 501st booking — a bug that appears months after launch and looks like a data-loss incident. It also loaded every customer's email and phone into process memory on every unauthenticated lookup attempt. | **FIXED.** Indexed `findFirst` on the canonical reference (`normaliseCode` strips the hyphen, so the hyphenated form is reconstructed). Rate limiting and the deliberately-ambiguous `notFound`/`mismatch` split are unchanged. |
| **F-04** | `src/lib/db/booking-repository.ts` `assertArenaHeadroom` | The arena sum counted **expired holds** as occupancy: it filtered on `status IN (HOLD, CONFIRMED)` with no `holdExpiresAt` check. Both availability readers (`laser-tag/_lib/venue.ts:228`, `parties/_lib/day-state.ts:44`) *do* exclude them, so the read path and the write path disagreed. `sweepExpiredHolds` is never called by the laser tag flow at all, so lapsed party holds linger indefinitely. | A customer is shown a slot with seats free, taps Confirm, and is refused with `ARENA_FULL` because of a hold that died twenty minutes ago. R-12 is a physical constraint; enforcing it against inventory nobody holds turns away real money. | **FIXED.** The aggregate now excludes lapsed holds, matching both readers. `CommitBookingInput` gained an optional `now` so the write evaluates against the same instant as the read that preceded it; all three call sites pass it. |
| **F-05** | `src/app/parties/_lib/draft.ts` `rehold` (was lines 438-450) | `releaseBookingInventory` then `commitBookingInventory` as **two separate transactions**. The docstring and `err.roomFit.atReview.body` both promise *"Your hold on {window} is still live"*. That held for a *planning* rejection but not for a *race*: the release had already committed, so a failed re-claim left the draft owning zero room-slots — and `holdExpired()` returns true when `roomIds.length === 0`, so the draft immediately read as expired. | **Reproduced.** Reached from the guest-count editor on the review screen (`editGuestCount`). The customer is told their hold survived, and it did not. There is also a real window between the two transactions in which the room is unheld and another customer can take it. | **FIXED.** `commitBookingInventory` gained `replaceExisting`, which does the delete **inside the claim's own transaction**. A failed re-claim now rolls back to the inventory the booking already had. Verified: `rooms=1, holdExpired=false` after a forced commit failure. |
| **F-06** | `src/lib/domain/addons.ts` `validateAddOnSelection` | `PER_UNIT` add-ons (all six pizzas and wings) had **no quantity ceiling server-side**. The parser (`parties/_lib/extras.ts:83`) accepts any positive integer, and the engine only checked `>= 1` and the per-guest cap. The UI's cap lives in a hardcoded `20` at `parties/[draftId]/extras/page.tsx:77`, which the server never enforced. | This is the one hole in an otherwise airtight server-side trust boundary. A hand-rolled POST could put 999,999 pizzas on a booking and write a $24M total to the database. A quantity past the safe-integer range made `multiplyMoney` throw `MoneyError`, which is uncaught in `saveExtras` — a 500 from user input. | **FIXED.** Per-unit quantity is now bounded by `config.maxPartyGuests` (28) — a safety rail derived from existing configuration, comfortably above the UI's own 20, so no legitimate flow changes. **The real per-line limit is a question for the manager**; see §4. |
| **F-07** | `src/lib/db/booking-repository.ts` (old lines 261-269) | The `P2002` handler's `if` and its fallthrough were **byte-identical** — every unique-constraint violation anywhere in the transaction was reported as `ROOM_DOUBLE_BOOKED`. | The other unique index in that transaction is `BookingGame(bookingId, gameSlotId)` — R-64's "two arena groups must not share a slot". A **laser tag** booking, which passes `roomSlots: []` and has no room at all, would tell the customer a party room was taken. The duplicated branch also proves the case was never finished. | **FIXED.** A `BookingGame` collision now maps to `PARTIAL_BLOCK` with the sentence `planPublicBooking` already uses for that case; anything else maps to `CONFIG_INVALID` rather than a lie about rooms. |
| **F-08** | `src/app/parties/_lib/draft.ts` `cancelParty` (was line 729) | Gift card codes were built inline as `` `GC-${reference.replace("PT-", "")}` ``, while the manager's cancel path (`manage/_lib/actions.ts:521`) uses the engine's `giftCardCodeFor()` → `GC-PT-XXXXXXXX-20260822`. `giftCardCodeFor` is exported, documented as the R-61 format, and was dead. | The same booking cancelled online and at the desk mints **two different codes**. A customer reads out the code from their online cancellation and the front desk cannot find it. The local format also drops the date component the engine added specifically to keep the `GiftCard.code` unique index safe on retry. | **FIXED.** `cancelParty` calls `giftCardCodeFor(draft.reference, input.now)`. One format, one source. |
| **F-09** | `src/app/parties/_components/window-list.tsx` `TakeWindowButton` | `await selectWindow(...)` with the return value **discarded**. `selectWindow` navigates on success but *returns* a `FormState` carrying a rejection on failure. The sibling `WindowList.pick` in the same file handles it correctly; this one did not. | Used by the P2 shortcut, the day-full alternatives, and — worst — **both recovery buttons on the hold-expired panel** (`hold-notice.tsx:59,68`). When the window goes while the panel is on screen, the button spins and does nothing, with no explanation. That is precisely the failure STRATEGY §0's "never reject without offering the alternative" exists to prevent, failing inside the recovery affordance itself. | **FIXED.** The rejection is captured and rendered beneath the button as a `ValidationMessage`. |
| **F-10** | `src/app/manage/(staff)/bookings/[id]/page.tsx` `LOG_LABEL` | Four of the mapped strings carry `{staffName}` / `{notes}` and were rendered **raw**, with the actor name and the reason appended as separate spans beside them. | The booking Activity log printed `Cancelled by {staffName} — {notes}   Priya   Customer called` — literal braces sitting next to the values that should have filled them, on the screen staff use to audit a cancellation. | **FIXED.** A `logLine()` helper interpolates per row. A row with no reason drops the `— {notes}` clause rather than interpolating an empty one, because `interpolate` counts `""` as missing. |
| **F-11** | `src/app/manage/_lib/actions.ts:219` `releaseSlotAction` | **R-23(c) — "force-release a specific reserved time on a specific date" — is not implemented.** The action writes `GameSlot.mode = 'PUBLIC'` and `releasedToPublicAt`, but **nothing reads them.** `generateGameSlots` (`src/lib/domain/slots.ts:126-137`) re-derives every slot's mode from the catalog templates (`PartyOnlyGameTime`, `PartyGameSet`) and consults the database only for `mode: 'BLOCKED'` — verified across all three loaders (`laser-tag/_lib/venue.ts:238`, `parties/_lib/day-state.ts:54`, `manage/_lib/catalog.ts:215,223`). The manager board reads the same generated modes, so it does not reflect the change either. | Staff press "Release to public" on a party-held game, the action reports success, and **nothing anywhere changes**. The public still gets `SLOT_HELD_FOR_PARTY`; the board still shows the slot reserved. A manager trying to sell dead party inventory to walk-ins has a button that lies. | **NOT FIXED — deliberately.** See §3 for the reasoning and the exact fix. |

### Medium

| # | Where | What is wrong | Fix |
|---|---|---|---|
| M-01 | `src/lib/domain/deposit.ts:76,84` | `evaluateCancellation` hardcodes **"$50"** in both messages although `depositAmountCents` is a parameter of the same function. Rendered to staff at `manage/(staff)/bookings/[id]/page.tsx:444` and written to `BookingChangeLog.reason`. Change `CFG.depositAmount` and the sentence lies. Violates the CLAUDE.md invariant and the R-69/WE-11 rule that the number must come from config. | Interpolate `formatMoney(args.depositAmountCents)`. |
| M-02 | `src/lib/domain/errors.ts:136-182` | `DEFAULT_MESSAGES` hardcodes `90 minutes`, `$50`, `two years`, `two weeks`, `12:00 PM`. Same invariant. Mitigated: both flows map codes to §8 copy before render, so these fallbacks do not currently reach a customer. | Take the numbers from `EngineConfig`, or make the fallbacks number-free. |
| M-03 | `src/app/parties/[draftId]/extras/page.tsx:77` | `maxQuantity: … : 20` — a business number as a literal in a `.ts` file, and it disagreed with the server (F-06). | Move to a `Setting` row. |
| M-04 | `src/app/manage/(staff)/settings/page.tsx:254,261,268` | Pizza-tier **min guests / max guests / pizza count** inputs are labelled `mg.bookings.filter.dateFrom` / `dateTo` / `mg.settings.pizzaTiers.label`. A screen reader announces "Date from, edit, 10" for a headcount. WCAG 3.3.2 + 4.1.2. | Needs three new copy keys (`pizzaTiers.minGuests` / `.maxGuests` / `.pizzas`) — a copywriter change, so not made here. |
| M-05 | `src/app/parties/actions.ts:262` → `[draftId]/extras/page.tsx` | `choosePackage` redirects with `?removed=CODE` and the extras page **never reads it**. R-46's promise — *"We've taken it off and your total is now…"* — is unreachable, so switching to Around The World silently drops the arcade card. | Read `searchParams.removed` and render `err.addonNotEligible.body`. |
| M-06 | `src/app/parties/_lib/rejection.ts:182-187` + `date/page.tsx:295-303` | On the party side a **closure** renders `empty.p2.noWindows` ("No windows on this date… parties run weekday evenings and weekends") instead of `VENUE_CLOSED`. `party.err.dayClosed.body` is dead code. A customer is told a closure is a scheduling quirk and never learns the venue is shut or when it reopens. The laser tag flow gets this right. | Branch on `availability.closed` and render the closure panel. |
| M-07 | `src/app/parties/**` (11 files) | The party surface reads the venue phone from the copy constant `global.phone` while the laser tag surface reads `CFG.venuePhone` from settings. Six of those files already load `config` in the same function. Change the number in the backend and the whole party flow keeps printing the old one. | Use `config.venuePhone` throughout. |
| M-08 | `src/app/page.tsx`, `src/app/layout.tsx` | The router page is 100% hardcoded strings — including the **phone number, the address, `$8.49` and `$224.50`**. COPY.md §3's `home.*` namespace does not exist in `src/lib/copy` at all. Prices must come from `GameSlotPricing` / `Package`. | Implement §3; read prices from the catalog. |
| M-09 | `src/app/parties/_lib/draft.ts:236` | `loadPartyByReference` accepts `/^PT-[A-Z0-9]{4,16}$/` — permits `O/0/I/1`, which the generator's alphabet deliberately excludes, and 4–16 characters for an 8-character code. Laser tag's `CODE_PATTERN` is exact. | Tighten to the generator's alphabet and length. |
| M-10 | `src/app/parties/_lib/draft.ts:347` | Party booking references are generated **once** with no collision retry, and `conflictToResult` rethrows anything that is not a `BookingConflictError`, so a `P2002` on `Booking.reference` becomes an unhandled 500 on P2. Laser tag retries five times. | Mirror the laser tag retry loop. |
| M-11 | `src/app/parties/**` (8 call sites) | `formatDateLong(date)` is called without `{ currentYear }`, which is what makes it append the year for a date outside the current one. Laser tag passes it at all 8 sites; the manager at all 3; parties at **zero**. With `bookingHorizonDays` reaching into next year, a confirmation for 3 Jan 2027 reads "Sunday, January 3" — on the page a parent screenshots. | Pass `currentYear`. |
| M-12 | `src/app/manage/_lib/actions.ts:779` `parseTimeField` | Reimplements `parseClock24` (`domain/time.ts:209`) and **diverges**: the engine accepts hours up to 47 (a window running past midnight); this caps at 23. A manager cannot enter a past-midnight game time the engine supports. | Call `parseClock24`. |
| M-13 | `src/app/manage/_lib/actions.ts:898` `parseMoneyField` | Reimplements `parseMoney` (`domain/money.ts:43`) and **diverges**: the engine accepts `$259.50` and `1,259.50`; this rejects both. `settings-form.ts:62` on the *same screen* uses `parseMoney`, so two forms on one page accept different input. | Call `parseMoney`. |
| M-14 | `src/app/manage/_lib/board.ts:141-155` vs `laser-tag/_lib/grid.ts:27` | "Filling" means `playersUsed > 0` to the manager and `floor(capacity × 0.25)` to the customer. The same word, two meanings, on two screens describing the same slot. | One threshold in the engine. |
| M-15 | `src/components/ui/date-picker.tsx:38-43` | Date availability is carried by **bar colour alone**: `open` (green) vs `limited` (amber) are the same 4px solid bar, same shape, no word — `statusLabel` is used only for the accessible name and never rendered. `none` and `closed` are both `bg-rule` at 1.43:1. Violates the CLAUDE.md invariant "a word and a shape, not just a colour" on the first screen a parent scans. | Give `limited` the dashed bar and `none` the hatch already written in `slot-tile.tsx`; render `statusLabel`. |
| M-16 | `src/components/ui/schedule-board.tsx:31-45,247` | Manager board chip states differ by **border and bar colour only** — `confirmed` / `filling` / `full` / `party` are indistinguishable in greyscale. The `md:hidden` phone agenda drops even the hatch that `blocked` gets on desktop. Fails DESIGN §8's own greyscale test. | Reuse the notch/hatch marks from `slot-tile.tsx`; render the state word. |
| M-17 | `src/components/ui/stepper.tsx`, `checkbox.tsx` | Neither accepts an `error`, sets `aria-invalid`, or links its message with `aria-describedby` — including the three acknowledgement checkboxes on the party review screen and the guest/player steppers. `FormErrorSummary`'s `href="#guests"` lands a screen-reader user on a control that reports itself valid with no description. `TextInput` and `Select` do this correctly and are the pattern to copy. | Add `error?: string` to both and wire `aria-invalid` + `aria-describedby`. |
| M-18 | `src/components/ui/addon-row.tsx:65,134` | The row is a `<label>` that **contains** the Stepper's and Select's own `<label>`s. Nested labels are invalid HTML; the checkbox's accessible name becomes the whole subtree ("Large 1 Topping Feeds four. 24.63 each Quantity Size Small Medium Large"), and `has-[:focus-visible]` on line 73 draws a ring round the entire 72px row whenever the stepper's `+` is focused. | Make the row a `<div>`; scope the label to the name/description/price; scope the ring to `has-[input:focus-visible]`. |
| M-19 | `src/components/ui/slot-tile.tsx:140` | A **selected** tile sets `outline-2 -outline-offset-2` as a utility, which outranks the `@layer base` `:focus-visible` rule in `globals.css:240`. The offset is pinned at `-2px`, so the focus ring paints on the same band the selection ring already occupies. A keyboard user loses the caret on exactly the tile they picked. | Draw the selected ring with `shadow-[inset_0_0_0_2px_…]` and leave `outline` free for focus. |
| M-20 | `src/app/parties/_components/flow-chrome.tsx:73` | `RejectionPanel` is an `aria-live="polite"` region that only **mounts** when there is a rejection. A live region must already be in the DOM for a change to be announced, so every party-flow rejection is silent to a screen reader. `ReasonPanel` (laser tag) does it correctly with focus movement. | Render the wrapper unconditionally, or use `role="alert"` and move focus. |
| M-21 | `src/app/parties/actions.ts:552-557` | Every `cancelBooking` failure maps to `err.server.changeRequest` ("We couldn't send your request"), so an already-cancelled booking reports a system fault. `submitDateChangeRequest` (line 515) never checks the notice period at all — `evaluateReschedule` (R-59) is exported and **never called anywhere in `src/app`**. The date-change flow is request-only by design, so this is a gap rather than a violation, but R-59's gate exists only in tests. | Map the code to its own copy; decide whether R-59 should gate the request. |

### Low

| # | Where | What |
|---|---|---|
| L-01 | `src/lib/domain/pricing.ts:150` | The pre-tax add-on filter excludes lines by `l.code !== packageRecord.code && !l.code.endsWith('_EXTRA_GUEST')`. A manager-added add-on whose code ends `_EXTRA_GUEST` would be silently dropped from the subtotal while still appearing as a line. Partition by a flag, not by a string suffix. |
| L-02 | `src/app/laser-tag/actions.ts:483` | `prisma.booking.delete(...).catch(() => undefined)` — if the compensating delete fails, a `CONFIRMED` booking owning no games is left on the manager's board. |
| L-03 | `src/app/parties/actions.ts:203` `selectWindow` | Takes a client-supplied `date` straight to the engine with no shape check; a crafted `"x"` throws `TimeError` → 500. `parseCalendarDate` exists in the laser tag surface and should be shared. |
| L-04 | `src/app/manage/_lib/actions.ts:77` `blockSlotsAction` | `args.date` is unvalidated; garbage throws `TimeError` from `parseLocalDate`. Staff-authenticated, so low. |
| L-05 | `src/app/laser-tag/booking/[code]/page.tsx:53` | `laserTag.g5.title.replace("{code}", "")` renders the page title as `"Booking "`. Same at `parties/enquiry/page.tsx:22` → `"We can host up to  guests online"`. Manual substitution is exactly what `interpolate` exists to prevent. |
| L-06 | `src/app/parties/[draftId]/review/page.tsx:86` | The arrival-time row is labelled `global.hold.label` ("HELD FOR YOU"); should be `party.p8.arrive.label`. At `:119` a form label leaks into prose: *"16 guests, including Birthday guest of honour's first name"*. |
| L-07 | `src/app/parties/_components/extras-form.tsx:156,321` | Add-on quantity steppers announce "One fewer guest" / "One more guest". No deck key exists for add-on quantity — a genuine COPY.md gap. |
| L-08 | `src/app/manage/login/page.tsx:55` | The sign-in footer renders `mg.error.permission` ("Your account can't do that. Ask a manager.") as standing text. |
| L-09 | Repo-wide | No root `not-found.tsx` and no `error.tsx`/`global-error.tsx` anywhere except `parties/`. Every 404 and unhandled exception outside `/parties` shows Next's default page; `err.notFound.*` and `err.server.generic.*` are unreachable there. |
| L-10 | `src/lib/format.ts:114` vs `src/lib/domain/time.ts:193` | `formatTime` emits a non-breaking space (`5:15 PM`); `formatClock` emits a normal one. The party surface renders customer-facing arrival times through `formatClock`, so party times can wrap between the figure and the meridiem — the exact thing the NBSP exists to prevent. |
| L-11 | Repo-wide | ~30 exported symbols nothing imports, including four that represent **unshipped rules**: `addOnWarnings` (R-49 — the Time Play/QBIX warning is never shown), `evaluateReschedule` (R-59), `revertModeOnCancellation` (R-21), `arcadeMatchValueCents` (R-48). Also `checkSharedGameAgeRule` (R-36) is dead because `game-assignment.ts:133` reimplements it privately as `sharedSlotAgeOk`. Decide which to wire up; do not just delete. |
| L-12 | Three files, ~600 lines | `laser-tag/_lib/venue.ts`, `parties/_lib/venue.ts` and `manage/_lib/catalog.ts` are three near-identical Prisma→`Catalog` adapters. They diverge: party game set times are sorted in two of them and not the third (laser tag relies on `orderBy: sortOrder`, so a bad `sortOrder` gives it a different slot ordering). One `src/lib/db/catalog.ts` would delete ~400 lines and close the divergence. |

---

## 2. Verified correct

These are things I actually checked and found genuinely right, not assumptions.

**The 90-minute cutoff is enforced server-side at submit (R-10).** `runConfirm`
(`laser-tag/actions.ts:325`) re-runs `planPublicBooking` with `now = new Date()` at the moment of
commit; `evaluateSlot` → `cutoffPassed` re-checks every slot in the block. A stale tab cannot book
a past slot: `planPublicBooking` also rejects `PAST_DATE` when the date has gone, and the cutoff
covers same-day past times. The boundary is strictly-greater-than, so `now == start − 90min` is
accepted, exactly as R-10 and WE-08 require. The cancel path re-checks it too
(`runCancel:545`).

**No client posts a price, a capacity, or a seat count.** I enumerated every `type="hidden"` field
and every form control across all three surfaces. What clients send is: `draftId`, `code`,
`reference`, `date`, `startMinutes`, `games`, `players`, `guests`, `packageCode`, add-on
toggles/quantities/options, contact details and acknowledgements. Every price is recomputed from
the catalog (`computePartyPrice` / `computePublicGamePrice`) at write time and snapshotted. There
is no `name="price"`, `name="total"` or `name="cents"` anywhere.

**The UI does not reimplement business rules.** I grepped for local recomputation of the arena cap,
the cutoff, the notice period, the age gap, the deposit, the party ceiling and arena splitting in
`src/app/**/*.tsx`. Every hit is a `config.*` value passed down from the server and used for
display or for a stepper's `max`. The one apparent off-by-one — `players >= arenaCapacity` at
`players-and-games.tsx:80` versus the engine's `players > arenaCapacity` — is **not** a bug: the
stepper caps at 25, and the copy it triggers (`err.groupTooLarge`) is deliberately worded
*"Groups over {arenaCap}… book {arenaCap} now and tell us about the rest."* It fires at the ceiling
because that is where the message belongs.

**Room configuration selection matches R-25 exactly** (`domain/rooms.ts:173-185`): filtered by
`capacity >= guests` and by rooms being free, then ranked fewest `roomSlotsConsumed` → smallest
`capacity` → offering priority → configuration priority. `capacity` is read off the configuration
and never summed from member rooms (R-27). The seed reproduces §3.3 exactly, including the
deliberate 20-not-26 override and `CFG-B-20` at `isOffered = false` (OQ-10).

**The 2-year age rule is enforced consistently at browse time and at submit.**
`evaluatePartyWindow` runs `checkWindowAgeRule` **before** `selectRoomConfiguration`, which is
WE-07's requirement that a customer is never shown a room that is then pulled away. The same
function backs the date screen, `createHeldDraft`, `rehold` and `recordDeposit`, so browse and
submit cannot disagree. The boundary is `Math.abs(a−b) <= 2` — 7 and 9 pass, 7 and 11 fail. R-36's
shared-slot variant is applied inside game assignment (`sharedSlotAgeOk`), and R-37's pairwise
behaviour falls out of filtering all same-window bookings rather than "the other one".

**Arena cap and >25 splitting.** `splitArenaGroups` gives `ceil(P/25)` groups as evenly as
possible (28 → 14+14, 26 → 13+13), larger first. Groups never share a slot: the engine tracks
`takenByThisBooking`, and `BookingGame(bookingId, gameSlotId)` is unique at the database level.
The cap is a **sum re-read inside the commit transaction**, never a stored counter.

**Deposit boundary arithmetic at exactly 14 days is right.** `assessNotice` uses
`noticeDays >= config.changeNoticeDays` over `wholeDaysBetween`, which does calendar arithmetic in
`America/Winnipeg` rather than dividing milliseconds by 86,400,000 — so the boundary does not drift
by an hour across a DST change. Exactly 14 days → gift card; 13 days 23 hours → forfeit, matching
WE-14 and R-56.

**Pizza tiers and add-on eligibility.** The seeded tiers are exactly R-41's (10–11→2, 12–15→3,
16–20→4, 21–25→5, 26–30→6) and are re-validated for contiguity on every lookup. R-42 gates the
tier on `includesPizza`; R-43 zeroes it for hot dogs. Eligibility is a data relation
(`AddOnPackageEligibility`), not a switch — R-46's arcade-card exclusion on Around The World is a
row, and R-47's mutual exclusion is an `exclusiveGroup`. R-48's 5-Up increments are checked
against config.

**Money is integer cents end to end.** No float arithmetic anywhere; `cents()` guards every
construction and throws outside the safe-integer range; `taxOn` applies the rate once at the tax
line, half-up, in milli-percent so the whole calculation stays integral. Tax-inclusive lines
(pizzas, wings) are kept in a separate accumulator and never taxed again (R-51, R-67). R-68 holds:
`breakdownFromSnapshot` rebuilds a confirmed booking's totals from stored columns and never
re-prices from live settings.

**The concurrency claim holds on the paths the surfaces actually call** — after F-01, F-04 and
F-05. Rooms are guarded by a `UNIQUE(roomId, startsAtUtc)` index, so the loser of a race gets
P2002 rather than a logic race, and partial overlaps (which no unique index can express) are caught
by an in-transaction overlap check. I confirmed the party flow reaches this through
`createHeldDraft` → `commitBookingInventory`, and the laser tag flow through `createGamesBooking`,
and that the compensating delete removes the booking row when the claim fails.

**Manager authorisation is uniform and correct.** `requireStaff()` is the first statement of all 19
exported actions in `manage/_lib/actions.ts` — I checked each one. Sessions are HMAC-SHA256 over a
base64url payload with constant-time comparison, scrypt password hashes with self-describing cost
parameters, `timingSafeEqual` on both the signature and the password, a 12-hour TTL, httpOnly
cookies scoped to `/manage` (which under RFC 6265 does **not** match the public `/manage-booking`),
login throttling, and fail-closed behaviour when `MANAGER_SESSION_SECRET` is unset. No secret is a
literal anywhere.

**Draft tampering is contained.** The laser tag draft is an httpOnly cookie, but every field is
re-parsed and bounded on read (`parseBoundedInteger`, `parseCalendarDate`), and — the property that
makes it safe — **nothing derived is ever read back from it.** Price, availability, seats and the
cutoff are recomputed server-side on every render and again at submit. Editing the cookie changes
what you are asking for, not the answer. Confirm is idempotent on `draft.bookingCode`, so a double
tap lands on the booking that already exists.

**Draft replay is blocked.** `recordDeposit` returns the existing booking when `draft.deposit` is
set, refuses any draft not in `HOLD`, and a concurrent double-submit is caught by the `Deposit`
unique index and treated as idempotent.

**Accessibility that is genuinely right.** No `outline-none` / `focus:outline-none` anywhere in
`src/` — I grepped for all four spellings. The global `:focus-visible` draws both an outer and an
inset ring and has a `forced-colors: active` override. `MonthGrid` implements a real
`role="grid"` with roving tabindex and arrow/Home/End/PageUp/PageDown handling. `TextInput`,
`TextArea` and `Select` correctly generate `${id}-helper` / `${id}-error` ids that exist in the
DOM, set `aria-invalid` conditionally and join both into `aria-describedby`. Radio groups use real
`<fieldset><legend>`. Non-interactive slot tiles use `aria-disabled` rather than `disabled`, so
they stay focusable and their reason is readable. Every mark in `marks.tsx` is `aria-hidden` +
`focusable="false"`; there are no `<img>` elements and no icon-only buttons. `SlotTile` carries a
distinct **shape** and a literal **word** for all six states — the invariant holds there even
though it fails on the date picker and the board (M-15, M-16).

**The 44px adjudication** — see §3.

---

## 3. Adjudications

### The ≥44px touch-target question

DESIGN.md §5 mandates ≥44×44 and §8 makes it a blocking check, while §5.1 specifies a 36px compact
button and §5.8 a 40px quantity stepper. The design-system engineer implemented both as specified
and flagged the contradiction. My ruling:

**§5.8's 40px stepper is a real defect and I fixed it.** Every compact-stepper instance is a
**customer** surface reached on a phone: add-on quantity (`extras-form.tsx:147`), arcade card
quantity (`:313`), and the guest-count editor on the party review screen
(`review-form.tsx:49`) — which changes the price. There is no padding and no pseudo-element
expanding the hit area; the `<button>` box is the target. A parent adjusting pizza count with a
thumb on a 360px phone is the exact user this fails. The containing row is `min-h-18` (72px), so
raising it to `h-11 w-11` costs no layout. **`docs/DESIGN.md` §5.8 should be corrected to 44px** —
the spec is what is wrong here, not the implementation.

**§5.1's 36px compact button is acceptable, and I left it.** I verified by grep that
`variant="compact"` / `buttonClassName('compact')` appears **only** on manager surfaces
(`board-view`, `week-view`, `activity`, `slot-inspector`) — a desk tool driven with a mouse. §5.1
sanctions it explicitly. Two caveats worth the manager's attention, both listed rather than
changed: the **Undo** button in `board-view.tsx:418` sits in a `fixed inset-x-4 bottom-4` toast
that does render on a phone and auto-dismisses after 10 seconds (also a WCAG 2.2.1 timing
concern), and the phone agenda row at `schedule-board.tsx:248` computes to roughly 32px, which is
the wrong call on the one manager path DESIGN §4.6 explicitly puts on a phone.

**Under-44px links.** There are ~24 standalone `tel:` links, edit links, back links and
`<summary>` elements between 13px and 22px tall across both public flows and the manager screens.
None qualifies for WCAG 2.5.8's inline exception — they are standalone on their own line or in a
control row, not embedded in running text. The fix is one class each
(`inline-flex min-h-11 items-center`), and the codebase already gets it right in two places
(`laser-tag/_components/flow-chrome.tsx:100`, `laser-tag/booking/[code]/page.tsx:289`). I left
these as a Medium batch rather than touching 24 files in a review pass; they should be swept in one
commit.

### Why F-11 (`releaseSlotAction`) was not fixed

The bug is unambiguous. The fix is not small, and it is not mine to make.

Making the button work means adding a **new channel through the engine**: a `releasedSlotMinutes`
field on `DayState`, populated from `GameSlot.releasedToPublicAt` by all three loaders, and read by
`generateGameSlots` to override a `PARTY_HELD` mode to `PUBLIC` — while still short-circuiting on
`PARTY_ONLY` first, because R-04/R-19 say the weekend morning games never release on any lead time.
That is six files and a behaviour change that **releases reserved party inventory to the public**.

It is a feature that was never built (R-23c), not a regression, and turning it on quietly at the
end of a review — without the rules architect, without a test, and without the manager confirming
the R-19 interaction — is exactly the kind of change a review should surface rather than perform.
Recommended: implement it deliberately, with a test that asserts a `PARTY_ONLY` slot still refuses
to release.

---

## 4. For the manager, not for the code

These look like defects but are business decisions. Flagging, not changing.

- **F-06 needs a real answer.** I bounded per-unit add-on quantity at `CFG.maxPartyGuests` (28) as
  a safety rail. *How many pizzas or wing orders will you actually take on one online booking?*
  That belongs in a `Setting` row.
- **OQ-02 is still unanswered and is revenue-material.** The Traveler ships with
  `includesPizza = false`. Every Traveler total in the product depends on it.
- **OQ-13 / the 14-day boundary** is implemented as `>=` (customer-favourable). Confirm.
- **CLAUDE.md's two known contradictions still stand**: the third weekend-morning party has no
  game times, and WE-09 contradicts R-17. The code implements R-17.

---

## 5. What this review did NOT check

This is not an exhaustive review. Explicitly out of scope or not reached:

1. **No browser was opened.** Nothing here is a rendering, layout, hydration or visual regression
   finding. Contrast ratios, font loading, print stylesheets and the dark/light behaviour of
   `globals.css` were not measured — I trusted the design audit.
2. **No screen reader was run.** All accessibility findings are from reading markup and Tailwind
   classes and computing sizes at 4px/unit. NVDA/JAWS/VoiceOver announcement order is unverified.
3. **Keyboard interaction was not exercised.** Focus order, focus trapping in the slot inspector,
   and the `MonthGrid` roving tabindex were read, not driven.
4. **No load, soak or real concurrency testing.** The two inventory findings were reproduced with a
   deterministic sequential harness against SQLite. Genuine simultaneous writers, connection-pool
   behaviour, and everything in the Postgres migration path (the commented-out `SELECT … FOR
   UPDATE`, the `EXCLUDE USING gist` constraint) are untested.
5. **The email path.** `_lib/email.ts` has no transport; delivery, templating and bounce handling
   were not reviewed.
6. **The manager backend's read screens** (`/manage/schedule`, `/manage/bookings`,
   `/manage/activity`, `/manage/day/[date]/sheets`) were read for auth and for the findings above,
   but their board-layout maths, search ranking and print sheets were not audited for correctness.
7. **The seed beyond §3.3, §3.4 and R-41.** I verified rooms, configurations, windows, offerings,
   pizza tiers and add-on pricing modes against RULES.md. Operating hours, party-only game times
   and package descriptions were spot-checked, not fully reconciled.
8. **Copy against COPY.md line by line.** The audit covered placeholder integrity, hardcoded
   strings and error quality. Tone, sentence-level fidelity to the deck, and the 202 unused keys
   were surveyed rather than adjudicated.
9. **Dependency and supply-chain review**, `next.config.ts`, headers/CSP, and rate limiting beyond
   reading the two in-process limiters (both of which are single-instance only, as their own
   comments say).
10. **`prisma/migrations`.** I read `schema.prisma`; I did not verify the migration SQL matches it
    or that it applies cleanly to an existing database.

---

## 6. Verification after fixes

```
$ npx tsc --noEmit
(no output — exit 0)

$ npm test
 RUN  v4.1.10 /Users/muradcheway/Lazertopia
 Test Files  16 passed (16)
      Tests  384 passed (384)
   Duration  15.81s

$ npm run build
✓ Compiled successfully in 5.6s
  Finished TypeScript in 17.2s
✓ Generating static pages using 3 workers (5/5) in 500ms
Route (app) — 32 routes
```

And the reproduction harness, before and after:

```
BEFORE
[F-B] hold placed: rooms=1 games=2 status=HOLD
[F-B] after sweepExpiredHolds: rooms=0
[F-B] recordDeposit ok=true -> status=CONFIRMED rooms=0 games=0 deposit=RECORDED
[F-B] *** REPRODUCED: CONFIRMED party booking owning no room and no games ***
[F-B] a second party booking the same window now: ok=true rooms=RM2
[F-A] after a failed rehold: rooms=0 holdExpired=true status=HOLD
[F-A] *** REPRODUCED: the hold the customer was promised is gone ***

AFTER
[F-B] recordDeposit ok=true -> status=CONFIRMED rooms=1 games=2 deposit=RECORDED
[F-B] a second party booking the same window now: ok=true rooms=RM1   <- a different room
[F-A] after a failed rehold: rooms=1 holdExpired=false status=HOLD    <- hold survived
```

No fix was skipped for being unresolvable. F-11 was skipped deliberately, with reasoning in §3.
