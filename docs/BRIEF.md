# Lasertopia Booking Platform — Source Brief

> This is the authoritative source material. Everything downstream (rules spec, IA,
> design system, copy, schema) derives from this file. Do not invent facts that
> aren't here or verifiable on lasertopia.ca.

## What we are building

A **standalone booking platform** for Lasertopia (Winnipeg, MB). It is **NOT** the
company's marketing website — lasertopia.ca stays as-is and links out to this. We
are building three surfaces only:

1. **Laser tag booking flow** (customer-facing)
2. **Birthday party booking flow** (customer-facing)
3. **Manager backend** (staff-facing)

This is a **real production product**, not a demo or prototype. Logic must actually
work and be enforced server-side.

## Business facts (verified on lasertopia.ca)

- **Location:** Unit #5 – 1140 Waverley Street, Winnipeg, MB
- **Phone:** 204-474-5900
- **Public hours:** Mon–Thu 12pm–9pm · Fri 12pm–10pm · Sat 12pm–9pm · Sun 12pm–7pm
- **Attractions:** Laser Tag, Arcade, Party Rooms, Lazer Frenzy (Winnipeg-exclusive),
  QBIX 5D, prizes + concession
- **Facility is nut-free.** No outside food, drinks, or cakes.
- **Clean closed-toed shoes required** in the arena.

### Laser tag pricing (same-day play, taxes NOT included)
| Games | Price per person |
|---|---|
| 1 game | $8.49 |
| 2 games | $15.49 |
| 3 games | $21.49 |

### Party packages (each accommodates 10 guests = 9 friends + Birthday Guest of Honour)
| Package | Price | Extra guest | Includes |
|---|---|---|---|
| The Traveler | $224.50 | $22.45 | Private party room, 2 laser tag games, merch for honoree, 1.5 hrs in room |
| The Great Adventure | $259.50 | $25.95 | Private party room, 2 laser tag games, pizza or hot dogs, cupcakes, merch for honoree, 2 hrs in room |
| Around The World | $359.50 | $35.95 | Private party room, 2 laser tag games, Lazer Frenzy, Typhoon Experience ride, $10 fun card per guest, pizza or hot dogs, cupcakes, merch for honoree, 2 hrs in room |

All packages include: VIP host, soft drinks, popcorn, party supplies, setup/cleanup,
free downloadable Lasertopia invitations.

---

## The manager's brief (verbatim)

### Laser tag game booking

- Games run **every 15 minutes**. Example times: 12:00, 12:15, 12:30, 12:45, 1:00.
- Some time slots are **reserved for private birthday parties**. They open up if no
  party is scheduled.
- **Reserved party game times:**
  - Mon–Fri: 5:15, 5:30, 6:15, 6:45
  - Saturday: 1:15, 1:45, 3:15, 3:45, 5:15, 5:45
  - Sunday: 1:15, 1:45, 3:00, 3:15, 4:15, 4:45
- "We sometimes have to book off other time slots for parties as well."
- **Request:** "Could there be an option that you cannot book 90 minutes before the
  start time of a laser tag. This way when we have walk-ins, we are not double
  booking."

### Party booking

- Parties run in **2-hour slots**. **Two parties are hosted per 2-hour slot.**
- Parties are booked **by age — the age difference between the two parties sharing a
  slot must be within 2 years.**
- **2-hour party slots:**
  - Mon–Fri: 5:00–7:00, 6:00–8:00
  - Saturday: 10–12, 11–1, 1–3, 3–5, 5–7
  - Sunday: 10–12, 11–1, 1–3, 3–5, 4–6

### Room capacity per time slot (verbatim)

**Monday through Friday:**
- **5pm–7pm** — largest party room set holds up to 14 guests (13 friends + honoree).
  If over 14 guests, book two time slots. This can hold up to 20 guests.
- **6pm–8pm** — two different size party rooms. One room max 12 guests, the other
  max 14 guests. If adding more guests, the largest party room can hold up to 18.

**Saturday:**
- **10am–12pm** — largest party room set holds up to 14. Over 14 → two time slots,
  holds up to 20. There is also a **third time slot** for 10–12 whose room holds up
  to 18. From 10am–12pm Saturday, laser tag games are played at **10:15, 10:30,
  10:45, 11:00**.
- **11am–1pm** — two different size party rooms: one max 12, one max 14.
- **1pm–3pm** — largest party room set holds up to 14. Over 14 → two slots, up to 20.
- **3pm–5pm** — two different size party rooms: one max 12, one max 14.
- **5pm–7pm** — largest party room set holds up to 14. Over 14 → two slots, up to 20.

**Sunday:**
- **10am–12pm** — largest party room set holds up to 14. Over 14 → two slots, up to
  20. Also a **third time slot** for 10–12 holding up to 18. Games played at **10:15,
  10:30, 10:45, 11:00**.
- **11am–1pm** — two rooms: one max 12, one max 14.
- **1pm–3pm** — largest holds up to 14. Over 14 → two slots, up to 20.
- **3pm–5pm** — two rooms: one max 12, one max 14.
- **4pm–6pm** — largest holds up to 14. Over 14 → two slots, up to 20.

### Large groups

- Over 20 guests: can accommodate **up to 28 guests**, which takes **3 time slots**.
- **The arena holds a maximum of 25 players at a time.** Groups over 25 must be split
  into 2 separate laser tag game groups.

### Add-ons

**5-Up Arcade Card** (Traveler and Great Adventure only):
- Guest spends $5, Lasertopia matches with $5 Bonus Cash. Matched up to $20.
- **OR** $5/card/guest for a **45-minute Arcade Time Play card** — unlimited arcade
  time play for 45 min, but earns no prize points and does not work on Claw Machines
  or QBIX.

**QBIX 5D** — $3.95/person, addable to any party package. Immersive 5D interactive
game, up to 5 friends, multiple game modes, real-world effects (wind, motion, sound,
lighting) reacting to on-screen action.

**Pizza** — package includes 2 Large 1-Topping pizzas; quantity scales with guests:
| Guests | Pizzas |
|---|---|
| 10 | 2 Large 1-Topping |
| 12–15 | 3 |
| 16–20 | 4 |
| 20–25 | 5 |
| 25–30 | 6 |

Additional pizzas (prices include tax):
- Large Cheese — $22.39
- Large 1 Topping — $24.63
- Large 2 Topping — $26.87
- Topping choices: Pepperoni, Bacon, Hawaiian

**Wings** (prices include tax): 8 for $10.07 · 16 for $19.03 · 24 for $29.11
Sauces: Louisiana, Dry, Sweet Chili, Honey Garlic, Salt and Pepper, Lemon Pepper,
Honey Garlic BBQ

### Deposit & cancellation (verbatim)

> For event bookings, a non refundable deposit of $50.00 is required. If you need to
> change the date of your booking, we require at least 2 weeks notice. Should you
> need to cancel your booking, please give at least 2 weeks prior to your event. Your
> non-refundable $50.00 deposit will be added to a GIFT CARD that can be used in our
> facility if cancelled before 14 days of the party date. If you cancel your booking
> or change the date within 14 days or less of your event, you forfeit your deposit
> or have the choice to move to a new rescheduled date.

---

## Known contradictions and gaps in the brief

These are **real** — do not paper over them. Resolve each with a documented default
that a manager can change in the backend, and list them as open questions.

1. **Pizza tiers have a gap and two overlaps.** 11 guests is undefined; 20 appears in
   both the 16–20 and 20–25 rows; 25 appears in both 20–25 and 25–30.
   **Approved default:** 10–11→2, 12–15→3, 16–20→4, 21–25→5, 26–30→6.
2. **The Traveler contradicts itself.** The website lists no food and 1.5 hours in the
   room; the manager's brief says every package comes with 2 pizzas and runs on
   2-hour slots. Needs an explicit resolution.
3. **Reserved game times aren't mapped to parties.** Mon–Fri lists 4 reserved times
   (5:15, 5:30, 6:15, 6:45) for two parties that each get 2 games, but which times
   belong to which party is unstated. **Approved approach:** model reserved game times
   as an editable ordered list attached to each 2-hour party slot — never hardcode.
4. **Weekend mornings fall outside posted public hours.** Sat/Sun parties start at
   10am but doors open at 12pm. **Approved default:** 10am–12pm weekend is
   party-only; no public laser tag booking in that window (except the party's own
   10:15/10:30/10:45/11:00 games).
5. **Party slots overlap.** Sunday 3–5 and 4–6 overlap; every 10–12 / 11–1 pair
   overlaps. Room capacity and the 25-player arena cap are therefore **two
   independent constraints** and must be enforced separately.
6. **Rooms are described per-timeslot, not as inventory.** Build a real rooms table
   (name + capacity) plus a slot→room mapping, seeded to reproduce every case above
   exactly, so a manager can add or resize a room without a code change.

---

## Approved product decisions

- **Real production build**, not a demo.
- **Deposit:** simulated checkout — records the $50, enforces the 14-day
  gift-card/forfeit policy, takes no real card. No payment SDK.
- **Visual direction: "Industrial Arcade"** — near-black canvas, single acid accent,
  wide/black display type, hard 1px rules, monospace for every time, price and count.
- **Hard design constraints:** `border-radius: 0` everywhere. No Inter, Poppins,
  Montserrat, or Space Grotesk. No purple/blue gradients, no glassmorphism, no
  emoji icons. It must not look AI-generated.
- **Type stack:** Archivo (display) · Chivo (body) · Martian Mono (numerals).
- **Stack:** Next.js 15 App Router + TypeScript, Prisma (SQLite dev → Postgres prod),
  Tailwind v4 with radius/font tokens reset at the root, Auth.js credentials for
  manager login.
