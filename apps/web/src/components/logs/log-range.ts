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

/** Outer limits the resolved window stays inside; a bounded end also anchors presets. */
export type TLogBounds = { start?: number; end?: number };

/** A null end means the window is open, so the viewer keeps tailing. */
export function resolveLogRange(
  range: TLogRange,
  bounds: TLogBounds = {},
): { start: string; end: string | null } {
  const anchor = range.until ?? bounds.end ?? Date.now();
  let start = range.from ?? anchor - presetMs[range.preset ?? defaultLogRangePreset];
  let end = range.until ?? bounds.end ?? null;
  if (bounds.start !== undefined && start < bounds.start) start = bounds.start;
  if (bounds.end !== undefined && end !== null && end > bounds.end) end = bounds.end;
  return {
    start: new Date(start).toISOString(),
    end: end === null ? null : new Date(end).toISOString(),
  };
}

function isPreset(value: string): value is TLogRangePreset {
  return (logRangePresets as readonly string[]).includes(value);
}

// Both codecs speak the same readable format: a bare preset ("1h"), or
// "from..until" where either side may be empty, the left side may be a preset
// anchored to the end time ("1h..2026-08-30_21:30"), and a timestamp is
// "yyyy-MM-dd", "yyyy-MM-dd_HH:mm" or "yyyy-MM-dd_HH:mm:ss". The URL param
// codec reads and writes UTC; the search-token codec local time, and its
// values contain no characters that would end a token in the search grammar.

const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})(?:_(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

type TDateTimeCodec = {
  toMs: (y: number, month: number, d: number, h: number, min: number, s: number) => number;
  toParts: (ms: number) => [number, number, number, number, number, number];
};

const utcCodec: TDateTimeCodec = {
  toMs: (y, month, d, h, min, s) => Date.UTC(y, month - 1, d, h, min, s),
  toParts: (ms) => {
    const date = new Date(ms);
    return [
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ];
  },
};

const localCodec: TDateTimeCodec = {
  toMs: (y, month, d, h, min, s) => new Date(y, month - 1, d, h, min, s).getTime(),
  toParts: (ms) => {
    const date = new Date(ms);
    return [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    ];
  },
};

function parseDateTime(value: string, codec: TDateTimeCodec): number | undefined {
  const match = dateTimePattern.exec(value);
  if (!match) return undefined;
  const [y, month, d, h, min, s] = match.slice(1).map((part) => Number(part ?? 0));
  if (month < 1 || month > 12 || d < 1 || d > 31) return undefined;
  if (h > 23 || min > 59 || s > 59) return undefined;
  return codec.toMs(y, month, d, h, min, s);
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

function formatDateTime(ms: number, codec: TDateTimeCodec): string {
  const [y, month, d, h, min, s] = codec.toParts(ms);
  const date = `${pad(y, 4)}-${pad(month)}-${pad(d)}`;
  if (!h && !min && !s) return date;
  const time = `${date}_${pad(h)}:${pad(min)}`;
  return s ? `${time}:${pad(s)}` : time;
}

function encodeRangeWith(range: TLogRange, codec: TDateTimeCodec): string {
  const preset = activeLogRangePreset(range);
  if (preset !== null && range.until === undefined) return preset;
  // sub-second moments round outward so the encoded window never shrinks
  const from =
    range.from === undefined
      ? (preset ?? defaultLogRangePreset)
      : formatDateTime(Math.floor(range.from / 1000) * 1000, codec);
  const until =
    range.until === undefined ? "" : formatDateTime(Math.ceil(range.until / 1000) * 1000, codec);
  return `${from}..${until}`;
}

function decodeRangeWith(value: string, codec: TDateTimeCodec): TLogRange | null {
  if (isPreset(value)) return { preset: value };
  const sides = value.split("..");
  if (sides.length !== 2) return null;
  const [left, right] = sides;
  const until = right ? parseDateTime(right, codec) : undefined;
  if (right && until === undefined) return null;
  if (isPreset(left)) return { preset: left, until };
  if (!left) return until === undefined ? null : { until };
  const from = parseDateTime(left, codec);
  if (from === undefined) return null;
  if (until !== undefined && until <= from) return null;
  return { from, until };
}

/** URL param codec; timestamps are UTC and malformed values fall back to the default. */
export function encodeRange(range: TLogRange): string {
  return encodeRangeWith(range, utcCodec);
}

export function decodeRange(value: string | undefined): TLogRange {
  if (!value) return defaultLogRange;
  return decodeRangeWith(value, utcCodec) ?? defaultLogRange;
}

/** Search-token codec; timestamps are local time and malformed values are null so the token can fall back to a plain term. */
export function encodeRangeToken(range: TLogRange): string {
  return encodeRangeWith(range, localCodec);
}

export function decodeRangeToken(value: string): TLogRange | null {
  return decodeRangeWith(value, localCodec);
}
