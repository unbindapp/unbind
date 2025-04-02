import { query_logsQuerySchema } from "@/server/go/client.gen";
import { z } from "zod";

export type TLogType = z.infer<typeof query_logsQuerySchema.shape.type>;
