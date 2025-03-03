import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/components/ui/utils";
import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

type Props = {
  yFormatter: ((value: number, index: number) => string) | undefined;
  tooltipValueFormatter: (value: number) => string;
  chartData: (Record<string, number> & { timestamp: number })[];
  className?: string;
  classNameChart?: string;
};

const margin = { left: 4, right: 4, top: 4, bottom: 4 };

const colorCount = 10;

export default function MetricsChart({
  yFormatter,
  tooltipValueFormatter,
  chartData,
  className,
  classNameChart,
}: Props) {
  const dataKeys = useMemo(() => {
    const keys = new Set<string>();
    chartData.forEach((row) => {
      Object.keys(row)
        .filter((k) => k !== "timestamp")
        .forEach((k) => {
          keys.add(k);
        });
    });
    return [...keys];
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

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <ChartContainer className={cn("h-56 w-full", classNameChart)} config={chartConfig}>
        <AreaChart accessibilityLayer data={chartData} margin={margin}>
          <CartesianGrid vertical={false} stroke="transparent" />
          <XAxis
            dataKey="timestamp"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => format(value, "MMM dd")}
          />
          <YAxis tickMargin={8} tickLine={false} axisLine={false} tickFormatter={yFormatter} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator={activeDataKey ? "dot-circular" : "dot"}
                labelFormatter={(_, p) => {
                  return format(p[0].payload.timestamp, "MMM dd, HH:mm");
                }}
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
      {dataKeys.length > 1 && (
        <ol
          data-has-active={activeDataKey ? true : undefined}
          className="group/list -ml-1.5 flex w-[calc(100%+0.75rem)] flex-wrap pt-1.5 sm:-ml-2 sm:w-[calc(100%+1rem)]"
        >
          {dataKeys.map((dataKey) => (
            <li key={dataKey} className="max-w-full">
              <Button
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
                  {dataKey}
                </p>
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
