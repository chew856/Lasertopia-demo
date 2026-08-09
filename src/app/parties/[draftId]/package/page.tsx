import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Button,
  Caption,
  Eyebrow,
  FlowSection,
  Hairline,
  MEASURE_BODY,
  MonoValue,
  PageShell,
  Tag,
  cx,
} from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { quotePackages } from "@/lib/domain";
import { formatDateShort, formatDuration, formatTimeRange } from "@/lib/format";

import { choosePackage } from "../../actions";
import { FlowStepHeader } from "../../_components/flow-chrome";
import { HoldCountdown } from "../../_components/hold-bar";
import { HoldGate } from "../../_components/hold-gate";
import { holdExplainLine, loadDraftView } from "../../_lib/draft-view";
import { packageCardMaths } from "../../_lib/money-lines";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${party.p3.title} — ${global.venueName}`,
};

/** COPY.md §11 writes the inclusion lists per package code; the catalog supplies the money. */
const INCLUSIONS: Record<string, readonly string[]> = {
  TRAVELER: [
    party.pkg.TRAVELER.inc.room,
    party.pkg.TRAVELER.inc.games,
    party.pkg.TRAVELER.inc.merch,
  ],
  GREAT_ADVENTURE: [
    party.pkg.GREAT_ADVENTURE.inc.room,
    party.pkg.GREAT_ADVENTURE.inc.games,
    party.pkg.GREAT_ADVENTURE.inc.food,
    party.pkg.GREAT_ADVENTURE.inc.cupcakes,
    party.pkg.GREAT_ADVENTURE.inc.merch,
  ],
  AROUND_THE_WORLD: [
    party.pkg.AROUND_THE_WORLD.inc.room,
    party.pkg.AROUND_THE_WORLD.inc.games,
    party.pkg.AROUND_THE_WORLD.inc.frenzy,
    party.pkg.AROUND_THE_WORLD.inc.typhoon,
    party.pkg.AROUND_THE_WORLD.inc.funcard,
    party.pkg.AROUND_THE_WORLD.inc.food,
    party.pkg.AROUND_THE_WORLD.inc.cupcakes,
    party.pkg.AROUND_THE_WORLD.inc.merch,
  ],
};

const TAGLINES: Record<string, string> = {
  TRAVELER: party.pkg.TRAVELER.tagline,
  GREAT_ADVENTURE: party.pkg.GREAT_ADVENTURE.tagline,
  AROUND_THE_WORLD: party.pkg.AROUND_THE_WORLD.tagline,
};

const FOOD_NOTES: Record<string, string> = {
  TRAVELER: party.pkg.TRAVELER.foodNote,
  AROUND_THE_WORLD: party.pkg.AROUND_THE_WORLD.arcadeNote,
};

const SHARED_INCLUSIONS = [
  party.pkg.shared.host,
  party.pkg.shared.drinks,
  party.pkg.shared.popcorn,
  party.pkg.shared.supplies,
  party.pkg.shared.setup,
  party.pkg.shared.invitations,
];

/**
 * Screen P3 — the package, **priced for the real guest count**.
 *
 * This is the payoff for asking the headcount first: a parent booking for 16 never sees the
 * 10-guest sticker price. The arithmetic is shown, not just the answer, so she can audit it.
 */
export default async function PackagePage(props: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await props.params;
  const view = await loadDraftView(draftId);
  if (!view) notFound();

  const { draft, catalog, config, window } = view;
  const quotes = quotePackages({ guests: draft.guests, catalog, config });
  const windowLabel = window ? formatTimeRange(window.startMinutes, window.endMinutes) : "";

  return (
    <PageShell as="main" width="page" className="py-8 md:py-12">
      <FlowSection>
        <FlowStepHeader
          step={3}
          title={party.p3.heading}
          description={interpolate(party.p3.sub, {
            guests: draft.guests,
            baseGuests: config.packageBaseGuests,
          })}
        />
      </FlowSection>

      <FlowSection>
        <HoldGate view={view} />
      </FlowSection>

      <FlowSection>
        <div className="grid gap-px bg-rule md:grid-cols-3">
          {quotes.map((quote) => {
            const record = quote.packageRecord;
            const maths = packageCardMaths(record, draft.guests, quote.preTaxSubtotalCents);
            const inclusions = INCLUSIONS[record.code] ?? [];
            const note = FOOD_NOTES[record.code];

            return (
              <form
                key={record.code}
                action={choosePackage}
                className="flex flex-col gap-5 bg-canvas p-5 md:p-6"
              >
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="packageCode" value={record.code} />

                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-display-3 uppercase text-text">
                    {record.name}
                  </h2>
                  {record.code === "GREAT_ADVENTURE" ? (
                    <Tag tone="accent" className="shrink-0">
                      {party.p3.card.mostBooked}
                    </Tag>
                  ) : null}
                </div>

                <p className={cx("text-body-sm text-text-2", MEASURE_BODY)}>
                  {TAGLINES[record.code]}
                </p>

                <div className="flex flex-col gap-1">
                  <MonoValue step="lg">{maths.total}</MonoValue>
                  <Caption>{maths.note}</Caption>
                  {maths.math ? (
                    <Caption className="font-mono text-mono-sm tabular-nums text-text-2">
                      {maths.math}
                    </Caption>
                  ) : null}
                </div>

                <Hairline tone="rule" />

                <div className="flex flex-col gap-2">
                  <Eyebrow as="h3">{party.p3.card.includes}</Eyebrow>
                  <ul className="flex flex-col gap-1 text-body-sm text-text-2">
                    {inclusions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>

                <Caption>
                  {interpolate(party.p3.card.roomTime, {
                    roomTime: formatDuration(record.roomMinutes),
                  })}
                </Caption>

                {note ? <Caption>{note}</Caption> : null}

                <div className="mt-auto pt-2">
                  <Button type="submit" variant="secondary" fullWidth>
                    {interpolate(party.p3.card.select, { packageName: record.name })}
                  </Button>
                </div>
              </form>
            );
          })}
        </div>
      </FlowSection>

      <FlowSection>
        <section
          aria-label={party.p3.shared.heading}
          className="border border-rule bg-raised p-4 md:p-6"
        >
          <Eyebrow as="h2">{party.p3.shared.heading}</Eyebrow>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-body-sm text-text-2">
            {SHARED_INCLUSIONS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className={cx("mt-4 text-body-sm text-text-2", MEASURE_BODY)}>
            {interpolate(party.pkg.shared.guests, { baseGuests: config.packageBaseGuests })}
          </p>
          <p className={cx("mt-3 text-caption text-text-3", MEASURE_BODY)}>
            {party.p3.roomNote}
          </p>
        </section>
      </FlowSection>

      {!view.holdExpired ? (
        <div className="sticky bottom-0 z-20 border-t border-border bg-raised pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex min-h-18 w-full max-w-page flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <HoldCountdown initialSeconds={view.holdSecondsRemaining} />
            <p className="text-caption text-text-2">
              {holdExplainLine(config, windowLabel, formatDateShort(draft.date))}
            </p>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
