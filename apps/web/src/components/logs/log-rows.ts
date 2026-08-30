import type { TBufferedLogLine } from "@/components/logs/logs-provider";

// The list always opens with an indicator row. Its key stays constant so swapping
// between the two indicator variants never reads as a new leading item.
export const leadingRowKey = "leading";

export type TLogRow =
  | { kind: "leading"; key: string }
  | { kind: "log"; key: string; line: TBufferedLogLine };

export function buildLogRows(logs: TBufferedLogLine[]): TLogRow[] {
  const rows: TLogRow[] = [{ kind: "leading", key: leadingRowKey }];
  for (const line of logs) {
    rows.push({ kind: "log", key: line.key, line });
  }
  return rows;
}
