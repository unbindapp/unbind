import type { TLogLine } from "@/lib/queries/logs";

export function logLineKey(line: Pick<TLogLine, "timestamp" | "pod_name" | "message">): string {
  return `${line.timestamp ?? ""}#${line.pod_name}#${line.message}`;
}

/**
 * A URL-safe reference to one log line. Loki has no per-entry id, but its
 * timestamps are nanosecond-precise, so the timestamp plus the pod is unique
 * in practice. Neither side can contain "~": timestamps are RFC3339 and pod
 * names are DNS labels.
 */
export type TLogLineRef = { timestamp: string; podName: string };

export function logLineRef(line: { timestamp: string; pod_name: string }): string {
  return `${line.timestamp}~${line.pod_name}`;
}

export function parseLogLineRef(value: string | undefined): TLogLineRef | null {
  if (!value) return null;
  const separator = value.indexOf("~");
  if (separator <= 0) return null;
  const timestamp = value.slice(0, separator);
  const podName = value.slice(separator + 1);
  if (!podName || Number.isNaN(Date.parse(timestamp))) return null;
  return { timestamp, podName };
}

export function matchesLogLineRef(
  ref: TLogLineRef,
  line: Pick<TLogLine, "timestamp" | "pod_name">,
): boolean {
  return line.timestamp === ref.timestamp && line.pod_name === ref.podName;
}

/** The line closest in time to the target; -1 when none has a usable timestamp. */
export function nearestLogLineIndex(
  lines: readonly Pick<TLogLine, "timestamp">[],
  targetMs: number,
): number {
  let nearest = -1;
  let nearestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < lines.length; i++) {
    const timestamp = lines[i].timestamp;
    if (!timestamp) continue;
    const ms = Date.parse(timestamp);
    if (Number.isNaN(ms)) continue;
    const delta = Math.abs(ms - targetMs);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearest = i;
    }
  }
  return nearest;
}

/**
 * Newest timestamp of the lines seen so far. Batches interleave pods, so the
 * last line is not always the newest one. Comparison is numeric because
 * RFC3339 fractional seconds are variable length, which makes ".5Z" sort above
 * ".55Z" as a string, and the original string is returned untouched so no
 * precision is lost on the way back to the server.
 */
export function latestLogTimestamp(
  current: string | null,
  lines: readonly Pick<TLogLine, "timestamp">[],
): string | null {
  let latest = current;
  let latestMs = current ? Date.parse(current) : Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    if (!line.timestamp) continue;
    const ms = Date.parse(line.timestamp);
    if (Number.isNaN(ms) || ms <= latestMs) continue;
    latest = line.timestamp;
    latestMs = ms;
  }
  return latest;
}
