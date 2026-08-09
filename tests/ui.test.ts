/**
 * Component smoke tests.
 *
 * No route imports `src/components/ui` yet — the surface teams build those next — so `next
 * build` would never execute this code and `tsc` only checks its types. These tests actually
 * render each primitive to static markup and assert the things DESIGN §8 says are blocking:
 * the state words, the ARIA, and the absence of corners, shadows and blur.
 *
 * Written with `createElement` rather than JSX so the file stays `.ts` and inside the existing
 * `tests/**\/*.test.ts` glob; no config and no new dependency.
 */

import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AddOnToggleRow,
  Button,
  Checkbox,
  DateStrip,
  EmptyState,
  FormErrorSummary,
  LoadingBlock,
  MonthGrid,
  OrderSummary,
  PartyBayRow,
  PartyWindowCard,
  ScheduleBoard,
  SectionHeader,
  Select,
  SlotGrid,
  SlotHourHeader,
  SlotTile,
  StepIndicator,
  Stepper,
  StickyActionBar,
  Tag,
  TextInput,
  ValidationMessage,
  type SlotState,
} from "@/components/ui";
import { global } from "@/lib/copy";
import { formatCapacity, formatMoneyPlain, formatTime, formatTimeRange } from "@/lib/format";

const render = (element: ReactElement): string => renderToStaticMarkup(element);

/** Every primitive in the library, rendered once, in a representative state. */
function everything(): string[] {
  const slotStates: SlotState[] = ["open", "filling", "full", "party", "blocked", "tooSoon"];

  return [
    render(h(Button, { variant: "primary", children: global.btn.continue })),
    render(h(Button, { variant: "secondary", children: global.btn.back })),
    render(h(Button, { variant: "ghost", children: global.btn.edit })),
    render(h(Button, { variant: "compact", children: global.btn.print })),
    render(h(Button, { variant: "primary", disabled: true, children: global.btn.continue })),
    render(
      h(Button, {
        variant: "primary",
        pending: true,
        pendingLabel: global.loading.confirming,
        children: global.btn.confirmBooking,
      }),
    ),
    render(h(TextInput, { id: "name", label: "Name", helper: "Helper", error: "Enter a name." })),
    render(
      h(Select, {
        id: "pkg",
        label: "Package",
        children: h("option", { value: "a" }, "The Traveler"),
      }),
    ),
    render(h(Checkbox, { id: "ack", label: global.rule.shoes })),
    render(
      h(Stepper, {
        id: "guests",
        label: "Guests",
        value: 14,
        min: 1,
        max: 14,
        onChange: () => {},
        decreaseLabel: "One fewer guest",
        increaseLabel: "One more guest",
        hint: "Max 14 in this room.",
      }),
    ),
    render(
      h(AddOnToggleRow, {
        id: "qbix",
        name: "QBIX 5D",
        description: "An immersive 5D game.",
        price: "$3.95",
        priceUnit: "per person",
      }),
    ),
    render(
      h(AddOnToggleRow, {
        id: "arcade",
        name: "5-Up Arcade Card",
        disabled: true,
        unavailableReason: "Not available with this package.",
      }),
    ),
    render(
      h(DateStrip, {
        label: "Choose a date",
        days: [
          { date: "2026-08-10", availability: "open", statusLabel: "Open" },
          { date: "2026-08-11", availability: "limited", statusLabel: "Limited", isToday: true },
          { date: "2026-08-12", availability: "none", statusLabel: "Full", disabled: true },
        ],
        selected: "2026-08-11",
        onSelect: () => {},
      }),
    ),
    render(
      h(MonthGrid, {
        label: "August — party availability",
        days: Array.from({ length: 31 }, (_, index) => ({
          date: `2026-08-${String(index + 1).padStart(2, "0")}`,
          availability: index % 3 === 0 ? ("open" as const) : ("limited" as const),
          statusLabel: "Open",
        })),
        selected: "2026-08-13",
        onSelect: () => {},
      }),
    ),
    render(
      h(SlotGrid, {
        label: "Game start times",
        children: slotStates.map((state, index) =>
          h(SlotTile, {
            key: state,
            time: formatTime(1035 + index * 15),
            state,
            stateWord: state.toUpperCase(),
            detail: formatCapacity(18, 25),
            a11yLabel: `${formatTime(1035 + index * 15)}, ${state}, 18 of 25 spots`,
          }),
        ),
      }),
    ),
    render(
      h(SlotTile, {
        time: formatTime(1035),
        state: "open",
        stateWord: "OPEN",
        selected: true,
        selectedWord: "SELECTED",
        subTimes: "5:15 · 5:30",
        a11yLabel: "5:15 PM, selected, 18 of 25 spots",
      }),
    ),
    render(h(SlotHourHeader, { children: formatTime(1020) })),
    render(
      h(PartyWindowCard, {
        windowTime: formatTimeRange(1020, 1140),
        meta: "Monday · 2 hours",
        status: { label: "1 BAY OPEN", tone: "accent" },
        constraintNote: "Your group must be within 2 years of age 8.",
        gamesLabel: "GAMES",
        gameTimes: ["5:15", "5:30"],
        bays: [
          h(PartyBayRow, {
            key: "arena",
            roomName: "Arena Room",
            capacity: formatCapacity(10, 14),
            state: "party",
            stateWord: "PARTY HOLD",
            ageLabel: "AGES 7–9",
            a11yLabel: "Arena Room, 10 of 14, party hold",
            disabled: true,
          }),
          h(PartyBayRow, {
            key: "launch",
            roomName: "Launch Room",
            capacity: formatCapacity(0, 12),
            state: "open",
            stateWord: "OPEN",
            a11yLabel: "Launch Room, 0 of 12, open",
          }),
        ],
      }),
    ),
    render(
      h(OrderSummary, {
        heading: global.sum.heading,
        currencyNote: "CAD",
        lines: [
          { id: "pkg", description: "The Great Adventure", quantity: "10", amount: formatMoneyPlain(25950) },
        ],
        totalsBefore: [{ id: "tax", label: global.sum.subtotal, amount: formatMoneyPlain(38343) }],
        total: { label: global.sum.total, amount: formatMoneyPlain(43979) },
        deposit: {
          label: global.sum.depositDue,
          amount: formatMoneyPlain(5000),
          note: "Non-refundable deposit.",
        },
      }),
    ),
    render(
      h(OrderSummary, {
        heading: global.sum.heading,
        lines: [],
        emptyLabel: "Nothing selected yet.",
      }),
    ),
    render(h(ValidationMessage, { tone: "error", children: "Enter a last name." })),
    render(h(ValidationMessage, { tone: "success", children: "Within 2 years." })),
    render(h(ValidationMessage, { tone: "warning", children: "Only 4 spots left." })),
    render(
      h(FormErrorSummary, {
        heading: "Check these",
        errors: [{ fieldId: "name", message: "Enter a last name." }],
      }),
    ),
    render(h(EmptyState, { title: "No games on this date.", body: "Try another date." })),
    render(h(LoadingBlock, { label: global.loading.times })),
    render(h(Tag, { tone: "open", children: "OPEN" })),
    render(h(SectionHeader, { title: "Pick a time", level: 2, description: "Choose a start." })),
    render(h(StepIndicator, { current: 2, total: 4, label: "STEP 2 / 4", a11yLabel: "Progress" })),
    render(
      h(StickyActionBar, {
        action: h(Button, { variant: "primary", children: "Continue" }),
        children: "Total",
      }),
    ),
    render(
      h(ScheduleBoard, {
        label: "Today's board",
        columns: [{ id: "arena", name: "Arena Room", capacityLabel: "max 14" }],
        rows: [
          { id: "r1", timeLabel: formatTime(1020), onHour: true },
          { id: "r2", timeLabel: formatTime(1035) },
        ],
        chips: [
          {
            id: "b1",
            columnId: "arena",
            rowId: "r1",
            span: 2,
            state: "confirmed",
            name: "Cheway",
            countLabel: "10",
            a11yLabel: "5:00 PM, Arena Room, Cheway, 10 guests, confirmed",
          },
        ],
        now: { rowId: "r2", label: "5:38 PM" },
      }),
    ),
  ];
}

describe("every primitive renders", () => {
  const markup = everything();

  it("produces markup for all of them", () => {
    expect(markup).toHaveLength(31);
    for (const html of markup) expect(html.length).toBeGreaterThan(0);
  });

  it("has no rounded corner, no shadow, no blur and no gradient anywhere", () => {
    for (const html of markup) {
      expect(html).not.toMatch(/rounded/);
      expect(html).not.toMatch(/shadow/);
      expect(html).not.toMatch(/\bblur\b/);
      expect(html).not.toMatch(/linear-gradient|backdrop-filter/);
    }
  });

  it("uses no hardcoded colour value", () => {
    for (const html of markup) {
      expect(html).not.toMatch(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/);
      expect(html).not.toMatch(/rgba?\(/);
    }
  });

  it("contains no emoji", () => {
    for (const html of markup) {
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html)).toBe(false);
    }
  });
});

describe("slot tile states", () => {
  const states: Array<[SlotState, string]> = [
    ["open", "OPEN"],
    ["filling", "FILLING"],
    ["full", "FULL"],
    ["party", "PARTY HOLD"],
    ["blocked", "BLOCKED"],
    ["tooSoon", "TOO SOON"],
  ];

  it.each(states)("%s carries its literal uppercase word", (state, word) => {
    const html = render(
      h(SlotTile, {
        time: formatTime(1035),
        state,
        stateWord: word,
        a11yLabel: `5:15 PM, ${word}`,
      }),
    );
    expect(html).toContain(word);
  });

  it("marks the bookable states pressable and the rest aria-disabled", () => {
    const open = render(
      h(SlotTile, { time: "5:15", state: "open", stateWord: "OPEN", a11yLabel: "a" }),
    );
    const full = render(
      h(SlotTile, { time: "5:45", state: "full", stateWord: "FULL", a11yLabel: "b" }),
    );
    expect(open).toContain('aria-pressed="false"');
    expect(open).not.toContain("aria-disabled");
    expect(full).toContain('aria-disabled="true"');
    expect(full).not.toContain("aria-pressed");
  });

  it("puts the state word in the accessible name, not just on the tile", () => {
    const html = render(
      h(SlotTile, {
        time: "5:45 PM",
        state: "full",
        stateWord: "FULL",
        a11yLabel: "5:45 PM, full, 0 of 25 spots",
      }),
    );
    expect(html).toContain('aria-label="5:45 PM, full, 0 of 25 spots"');
  });

  it("marks a selected tile pressed and draws the tick square", () => {
    const html = render(
      h(SlotTile, {
        time: "5:15",
        state: "open",
        stateWord: "OPEN",
        selected: true,
        selectedWord: "SELECTED",
        a11yLabel: "c",
      }),
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("SELECTED");
    expect(html).toContain("bg-accent-wash");
  });
});

describe("accessibility contracts DESIGN §5 names explicitly", () => {
  it("wires the input's label, helper and error together", () => {
    const html = render(
      h(TextInput, { id: "phone", label: "Mobile number", helper: "Help", error: "Bad." }),
    );
    expect(html).toContain('for="phone"');
    expect(html).toContain('aria-describedby="phone-helper phone-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
  });

  it("announces the stepper value and disables the plus at the bound", () => {
    const html = render(
      h(Stepper, {
        id: "guests",
        label: "Guests",
        value: 14,
        min: 1,
        max: 14,
        onChange: () => {},
        decreaseLabel: "One fewer guest",
        increaseLabel: "One more guest",
      }),
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Guests: 14");
    expect(html).toContain('aria-label="One more guest" aria-disabled="true"');
    expect(html).toContain('type="number"');
  });

  it("gives the date strip one tab stop and marks the selection", () => {
    const html = render(
      h(DateStrip, {
        label: "Choose a date",
        days: [
          { date: "2026-08-10", availability: "open", statusLabel: "Open" },
          { date: "2026-08-11", availability: "open", statusLabel: "Open" },
        ],
        selected: "2026-08-11",
        onSelect: () => {},
      }),
    );
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="listbox"');
  });

  it("keeps the month grid in real ARIA rows", () => {
    const html = render(
      h(MonthGrid, {
        label: "August",
        days: Array.from({ length: 31 }, (_, index) => ({
          date: `2026-08-${String(index + 1).padStart(2, "0")}`,
          availability: "open" as const,
          statusLabel: "Open",
        })),
        onSelect: () => {},
      }),
    );
    expect(html).toContain('role="grid"');
    // One heading row plus six week rows for a 31-day month starting on a Saturday.
    expect(html.match(/role="row"/g)).toHaveLength(7);
    expect(html.match(/role="columnheader"/g)).toHaveLength(7);
  });

  it("names the board's chips fully and keeps the grid semantics", () => {
    const html = render(
      h(ScheduleBoard, {
        label: "Board",
        columns: [{ id: "arena", name: "Arena Room", capacityLabel: "max 14" }],
        rows: [{ id: "r1", timeLabel: "5:00 PM", onHour: true }],
        chips: [
          {
            id: "b1",
            columnId: "arena",
            rowId: "r1",
            state: "confirmed",
            name: "Cheway",
            countLabel: "10",
            a11yLabel: "5:00 PM, Arena Room, Cheway, 10 guests, confirmed",
          },
        ],
      }),
    );
    expect(html).toContain('role="grid"');
    expect(html).toContain('role="rowheader"');
    expect(html).toContain('role="gridcell"');
    expect(html).toContain('aria-label="5:00 PM, Arena Room, Cheway, 10 guests, confirmed"');
  });
});
