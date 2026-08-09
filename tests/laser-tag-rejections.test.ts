/**
 * Every failure state on the laser tag flow, and the sentence it produces.
 *
 * STRATEGY §0's failure contract says each rejection names **what happened, why in the
 * venue's terms, and the next action as a tappable control**. That is three assertions per
 * state, and it is why these tests check the rendered string and the actions rather than just
 * that a function returned something.
 *
 * Two things they pin that nothing else can:
 *
 * 1. **No placeholder ever reaches a customer.** `interpolate` throws in development on a
 *    missing value, so every case here is also a proof that the copy's placeholders and the
 *    facts this surface can supply actually line up.
 * 2. **The alternatives ladder.** COPY.md §8 assumes a rejected time has two or three
 *    neighbours. When a day has fewer, these check that the code falls back to a real string
 *    from the deck instead of shipping a half-filled sentence.
 */

import { describe, expect, it } from "vitest";

import {
  alternativesNear,
  arenaFullAtSubmitContent,
  cutoffAtSubmitContent,
  dayClosedContent,
  dayFullContent,
  groupTooLargeContent,
  holdExpiredContent,
  serverErrorContent,
  slotRejectionContent,
  weekendMorningContent,
  type RejectionContext,
} from "@/app/laser-tag/_lib/rejections";
import { hasPlaceholders } from "@/lib/copy";

/** 12:00 PM to 8:45 PM on a quarter-hour, the seeded weekday shape. */
const ALL_STARTS = Array.from({ length: 36 }, (_, index) => 720 + index * 15);

function context(overrides: Partial<RejectionContext> = {}): RejectionContext {
  return {
    date: "2026-08-22",
    players: 6,
    games: 2,
    arenaCapacity: 25,
    cutoffMinutes: 90,
    phone: "204-474-5900",
    openMinutes: 720,
    gameDurationMinutes: 15,
    gameIntervalMinutes: 15,
    nowMinutes: 1092, // 6:12 PM, the example in STRATEGY §3.1
    earliestOnlineStartMinutes: 1185, // 7:45 PM
    oneGamePricePerPersonCents: 849,
    availableStarts: ALL_STARTS,
    nextDays: [
      { date: "2026-08-23", startMinutes: 795 },
      { date: "2026-08-24", startMinutes: 720 },
    ],
    currentYear: 2026,
    ...overrides,
  };
}

/** Every rejection must be complete prose with at least one real control behind it. */
function expectUsable(content: { title: string; body: string; actions: unknown[] } | null) {
  expect(content).not.toBeNull();
  if (!content) return;
  expect(hasPlaceholders(content.title)).toBe(false);
  expect(hasPlaceholders(content.body)).toBe(false);
  expect(content.title.length).toBeGreaterThan(0);
  expect(content.body.length).toBeGreaterThan(0);
  expect(content.actions.length).toBeGreaterThan(0);
}

describe("alternativesNear", () => {
  it("returns null rather than a short list — the caller must drop to other copy", () => {
    expect(alternativesNear([720, 735], 720, 3)).toBeNull();
    expect(alternativesNear([720, 735, 750, 765], 720, 3)).toEqual([735, 750, 765]);
  });
});

describe("browse-time rejections (COPY.md §8)", () => {
  it("ONLINE_CUTOFF names the current time, the cutoff and the earliest legal start", () => {
    const content = slotRejectionContent(
      { startMinutes: 1110, blockStartMinutes: [1110, 1125], seatsRemaining: 25, reason: "ONLINE_CUTOFF" },
      context(),
    );
    expectUsable(content);
    expect(content?.body).toContain("90 minutes ahead");
    expect(content?.body).toContain("204-474-5900");
    expect(content?.actions[0]).toMatchObject({ kind: "takeTime", startMinutes: 1185 });
    expect(content?.actions[1]).toMatchObject({ kind: "callWalkIn" });
  });

  it("SLOT_HELD_FOR_PARTY explains the hold can release and offers two nearby games", () => {
    const content = slotRejectionContent(
      { startMinutes: 1035, blockStartMinutes: [1035, 1050], seatsRemaining: 25, reason: "SLOT_HELD_FOR_PARTY" },
      context(),
    );
    expectUsable(content);
    expect(content?.body).toContain("worth checking back");
    expect(content?.actions).toHaveLength(2);
    expect(content?.actions.every((action) => action.kind === "takeTime")).toBe(true);
  });

  it("PARTY_ONLY_WINDOW offers the first public game and the party flow", () => {
    const content = slotRejectionContent(
      { startMinutes: 630, blockStartMinutes: [630, 645], seatsRemaining: 25, reason: "PARTY_ONLY_WINDOW" },
      context(),
    );
    expectUsable(content);
    expect(content?.actions[0]).toMatchObject({ kind: "takeTime", startMinutes: 720 });
    expect(content?.actions[1]).toMatchObject({ kind: "bookParty" });
  });

  it("SLOT_UNAVAILABLE never leaks the internal block reason", () => {
    const content = slotRejectionContent(
      { startMinutes: 1005, blockStartMinutes: [1005, 1020], seatsRemaining: 25, reason: "SLOT_UNAVAILABLE" },
      context(),
    );
    expectUsable(content);
    expect(content?.body.toLowerCase()).not.toContain("maintenance");
    expect(content?.body).toContain("taken this game out");
  });

  it("ARENA_FULL states the spots left, the group size and three times that fit", () => {
    const content = slotRejectionContent(
      { startMinutes: 1095, blockStartMinutes: [1095, 1110], seatsRemaining: 3, reason: "ARENA_FULL" },
      context(),
    );
    expectUsable(content);
    expect(content?.body).toContain("3 spots left");
    expect(content?.body).toContain("all 6 of you");
    expect(content?.actions[1]).toMatchObject({ kind: "reduceGroup" });
  });

  it("ARENA_FULL uses the singular spot when exactly one is left", () => {
    const content = slotRejectionContent(
      { startMinutes: 1095, blockStartMinutes: [1095, 1110], seatsRemaining: 1, reason: "ARENA_FULL" },
      context(),
    );
    expect(content?.body).toContain("1 spot left");
  });

  it("PARTIAL_BLOCK names the failing game, two blocks that fit, and the one-game escape", () => {
    const content = slotRejectionContent(
      {
        startMinutes: 1095,
        blockStartMinutes: [1095, 1110],
        seatsRemaining: 12,
        reason: "PARTIAL_BLOCK",
        failingStartMinutes: 1110,
      },
      context(),
    );
    expectUsable(content);
    expect(content?.title).toContain("2 games");
    expect(content?.body).toContain("back-to-back");
    // The block runs first start → end of the last game: 15 minutes past the second start.
    expect(content?.actions[0].label).toMatch(/→/);
    expect(content?.actions[1]).toMatchObject({ kind: "oneGame", startMinutes: 1095 });
    expect(content?.actions[1].label).toContain("$8.49");
  });

  it("a bookable slot produces no panel at all", () => {
    expect(
      slotRejectionContent(
        { startMinutes: 1080, blockStartMinutes: [1080, 1095], seatsRemaining: 20, reason: null },
        context(),
      ),
    ).toBeNull();
  });
});

describe("the alternatives ladder", () => {
  it("drops to err.dayFull.games when the day cannot supply the times the copy names", () => {
    const content = slotRejectionContent(
      { startMinutes: 1095, blockStartMinutes: [1095, 1110], seatsRemaining: 3, reason: "ARENA_FULL" },
      context({ availableStarts: [1080] }),
    );
    expectUsable(content);
    expect(content?.body).toContain("The nearest days with room");
    expect(content?.actions.every((action) => action.kind === "goToDate")).toBe(true);
  });

  it("returns null when even the day-level copy cannot be filled, so the caller can decide", () => {
    const content = slotRejectionContent(
      { startMinutes: 1095, blockStartMinutes: [1095, 1110], seatsRemaining: 0, reason: "ARENA_FULL" },
      context({ availableStarts: [], nextDays: [] }),
    );
    expect(content).toBeNull();
  });
});

describe("whole-day and whole-flow states", () => {
  it("DAY_FULL names the group size and two dates that work", () => {
    const content = dayFullContent(context());
    expectUsable(content);
    expect(content?.title).toContain("group of 6");
    expect(content?.body).toContain("Sun, Aug 23");
    expect(content?.actions[0]).toMatchObject({ kind: "goToDate", date: "2026-08-23" });
  });

  it("DAY_CLOSED names the next open day and its real hours", () => {
    const content = dayClosedContent(context(), {
      date: "2026-08-24",
      hoursLine: "12:00 – 9:00 PM",
    });
    expectUsable(content);
    expect(content?.body).toContain("Mon, Aug 24");
    expect(content?.body).toContain("12:00 – 9:00 PM");
  });

  it("the weekend-morning explanation offers the first public game and the party flow", () => {
    const content = weekendMorningContent(context({ availableStarts: [720, 735] }));
    expectUsable(content);
    expect(content?.title).toContain("12:00");
    expect(content?.actions[1]).toMatchObject({ kind: "bookParty" });
  });

  it("GROUP_TOO_LARGE explains the split and puts the phone number in the body and the button", () => {
    const content = groupTooLargeContent({ arenaCapacity: 25, phone: "204-474-5900" });
    expectUsable(content);
    expect(content.title).toContain("25");
    expect(content.body).toContain("204-474-5900");
    expect(content.actions[0]).toMatchObject({ kind: "call" });
  });

  it("SERVER_ERROR is the one rung that needs no venue facts and still offers the phone", () => {
    const content = serverErrorContent("204-474-5900");
    expectUsable(content);
    expect(content.body).toContain("Nothing has been charged");
  });
});

describe("submit-time variants are different copy from browse-time", () => {
  it("the cutoff at submit says nothing was charged and the details are saved", () => {
    const browse = slotRejectionContent(
      { startMinutes: 1260, blockStartMinutes: [1260, 1275], seatsRemaining: 25, reason: "ONLINE_CUTOFF" },
      context(),
    );
    const submit = cutoffAtSubmitContent(context(), 1260);
    expectUsable(submit);
    expect(submit?.title).not.toBe(browse?.title);
    expect(submit?.body).toContain("Nothing has been charged and your details are saved");
    expect(submit?.actions[0].label).toContain("keeps everything else");
  });

  it("the arena filling at submit offers two one-tap moves that keep the details", () => {
    const content = arenaFullAtSubmitContent(context(), { startMinutes: 1095, seatsRemaining: 4 });
    expectUsable(content);
    expect(content?.body).toContain("4 spots");
    expect(content?.body).toContain("Nothing has been charged");
    expect(content?.actions).toHaveLength(2);
    expect(content?.actions.every((action) => action.kind === "takeTime")).toBe(true);
  });

  it("an expired hold reads differently depending on whether the time survived", () => {
    const stillOpen = holdExpiredContent(context(), {
      startMinutes: 1140,
      stillOpen: true,
      holdMinutes: 15,
    });
    const gone = holdExpiredContent(context(), {
      startMinutes: 1140,
      stillOpen: false,
      holdMinutes: 15,
    });
    expectUsable(stillOpen);
    expectUsable(gone);
    expect(stillOpen?.body).toContain("still open");
    expect(gone?.body).toContain("was taken while the hold was down");
    expect(stillOpen?.actions[0].label).toContain("Hold");
    expect(gone?.actions[0].label).toContain("Take");
  });
});
