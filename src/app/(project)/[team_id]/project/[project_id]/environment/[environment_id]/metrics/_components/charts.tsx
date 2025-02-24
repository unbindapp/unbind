"use client";

import ChartWrapper from "@/components/charts/chart-wrapper";
import MetricsChart from "@/components/charts/metrics-chart";
import { api } from "@/server/trpc/setup/client";

type Props = {
  projectId: string;
  environmentId: string;
};

const timestamps = Array.from({ length: 30 }).map(
  (_, i) => Date.now() - i * 1000 * 60 * 60 * 24
);

type TChartRow = Record<string, number> & { timestamp: number };

export default function Charts({ projectId, environmentId }: Props) {
  const { data } = api.main.getServices.useQuery({ projectId, environmentId });

  const cpuChartData: TChartRow[] | undefined = data
    ? timestamps.map((t) => {
        let obj: TChartRow = {
          timestamp: t,
        };
        data.services.forEach((service, i) => {
          obj[service.title] = Math.random() + i;
        });
        obj.timestamp = t;
        return obj;
      })
    : undefined;

  const ramChartData: TChartRow[] | undefined = data
    ? timestamps.map((t) => {
        let obj: TChartRow = {
          timestamp: t,
        };
        data.services.forEach((service, i) => {
          obj[service.title] = i * 50 + Math.random() * 10 + 20;
        });
        obj.timestamp = t;
        return obj;
      })
    : undefined;

  const diskChartData: TChartRow[] | undefined = data
    ? timestamps.map((t, tI) => {
        let obj: TChartRow = {
          timestamp: t,
        };
        data.services.forEach((service, i) => {
          obj[service.title] = 50 + tI + i * 20;
        });
        obj.timestamp = t;
        return obj;
      })
    : undefined;

  const networkChartData: TChartRow[] | undefined = data
    ? timestamps.map((t) => {
        let obj: TChartRow = {
          timestamp: t,
        };
        data.services.forEach((service, i) => {
          obj[service.title] = Math.random() * 100;
        });
        obj.timestamp = t;
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
