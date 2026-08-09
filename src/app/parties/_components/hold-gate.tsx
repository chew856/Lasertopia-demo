import { getPartyAvailability } from "@/lib/domain";
import { formatDateShort, formatTimeRange } from "@/lib/format";

import { findAlternatives } from "../_lib/alternatives";
import { loadDayState } from "../_lib/day-state";
import type { DraftView } from "../_lib/draft-view";

import { HoldExpiredPanel } from "./hold-notice";

/**
 * Re-checks the hold on every render of P3–P6 (STRATEGY §0's two-phase validation) and, when it
 * has lapsed, works out which of §8.19's two states applies by asking the engine whether the
 * window is still free — not by guessing.
 */
export async function HoldGate({ view }: { view: DraftView }) {
  if (!view.holdExpired || view.draft.status !== "HOLD") return null;

  const { catalog, config, draft, now, window } = view;
  const dayState = await loadDayState(draft.date, now, catalog, config);
  const availability = getPartyAvailability({
    now,
    date: draft.date,
    guests: draft.guests,
    honoreeAge: draft.honoreeAge,
    channel: "ONLINE",
    catalog,
    config,
    dayState,
    excludeBookingId: draft.id,
  });

  const stillOpen =
    availability.windows.find((w) => w.partyWindowId === draft.partyWindowId)?.available === true;

  const alternatives = stillOpen
    ? []
    : await findAlternatives({
        now,
        guests: draft.guests,
        honoreeAge: draft.honoreeAge,
        catalog,
        config,
        limit: 2,
        exclude: { date: draft.date, partyWindowId: draft.partyWindowId },
      });

  return (
    <HoldExpiredPanel
      config={config}
      guests={draft.guests}
      honoreeAge={draft.honoreeAge}
      windowLabel={window ? formatTimeRange(window.startMinutes, window.endMinutes) : ""}
      dateShort={formatDateShort(draft.date)}
      date={draft.date}
      partyWindowId={draft.partyWindowId}
      stillOpen={stillOpen}
      alternatives={alternatives}
    />
  );
}
