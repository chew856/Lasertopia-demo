/**
 * The laser tag grid's view logic — `src/app/laser-tag/_lib/grid.ts`.
 *
 * These are the pure functions between the engine's answer and what a customer sees: which
 * of DESIGN §5.6's six states a cell takes, how the day is grouped, which alternatives are
 * worth offering, and what the date strip's four statuses mean. Every one of them can put a
 * wrong word on a tile without failing a type check, which is why they are tested here rather
 * than left to a render.
 *
 * The fixtures are hand-built `PublicSlotStatus` values rather than engine output: the point
 * is to pin the display rules, and building the arena occupancy that would produce each
 * reason code through the engine would test the engine instead.
 */

import { describe, expect, it } from "vitest";

import {
  blockEndMinutes,
  dateAvailabilityFor,
  dayOutcomeFor,
  fillingThreshold,
  firstFailingStart,
  groupByHour,
  nearestAvailable,
  nextDaysWithRoom,
  nextOpenDay,
  tileStateFor,
} from "@/app/laser-tag/_lib/grid";
import type { BookingErrorCode, PublicAvailability, PublicSlotStatus } from "@/lib/domain";

const ARENA = 25;

function slot(overrides: Partial<PublicSlotStatus> & { startMinutes: number }): PublicSlotStatus {
  return {
    startsAtUtc: new Date(0),
    label: "",
    mode: "PUBLIC",
    releasedFromParty: false,
    available: true,
    reason: null,
    seatsRemaining: ARENA,
    blockStartMinutes: [overrides.startMinutes],
    ...overrides,
  };
}

function day(overrides: Partial<PublicAvailability> & { date: string }): PublicAvailability {
  return {
    closed: false,
    closedReason: null,
    opensMinutes: 720,
    closesMinutes: 1260,
    slots: [],
    nextAvailableStartMinutes: null,
    ...overrides,
  };
}

describe("tileStateFor", () => {
  it("shows OPEN while there is real room and FILLING once the arena is nearly gone", () => {
    // DESIGN §5.6 draws OPEN at 18/25 and FILLING at 4/25; the threshold sits between them.
    expect(tileStateFor(slot({ startMinutes: 1035, seatsRemaining: 18 }), ARENA)).toBe("open");
    expect(tileStateFor(slot({ startMinutes: 1035, seatsRemaining: 4 }), ARENA)).toBe("filling");
    expect(fillingThreshold(ARENA)).toBe(6);
  });

  it("puts the threshold itself in the FILLING band, not the OPEN one", () => {
    expect(tileStateFor(slot({ startMinutes: 1035, seatsRemaining: 6 }), ARENA)).toBe("filling");
    expect(tileStateFor(slot({ startMinutes: 1035, seatsRemaining: 7 }), ARENA)).toBe("open");
  });

  it("maps every engine reason code onto a state with its own marker", () => {
    const cases: [BookingErrorCode, string][] = [
      ["ONLINE_CUTOFF", "tooSoon"],
      ["SLOT_HELD_FOR_PARTY", "party"],
      ["PARTY_ONLY_WINDOW", "party"],
      ["SLOT_UNAVAILABLE", "blocked"],
      ["ARENA_FULL", "full"],
      ["PARTIAL_BLOCK", "full"],
    ];
    for (const [reason, expected] of cases) {
      expect(
        tileStateFor(slot({ startMinutes: 1035, available: false, reason, seatsRemaining: 0 }), ARENA),
      ).toBe(expected);
    }
  });

  it("falls back to a non-interactive state for a code with no designed cell", () => {
    // A tampered draft can produce INVALID_PLAYER_COUNT on every cell. "Not bookable" is the
    // honest rendering; guessing a nicer reason would be a lie on 40 tiles at once.
    expect(
      tileStateFor(
        slot({ startMinutes: 1035, available: false, reason: "INVALID_PLAYER_COUNT" }),
        ARENA,
      ),
    ).toBe("blocked");
  });
});

describe("groupByHour", () => {
  it("groups starts under their hour in ascending order", () => {
    const groups = groupByHour([
      slot({ startMinutes: 1110 }),
      slot({ startMinutes: 1080 }),
      slot({ startMinutes: 1095 }),
      slot({ startMinutes: 1140 }),
    ]);
    expect(groups.map((group) => group.hourMinutes)).toEqual([1080, 1140]);
    expect(groups[0].slots.map((entry) => entry.startMinutes)).toEqual([1080, 1095, 1110]);
  });

  it("returns nothing for a day with no games rather than an empty hour", () => {
    expect(groupByHour([])).toEqual([]);
  });
});

describe("nearestAvailable", () => {
  const slots = [
    slot({ startMinutes: 1005 }),
    slot({ startMinutes: 1020, available: false, reason: "ARENA_FULL", seatsRemaining: 3 }),
    slot({ startMinutes: 1035 }),
    slot({ startMinutes: 1080 }),
  ];

  it("offers the closest bookable starts, skipping the rejected one", () => {
    expect(nearestAvailable(slots, 1020, 2).map((entry) => entry.startMinutes)).toEqual([1035, 1005]);
  });

  it("breaks a tie towards the later time — a customer can still get there", () => {
    expect(nearestAvailable(slots, 1020, 1)[0].startMinutes).toBe(1035);
  });

  it("never offers an unavailable start as an alternative", () => {
    expect(nearestAvailable(slots, 1005, 3).every((entry) => entry.available)).toBe(true);
  });
});

describe("firstFailingStart", () => {
  it("names the game inside the block that does not fit", () => {
    // COPY.md §8.6 says "the 6:30 PM game right after it doesn't have room" — this is where
    // that 6:30 comes from.
    const singleGame = [
      slot({ startMinutes: 1080 }),
      slot({ startMinutes: 1095, available: false, reason: "ARENA_FULL", seatsRemaining: 2 }),
      slot({ startMinutes: 1110 }),
    ];
    expect(firstFailingStart([1080, 1095], singleGame)).toBe(1095);
  });

  it("treats a start that does not exist as the failure", () => {
    const singleGame = [slot({ startMinutes: 1245 })];
    expect(firstFailingStart([1245, 1260], singleGame)).toBe(1260);
  });

  it("returns null when every game in the block works", () => {
    const singleGame = [slot({ startMinutes: 1080 }), slot({ startMinutes: 1095 })];
    expect(firstFailingStart([1080, 1095], singleGame)).toBeNull();
  });
});

describe("blockEndMinutes", () => {
  it("runs to the end of the last game, not to its start", () => {
    expect(blockEndMinutes([1080, 1095], 15)).toBe(1110);
    expect(blockEndMinutes([1080], 15)).toBe(1095);
  });

  it("refuses an empty block rather than inventing a time", () => {
    expect(() => blockEndMinutes([], 15)).toThrow();
  });
});

describe("dateAvailabilityFor", () => {
  it("reports a closed day as closed even if slots exist on the template", () => {
    expect(dateAvailabilityFor(day({ date: "2026-08-22", closed: true }), ARENA)).toBe("closed");
  });

  it("reports a day with no bookable start as none, not as open", () => {
    const full = day({
      date: "2026-08-22",
      slots: [slot({ startMinutes: 1080, available: false, reason: "ARENA_FULL", seatsRemaining: 0 })],
    });
    expect(dateAvailabilityFor(full, ARENA)).toBe("none");
  });

  it("reports limited only when every remaining start is already scarce", () => {
    const scarce = day({
      date: "2026-08-22",
      slots: [slot({ startMinutes: 1080, seatsRemaining: 3 }), slot({ startMinutes: 1095, seatsRemaining: 5 })],
    });
    const mixed = day({
      date: "2026-08-22",
      slots: [slot({ startMinutes: 1080, seatsRemaining: 3 }), slot({ startMinutes: 1095, seatsRemaining: 20 })],
    });
    expect(dateAvailabilityFor(scarce, ARENA)).toBe("limited");
    expect(dateAvailabilityFor(mixed, ARENA)).toBe("open");
  });
});

describe("dayOutcomeFor", () => {
  it("separates closed, no games and full — three different sentences in COPY.md §8", () => {
    expect(dayOutcomeFor(day({ date: "2026-08-22", closed: true }))).toBe("DAY_CLOSED");
    expect(dayOutcomeFor(day({ date: "2026-08-22", slots: [] }))).toBe("NO_GAMES");
    expect(
      dayOutcomeFor(
        day({
          date: "2026-08-22",
          slots: [slot({ startMinutes: 1080, available: false, reason: "ARENA_FULL" })],
        }),
      ),
    ).toBe("DAY_FULL");
    expect(
      dayOutcomeFor(day({ date: "2026-08-22", slots: [slot({ startMinutes: 1080 })] })),
    ).toBe("OK");
  });
});

describe("nextDaysWithRoom / nextOpenDay", () => {
  const days = [
    day({ date: "2026-08-22", nextAvailableStartMinutes: null, slots: [slot({ startMinutes: 780 })] }),
    day({ date: "2026-08-23", closed: true }),
    day({ date: "2026-08-24", nextAvailableStartMinutes: 795, slots: [slot({ startMinutes: 795 })] }),
    day({ date: "2026-08-25", nextAvailableStartMinutes: 720, slots: [slot({ startMinutes: 720 })] }),
  ];

  it("only offers later days, and only ones with room for this group", () => {
    expect(nextDaysWithRoom(days, "2026-08-22", 2)).toEqual([
      { date: "2026-08-24", startMinutes: 795 },
      { date: "2026-08-25", startMinutes: 720 },
    ]);
  });

  it("returns fewer than asked rather than padding — the caller drops to other copy", () => {
    expect(nextDaysWithRoom(days, "2026-08-24", 2)).toHaveLength(1);
  });

  it("finds the next day the venue is actually open, full or not", () => {
    expect(nextOpenDay(days, "2026-08-22")?.date).toBe("2026-08-24");
    expect(nextOpenDay(days, "2026-08-25")).toBeNull();
  });
});
