"use client";

import ChartWrapper from "@/components/charts/chart-wrapper";
import MetricsChart from "@/components/charts/metrics-chart";
import { api } from "@/server/trpc/setup/client";

type Props = {
  projectId: string;
  environmentId: string;
};

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

export default function Charts({ projectId, environmentId }: Props) {
  const { data } = api.main.getServices.useQuery({ projectId, environmentId });

  const cpuChartData: TChartRow[] | undefined = data
    ? timestamps.map((t) => {
        const obj: TChartRow = {
          timestamp: t.timestamp,
        };
        data.services.forEach((service, i) => {
          obj[service.title] = random(t.seed + i) + i;
        });
        return obj;
      })
    : undefined;

  const ramChartData: TChartRow[] | undefined = data
    ? timestamps.map((t) => {
        const obj: TChartRow = {
          timestamp: t.timestamp,
        };
        data.services.forEach((service, i) => {
          obj[service.title] = i * 50 + random(t.seed + i) * 10 + 20;
        });
        return obj;
      })
    : undefined;

  const diskChartData: TChartRow[] | undefined = data
    ? timestamps.map((t, tI) => {
        const obj: TChartRow = {
          timestamp: t.timestamp,
        };
        data.services.forEach((service, i) => {
          obj[service.title] = 50 + tI + i * 20;
        });
        return obj;
      })
    : undefined;

  const networkChartData: TChartRow[] | undefined = data
    ? timestamps.map((t) => {
        const obj: TChartRow = {
          timestamp: t.timestamp,
        };
        data.services.forEach((service, i) => {
          obj[service.title] = random(t.seed + i) * 100;
        });
        return obj;
      })
    : undefined;

  return (
    <>
      <ChartWrapper
        title="CPU"
        description="CPU usage over time"
        className="w-full lg:w-1/2"
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
        className="w-full lg:w-1/2"
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
        className="w-full lg:w-1/2"
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
        className="w-full lg:w-1/2"
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
