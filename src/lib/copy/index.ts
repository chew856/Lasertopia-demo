/**
 * The copy barrel. `import { global, interpolate } from '@/lib/copy'`.
 *
 * Four files, four owners, no collisions:
 *
 * | File            | COPY.md section | Owner                   |
 * |-----------------|-----------------|-------------------------|
 * | `./global`      | §1, §2          | Design system           |
 * | `./laser-tag`   | §4  (G1–G5)     | Laser tag surface team  |
 * | `./party`       | §5  (P1–P9)     | Party surface team      |
 * | `./manager`     | §13 (mg, sheet) | Manager surface team    |
 *
 * Formatting rules (`fmt.*`, §1) are not strings and are not here — they live in
 * `src/lib/format.ts`.
 */

export {
  global,
  unit,
  vocab,
  sum,
  hours,
  rule,
  btn,
  hold,
  status,
  loading,
  type Global,
} from "./global";

export {
  interpolate,
  placeholdersIn,
  hasPlaceholders,
  MissingCopyValueError,
  type Placeholders,
  type PlaceholderValue,
  type Values,
} from "./interpolate";

export { laserTag, type LaserTagCopy } from "./laser-tag";
export { party, type PartyCopy } from "./party";
export { manager, type ManagerCopy } from "./manager";
