# Lasertopia Booking Platform — Design System

**Direction:** Industrial Arcade
**Scope:** Standalone booking platform (laser tag flow, party flow, manager backend). Not lasertopia.ca.
**Status:** Authoritative. Derived from `BRIEF.md`. Every value here is measured or specified — nothing is left to interpretation.

> **The one-line brief for anyone touching this UI:** near-black canvas, one acid green, hard 1px rules instead of shadows, wide heavy Archivo for words, Martian Mono for every number. Zero rounded corners, anywhere, ever.

---

## 0. Font availability — verified, with one caveat

I checked all three families against the Google Fonts CSS2 API **and** against `packages/font/src/google/font-data.json` in `vercel/next.js@canary`, which is the table `next/font/google` validates against at build time.

| Family | Variable | Axes available | Styles | Latin subset | Verdict |
|---|---|---|---|---|---|
| **Archivo** | Yes | `wdth` 62–125, `wght` 100–900 | normal, italic | yes | Width axis works |
| **Chivo** | Yes | `wght` 100–900 only | normal, italic | yes | **No width axis** |
| **Martian Mono** | Yes | `wdth` 75–112.5, `wght` 100–800 | **normal only** | yes | Width axis works, no italic |

**Caveats you need to know before writing the font file:**

1. **Chivo has no `wdth` axis.** Do not pass `axes: ['wdth']` to Chivo — the build throws `Font 'Chivo' has no definable 'axes'`. Body copy width is fixed at normal. This is fine; body text should not be playing width games anyway.
2. **Martian Mono has no italic.** Never specify `style: 'italic'` on it, and never rely on italic mono in a component.
3. **`axes` only works when `weight` is omitted or `'variable'`.** From `validate-google-font-function-call.ts`: passing a static `weight` alongside `axes` throws *"Axes can only be defined for variable fonts when the weight property is nonexistent or set to `variable`."* Our imports omit `weight` entirely.
4. **You cannot narrow an axis range.** `get-font-axes.ts` always requests the family's full declared `min..max`. Asking for `wdth` on Archivo pulls the whole 62–125 range into the woff2. That is one file, not several — acceptable — but it is why we restrict `subsets` to `['latin']` only.
5. **Never pass `'wght'` in the `axes` array.** It is filtered out of the definable list and will throw. Weight is implicit in a variable font.

**Width is applied at runtime via `font-variation-settings`, not `font-stretch`.** Tailwind v4 lets us bake this into the theme (`--font-*--font-variation-settings`), which is the mechanism we use. The two properties do not compose — `font-variation-settings` always wins — so **the entire codebase must use one mechanism**. We use `font-variation-settings`. If you ever write `font-stretch: 125%` it will silently do nothing.

---

## 1. Design principles

**1. The numbers are the product.**
Every time, price, guest count, capacity and duration is set in Martian Mono with tabular figures, and it is never animated, never abbreviated, never re-flowed. *Rationale: this is a scheduling and capacity tool — a parent is comparing "4 / 25 left" against "14 max" across a dozen slots, and figures that shift width or count up are actively hostile to that comparison.*

**2. Separate with rules, never with shadows.**
Structure comes from 1px hairlines, 1px grid gaps and flat surface steps; the only permitted `box-shadow` is a 0-blur `inset` focus ring. *Rationale: soft drop shadows on cards are the single loudest tell of a generated UI, and on a near-black canvas they do nothing legible anyway.*

**3. State is a shape before it is a colour.**
Every slot state carries a structural marker — a bar style, a hatch, a corner notch, a strikethrough — plus a literal uppercase word. *Rationale: a red "full" tile and an amber "filling" tile are near-identical to a deuteranope, and a parent scanning on a phone in daylight is functionally colour-impaired too.*

**4. Phone is the real product; desktop is the manager's tool.**
The booking flows are designed at 360px and scaled up; only the manager board is designed desktop-first and allowed to require horizontal scroll. *Rationale: parents book parties from a phone, staff run the board from a desk — these are genuinely different products and pretending otherwise compromises both.*

**5. One accent, and it means one thing.**
Acid green is reserved for "this is available to you" and for focus — it is never decoration, never a heading colour, never a background wash except on a selected item. *Rationale: an accent that appears everywhere stops carrying information, and on a schedule board the accent is the fastest possible answer to "where can I book?".*

**6. Say the constraint out loud, in the layout.**
Capacity caps, the 90-minute walk-in cutoff, the 2-year age-matching rule and the $50 deposit policy get their own typographic slot in the component that they constrain, not a tooltip. *Rationale: this venue's rules are genuinely complicated, and a booking that fails validation at step four because a rule was hidden is a phone call to 204-474-5900.*

---

## 2. Colour system

Canvas is a warm-neutral near-black rather than pure `#000` — it reads as ink on press rather than as an unlit screen, and it lets the surface steps be visible without shadows.

### 2.1 Tokens

| Token | Hex | Role |
|---|---|---|
| `--color-canvas` | `#0B0B0A` | Page base. The default background of everything. |
| `--color-sunken` | `#060605` | Wells: input interiors, blocked/full tile bodies. |
| `--color-raised` | `#151613` | Raised surface: cards, order summary, sticky bars. |
| `--color-raised-2` | `#1E201C` | Second step: hover fills, table row hover, chips on cards. |
| `--color-rule` | `#2B2E28` | Decorative hairline. Table rules, grid gaps, card borders. |
| `--color-border` | `#6A6E62` | **Interactive** control boundary — inputs, selects, secondary buttons. |
| `--color-text` | `#F2F3EC` | Primary text. Off-white, slightly warm. |
| `--color-text-2` | `#A6A99D` | Secondary text, labels, helper copy. |
| `--color-text-3` | `#8E9284` | Tertiary, disabled text, blocked-slot labels. |
| `--color-accent` | `#C7F73C` | Acid green. Available, selected, focus, primary action. |
| `--color-accent-press` | `#A9D62F` | Primary button hover/active fill. |
| `--color-accent-dim` | `#8FB32A` | Accent at rest on dense surfaces (board bars, meters). |
| `--color-accent-wash` | `#222710` | Accent @ 12% composited on canvas. Selected-row fill. **Flat, precomputed — not an alpha layer, not a blur.** |
| `--color-ink` | `#0B0B0A` | Text on any filled accent/semantic chip. |
| `--color-hatch` | `#1E1F1C` | Hatch stripe colour for blocked/full/disabled. |

### 2.2 Semantic slot states

| State | Token | Hex | Structural marker (mandatory, not optional) |
|---|---|---|---|
| Available | `--color-state-open` | `#C7F73C` | **Solid** 3px top bar + word `OPEN` |
| Filling up | `--color-state-filling` | `#FFA300` | **Dashed** 3px top bar (4 dashes) + word `FILLING` |
| Full | `--color-state-full` | `#FF5A2B` | 45° hatch @ 4px pitch + 1px strikethrough on the time + word `FULL` |
| Party held | `--color-state-party` | `#FF3EA5` | 12px triangular corner notch, top-right + word `PARTY HOLD` |
| Blocked | `--color-state-blocked` | `#8E9284` | 45° hatch @ 6px pitch + strikethrough + word `BLOCKED` |
| *(Too soon — 90-min cutoff)* | `--color-state-blocked` | `#8E9284` | Same as blocked, word `TOO SOON`, caption `Walk-in window` |

The last row is not in the original five but is a real state from the brief ("cannot book 90 minutes before the start time"). It reuses the blocked treatment so no new colour is introduced.

Note the deliberate collision: **available and the accent are the same green.** That is the system, not an accident — the accent means "you can have this."

### 2.3 Measured contrast — WCAG 2.1

All ratios computed with the WCAG relative-luminance formula. Body threshold 4.5:1, large text 3:1, non-text UI 3:1 (SC 1.4.11).

**Text on backgrounds — every pair clears 4.5:1, so all of it passes at the body bar, not just the large-text bar.**

| Foreground | canvas `#0B0B0A` | raised `#151613` | raised-2 `#1E201C` | sunken `#060605` |
|---|---|---|---|---|
| `--color-text` `#F2F3EC` | **17.63:1** | **16.27:1** | **14.71:1** | **18.15:1** |
| `--color-text-2` `#A6A99D` | **8.24:1** | **7.60:1** | **6.87:1** | **8.48:1** |
| `--color-text-3` `#8E9284` | **6.18:1** | **5.70:1** | **5.16:1** | **6.37:1** |
| `--color-accent` `#C7F73C` | **15.75:1** | **14.53:1** | — | **16.21:1** |
| `--color-accent-dim` `#8FB32A` | **8.11:1** | **7.48:1** | — | — |
| state-filling `#FFA300` | **9.84:1** | **9.07:1** | — | — |
| state-full `#FF5A2B` | **6.33:1** | **5.84:1** | — | — |
| state-party `#FF3EA5` | **6.08:1** | **5.61:1** | — | — |
| state-blocked `#8E9284` | **6.18:1** | **5.70:1** | — | — |

**Ink on filled chips and buttons (`--color-ink` `#0B0B0A`):**

| Fill | Ratio |
|---|---|
| accent `#C7F73C` | **15.75:1** |
| accent-press `#A9D62F` | **11.58:1** |
| filling `#FFA300` | **9.84:1** |
| full `#FF5A2B` | **6.33:1** |
| party `#FF3EA5` | **6.08:1** |

**On the accent wash `#222710`:** primary text **13.77:1**, accent text **12.30:1**, secondary text **6.43:1**.

**Non-text UI contrast (SC 1.4.11, needs 3:1):**

| Element | vs canvas | vs raised | vs raised-2 |
|---|---|---|---|
| `--color-border` `#6A6E62` (input/control boundary) | **3.77:1** | **3.48:1** | **3.14:1** |
| `--color-accent` focus ring | **15.75:1** | **14.53:1** | — |

**`--color-rule` `#2B2E28` measures 1.43:1 against canvas and is deliberately below 3:1.** It is permitted **only** for decorative separation — table rules, grid gaps, card edges. It must never be the sole boundary of an interactive control. Interactive boundaries use `--color-border`. This distinction is the most common way this system gets broken; enforce it in review.

**Hatch stripe `#1E1F1C`** keeps `--color-text-3` at **5.20:1** when a label lands directly on a stripe, so hatched tiles stay readable without a backing plate.

---

## 3. Typography scale

### 3.1 The `next/font` imports

```ts
// app/fonts.ts
import { Archivo, Chivo, Martian_Mono } from 'next/font/google'

// Display. wght is implicit in a variable font — never list it in `axes`.
export const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],                 // 62..125, full range is always fetched
  style: ['normal'],              // italic doubles the payload; we don't use it
  display: 'swap',
  variable: '--font-archivo',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
})

// Body. Chivo has NO wdth axis — passing `axes` here throws at build time.
export const chivo = Chivo({
  subsets: ['latin'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-chivo',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
})

// Numerals. No italic exists for this family.
export const martianMono = Martian_Mono({
  subsets: ['latin'],
  axes: ['wdth'],                 // 75..112.5
  display: 'swap',
  variable: '--font-martian-mono',
  fallback: ['Menlo', 'Consolas', 'monospace'],
})
```

```tsx
// app/layout.tsx
<html
  lang="en"
  className={`${archivo.variable} ${chivo.variable} ${martianMono.variable}`}
>
```

`weight` is omitted everywhere, which makes each font variable and legalises `axes`. `preload` defaults to `true` and is valid because `subsets` is specified.

### 3.2 Width strategy

Martian Mono ships **very** wide at its default `wdth 100` — wide enough that a 5-column capacity table will not fit a 360px phone. **Every mono step in this system runs at `wdth 75`** (the axis minimum) with negative tracking to pull it in further. `wdth 100` is reserved for the single largest numeral on a screen (a grand total) where the width is the point.

Archivo runs at `wdth 100` for all working type and `wdth 125` (the axis maximum, "expanded") for hero display only — that expanded cut is what gives the scoreboard character, and it stops being legible below about 28px.

### 3.3 Display — Archivo

| Step | Size | Weight | wdth | Line-height | Tracking | Case | Used for |
|---|---|---|---|---|---|---|---|
| `display-1` | 2.5rem / 40px **(phone)**<br>3.5rem / 56px (≥768) | 800 | 125 | 0.92 | −0.03em | Sentence | Flow entry screen headline, one per page max |
| `display-2` | 2rem / 32px<br>2.5rem / 40px (≥768) | 800 | 112.5 | 0.95 | −0.025em | Sentence | Step headings ("Pick a time") |
| `display-3` | 1.5rem / 24px | 700 | 100 | 1.05 | −0.02em | Sentence | Card titles, party package names |
| `heading` | 1.125rem / 18px | 700 | 100 | 1.2 | −0.01em | Sentence | Sub-sections, party-window room names |
| `eyebrow` | 0.75rem / 12px | 700 | 100 | 1 | **+0.14em** | UPPER | Section labels, order-summary header, table headers |
| `label` | 0.75rem / 12px | 700 | 100 | 1 | +0.12em | UPPER | Form field labels |
| `button` | 0.875rem / 14px | 700 | 100 | 1 | +0.06em | UPPER | All button text |
| `tag` | 0.6875rem / 11px | 700 | 100 | 1 | +0.1em | UPPER | Slot state words, chips, badges |

### 3.4 Body — Chivo

| Step | Size | Weight | Line-height | Tracking | Used for |
|---|---|---|---|---|---|
| `body-lg` | 1.125rem / 18px | 400 | 1.55 | 0 | Flow intro paragraphs |
| `body` | 1rem / 16px | 400 | 1.6 | +0.005em | Default. Input values, package descriptions |
| `body-sm` | 0.875rem / 14px | 400 | 1.5 | +0.01em | Helper text, add-on descriptions, list items |
| `caption` | 0.75rem / 12px | 500 | 1.4 | +0.02em | Policy notes, capacity hints, validation text |

Measure is capped at **68 characters** for `body-lg`/`body` and **56 characters** for `body-sm`/`caption`.

### 3.5 Numerals — Martian Mono

Every step carries `font-variant-numeric: tabular-nums lining-nums`. Martian Mono is monospaced so figures are already fixed-advance; the declaration is belt-and-braces against a fallback font rendering during swap, which is exactly when a table would jump.

| Step | Size | Weight | wdth | Line-height | Tracking | Used for |
|---|---|---|---|---|---|---|
| `mono-xl` | 2rem / 32px | 600 | **100** | 1 | −0.04em | Grand total only. One per screen. |
| `mono-lg` | 1.25rem / 20px | 600 | 75 | 1 | −0.03em | Slot tile time, party window time, stepper value |
| `mono-md` | 1rem / 16px | 500 | 75 | 1.2 | −0.03em | Line-item amounts, date-picker day number |
| `mono-sm` | 0.8125rem / 13px | 500 | 75 | 1.3 | −0.02em | Board cells, capacity counts, table figures |
| `mono-xs` | 0.6875rem / 11px | 600 | 75 | 1 | 0 | Count badges, game-time chips |

**Do not rely on a slashed zero.** Martian Mono's default zero form has not been verified for this project. If a slashed zero is wanted, confirm the `zero` feature exists in the shipped woff2 before adding `font-feature-settings: 'zero' 1` — and never let 0/O disambiguation carry meaning that isn't also carried by context.

**Optical sizing note:** Martian Mono has a large x-height and reads roughly one step bigger than Chivo at the same px value. When mono sits inline inside a Chivo sentence, set it to `0.92em`.

---

## 4. Spacing, grid, and layout

### 4.1 Spacing scale

Base unit **4px**. Tailwind v4 generates the full ramp from a single `--spacing: 0.25rem`.

| Token | px | Typical use |
|---|---|---|
| `1` | 4 | Icon-to-label, chip inner padding |
| `2` | 8 | Label-to-field, tight stacks |
| `3` | 12 | Tile inner padding, chip padding-x |
| `4` | 16 | Default gutter, card padding (phone) |
| `5` | 20 | Button padding-x |
| `6` | 24 | Card padding (≥768), stack between fields |
| `8` | 32 | Between form groups |
| `10` | 40 | — |
| `12` | 48 | Between flow sections |
| `16` | 64 | Section top padding (phone) |
| `20` | 80 | — |
| `24` | 96 | Section top padding (≥1024) |
| `32` | 128 | Page top/bottom on desktop |

**Hairline gaps are 1px and are not on this scale.** Grid gaps used to draw rules are always exactly `1px`.

### 4.2 Breakpoints

| Name | Min-width | Target |
|---|---|---|
| *(base)* | 0 | Phone, designed at **360px** |
| `sm` | 480px | Large phone / small tablet portrait |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop — order summary becomes a rail |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Manager board, wide |

### 4.3 Containers and gutters

| Token | Width | Use |
|---|---|---|
| `--container-flow` | 34rem / 544px | Booking flow single column |
| `--container-rail` | 20rem / 320px | Order summary rail (≥1024) |
| `--container-page` | 71.5rem / 1144px | Page shell, header, footer |
| `--container-board` | 100% | Manager board, full bleed, min content width 960px |

Page gutters: **16px** base · **24px** at `md` · **32px** at `lg` and up.

### 4.4 The hairline grid technique

Instead of borders on each tile (which double up and misalign), tile grids use a rule-coloured background showing through 1px gaps:

```
container { display: grid; gap: 1px; background: var(--color-rule); border: 1px solid var(--color-rule); }
tile      { background: var(--color-canvas); }
```

This produces perfect single-width rules with no collapsing, and it is the default for the slot grid, the date grid, and the manager board.

### 4.5 Schedule board grid (customer, dense time layout)

Games run every 15 minutes across a 7–10 hour day, so a day is 28–40 tiles. Tiles, not a list.

| Breakpoint | Columns | Tile min-height |
|---|---|---|
| base (360px) | **2** | 76px |
| `sm` 480px | 3 | 76px |
| `md` 768px | 4 | 84px |
| `lg` 1024px | 6 | 84px |
| `xl` 1280px | 8 | 84px |

Tiles are grouped under sticky hour headers (`eyebrow`, 32px tall, `--color-canvas` background, 1px bottom rule) so a 40-tile day stays scannable. Grid gap 1px on `--color-rule`.

### 4.6 Manager schedule board grid (desktop-first)

```
grid-template-columns: 96px repeat(var(--room-count), minmax(160px, 1fr));
```

- Time gutter **96px**, `position: sticky; left: 0`, `background: var(--color-canvas)`, 1px right rule in `--color-border`.
- Header row **56px**, `position: sticky; top: 0`, room name + capacity.
- Body row **44px** = one 15-minute game slot.
- Rows on the hour take a `--color-border` top rule; rows on the quarter take `--color-rule`. This is how a manager finds 5:15 without counting.
- Below 960px the board scrolls horizontally with the time gutter pinned.
- **Below `md` (768px) the board is not a grid at all** — it collapses to a single-column agenda grouped by 2-hour party window, rows 64px. A manager on a phone is checking today, not editing the week.

### 4.7 Booking flow layout (focused single column)

- **Base → `md`:** one column, `--container-flow`, gutters as above. Order summary is a sticky bottom bar, **72px** tall, `--color-raised`, 1px top rule in `--color-border`, containing the total (`mono-md`) and the primary CTA. It expands upward into a sheet on tap.
- **`lg` and up:** two columns.
  ```
  grid-template-columns: minmax(0, 34rem) 20rem;
  gap: 48px;
  ```
  Summary becomes a rail, `position: sticky; top: 24px`. Bottom bar is removed.
- Step indicator: a full-width row of segments, 4px tall, 1px gap, above the heading. Complete = `--color-accent`, current = `--color-accent` with the segment 6px tall, upcoming = `--color-rule`. Paired with a `mono-xs` "STEP 2 / 4" label — the bar alone never carries the state.
- Vertical rhythm: 48px between sections, 24px between fields, 8px label-to-field.

---

## 5. Component specs

Global rules for everything in this section:

- **`border-radius: 0`.** No exceptions.
- **Minimum touch target 44×44px.** Primary CTAs on phone are 48px.
- **Focus:** `outline: 2px solid var(--color-accent); outline-offset: 2px;` **plus** `box-shadow: inset 0 0 0 2px var(--color-accent);`. Two independent geometric changes — an outer ring that displaces and an inner ring that thickens the edge — so focus survives greyscale, and `outline` survives Windows High Contrast Mode. Applied on `:focus-visible`. Under `forced-colors: active`, `outline-color: Highlight`.
- **The only legal `box-shadow` is `inset` with 0 blur.** Any blurred or offset shadow is a bug.
- **Disabled** is never communicated by opacity alone: `--color-text-3` text (still ≥5.1:1), border drops to `--color-rule`, a 45° hatch overlay at 6px pitch, and `cursor: not-allowed`.

---

### 5.1 Buttons

```
PRIMARY (48px phone / 44px desktop)
┌──────────────────────────────────────┐   fill  #C7F73C
│                                      │   text  #0B0B0A  15.75:1
│          C O N T I N U E             │   type  Archivo 700 14px +0.06em UPPER
│                                      │   pad   0 20px
└──────────────────────────────────────┘   border 1px solid #C7F73C

SECONDARY (44px)
┌──────────────────────────────────────┐   fill  transparent
│            G O   B A C K             │   text  #F2F3EC  17.63:1
└──────────────────────────────────────┘   border 1px solid #6A6E62  3.77:1

GHOST (44px, no border, padding-x 8px)
   E d i t   d e t a i l s                 text  #A6A99D  8.24:1
   ─────────────────                       hover: 1px underline, offset 4px

FOCUS (all variants)
╔══════════════════════════════════════╗   outline 2px #C7F73C, offset 2px
║┌────────────────────────────────────┐║   inset   2px #C7F73C
║│         C O N T I N U E            │║
║└────────────────────────────────────┘║
╚══════════════════════════════════════╝

DISABLED
┌╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱┐   fill  transparent + 45° hatch 6px
│╱╱╱╱╱╱╱ C O N T I N U E ╱╱╱╱╱╱╱╱╱╱╱╱╱╱│   text  #8E9284  6.18:1
└╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱┘   border 1px solid #2B2E28
```

| Variant | Height | Padding-x | Rest | Hover | Active | Disabled |
|---|---|---|---|---|---|---|
| Primary | 48 / 44 | 20px | fill `#C7F73C`, ink text | fill `#A9D62F` | fill `#A9D62F` + `translateY(1px)` | hatch, no fill |
| Secondary | 44 | 16px | 1px `#6A6E62` | bg `#151613`, border `#C7F73C` | bg `#1E201C` + `translateY(1px)` | hatch |
| Ghost | 44 | 8px | text `#A6A99D` | text `#F2F3EC` + underline | `translateY(1px)` | text `#8E9284` |
| Compact (manager) | 36 | 12px | as secondary, `tag` type | — | — | — |

Primary buttons are full-width below `md`. There is never more than one primary button on a screen.

---

### 5.2 Text input

```
G U E S T   N A M E                        label   Archivo 700 12px +0.12em UPPER #A6A99D
                                           gap     8px
┌──────────────────────────────────────┐   height  48px (44 desktop)
│ Sam Cheway                           │   fill    #060605
└──────────────────────────────────────┘   border  1px solid #6A6E62   3.77:1
As it should appear on the invitation.     value   Chivo 400 16px #F2F3EC  18.15:1
                                           pad-x   14px
                                           helper  Chivo 500 12px #8E9284  6.37:1, mt 6px
```

| State | Treatment |
|---|---|
| Rest | border 1px `#6A6E62`, fill `#060605` |
| Hover | border `#8E9284` |
| Focus | outline 2px `#C7F73C` offset 2px + inset 2px ring |
| Filled | unchanged — no colour change on filled, it is noise |
| Error | `border-color: #FF5A2B`, `border-left-width: 3px`, plus the message block in §5.10 |
| Disabled | fill `#0B0B0A`, border `#2B2E28`, text `#8E9284`, 6px hatch |

`font-size` is never below 16px on inputs — iOS zooms the viewport below that.

---

### 5.3 Select

```
┌────────────────────────────────┬─────┐   height 48px, fill #060605
│ The Great Adventure — $259.50  │  ▾  │   border 1px solid #6A6E62
└────────────────────────────────┴─────┘   divider 1px #6A6E62, full height
                                           zone    40px wide
                                           chevron CSS-drawn, 10×6px, 2px strokes,
                                                   #A6A99D — never an emoji, never a font glyph
```

`appearance: none`. Value type: Chivo 400 16px; any price inside the value renders in Martian Mono `mono-md`. Options list uses the native control on phone (correct, accessible, and free) and a custom listbox only on the manager board, where rows are 36px with a 1px bottom rule and the highlighted row uses `--color-raised-2` **plus** a 3px accent left bar.

---

### 5.4 Stepper (guest count)

```
G U E S T S
┌────────┬──────────────┬────────┐          total height 48px
│   ─    │      12      │   +    │          minus/plus 48×48
└────────┴──────────────┴────────┘          value cell 72px, 1px side rules #6A6E62
Max 14 in this room. Over 14 books           value  Martian Mono 600 20px wdth 75, tabular
two time slots (up to 20).                   hint   Chivo 500 12px #8E9284

AT UPPER BOUND
┌────────┬──────────────┬╱╱╱╱╱╱╱╱┐          + disabled: hatch 6px, text #8E9284,
│   ─    │      14      │╱╱╱ + ╱╱│          aria-disabled, cursor not-allowed
└────────┴──────────────┴╱╱╱╱╱╱╱╱┘
```

- Outer border 1px `#6A6E62`; internal rules 1px `#6A6E62`.
- **The number never animates.** No slide, no fade, no roll.
- `aria-live="polite"` region announces `Guests: 12`.
- The value is also an `<input type="number">` so it is directly editable and keyboard-accessible; the visible glyphs are `−` (U+2212) and `+`, drawn as text, not icons.
- The capacity hint is a live constraint from the brief and changes with the selected room/slot — it is part of the component, not a footnote.

---

### 5.5 Date picker

Phone-first: a horizontally scrolling week strip, with a month grid behind a toggle.

```
A U G U S T   2 0 2 6                        [ M O N T H   V I E W ]

┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐   scroll-snap-type: x mandatory
│ MON  │ TUE  │ WED  │ THU  │ FRI  │ SAT  │ SUN  │   tile 56×72, gap 1px on #2B2E28
│      │      │      │      │      │      │      │   weekday Archivo 700 11px +0.1em
│  10  │  11  │  12  │  13  │  14  │  15  │  16  │   day     Martian Mono 600 20px wdth 75
│      │      │      │      │      │      │      │
│▓▓▓▓▓▓│▓▓▓▓▓▓│░░░░░░│▓▓▓▓▓▓│▓▓▓▓▓▓│▒▒▒▒▒▒│▓▓▓▓▓▓│   4px status bar, bottom edge
└──────┴──────┴──────┴──────┴──────┴──────┴──────┘
  ▓ #C7F73C open   ▒ #FFA300 few left   ░ #2B2E28 none

SELECTED (13)          TODAY (11)
┌──────┐               ┌──────┐
│▀▀▀▀▀▀│ 3px top bar   │ TUE  │
│ THU  │ #0B0B0A on    │      │
│  13  │ #C7F73C fill  │  11  │
│      │ day → 700     │ ‥‥‥‥ │ 1px dotted underline under the number
└──────┘               └──────┘
```

- Selected carries **three** cues: accent fill, a 3px top bar, and `aria-selected="true"`.
- Month grid: 7 columns, cells **44×44** minimum, 1px gap on `--color-rule`, same status bar at 3px.
- Unavailable dates: `--color-text-3`, 6px hatch, strikethrough, `aria-disabled="true"`.
- Keyboard: arrows move by day, `PageUp`/`PageDown` by month, `Home`/`End` to week bounds. Roving `tabindex`; the grid is one tab stop.
- Weekend mornings (10am–12pm) are party-only per the brief — in the laser tag flow those dates still show as open, but the strip status bar reflects only publicly bookable games.

---

### 5.6 Time-slot tile — five states

Base geometry: min-height **76px** (84px ≥`md`), padding **12px**, background `--color-canvas`, no border (the 1px grid gap is the border). Time `mono-lg`. State word `tag`. Count `mono-xs`.

```
1 — AVAILABLE                    2 — FILLING UP
┌────────────────────┐           ┌────────────────────┐
│████████████████████│ 3px solid │██  ██  ██  ██  ████│ 3px DASHED (4 dashes)
│                    │ #C7F73C   │                    │ #FFA300
│ 5:15 PM            │ #F2F3EC   │ 5:30 PM            │ #F2F3EC
│ OPEN               │ #C7F73C   │ FILLING            │ #FFA300
│ 18 / 25 SPOTS      │ #A6A99D   │ 4 / 25 LEFT        │ #FFA300
└────────────────────┘           └────────────────────┘

3 — FULL                         4 — PARTY HELD
┌────────────────────┐           ┌────────────────────┐
│████████████████████│ #FF5A2B   │████████████████████│ #FF3EA5
│╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱│ hatch 4px │                  ◣ │ 12px corner notch
│╱5̶:̶4̶5̶ ̶P̶M̶╱╱╱╱╱╱╱╱╱╱╱│ struck    │ 6:15 PM            │ #F2F3EC
│╱FULL╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱│ #FF5A2B   │ PARTY HOLD         │ #FF3EA5
│╱0 / 25 SPOTS╱╱╱╱╱╱╱│ #8E9284   │ RESERVED           │ #A6A99D
└────────────────────┘           └────────────────────┘
  fill #060605                     fill #151613

5 — BLOCKED                      (5b) — TOO SOON (90-min rule)
┌────────────────────┐           ┌────────────────────┐
│████████████████████│ #8E9284   │████████████████████│ #8E9284
│╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱│ hatch 6px │╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱│ hatch 6px
│╱6̶:̶4̶5̶ ̶P̶M̶╱╱╱╱╱╱╱╱╱╱╱│ struck    │╱1̶2̶:̶1̶5̶ ̶P̶M̶╱╱╱╱╱╱╱╱╱│ struck
│╱BLOCKED╱╱╱╱╱╱╱╱╱╱╱╱│ #8E9284   │╱TOO SOON╱╱╱╱╱╱╱╱╱╱╱│ #8E9284
│╱Maintenance╱╱╱╱╱╱╱╱│ #8E9284   │╱Walk-in window╱╱╱╱╱│ #8E9284
└────────────────────┘           └────────────────────┘

SELECTED (overlay on state 1)    FOCUS (any interactive state)
┌════════════════════┐           ╔════════════════════╗ outline 2px #C7F73C
║████████████████ ▄▄ ║ 2px border║┌──────────────────┐║ offset 2px
║ 5:15 PM        ▐✔▌ ║ #C7F73C   ║│████████████████  │║ + inset 2px ring
║ SELECTED           ║ fill      ║│ 5:15 PM          │║
║ 18 / 25 SPOTS      ║ #222710   ║│ OPEN             │║
└════════════════════┘           ╚════════════════════╝
  16px accent square, ink ✔, top-right
```

| State | Interactive | ARIA | Hover | Active |
|---|---|---|---|---|
| Available | yes | `aria-pressed="false"` | bg `#151613` | bg `#1E201C` |
| Filling up | yes | `aria-pressed="false"` | bg `#151613` | bg `#1E201C` |
| Full | no | `aria-disabled="true"` | none | none |
| Party held | no | `aria-disabled="true"` | none | none |
| Blocked / Too soon | no | `aria-disabled="true"` | none | none |
| Selected | yes | `aria-pressed="true"` | bg `#2D3513` | — |

Hover never changes the state colour — only the surface step — so hover can never be mistaken for a state change. Every tile's accessible name includes the state word: *"5:45 PM, full, 0 of 25 spots"*.

---

### 5.7 Party-window card

Represents one 2-hour party window with its bays, capacities, age-matching constraint and reserved game times.

```
┌────────────────────────────────────────────────────────┐  bg #151613
│ 5:00 PM – 7:00 PM                        [ 1 BAY OPEN ]│  border 1px #2B2E28
│ Monday · 2 hours                                       │  pad 16px (24 ≥md)
├────────────────────────────────────────────────────────┤  1px rule #2B2E28
│ ▌ARENA ROOM              10 / 14        AGES 7–9       │  56px row
│ ▌                                       PARTY HOLD     │  3px left bar #FF3EA5
├────────────────────────────────────────────────────────┤
│ ▌LAUNCH ROOM              0 / 12        OPEN           │  3px left bar #C7F73C
│ ▌                                                      │
├────────────────────────────────────────────────────────┤
│ Your group must be within 2 years of age 8.            │  caption #A6A99D
│                                                        │
│ G A M E S     ┌───────┐┌───────┐                       │  eyebrow
│               │ 5:15  ││ 5:30  │                       │  mono-xs chips,
│               └───────┘└───────┘                       │  1px #2B2E28, 24px tall
└────────────────────────────────────────────────────────┘
```

- Window time `mono-lg`; day/duration `caption` `#A6A99D`.
- Status chip top-right: `tag` type, 24px tall, 1px border, padding-x 8px. `1 BAY OPEN` accent · `FULL` full-colour + hatch · `2 BAYS OPEN` accent.
- Bay rows: 3px left bar in the bay's state colour + room name `heading` uppercase + capacity `mono-sm` + state word `tag`. Grid `3px 1fr 72px 96px`, collapsing to two lines below `sm`.
- The age-compatibility line appears **only** when a bay is held, and states the actual constraint with the actual number. When the user's guest-of-honour age is known and incompatible, it becomes a validation message (§5.10) and the card's bays go `aria-disabled`.
- Over-14 groups: an extra caption row — *"Over 14 guests books two windows (up to 20)."*
- Card is a `<section>` with an accessible name of the window time. It is not itself clickable; the bay rows are.

---

### 5.8 Add-on toggle row

```
┌────────────────────────────────────────────────────────┐
│ ┌───┐                                                  │  min-height 72px
│ │ ✔ │  QBIX 5D                                  $3.95  │  1px bottom rule #2B2E28
│ └───┘  Immersive 5D ride, up to 5 friends.   per person│  grid 24px 1fr auto, gap 12px
│                                                        │
│        ┌────────┬──────────┬────────┐                  │  qty stepper appears only
│        │   ─    │    12    │   +    │                  │  when checked, 40px tall
│        └────────┴──────────┴────────┘                  │
└────────────────────────────────────────────────────────┘

CHECKBOX          unchecked          checked
                  ┌───┐              ┌───┐   fill   #C7F73C
                  │   │  24×24       │ ✔ │   border 1px #C7F73C
                  └───┘  1px #6A6E62 └───┘   check  2px strokes, #0B0B0A, CSS-drawn
                         fill #060605
```

- The whole row is a `<label>`; tap target is the full 72px row.
- Name `body` 16px `#F2F3EC`; description `body-sm` `#A6A99D`; price `mono-md` right-aligned; unit (`per person`, `each`) `caption` `#8E9284` beneath the price.
- Checked row: background `#151613` and a 3px accent left bar. Two cues, not one.
- Focus: outline on the row, not the box, so the hit area and the focus ring agree.
- Unavailable add-ons (e.g. the 5-Up Arcade Card on *Around The World*) render disabled with hatch and a caption naming the reason — never hidden, because a parent comparing packages needs to see what they'd be giving up.
- Quantity rows (pizza, wings) reuse §5.4 at 40px height and show a derived line — *"3 included, 1 extra"* — in `caption`.

---

### 5.9 Order summary panel

```
┌────────────────────────────────────────────┐  bg #151613, border 1px #2B2E28
│ O R D E R                                  │  eyebrow, pad 16px
├────────────────────────────────────────────┤  1px rule #2B2E28
│ The Great Adventure          10     259.50 │  32px rows
│ Extra guests                  2      51.90 │  grid 1fr 48px 88px
│ QBIX 5D                      12      47.40 │  desc Chivo 13px #F2F3EC
│ Large 1 Topping              1       24.63 │  qty + amount mono-sm, right
├────────────────────────────────────────────┤
│ Subtotal                            383.43 │  #A6A99D
│ GST + PST                            56.36 │  #A6A99D
├────────────────────────────────────────────┤  1px rule #6A6E62
│ T O T A L                           439.79 │  label Archivo 700 14px UPPER
│                                            │  amount mono-xl 32px wdth 100
├────────────────────────────────────────────┤
│▌ DUE TODAY                           50.00 │  3px left bar #C7F73C
│▌ Non-refundable deposit. Change or cancel  │  bg #222710
│▌ 14+ days out and it becomes a gift card.  │  caption #F2F3EC on #222710 (13.77:1)
└────────────────────────────────────────────┘

PHONE — collapsed sticky bar
┌────────────────────────────────────────────┐  72px, bg #151613
│ TOTAL  439.79                              │  1px top rule #6A6E62
│ Due today 50.00        [ C O N T I N U E ] │  expands upward to a sheet
└────────────────────────────────────────────┘
```

- Amounts are right-aligned in a fixed 88px column so decimal points line up down the panel. This is the whole reason the mono face exists.
- Currency symbol is omitted in line items and shown once in the header context (`CAD`) — it costs 8px per row and adds nothing.
- The deposit block is mandatory on every screen where the summary appears. The 14-day policy is a real financial term and gets permanent typographic space.
- Empty summary: *"Nothing selected yet."* in `body-sm` `#8E9284`, panel keeps its full height so the layout does not jump when the first item is added.

---

### 5.10 Form validation message

```
ERROR
┌──────────────────────────────────────┐
│ Sam                                  │  input: border #FF5A2B, border-left 3px
└──────────────────────────────────────┘
┌─┐
│!│ Enter a last name so we can print     marker 16×16, 2px border #FF5A2B,
└─┘ the invitation.                       "!" 2px CSS stroke — not an emoji
    ↑ 8px gap                             text Chivo 500 13px #FF5A2B  6.33:1
                                          role="alert", aria-describedby on input

SUCCESS / CONFIRMATION
┌─┐
│✔│ Ages 7 and 9 — within 2 years. Both   marker 16×16, 2px border #C7F73C,
└─┘ parties can share this window.        check 2px CSS strokes
                                          text Chivo 500 13px #C7F73C  15.75:1

WARNING (non-blocking)
┌─┐
│!│ Only 4 spots left at this time.       marker 2px border #FFA300
└─┘                                       text #FFA300  9.84:1
```

- Every message pairs a **distinct marker shape** (square-bang, square-check) with **explicit words**. Colour is the third cue, never the first.
- Errors are announced via `role="alert"`; warnings via `aria-live="polite"`.
- Form-level errors sit above the submit button in a bordered block (1px `#FF5A2B`, 3px left bar, padding 12px) listing each failure as a link to its field.
- Messages name the fix, not just the fault — *"Enter a last name so we can print the invitation"*, never *"Invalid input"*.
- Validation fires on blur and on submit, never on keystroke.

---

### 5.11 Empty state

Left-aligned. A centred empty state with a big friendly icon is the most recognisable generated-UI pattern there is.

```
┌────────────────────────────────────────────────────────┐  1px #2B2E28
│                                                        │  pad 32px 24px
│  ┌────────┐                                            │  64×64, 1px #6A6E62,
│  │ ╲      │                                            │  2px diagonal slash
│  │   ╲    │                                            │  #6A6E62 — CSS-drawn
│  │     ╲  │                                            │
│  └────────┘                                            │
│                          ← 24px                        │
│  No games on this date.                                │  display-3 24px #F2F3EC
│                          ← 8px                         │
│  Sunday doors open at 12:00 PM and the 10:00 AM–      │  body-sm #A6A99D, max 56ch
│  12:00 PM window is reserved for parties. Try another │
│  date, or call 204-474-5900.                          │
│                          ← 24px                        │
│  [ P I C K   A N O T H E R   D A T E ]                 │  secondary button
│                                                        │
└────────────────────────────────────────────────────────┘
```

Every empty state states **why** it is empty in the venue's real terms and offers exactly one next action. No illustrations, no mascots, no emoji.

---

### 5.12 Manager schedule board row

```
        │ ARENA ROOM       │ LAUNCH ROOM      │ ARCADE BAY       │  header 56px, sticky top
        │ max 14           │ max 12           │ max 18           │  eyebrow + mono-xs
════════╪══════════════════╪══════════════════╪══════════════════╡  1px #6A6E62 (hour)
5:00 PM │▌Cheway · 10      │▌Nguyen · 8       │                  │  row 44px
────────┼──────────────────┼──────────────────┼──────────────────┤  1px #2B2E28 (quarter)
5:15 PM │▌                 │▌                 │╱╱╱╱ BLOCKED ╱╱╱╱╱│
────────┼──────────────────┼──────────────────┼──────────────────┤
5:30 PM │▌                 │▌                 │╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱│
━━━━━━━━┿━━━━━━━━━━━━━━━━━━┿━━━━━━━━━━━━━━━━━━┿━━━━━━━━━━━━━━━━━━┥  ← NOW: 2px #C7F73C
[5:38PM]│                  │                  │                  │    + mono-xs chip, left
────────┼──────────────────┼──────────────────┼──────────────────┤
5:45 PM │▌                 │                  │                  │
════════╪══════════════════╪══════════════════╪══════════════════╡  1px #6A6E62 (hour)
6:00 PM │                  │▌Okoye · 14       │                  │
```

- **Time gutter** 96px, sticky left, `mono-sm` right-aligned, padding-right 12px, 1px right rule `#6A6E62`.
- **Row height 44px**; hour boundaries take a `#6A6E62` rule, quarters take `#2B2E28`.
- **Booking chip:** 36px tall, bg `#151613`, 1px border in the state colour, 3px left bar in the state colour, `▌` above. Name `body-sm` truncated with ellipsis; guest count `mono-xs`. A chip spanning multiple games uses `grid-row: span N` and draws the bar down its full height — a 2-hour party reads as one continuous object.
- **Now line:** 2px `#C7F73C` across the full board with a `mono-xs` time chip pinned in the gutter. Updates every 60s, and it is the only element on the board permitted to move.
- **Row hover:** background `#151613` across the row including the sticky gutter.
- **Row focus-within:** inset 2px `#C7F73C` ring on the row.
- **Chip states** reuse §2.2 exactly: confirmed = accent, filling = amber, full = full-colour, party hold = magenta, blocked = grey + 6px hatch.
- Every chip is a button with an accessible name of *"5:00 PM, Arena Room, Cheway, 10 guests, confirmed"*. The visual grid is backed by a `role="grid"` with proper row/column semantics — the board must be operable without a mouse, because it is the tool staff use most.

---

## 6. Motion

This direction earns its character from typography and structure. Motion's entire job here is to confirm that a tap registered and to show where a panel came from.

### 6.1 Durations and easing

| Token | Value | Applied to |
|---|---|---|
| `--duration-instant` | **90ms** | Button press, checkbox check, tile press |
| `--duration-fast` | **140ms** | Hover surface steps, tab underline wipe, chip state change |
| `--duration-base` | **200ms** | Sheet / drawer / disclosure open and close |
| `--duration-slow` | **260ms** | Step transitions between flow screens. **Hard ceiling — nothing is slower.** |

| Token | Curve | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | Entrances, anything arriving |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exits |
| `--ease-linear` | `linear` | Rule and underline wipes — a wipe should read mechanical |

### 6.2 What moves

| Element | Movement | Duration |
|---|---|---|
| Button / tile press | `translateY(1px)` | 90ms |
| Checkbox check | check strokes draw via `clip-path`, no scaling | 90ms |
| Tab / step underline | `scaleX(0 → 1)`, `transform-origin: left` | 140ms linear |
| Surface hover | `background-color` only | 140ms |
| Bottom sheet | `translateY(100% → 0)` | 200ms ease-out |
| Disclosure | `grid-template-rows: 0fr → 1fr` | 200ms ease-out |
| Flow step change | opacity `0 → 1` + `translateY(8px → 0)` | 260ms ease-out |
| Now line (board) | position recalculated every 60s, no tween | — |

**Maximum travel for any element other than a sheet is 8px.**

### 6.3 What never moves

- **Numbers.** No count-ups, no odometers, no ticking totals. A price that animates is a price you cannot read.
- **Slot tiles on load.** No staggered reveal, no cascade. Thirty tiles appearing one by one is both slow and an instant tell.
- **Skeleton shimmer.** Loading is a static 6px hatch block at the component's real dimensions with a `mono-xs` `LOADING` label. Nothing pulses.
- **Page background.** No parallax, no gradient drift, no ambient motion of any kind.
- **Focus rings.** They appear instantly. A focus ring that fades in is a focus ring you miss.
- **Modal backdrops.** Flat `#0B0B0A` at 80%, opacity only, no blur — blur is banned outright.

### 6.4 `prefers-reduced-motion`

```
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Policy on top of the blanket rule:

1. **All translation is removed, not shortened.** Sheets and flow steps appear in place. Never trade a slide for a fast slide.
2. **Opacity changes are kept but instant** — they carry state, not decoration.
3. **Focus rings, hover surface steps and validation messages are unaffected** — they were never animated, and they must not be suppressed.
4. **The board's now-line still updates.** It is data, not motion.
5. **`scroll-behavior: smooth` is disabled**, including the date strip's snap scrolling, which falls back to instant snap.
6. Reduced motion never removes information. If a transition is the only thing communicating a change, that is a bug in the component, not something to fix in the media query.

---

## 7. Tailwind v4 token block

Paste into `app/globals.css`.

```css
@import "tailwindcss";

@theme {
  /* ── Radius: every namespace value is 0. Nothing can round. ───────────── */
  --radius-xs:   0px;
  --radius-sm:   0px;
  --radius-md:   0px;
  --radius-lg:   0px;
  --radius-xl:   0px;
  --radius-2xl:  0px;
  --radius-3xl:  0px;
  --radius-4xl:  0px;

  /* ── Surfaces ─────────────────────────────────────────────────────────── */
  --color-canvas:        #0B0B0A;
  --color-sunken:        #060605;
  --color-raised:        #151613;
  --color-raised-2:      #1E201C;

  /* ── Lines. `rule` is DECORATIVE (1.43:1). `border` is INTERACTIVE (3.77:1). */
  --color-rule:          #2B2E28;
  --color-border:        #6A6E62;
  --color-hatch:         #1E1F1C;

  /* ── Text ─────────────────────────────────────────────────────────────── */
  --color-text:          #F2F3EC;
  --color-text-2:        #A6A99D;
  --color-text-3:        #8E9284;
  --color-ink:           #0B0B0A;

  /* ── Accent ───────────────────────────────────────────────────────────── */
  --color-accent:        #C7F73C;
  --color-accent-press:  #A9D62F;
  --color-accent-dim:    #8FB32A;
  --color-accent-wash:   #222710;   /* precomputed flat 12% — never an alpha layer */

  /* ── Semantic slot states ─────────────────────────────────────────────── */
  --color-state-open:    #C7F73C;
  --color-state-filling: #FFA300;
  --color-state-full:    #FF5A2B;
  --color-state-party:   #FF3EA5;
  --color-state-blocked: #8E9284;

  /* ── Fonts ────────────────────────────────────────────────────────────── */
  /* Width is set via font-variation-settings. Do NOT also use font-stretch —
     font-variation-settings wins and the two silently conflict.              */
  --font-display: var(--font-archivo), "Helvetica Neue", Arial, sans-serif;
  --font-display--font-variation-settings: "wdth" 100;

  --font-display-x: var(--font-archivo), "Helvetica Neue", Arial, sans-serif;
  --font-display-x--font-variation-settings: "wdth" 125;   /* hero only, ≥28px */

  --font-body: var(--font-chivo), "Helvetica Neue", Arial, sans-serif;

  --font-mono: var(--font-martian-mono), Menlo, Consolas, monospace;
  --font-mono--font-variation-settings: "wdth" 75;
  --font-mono--font-feature-settings: "tnum" 1, "lnum" 1;

  --font-mono-w: var(--font-martian-mono), Menlo, Consolas, monospace;
  --font-mono-w--font-variation-settings: "wdth" 100;      /* grand total only */
  --font-mono-w--font-feature-settings: "tnum" 1, "lnum" 1;

  /* Overrides Tailwind's defaults so no system-ui stack can leak in. */
  --font-sans: var(--font-body);

  /* ── Display type ─────────────────────────────────────────────────────── */
  --text-display-1: 2.5rem;
  --text-display-1--line-height: 0.92;
  --text-display-1--letter-spacing: -0.03em;
  --text-display-1--font-weight: 800;

  --text-display-2: 2rem;
  --text-display-2--line-height: 0.95;
  --text-display-2--letter-spacing: -0.025em;
  --text-display-2--font-weight: 800;

  --text-display-3: 1.5rem;
  --text-display-3--line-height: 1.05;
  --text-display-3--letter-spacing: -0.02em;
  --text-display-3--font-weight: 700;

  --text-heading: 1.125rem;
  --text-heading--line-height: 1.2;
  --text-heading--letter-spacing: -0.01em;
  --text-heading--font-weight: 700;

  --text-eyebrow: 0.75rem;
  --text-eyebrow--line-height: 1;
  --text-eyebrow--letter-spacing: 0.14em;
  --text-eyebrow--font-weight: 700;

  --text-label: 0.75rem;
  --text-label--line-height: 1;
  --text-label--letter-spacing: 0.12em;
  --text-label--font-weight: 700;

  --text-button: 0.875rem;
  --text-button--line-height: 1;
  --text-button--letter-spacing: 0.06em;
  --text-button--font-weight: 700;

  --text-tag: 0.6875rem;
  --text-tag--line-height: 1;
  --text-tag--letter-spacing: 0.1em;
  --text-tag--font-weight: 700;

  /* ── Body type ────────────────────────────────────────────────────────── */
  --text-body-lg: 1.125rem;
  --text-body-lg--line-height: 1.55;
  --text-body-lg--letter-spacing: 0em;
  --text-body-lg--font-weight: 400;

  --text-body: 1rem;
  --text-body--line-height: 1.6;
  --text-body--letter-spacing: 0.005em;
  --text-body--font-weight: 400;

  --text-body-sm: 0.875rem;
  --text-body-sm--line-height: 1.5;
  --text-body-sm--letter-spacing: 0.01em;
  --text-body-sm--font-weight: 400;

  --text-caption: 0.75rem;
  --text-caption--line-height: 1.4;
  --text-caption--letter-spacing: 0.02em;
  --text-caption--font-weight: 500;

  /* ── Numerals ─────────────────────────────────────────────────────────── */
  --text-mono-xl: 2rem;
  --text-mono-xl--line-height: 1;
  --text-mono-xl--letter-spacing: -0.04em;
  --text-mono-xl--font-weight: 600;

  --text-mono-lg: 1.25rem;
  --text-mono-lg--line-height: 1;
  --text-mono-lg--letter-spacing: -0.03em;
  --text-mono-lg--font-weight: 600;

  --text-mono-md: 1rem;
  --text-mono-md--line-height: 1.2;
  --text-mono-md--letter-spacing: -0.03em;
  --text-mono-md--font-weight: 500;

  --text-mono-sm: 0.8125rem;
  --text-mono-sm--line-height: 1.3;
  --text-mono-sm--letter-spacing: -0.02em;
  --text-mono-sm--font-weight: 500;

  --text-mono-xs: 0.6875rem;
  --text-mono-xs--line-height: 1;
  --text-mono-xs--letter-spacing: 0em;
  --text-mono-xs--font-weight: 600;

  /* ── Spacing (4px base; Tailwind derives the whole ramp) ───────────────── */
  --spacing: 0.25rem;

  /* ── Breakpoints ──────────────────────────────────────────────────────── */
  --breakpoint-sm:  480px;
  --breakpoint-md:  768px;
  --breakpoint-lg:  1024px;
  --breakpoint-xl:  1280px;
  --breakpoint-2xl: 1536px;

  /* ── Containers ───────────────────────────────────────────────────────── */
  --container-flow: 34rem;    /* 544px booking column */
  --container-rail: 20rem;    /* 320px order summary  */
  --container-page: 71.5rem;  /* 1144px page shell    */

  /* ── Motion ───────────────────────────────────────────────────────────── */
  --ease-out:    cubic-bezier(0.2, 0, 0, 1);
  --ease-in:     cubic-bezier(0.4, 0, 1, 1);
  --ease-linear: linear;

  /* ── Shadows: cleared. Only 0-blur inset rings, written inline. ───────── */
  --shadow-*: initial;
  --drop-shadow-*: initial;
  --blur-*: initial;
}

/* ── Extra tokens Tailwind doesn't namespace ───────────────────────────── */
:root {
  --duration-instant: 90ms;
  --duration-fast:    140ms;
  --duration-base:    200ms;
  --duration-slow:    260ms;

  /* 45° hatch for blocked / full / disabled. Two pitches. */
  --hatch-4: repeating-linear-gradient(
    45deg, var(--color-hatch) 0 1px, transparent 1px 4px);
  --hatch-6: repeating-linear-gradient(
    45deg, var(--color-hatch) 0 1px, transparent 1px 6px);
}

@layer base {
  html {
    background-color: var(--color-canvas);
    -webkit-text-size-adjust: 100%;
  }

  body {
    background-color: var(--color-canvas);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: var(--text-body);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  /* Headings use the display face by default. */
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    font-variation-settings: "wdth" 100;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  /* Every figure is tabular, everywhere, always. */
  code, kbd, samp, pre, time, output, [data-numeric] {
    font-family: var(--font-mono);
    font-variation-settings: "wdth" 75;
    font-variant-numeric: tabular-nums lining-nums;
    letter-spacing: -0.03em;
  }

  /* Controls inherit type — the UA sans stack must never appear. */
  button, input, select, textarea, optgroup {
    font: inherit;
    color: inherit;
    background: none;
  }

  /* One focus treatment, applied once. Geometric, not colour-only. */
  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    box-shadow: inset 0 0 0 2px var(--color-accent);
  }

  @media (forced-colors: active) {
    :focus-visible { outline-color: Highlight; }
  }

  ::selection {
    background-color: var(--color-accent);
    color: var(--color-ink);
  }

  ::placeholder { color: var(--color-text-3); opacity: 1; }

  /* Hairline rules never render as a rounded or shaded box. */
  hr { border: 0; border-top: 1px solid var(--color-rule); }

  img, svg, video, canvas { max-width: 100%; height: auto; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   THE RADIUS BACKSTOP — DO NOT REMOVE, DO NOT MOVE INTO @layer.

   Zeroing --radius-* kills rounded-sm … rounded-4xl, but `rounded-full` is a
   STATIC utility (calc(infinity * 1px)) and survives, as does any arbitrary
   value like rounded-[6px] or a third-party stylesheet.

   Unlayered CSS beats every @layer regardless of specificity, so this rule
   sits outside all layers and wins against Tailwind's utilities. !important
   additionally defeats inline styles from any embedded widget.

   border-radius is 0 across this entire product. There is no exception.
   ══════════════════════════════════════════════════════════════════════════ */
*, *::before, *::after {
  border-radius: 0 !important;
}
```

**Note on `--shadow-*: initial`** — this removes Tailwind's `shadow-sm … shadow-2xl` utilities entirely, so a developer reaching for `shadow-lg` gets nothing rather than a soft shadow. `--blur-*: initial` does the same for `blur-*`, which kills the glassmorphism route at the tooling level. Inset focus rings are written as explicit `box-shadow: inset …` in component CSS and are unaffected.

---

## 8. Anti-checklist

Run this before any UI merges. Every item is a direct check against the client's stated rejection criteria.

### Corners

- [ ] Inspect the deepest-nested element on three screens: computed `border-radius` is `0px`. Check buttons, inputs, checkboxes, chips, avatars, modals, images, and the date-picker cells.
- [ ] `grep -rn "rounded" app/` returns nothing, or only matches the backstop comment.
- [ ] `grep -rn "border-radius" app/` returns only the backstop rule.
- [ ] No `<img>` or avatar is circular. No pill-shaped badges or toggles.

### Type

- [ ] `grep -rniE "inter|poppins|montserrat|roboto|open.sans|lato|nunito|space.grotesk|system-ui|-apple-system|ui-sans-serif|Segoe" app/` returns nothing.
- [ ] Only three families load in the Network tab: Archivo, Chivo, Martian Mono. Nothing from a CDN, nothing self-hosted outside `next/font`.
- [ ] Every time, price, guest count, capacity and duration on screen is Martian Mono. Pick five at random and confirm.
- [ ] No number is in the body face. No body copy is in the mono face.
- [ ] Headline weights are 700–800, not 600. Uppercase labels have positive tracking; display sizes have negative tracking.

### Colour and surfaces

- [ ] `grep -rniE "gradient" app/` returns only the two `--hatch-*` repeating-linear-gradients. **No `linear-gradient` on any background, text, border, or button.**
- [ ] No purple, indigo, violet, or blue-to-purple anything. The only hues in the build are the eleven hexes in §2.1 and §2.2.
- [ ] `grep -rniE "backdrop-filter|backdrop-blur|blur\(" app/` returns nothing. No frosted panels, no blurred modal backdrops.
- [ ] Every `box-shadow` in the codebase contains `inset` and a `0` blur radius. No offset shadows, no `0 4px 12px rgba(...)`.
- [ ] Card and section separation is achieved with 1px rules and flat surface steps only.
- [ ] Accent green appears **only** on: available/selected state, focus rings, primary buttons, the now-line, the deposit bar. Not on headings, not as decoration.

### Layout

- [ ] No hero is centre-aligned with a large centred paragraph beneath it. Headlines are left-aligned.
- [ ] No "floating card on a gradient background" anywhere.
- [ ] No three-across feature grid of icon + heading + one sentence.
- [ ] Empty states are left-aligned and name a real venue constraint, not "Nothing here yet!".
- [ ] The layout was checked at 360px width first, and the phone layout is not a squeezed desktop layout.

### Icons and imagery

- [ ] `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" app/` returns nothing. **Zero emoji** in UI, labels, buttons, empty states, or validation messages.
- [ ] Chevrons, checkmarks and the bang marker are CSS-drawn or inline SVG with 2px strokes — not an icon font, not an emoji.
- [ ] No illustrations, no mascots, no stock 3D shapes.

### Accessibility (blocking)

- [ ] Every text/background pair on screen matches a measured ratio in §2.3. Nothing new was introduced without measuring it.
- [ ] `--color-rule` (1.43:1) is not the only boundary on any interactive control — those use `--color-border` (3.77:1).
- [ ] Tab through every screen: focus is visible on every stop, with both the 2px outline **and** the inset ring.
- [ ] Screenshot the schedule board and convert to greyscale: all five slot states remain distinguishable by bar style, hatch, notch, strikethrough and word.
- [ ] Every slot state has a literal uppercase word (`OPEN` / `FILLING` / `FULL` / `PARTY HOLD` / `BLOCKED` / `TOO SOON`). Colour alone carries nothing.
- [ ] Every interactive target is ≥44×44px. Measure the stepper buttons and the date strip tiles.
- [ ] Inputs are ≥16px so iOS does not zoom.
- [ ] Validation messages carry a marker shape and explicit words, not just red text.

### Motion

- [ ] No number animates, anywhere. No count-ups on the total.
- [ ] No skeleton shimmer — loading is a static hatch block with a `LOADING` label.
- [ ] No staggered or cascading entrance on the slot grid.
- [ ] Nothing takes longer than 260ms. Nothing travels further than 8px except sheets.
- [ ] With `prefers-reduced-motion: reduce`, all translation is gone and no information is lost.

### The smell test

- [ ] Screenshot any screen, crop out the logo, and ask: *could this be a generic SaaS dashboard template?* If yes, the rules above are being followed in letter but not in spirit — the fix is usually more typographic contrast and harder rules, not more colour.
