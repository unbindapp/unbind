"use client";

import MetricsChartList, { TChartObject, TChartRow } from "@/components/metrics/metrics-chart-list";
import { useService } from "@/components/service/service-provider";
import { cn } from "@/components/ui/utils";
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

type TProps = {
  className?: string;
};

export default function Charts({ className }: TProps) {
  const {
    query: { data, isPending, isError, error },
  } = useService();

  const service = data?.service;

  const cpu: TChartObject = useMemo(() => {
    return {
      data: service
        ? timestamps.map((t) => {
            const obj: TChartRow = {
              timestamp: t.timestamp,
            };
            obj[service.display_name] = random(t.seed);
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
            obj[service.display_name] = 1024 * 1024 * Math.round(random(t.seed) * 10 + 50);
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
            obj[service.display_name] = (50 + tI) * (1024 * 1024);
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
            obj[service.display_name] = random(t.seed) * 100 * 1024;
            return obj;
          })
        : undefined,
      isPending,
      isError,
      error: error?.message,
    };
  }, [service, isPending, isError, error]);

  return (
    <MetricsChartList
      cpu={cpu}
      ram={ram}
      disk={disk}
      network={network}
      className={cn("-mx-1 -my-1 w-[calc(100%+0.5rem)]", className)}
      noLegends
    />
  );
}
