import {
  metricsIntervalEnumDefault,
  metricsIntervalSearchParamKey,
} from "@/components/metrics/metrics-state-provider";
import { MetricsIntervalEnum } from "@/server/trpc/api/metrics/types";
import { createSearchParamsCache, parseAsStringEnum } from "nuqs/server";

export const metricsSearchParams = createSearchParamsCache({
  [metricsIntervalSearchParamKey]: parseAsStringEnum(MetricsIntervalEnum.options).withDefault(
    metricsIntervalEnumDefault,
  ),
});
