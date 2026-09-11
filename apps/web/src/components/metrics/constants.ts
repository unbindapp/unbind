import { metricsViews, type TMetricsView } from "@/components/metrics/shape-metrics";
import { z } from "zod";

export const MetricsViewEnum = z.enum(metricsViews);
export const metricsViewDefault: TMetricsView = "individual";

export type TMetricsScope = "team" | "environment" | "service";

export type TMetricsSearchParamKeys = { interval: string; view?: string; selection?: string };

// Pages own the bare metrics_ keys. The service panel opens on top of a page,
// so it prefixes its own to never clobber the page's, same as the log viewers.
export const metricsSearchParamKeys = {
  team: { interval: "metrics_interval", view: "metrics_view", selection: "metrics_projects" },
  environment: {
    interval: "metrics_interval",
    view: "metrics_view",
    selection: "metrics_services",
  },
  service: { interval: "service_metrics_interval" },
} as const satisfies Record<TMetricsScope, TMetricsSearchParamKeys>;
