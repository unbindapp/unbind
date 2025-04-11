import { TLogLineWithLevel } from "@/server/trpc/api/logs/types";

export function getLogLevelFromMessage(message: string): TLogLineWithLevel["level"] {
  if (/(\s|^|[^a-zA-Z0-9])(error|fatal|fail|failed)(\s|$|[^a-zA-Z0-9])/i.test(message)) {
    return "error";
  }
  if (/(\s|^|[^a-zA-Z0-9])(warn|warning)(\s|$|[^a-zA-Z0-9])/i.test(message)) {
    return "warn";
  }
  return "info";
}
