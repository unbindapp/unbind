"use client";

import { useMetrics } from "@/components/metrics/metrics-provider";

/* type TProps = {
  className?: string;
}; */

export default function Charts() {
  const { data } = useMetrics();
  console.log("Service panel metrics:", data);
  const metrics = data?.data.metrics;

  if (metrics && metrics.length === 0) {
    <div className="w-full p-1">
      <div className="text-muted-foreground flex min-h-36 w-full items-center justify-center rounded-xl border px-4 py-2.5 text-center">
        <p className="w-full leading-tight">There are no metrics yet</p>
      </div>
    </div>;
  }

  return null;

  /* return (
    <MetricsChartList
      cpu={cpu}
      ram={ram}
      disk={disk}
      network={network}
      className={cn("-mx-1 -my-1 w-[calc(100%+0.5rem)]", className)}
      noLegends
    />
  ); */
}
