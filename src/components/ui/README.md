# `@/components/ui` — the component index

The API contract for the three surface teams. Everything below is importable from the barrel:

```tsx
import { Button, SlotTile, SlotGrid } from "@/components/ui";
```

## Before you build a screen

1. **Copy comes from `@/lib/copy`, never from a component.** Every string prop below is one you
   pass in. Components carry no prose. If a string you need is not in COPY.md, that is a bug in
   COPY.md — raise it, do not write one.
2. **Numbers come from `@/lib/format`.** `formatTime`, `formatMoney`, `formatCapacity` and
   friends. A component never assembles a figure; it receives a formatted string.
3. **Everything is a server component except `date-picker.tsx`.** Components that take callbacks
   are still server-by-default — put `"use client"` on *your* screen, the one that owns the
   state, and render these inside it.
4. **`className` is for placement only** (grid position, margin). Every component's own
   appearance is fixed; that is the point of the layer.
5. **Focus rings are already handled.** The global `:focus-visible` in `globals.css` draws the
   2px outer ring and the 2px inset ring. Do not add your own.

---

## Layout

### `PageShell`
`src/components/ui/page-shell.tsx` — the page container and gutters (16 / 24 / 32px).

| Prop | Type | Notes |
|---|---|---|
| `width` | `"page" \| "flow" \| "board"` | 1144px / 544px / full bleed. Default `"page"`. |
| `as` | `"div" \| "main" \| "section" \| "header" \| "footer"` | Default `"div"`. |

```tsx
<PageShell as="main" width="flow">{children}</PageShell>
```

### `FlowLayout`
Booking-flow columns. One column through `md`; at `lg` it becomes `34rem + 20rem` with a 48px
gap and the rail sticks 24px from the top. The rail is hidden below `lg` — the sticky bottom bar
is the phone's single source of the total.

```tsx
<FlowLayout rail={<OrderSummary … />}>{steps}</FlowLayout>
```

### `FlowSection` · `FieldStack`
48px between sections; 24px between fields (`gap="field"`) or 32px between groups
(`gap="group"`).

```tsx
<FlowSection><FieldStack><TextInput … /><TextInput … /></FieldStack></FlowSection>
```

### `StickyActionBar`
72px, `raised`, 1px interactive top rule, iOS safe-area padding. Hidden at `lg` by default.

| Prop | Type | Notes |
|---|---|---|
| `children` | `ReactNode` | Left side: total, hold countdown, context. |
| `action` | `ReactNode` | Right side: exactly one primary button. |
| `hideAtLg` | `boolean` | Default `true`. |

```tsx
<StickyActionBar action={<Button variant="primary">{global.btn.continue}</Button>}>
  <MonoValue step="md">{formatMoney(43979)}</MonoValue>
</StickyActionBar>
```

---

## Type

### `SectionHeader`
Screen and section headings. **Left-aligned, always.**

| Prop | Type | Notes |
|---|---|---|
| `title` | `ReactNode` | Required. |
| `level` | `1 \| 2 \| 3` | `display-1` (one per page) / `display-2` / `display-3`. Default `2`. |
| `eyebrow` · `description` · `action` | `ReactNode` | Description caps at 68 characters. |
| `headingTag` | `"h1" \| "h2" \| "h3"` | Decouple the tag from the visual step. |

```tsx
<SectionHeader level={2} title={laserTag.g2.heading} description={laserTag.g2.context} />
```

### `Eyebrow` · `FieldLabel` · `Caption` · `MonoValue` · `InlineMono`
`typography.tsx`. `MonoValue` takes `step: "xl" | "lg" | "md" | "sm" | "xs"` — `xl` is the only
step at `wdth` 100 and is reserved for one grand total per screen. `InlineMono` is for a figure
sitting inside a Chivo sentence (0.92em).

```tsx
<MonoValue step="lg">{formatTime(1035)}</MonoValue>
```

### `Tag` · `MonoChip`
24px chips. `Tag` takes `tone: "neutral" | "accent" | "open" | "filling" | "full" | "party" |
"blocked"`, `variant: "outline" | "solid"`, `hatched`. `MonoChip` is the figure chip (game
times, count badges).

```tsx
<Tag tone="accent">1 BAY OPEN</Tag>
<MonoChip>{formatTimeCompact(1035)}</MonoChip>
```

### `Hairline`
`tone="rule"` is **decorative only** (1.43:1). `tone="border"` (3.77:1) is the only tone allowed
where the line bounds something interactive.

### `StepIndicator`
4px segments, 1px gaps, current segment 6px. The bar never carries the state alone — `label` is
required.

```tsx
<StepIndicator current={2} total={4} label="STEP 2 / 4" a11yLabel="Booking progress" />
```

---

## Controls

### `Button` · `ButtonLink` · `buttonClassName`
`button.tsx`. **Never more than one primary button on a screen.**

| Prop | Type | Notes |
|---|---|---|
| `variant` | `"primary" \| "secondary" \| "ghost" \| "compact"` | Default `"secondary"`. |
| `fullWidth` | `boolean` | Primary is full-width below `md` unless overridden. |
| `pending` · `pendingLabel` | `boolean` · `string` | Disables, sets `aria-busy`, swaps the label. |

Heights: primary 48 → 44 at `md`; secondary and ghost 44; compact 36 (manager board only).
States: rest · hover · active (`translateY(1px)`) · disabled (hatch, `text-3`, `rule` border,
`not-allowed`). Use `buttonClassName()` on a `next/link` or a `tel:` anchor.

```tsx
<Button variant="primary" pending={saving} pendingLabel={global.loading.confirming}>
  {global.btn.confirmBooking}
</Button>
<Link href="/book/games" className={buttonClassName("primary")}>{laserTag.g1.cta}</Link>
```

### `TextInput` · `TextArea`
`text-input.tsx`. 48px → 44px at `md`, sunken fill, 14px padding-x, `text-body` (never below
16px — iOS zooms). Wires `htmlFor`, `aria-describedby`, `aria-invalid` and `role="alert"` for
you.

| Prop | Type | Notes |
|---|---|---|
| `id` | `string` | Required. |
| `label` · `helper` | `ReactNode` | |
| `error` | `string` | Adds the 3px left border and the message block. |

States: rest · hover · focus · filled (unchanged, deliberately) · error · disabled.

```tsx
<TextInput id="phone" label={laserTag.g3.phone.label} helper={laserTag.g3.phone.help}
           error={errors.phone} inputMode="tel" />
```

### `Select`
Native options (correct, accessible and free on a phone). CSS-drawn chevron in a 40px zone
behind a full-height 1px divider. Same `id` / `label` / `helper` / `error` contract as
`TextInput`.

```tsx
<Select id="pkg" label={party.p3.heading}>
  {packages.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
</Select>
```

### `Checkbox`
24×24 box, 2px CSS-drawn tick, focus ring on the whole label. Works controlled or uncontrolled.

```tsx
<Checkbox id="ack-house" label={party.p6.ack.house.label} description={party.p6.ack.house.body} />
```

### `Stepper`
`stepper.tsx`. 48px tall, 48×48 controls, 72px value cell. The value is a real
`<input type="number">`. **The number never animates.**

| Prop | Type | Notes |
|---|---|---|
| `id` · `label` | `string` | `labelHidden` for the add-on quantity case. |
| `value` · `min` · `max` · `onChange` | | Fully controlled. |
| `decreaseLabel` · `increaseLabel` | `string` | COPY.md `aria-label`s. Required. |
| `hint` | `ReactNode` | The live capacity constraint. Part of the component, not a footnote. |
| `size` | `"default" \| "compact"` | 48px / 40px. |

At `max` the plus takes `aria-disabled`, the 6px hatch and `not-allowed`, and stays focusable so
a screen-reader user can hear why. An `aria-live` region announces `"{label}: {value}"`.

```tsx
<Stepper id="guests" label={party.p1.guests.label} value={guests} min={1} max={28}
  onChange={setGuests} decreaseLabel={party.p1.guests.decrease}
  increaseLabel={party.p1.guests.increase} hint={interpolate(party.p1.guests.hint.twoRooms, {})} />
```

### `AddOnToggleRow`
72px row, the whole row is the label. Checked = `raised` fill **and** a 3px accent left bar.
Unavailable add-ons render disabled with a reason — **never hidden**.

| Prop | Type | Notes |
|---|---|---|
| `id` · `name` · `description` | | `name` is the display name; `inputName` is the form attribute. |
| `price` · `priceUnit` | `string` | Already formatted. |
| `unavailableReason` | `ReactNode` | Shown with `disabled`. |
| `quantity` · `derivedLine` | `ReactNode` | Render `quantity` only when checked. |

```tsx
<AddOnToggleRow id="qbix" name={party.p4.qbix.heading} description={party.p4.qbix.body}
  price={formatMoney(395)} priceUnit="per person" checked={on} onChange={toggle}
  quantity={on ? <Stepper size="compact" labelHidden … /> : undefined} />
```

---

## Dates — `date-picker.tsx` (`"use client"`)

`DateOption` is shared by both:

```ts
{ date: LocalDateString; availability: "open" | "limited" | "none" | "closed";
  statusLabel: string; weekdayOverride?: string; isToday?: boolean;
  disabled?: boolean; a11yLabel?: string }
```

### `DateStrip`
56×72 tiles, scroll-snap, 4px status bar. `role="listbox"`, one tab stop, arrows move by day,
`Home`/`End` to the week bounds.

### `MonthGrid`
7 columns, 44×44 minimum, 3px status bar, real ARIA rows. Adds `↑`/`↓` by week and
`PageUp`/`PageDown` via `onMonthChange`.

Selected carries three cues in both: accent fill, a 3px top bar, `aria-selected="true"`.
Unavailable dates are `text-3` + 6px hatch + strikethrough + `aria-disabled`.

```tsx
<DateStrip label={laserTag.g2.dateStrip.label} days={days} selected={date} onSelect={setDate} />
<MonthGrid label={interpolate(party.p2.calendar.label, { month })} days={days}
           selected={date} onSelect={setDate} onMonthChange={shiftMonth} />
```

---

## Slots — `slot-tile.tsx`

### `SlotTile`
76px min (84px at `md`), 12px padding, **no border** — `SlotGrid`'s 1px gap is the border.

| Prop | Type | Notes |
|---|---|---|
| `time` | `string` | From `formatTime` / `formatBlock`. |
| `state` | `"open" \| "filling" \| "full" \| "party" \| "blocked" \| "tooSoon"` | |
| `stateWord` | `string` | The literal uppercase word. Required. |
| `detail` · `subTimes` | | Capacity line; the starts inside a block. |
| `selected` · `selectedWord` | | Adds wash fill, inward ring and the 16px tick square. |
| `a11yLabel` | `string` | The whole accessible name. Must contain the state word. |
| `onSelect` | `() => void` | Ignored on non-interactive states. |

`open` and `filling` are interactive (`aria-pressed`); the rest are `aria-disabled` and stay in
the tab order so the reason is readable. Markers: solid bar · four dashes · 4px hatch +
strikethrough · corner notch · 6px hatch + strikethrough.

### `SlotGrid` · `SlotHourHeader`
2 → 3 → 4 → 6 → 8 columns; 1px `rule` gaps. One header per hour group, each followed by its own
grid. **No entrance animation, ever.**

```tsx
<SlotHourHeader>{formatTime(1080)}</SlotHourHeader>
<SlotGrid label={interpolate(laserTag.g2.grid.label, { date })}>
  {slots.map((s) => (
    <SlotTile key={s.startMinutes} time={formatTime(s.startMinutes)} state={stateOf(s)}
      stateWord={wordOf(s)} detail={interpolate(laserTag.g2.cell.spots, { … })}
      a11yLabel={interpolate(laserTag.g2.cell.a11y, { … })}
      selected={s.startMinutes === picked} selectedWord={laserTag.g2.cell.state.selected}
      onSelect={() => pick(s.startMinutes)} />
  ))}
</SlotGrid>
```

---

## Party — `party-window-card.tsx`

### `PartyWindowCard`
A `<section>` named by the window time. **Not clickable — the bay rows are.**

| Prop | Type | Notes |
|---|---|---|
| `windowTime` | `string` | From `formatTimeRange`. Also the accessible name. |
| `meta` · `status` | | `status: { label, tone, hatched? }`. |
| `bays` | `ReactNode` | `PartyBayRow` children. |
| `constraintNote` | `ReactNode` | The age rule, with its real number. Only when a bay is held. |
| `extraNote` · `gamesLabel` · `gameTimes` | | |

### `PartyBayRow`
56px, 3px state left bar, `3px 1fr 72px 96px` from `sm` (two lines below). States: `open`,
`party`, `full`, `blocked`. `a11yLabel` is required.

```tsx
<PartyWindowCard windowTime={formatTimeRange(w.startMinutes, w.endMinutes)}
  status={{ label: "1 BAY OPEN", tone: "accent" }} gamesLabel="GAMES" gameTimes={times}
  constraintNote={interpolate(global.rule.ageBand, { ageBand: 2 })}
  bays={bays.map((b) => (
    <PartyBayRow key={b.id} roomName={b.name} capacity={formatCapacity(b.used, b.cap)}
      state={b.state} stateWord={b.word} a11yLabel={b.a11y} onSelect={() => pick(b.id)} />
  ))} />
```

---

## Money — `order-summary.tsx`

### `OrderSummary`
`1fr 48px 88px`. Amounts are **`formatMoneyPlain`** (no symbol); the currency is stated once via
`currencyNote`. The deposit block is mandatory wherever the summary appears. An empty panel
keeps its height.

| Prop | Type |
|---|---|
| `heading` · `currencyNote` | `string` |
| `lines` | `{ id, description, quantity?, amount }[]` |
| `totalsBefore` | `{ id, label, amount }[]` — subtotal, tax, food subtotal |
| `total` | `{ label, amount }` — the one `mono-xl` figure on the screen |
| `deposit` | `{ label, amount, note }` |
| `emptyLabel` | `string` |

```tsx
<OrderSummary heading={global.sum.heading} currencyNote="CAD" lines={lines}
  totalsBefore={[{ id: "sub", label: global.sum.subtotal, amount: formatMoneyPlain(sub) }]}
  total={{ label: global.sum.total, amount: formatMoneyPlain(total) }}
  deposit={{ label: global.sum.depositDue, amount: formatMoneyPlain(5000), note: policy }}
  emptyLabel={emptyCopy} />
```

---

## Feedback

### `ValidationMessage`
`tone: "error" | "success" | "warning"`. Distinct marker shape + explicit words; colour is the
third cue. Errors are `role="alert"`, the rest `aria-live="polite"`. Fire on blur and on submit,
never on keystroke.

### `FormErrorSummary`
Above the submit button. `errors: { fieldId, message }[]`, each a link to its field.
`tabIndex={-1}` so you can move focus here on a failed submit.

### `EmptyState`
**Left-aligned**, 64px slash mark, one action. State *why* in the venue's real terms.

### `LoadingBlock`
A static 6px hatch block at the component's real dimensions with a `LOADING` label. **Nothing
pulses.** `label` is the screen-reader sentence from COPY.md §2.6.

```tsx
<ValidationMessage tone="warning">{interpolate(laserTag.g2.warn.scarce, { seatsLeft })}</ValidationMessage>
<EmptyState title={empty.title} body={empty.body} action={<Button>{global.btn.pickAnotherDate}</Button>} />
<LoadingBlock label={global.loading.times} className="min-h-21" />
```

---

## Manager — `schedule-board.tsx`

### `ScheduleBoard`
Desktop-first. `96px + repeat(rooms, minmax(160px, 1fr))`, sticky time gutter, sticky header,
44px rows, hour rules heavier than quarter rules, horizontal scroll below 960px. **Below `md` it
is not a grid at all** — the same `chips` render as a 64px-row agenda.

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | Grid accessible name. |
| `columns` | `{ id, name, capacityLabel }[]` | |
| `rows` | `{ id, timeLabel, onHour? }[]` | One 15-minute slot each. |
| `chips` | `BoardChip[]` | See below. |
| `now` | `{ rowId, label }` | The 2px accent now-line plus its gutter chip. |

`BoardChip`: `{ id, columnId, rowId, span?, state, name, countLabel?, a11yLabel, onSelect? }`
with `state: "confirmed" | "filling" | "full" | "party" | "blocked"`. A `span` draws one
continuous object down its full height.

**The now-line does not tick by itself.** Pass a new `now` every 60 seconds from the surface
that owns the clock — the board holds no timers so it stays server-renderable.

```tsx
<ScheduleBoard label={manager.mg.board.label} columns={rooms} rows={slots} chips={bookings}
  now={{ rowId: currentRowId, label: formatTime(nowMinutes) }} />
```

---

## Shared class fragments — `styles.ts`

`HATCH_4` · `HATCH_6` · `DISABLED_CONTROL` · `ARIA_DISABLED_CONTROL` · `TRANSITION_SURFACE` ·
`INSET_RING_ACCENT` · `MEASURE_BODY` (68ch) · `MEASURE_SMALL` (56ch) · `HAIRLINE_GRID`.

Use `HAIRLINE_GRID` for any tile grid you build yourself: 1px `rule`-coloured gaps showing
through, children supply their own background. Never put a border on each tile.

## Marks — `marks.tsx`

`ChevronDown` · `ChevronSide` · `CheckMark` · `BangMark` · `SlashMark`. Inline SVG, 2px strokes,
`currentColor`, `aria-hidden`. **These are the only icons in the product.** No icon font, no
emoji, no illustrations.
