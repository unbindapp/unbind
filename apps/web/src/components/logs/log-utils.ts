import type { TLogLine } from "@/lib/queries/logs";

export function logLineKey(line: Pick<TLogLine, "timestamp" | "pod_name" | "message">): string {
  return `${line.timestamp ?? ""}#${line.pod_name}#${line.message}`;
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
