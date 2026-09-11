"use client";

import { useMetricsState } from "@/components/metrics/metrics-state-provider";
import { metricsViews, type TMetricsView } from "@/components/metrics/shape-metrics";
import TabIndicator from "@/components/navigation/tab-indicator";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

const labels: Record<TMetricsView, string> = {
  individual: "Individual",
  aggregate: "Aggregate",
};

export default function MetricsViewToggle({ className }: { className?: string }) {
  const { view, setView } = useMetricsState();

  return (
    <div role="group" aria-label="Metrics View" className={cn("flex items-stretch", className)}>
      {metricsViews.map((v) => (
        <Button
          key={v}
          type="button"
          variant="ghost"
          aria-pressed={view === v}
          data-active={view === v || undefined}
          onClick={() => setView(v)}
          className="text-muted-foreground group/button data-active:text-foreground relative rounded px-3 py-3.5 text-sm leading-none font-medium focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent has-hover:hover:bg-transparent"
        >
          {view === v && <TabIndicator layoutId="metrics-view-toggle" />}
          <div className="pointer-events-none absolute top-0 left-0 h-full w-full py-1.5">
            <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border group-focus-visible/button:ring-primary/8-10 h-full w-full rounded-lg group-focus-visible/button:ring-1" />
          </div>
          <p className="relative truncate py-0.5 leading-none">{labels[v]}</p>
        </Button>
      ))}
    </div>
  );
}
