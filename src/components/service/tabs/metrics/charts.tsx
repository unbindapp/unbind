"use client";

import MetricsChartList from "@/components/metrics/metrics-chart-list";
import { useMetrics } from "@/components/metrics/metrics-provider";
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
      className={cn("-mx-1 -my-1 w-[calc(100%+0.5rem)]", className)}
      tooltipNameFormatter={tooltipNameFormatter}
      tooltipNameFormatterError={!tooltipNameFormatter ? serviceError?.message : undefined}
      tooltipNameFormatterIsPending={!tooltipNameFormatter ? serviceIsPending : false}
      noLegends={noLegends}
    />
  );
}
