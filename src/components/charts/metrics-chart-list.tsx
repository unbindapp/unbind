import ChartWrapper from "@/components/charts/chart-wrapper";
import {
  bytesToHumanReadable,
  cpuToHumanReadable,
} from "@/components/charts/formatters";
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
    <div className={cn("w-full flex flex-wrap items-stretch", className)}>
      <ChartWrapper
        title="CPU"
        description="CPU usage over time"
        className={cn("w-full lg:w-1/2", classNameChart)}
      >
        {cpu.isPending && !cpu.data && (
          <LoadingPlaceholder noLegends={noLegends} />
        )}
        {cpu.isError && !cpu.isPending && !cpu.data && (
          <Error noLegends={noLegends}>
            {cpu.error || defaultErrorMessage}
          </Error>
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
        {ram.isPending && !ram.data && (
          <LoadingPlaceholder noLegends={noLegends} />
        )}
        {ram.isError && !ram.isPending && !ram.data && (
          <Error noLegends={noLegends}>
            {ram.error || defaultErrorMessage}
          </Error>
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
        {disk.isPending && !disk.data && (
          <LoadingPlaceholder noLegends={noLegends} />
        )}
        {disk.isError && !disk.isPending && !disk.data && (
          <Error noLegends={noLegends}>
            {disk.error || defaultErrorMessage}
          </Error>
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
        {network.isPending && !network.data && (
          <LoadingPlaceholder noLegends={noLegends} />
        )}
        {network.isError && !network.isPending && !network.data && (
          <Error noLegends={noLegends}>
            {network.error || defaultErrorMessage}
          </Error>
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
    <div className="w-full flex flex-col">
      <div className="w-full h-56 bg-border rounded-lg animate-skeleton" />
      {!noLegends && (
        <div className="w-full bg-border rounded-lg animate-skeleton flex flex-wrap mt-1.5 pointer-events-none">
          <div className="max-w-full text-muted-foreground text-xs px-2.5 py-1.5 rounded-md font-medium gap-1.5 text-left">
            <p className="shrink select-none text-transparent min-w-0 leading-tight max-w-28 whitespace-nowrap overflow-hidden overflow-ellipsis">
              Loading
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Error({
  noLegends,
  children,
}: {
  noLegends?: boolean;
  children: string;
}) {
  return (
    <div className="w-full flex flex-col">
      <div
        className="w-full h-56 flex flex-col text-sm bg-destructive/8 border border-destructive/16 
        text-destructive rounded-lg overflow-hidden"
      >
        <ScrollArea className="h-full">
          <div className="w-full flex flex-col px-4 py-2.5 overflow-hidden">
            <p className="w-full">{children}</p>
          </div>
        </ScrollArea>
      </div>
      {!noLegends && (
        <div className="w-full pointer-events-none opacity-0 flex flex-wrap mt-1.5">
          <div className="max-w-full text-muted-foreground text-xs px-2.5 py-1.5 rounded-md font-medium gap-1.5 text-left">
            <p className="shrink select-none text-transparent min-w-0 leading-tight max-w-28 whitespace-nowrap overflow-hidden overflow-ellipsis">
              Error
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
