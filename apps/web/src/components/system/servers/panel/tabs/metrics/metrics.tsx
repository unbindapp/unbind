"use client";

import MetricsChartList from "@/components/metrics/metrics-chart-list";
import MetricsFilterDropdown from "@/components/metrics/metrics-filter-dropdown";
import { ServerMetricsProvider } from "@/components/metrics/metrics-provider";
import { MetricsStateProvider } from "@/components/metrics/metrics-state-provider";
import TabWrapper from "@/components/navigation/tab-wrapper";
import { TServer } from "@/lib/queries/servers";

type TProps = {
  server: TServer;
};

// The breakdown is keyed by the server's name, so the tooltip needs no lookup
const tooltipNameFormatter = (name: string) => name;

export default function Metrics({ server }: TProps) {
  return (
    <MetricsStateProvider type="server">
      <ServerMetricsProvider serverName={server.name}>
        <TabWrapper>
          <div className="flex w-full items-center">
            <MetricsFilterDropdown />
          </div>
          <div className="flex w-full flex-row flex-wrap pt-1">
            <MetricsChartList
              className="-mx-1 -my-1 w-[calc(100%+0.5rem)]"
              tooltipNameFormatter={tooltipNameFormatter}
              tooltipNameFormatterError={undefined}
              tooltipNameFormatterIsPending={false}
              noLegends
            />
          </div>
        </TabWrapper>
      </ServerMetricsProvider>
    </MetricsStateProvider>
  );
}
