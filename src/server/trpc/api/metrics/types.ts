import { z } from "zod";

export const MetricsIntervalEnum = z.enum(["1h", "6h", "24h", "7d", "30d"]);
export type TMetricsIntervalEnum = z.infer<typeof MetricsIntervalEnum>;
