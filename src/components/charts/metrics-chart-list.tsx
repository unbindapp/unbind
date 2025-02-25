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
  chartClassName?: string;
};

export default function MetricsChartList({
  cpu,
  ram,
  disk,
  network,
  chartClassName,
}: Props) {
  const defaultErrorMessage = "Something went wrong";
  return (
    <>
      <ChartWrapper
        title="CPU"
        description="CPU usage over time"
        className={cn("w-full lg:w-1/2", chartClassName)}
      >
        {cpu.isPending && !cpu.data && <LoadingPlaceholder />}
        {cpu.isError && !cpu.isPending && !cpu.data && (
          <Error>{cpu.error || defaultErrorMessage}</Error>
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
        className={cn("w-full lg:w-1/2", chartClassName)}
      >
        {ram.isPending && !ram.data && <LoadingPlaceholder />}
        {ram.isError && !ram.isPending && !ram.data && (
          <Error>{ram.error || defaultErrorMessage}</Error>
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
        className={cn("w-full lg:w-1/2", chartClassName)}
      >
        {disk.isPending && !disk.data && <LoadingPlaceholder />}
        {disk.isError && !disk.isPending && !disk.data && (
          <Error>{disk.error || defaultErrorMessage}</Error>
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
        className={cn("w-full lg:w-1/2", chartClassName)}
      >
        {network.isPending && !network.data && <LoadingPlaceholder />}
        {network.isError && !network.isPending && !network.data && (
          <Error>{network.error || defaultErrorMessage}</Error>
        )}
        {network.data && (
          <MetricsChart
            chartData={network.data}
            yFormatter={bytesToHumanReadable}
            tooltipValueFormatter={bytesToHumanReadable}
          />
        )}
      </ChartWrapper>
    </>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="w-full h-full bg-border rounded-lg animate-skeleton" />
  );
}

function Error({ children }: { children: string }) {
  return (
    <div
      className="w-full h-full flex flex-col text-sm bg-destructive/8 border border-destructive/16 
      text-destructive rounded-lg overflow-hidden"
    >
      <ScrollArea className="h-full">
        <div className="w-full flex flex-col px-4 py-2.5 overflow-hidden">
          <p className="w-full">{children}</p>
        </div>
      </ScrollArea>
    </div>
  );
}
