import { containsAnsi, parseAnsi } from "@/lib/helpers/parse-ansi";
import type { CSSProperties } from "react";

export type TLogMessageFormat = "ansi" | "plain";

export type TLogMessageSegment = {
  text: string;
  style: CSSProperties | null;
};

export type TFormattedLogMessage = {
  format: TLogMessageFormat;
  segments: TLogMessageSegment[];
};

export function formatLogMessage(message: string): TFormattedLogMessage {
  if (containsAnsi(message)) {
    return { format: "ansi", segments: parseAnsi(message) };
  }
  return { format: "plain", segments: [{ text: message, style: null }] };
}
