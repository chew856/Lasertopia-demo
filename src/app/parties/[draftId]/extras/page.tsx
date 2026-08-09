import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FlowLayout, FlowSection, PageShell } from "@/components/ui";
import { global, interpolate, party } from "@/lib/copy";
import { includedPizzaCount, pizzaTierFor, type AddOnRecord } from "@/lib/domain";
import { formatMoney } from "@/lib/format";

import { FlowStepHeader, SummaryRail } from "../../_components/flow-chrome";
import { HoldGate } from "../../_components/hold-gate";
import {
  ExtrasForm,
  type AddOnModel,
  type ExtrasInitialState,
  type IneligibleAddOnModel,
} from "../../_components/extras-form";
import { loadDraftView } from "../../_lib/draft-view";
import {
  addOnBody,
  addOnName,
  addOnOptionLabel,
  addOnUnit,
  groupAddOns,
  ineligibleAddOns,
} from "../../_lib/extras";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${party.p4.title} — ${global.venueName}`,
};

/**
 * Screen P4 — extras. The revenue screen, kept to one tap of cost if a parent wants none.
 *
 * Everything a customer can add is priced and validated by the engine, including the arcade
 * cards' mutual exclusivity (R-47) and their ineligibility on Around The World (R-46). This
 * page's only job is to render what `eligibleAddOns` returns and what `computePartyPrice` says
 * it costs.
 */
export default async function ExtrasPage(props: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { draftId } = await props.params;
  const view = await loadDraftView(draftId);
  if (!view || !view.packageRecord) notFound();

  const { draft, catalog, config, packageRecord, summary } = view;
  const groups = groupAddOns(catalog, packageRecord);
  const notOffered = ineligibleAddOns(catalog, packageRecord);

  const pizzasIncluded = includedPizzaCount({
    guests: draft.guests,
    packageRecord,
    tiers: catalog.pizzaTiers,
    foodChoice: draft.foodChoice,
  });
  const suggestedPizzas = pizzaTierFor(draft.guests, catalog.pizzaTiers)?.pizzaCount ?? 0;

  const toModel = (addOn: AddOnRecord): AddOnModel => {
    const included =
      addOn.code.startsWith("PIZZA") && packageRecord.includesPizza && pizzasIncluded.ok
        ? pizzasIncluded.value
        : 0;
    return {
      code: addOn.code,
      name: addOnName(addOn),
      body: addOnBody(addOn),
      price: formatMoney(addOn.priceCents),
      unit: addOnUnit(addOn),
      requiresOption: addOn.requiresOptionChoice,
      optionLabel: addOnOptionLabel(addOn),
      options: addOn.options.map((option) => ({ id: option.id, label: option.label })),
      perGuest: addOn.pricingMode === "PER_GUEST",
      defaultQuantity: addOn.pricingMode === "PER_GUEST" ? draft.guests : 1,
      maxQuantity: addOn.pricingMode === "PER_GUEST" ? draft.guests : 20,
      derivedLine:
        included > 0
          ? interpolate(party.p4.food.line.included, { pizzaCount: included })
          : null,
    };
  };

  const ineligible: IneligibleAddOnModel[] = notOffered.map((addOn) => ({
    code: addOn.code,
    name: addOnName(addOn),
    price: formatMoney(addOn.priceCents),
    unit: addOnUnit(addOn),
    reason: interpolate(party.err.addonNotEligible.row, {
      packageName: packageRecord.name,
    }),
  }));

  const initial: ExtrasInitialState = {
    checked: draft.addOns
      .filter((line) => !groups.arcade.some((a) => a.code === line.addOnCode))
      .map((line) => line.addOnCode),
    quantities: Object.fromEntries(draft.addOns.map((line) => [line.addOnCode, line.quantity])),
    options: Object.fromEntries(
      draft.addOns
        .filter((line) => line.addOnOptionId !== null)
        .map((line) => [line.addOnCode, line.addOnOptionId as string]),
    ),
    arcadeChoice:
      draft.addOns.find((line) => groups.arcade.some((a) => a.code === line.addOnCode))
        ?.addOnCode ?? "",
  };

  const qbix = groups.other.find((addOn) => addOn.code === "QBIX_5D") ?? null;

  return (
    <PageShell as="main" width="page" className="py-8 md:py-12">
      <FlowSection>
        <FlowStepHeader step={4} title={party.p4.heading} description={party.p4.sub} />
      </FlowSection>

      <FlowSection>
        <HoldGate view={view} />
      </FlowSection>

      <FlowLayout rail={summary ? <SummaryRail model={summary} /> : undefined}>
        <ExtrasForm
          draftId={draft.id}
          guests={draft.guests}
          food={{
            headline: packageRecord.includesPizza
              ? interpolate(party.p4.food.included, {
                  pizzaCount: pizzasIncluded.ok ? pizzasIncluded.value : suggestedPizzas,
                  guests: draft.guests,
                })
              : interpolate(party.p4.food.notIncluded, {
                  guests: draft.guests,
                  pizzaCount: suggestedPizzas,
                }),
            offersHotDogs: packageRecord.includesHotDogOption,
            hotDogNote: packageRecord.includesHotDogOption
              ? party.p4.food.includedHotdogs
              : null,
            choice: draft.foodChoice,
          }}
          addOns={[...groups.food, ...groups.other].map(toModel)}
          arcade={groups.arcade.map(toModel)}
          ineligible={ineligible}
          initial={initial}
          runningTotal={interpolate(party.p4.runningTotal, {
            total: formatMoney(view.breakdown?.totalCents ?? 0),
          })}
          qbixLineTotal={
            qbix
              ? interpolate(party.p4.qbix.lineTotal, {
                  total: formatMoney(qbix.priceCents * draft.guests),
                  guests: draft.guests,
                })
              : null
          }
        />
      </FlowLayout>
    </PageShell>
  );
}
