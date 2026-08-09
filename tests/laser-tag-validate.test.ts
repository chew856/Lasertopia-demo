/**
 * Input validation, booking codes and the calendar file for the laser tag surface.
 *
 * Everything here guards a boundary the customer controls: a form field, a cookie, a URL
 * segment. The tests are written from the failure side — what a tampered draft or a mistyped
 * phone number must *not* be allowed to become — because that is the direction these
 * functions exist to stop.
 */

import { describe, expect, it } from "vitest";

import {
  CODE_ALPHABET,
  codeFromBytes,
  generateBookingCode,
  isGamesBookingCode,
  normaliseBookingCode,
} from "@/app/laser-tag/_lib/booking-code";
import { buildCalendarEvent, escapeText, formatIcsInstant } from "@/app/laser-tag/_lib/calendar";
import {
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  isValidEmail,
  normalisePhone,
  parseBoundedInteger,
  parseCalendarDate,
  validateDetails,
} from "@/app/laser-tag/_lib/validate";

describe("normalisePhone", () => {
  it("accepts the shapes a customer actually types", () => {
    for (const input of ["204-555-0134", "(204) 555-0134", "204.555.0134", "+1 204 555 0134", "12045550134"]) {
      expect(normalisePhone(input)).toBe("2045550134");
    }
  });

  it("rejects numbers that cannot exist in the numbering plan", () => {
    expect(normalisePhone("104-555-0134")).toBeNull(); // area code cannot start with 1
    expect(normalisePhone("204-155-0134")).toBeNull(); // exchange cannot start with 1
    expect(normalisePhone("204-555-013")).toBeNull(); // nine digits
    expect(normalisePhone("")).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("dana@example.ca")).toBe(true);
    expect(isValidEmail("dana.cheway+lasertag@mail.example.co.uk")).toBe(true);
  });

  it("rejects exactly what the copy says it rejects — a missing @ or a missing domain", () => {
    expect(isValidEmail("dana.example.ca")).toBe(false);
    expect(isValidEmail("dana@example")).toBe(false);
    expect(isValidEmail("dana@ example.ca")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("validateDetails", () => {
  const good = {
    name: "Dana Cheway",
    phone: "204-555-0134",
    email: "dana@example.ca",
    note: "",
  };

  it("normalises what it accepts, so the stored phone has no formatting in it", () => {
    const result = validateDetails({ ...good, phone: "(204) 555-0134", name: "  Dana Cheway  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phone).toBe("2045550134");
      expect(result.value.name).toBe("Dana Cheway");
    }
  });

  it("reports every failing field at once, not the first one", () => {
    const result = validateDetails({ name: "", phone: "", email: "nope", note: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        name: "NAME_REQUIRED",
        phone: "PHONE_REQUIRED",
        email: "EMAIL_INVALID",
      });
    }
  });

  it("separates a missing value from an unusable one — they are different sentences", () => {
    const missing = validateDetails({ ...good, phone: "" });
    const invalid = validateDetails({ ...good, phone: "555" });
    expect(missing.ok || invalid.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.phone).toBe("PHONE_REQUIRED");
    if (!invalid.ok) expect(invalid.errors.phone).toBe("PHONE_INVALID");
  });

  it("enforces the lengths the copy promises", () => {
    const longName = validateDetails({ ...good, name: "a".repeat(MAX_NAME_LENGTH + 1) });
    const longNote = validateDetails({ ...good, note: "a".repeat(MAX_NOTE_LENGTH + 1) });
    expect(longName.ok).toBe(false);
    if (!longName.ok) expect(longName.errors.name).toBe("NAME_TOO_LONG");
    expect(longNote.ok).toBe(false);
    if (!longNote.ok) expect(longNote.errors.note).toBe("NOTE_TOO_LONG");
  });
});

describe("parseBoundedInteger", () => {
  it("takes an in-range integer from a string or a number", () => {
    expect(parseBoundedInteger("6", { min: 1, max: 25 })).toBe(6);
    expect(parseBoundedInteger(6, { min: 1, max: 25 })).toBe(6);
  });

  it("refuses everything a hand-edited cookie could hold", () => {
    for (const value of ["26", "0", "-1", "6.5", "six", "", null, undefined, {}, NaN, Infinity]) {
      expect(parseBoundedInteger(value, { min: 1, max: 25 })).toBeNull();
    }
  });
});

describe("parseCalendarDate", () => {
  it("accepts a real wall-clock date", () => {
    expect(parseCalendarDate("2026-08-22")).toBe("2026-08-22");
  });

  it("refuses a date that does not exist, not just one that is misshaped", () => {
    expect(parseCalendarDate("2026-02-30")).toBeNull();
    expect(parseCalendarDate("2026-13-01")).toBeNull();
    expect(parseCalendarDate("22/08/2026")).toBeNull();
    expect(parseCalendarDate(20260822)).toBeNull();
  });
});

describe("booking codes", () => {
  it("is LT- plus eight characters from an alphabet with no lookalikes", () => {
    const code = generateBookingCode();
    expect(code).toMatch(/^LT-[A-Z2-9]{8}$/);
    expect(isGamesBookingCode(code)).toBe(true);
    for (const ambiguous of ["0", "O", "1", "I"]) {
      expect(CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("maps bytes onto the alphabet with no modulo bias", () => {
    // 32 symbols is exactly five bits, so byte and byte+32 must land on the same character.
    expect(codeFromBytes(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]))).toBe("LT-23456789");
    expect(codeFromBytes(Uint8Array.from([32, 33, 34, 35, 36, 37, 38, 39]))).toBe("LT-23456789");
  });

  it("refuses to build a code from too little entropy", () => {
    expect(() => codeFromBytes(Uint8Array.from([1, 2, 3]))).toThrow();
  });

  it("accepts a lower-case code but not a party prefix", () => {
    expect(normaliseBookingCode(" lt-4kj2qw9x ")).toBe("LT-4KJ2QW9X");
    expect(isGamesBookingCode("lt-4kj2qw9x")).toBe(true);
    expect(isGamesBookingCode("PT-4KJ2QW9X")).toBe(false);
    expect(isGamesBookingCode("LT-4KJ2QW9")).toBe(false);
  });
});

describe("calendar file", () => {
  it("writes instants in UTC so no calendar can misread the zone", () => {
    expect(formatIcsInstant(new Date(Date.UTC(2026, 7, 22, 23, 15, 0)))).toBe("20260822T231500Z");
  });

  it("escapes the characters RFC 5545 gives meaning to", () => {
    expect(escapeText("Games: 6:00, 6:15; bring shoes\nand a code")).toBe(
      "Games: 6:00\\, 6:15\\; bring shoes\\nand a code",
    );
    expect(escapeText("a\\b")).toBe("a\\\\b");
  });

  it("produces a single CRLF-delimited event with a stable UID", () => {
    const ics = buildCalendarEvent({
      uid: "LT-4KJ2QW9X@lasertopia",
      startsAtUtc: new Date(Date.UTC(2026, 7, 22, 23, 0, 0)),
      endsAtUtc: new Date(Date.UTC(2026, 7, 22, 23, 30, 0)),
      stampUtc: new Date(Date.UTC(2026, 7, 20, 12, 0, 0)),
      summary: "Lasertopia — 6 players",
      description: "Booking code: LT-4KJ2QW9X",
      location: "Unit #5 – 1140 Waverley Street, Winnipeg, MB",
    });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("UID:LT-4KJ2QW9X@lasertopia");
    expect(ics).toContain("DTSTART:20260822T230000Z");
    expect(ics).toContain("DTEND:20260822T233000Z");
    expect(ics.split("BEGIN:VEVENT")).toHaveLength(2);
    expect(ics.includes("\n\n")).toBe(false);
  });
});
