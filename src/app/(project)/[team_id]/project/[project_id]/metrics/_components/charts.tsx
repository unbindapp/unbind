"use client";

import MetricsChartList from "@/components/metrics/metrics-chart-list";
import { useMetrics } from "@/components/metrics/metrics-provider";
import { useServices } from "@/components/project/services-provider";
import { useMemo } from "react";

export default function Charts() {
  const { data } = useMetrics();
  const {
    query: { data: servicesData, error: servicesError, isPending: servicesIsPending },
  } = useServices();

  const tooltipNameFormatter: ((name: string) => string) | undefined = useMemo(() => {
    if (!servicesData) return undefined;
    return (name: string) =>
      servicesData.services.find((service) => service.id === name)?.display_name || name;
  }, [servicesData]);

  if (data && data.metrics.cpu.length === 0) {
    return (
      <div className="w-full p-1">
        <div className="text-muted-foreground flex min-h-36 w-full items-center justify-center rounded-xl border px-4 py-2.5 text-center">
          <p className="w-full leading-tight">There are no metrics yet</p>
        </div>
      </div>
    );
  }

  return (
    <MetricsChartList
      tooltipNameFormatter={tooltipNameFormatter}
      tooltipNameFormatterError={!tooltipNameFormatter ? servicesError?.message : undefined}
      tooltipNameFormatterIsPending={!tooltipNameFormatter ? servicesIsPending : false}
    />
  );
}
