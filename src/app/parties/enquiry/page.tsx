import type { Metadata } from "next";
import Link from "next/link";

import {
  Caption,
  FlowSection,
  MEASURE_BODY,
  PageShell,
  buttonClassName,
  cx,
} from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { formatMoney } from "@/lib/format";

import { CallLink, FactList, RejectionPanel } from "../_components/flow-chrome";
import { guestCeiling } from "../_lib/fit";
import { loadVenue } from "../_lib/venue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${party.err.maxPartySize.title.replace("{maxGuests}", "")} — ${global.venueName}`,
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * The enquiry path: what happens when the request cannot be auto-fitted.
 *
 * A party over the online ceiling is not an error and must never be a dead end — R-25 and
 * COPY.md §8.8 both say the recovery is a phone call plus the offer to book the largest party
 * we *can* host. Both are one tap from here, and the ceiling is read off the rooms engine so it
 * stays true if a manager adds a room.
 */
export default async function EnquiryPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const { catalog, config } = await loadVenue();

  const ceiling = guestCeiling(catalog, config);
  const requested = Number.parseInt(first(searchParams.guests), 10);
  const age = first(searchParams.age);

  return (
    <PageShell as="main" width="flow" className="py-8 md:py-12">
      <FlowSection>
        <RejectionPanel
          title={interpolate(party.err.maxPartySize.title, { maxGuests: ceiling })}
          body={interpolate(party.err.maxPartySize.body, {
            maxGuests: ceiling,
            phone: global.phone,
          })}
          actions={
            <>
              <CallLink variant="primary" />
              <Link
                href={`/parties?guests=${ceiling}${age ? `&age=${encodeURIComponent(age)}` : ""}`}
                className={buttonClassName("secondary")}
              >
                {interpolate(party.err.maxPartySize.action.secondary, { maxGuests: ceiling })}
              </Link>
            </>
          }
        />
      </FlowSection>

      {Number.isInteger(requested) && requested > ceiling ? (
        <FlowSection>
          <Caption className={cx(MEASURE_BODY)}>
            {interpolate(party.err.field.guests.max, {
              maxGuests: ceiling,
              phone: global.phone,
            })}
          </Caption>
        </FlowSection>
      ) : null}

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

      <FlowSection>
        <p className={cx("text-body-sm text-text-2", MEASURE_BODY)}>{global.hours.partyNote}</p>
      </FlowSection>
    </PageShell>
  );
}
