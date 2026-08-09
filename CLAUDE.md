@AGENTS.md

# Lasertopia Booking Platform

Booking platform for **Lasertopia**, a laser tag venue in Winnipeg, MB
(Unit #5 – 1140 Waverley Street · 204-474-5900).

This is **not** the company's website. `lasertopia.ca` remains the marketing site and
links out to this product. This repo is three surfaces only:

1. **Laser tag booking** — public, 15-minute game slots
2. **Party booking** — public, 2-hour private room windows
3. **Manager backend** — staff schedule board and booking management

## Run it locally

```bash
npm install
npm run dev
```

That's it — SQLite, no external services. The database file and `.env` are created by
`npm run db:migrate`; `.env.example` shows the one variable required.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm test` | Vitest — the domain engine test suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed rooms, windows, packages, prices, settings |
| `npm run db:studio` | Browse the database |
| `npm run db:reset` | **Destructive.** Drops and reseeds. Ask before running. |

## Architecture

```text
src/lib/domain/    Pure functions. No I/O, no Prisma, no React. The rules live here.
src/lib/db/        Prisma client + repositories. The only place that touches the DB.
src/lib/copy/      Every user-facing string, keyed. One file per surface.
src/lib/format.ts  Currency, date, time, duration, unit formatting.
src/components/ui/ Shared primitives built from docs/DESIGN.md §5.
src/app/           Routes. Server components by default.
prisma/            Schema, migrations, seed.
tests/             Vitest suites, including the 14 worked examples from docs/RULES.md.
docs/              The specifications. See below.
```

## Invariants — break these and things go wrong quietly

- **Money is integer cents.** Never a float. `2245` is $22.45. Format only at the edge.
- **Timezone is `America/Winnipeg`, always explicit.** The 90-minute cutoff and the
  14-day deposit boundary are local wall-clock rules. Domain functions take `now: Date`
  as a parameter — they never read the clock themselves, which is what makes them testable.
- **Configuration lives in the database, not in code.** Room capacities, party windows,
  reserved game times, prices, pizza tiers, tax rate, cutoffs and notice periods are all
  seeded rows the manager can edit. If you are about to type a business number into a
  `.ts` file, it belongs in `Setting` or a seed table instead.
- **Room capacity and arena capacity are two independent constraints.** A booking can
  fit the rooms and still fail the 25-player arena cap, and vice versa. Party windows
  overlap, so both must be checked.
- **`border-radius` is 0 everywhere.** Enforced by an unlayered backstop at the bottom of
  `globals.css`. Do not remove it and do not move it into a `@layer`.
- **No `Inter`, `Poppins`, `Montserrat`, `Roboto`, or system-ui stacks.** The three
  families are Archivo (display), Chivo (body), Martian Mono (all numerals). Width is set
  via `font-variation-settings`, never `font-stretch` — the two silently conflict.
- **No box-shadows and no blur.** Both Tailwind namespaces are cleared. Separation comes
  from 1px rules and flat surface steps.
- **Every slot state carries a word and a shape, not just a colour.** Colour alone fails
  for colour-blind users and in daylight on a phone.

## The specifications

`docs/` is authoritative. When code and spec disagree, that is a bug in one of them —
resolve it explicitly, don't paper over it.

| File | What it is |
| --- | --- |
| `docs/BRIEF.md` | The venue manager's verbatim brief + verified facts from lasertopia.ca |
| `docs/RULES.md` | 70 numbered rules, room inventory, 14 worked examples, data model |
| `docs/STRATEGY.md` | Users, routes, every screen and every failure state |
| `docs/DESIGN.md` | The "Industrial Arcade" design system, with measured contrast ratios |
| `docs/COPY.md` | 1,271 keyed strings — every label, error and policy sentence |

## Open questions

`docs/RULES.md` §5 lists 36 questions for the venue manager, 12 of them priority-1;
`docs/COPY.md` §15 lists six facts the specs do not contain. Until they are answered the
seeded values are documented assumptions, **not** confirmed business rules. Each one is a
data edit when the answer arrives, not a rebuild.

Two known contradictions in the source brief, still unresolved:

- The third weekend-morning party has no laser tag game times left to play.
- `RULES.md` worked example WE-09 contradicts rule R-17 about whether a party's last game
  may start at the window's end. The code implements R-17; the test documents the conflict.
