"use client";

import MetricsChartList, {
  TChartObject,
  TChartRow,
} from "@/components/charts/metrics-chart-list";
import { api } from "@/server/trpc/setup/client";
import { useMemo } from "react";

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
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export default function Charts({ projectId, environmentId }: Props) {
  const { data, isPending, isError, error } = api.main.getServices.useQuery({
    projectId,
    environmentId,
  });

  const cpu: TChartObject = useMemo(() => {
    return {
      data: data
        ? timestamps.map((t) => {
            const obj: TChartRow = {
              timestamp: t.timestamp,
            };
            data.services.forEach((service, i) => {
              obj[service.title] = random(t.seed + i) + i;
            });
            return obj;
          })
        : undefined,
      isPending,
      isError,
      error: error?.message,
    };
  }, [data, isPending, isError, error]);

  const ram: TChartObject = useMemo(() => {
    return {
      data: data
        ? timestamps.map((t) => {
            const obj: TChartRow = {
              timestamp: t.timestamp,
            };
            data.services.forEach((service, i) => {
              obj[service.title] =
                1024 * 1024 * Math.round(i * 50 + random(t.seed + i) * 10 + 20);
            });
            return obj;
          })
        : undefined,
      isPending,
      isError,
      error: error?.message,
    };
  }, [data, isPending, isError, error]);

  const disk: TChartObject = useMemo(() => {
    return {
      data: data
        ? timestamps.map((t, tI) => {
            const obj: TChartRow = {
              timestamp: t.timestamp,
            };
            data.services.forEach((service, i) => {
              obj[service.title] = (50 + tI + i * 20) * (1024 * 1024);
            });
            return obj;
          })
        : undefined,
      isPending,
      isError,
      error: error?.message,
    };
  }, [data, isPending, isError, error]);

  const network: TChartObject = useMemo(() => {
    return {
      data: data
        ? timestamps.map((t) => {
            const obj: TChartRow = {
              timestamp: t.timestamp,
            };
            data.services.forEach((service, i) => {
              obj[service.title] = random(t.seed + i) * 100 * 1024;
            });
            return obj;
          })
        : undefined,
      isPending,
      isError,
      error: error?.message,
    };
  }, [data, isPending, isError, error]);

  if (data && data.services.length === 0) {
    return (
      <div className="w-full p-1">
        <div className="w-full flex items-center text-muted-foreground justify-center border rounded-xl text-center px-4 py-2.5 min-h-36">
          <p className="w-full leading-tight">There are no metrics yet</p>
        </div>
      </div>
    );
  }

  return <MetricsChartList cpu={cpu} ram={ram} disk={disk} network={network} />;
}
