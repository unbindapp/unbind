import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { MonitorIcon } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import { MetricsIntervalEnum, serverMetricsQuery } from "@/lib/queries/metrics";
import { serversListQuery } from "@/lib/queries/servers";
import { metricsSearchParamKeys, MetricsViewEnum } from "@/components/metrics/constants";
import MetricsChartList from "@/components/metrics/metrics-chart-list";
import MetricsFilterDropdown, {
  type TMetricsSelectionItem,
} from "@/components/metrics/metrics-filter-dropdown";
import { ServerMetricsProvider } from "@/components/metrics/metrics-provider";
import MetricsStateProvider, {
  metricsIntervalEnumDefault,
} from "@/components/metrics/metrics-state-provider";
import PageWrapper from "@/components/page-wrapper";

const keys = metricsSearchParamKeys.system;

const searchSchema = z.object({
  [keys.interval]: MetricsIntervalEnum.optional(),
  [keys.view]: MetricsViewEnum.optional(),
  [keys.selection]: z.string().optional(),
});

// The breakdown is keyed by the server's name, so the tooltip needs no lookup
const tooltipNameFormatter = (name: string) => name;

export const Route = createFileRoute("/system/metrics/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({
    interval: search.metrics_interval ?? metricsIntervalEnumDefault,
  }),
  loader: ({ context: { queryClient }, deps }) => {
    // Non-blocking; the providers below render immediately and show skeletons.
    // The servers list is already warmed by the parent /system route.
    void queryClient.prefetchQuery(serverMetricsQuery({ interval: deps.interval }));
  },
  component: SystemMetricsPage,
});

function SystemMetricsPage() {
  return (
    <PageWrapper>
      <MetricsStateProvider type="system">
        <ServerMetricsProvider>
          <div className="flex w-full max-w-7xl flex-col">
            <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
              <h1 className="min-w-0 px-2 text-2xl leading-tight font-semibold">Metrics</h1>
              <ServersFilterDropdown className="-my-2" />
            </div>
            <div className="flex w-full flex-row flex-wrap pt-3">
              <MetricsChartList
                tooltipNameFormatter={tooltipNameFormatter}
                tooltipNameFormatterError={undefined}
                tooltipNameFormatterIsPending={false}
              />
            </div>
          </div>
        </ServerMetricsProvider>
      </MetricsStateProvider>
    </PageWrapper>
  );
}

function ServersFilterDropdown({ className }: { className?: string }) {
  const { data: serversData } = useQuery(serversListQuery());

  const items: TMetricsSelectionItem[] | undefined = useMemo(
    () =>
      serversData?.data.map((server) => ({
        id: server.name,
        name: server.name,
        icon: <MonitorIcon className="size-4.5 shrink-0" />,
      })),
    [serversData],
  );

  return <MetricsFilterDropdown selection={{ label: "Servers", items }} className={className} />;
}
