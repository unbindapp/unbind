import ChartWrapper from "@/components/metrics/chart-wrapper";
import { bytesToHumanReadable, cpuToHumanReadable } from "@/components/metrics/formatters";
import MetricsChart, { TChartDataItem } from "@/components/metrics/metrics-chart";
import { useMetrics } from "@/components/metrics/metrics-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { useMemo } from "react";

type TProps = {
  className?: string;
  classNameChart?: string;
  noLegends?: boolean;
  tooltipNameFormatter: ((name: string) => string) | undefined;
  tooltipNameFormatterIsPending: boolean;
  tooltipNameFormatterError: string | undefined;
};

type TMetrics = {
  cpu: TChartDataItem[];
  ram: TChartDataItem[];
  disk: TChartDataItem[];
  network: TChartDataItem[];
};

export default function MetricsChartList({
  className,
  classNameChart,
  noLegends,
  tooltipNameFormatter,
  tooltipNameFormatterError,
  tooltipNameFormatterIsPending,
}: TProps) {
  const { data, isPending: isPendingMetrics, error: errorMetrics } = useMetrics();
  const defaultErrorMessage = "Something went wrong";

  const isPending = tooltipNameFormatterIsPending || isPendingMetrics;
  const error = tooltipNameFormatterError || errorMetrics?.message;

  const modifiedData: TMetrics | undefined = useMemo(() => {
    if (!data) return undefined;

    const shapedData: TMetrics = {
      cpu: [],
      ram: [],
      disk: [],
      network: [],
    };

    for (const metric of data.metrics.cpu) {
      shapedData.cpu.push({
        timestamp: metric.timestamp,
        ...metric.breakdown,
      });
    }
    for (const metric of data.metrics.ram) {
      shapedData.ram.push({
        timestamp: metric.timestamp,
        ...metric.breakdown,
      });
    }
    for (const metric of data.metrics.disk) {
      shapedData.disk.push({
        timestamp: metric.timestamp,
        ...metric.breakdown,
      });
    }
    for (const metric of data.metrics.network) {
      shapedData.network.push({
        timestamp: metric.timestamp,
        ...metric.breakdown,
      });
    }
    return shapedData;
  }, [data]);

  return (
    <div className={cn("flex w-full flex-wrap items-stretch", className)}>
      <ChartWrapper
        title="CPU"
        description="CPU usage over time"
        className={cn("w-full lg:w-1/2", classNameChart)}
      >
        {isPending && !modifiedData && <LoadingPlaceholder noLegends={noLegends} />}
        {error && !isPending && !modifiedData && (
          <Error noLegends={noLegends}>{error || defaultErrorMessage}</Error>
        )}
        {modifiedData && (
          <MetricsChart
            chartData={modifiedData.cpu}
            yFormatter={cpuToHumanReadable}
            tooltipValueFormatter={cpuToHumanReadable}
            tooltipNameFormatter={tooltipNameFormatter}
            noLegends={noLegends}
          />
        )}
      </ChartWrapper>
      <ChartWrapper
        title="RAM"
        description="RAM usage over time"
        className={cn("w-full lg:w-1/2", classNameChart)}
      >
        {isPending && !modifiedData && <LoadingPlaceholder noLegends={noLegends} />}
        {error && !isPending && !modifiedData && (
          <Error noLegends={noLegends}>{error || defaultErrorMessage}</Error>
        )}
        {modifiedData && (
          <MetricsChart
            chartData={modifiedData.ram}
            yFormatter={bytesToHumanReadable}
            tooltipValueFormatter={bytesToHumanReadable}
            tooltipNameFormatter={tooltipNameFormatter}
            noLegends={noLegends}
          />
        )}
      </ChartWrapper>
      <ChartWrapper
        title="Network"
        description="Network usage over time"
        className={cn("w-full lg:w-1/2", classNameChart)}
      >
        {isPending && !modifiedData && <LoadingPlaceholder noLegends={noLegends} />}
        {error && !isPending && !modifiedData && (
          <Error noLegends={noLegends}>{error || defaultErrorMessage}</Error>
        )}
        {modifiedData && (
          <MetricsChart
            chartData={modifiedData.network}
            yFormatter={bytesToHumanReadable}
            tooltipValueFormatter={bytesToHumanReadable}
            tooltipNameFormatter={tooltipNameFormatter}
            noLegends={noLegends}
          />
        )}
      </ChartWrapper>
      <ChartWrapper
        title="Disk"
        description="Disk usage over time"
        className={cn("w-full lg:w-1/2", classNameChart)}
      >
        {isPending && !modifiedData && <LoadingPlaceholder noLegends={noLegends} />}
        {error && !isPending && !modifiedData && (
          <Error noLegends={noLegends}>{error || defaultErrorMessage}</Error>
        )}
        {modifiedData && (
          <MetricsChart
            chartData={modifiedData.disk}
            yFormatter={bytesToHumanReadable}
            tooltipValueFormatter={bytesToHumanReadable}
            tooltipNameFormatter={tooltipNameFormatter}
            noLegends={noLegends}
          />
        )}
      </ChartWrapper>
    </div>
  );
}

function LoadingPlaceholder({ noLegends }: { noLegends?: boolean }) {
  return (
    <div className="flex w-full flex-col">
      <div className="bg-border animate-skeleton h-56 w-full rounded-lg" />
      {!noLegends && (
        <div className="bg-border animate-skeleton pointer-events-none mt-1.5 flex w-full flex-wrap rounded-lg">
          <div className="text-muted-foreground max-w-full gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs font-medium">
            <p className="max-w-28 min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap text-transparent select-none">
              Loading
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Error({ noLegends, children }: { noLegends?: boolean; children: string }) {
  return (
    <div className="flex w-full flex-col">
      <div className="bg-destructive/8 border-destructive/16 text-destructive flex h-56 w-full flex-col overflow-hidden rounded-lg border text-sm">
        <ScrollArea className="h-full">
          <div className="flex w-full flex-col overflow-hidden px-4 py-2.5">
            <p className="w-full">{children}</p>
          </div>
        </ScrollArea>
      </div>
      {!noLegends && (
        <div className="pointer-events-none mt-1.5 flex w-full flex-wrap opacity-0">
          <div className="text-muted-foreground max-w-full gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs font-medium">
            <p className="max-w-28 min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap text-transparent select-none">
              Error
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
