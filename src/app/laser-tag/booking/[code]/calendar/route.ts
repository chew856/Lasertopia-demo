import { global, interpolate, laserTag } from "@/lib/copy";
import { prisma } from "@/lib/db/client";
import { formatBookingCode, formatDateLong, formatTimeList, unitLabel } from "@/lib/format";

import { buildCalendarEvent } from "../../../_lib/calendar";
import { isGamesBookingCode, normaliseBookingCode } from "../../../_lib/booking-code";
import { loadVenue } from "../../../_lib/venue";

/**
 * `GET /laser-tag/booking/[code]/calendar` — the `.ics` behind G5's [Add to calendar].
 *
 * The booking code is the only credential this product has, so it is the only credential this
 * route accepts. It is checked against the code format before it reaches the database, which
 * keeps a scan for `/calendar` from turning into a query per guess.
 *
 * A cancelled booking returns 404 rather than an event: putting a cancelled game into
 * somebody's calendar is worse than the download failing.
 */
export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code: raw } = await context.params;
  const code = normaliseBookingCode(raw);
  if (!isGamesBookingCode(code)) return new Response(null, { status: 404 });

  const { config } = await loadVenue();
  const booking = await prisma.booking.findUnique({
    where: { reference: code },
    include: {
      publicGame: true,
      games: { include: { gameSlot: { select: { startMinutes: true, startsAtUtc: true } } } },
    },
  });

  if (!booking || booking.type !== "PUBLIC_GAME" || booking.status === "CANCELLED") {
    return new Response(null, { status: 404 });
  }

  const starts = booking.games
    .map((game) => game.gameSlot)
    .sort((a, b) => a.startsAtUtc.getTime() - b.startsAtUtc.getTime());
  if (starts.length === 0) return new Response(null, { status: 404 });

  const players = booking.publicGame?.playerCount ?? 0;
  const last = starts[starts.length - 1];

  const body = buildCalendarEvent({
    uid: `${code}@lasertopia`,
    startsAtUtc: starts[0].startsAtUtc,
    endsAtUtc: new Date(last.startsAtUtc.getTime() + config.gameDurationMinutes * 60_000),
    stampUtc: new Date(),
    summary: `${global.venueName} — ${interpolate(laserTag.g4.readback.players, {
      players,
      "unit.player": unitLabel(players, "player"),
    })}`,
    description: [
      interpolate(laserTag.email.games.code, { code: formatBookingCode(code) }),
      interpolate(laserTag.email.games.when, {
        date: formatDateLong(booking.date, {
          currentYear: Number(booking.date.slice(0, 4)),
        }),
      }),
      interpolate(laserTag.email.games.times, {
        gameTimes: formatTimeList(starts.map((slot) => slot.startMinutes)),
      }),
      global.rule.arrive,
      global.rule.shoes,
    ].join("\n"),
    location: global.address,
  });

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="lasertopia-${code}.ics"`,
      "cache-control": "no-store",
    },
  });
}
