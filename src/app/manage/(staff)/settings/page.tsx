import type { Metadata } from 'next';

import { Caption, MonoValue, PageShell } from '@/components/ui';
import { manager } from '@/lib/copy/manager';
import { prisma } from '@/lib/db/client';
import { SETTING_SPECS, validatePizzaTiers } from '@/lib/domain';
import { formatMoneyPlain } from '@/lib/format';

import {
  saveAddOnsAction,
  saveGamePricingAction,
  savePackagesAction,
  savePizzaTiersAction,
  saveSettingsAction,
} from '../../_lib/actions';
import { CheckField, Field, SaveButton, SetupPage, SetupSection } from '../../_components/setup';

/**
 * `/manage/settings` — STRATEGY §4.8: "**Every number in §3 comes from here. Nothing in the
 * flow may be hardcoded.**"
 *
 * The booking-rules section is **generated from `SETTING_SPECS`**, not hand-written. That is
 * the mechanical guarantee behind the claim: add a knob to the §2.0 registry and it appears
 * here with no edit to this file, so there is no way for a configuration key to exist that the
 * manager cannot reach. The labels COPY.md §13.13 supplies are attached by key; anything the
 * deck does not name falls back to the registry's own `description` column, which the seed
 * writes — so an unlabelled key reads as a sentence, never as a raw identifier.
 *
 * Prices, packages, pizza tiers and add-ons are separate forms because they are separate
 * tables and a partial save of one must not touch the others.
 */

export const metadata: Metadata = { title: manager.mg.settings.title };
export const dynamic = 'force-dynamic';

const { mg } = manager;

/** COPY.md §13.13 labels, by registry key. Anything absent falls back to `Setting.description`. */
const LABELS: Record<string, { label: string; help?: string; unit?: string }> = {
  'CFG.onlineCutoffMinutes': {
    label: mg.settings.cutoff.label,
    help: mg.settings.cutoff.help,
    unit: mg.settings.cutoff.unit,
  },
  'CFG.arenaCapacity': {
    label: mg.settings.arenaCap.label,
    help: mg.settings.arenaCap.help,
    unit: mg.settings.arenaCap.unit,
  },
  'CFG.maxPartyGuests': { label: mg.settings.maxGuests.label, unit: mg.settings.maxGuests.unit },
  'CFG.bookingHorizonDays': {
    label: mg.settings.gamesHorizon.label,
    unit: mg.settings.horizon.unit.days,
  },
  'CFG.partyMinLeadHours': { label: mg.settings.partyLead.label },
  'CFG.publicGamesMustBeConsecutive': {
    label: mg.settings.consecutive.label,
    help: mg.settings.consecutive.help,
  },
  'CFG.bookingHoldMinutes': { label: mg.settings.holdGames.label },
  'CFG.maxAgeDifferenceYears': {
    label: mg.settings.ageBand.label,
    help: mg.settings.ageBand.help,
    unit: mg.settings.ageBand.unit,
  },
  'CFG.reservedReleaseLeadMinutes': {
    label: mg.settings.reservedRelease.label,
    help: mg.settings.reservedRelease.help,
  },
  'CFG.taxRatePercent': { label: mg.settings.tax.label, help: mg.settings.tax.help },
  'CFG.depositAmount': { label: mg.settings.deposit.label },
  'CFG.changeNoticeDays': {
    label: mg.settings.notice.label,
    help: mg.settings.notice.help,
    unit: mg.settings.notice.unit,
  },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const [settings, packages, gamePricing, addOns, tiers] = await Promise.all([
    prisma.setting.findMany({ orderBy: { key: 'asc' } }),
    prisma.package.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.gameSlotPricing.findMany({ orderBy: { gameCount: 'asc' } }),
    prisma.addOn.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.pizzaTier.findMany({ orderBy: { minGuests: 'asc' } }),
  ]);

  const byKey = new Map(settings.map((row) => [row.key, row]));
  const tierProblems = validatePizzaTiers(tiers);

  return (
    <PageShell width="page" className="py-6">
      <SetupPage
        title={mg.settings.title}
        saved={params.saved === '1'}
        error={typeof params.error === 'string' ? params.error : undefined}
      >
        {/* ── The §2.0 configuration registry, generated from its own spec ─────────── */}
        <SetupSection title={mg.settings.section.booking}>
          <form action={saveSettingsAction}>
            <div className="grid gap-4 md:grid-cols-2">
              {SETTING_SPECS.map((spec) => {
                const row = byKey.get(spec.key);
                const copy = LABELS[spec.key];
                const label = copy?.label ?? row?.description ?? spec.key;
                const help = [copy?.help, copy?.unit ? `(${copy.unit})` : null, spec.key]
                  .filter(Boolean)
                  .join(' · ');

                if (spec.type === 'BOOL') {
                  return (
                    <CheckField
                      key={spec.key}
                      name={spec.key}
                      markerName="bool"
                      label={label}
                      defaultChecked={row?.value === 'true'}
                      helper={help}
                    />
                  );
                }

                return (
                  <Field
                    key={spec.key}
                    name={spec.key}
                    label={label}
                    defaultValue={row?.value ?? ''}
                    helper={help}
                    inputMode={
                      spec.type === 'INT' || spec.type === 'NULLABLE_INT'
                        ? 'numeric'
                        : spec.type === 'MONEY' || spec.type === 'RATE'
                          ? 'decimal'
                          : 'text'
                    }
                  />
                );
              })}
            </div>
            <SaveButton />
          </form>
        </SetupSection>

        {/* ── Laser tag prices ─────────────────────────────────────────────────────── */}
        <SetupSection
          id="game-prices"
          title={mg.settings.gamePrices.label}
          intro={mg.settings.gamePrices.help}
        >
          <form action={saveGamePricingAction}>
            <div className="grid gap-3 md:grid-cols-3">
              {gamePricing.map((price) => (
                <div key={price.gameCount}>
                  <input type="hidden" name="gameCount" value={price.gameCount} />
                  <Field
                    name={`price:${price.gameCount}`}
                    label={`${price.gameCount} × ${mg.add.type.games}`}
                    defaultValue={formatMoneyPlain(price.pricePerPersonCents)}
                    inputMode="decimal"
                  />
                </div>
              ))}
            </div>
            <SaveButton />
          </form>
        </SetupSection>

        {/* ── Packages ─────────────────────────────────────────────────────────────── */}
        <SetupSection id="packages" title={mg.settings.packages.label}>
          <form action={savePackagesAction}>
            <div className="flex flex-col gap-4">
              {packages.map((pkg) => (
                <div key={pkg.id} className="border border-rule p-3">
                  <input type="hidden" name="packageId" value={pkg.id} />
                  <h3 className="font-display text-heading text-text">{pkg.name}</h3>
                  <div className="mt-2 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <Field
                      name={`package:${pkg.id}:base`}
                      label={mg.settings.package.base}
                      defaultValue={formatMoneyPlain(pkg.basePriceCents)}
                      inputMode="decimal"
                    />
                    <Field
                      name={`package:${pkg.id}:extra`}
                      label={mg.settings.package.extra}
                      defaultValue={formatMoneyPlain(pkg.extraGuestPriceCents)}
                      inputMode="decimal"
                    />
                    <Field
                      name={`package:${pkg.id}:included`}
                      label={mg.settings.package.included}
                      defaultValue={pkg.baseGuests}
                      type="number"
                      inputMode="numeric"
                    />
                    <Field
                      name={`package:${pkg.id}:roomMinutes`}
                      label={mg.settings.package.roomMinutes}
                      defaultValue={pkg.roomMinutes}
                      type="number"
                      inputMode="numeric"
                      helper={manager.TODO_COPY.minutesHelp}
                    />
                    <Field
                      name={`package:${pkg.id}:games`}
                      label={mg.settings.package.games}
                      defaultValue={pkg.gamesIncluded}
                      type="number"
                      inputMode="numeric"
                    />
                    <CheckField
                      name={`package:${pkg.id}:pizza`}
                      label={mg.settings.package.includesFood}
                      defaultChecked={pkg.includesPizza}
                    />
                  </div>
                </div>
              ))}
            </div>
            <SaveButton />
          </form>
        </SetupSection>

        {/* ── Pizza tiers (R-41) ───────────────────────────────────────────────────── */}
        <SetupSection
          id="pizza-tiers"
          title={mg.settings.pizzaTiers.label}
          intro={mg.settings.pizzaTiers.help}
        >
          {tierProblems.length > 0 ? (
            <ul className="mb-3 flex flex-col gap-1">
              {tierProblems.map((problem) => (
                <li key={problem.message} className="text-body-sm text-state-full">
                  {problem.message}
                </li>
              ))}
            </ul>
          ) : null}

          <form action={savePizzaTiersAction}>
            <div className="flex flex-col gap-2">
              {tiers.map((tier, index) => (
                <div key={tier.id} className="grid gap-3 md:grid-cols-3">
                  <input type="hidden" name="tierIndex" value={index} />
                  <Field
                    name={`tier:${index}:min`}
                    label={mg.bookings.filter.dateFrom}
                    defaultValue={tier.minGuests}
                    type="number"
                    inputMode="numeric"
                  />
                  <Field
                    name={`tier:${index}:max`}
                    label={mg.bookings.filter.dateTo}
                    defaultValue={tier.maxGuests}
                    type="number"
                    inputMode="numeric"
                  />
                  <Field
                    name={`tier:${index}:count`}
                    label={mg.settings.pizzaTiers.label}
                    defaultValue={tier.pizzaCount}
                    type="number"
                    inputMode="numeric"
                  />
                </div>
              ))}
            </div>
            <SaveButton />
          </form>
        </SetupSection>

        {/* ── Add-ons ──────────────────────────────────────────────────────────────── */}
        <SetupSection id="addons" title={mg.settings.addons.label}>
          <form action={saveAddOnsAction}>
            <div className="flex flex-col gap-3">
              {addOns.map((addOn) => (
                <div key={addOn.id} className="grid items-end gap-3 border border-rule p-3 md:grid-cols-4">
                  <input type="hidden" name="addOnId" value={addOn.id} />
                  <div className="min-w-0">
                    <p className="text-body-sm text-text">{addOn.name}</p>
                    <MonoValue step="xs" className="text-text-3">
                      {addOn.code}
                    </MonoValue>
                  </div>
                  <Field
                    name={`addon:${addOn.id}:price`}
                    label={mg.settings.addon.price}
                    defaultValue={formatMoneyPlain(addOn.priceCents)}
                    inputMode="decimal"
                  />
                  <CheckField
                    name={`addon:${addOn.id}:taxIncluded`}
                    label={mg.settings.addon.taxIncluded}
                    defaultChecked={addOn.taxIncluded}
                  />
                  <CheckField
                    name={`addon:${addOn.id}:active`}
                    label={mg.rooms.col.active}
                    defaultChecked={addOn.isActive}
                  />
                </div>
              ))}
            </div>
            <SaveButton />
          </form>
        </SetupSection>

        <Caption>{mg.settings.policyText.warning}</Caption>
      </SetupPage>
    </PageShell>
  );
}
