import type { TLogLine } from "@/lib/queries/logs";

export function logLineKey(line: Pick<TLogLine, "timestamp" | "pod_name" | "message">): string {
  return `${line.timestamp ?? ""}#${line.pod_name}#${line.message}`;
}
