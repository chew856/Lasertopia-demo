import type { Metadata } from "next";

import { FlowSection, PageShell } from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { quotePackages } from "@/lib/domain";
import { formatMoney } from "@/lib/format";

import { FactList, FlowStepHeader } from "./_components/flow-chrome";
import { PartySizeForm, type GuestOption } from "./_components/party-size-form";
import { guestCeiling, honoreeAgeRange, roomHintFor } from "./_lib/fit";
import { loadVenue } from "./_lib/venue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${party.p1.title} — ${global.venueName}`,
};

/**
 * Screen P1 — party size and honoree age, **before** the calendar.
 *
 * This ordering is the load-bearing decision of the whole surface (STRATEGY §3.2). A window's
 * availability is a function of `(window, guestCount, honoreeAge)`, not a property of the
 * window: Saturday 11–1 with a free 14-room and a booked 12-room is wide open to a party of 14
 * and impossible for a party of 16. A calendar rendered before those two answers is guaranteed
 * to be wrong for somebody, and the people it is wrong for are the large bookings.
 *
 * The cost of getting it right is one screen with two controls. The mitigation for it being a
 * form rather than something pretty is that both controls answer back immediately: the room
 * consequence of the count and the price for the real headcount, both computed here on the
 * server for every bookable count.
 */
export default async function PartySizePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const { catalog, config } = await loadVenue();

  const min = Math.max(1, config.minPartyGuests);
  const max = guestCeiling(catalog, config);

  const options: GuestOption[] = [];
  for (let guests = min; guests <= max; guests += 1) {
    const hints: string[] = [
      guests <= config.packageBaseGuests
        ? interpolate(party.p1.guests.hint.base, { baseGuests: config.packageBaseGuests })
        : interpolate(party.p1.guests.hint.extra, {
            extraCount: guests - config.packageBaseGuests,
            baseGuests: config.packageBaseGuests,
          }),
    ];

    // The room consequence comes from the rooms engine, not from a threshold typed in here.
    const roomHint = roomHintFor(catalog, guests);
    if (roomHint === "fits") {
      hints.push(interpolate(party.p1.guests.hint.fits, { guests }));
    } else if (roomHint === "twoRooms") {
      hints.push(party.p1.guests.hint.twoRooms);
    } else if (roomHint === "threeRooms") {
      hints.push(party.p1.guests.hint.threeRooms);
    }

    const cheapest = quotePackages({ guests, catalog, config }).reduce(
      (lowest, quote) => Math.min(lowest, quote.preTaxSubtotalCents),
      Number.POSITIVE_INFINITY,
    );

    options.push({
      guests,
      hints,
      pricePreview: interpolate(party.p1.pricePreview, {
        guests,
        total: formatMoney(cheapest),
      }),
    });
  }

  const requestedGuests = Number.parseInt(String(searchParams.guests ?? ""), 10);
  const defaultGuests =
    Number.isInteger(requestedGuests) && requestedGuests >= min && requestedGuests <= max
      ? requestedGuests
      : Math.min(Math.max(config.packageBaseGuests, min), max);

  const requestedAge = String(searchParams.age ?? "");
  const ages = honoreeAgeRange(config);
  const defaultAge = ages.some((age) => String(age) === requestedAge) ? requestedAge : "";

  return (
    <PageShell as="main" width="flow" className="py-8 md:py-12">
      <FlowSection>
        <FlowStepHeader step={1} title={party.p1.heading} description={party.p1.sub} />
      </FlowSection>

      <FlowSection>
        <PartySizeForm
          min={min}
          max={max}
          defaultGuests={defaultGuests}
          defaultAge={defaultAge}
          ages={ages}
          ageHelp={interpolate(party.p1.age.help, {
            ageBand: config.maxAgeDifferenceYears,
          })}
          options={options}
        />
      </FlowSection>

      <FlowSection>
        <FactList
          heading={party.p1.facts.heading}
          facts={[
            party.p1.facts.window,
            interpolate(party.p1.facts.deposit, {
              deposit: formatMoney(config.depositAmountCents),
            }),
            party.p1.facts.nutFree,
          ]}
        />
      </FlowSection>
    </PageShell>
  );
}
