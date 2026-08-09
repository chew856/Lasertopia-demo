/**
 * Every URL in the laser tag flow, in one place.
 *
 * Route-per-step (STRATEGY §0): each screen is its own segment so the phone's back button
 * works, each step is resumable from a link, and each step is a server component that
 * re-validates on render. That only holds if the paths are built in one place — a hand-typed
 * `/laser-tag/${id}/time` somewhere is how a step ends up unreachable after a rename.
 */

export const LASER_TAG_HOME = "/laser-tag";
/** STRATEGY §2.1: the "nothing bookable" screen. */
export const CLOSED = "/closed";
/** The party flow's entry, for the "book a birthday party instead" recoveries in COPY.md §8. */
export const PARTY_HOME = "/parties";

export function timeStep(draftId: string, params?: { date?: string }): string {
  const query = params?.date ? `?date=${encodeURIComponent(params.date)}` : "";
  return `${LASER_TAG_HOME}/${draftId}/time${query}`;
}

export function timeStepRejected(
  draftId: string,
  args: { date: string; rejected: string; start: number },
): string {
  const query = new URLSearchParams({
    date: args.date,
    rejected: args.rejected,
    start: String(args.start),
  });
  return `${LASER_TAG_HOME}/${draftId}/time?${query.toString()}`;
}

export function detailsStep(draftId: string): string {
  return `${LASER_TAG_HOME}/${draftId}/details`;
}

export function reviewStep(draftId: string, params?: { rejected?: string; seats?: number }): string {
  if (!params?.rejected) return `${LASER_TAG_HOME}/${draftId}/review`;
  const query = new URLSearchParams({ rejected: params.rejected });
  if (params.seats !== undefined) query.set("seats", String(params.seats));
  return `${LASER_TAG_HOME}/${draftId}/review?${query.toString()}`;
}

export function confirmation(code: string, params?: { isNew?: boolean; cancelled?: boolean }): string {
  const query = new URLSearchParams();
  if (params?.isNew) query.set("new", "1");
  if (params?.cancelled) query.set("cancelled", "1");
  const suffix = query.toString();
  return `${LASER_TAG_HOME}/booking/${encodeURIComponent(code)}${suffix ? `?${suffix}` : ""}`;
}
