"use client";

import ChartWrapper from "@/components/charts/chart-wrapper";
import MetricsChart from "@/components/charts/metrics-chart";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";

type Props = {
  projectId: string;
  environmentId: string;
};

const timestamps = Array.from({ length: 30 }).map(
  (_, i) => Date.now() - i * 1000 * 60 * 60 * 24
);

type TChartRow = Record<string, number> & { timestamp: number };

export default function Charts() {
  const { projectId, environmentId, serviceId } = useIdsFromPathname();
  const { data } = api.main.getServices.useQuery(
    {
      projectId: projectId!,
      environmentId: environmentId!,
    },
    {
      enabled:
        projectId !== undefined &&
        environmentId !== undefined &&
        serviceId !== undefined,
    }
  );

  const service = data?.services.find((s) => s.id === serviceId);

  const cpuChartData: TChartRow[] | undefined = service
    ? timestamps.map((t) => {
        let obj: TChartRow = {
          timestamp: t,
        };
        obj[service.title] = Math.random();
        obj.timestamp = t;
        return obj;
      })
    : undefined;

  const ramChartData: TChartRow[] | undefined = service
    ? timestamps.map((t) => {
        let obj: TChartRow = {
          timestamp: t,
        };
        obj[service.title] = Math.random() * 10 + 20;
        obj.timestamp = t;
        return obj;
      })
    : undefined;

  const diskChartData: TChartRow[] | undefined = service
    ? timestamps.map((t, tI) => {
        let obj: TChartRow = {
          timestamp: t,
        };
        obj[service.title] = 50 + tI;
        obj.timestamp = t;
        return obj;
      })
    : undefined;

  const networkChartData: TChartRow[] | undefined = service
    ? timestamps.map((t) => {
        let obj: TChartRow = {
          timestamp: t,
        };
        obj[service.title] = Math.random() * 100;
        obj.timestamp = t;
        return obj;
      })
    : undefined;

  return (
    <>
      <ChartWrapper
        title="CPU"
        description="CPU usage over time"
        className="w-full"
      >
        {cpuChartData && (
          <MetricsChart
            chartData={cpuChartData}
            yFormatter={(v) => `${v} CPU`}
          />
        )}
      </ChartWrapper>
      <ChartWrapper
        title="RAM"
        description="RAM usage over time"
        className="w-full"
      >
        {ramChartData && (
          <MetricsChart
            chartData={ramChartData}
            yFormatter={(v) => `${v} MB`}
          />
        )}
      </ChartWrapper>
      <ChartWrapper
        title="Disk"
        description="Disk usage over time"
        className="w-full"
      >
        {diskChartData && (
          <MetricsChart
            chartData={diskChartData}
            yFormatter={(v) => `${v} MB`}
          />
        )}
      </ChartWrapper>
      <ChartWrapper
        title="Network"
        description="Network usage over time"
        className="w-full"
      >
        {networkChartData && (
          <MetricsChart
            chartData={networkChartData}
            yFormatter={(v) => `${v} KB`}
          />
        )}
      </ChartWrapper>
    </>
  );
}
