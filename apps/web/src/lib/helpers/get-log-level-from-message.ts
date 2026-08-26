import { stripAnsi } from "@/lib/helpers/parse-ansi";
import type { TLogLineWithLevel } from "@/lib/queries/logs";

export function getLogLevelFromMessage(message: string): TLogLineWithLevel["level"] {
  const plainMessage = stripAnsi(message);
  if (/(\s|^|[^a-zA-Z0-9])(error|fatal|fail|failed)(\s|$|[^a-zA-Z0-9])/i.test(plainMessage)) {
    return "error";
  }
  if (/(\s|^|[^a-zA-Z0-9])(warn|warning)(\s|$|[^a-zA-Z0-9])/i.test(plainMessage)) {
    return "warn";
  }
  return "info";
}
