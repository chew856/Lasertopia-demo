"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";

import {
  Button,
  ButtonLink,
  DateStrip,
  EmptyState,
  LoadingBlock,
  MonoValue,
  SlotGrid,
  SlotHourHeader,
  SlotTile,
  StickyActionBar,
  Tag,
  ValidationMessage,
  buttonClassName,
  cx,
  type DateOption,
  type SlotState,
} from "@/components/ui";
import { global, interpolate, laserTag } from "@/lib/copy";
import { formatPhone, formatPhoneHref } from "@/lib/format";

import { SELECT_INITIAL } from "../_lib/action-state";
import type { PanelAction, ReasonContent } from "../_lib/rejections";
import { LASER_TAG_HOME, PARTY_HOME, timeStep } from "../_lib/routes";
import { selectStart } from "../actions";
import { OfflineNotice, useOnline } from "./offline-notice";
import { ReasonPanel } from "./reason-panel";

/**
 * Screen G2 — the time grid (STRATEGY §3.1).
 *
 * Everything a customer reads here was computed on the server: the tile states, the capacity
 * lines, and — the expensive part — the whole rejection panel behind every cell that cannot
 * be booked, complete with the nearest times that do work. That is deliberate. Assembling
 * "6:15 PM has 3 spots left and you need 6; these have room: …" in the browser would mean
 * shipping the day's availability and the copy deck's interpolation to the phone, and the two
 * would drift from the server's answer the moment anything changed.
 *
 * So this component holds three pieces of state and nothing else: which start is selected,
 * which cell's reason is open, and whether a date change is in flight.
 *
 * **Unavailable cells stay reachable.** `SlotTile` renders them `aria-disabled` and keeps
 * them in the tab order, which is what lets a screen-reader user hear *why* 5:45 is gone
 * instead of finding a hole in the grid. It also — correctly — refuses to fire `onSelect` on
 * them, so the tap is caught one level up (see `TileCell`). A cell that silently does nothing
 * when tapped is the defect STRATEGY §0 names by hand.
 */

export interface SlotView {
  startMinutes: number;
  /** `formatTime` for one game, `formatBlock` for a block. Never assembled here. */
  timeLabel: string;
  /** `formatBlockSub` — the individual starts inside a block. */
  subTimes: string | null;
  state: SlotState;
  stateWord: string;
  detail: string | null;
  a11yLabel: string;
  selectable: boolean;
  /** The panel behind an unavailable cell, built server-side from COPY.md §8. */
  reason: ReasonContent | null;
}

export interface HourGroupView {
  hourLabel: string;
  slots: SlotView[];
}

export interface TimePickerProps {
  draftId: string;
  date: string;
  days: DateOption[];
  hours: HourGroupView[];
  gridLabel: string;
  /** COPY.md `g2.context` — "6 players · 2 games". */
  contextLine: string;
  /** COPY.md `g2.nextAvailable`, present only when the soonest legal start is on this date. */
  nextAvailable: { startMinutes: number; label: string; actionLabel: string } | null;
  /** COPY.md `g2.selected.readback`, keyed by start so no date formatting happens here. */
  readbackByStart: Record<number, string>;
  /** COPY.md `g2.warn.scarce`, keyed by start. */
  scarceWarningByStart: Record<number, string>;
  /** Replaces the grid: the day is closed, or full for this group. */
  blockingPanel: ReasonContent | null;
  /** Replaces the grid: COPY.md `empty.g2.noGames`. */
  emptyState: { title: string; body: string; actionLabel: string; goToDate: string | null } | null;
  /** Above the grid, blocking tone: a choice refused between render and submit. */
  alertPanel: ReasonContent | null;
  /** Above the grid, informational: the weekend-morning explanation. */
  standingPanel: ReasonContent | null;
  /** COPY.md `err.raceLost.grid.body`. */
  raceLostMessage: string | null;
  /** COPY.md `err.past.*` / `err.horizon.games.*`, when a deep link asked for an impossible date. */
  correctedMessage: { title: string; body: string } | null;
  phone: string;
}

export function TimePicker(props: TimePickerProps) {
  const router = useRouter();
  const online = useOnline();
  const [state, formAction, submitting] = useActionState(selectStart, SELECT_INITIAL);
  const [selected, setSelected] = useState<number | null>(null);
  const [openReason, setOpenReason] = useState<number | null>(null);
  const [navigating, startNavigation] = useTransition();
  const reasonRef = useRef<HTMLDivElement>(null);
  const reasonHeadingId = useId();

  // Moving focus to the panel is the point of opening it: the customer tapped a cell to ask a
  // question, and the answer has to be where the screen reader and the eye both go next.
  useEffect(() => {
    if (openReason !== null) reasonRef.current?.focus();
  }, [openReason]);

  const goToDate = (date: string) => {
    setSelected(null);
    setOpenReason(null);
    startNavigation(() => router.push(timeStep(props.draftId, { date })));
  };

  const take = (startMinutes: number) => {
    setOpenReason(null);
    setSelected(startMinutes);
  };

  const renderAction = (action: PanelAction, key: string) => {
    const variant = action.variant === "primary" ? "primary" : "secondary";
    switch (action.kind) {
      case "takeTime":
        return (
          <Button
            key={key}
            variant={variant}
            fullWidth={false}
            onClick={() => {
              if (action.startMinutes !== undefined) take(action.startMinutes);
            }}
          >
            {action.label}
          </Button>
        );
      case "oneGame":
        // Its own form: this button carries a different start and a different game count from
        // the one the sticky bar submits, and a submit button cannot carry two payloads.
        return (
          <form key={key} action={formAction}>
            <input type="hidden" name="draftId" value={props.draftId} />
            <input type="hidden" name="date" value={props.date} />
            <input type="hidden" name="startMinutes" value={action.startMinutes ?? ""} />
            <input type="hidden" name="games" value="1" />
            <Button type="submit" variant={variant} fullWidth={false}>
              {action.label}
            </Button>
          </form>
        );
      case "goToDate":
        return (
          <Button
            key={key}
            variant={variant}
            fullWidth={false}
            onClick={() => {
              if (action.date) goToDate(action.date);
            }}
          >
            {action.label}
          </Button>
        );
      case "call":
      case "callWalkIn":
        return (
          <ButtonLink key={key} variant={variant} href={formatPhoneHref(props.phone)}>
            {action.label}
          </ButtonLink>
        );
      case "reduceGroup":
        return (
          <Link key={key} href={LASER_TAG_HOME} className={buttonClassName(variant)}>
            {action.label}
          </Link>
        );
      case "bookParty":
        return (
          <Link key={key} href={PARTY_HOME} className={buttonClassName(variant)}>
            {action.label}
          </Link>
        );
    }
  };

  const openSlot = props.hours
    .flatMap((group) => group.slots)
    .find((slot) => slot.startMinutes === openReason);

  const readback = selected !== null ? props.readbackByStart[selected] : null;
  const scarceWarning = selected !== null ? props.scarceWarningByStart[selected] : undefined;
  const gridReplaced = props.blockingPanel !== null || props.emptyState !== null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <MonoValue step="sm" className="uppercase text-text-2">
          {props.contextLine}
        </MonoValue>
        <Link
          href={LASER_TAG_HOME}
          className="min-h-11 content-center font-display text-button uppercase text-text-2 underline decoration-1 underline-offset-4 hover:text-accent"
        >
          {laserTag.g2.contextEdit}
        </Link>
      </div>

      {props.correctedMessage ? (
        <ReasonPanel
          title={props.correctedMessage.title}
          body={props.correctedMessage.body}
          tone="informational"
        />
      ) : null}

      <DateStrip
        label={laserTag.g2.dateStrip.label}
        days={props.days}
        selected={props.date}
        onSelect={goToDate}
      />

      <OfflineNotice online={online} />

      {props.raceLostMessage ? (
        <ValidationMessage tone="warning">{props.raceLostMessage}</ValidationMessage>
      ) : null}

      {state.rejected !== null ? (
        <ValidationMessage tone="error">
          {interpolate(laserTag.err.server.genericBody, { phone: formatPhone(props.phone) })}
        </ValidationMessage>
      ) : null}

      {props.alertPanel ? (
        <ReasonPanel title={props.alertPanel.title} body={props.alertPanel.body}>
          {props.alertPanel.actions.map((action, index) => renderAction(action, `alert-${index}`))}
        </ReasonPanel>
      ) : null}

      {props.standingPanel ? (
        <ReasonPanel
          title={props.standingPanel.title}
          body={props.standingPanel.body}
          tone="informational"
        >
          {props.standingPanel.actions.map((action, index) =>
            renderAction(action, `standing-${index}`),
          )}
        </ReasonPanel>
      ) : null}

      {props.nextAvailable && !gridReplaced ? (
        <div className="flex flex-wrap items-center gap-3">
          <Tag tone="accent">{props.nextAvailable.label}</Tag>
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => take(nextAvailableStart(props.nextAvailable))}
          >
            {props.nextAvailable.actionLabel}
          </Button>
        </div>
      ) : null}

      {navigating ? (
        <LoadingBlock label={global.loading.times} className="min-h-40" />
      ) : props.blockingPanel ? (
        <ReasonPanel title={props.blockingPanel.title} body={props.blockingPanel.body}>
          {props.blockingPanel.actions.map((action, index) => renderAction(action, `block-${index}`))}
        </ReasonPanel>
      ) : props.emptyState ? (
        <EmptyState
          title={props.emptyState.title}
          body={props.emptyState.body}
          action={
            props.emptyState.goToDate ? (
              <Button
                variant="secondary"
                fullWidth={false}
                onClick={() => goToDate(props.emptyState?.goToDate ?? props.date)}
              >
                {props.emptyState.actionLabel}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cx("flex flex-col gap-6", !online && "opacity-60")}>
          {props.hours.map((group) => (
            <div key={group.hourLabel} className="flex flex-col">
              <SlotHourHeader>{group.hourLabel}</SlotHourHeader>
              <SlotGrid label={props.gridLabel} className="mt-px">
                {group.slots.map((slot) => (
                  <TileCell
                    key={slot.startMinutes}
                    slot={slot}
                    selected={selected === slot.startMinutes}
                    offline={!online}
                    onSelect={() => take(slot.startMinutes)}
                    onExplain={() => setOpenReason(slot.startMinutes)}
                  />
                ))}
              </SlotGrid>
            </div>
          ))}
        </div>
      )}

      {openSlot?.reason ? (
        <ReasonPanel
          ref={reasonRef}
          tabIndex={-1}
          headingId={reasonHeadingId}
          title={openSlot.reason.title}
          body={openSlot.reason.body}
        >
          {openSlot.reason.actions.map((action, index) => renderAction(action, `reason-${index}`))}
        </ReasonPanel>
      ) : null}

      {scarceWarning ? <ValidationMessage tone="warning">{scarceWarning}</ValidationMessage> : null}

      <form action={formAction}>
        <input type="hidden" name="draftId" value={props.draftId} />
        <input type="hidden" name="date" value={props.date} />
        <input type="hidden" name="startMinutes" value={selected ?? ""} />
        <StickyActionBar
          hideAtLg={false}
          action={
            <Button
              type="submit"
              variant="primary"
              disabled={selected === null || !online}
              pending={submitting}
              pendingLabel={global.loading.saving}
            >
              {online ? laserTag.g2.cta : laserTag.err.offline.action}
            </Button>
          }
        >
          {readback ? (
            <MonoValue step="sm">{readback}</MonoValue>
          ) : (
            <span className="text-caption text-text-2">{props.contextLine}</span>
          )}
        </StickyActionBar>
      </form>
    </div>
  );
}

function nextAvailableStart(next: TimePickerProps["nextAvailable"]): number {
  return next?.startMinutes ?? 0;
}

/**
 * One cell.
 *
 * The `display: contents` wrapper exists for exactly one reason: `SlotTile` will not fire
 * `onSelect` on a non-interactive state, which is right — a full cell must never behave like
 * a bookable one. But the cell still has to answer "why", and the tile is a `<button>`, so
 * the explanation cannot be nested inside it. Catching the bubbled click one level up gives
 * the cell a mouse target and a keyboard target (Enter on an `aria-disabled` button still
 * dispatches a click) without touching the tile's semantics or its place in the grid.
 * `display: contents` keeps the wrapper out of the box tree, so the hairline grid is intact.
 */
function TileCell({
  slot,
  selected,
  offline,
  onSelect,
  onExplain,
}: {
  slot: SlotView;
  selected: boolean;
  offline: boolean;
  onSelect: () => void;
  onExplain: () => void;
}) {
  const tile = (
    <SlotTile
      time={slot.timeLabel}
      subTimes={slot.subTimes ?? undefined}
      state={slot.state}
      stateWord={slot.stateWord}
      detail={slot.detail ?? undefined}
      a11yLabel={slot.a11yLabel}
      selected={selected}
      selectedWord={laserTag.g2.cell.state.selected}
      onSelect={offline ? undefined : onSelect}
    />
  );

  if (slot.selectable) return tile;

  return (
    <div className="contents" onClick={onExplain}>
      {tile}
    </div>
  );
}
