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
    () =>
      dataKeys.filter((key) => (activeDataKey ? key === activeDataKey : true)),
    [dataKeys, activeDataKey]
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
    <div className={cn("w-full flex flex-col", className)}>
      <ChartContainer
        className={cn("w-full h-56", classNameChart)}
        config={chartConfig}
      >
        <AreaChart accessibilityLayer data={chartData} margin={margin}>
          <CartesianGrid vertical={false} stroke="transparent" />
          <XAxis
            dataKey="timestamp"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => format(value, "MMM dd")}
          />
          <YAxis
            tickMargin={8}
            tickLine={false}
            axisLine={false}
            tickFormatter={yFormatter}
          />
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
          className="w-[calc(100%+0.75rem)] sm:w-[calc(100%+1rem)] flex flex-wrap pt-1.5 -ml-1.5 sm:-ml-2 group/list"
        >
          {dataKeys.map((dataKey) => (
            <li key={dataKey} className="max-w-full">
              <Button
                data-active={activeDataKey === dataKey ? true : undefined}
                onClick={() => toggleDataKey(dataKey)}
                variant="ghost"
                key={dataKey}
                className="max-w-full group/button text-muted-foreground data-active:text-foreground text-xs px-2.5 py-1.5 rounded-md font-medium gap-1.5 text-left"
              >
                <div
                  style={{
                    backgroundColor:
                      activeDataKey && activeDataKey !== dataKey
                        ? `var(--muted-more-foreground)`
                        : chartConfig[dataKey].color,
                  }}
                  className="size-2.5 group-data-active/button:rounded-[0.3125rem] rounded-xs shrink-0 -ml-0.25 transition-[border-radius,_background-color]"
                />
                <p className="shrink min-w-0 leading-tight max-w-28 whitespace-nowrap overflow-hidden text-ellipsis">
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
