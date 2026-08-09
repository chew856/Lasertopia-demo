import type { Metadata } from "next";

import { PageShell, SectionHeader } from "@/components/ui";
import { laserTag } from "@/lib/copy";

import { FlowFooter, FlowStep, StandingFacts } from "./_components/flow-chrome";
import { PlayersAndGames, type GameOption } from "./_components/players-and-games";
import { loadVenue } from "./_lib/venue";

/**
 * Screen G1 — `/laser-tag` · Players & games.
 *
 * STRATEGY §3.1: this screen loads prices and the arena cap and nothing else. The flow's
 * first paint must never wait on availability, and it does not have to — both of the answers
 * this screen collects are what make availability answerable at all.
 *
 * Dynamic because every figure on it is a manager-editable row. Rendering it at build time
 * would freeze last week's prices into the bundle.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: laserTag.g1.documentTitle,
};

/** STRATEGY §3.1: the stepper's default. Two people is the smallest group that is a group. */
const DEFAULT_PLAYERS = 2;

export default async function LaserTagStartPage() {
  const { catalog, config } = await loadVenue();

  const options: GameOption[] = catalog.gamePricing
    .filter((pricing) => pricing.gameCount >= 1 && pricing.gameCount <= config.maxGamesPerPublicBooking)
    .sort((a, b) => a.gameCount - b.gameCount)
    .map((pricing) => ({
      games: pricing.gameCount,
      pricePerPersonCents: pricing.pricePerPersonCents,
    }));

  return (
    <PageShell as="main" width="flow" className="flex flex-1 flex-col py-8 md:py-12">
      <FlowStep current={1} />

      <SectionHeader
        level={1}
        headingTag="h1"
        title={laserTag.g1.heading}
        className="mt-6 mb-10"
      />

      <PlayersAndGames
        options={options}
        arenaCapacity={config.arenaCapacity}
        phone={config.venuePhone}
        defaultPlayers={Math.min(DEFAULT_PLAYERS, config.arenaCapacity)}
      />

      <StandingFacts
        heading={laserTag.g1.facts.heading}
        cutoffMinutes={config.onlineCutoffMinutes}
        className="mt-12"
      />

      <FlowFooter phone={config.venuePhone} />
    </PageShell>
  );
}
