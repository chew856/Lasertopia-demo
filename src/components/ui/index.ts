/**
 * The Lasertopia component library. `import { Button, SlotTile } from '@/components/ui'`.
 *
 * See ./README.md for the API contract: props, states and one usage example each.
 *
 * Everything here is a server component except `date-picker.tsx`, which needs refs and
 * imperative focus for its roving `tabindex`. Components that take callbacks are still
 * server-by-default — the client boundary belongs to the surface that owns the state.
 */

export { cx } from "./cx";

export {
  HATCH_4,
  HATCH_6,
  DISABLED_CONTROL,
  ARIA_DISABLED_CONTROL,
  TRANSITION_SURFACE,
  INSET_RING_ACCENT,
  MEASURE_BODY,
  MEASURE_SMALL,
  HAIRLINE_GRID,
} from "./styles";

export { BangMark, CheckMark, ChevronDown, ChevronSide, SlashMark } from "./marks";

export {
  Button,
  ButtonLink,
  buttonClassName,
  type ButtonProps,
  type ButtonLinkProps,
  type ButtonVariant,
} from "./button";

export {
  Caption,
  Eyebrow,
  FieldLabel,
  InlineMono,
  MonoValue,
  type MonoStep,
} from "./typography";

export { Hairline } from "./hairline";
export { MonoChip, Tag, type TagProps, type TagTone } from "./tag";

export {
  FieldStack,
  FlowLayout,
  FlowSection,
  PageShell,
  type ShellWidth,
} from "./page-shell";

export {
  SectionHeader,
  type HeadingLevel,
  type SectionHeaderProps,
} from "./section-header";

export { StepIndicator, type StepIndicatorProps } from "./step-indicator";
export { StickyActionBar } from "./sticky-action-bar";

export {
  TextArea,
  TextInput,
  type TextAreaProps,
  type TextInputProps,
} from "./text-input";

export { Select, type SelectProps } from "./select";
export { Checkbox, type CheckboxProps } from "./checkbox";
export { Stepper, type StepperProps } from "./stepper";
export { AddOnToggleRow, type AddOnToggleRowProps } from "./addon-row";

export {
  DateStrip,
  MonthGrid,
  type DateAvailability,
  type DateOption,
  type DateStripProps,
  type MonthGridProps,
} from "./date-picker";

export {
  SlotGrid,
  SlotHourHeader,
  SlotTile,
  type SlotState,
  type SlotTileProps,
} from "./slot-tile";

export {
  PartyBayRow,
  PartyWindowCard,
  type BayState,
  type PartyBayRowProps,
  type PartyWindowCardProps,
} from "./party-window-card";

export {
  OrderSummary,
  type OrderLine,
  type OrderSummaryProps,
} from "./order-summary";

export {
  FormErrorSummary,
  ValidationMessage,
  type FormErrorSummaryProps,
  type MessageTone,
  type ValidationMessageProps,
} from "./validation-message";

export { EmptyState, LoadingBlock } from "./empty-state";

export {
  BoardBookingChip,
  ScheduleBoard,
  type BoardChip,
  type BoardChipState,
  type BoardColumn,
  type BoardRow,
  type ScheduleBoardProps,
} from "./schedule-board";
