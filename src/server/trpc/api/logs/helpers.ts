import { TLogLineWithLevel } from "@/server/trpc/api/logs/types";

export function getLogLevelFromMessage(message: string): TLogLineWithLevel["level"] {
  if (/(\s|^)(error|fatal|fail|failed)(\s|$)/i.test(message)) {
    return "error";
  }
  if (/(\s|^)(warn|warning)(\s|$)/i.test(message)) {
    return "warn";
  }
  return "info";
}
