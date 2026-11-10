import type { SnapshotSource } from '../../shared/client/types.ts';

export interface EffortLevel { readonly id: string; readonly name: string }
export interface ReasoningMeta { readonly efforts: readonly EffortLevel[]; readonly defaultEffort?: string }
export interface EffortChoice { readonly id: string | undefined; readonly label: string }
export interface EffortBar {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly filled: boolean;
}
export interface ArcTick {
  readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number;
}
export interface ArcNeedle {
  readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number;
  /** SVG clockwise rotation from a needle pointing straight up, used for the CSS transition. */
  readonly rotation: number;
}
export interface ArcGeometry {
  readonly track: string;
  readonly ticks: readonly ArcTick[];
  readonly needle: ArcNeedle | null;
  readonly hub: { readonly cx: number; readonly cy: number; readonly r: number };
  /** True when no level is chosen (provider default); the needle parks in the bottom gap. */
  readonly auto: boolean;
}
export interface ModelSelectionLike { readonly provider: string; readonly model: string; readonly reasoningEffort?: string }
export interface SelectionResult { readonly ok: boolean; readonly error?: { readonly message?: string } }
export interface DirectorySnapshot {
  readonly current: { readonly provider: string; readonly model: string; readonly reasoningEffort?: string } | null;
  readonly groups: readonly {
    readonly id: string;
    readonly models: readonly { readonly id: string; readonly reasoning?: ReasoningMeta }[];
  }[];
  readonly status: string;
  readonly error: string | null;
}
export interface DirectoryLike {
  readonly store: SnapshotSource<DirectorySnapshot>;
  load(): Promise<unknown>;
  select(selection: ModelSelectionLike): Promise<SelectionResult>;
}
export interface ModelDirectories { directoryFor(sessionId: string): DirectoryLike }

/** The same sequence as the native model seat: Default only when the model declares no default effort. */
export function effortChoices(reasoning: ReasoningMeta | undefined, defaultLabel: string): EffortChoice[] {
  if (!reasoning || reasoning.efforts.length === 0) return [];
  const result: EffortChoice[] = [];
  if (reasoning.defaultEffort === undefined) result.push({ id: undefined, label: defaultLabel });
  for (const level of reasoning.efforts) result.push({ id: level.id, label: level.name });
  return result;
}

/** Resolve the index of the effort the Host actually reports, without inventing a level. */
export function currentChoiceIndex(choices: readonly EffortChoice[], effectiveEffort: string | undefined): number {
  const found = choices.findIndex(choice => choice.id === effectiveEffort);
  return found < 0 ? 0 : found;
}

/** Default (undefined effort) lights no bar; the i-th declared level lights i bars. */
export function litBars(choices: readonly EffortChoice[], index: number): number {
  return choices.slice(0, index + 1).filter(choice => choice.id !== undefined).length;
}

const VIEW_WIDTH = 44;
const VIEW_HEIGHT = 14;
const BAR_WIDTH = 3;
const BAR_GAP = 2;

/** One bar per declared level, centered in a fixed-width glyph so switching models never moves the button. */
export function barGeometry(count: number, active: number, viewWidth = VIEW_WIDTH): EffortBar[] {
  if (count <= 0) return [];
  const natural = count * BAR_WIDTH + (count - 1) * BAR_GAP;
  const scale = Math.min(1, viewWidth / natural);
  const width = BAR_WIDTH * scale;
  const gap = BAR_GAP * scale;
  const offset = (viewWidth - (count * width + (count - 1) * gap)) / 2;
  const round = (value: number) => Math.round(value * 100) / 100;
  const fullHeight = VIEW_HEIGHT - 1;
  return Array.from({ length: count }, (_, index) => {
    // Equal shares of the glyph: the height is divided by the level count, so two
    // levels are half and full height instead of a fixed lowest-to-highest jump.
    const height = fullHeight * (index + 1) / count;
    return {
      x: round(offset + index * (width + gap)),
      y: round(VIEW_HEIGHT - height),
      width: round(width),
      height: round(height),
      filled: index < active,
    };
  });
}

// Fixed gauge mirroring the host product icon `gauge-outline` (16 x 16): centre (8, 8.5),
// radius 6.5, 270° opening at the bottom. Only the needle turns with the level.
const ARC_CENTER_X = 8;
const ARC_CENTER_Y = 8.5;
const ARC_TRACK = 'M3.4041 13.096C2.49514 12.187 1.87614 11.0288 1.62537 9.76798C1.37459 8.50716 1.50331 7.20028 1.99525 6.01261C2.48719 4.82494 3.32025 3.80981 4.3891 3.09557C5.45795 2.38134 6.71458 2.00008 8.0001 2C9.28563 2.00008 10.5423 2.38134 11.6111 3.09557C12.68 3.80981 13.513 4.82494 14.005 6.01261C14.4969 7.20028 14.6256 8.50716 14.3748 9.76798C14.1241 11.0288 13.5051 12.187 12.5961 13.096';
const ARC_TICK_INNER = 5;
const ARC_TICK_OUTER = 6.25;
const ARC_NEEDLE_LENGTH = 5.1;
const ARC_START_DEG = 225;
const ARC_SWEEP_DEG = 270;
// Graduations run the full 270° arc, including both ends, dividing it into four equal segments.
const ARC_TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;
const ARC_HUB_RADIUS = 1;

/** A fixed host-style gauge: light arc and ticks, plus one accent needle that turns from low to high. */
export function arcGeometry(count: number, active: number): ArcGeometry {
  const round = (value: number) => Math.round(value * 100) / 100;
  const hub = { cx: ARC_CENTER_X, cy: ARC_CENTER_Y, r: ARC_HUB_RADIUS };
  if (count <= 0) return { track: '', ticks: [], needle: null, hub, auto: true };
  const at = (radius: number, fraction: number) => {
    const angle = (ARC_START_DEG - ARC_SWEEP_DEG * fraction) * Math.PI / 180;
    return [round(ARC_CENTER_X + radius * Math.cos(angle)), round(ARC_CENTER_Y - radius * Math.sin(angle))] as const;
  };
  const ticks = ARC_TICK_FRACTIONS.map(fraction => {
    const [x1, y1] = at(ARC_TICK_INNER, fraction);
    const [x2, y2] = at(ARC_TICK_OUTER, fraction);
    return { x1, y1, x2, y2 };
  });
  // Real levels spread across the whole scale; "default" is not a level and parks at the bottom gap.
  const auto = active <= 0;
  const step = count <= 1 ? 0.5 : (Math.min(active, count) - 1) / (count - 1);
  const rotation = auto ? -180 : 90 - (ARC_START_DEG - ARC_SWEEP_DEG * step);
  return {
    track: ARC_TRACK, ticks, hub, auto,
    needle: { x1: ARC_CENTER_X, y1: ARC_CENTER_Y, x2: ARC_CENTER_X, y2: ARC_CENTER_Y - ARC_NEEDLE_LENGTH, rotation: round(rotation) },
  };
}
