import {
  ConfigError,
  SETTING_SPECS,
  loadEngineConfig,
  parseMoney,
  parseRateToMilliPercent,
  validatePizzaTiers,
  type PizzaTierRecord,
  type SettingRow,
} from '@/lib/domain';

/**
 * `/manage/settings` — the save path, as pure functions.
 *
 * STRATEGY §4.8: "Every number in §3 comes from here. Nothing in the flow may be hardcoded."
 * `SETTING_SPECS` is already the single list of what the registry contains, so this module
 * derives the whole form from it rather than restating the keys — add a knob to the registry
 * and the settings screen grows a field, with no edit here.
 *
 * Validation runs twice on purpose, matching the two-phase rule the rest of the product uses:
 * once per field (so a mistyped cutoff points at the cutoff), and once over the merged
 * registry via `loadEngineConfig`, which is the same parse the engine will do at request time.
 * A configuration that passes here cannot fail to load later.
 */

export interface SettingFieldError {
  key: string;
  message: string;
}

export interface SettingsSubmission {
  rows: SettingRow[];
  errors: SettingFieldError[];
}

const TYPE_HINT: Record<string, string> = {
  INT: 'a whole number',
  NULLABLE_INT: 'a whole number, or blank for no limit',
  BOOL: 'on or off',
  STRING: 'text',
  MONEY: 'an amount like 50.00',
  RATE: 'a percentage like 12',
};

function validateOne(key: string, type: string, raw: string): string | null {
  const value = raw.trim();
  switch (type) {
    case 'INT':
      return /^-?\d+$/.test(value) ? null : `${key} must be ${TYPE_HINT.INT}. You typed "${raw}".`;
    case 'NULLABLE_INT':
      return value === '' || value.toLowerCase() === 'null' || /^-?\d+$/.test(value)
        ? null
        : `${key} must be ${TYPE_HINT.NULLABLE_INT}. You typed "${raw}".`;
    case 'BOOL':
      return ['true', 'false', '1', '0'].includes(value.toLowerCase())
        ? null
        : `${key} must be ${TYPE_HINT.BOOL}.`;
    case 'STRING':
      return value === '' ? `${key} can't be empty.` : null;
    case 'MONEY':
      try {
        parseMoney(value);
        return null;
      } catch {
        return `${key} must be ${TYPE_HINT.MONEY}. You typed "${raw}".`;
      }
    case 'RATE':
      try {
        parseRateToMilliPercent(value);
        return null;
      } catch {
        return `${key} must be ${TYPE_HINT.RATE}. You typed "${raw}".`;
      }
    default:
      return null;
  }
}

/**
 * Merge a form submission over the stored rows and validate the result.
 *
 * A key absent from `submitted` keeps its stored value: the settings screen renders in
 * sections, and a partial save must never blank the registry keys the manager could not see.
 */
export function parseSettingsSubmission(
  submitted: Readonly<Record<string, string>>,
  stored: readonly SettingRow[],
): SettingsSubmission {
  const byKey = new Map(stored.map((row) => [row.key, row]));
  const errors: SettingFieldError[] = [];
  const rows: SettingRow[] = [];

  for (const spec of SETTING_SPECS) {
    const existing = byKey.get(spec.key);
    const raw = Object.prototype.hasOwnProperty.call(submitted, spec.key)
      ? submitted[spec.key]
      : (existing?.value ?? '');

    const problem = validateOne(spec.key, spec.type, raw);
    if (problem) errors.push({ key: spec.key, message: problem });

    rows.push({
      key: spec.key,
      value: spec.type === 'BOOL' ? String(raw.trim().toLowerCase() === 'true' || raw.trim() === '1') : raw.trim(),
      valueType: existing?.valueType ?? spec.type,
    });
  }

  if (errors.length === 0) {
    try {
      loadEngineConfig(rows);
    } catch (error) {
      if (error instanceof ConfigError) {
        // A cross-field failure ("max guests below min guests") belongs to no single input, so
        // it is reported against the registry as a whole rather than pinned to a wrong field.
        errors.push({ key: '', message: error.message });
      } else {
        throw error;
      }
    }
  }

  return { rows, errors };
}

/** A checkbox that is off is simply absent from `FormData`, which is not the same as invalid. */
export function readCheckbox(formData: FormData, name: string): string {
  return formData.get(name) === null ? 'false' : 'true';
}

// ─── Pizza tiers ─────────────────────────────────────────────────────────────────────────

export interface TierSubmission {
  tiers: PizzaTierRecord[];
  errors: string[];
}

/**
 * R-41: every guest count from 1 up is covered exactly once. `validatePizzaTiers` is the
 * engine's own contiguity check — the manager screen calls the same function the booking flow
 * relies on, so the two can never disagree about what a valid tier table is.
 */
export function parseTierSubmission(
  rows: readonly { minGuests: string; maxGuests: string; pizzaCount: string }[],
): TierSubmission {
  const errors: string[] = [];
  const tiers: PizzaTierRecord[] = [];

  rows.forEach((row, index) => {
    const min = Number.parseInt(row.minGuests, 10);
    const max = Number.parseInt(row.maxGuests, 10);
    const count = Number.parseInt(row.pizzaCount, 10);
    if (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(count)) {
      errors.push(`Row ${index + 1} needs three whole numbers: from, to and pizzas.`);
      return;
    }
    if (max < min) {
      errors.push(`Row ${index + 1} ends (${max}) before it starts (${min}).`);
      return;
    }
    if (count < 0) {
      errors.push(`Row ${index + 1} can't include a negative number of pizzas.`);
      return;
    }
    tiers.push({ minGuests: min, maxGuests: max, pizzaCount: count });
  });

  if (errors.length === 0) {
    for (const problem of validatePizzaTiers(tiers)) {
      errors.push(problem.message);
    }
  }

  return { tiers, errors };
}
