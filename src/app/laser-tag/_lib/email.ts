/**
 * The laser tag confirmation email — COPY.md §12.1, assembled but not sent.
 *
 * Building the message is pure and testable, so it lives here on its own. Delivery is a
 * deployment concern: the repo has no mail transport and adding one is not this surface's
 * call, so `deliverGamesConfirmation` logs the assembled message and is the single place a
 * real transport gets wired in. STRATEGY §3.1 G5 promises the customer an email, and
 * `g5.sub.new` says so on screen — that promise is not kept until this stub is replaced, and
 * that is stated in the handover rather than hidden behind a silent no-op.
 */

import { global, interpolate, laserTag } from "@/lib/copy";
import {
  formatBookingCode,
  formatDateLong,
  formatDateShort,
  formatMoney,
  formatTime,
  formatTimeList,
  unitLabel,
  type LocalDateString,
} from "@/lib/format";

export interface GamesConfirmationInput {
  code: string;
  name: string;
  email: string;
  date: LocalDateString;
  /** Every start time the booking occupies, ascending. */
  startMinutes: readonly number[];
  players: number;
  /** Pre-tax subtotal. Laser tag is quoted plus tax and the copy says so. */
  totalCents: number;
  address: string;
  phone: string;
  cutoffMinutes: number;
  /** Absolute URL of the booking page, for the cancellation line. */
  link: string;
  currentYear: number;
}

export interface GamesConfirmationEmail {
  to: string;
  subject: string;
  preheader: string;
  /** Plain text. HTML shares the same copy (§12) and is not a different message. */
  text: string;
}

export function buildGamesConfirmationEmail(
  input: GamesConfirmationInput,
): GamesConfirmationEmail {
  const code = formatBookingCode(input.code);
  const gameTimes = formatTimeList(input.startMinutes);
  const playerUnit = unitLabel(input.players, "player");

  const lines = [
    laserTag.email.games.heading,
    "",
    interpolate(laserTag.email.games.intro, { name: input.name }),
    "",
    interpolate(laserTag.email.games.code, { code }),
    interpolate(laserTag.email.games.when, {
      date: formatDateLong(input.date, { currentYear: input.currentYear }),
    }),
    interpolate(laserTag.email.games.times, { gameTimes }),
    interpolate(laserTag.email.games.players, { players: input.players }),
    interpolate(laserTag.email.games.price, { total: formatMoney(input.totalCents) }),
    interpolate(laserTag.email.games.where, { address: input.address }),
    "",
    laserTag.email.games.arrive,
    "",
    laserTag.email.games.rulesHeading,
    laserTag.email.games.rulesBody,
    "",
    interpolate(laserTag.email.games.cancel, {
      cutoffMinutes: input.cutoffMinutes,
      link: input.link,
    }),
    interpolate(laserTag.email.games.help, { phone: input.phone }),
    "",
    interpolate(laserTag.email.games.footer, { address: input.address, phone: input.phone }),
  ];

  return {
    to: input.email,
    subject: interpolate(laserTag.email.games.subject, {
      dateShort: formatDateShort(input.date),
      time: formatTime(input.startMinutes[0]),
    }),
    preheader: interpolate(laserTag.email.games.preheader, {
      code,
      players: input.players,
      "unit.player": playerUnit,
      gameTimes,
    }),
    text: lines.join("\n"),
  };
}

/**
 * Hand the message to a transport. There is none in this repo, so it goes to the server log.
 *
 * Deliberately never throws: a mail failure must not roll back a booking the customer has
 * already been told is confirmed, and the booking code on screen is what the front desk works
 * from. Wire a real transport here — it is the only call site.
 */
export function deliverGamesConfirmation(message: GamesConfirmationEmail): void {
  try {
    console.info(
      `[email] TODO: no transport configured. Would send to ${message.to}\n` +
        `Subject: ${message.subject}\n${message.text}`,
    );
  } catch {
    // A logging failure is never a booking failure.
  }
}
