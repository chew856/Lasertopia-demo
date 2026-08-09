"use client";

import { useActionState, useRef, useState } from "react";

import {
  AddOnToggleRow,
  Button,
  Caption,
  Eyebrow,
  FlowSection,
  MEASURE_BODY,
  MonoValue,
  Select,
  StickyActionBar,
  Stepper,
  ValidationMessage,
  cx,
} from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";

import { saveExtras } from "../actions";
import { ARCADE_CHOICE_FIELD, FOOD_CHOICE_FIELD, onField, optionField, qtyField } from "../_lib/extras";
import { EMPTY_FORM_STATE } from "../_lib/form-state";
import { RejectionPanel } from "./flow-chrome";

export interface AddOnModel {
  code: string;
  name: string;
  body: string | null;
  price: string;
  unit: string | null;
  requiresOption: boolean;
  optionLabel: string;
  options: { id: string; label: string }[];
  perGuest: boolean;
  defaultQuantity: number;
  maxQuantity: number;
  /** e.g. "4 included, 1 extra" — the derived caption on the quantity row. */
  derivedLine: string | null;
}

export interface IneligibleAddOnModel {
  code: string;
  name: string;
  reason: string;
  price: string;
  unit: string | null;
}

export interface FoodModel {
  /** `p4.food.included` or `p4.food.notIncluded`, already interpolated. */
  headline: string;
  offersHotDogs: boolean;
  hotDogNote: string | null;
  choice: "PIZZA" | "HOT_DOGS" | "NONE";
}

export interface ExtrasInitialState {
  checked: string[];
  quantities: Record<string, number>;
  options: Record<string, string>;
  arcadeChoice: string;
}

/**
 * Screen P4's form.
 *
 * Skipping is one tap and it sits **above** the options, because the time budget says a parent
 * who wants nothing should be able to leave faster than she can read (STRATEGY §3.3).
 *
 * Every toggle saves to the server, and the running total in the sticky bar is the figure the
 * engine just computed — no price arithmetic happens in this file. Ineligible add-ons render
 * disabled with the reason rather than disappearing, so a parent comparing packages can see
 * what she would be giving up (R-46, DESIGN §5.8).
 */
export function ExtrasForm({
  draftId,
  guests,
  food,
  addOns,
  arcade,
  ineligible,
  initial,
  runningTotal,
  qbixLineTotal,
}: {
  draftId: string;
  guests: number;
  food: FoodModel;
  addOns: readonly AddOnModel[];
  arcade: readonly AddOnModel[];
  ineligible: readonly IneligibleAddOnModel[];
  initial: ExtrasInitialState;
  runningTotal: string;
  qbixLineTotal: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveExtras, EMPTY_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  const [checked, setChecked] = useState<Set<string>>(new Set(initial.checked));
  const [quantities, setQuantities] = useState<Record<string, number>>(initial.quantities);
  const [arcadeChoice, setArcadeChoice] = useState(initial.arcadeChoice);

  const save = () => {
    // The total has to come from the engine, so every change round-trips rather than being
    // added up in the browser.
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  };

  const toggle = (code: string, next: boolean) => {
    setChecked((current) => {
      const updated = new Set(current);
      if (next) updated.add(code);
      else updated.delete(code);
      return updated;
    });
    save();
  };

  const setQuantity = (code: string, value: number) => {
    setQuantities((current) => ({ ...current, [code]: value }));
    save();
  };

  const showTimePlayWarning =
    arcadeChoice === "ARCADE_TIMEPLAY_45" && checked.has("QBIX_5D");

  const quantityFor = (model: AddOnModel) => quantities[model.code] ?? model.defaultQuantity;

  const renderRow = (model: AddOnModel) => {
    const isChecked = checked.has(model.code);
    return (
      <div key={model.code}>
        <AddOnToggleRow
          id={`addon-${model.code}`}
          inputName={onField(model.code)}
          name={model.name}
          description={model.body ?? undefined}
          price={model.price}
          priceUnit={model.unit ?? undefined}
          checked={isChecked}
          onChange={(event) => toggle(model.code, event.currentTarget.checked)}
          derivedLine={isChecked ? (model.derivedLine ?? undefined) : undefined}
          quantity={
            isChecked ? (
              <span className="flex flex-wrap items-end gap-4">
                <Stepper
                  id={`qty-${model.code}`}
                  label={model.name}
                  labelHidden
                  size="compact"
                  value={quantityFor(model)}
                  min={1}
                  max={model.maxQuantity}
                  onChange={(next) => setQuantity(model.code, next)}
                  decreaseLabel={party.p1.guests.decrease}
                  increaseLabel={party.p1.guests.increase}
                />
                {model.requiresOption ? (
                  <Select
                    id={`option-${model.code}`}
                    name={optionField(model.code)}
                    label={model.optionLabel}
                    defaultValue={initial.options[model.code] ?? model.options[0]?.id}
                    onChange={save}
                  >
                    {model.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </span>
            ) : undefined
          }
        />
        {isChecked ? (
          <input type="hidden" name={qtyField(model.code)} value={quantityFor(model)} />
        ) : null}
      </div>
    );
  };

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-10">
      <input type="hidden" name="draftId" value={draftId} />

      {state.rejection ? (
        <RejectionPanel title={state.rejection.title} body={state.rejection.body} />
      ) : null}

      <Button type="submit" name="intent" value="skip" variant="secondary" fullWidth>
        {global.btn.skipExtras}
      </Button>

      <FlowSection>
        <Eyebrow as="h2">{party.p4.food.heading}</Eyebrow>
        <p className={cx("mt-3 text-body-sm text-text-2", MEASURE_BODY)}>{food.headline}</p>

        {food.offersHotDogs ? (
          <div className="mt-4">
            <Select
              id="food-choice"
              name={FOOD_CHOICE_FIELD}
              label={party.p4.food.choice.label}
              defaultValue={food.choice}
              onChange={save}
            >
              <option value="PIZZA">{party.p4.food.choice.pizza}</option>
              <option value="HOT_DOGS">{party.p4.food.choice.hotdogs}</option>
            </Select>
            {food.hotDogNote ? <Caption className="mt-2">{food.hotDogNote}</Caption> : null}
          </div>
        ) : (
          <input type="hidden" name={FOOD_CHOICE_FIELD} value={food.choice} />
        )}

        <Caption className="mt-3">{party.p4.food.taxNote}</Caption>

        <div className="mt-4 border-t border-rule">
          {addOns.filter((model) => model.code.startsWith("PIZZA") || model.code.startsWith("WINGS")).map(renderRow)}
        </div>
      </FlowSection>

      <FlowSection>
        <Eyebrow as="h2">{party.p4.qbix.heading}</Eyebrow>
        <p className={cx("mt-3 text-body-sm text-text-2", MEASURE_BODY)}>{party.p4.qbix.body}</p>
        {qbixLineTotal ? <Caption className="mt-2">{qbixLineTotal}</Caption> : null}
        <div className="mt-4 border-t border-rule">
          {addOns
            .filter((model) => !model.code.startsWith("PIZZA") && !model.code.startsWith("WINGS"))
            .map(renderRow)}
        </div>
      </FlowSection>

      {arcade.length > 0 ? (
        <FlowSection>
          <fieldset>
            <legend className="font-display text-heading uppercase text-text">
              {party.p4.arcade.heading}
            </legend>
            <p className={cx("mt-3 text-body-sm text-text-2", MEASURE_BODY)}>
              {party.p4.arcade.question}
            </p>
            <p className="mt-2 text-caption text-text-3">{party.p4.arcade.qty.help}</p>

            <div className="mt-4 flex flex-col border-t border-rule">
              {arcade.map((model) => (
                <label
                  key={model.code}
                  htmlFor={`arcade-${model.code}`}
                  className={cx(
                    "flex cursor-pointer items-start gap-3 border-b border-rule border-l-[3px] px-3 py-4",
                    arcadeChoice === model.code
                      ? "border-l-accent bg-raised"
                      : "border-l-transparent",
                  )}
                >
                  <input
                    id={`arcade-${model.code}`}
                    type="radio"
                    name={ARCADE_CHOICE_FIELD}
                    value={model.code}
                    checked={arcadeChoice === model.code}
                    onChange={() => {
                      setArcadeChoice(model.code);
                      save();
                    }}
                    className="mt-1 size-5 accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body text-text">{model.name}</span>
                    {model.body ? (
                      <span className={cx("mt-1 block text-body-sm text-text-2", MEASURE_BODY)}>
                        {model.body}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-mono-md tabular-nums text-text">
                      {model.price}
                    </span>
                    {model.unit ? (
                      <span className="mt-0.5 block text-caption text-text-3">{model.unit}</span>
                    ) : null}
                  </span>
                </label>
              ))}

              <label
                htmlFor="arcade-none"
                className="flex cursor-pointer items-center gap-3 border-b border-rule border-l-[3px] border-l-transparent px-3 py-4"
              >
                <input
                  id="arcade-none"
                  type="radio"
                  name={ARCADE_CHOICE_FIELD}
                  value=""
                  checked={arcadeChoice === ""}
                  onChange={() => {
                    setArcadeChoice("");
                    save();
                  }}
                  className="size-5 accent-[var(--color-accent)]"
                />
                <span className="text-body text-text">{global.btn.skipExtras}</span>
              </label>
            </div>

            {arcadeChoice ? (
              <div className="mt-4">
                <Stepper
                  id={`qty-${arcadeChoice}`}
                  label={party.p4.arcade.qty.label}
                  size="compact"
                  value={quantities[arcadeChoice] ?? guests}
                  min={1}
                  max={guests}
                  onChange={(next) => setQuantity(arcadeChoice, next)}
                  decreaseLabel={party.p1.guests.decrease}
                  increaseLabel={party.p1.guests.increase}
                  hint={party.p4.arcade.qty.help}
                />
                <input
                  type="hidden"
                  name={qtyField(arcadeChoice)}
                  value={quantities[arcadeChoice] ?? guests}
                />
              </div>
            ) : null}
          </fieldset>
        </FlowSection>
      ) : null}

      {ineligible.length > 0 ? (
        <FlowSection>
          <div className="border-t border-rule">
            {ineligible.map((model) => (
              <AddOnToggleRow
                key={model.code}
                id={`ineligible-${model.code}`}
                name={model.name}
                price={model.price}
                priceUnit={model.unit ?? undefined}
                unavailableReason={model.reason}
                disabled
              />
            ))}
          </div>
        </FlowSection>
      ) : null}

      {showTimePlayWarning ? (
        <ValidationMessage tone="warning">{party.p4.warn.timeplayQbix}</ValidationMessage>
      ) : null}

      <StickyActionBar
        hideAtLg={false}
        action={
          <Button
            type="submit"
            name="intent"
            value="continue"
            variant="primary"
            pending={pending}
            pendingLabel={global.loading.saving}
          >
            {party.p4.cta}
          </Button>
        }
      >
        <MonoValue step="sm">{state.notice ?? runningTotal}</MonoValue>
      </StickyActionBar>
    </form>
  );
}
