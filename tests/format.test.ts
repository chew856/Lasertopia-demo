/**
 * COPY.md §1 is a table of exact outputs. These tests are that table.
 *
 * Every expectation below is a literal example from the deck, so a formatter that drifts —
 * a lost non-breaking space, a hyphen where an en dash belongs, "1.5 hrs" — fails here rather
 * than on a customer's screen.
 */

import { describe, expect, it } from "vitest";

import { global, interpolate, MissingCopyValueError, placeholdersIn } from "@/lib/copy";
import {
  formatBlock,
  formatBlockSub,
  formatBookingCode,
  formatCapacity,
  formatCount,
  formatCountdown,
  formatDateIso,
  formatDateLong,
  formatDateShort,
  formatDayNumber,
  formatDuration,
  formatDurationHours,
  formatDurationMinutes,
  formatGuests,
  formatMoney,
  formatMoneyCad,
  formatMoneyPerPerson,
  formatMoneyPlain,
  formatPercent,
  formatPercentFromMilli,
  formatPhone,
  formatPhoneHref,
  formatPlayers,
  formatTime,
  formatTimeCompact,
  formatTimeList,
  formatTimeRange,
  formatWeekday,
  FormatError,
  unitLabel,
} from "@/lib/format";

const NBSP = " ";

describe("fmt.time", () => {
  it("is 12-hour with no leading zero and an uppercase meridiem", () => {
    expect(formatTime(19 * 60 + 45)).toBe(`7:45${NBSP}PM`);
    expect(formatTime(12 * 60)).toBe(`12:00${NBSP}PM`);
    expect(formatTime(0)).toBe(`12:00${NBSP}AM`);
  });

  it("separates the meridiem with a non-breaking space, not a plain one", () => {
    expect(formatTime(1035)).not.toContain(" PM");
    expect(formatTime(1035)).toContain(NBSP);
  });

  it("drops the meridiem in the compact form used inside dense grids", () => {
    expect(formatTimeCompact(17 * 60 + 15)).toBe("5:15");
  });
});

describe("fmt.range and fmt.block", () => {
  it("shows the meridiem once when both ends share it", () => {
    expect(formatTimeRange(13 * 60, 15 * 60)).toBe(`1:00 – 3:00${NBSP}PM`);
  });

  it("shows both meridiems when the range crosses noon", () => {
    expect(formatTimeRange(10 * 60, 12 * 60)).toBe(`10:00${NBSP}AM – 12:00${NBSP}PM`);
  });

  it("uses an arrow for a multi-game block", () => {
    expect(formatBlock(18 * 60, 18 * 60 + 30)).toBe(`6:00 → 6:30${NBSP}PM`);
  });

  it("middot-separates the starts inside a block", () => {
    expect(formatBlockSub([18 * 60, 18 * 60 + 15])).toBe("6:00 · 6:15");
  });
});

describe("fmt.date", () => {
  it("omits the year in the current year and appends it otherwise", () => {
    expect(formatDateLong("2026-08-22", { currentYear: 2026 })).toBe("Saturday, August 22");
    expect(formatDateLong("2027-08-22", { currentYear: 2026 })).toBe("Sunday, August 22, 2027");
  });

  it("abbreviates weekday and month in the short form", () => {
    expect(formatDateShort("2026-08-22")).toBe("Sat, Aug 22");
  });

  it("keeps the ISO form for manager surfaces, and rejects a date that does not exist", () => {
    expect(formatDateIso("2026-08-22")).toBe("2026-08-22");
    expect(() => formatDateIso("2026-02-30")).toThrow();
  });

  it("reads a calendar date as a wall clock, never shifting a day", () => {
    // The classic off-by-one: a UTC-midnight instant is the previous evening in Winnipeg.
    expect(formatWeekday("2026-08-22")).toBe("Saturday");
    expect(formatDayNumber("2026-08-22")).toBe("22");
  });
});

describe("fmt.list.times", () => {
  it("joins two with and, three or more with commas and a final and", () => {
    expect(formatTimeList([13 * 60 + 15, 13 * 60 + 45])).toBe(
      `1:15${NBSP}PM and 1:45${NBSP}PM`,
    );
    expect(formatTimeList([13 * 60 + 15, 13 * 60 + 45, 14 * 60 + 15])).toBe(
      `1:15${NBSP}PM, 1:45${NBSP}PM and 2:15${NBSP}PM`,
    );
  });
});

describe("fmt.money", () => {
  it("formats from integer cents with a leading dollar sign and two decimals", () => {
    expect(formatMoney(22450)).toBe("$224.50");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(25950)).toBe("$259.50");
  });

  it("refuses a float, because the engine speaks cents", () => {
    expect(() => formatMoney(224.5)).toThrow();
  });

  it("adds the currency code only where it must be explicit", () => {
    expect(formatMoneyCad(22450)).toBe("$224.50 CAD");
  });

  it("appends the per-person unit", () => {
    expect(formatMoneyPerPerson(1549)).toBe("$15.49 per person");
  });

  it("drops the symbol for the order summary's aligned amount column", () => {
    expect(formatMoneyPlain(25950)).toBe("259.50");
    expect(formatMoneyPlain(5000)).toBe("50.00");
  });
});

describe("fmt.percent, fmt.duration, fmt.countdown, fmt.capacity, fmt.code, fmt.phone", () => {
  it("renders a whole-number rate without decimals", () => {
    expect(formatPercent(12)).toBe("12%");
    expect(formatPercent(12.5)).toBe("12.5%");
    expect(formatPercentFromMilli(12000)).toBe("12%");
  });

  it("uses hours only for whole hours and never renders a decimal hour", () => {
    expect(formatDurationHours(120)).toBe("2 hours");
    expect(formatDurationHours(60)).toBe("1 hour");
    expect(formatDurationMinutes(90)).toBe("90 minutes");
    expect(formatDuration(120)).toBe("2 hours");
    expect(formatDuration(90)).toBe("90 minutes");
    expect(() => formatDurationHours(90)).toThrow(FormatError);
  });

  it("counts down in mm:ss with no leading zero on the minutes", () => {
    expect(formatCountdown(252)).toBe("4:12");
    expect(formatCountdown(59)).toBe("0:59");
    expect(formatCountdown(600)).toBe("10:00");
  });

  it("spaces the capacity slash", () => {
    expect(formatCapacity(14, 25)).toBe("14 / 25");
  });

  it("uppercases a booking code and keeps its hyphen", () => {
    expect(formatBookingCode("pt-4kj2qw9x")).toBe("PT-4KJ2QW9X");
  });

  it("hyphenates a phone number and never parenthesises it", () => {
    expect(formatPhone("2044745900")).toBe("204-474-5900");
    expect(formatPhone("(204) 474-5900")).toBe("204-474-5900");
    expect(formatPhone("+1 204 474 5900")).toBe("204-474-5900");
    expect(formatPhoneHref("204-474-5900")).toBe("tel:+12044745900");
    expect(() => formatPhone("4745900")).toThrow(FormatError);
  });
});

describe("§1.1 units", () => {
  it("calls arena seats spots, never seats", () => {
    expect(unitLabel(1, "spot")).toBe("spot");
    expect(unitLabel(3, "spot")).toBe("spots");
    expect(formatCount(0, "spot")).toBe("0 spots");
  });

  it("pluralises party correctly", () => {
    expect(unitLabel(2, "party")).toBe("parties");
  });

  it("formats the two headline counts", () => {
    expect(formatGuests(16)).toBe("16 guests");
    expect(formatPlayers(1)).toBe("1 player");
  });
});

describe("copy interpolation", () => {
  it("fills a placeholder from the deck", () => {
    expect(interpolate(global.rule.cutoff, { cutoffMinutes: 90 })).toBe(
      "Online booking closes 90 minutes before a game starts, so we can look after walk-ins.",
    );
    expect(interpolate(global.btn.reserveDeposit, { deposit: formatMoney(5000) })).toBe(
      "Reserve with a $50.00 deposit",
    );
  });

  it("needs no argument for a string with no placeholders", () => {
    expect(interpolate(global.btn.continue)).toBe("Continue");
    expect(interpolate(global.rule.shoes)).toBe(
      "Clean closed-toed shoes are required in the arena.",
    );
  });

  it("throws in development rather than rendering literal braces at a customer", () => {
    expect(() =>
      // @ts-expect-error — the missing value is a compile error too; this proves the runtime.
      interpolate(global.phoneCall, {}),
    ).toThrow(MissingCopyValueError);
  });

  it("names every missing placeholder in the error", () => {
    try {
      // @ts-expect-error — deliberately unfilled.
      interpolate(global.hold.partyExplain, { window: "1:00 – 3:00 PM" });
      throw new Error("expected a MissingCopyValueError");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingCopyValueError);
      expect((error as MissingCopyValueError).missing).toEqual(["dateShort", "holdMinutes"]);
    }
  });

  it("reports the placeholders a string declares", () => {
    expect(placeholdersIn(global.status.pendingDepositBody)).toEqual(["deposit", "phone"]);
  });
});

describe("the deck itself", () => {
  it("contains no emoji and no exclamation marks, as COPY.md §0.1 requires", () => {
    const strings: string[] = [];
    const walk = (node: unknown) => {
      if (typeof node === "string") strings.push(node);
      else if (node && typeof node === "object") Object.values(node).forEach(walk);
    };
    walk(global);

    expect(strings.length).toBeGreaterThan(60);
    for (const value of strings) {
      expect(value).not.toContain("!");
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(value)).toBe(false);
    }
  });

  it("holds the venue facts the whole product reads off", () => {
    expect(global.phone).toBe("204-474-5900");
    expect(formatPhone(global.phone)).toBe(global.phone);
    expect(global.productName).toBe("Lasertopia Booking");
  });
});
