# The domain engine — a map for the frontend

Pure functions over plain data. No database, no globals, and **no function reads the clock** —
every one that needs the current time takes `now: Date`. Import everything from
`@/lib/domain`.

Two arguments show up almost everywhere:

| Argument | What it is | Where it comes from |
|---|---|---|
| `config: EngineConfig` | The §2.0 configuration registry, typed | `loadEngineConfig(settingRows)` |
| `catalog: Catalog` | Rooms, configurations, windows, game sets, hours, packages, tiers, add-ons, prices | one query per table |
| `dayState: DayState` | What is already booked on **one date** | bookings for that date |

Nothing in `RULES.md` §2.0 or §3 is a literal in this code. If you need "25" or "90" or "14",
read it off `config`.

---

## Rejections

Nothing returns a bare boolean. Anything that can fail returns:

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: Rejection };

interface Rejection {
  code: BookingErrorCode;   // machine-readable, exhaustive — see errors.ts
  message: string;          // a complete sentence: what happened + what to do
  detail: Record<string, ...>; // the facts you need to write better copy
}
```

`errors.ts` exports `RULE_ERROR_CODES` (the 13 named in R-69) and `EXTENDED_ERROR_CODES`
(the rest, each with a note on why it is not collapsed into a neighbour). `DEFAULT_MESSAGES`
is a `Record<BookingErrorCode, string>`, so a new code without copy is a compile error.

Read `error.detail` before writing copy — it carries `seatsRemaining`, `existingAges`,
`windowMaxGuests`, `noticeDays`, `phone` and friends.

---

## Laser tag flow

### `getPublicAvailability(req) => PublicAvailability`

The whole time grid for one date, **for a specific group size and game count**.

```ts
getPublicAvailability({ now, date, players, games, channel, catalog, config, dayState })
```

Returns `{ date, closed, closedReason, opensMinutes, closesMinutes, slots, nextAvailableStartMinutes }`.
Each slot is:

```ts
{ startMinutes, startsAtUtc, label: "6:15 PM", mode, releasedFromParty,
  available, reason: BookingErrorCode | null, seatsRemaining, blockStartMinutes }
```

`blockStartMinutes` is every start the booking would occupy (`[18:15, 18:30]` for 2 games) —
render the cell as a block, not a single time. `seatsRemaining` is the **tightest** slot in
that block. Reasons you will see per cell: `ONLINE_CUTOFF`, `SLOT_HELD_FOR_PARTY`,
`PARTY_ONLY_WINDOW`, `SLOT_UNAVAILABLE`, `ARENA_FULL`, `PARTIAL_BLOCK`.

It is parameterised by `players`/`games` on purpose: "is 6:15 free" has no answer without
them, and a grid rendered without them shows green cells that reject on submit.

### `planPublicBooking(req & { startMinutes }) => Result<PublicBookingPlan>`

Re-validate at submit. Returns the arena groups (a group over 25 splits, R-14) with their
concrete start times, plus `pricePerPersonCents` and `preTaxSubtotalCents`.

### `computePublicGamePrice({ players, games, catalog, config })`

`{ pricePerPersonCents, preTaxSubtotalCents, taxCents, totalCents }`. Laser tag is quoted
**plus tax**.

### `cutoffPassed({ now, startsAtUtc, channel, config })` / `earliestOnlineStart(now, config)`

The 90-minute rule and the "earliest you can book online is 7:45 PM" number for the cutoff
sheet. `now == start - 90min` is **accepted**; manager channel is exempt.

---

## Party flow

### `getPartyAvailability(req) => PartyDayAvailability`

Every window on a date, **for a specific guest count and honoree age**.

```ts
getPartyAvailability({ now, date, guests, honoreeAge, packageCode?, channel, catalog, config, dayState })
```

Returns `{ date, closed, closedReason, windows, anyAvailable }`. Every window comes back
whether or not it is available — render inactive rows **with** their reason, never hidden:

```ts
{ partyWindowId, label: "1:00 PM – 3:00 PM", startMinutes, endMinutes, startsAtUtc, endsAtUtc,
  available, reason, message, detail,
  maxGuestsInWindow,     // on an empty calendar
  remainingCapacity,     // on THIS date
  roomSlotsTotal, roomSlotsFree,
  selection,             // the configuration that would be allocated
  arenaGroups }          // the party's proposed game times
```

`anyAvailable` is the calendar cell's open/full mark. Reasons per row: `AGE_GAP_EXCEEDED`,
`NO_ROOM_CONFIG`, `WINDOW_FULL`, `NO_GAME_CAPACITY`, `EXCEEDS_MAX_PARTY_SIZE`, `VENUE_CLOSED`.

`NO_ROOM_CONFIG` vs `WINDOW_FULL` is a real distinction: the first means "this size does not
fit here" (offer a smaller count or another window), the second means "everything here is
sold" (offer another date).

### `planPartyBooking(req & { partyWindowId }) => Result<PartyBookingPlan>`

Re-validate at submit. Returns `{ window, startsAtUtc, endsAtUtc, selection, arenaGroups, guests, honoreeAge }`.

### `quotePackages({ guests, catalog, config })`

For the package screen: each package with `extraGuests` and `preTaxSubtotalCents` computed for
the actual guest count. Show the arithmetic (`$259.50 + 6 × $25.95`), not just the total.

### `computePartyPrice(req) => Result<PriceBreakdown>`

```ts
computePartyPrice({ packageRecord, guests, addOns, foodChoice, catalog, config, depositAppliedCents })
```

Returns every line plus `preTaxSubtotalCents`, `taxCents`, `taxIncludedTotalCents`,
`totalCents`, `balanceDueCents`, `includedPizzaCount`.

**Tax is mixed and you must show it that way.** Packages, extra guests, QBIX and arcade cards
are quoted before tax; pizzas and wings are quoted with tax already inside. Render the
tax-exclusive lines, then the tax line, then the tax-inclusive food lines. Each line carries
`taxIncluded: boolean`.

Add-on validation happens here, so this is where `ADDON_NOT_ELIGIBLE`,
`ADDON_EXCLUSIVE_CONFLICT`, `ADDON_QUANTITY_INVALID` and `ADDON_OPTION_INVALID` surface.

### `eligibleAddOns(catalog, packageRecord)` / `addOnWarnings(resolved)`

Which extras to render at all, and the non-blocking warnings (the Time Play card does not
cover QBIX or Claw Machines).

---

## Building blocks you may want directly

| Function | Takes | Returns |
|---|---|---|
| `generateGameSlots({ date, catalog, config, dayState })` | — | every slot on a date with its mode |
| `selectRoomConfiguration({ guests, catalog, config, window, dayState })` | — | `Result<RoomSelection>` — the R-25 preference order |
| `assignPartyGameTimes({ ... })` | arena groups, games required | `Result<AssignedArenaGroup[]>` — R-16 + R-17 |
| `checkWindowAgeRule({ honoreeAge, window, dayState, config })` | — | `Result<null>` — the ±2-year rule |
| `agesCompatible(a, b, config)` | two ages | boolean; exactly 2 passes |
| `splitArenaGroups(players, config)` | — | `[14, 14]` for 28 |
| `includedPizzaCount({ guests, packageRecord, tiers, foodChoice })` | — | `Result<number>` |
| `validatePizzaTiers(tiers)` | — | contiguity/overlap problems (manager backend save) |
| `evaluateCancellation({ now, eventStartsAtUtc, depositAmountCents, config })` | — | gift card vs forfeit + `noticeDays` |
| `evaluateReschedule({ now, eventStartsAtUtc, channel, config })` | — | `Result` — self-serve needs ≥14 days |
| `assessNotice({ now, eventStartsAtUtc, config })` | — | `{ noticeDays, requiredDays, sufficient }` |

---

## Money

**Integer cents everywhere.** `Cents` is a branded number; constructing a fractional one
throws.

```ts
parseMoney('259.50')   // 25950
formatMoney(25950)     // "$259.50"
multiplyMoney(c, qty)  // integer quantity only
taxOn(preTax, config.taxRateMilliPercent)
```

Never do arithmetic on a formatted string, and never send a float over the wire. Totals from
the engine are already exact; display them, do not recompute them.

## Time

Venue-local wall clock in `America/Winnipeg`, always explicit.

```ts
formatClock(1035)        // "5:15 PM"   — customer copy
formatClock24(1035)      // "17:15"     — manager screens, logs
parseClock24('17:15')    // 1035
localDateOf(now, config.timezone)  // "2026-09-15"
zonedTimeToUtc(date, minutes, tz)  // instant
```

Calendar dates are `"YYYY-MM-DD"` strings, not `Date` objects — a `Date` at "UTC midnight" is
the previous local day in Winnipeg. Times of day are minutes from local midnight.
