"use client";

import MetricsChartList, {
  TChartObject,
  TChartRow,
} from "@/components/charts/metrics-chart-list";
import { cn } from "@/components/ui/utils";
import { TService } from "@/server/trpc/api/main/router";
import { api } from "@/server/trpc/setup/client";
import { useMemo } from "react";

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

type Props = {
  service: TService;
  className?: string;
};

export default function Charts({ service, className }: Props) {
  const { data, isPending, isError, error } = api.main.getServices.useQuery({
    teamId: service.teamId,
    projectId: service.projectId,
    environmentId: service.environmentId,
  });

  const cpu: TChartObject = useMemo(() => {
    return {
      data: service
        ? timestamps.map((t) => {
            const obj: TChartRow = {
              timestamp: t.timestamp,
            };
            obj[service.title] = random(t.seed);
            return obj;
          })
        : undefined,
      isPending,
      isError,
      error: error?.message,
    };
  }, [service, isPending, isError, error]);

  const ram: TChartObject = useMemo(() => {
    return {
      data: service
        ? timestamps.map((t) => {
            const obj: TChartRow = {
              timestamp: t.timestamp,
            };
            obj[service.title] =
              1024 * 1024 * Math.round(random(t.seed) * 10 + 50);
            return obj;
          })
        : undefined,
      isPending,
      isError,
      error: error?.message,
    };
  }, [service, isPending, isError, error]);

  const disk: TChartObject = useMemo(() => {
    return {
      data: service
        ? timestamps.map((t, tI) => {
            const obj: TChartRow = {
              timestamp: t.timestamp,
            };
            obj[service.title] = (50 + tI) * (1024 * 1024);
            return obj;
          })
        : undefined,
      isPending,
      isError,
      error: error?.message,
    };
  }, [service, isPending, isError, error]);

  const network: TChartObject = useMemo(() => {
    return {
      data: service
        ? timestamps.map((t) => {
            const obj: TChartRow = {
              timestamp: t.timestamp,
            };
            obj[service.title] = random(t.seed) * 100 * 1024;
            return obj;
          })
        : undefined,
      isPending,
      isError,
      error: error?.message,
    };
  }, [service, isPending, isError, error]);

  if (data && data.services.length === 0) {
    return (
      <div className={cn("w-full p-0", className)}>
        <div className="w-full flex items-center text-muted-foreground justify-center border rounded-xl text-center px-4 py-2.5 min-h-36">
          <p className="w-full leading-tight">There are no metrics yet</p>
        </div>
      </div>
    );
  }

  return (
    <MetricsChartList
      cpu={cpu}
      ram={ram}
      disk={disk}
      network={network}
      className={className}
      classNameChart="w-full lg:w-full p-0"
      noLegends
    />
  );
}
