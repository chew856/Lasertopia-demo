import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Caption,
  EmptyState,
  Eyebrow,
  FlowSection,
  MEASURE_BODY,
  PageShell,
  cx,
  type DateOption,
} from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { addDays, localDateOf } from "@/lib/domain";
import {
  formatDateLong,
  formatDateShort,
  formatMonth,
  formatTimeList,
  formatTimeRange,
} from "@/lib/format";

import { CallLink, FlowStepHeader, RejectionPanel } from "../_components/flow-chrome";
import { MonthCalendar } from "../_components/month-calendar";
import {
  TakeWindowButton,
  WindowList,
  type WindowRowModel,
} from "../_components/window-list";
import {
  ALTERNATIVE_SEARCH_DAYS,
  formatAlternatives,
  scanAvailability,
} from "../_lib/alternatives";
import {
  dateMarkFor,
  largestCountThatFits,
  monthDates,
  shiftMonth,
  startOfMonth,
} from "../_lib/calendar";
import { sweepExpiredHolds } from "../_lib/draft";
import { parsePartyIntent } from "../_lib/fit";
import { loadVenue } from "../_lib/venue";
import { dayVerdict, presentWindow } from "../_lib/window-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${party.p2.title} — ${global.venueName}`,
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Screen P2 — date and window. **This screen is the product.**
 *
 * It is where the constraint engine becomes visible, and the rule it lives by is that it must
 * never grey something out without saying why: every window on the selected date renders,
 * available or not, with its own reason and its real numbers. The calendar marks are computed
 * for *this* guest count and *this* honoree age, which is only possible because P1 asked first.
 */
export default async function PartyDatePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const { catalog, config } = await loadVenue();
  const now = new Date();

  const intent = parsePartyIntent(
    { guests: first(searchParams.guests), age: first(searchParams.age) },
    catalog,
    config,
  );
  if (!intent.ok) {
    if (intent.problems.some((p) => p.code === "guestsMax")) {
      redirect(`/parties/enquiry?guests=${encodeURIComponent(first(searchParams.guests))}`);
    }
    redirect(
      `/parties?guests=${encodeURIComponent(first(searchParams.guests))}&age=${encodeURIComponent(first(searchParams.age))}`,
    );
  }

  const { guests, honoreeAge } = intent.value;
  await sweepExpiredHolds(now);

  const today = localDateOf(now, config.timezone);
  const horizonEnd = addDays(today, config.bookingHorizonDays);

  const monthParam = first(searchParams.month);
  const dateParam = first(searchParams.date);
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;
  const anchor = /^\d{4}-\d{2}$/.test(monthParam)
    ? `${monthParam}-01`
    : startOfMonth(selectedDate ?? today);

  const monthGridDates = monthDates(anchor);

  // One scan covers both jobs: the month's calendar marks and the "soonest that fits" shortcut.
  const scan = await scanAvailability({
    now,
    from: today,
    days: ALTERNATIVE_SEARCH_DAYS,
    guests,
    honoreeAge,
    catalog,
    config,
    extraDates: monthGridDates,
  });
  const byDate = new Map(scan.days.map((day) => [day.date, day]));

  const statusFor = (availability: DateOption["availability"]): string => {
    switch (availability) {
      case "open":
        return party.p2.date.status.open;
      case "limited":
        return party.p2.date.status.limited;
      case "none":
        return party.p2.date.status.full;
      default:
        return party.p2.date.status.closed;
    }
  };

  const days: DateOption[] = monthGridDates.map((date) => {
    const day = byDate.get(date);
    const outOfRange = date < today || date > horizonEnd;
    const availability: DateOption["availability"] = outOfRange
      ? "closed"
      : day
        ? dateMarkFor(day)
        : "closed";
    const statusLabel = statusFor(availability);
    return {
      date,
      availability,
      statusLabel,
      isToday: date === today,
      // "Full for this party" stays tappable: the parent needs to read *why*, and be handed
      // the nearest windows that do fit. Only genuinely un-bookable dates are disabled.
      disabled: outOfRange || availability === "closed",
      a11yLabel: interpolate(party.p2.date.a11y, {
        date: formatDateShort(date),
        status: statusLabel,
      }),
    };
  });

  const hrefFor = (date: string) =>
    `/parties/date?guests=${guests}&age=${honoreeAge}&date=${date}&month=${date.slice(0, 7)}`;
  const monthHref = (target: string) =>
    `/parties/date?guests=${guests}&age=${honoreeAge}&month=${target.slice(0, 7)}`;

  const previousMonth = shiftMonth(anchor, -1);
  const nextMonth = shiftMonth(anchor, 1);
  const prevHref = monthDates(previousMonth).some((d) => d >= today)
    ? monthHref(previousMonth)
    : null;
  const nextHref = monthDates(nextMonth).some((d) => d <= horizonEnd)
    ? monthHref(nextMonth)
    : null;

  const shortcut = formatAlternatives(scan, 1)[0] ?? null;
  const selectedDay = selectedDate ? (byDate.get(selectedDate) ?? null) : null;
  const verdict = selectedDay ? dayVerdict(selectedDay) : null;

  const rows: WindowRowModel[] = (selectedDay?.windows ?? []).map((window) => {
    const presentation = presentWindow(window, {
      guests,
      honoreeAge,
      config,
      dateLabel: formatDateLong(selectedDay?.date ?? today),
    });
    const roomName = window.selection?.configuration.name ?? null;
    const windowTime = formatTimeRange(window.startMinutes, window.endMinutes);
    const gameTimes = (window.arenaGroups ?? [])
      .flatMap((group) => group.times.map((time) => time.startMinutes))
      .sort((a, b) => a - b);

    return {
      partyWindowId: window.partyWindowId,
      windowTime,
      available: window.available,
      status: presentation.status,
      bayState: presentation.bayState,
      stateWord: presentation.stateWord,
      roomName,
      capacityLabel: presentation.capacityLabel,
      a11yLabel: `${roomName ?? windowTime} · ${presentation.capacityLabel} · ${presentation.stateWord}`,
      reason: presentation.reason,
      // DESIGN principle 6: the age rule gets its own slot in the component it constrains, and
      // only where another party is actually sharing the window.
      constraintNote:
        window.roomSlotsFree < window.roomSlotsTotal || window.reason === "AGE_GAP_EXCEEDED"
          ? interpolate(global.rule.ageBand, { ageBand: config.maxAgeDifferenceYears })
          : null,
      gamesNote:
        window.available && gameTimes.length > 0
          ? interpolate(party.p2.window.selected.games, {
              gameTimes: formatTimeList(gameTimes),
            })
          : null,
      roomsNote:
        window.available && roomName
          ? interpolate(party.p2.window.selected.rooms, { roomNames: roomName })
          : null,
    };
  });

  const dayAlternatives = formatAlternatives(scan, 2, { date: selectedDate });
  const reducedCount = selectedDay ? largestCountThatFits(selectedDay) : 0;

  return (
    <PageShell as="main" width="page" className="py-8 md:py-12">
      <FlowSection>
        <FlowStepHeader step={2} title={party.p2.heading} />
      </FlowSection>

      {/* The constraint being applied, restated where a parent seeing a lot of grey will look. */}
      <FlowSection>
        <div className="flex flex-wrap items-baseline justify-between gap-3 border border-rule bg-raised p-4">
          <p className="text-body-sm text-text">
            {interpolate(party.p2.context, { guests, age: honoreeAge })}
          </p>
          <Link
            href={`/parties?guests=${guests}&age=${honoreeAge}`}
            className="text-body-sm text-accent underline underline-offset-4"
          >
            {party.p2.contextEdit}
          </Link>
        </div>
      </FlowSection>

      {shortcut ? (
        <FlowSection>
          <div className="flex flex-col gap-3 border border-accent bg-raised p-4 md:flex-row md:items-center md:justify-between">
            <p className={cx("text-body-sm text-text", MEASURE_BODY)}>
              {interpolate(party.p2.shortcut, { guests, altWindow1: shortcut.formatted })}
            </p>
            <TakeWindowButton
              label={party.p2.shortcutAction}
              date={shortcut.date}
              partyWindowId={shortcut.partyWindowId}
              guests={guests}
              honoreeAge={honoreeAge}
              variant="secondary"
            />
          </div>
        </FlowSection>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr] lg:gap-12">
        <FlowSection className="lg:mt-0">
          <MonthCalendar
            label={interpolate(party.p2.calendar.label, { month: formatMonth(anchor) })}
            days={days}
            selected={selectedDate}
            hrefFor={hrefFor}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        </FlowSection>

        <FlowSection className="lg:mt-0">
          {selectedDay === null ? (
            <EmptyState
              title={party.empty.p2.pickDate.title}
              body={interpolate(party.empty.p2.pickDate.body, { guests, age: honoreeAge })}
              action={
                shortcut ? (
                  <TakeWindowButton
                    label={party.p2.shortcutAction}
                    date={shortcut.date}
                    partyWindowId={shortcut.partyWindowId}
                    guests={guests}
                    honoreeAge={honoreeAge}
                  />
                ) : (
                  <CallLink />
                )
              }
            />
          ) : (
            <div className="flex flex-col gap-6">
              <Eyebrow as="h2">
                {interpolate(party.p2.windows.heading, {
                  date: formatDateLong(selectedDay.date),
                })}
              </Eyebrow>

              {verdict === "DAY_CLOSED" ? (
                <EmptyState
                  title={party.empty.p2.noWindows.title}
                  body={interpolate(party.empty.p2.noWindows.body, {
                    date: formatDateLong(selectedDay.date),
                  })}
                  action={<CallLink />}
                />
              ) : null}

              {verdict === "DAY_FULL" ? (
                <RejectionPanel
                  title={interpolate(party.err.dayFull.title, {
                    date: formatDateLong(selectedDay.date),
                    guests,
                    age: honoreeAge,
                  })}
                  body={
                    dayAlternatives.length >= 2
                      ? interpolate(party.err.dayFull.body, {
                          guests,
                          ageBand: config.maxAgeDifferenceYears,
                          altWindow1: dayAlternatives[0].formatted,
                          altWindow2: dayAlternatives[1].formatted,
                        })
                      : null
                  }
                  actions={
                    <>
                      {dayAlternatives.map((alternative) => (
                        <TakeWindowButton
                          key={`${alternative.date}-${alternative.partyWindowId}`}
                          label={interpolate(global.btn.takeWindow, {
                            altWindow1: alternative.formatted,
                          })}
                          date={alternative.date}
                          partyWindowId={alternative.partyWindowId}
                          guests={guests}
                          honoreeAge={honoreeAge}
                          variant="secondary"
                        />
                      ))}
                      {reducedCount > 0 && reducedCount < guests ? (
                        <Link
                          href={`/parties/date?guests=${reducedCount}&age=${honoreeAge}&date=${selectedDay.date}`}
                          className="self-center text-body-sm text-accent underline underline-offset-4"
                        >
                          {interpolate(party.err.dayFull.action.tertiary, {
                            roomMax: reducedCount,
                          })}
                        </Link>
                      ) : null}
                      <CallLink />
                    </>
                  }
                />
              ) : null}

              {rows.length > 0 ? (
                <WindowList
                  windows={rows}
                  date={selectedDay.date}
                  guests={guests}
                  honoreeAge={honoreeAge}
                />
              ) : null}

              <Caption>
                {interpolate(global.rule.arenaCap, { arenaCap: config.arenaCapacity })}
              </Caption>
              <Caption>{global.timezoneNote}</Caption>
            </div>
          )}
        </FlowSection>
      </div>
    </PageShell>
  );
}
