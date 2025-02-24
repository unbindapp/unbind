"use client";

import ChartWrapper from "@/components/charts/chart-wrapper";
import MetricsChart from "@/components/charts/metrics-chart";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";

const now = Date.now();

const length = 30;
const timestamps = Array.from({ length }).map((_, i) => ({
  timestamp: now - (length - i) * 1000 * 60 * 60 * 24,
  seed: Math.round(Math.random() * 100_000),
}));

function random(seed: number) {
  var x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

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
        const obj: TChartRow = {
          timestamp: t.timestamp,
        };
        obj[service.title] = random(t.seed);
        return obj;
      })
    : undefined;

  const ramChartData: TChartRow[] | undefined = service
    ? timestamps.map((t) => {
        const obj: TChartRow = {
          timestamp: t.timestamp,
        };
        obj[service.title] = random(t.seed) * 10 + 20;
        return obj;
      })
    : undefined;

  const diskChartData: TChartRow[] | undefined = service
    ? timestamps.map((t, tI) => {
        const obj: TChartRow = {
          timestamp: t.timestamp,
        };
        obj[service.title] = 50 + tI;
        return obj;
      })
    : undefined;

  const networkChartData: TChartRow[] | undefined = service
    ? timestamps.map((t) => {
        const obj: TChartRow = {
          timestamp: t.timestamp,
        };
        obj[service.title] = random(t.seed) * 100;
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
