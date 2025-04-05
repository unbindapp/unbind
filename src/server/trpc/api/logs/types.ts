import { LogEventSchema, query_logsQuerySchema } from "@/server/go/client.gen";
import { z } from "zod";

export type TLogType = z.infer<typeof query_logsQuerySchema.shape.type>;

export type TLogLine = z.infer<typeof LogEventSchema>;
export type TLogLineWithLevel = TLogLine & {
  level: "info" | "warn" | "error";
};
