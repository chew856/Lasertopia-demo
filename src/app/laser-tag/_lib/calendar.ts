/**
 * The `.ics` file behind G5's [Add to calendar] — STRATEGY §3.1 lists it as part of the
 * confirmation, and a booking a customer cannot get into their calendar is a booking they can
 * forget.
 *
 * RFC 5545 by hand rather than by dependency: an event with no recurrence, no attendees and
 * no timezone definitions is a dozen lines, and the two things that actually go wrong —
 * CRLF line endings and unescaped commas in the description — are cheaper to get right here
 * than to audit in a library.
 *
 * Times are written as UTC instants (the trailing `Z`), which is the one representation that
 * cannot be misread by a calendar in another zone. The venue's wall clock is already resolved
 * by `zonedTimeToUtc` before it reaches this module.
 */

export interface CalendarEventInput {
  /** Stable across re-downloads so a calendar updates the event instead of duplicating it. */
  uid: string;
  startsAtUtc: Date;
  endsAtUtc: Date;
  /** The instant the file was generated. */
  stampUtc: Date;
  summary: string;
  description: string;
  location: string;
}

/** RFC 5545 §3.3.11: commas, semicolons and backslashes are escaped; newlines become `\n`. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** `20260822T183000Z`. */
export function formatIcsInstant(instant: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return (
    `${pad(instant.getUTCFullYear(), 4)}${pad(instant.getUTCMonth() + 1)}${pad(instant.getUTCDate())}` +
    `T${pad(instant.getUTCHours())}${pad(instant.getUTCMinutes())}${pad(instant.getUTCSeconds())}Z`
  );
}

export function buildCalendarEvent(input: CalendarEventInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lasertopia//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${formatIcsInstant(input.stampUtc)}`,
    `DTSTART:${formatIcsInstant(input.startsAtUtc)}`,
    `DTEND:${formatIcsInstant(input.endsAtUtc)}`,
    `SUMMARY:${escapeText(input.summary)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    `LOCATION:${escapeText(input.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // CRLF is not optional in RFC 5545, and the parsers that tolerate LF are not the ones on a
  // customer's phone.
  return `${lines.join("\r\n")}\r\n`;
}
