import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/components/ui/utils";
import { format } from "date-fns";
import { ChartColumnIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

export type TChartDataItem = { timestamp: string } & Record<string, string | number | null>;

type TProps = {
  yFormatter: ((value: number, index: number) => string) | undefined;
  tooltipValueFormatter: (value: number) => string;
  tooltipNameFormatter?: (value: string) => string;
  chartData: TChartDataItem[];
  className?: string;
  classNameChart?: string;
  noLegends?: boolean;
};

const margin = { left: 4, right: 12, top: 4, bottom: 4 };

const colorCount = 10;

export default function MetricsChart({
  yFormatter,
  tooltipValueFormatter,
  tooltipNameFormatter,
  chartData,
  className,
  classNameChart,
  noLegends,
}: TProps) {
  const [dataKeys, allDataKeysAreNull] = useMemo(() => {
    const keys = new Set<string>();
    let allIsNull = true;
    chartData.forEach((row) => {
      Object.keys(row)
        .filter((k) => k !== "timestamp")
        .forEach((k) => {
          if (row[k] !== null) {
            allIsNull = false;
          }
          keys.add(k);
        });
    });
    return [[...keys], allIsNull];
  }, [chartData]);

  const [activeDataKey, setActiveDataKey] = useState<string | null>(null);
  const filteredDataKeys = useMemo(
    () => dataKeys.filter((key) => (activeDataKey ? key === activeDataKey : true)),
    [dataKeys, activeDataKey],
  );

  const toggleDataKey = useCallback((key: string) => {
    setActiveDataKey((prev) => (prev === key ? null : key));
  }, []);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    dataKeys.forEach((key, index) => {
      config[key] = {
        label: key,
        color: `var(--chart-${(index % colorCount) + 1})`,
      };
    });
    return config satisfies ChartConfig;
  }, [dataKeys]);

  const timestampTickFormatter: (value: string, index: number) => string = useCallback(
    (value: string) => {
      const firstTimestamp = chartData[0].timestamp;
      const lastTimestamp = chartData[chartData.length - 1].timestamp;
      const differenceInHours =
        Math.abs(new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime()) /
        (1000 * 60 * 60);
      if (differenceInHours <= 24) {
        return format(new Date(value), "HH:mm");
      }
      return format(value, "MMM dd");
    },
    [chartData],
  );

  return (
    <div className={cn("flex w-full flex-col", className)}>
      {allDataKeysAreNull ? (
        <div className="relative z-[1] flex h-56 w-full flex-col overflow-auto">
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center px-2 pt-2 pb-8">
            <ChartColumnIcon className="size-6" />
            <p className="mt-2 w-full text-center text-sm leading-tight">No metrics yet</p>
          </div>
        </div>
      ) : (
        <ChartContainer
          className={cn("relative z-[1] h-56 w-full", classNameChart)}
          config={chartConfig}
        >
          <AreaChart accessibilityLayer data={chartData} margin={margin}>
            <CartesianGrid vertical={false} stroke="transparent" />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={timestampTickFormatter}
            />
            <YAxis tickMargin={8} tickLine={false} axisLine={false} tickFormatter={yFormatter} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator={activeDataKey ? "dot-circular" : "dot"}
                  labelFormatter={(_, p) => {
                    return format(p[0].payload.timestamp, "MMM dd, HH:mm");
                  }}
                  nameFormatter={tooltipNameFormatter}
                  // @ts-expect-error - This is fine, it'll always be a number
                  valueFormatter={tooltipValueFormatter}
                />
              }
            />
            {filteredDataKeys.map((dataKey) => {
              return (
                <Area
                  animationDuration={500}
                  key={dataKey}
                  dataKey={dataKey}
                  type="monotone"
                  stroke={chartConfig[dataKey].color}
                  strokeWidth={1.5}
                  stackId={dataKey}
                  fill="transparent"
                />
              );
            })}
          </AreaChart>
        </ChartContainer>
      )}
      {!noLegends && dataKeys.length >= 1 && (
        <ol
          data-no-data-keys={allDataKeysAreNull ? true : undefined}
          data-has-active={activeDataKey ? true : undefined}
          className="group/list z-0 -ml-1.5 flex w-[calc(100%+0.75rem)] flex-wrap pt-1.5 data-no-data-keys:pointer-events-none data-no-data-keys:opacity-0 sm:-ml-1 sm:w-[calc(100%+0.5rem)]"
        >
          {dataKeys.map((dataKey) => (
            <li key={dataKey} className="max-w-full">
              <Button
                disabled={allDataKeysAreNull}
                data-active={activeDataKey === dataKey ? true : undefined}
                onClick={() => toggleDataKey(dataKey)}
                variant="ghost"
                key={dataKey}
                className="group/button text-muted-foreground data-active:text-foreground max-w-full gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs font-medium"
              >
                <div
                  style={{
                    backgroundColor:
                      activeDataKey && activeDataKey !== dataKey
                        ? `var(--muted-more-foreground)`
                        : chartConfig[dataKey].color,
                  }}
                  className="-ml-0.25 size-2.5 shrink-0 rounded-xs transition-[border-radius,_background-color] group-data-active/button:rounded-[0.3125rem]"
                />
                <p className="max-w-28 min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap">
                  {tooltipNameFormatter ? tooltipNameFormatter(dataKey) : dataKey}
                </p>
              </Button>
            </li>
          ))}
        </ol>
      )}
      {!noLegends && dataKeys.length < 1 && <div className="h-8.25 w-full" />}
    </div>
  );
}
