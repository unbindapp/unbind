"use client";

import MetricsChartList from "@/components/metrics/metrics-chart-list";
import { useMetrics } from "@/components/metrics/metrics-provider";
import NoItemsCard from "@/components/no-items-card";
import { useService } from "@/components/service/service-provider";
import { cn } from "@/components/ui/utils";
import { ChartColumnIcon } from "lucide-react";
import { useMemo } from "react";

export default function Charts({
  className,
  noLegends,
}: {
  className?: string;
  noLegends?: boolean;
}) {
  const { data } = useMetrics();
  const {
    query: { data: serviceData, error: serviceError, isPending: serviceIsPending },
  } = useService();

  const tooltipNameFormatter: ((name: string) => string) | undefined = useMemo(() => {
    if (!serviceData) return undefined;
    return (name: string) =>
      serviceData.service.id === name ? serviceData.service.display_name : name;
  }, [serviceData]);

  if (data && data.metrics.cpu.length === 0) {
    return <NoItemsCard Icon={ChartColumnIcon}>No metrics yet</NoItemsCard>;
  }

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
