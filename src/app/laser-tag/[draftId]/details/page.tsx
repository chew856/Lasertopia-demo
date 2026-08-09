import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell, SectionHeader } from "@/components/ui";
import { laserTag } from "@/lib/copy";
import { blockStartsFor } from "@/lib/domain";
import { formatBlock } from "@/lib/format";

import { DetailsForm } from "../../_components/details-form";
import { FlowFooter, FlowStep } from "../../_components/flow-chrome";
import { HoldBar } from "../../_components/hold-bar";
import { ReasonPanel } from "../../_components/reason-panel";
import { RecoveryActions } from "../../_components/recovery-actions";
import { getDraft, holdExpired, holdSecondsRemaining } from "../../_lib/draft";
import { loadRejectionContext, startStillOpen } from "../../_lib/flow-context";
import { blockEndMinutes } from "../../_lib/grid";
import { holdExpiredContent } from "../../_lib/rejections";
import { LASER_TAG_HOME, timeStep } from "../../_lib/routes";
import { loadVenue } from "../../_lib/venue";

/**
 * Screen G3 — `/laser-tag/[draftId]/details` · Who's coming (STRATEGY §3.1).
 *
 * The screen has one job beyond collecting three fields: it is the first place the hold can
 * lapse, and STRATEGY makes that a **full-screen takeover before the form**, not a banner
 * over it. Asking someone to type their phone number into a form whose time has already gone
 * is the kind of small cruelty that loses a booking.
 *
 * Which half of `err.holdExpired.games.*` they read is decided here, server-side, by asking
 * the engine again: still open is a different sentence and a different button from taken.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: laserTag.g3.title,
};

export default async function DetailsPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const now = new Date();

  const { config } = await loadVenue();
  const draft = await getDraft(draftId, {
    maxPlayers: config.arenaCapacity,
    maxGames: config.maxGamesPerPublicBooking,
  });
  if (!draft) redirect(LASER_TAG_HOME);
  if (draft.date === null || draft.startMinutes === null) redirect(timeStep(draft.id));

  const date = draft.date;
  const startMinutes = draft.startMinutes;
  const gameBlock = formatBlock(
    startMinutes,
    blockEndMinutes(
      blockStartsFor(startMinutes, draft.games, config),
      config.gameDurationMinutes,
    ),
  );

  if (holdExpired(draft, now)) {
    const { context, availability } = await loadRejectionContext({
      now,
      players: draft.players,
      games: draft.games,
      date,
    });
    const stillOpen = startStillOpen(availability, startMinutes);
    const content = holdExpiredContent(context, {
      startMinutes,
      stillOpen,
      holdMinutes: config.bookingHoldMinutes,
    });

    return (
      <PageShell as="main" width="flow" className="flex flex-1 flex-col py-8 md:py-12">
        <FlowStep current={3} />
        <div className="mt-10">
          {content ? (
            <ReasonPanel title={content.title} body={content.body}>
              <RecoveryActions
                draftId={draft.id}
                date={date}
                actions={content.actions}
                phone={config.venuePhone}
              />
            </ReasonPanel>
          ) : null}
        </div>
        <FlowFooter phone={config.venuePhone} />
      </PageShell>
    );
  }

  return (
    <PageShell as="main" width="flow" className="flex flex-1 flex-col py-8 md:py-12">
      <FlowStep current={3} />

      <SectionHeader
        level={1}
        headingTag="h1"
        title={laserTag.g3.heading}
        className="mt-6 mb-8"
      />

      <HoldBar
        draftId={draft.id}
        heldUntil={draft.heldUntil ?? now.getTime()}
        holdMinutes={config.bookingHoldMinutes}
        gameBlock={gameBlock}
        alreadyExtended={draft.holdExtended}
        className="mb-8"
      />

      <DetailsForm
        draftId={draft.id}
        defaults={{
          name: draft.name,
          phone: draft.phone,
          email: draft.email,
          note: draft.note,
        }}
        holdSecondsRemaining={holdSecondsRemaining(draft, now)}
      />

      <FlowFooter phone={config.venuePhone} />
    </PageShell>
  );
}
