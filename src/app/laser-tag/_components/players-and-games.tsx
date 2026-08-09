"use client";

import { useActionState, useId, useState } from "react";

import {
  Button,
  ButtonLink,
  Caption,
  FieldLabel,
  HAIRLINE_GRID,
  MonoValue,
  Stepper,
  StickyActionBar,
  ValidationMessage,
  cx,
} from "@/components/ui";
import { global, interpolate, laserTag } from "@/lib/copy";
import {
  formatMoney,
  formatPhone,
  formatPhoneHref,
  unitLabel,
} from "@/lib/format";

import { START_INITIAL } from "../_lib/action-state";
import { groupTooLargeContent } from "../_lib/rejections";
import { startBooking } from "../actions";
import { OfflineNotice, useOnline } from "./offline-notice";
import { ReasonPanel } from "./reason-panel";

/**
 * Screen G1 — players and games (STRATEGY §3.1).
 *
 * This screen is deliberately the only one in the flow that touches no availability: it must
 * paint instantly, and both of its answers are prerequisites for a grid that can tell the
 * truth. "Is 6:15 free" has no answer until we know six players and two games.
 *
 * The client boundary is here rather than deeper because the group total is live: it moves
 * with the stepper and with the selected card, and the two prices it multiplies come from
 * settings, passed in as integer cents. No arithmetic happens on a formatted string.
 */

export interface GameOption {
  games: number;
  pricePerPersonCents: number;
}

/** COPY.md writes one key per card. A price row with no key is not rendered rather than guessed. */
const GAME_LABELS: Record<number, string> = {
  1: laserTag.g1.games.option1,
  2: laserTag.g1.games.option2,
  3: laserTag.g1.games.option3,
};

export function PlayersAndGames({
  options,
  arenaCapacity,
  phone,
  defaultPlayers,
}: {
  options: readonly GameOption[];
  arenaCapacity: number;
  phone: string;
  defaultPlayers: number;
}) {
  const [state, formAction, pending] = useActionState(startBooking, START_INITIAL);
  const [players, setPlayers] = useState(defaultPlayers);
  const [games, setGames] = useState(options[0]?.games ?? 1);
  const online = useOnline();
  const playersId = useId();
  const groupHeadingId = useId();

  const selected = options.find((option) => option.games === games) ?? options[0];
  const totalCents = selected ? selected.pricePerPersonCents * players : 0;
  const groupTotal = interpolate(laserTag.g1.games.groupTotal, {
    total: formatMoney(totalCents),
    players,
    "unit.player": unitLabel(players, "player"),
  });
  const atCap = players >= arenaCapacity;
  const overflow = atCap ? groupTooLargeContent({ arenaCapacity, phone }) : null;

  return (
    <form action={formAction} className="flex flex-col gap-12">
      <input type="hidden" name="players" value={players} />

      {/* ── Players ─────────────────────────────────────────────────────────────────── */}
      <section>
        <FieldLabel htmlFor={playersId} className="mb-2 block">
          {laserTag.g1.players.label}
        </FieldLabel>
        <PlayerStepper
          id={playersId}
          value={players}
          max={arenaCapacity}
          onChange={setPlayers}
        />
        <p className="mt-2 max-w-[56ch] text-caption text-text-3">{laserTag.g1.players.help}</p>
        {atCap ? (
          <p className="mt-2 max-w-[56ch] text-caption text-state-filling">
            {interpolate(laserTag.g1.players.atCap, { arenaCap: arenaCapacity })}
          </p>
        ) : null}
        {state.error === "PLAYERS_MIN" ? (
          <ValidationMessage tone="error" className="mt-2">
            {laserTag.err.field.playersMin}
          </ValidationMessage>
        ) : null}
        {state.error === "PLAYERS_MAX" ? (
          <ValidationMessage tone="error" className="mt-2">
            {interpolate(laserTag.err.field.playersMax, { arenaCap: arenaCapacity })}
          </ValidationMessage>
        ) : null}
      </section>

      {/* ── Games ───────────────────────────────────────────────────────────────────── */}
      <fieldset>
        <legend className="mb-2 font-display text-label uppercase text-text-2">
          {laserTag.g1.games.label}
        </legend>
        <p className="mb-4 max-w-[56ch] text-caption text-text-3">{laserTag.g1.games.help}</p>

        <div className={cx(HAIRLINE_GRID, "grid-cols-1 sm:grid-cols-3")}>
          {options.map((option) => {
            const label = GAME_LABELS[option.games];
            if (!label) return null;
            const isSelected = option.games === games;
            return (
              <label
                key={option.games}
                className={cx(
                  "relative flex min-h-24 cursor-pointer flex-col justify-between gap-3 p-4",
                  "transition-colors duration-[var(--duration-fast)] ease-out",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent",
                  isSelected ? "bg-accent-wash" : "bg-canvas hover:bg-raised",
                )}
              >
                <input
                  type="radio"
                  name="games"
                  value={option.games}
                  checked={isSelected}
                  onChange={() => setGames(option.games)}
                  className="sr-only"
                />
                {/* Selection carries a bar and a fill, never colour alone. */}
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute inset-x-0 top-0 h-[3px]",
                    isSelected ? "bg-accent" : "bg-transparent",
                  )}
                />
                <span className="font-display text-display-3 text-text">{label}</span>
                <MonoValue step="md" className={isSelected ? "text-accent" : "text-text-2"}>
                  {interpolate(laserTag.g1.games.price, {
                    perPerson: formatMoney(option.pricePerPersonCents),
                  })}
                </MonoValue>
              </label>
            );
          })}
        </div>

        <p className="mt-4 text-body-sm text-text">{groupTotal}</p>

        {state.error === "GAMES" ? (
          <ValidationMessage tone="error" className="mt-2">
            {laserTag.err.field.gamesRequired}
          </ValidationMessage>
        ) : null}
      </fieldset>

      {overflow ? (
        <ReasonPanel
          title={overflow.title}
          body={overflow.body}
          tone="informational"
          headingId={groupHeadingId}
        >
          <ButtonLink href={formatPhoneHref(phone)}>
            {interpolate(global.phoneCall, { phone: formatPhone(phone) })}
          </ButtonLink>
        </ReasonPanel>
      ) : null}

      {!online ? <OfflineNotice online={online} /> : null}

      {state.error === "SERVER" ? (
        <div>
          <ValidationMessage tone="error">{laserTag.err.server.startDraft}</ValidationMessage>
          <Caption className="mt-2">{laserTag.err.server.retrySafe}</Caption>
        </div>
      ) : null}

      <StickyActionBar
        hideAtLg={false}
        action={
          <Button
            type="submit"
            variant="primary"
            pending={pending}
            pendingLabel={global.loading.saving}
            disabled={!online}
          >
            {!online
              ? laserTag.err.offline.action
              : atCap
                ? interpolate(laserTag.err.groupTooLarge.actionSecondary, {
                    arenaCap: arenaCapacity,
                  })
                : laserTag.g1.cta}
          </Button>
        }
      >
        <MonoValue step="md">{formatMoney(totalCents)}</MonoValue>
        <span className="text-caption text-text-2">{global.sum.plusTax}</span>
      </StickyActionBar>
    </form>
  );
}

/**
 * The stepper, with the flow's own bounds. `Stepper` is fully controlled and carries no state
 * of its own, so the minimum, the maximum and the announcement all come from here.
 */
function PlayerStepper({
  id,
  value,
  max,
  onChange,
}: {
  id: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  // `Stepper` renders its own label; this screen needs the label above the control and the
  // help text below it, so the component's label is hidden and ours is the visible one.
  return (
    <Stepper
      id={id}
      label={laserTag.g1.players.label}
      labelHidden
      value={value}
      min={1}
      max={max}
      onChange={onChange}
      decreaseLabel={laserTag.g1.players.decrease}
      increaseLabel={laserTag.g1.players.increase}
    />
  );
}
