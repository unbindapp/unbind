export const logRangePresets = ["5m", "15m", "1h", "6h", "24h", "3d", "7d", "30d"] as const;
export type TLogRangePreset = (typeof logRangePresets)[number];

/**
 * `preset` is a duration, `until` is the moment it is anchored to. An explicit
 * `from` pins the start outright and takes the preset's place.
 */
export type TLogRange = { preset?: TLogRangePreset; from?: number; until?: number };

export const defaultLogRangePreset: TLogRangePreset = "24h";
export const defaultLogRange: TLogRange = { preset: defaultLogRangePreset };

const presetMs: Record<TLogRangePreset, number> = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/** The preset only applies while the start isn't pinned by an explicit `from`. */
export function activeLogRangePreset(range: TLogRange): TLogRangePreset | null {
  if (range.from !== undefined) return null;
  return range.preset ?? defaultLogRangePreset;
}

export function resolveLogRange(range: TLogRange): { start: string; end: string | null } {
  const end = range.until === undefined ? null : new Date(range.until).toISOString();
  if (range.from !== undefined) return { start: new Date(range.from).toISOString(), end };
  const anchor = range.until ?? Date.now();
  const start = anchor - presetMs[range.preset ?? defaultLogRangePreset];
  return { start: new Date(start).toISOString(), end };
}

export function isLiveRange(range: TLogRange): boolean {
  return range.until === undefined;
}

function isPreset(value: string): value is TLogRangePreset {
  return (logRangePresets as readonly string[]).includes(value);
}

export function encodeRange(range: TLogRange): string {
  const preset = activeLogRangePreset(range);
  if (preset !== null && range.until === undefined) return preset;
  return `${preset ?? ""}:${range.from ?? ""}:${range.until ?? ""}`;
}

function parseMs(value: string): number | undefined {
  if (!value) return undefined;
  const ms = Number(value);
  return Number.isFinite(ms) ? ms : undefined;
}

export function decodeRange(value: string | undefined): TLogRange {
  if (!value) return defaultLogRange;
  if (isPreset(value)) return { preset: value };
  const parts = /^([^:]*):(\d*):(\d*)$/.exec(value);
  if (!parts) return defaultLogRange;
  const from = parseMs(parts[2]);
  const until = parseMs(parts[3]);
  if (from === undefined && until === undefined) return defaultLogRange;
  if (from !== undefined) return { from, until };
  return { preset: isPreset(parts[1]) ? parts[1] : defaultLogRangePreset, until };
}
