export type TStructuredLog = {
  message: string;
  attributes: [string, string][];
};

const messageKeys = ["message", "msg", "log"];
const hiddenKeys = new Set(["level", "severity", "lvl", "log.level", ...messageKeys]);

export function parseStructuredLog(raw: string): TStructuredLog | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const messageKey = messageKeys.find((key) => typeof record[key] === "string");

  const attributes: [string, string][] = [];
  for (const [key, value] of Object.entries(record)) {
    if (hiddenKeys.has(key)) continue;
    attributes.push([key, typeof value === "string" ? value : JSON.stringify(value)]);
  }

  if (!messageKey && attributes.length === 0) return null;
  return {
    message: messageKey ? (record[messageKey] as string) : "",
    attributes,
  };
}
