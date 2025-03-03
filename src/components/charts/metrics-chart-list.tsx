import ChartWrapper from "@/components/charts/chart-wrapper";
import { bytesToHumanReadable, cpuToHumanReadable } from "@/components/charts/formatters";
import MetricsChart from "@/components/charts/metrics-chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";

export type TChartRow = Record<string, number> & { timestamp: number };
export type TChartObject = {
  data: TChartRow[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: string | undefined;
};

type Props = {
  cpu: TChartObject;
  ram: TChartObject;
  disk: TChartObject;
  network: TChartObject;
  className?: string;
  classNameChart?: string;
  noLegends?: boolean;
};

export default function MetricsChartList({
  cpu,
  ram,
  disk,
  network,
  className,
  classNameChart,
  noLegends,
}: Props) {
  const defaultErrorMessage = "Something went wrong";
  return (
    <div className={cn("flex w-full flex-wrap items-stretch", className)}>
      <ChartWrapper
        title="CPU"
        description="CPU usage over time"
        className={cn("w-full lg:w-1/2", classNameChart)}
      >
        {cpu.isPending && !cpu.data && <LoadingPlaceholder noLegends={noLegends} />}
        {cpu.isError && !cpu.isPending && !cpu.data && (
          <Error noLegends={noLegends}>{cpu.error || defaultErrorMessage}</Error>
        )}
        {cpu.data && (
          <MetricsChart
            chartData={cpu.data}
            yFormatter={cpuToHumanReadable}
            tooltipValueFormatter={cpuToHumanReadable}
          />
        )}
      </ChartWrapper>
      <ChartWrapper
        title="RAM"
        description="RAM usage over time"
        className={cn("w-full lg:w-1/2", classNameChart)}
      >
        {ram.isPending && !ram.data && <LoadingPlaceholder noLegends={noLegends} />}
        {ram.isError && !ram.isPending && !ram.data && (
          <Error noLegends={noLegends}>{ram.error || defaultErrorMessage}</Error>
        )}
        {ram.data && (
          <MetricsChart
            chartData={ram.data}
            yFormatter={bytesToHumanReadable}
            tooltipValueFormatter={bytesToHumanReadable}
          />
        )}
      </ChartWrapper>
      <ChartWrapper
        title="Disk"
        description="Disk usage over time"
        className={cn("w-full lg:w-1/2", classNameChart)}
      >
        {disk.isPending && !disk.data && <LoadingPlaceholder noLegends={noLegends} />}
        {disk.isError && !disk.isPending && !disk.data && (
          <Error noLegends={noLegends}>{disk.error || defaultErrorMessage}</Error>
        )}
        {disk.data && (
          <MetricsChart
            chartData={disk.data}
            yFormatter={bytesToHumanReadable}
            tooltipValueFormatter={bytesToHumanReadable}
          />
        )}
      </ChartWrapper>
      <ChartWrapper
        title="Network"
        description="Network usage over time"
        className={cn("w-full lg:w-1/2", classNameChart)}
      >
        {network.isPending && !network.data && <LoadingPlaceholder noLegends={noLegends} />}
        {network.isError && !network.isPending && !network.data && (
          <Error noLegends={noLegends}>{network.error || defaultErrorMessage}</Error>
        )}
        {network.data && (
          <MetricsChart
            chartData={network.data}
            yFormatter={bytesToHumanReadable}
            tooltipValueFormatter={bytesToHumanReadable}
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
