"use client";

import MetricsChartList from "@/components/metrics/metrics-chart-list";
import { useService } from "@/components/service/service-provider";
import { cn } from "@/components/ui/utils";
import { useMemo } from "react";

export default function Charts({
  className,
  noLegends,
}: {
  className?: string;
  noLegends?: boolean;
}) {
  const {
    query: { data: serviceData, error: serviceError, isPending: serviceIsPending },
  } = useService();

  const tooltipNameFormatter: ((name: string) => string) | undefined = useMemo(() => {
    if (!serviceData) return undefined;
    return (name: string) => (serviceData.service.id === name ? serviceData.service.name : name);
  }, [serviceData]);

  return (
    <MetricsChartList
      className={cn("-mx-1 -my-1 w-[calc(100%+0.5rem)]", className)}
      tooltipNameFormatter={tooltipNameFormatter}
      tooltipNameFormatterError={!tooltipNameFormatter ? serviceError?.message : undefined}
      tooltipNameFormatterIsPending={!tooltipNameFormatter ? serviceIsPending : false}
      noLegends={noLegends}
    />
  );
}
