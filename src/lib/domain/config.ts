/**
 * The §2.0 Configuration Registry, parsed from `Setting` rows into a typed object.
 *
 * The point of this module is negative: no number in RULES.md §2.0 may appear as a literal
 * anywhere else in `src/`. If a domain function needs 90, or 25, or 14, it reads it off the
 * `EngineConfig` it was handed. `SETTING_KEYS` below is the single list of what must exist;
 * `loadEngineConfig` fails loudly if the database is missing one, rather than silently
 * substituting a default that the manager never approved.
 */

import { cents, parseMoney, parseRateToMilliPercent, type Cents } from './money';

export interface SettingRow {
  key: string;
  value: string;
  valueType: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface EngineConfig {
  /** R-01. All rule evaluation happens in this zone. */
  timezone: string;
  gameIntervalMinutes: number;
  gameDurationMinutes: number;
  arenaCapacity: number;
  onlineCutoffMinutes: number;
  cutoffAppliesToManager: boolean;
  maxGamesPerPublicBooking: number;
  publicGamesMustBeConsecutive: boolean;
  lastGameStartOffsetMinutes: number;
  reservedReleaseLeadMinutes: number;
  partyGameMinGapMinutes: number;
  autoAssignedGamesBlockPublic: boolean;
  partiesMayShareGameSlot: boolean;
  publicMayJoinPartyHeldSlot: boolean;
  maxAgeDifferenceYears: number;
  packageBaseGuests: number;
  maxPartyGuests: number;
  minPartyGuests: number;
  maxPartiesPerWindow: number | null;
  windowChangeoverMinutes: number;
  depositAmountCents: Cents;
  changeNoticeDays: number;
  /** Thousandths of a percent: 12.0% = 12000. Keeps the tax line integer arithmetic. */
  taxRateMilliPercent: number;
  bookingHoldMinutes: number;
  bookingHorizonDays: number;
  partyMinLeadHours: number;
  minHonoreeAge: number;
  maxHonoreeAge: number;
  hotDogsPerGuest: number;
  cupcakesPerGuest: number;
  arcadeMatchMinCents: Cents;
  arcadeMatchMaxCents: Cents;
  arcadeMatchIncrementCents: Cents;
  /** R-25 requires the phone number in the EXCEEDS_MAX_PARTY_SIZE copy, so it is config too. */
  venuePhone: string;
}

type Spec =
  | { key: string; type: 'INT'; field: keyof EngineConfig }
  | { key: string; type: 'NULLABLE_INT'; field: keyof EngineConfig }
  | { key: string; type: 'BOOL'; field: keyof EngineConfig }
  | { key: string; type: 'STRING'; field: keyof EngineConfig }
  | { key: string; type: 'MONEY'; field: keyof EngineConfig }
  | { key: string; type: 'RATE'; field: keyof EngineConfig };

/** The complete registry. Adding a rule that needs a new knob means adding a row here. */
export const SETTING_SPECS: readonly Spec[] = [
  { key: 'CFG.timezone', type: 'STRING', field: 'timezone' },
  { key: 'CFG.gameIntervalMinutes', type: 'INT', field: 'gameIntervalMinutes' },
  { key: 'CFG.gameDurationMinutes', type: 'INT', field: 'gameDurationMinutes' },
  { key: 'CFG.arenaCapacity', type: 'INT', field: 'arenaCapacity' },
  { key: 'CFG.onlineCutoffMinutes', type: 'INT', field: 'onlineCutoffMinutes' },
  { key: 'CFG.cutoffAppliesToManager', type: 'BOOL', field: 'cutoffAppliesToManager' },
  { key: 'CFG.maxGamesPerPublicBooking', type: 'INT', field: 'maxGamesPerPublicBooking' },
  { key: 'CFG.publicGamesMustBeConsecutive', type: 'BOOL', field: 'publicGamesMustBeConsecutive' },
  { key: 'CFG.lastGameStartOffsetMinutes', type: 'INT', field: 'lastGameStartOffsetMinutes' },
  { key: 'CFG.reservedReleaseLeadMinutes', type: 'INT', field: 'reservedReleaseLeadMinutes' },
  { key: 'CFG.partyGameMinGapMinutes', type: 'INT', field: 'partyGameMinGapMinutes' },
  { key: 'CFG.autoAssignedGamesBlockPublic', type: 'BOOL', field: 'autoAssignedGamesBlockPublic' },
  { key: 'CFG.partiesMayShareGameSlot', type: 'BOOL', field: 'partiesMayShareGameSlot' },
  { key: 'CFG.publicMayJoinPartyHeldSlot', type: 'BOOL', field: 'publicMayJoinPartyHeldSlot' },
  { key: 'CFG.maxAgeDifferenceYears', type: 'INT', field: 'maxAgeDifferenceYears' },
  { key: 'CFG.packageBaseGuests', type: 'INT', field: 'packageBaseGuests' },
  { key: 'CFG.maxPartyGuests', type: 'INT', field: 'maxPartyGuests' },
  { key: 'CFG.minPartyGuests', type: 'INT', field: 'minPartyGuests' },
  { key: 'CFG.maxPartiesPerWindow', type: 'NULLABLE_INT', field: 'maxPartiesPerWindow' },
  { key: 'CFG.windowChangeoverMinutes', type: 'INT', field: 'windowChangeoverMinutes' },
  { key: 'CFG.depositAmount', type: 'MONEY', field: 'depositAmountCents' },
  { key: 'CFG.changeNoticeDays', type: 'INT', field: 'changeNoticeDays' },
  { key: 'CFG.taxRatePercent', type: 'RATE', field: 'taxRateMilliPercent' },
  { key: 'CFG.bookingHoldMinutes', type: 'INT', field: 'bookingHoldMinutes' },
  { key: 'CFG.bookingHorizonDays', type: 'INT', field: 'bookingHorizonDays' },
  { key: 'CFG.partyMinLeadHours', type: 'INT', field: 'partyMinLeadHours' },
  { key: 'CFG.minHonoreeAge', type: 'INT', field: 'minHonoreeAge' },
  { key: 'CFG.maxHonoreeAge', type: 'INT', field: 'maxHonoreeAge' },
  { key: 'CFG.hotDogsPerGuest', type: 'INT', field: 'hotDogsPerGuest' },
  { key: 'CFG.cupcakesPerGuest', type: 'INT', field: 'cupcakesPerGuest' },
  { key: 'CFG.arcadeMatchMinAmount', type: 'MONEY', field: 'arcadeMatchMinCents' },
  { key: 'CFG.arcadeMatchMaxAmount', type: 'MONEY', field: 'arcadeMatchMaxCents' },
  { key: 'CFG.arcadeMatchIncrement', type: 'MONEY', field: 'arcadeMatchIncrementCents' },
  { key: 'CFG.venuePhone', type: 'STRING', field: 'venuePhone' },
];

export const SETTING_KEYS: readonly string[] = SETTING_SPECS.map((s) => s.key);

function parseInteger(key: string, raw: string): number {
  if (!/^-?\d+$/.test(raw.trim())) {
    throw new ConfigError(`Setting "${key}" must be a whole number, found "${raw}". Fix it in the manager backend.`);
  }
  return Number.parseInt(raw.trim(), 10);
}

function parseBoolean(key: string, raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  throw new ConfigError(`Setting "${key}" must be true or false, found "${raw}".`);
}

/**
 * Turn `Setting` rows into the typed config. Throws on a missing or unparseable key —
 * a booking engine running on half a configuration is worse than one that refuses to start.
 */
export function loadEngineConfig(rows: readonly SettingRow[]): EngineConfig {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const missing = SETTING_KEYS.filter((k) => !byKey.has(k));
  if (missing.length > 0) {
    throw new ConfigError(
      `Missing configuration keys: ${missing.join(', ')}. Run the seed, or add them in the manager backend.`,
    );
  }

  const out: Record<string, unknown> = {};
  for (const spec of SETTING_SPECS) {
    const raw = byKey.get(spec.key) as string;
    switch (spec.type) {
      case 'INT':
        out[spec.field] = parseInteger(spec.key, raw);
        break;
      case 'NULLABLE_INT':
        out[spec.field] = raw.trim() === '' || raw.trim().toLowerCase() === 'null' ? null : parseInteger(spec.key, raw);
        break;
      case 'BOOL':
        out[spec.field] = parseBoolean(spec.key, raw);
        break;
      case 'STRING':
        out[spec.field] = raw;
        break;
      case 'MONEY':
        out[spec.field] = parseMoney(raw);
        break;
      case 'RATE':
        out[spec.field] = parseRateToMilliPercent(raw);
        break;
    }
  }

  const config = out as unknown as EngineConfig;
  validateEngineConfig(config);
  return config;
}

/** Cheap sanity checks that catch a mis-typed setting before it produces a wrong booking. */
export function validateEngineConfig(config: EngineConfig): void {
  const problems: string[] = [];
  if (config.gameIntervalMinutes <= 0) problems.push('CFG.gameIntervalMinutes must be positive.');
  if (config.gameDurationMinutes <= 0) problems.push('CFG.gameDurationMinutes must be positive.');
  if (config.arenaCapacity <= 0) problems.push('CFG.arenaCapacity must be positive.');
  if (config.onlineCutoffMinutes < 0) problems.push('CFG.onlineCutoffMinutes cannot be negative.');
  if (config.maxGamesPerPublicBooking <= 0) problems.push('CFG.maxGamesPerPublicBooking must be positive.');
  if (config.maxPartyGuests < config.minPartyGuests) {
    problems.push('CFG.maxPartyGuests must be at least CFG.minPartyGuests.');
  }
  if (config.maxHonoreeAge < config.minHonoreeAge) {
    problems.push('CFG.maxHonoreeAge must be at least CFG.minHonoreeAge.');
  }
  if (config.taxRateMilliPercent < 0) problems.push('CFG.taxRatePercent cannot be negative.');
  if (config.depositAmountCents < 0) problems.push('CFG.depositAmount cannot be negative.');
  if (config.arcadeMatchIncrementCents <= 0) problems.push('CFG.arcadeMatchIncrement must be positive.');
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone });
  } catch {
    problems.push(`CFG.timezone "${config.timezone}" is not a valid IANA time zone.`);
  }
  if (problems.length > 0) {
    throw new ConfigError(`Configuration is invalid:\n - ${problems.join('\n - ')}`);
  }
}

/** Round-trips an `EngineConfig` field back to its stored string form (manager backend save path). */
export function settingValueFor(config: EngineConfig, key: string): string {
  const spec = SETTING_SPECS.find((s) => s.key === key);
  if (!spec) throw new ConfigError(`Unknown setting key "${key}".`);
  const value = config[spec.field];
  if (spec.type === 'MONEY') {
    const c = cents(value as number);
    return `${Math.floor(c / 100)}.${String(Math.abs(c % 100)).padStart(2, '0')}`;
  }
  if (spec.type === 'RATE') {
    const rate = value as number;
    return `${Math.floor(rate / 1000)}.${String(rate % 1000).padStart(3, '0').replace(/0+$/, '') || '0'}`;
  }
  return value === null ? 'null' : String(value);
}
