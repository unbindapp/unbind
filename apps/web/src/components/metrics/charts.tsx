"use client";

import { deletedBreakdownName } from "@/components/metrics/breakdown-name";
import MetricsChartList from "@/components/metrics/metrics-chart-list";
import { useServices } from "@/components/service/services-provider";
import { useMemo } from "react";

export default function Charts() {
  const {
    query: { data: servicesData, error: servicesError, isPending: servicesIsPending },
  } = useServices();

  const tooltipNameFormatter: ((name: string) => string) | undefined = useMemo(() => {
    if (!servicesData) return undefined;
    return (name: string) =>
      servicesData.services.find((service) => service.id === name)?.name ||
      deletedBreakdownName(name);
  }, [servicesData]);

  return (
    <MetricsChartList
      tooltipNameFormatter={tooltipNameFormatter}
      tooltipNameFormatterError={!tooltipNameFormatter ? servicesError?.message : undefined}
      tooltipNameFormatterIsPending={!tooltipNameFormatter ? servicesIsPending : false}
    />
  );
}
