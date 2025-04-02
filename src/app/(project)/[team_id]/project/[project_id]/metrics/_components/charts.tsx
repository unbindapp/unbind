"use client";

import MetricsChartList from "@/components/metrics/metrics-chart-list";
import { useMetrics } from "@/components/metrics/metrics-provider";

export default function Charts() {
  const { data } = useMetrics();

  if (data && data.metrics.cpu.length === 0) {
    return (
      <div className="w-full p-1">
        <div className="text-muted-foreground flex min-h-36 w-full items-center justify-center rounded-xl border px-4 py-2.5 text-center">
          <p className="w-full leading-tight">There are no metrics yet</p>
        </div>
      </div>
    );
  }

  return <MetricsChartList />;
}
