import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { format } from "date-fns";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

type Props = {
  yFormatter: ((value: number, index: number) => string) | undefined;
  tooltipValueFormatter: (value: number) => string;
  chartData: (Record<string, number> & { timestamp: number })[];
};

const margin = { left: 4, right: 4, top: 4, bottom: 4 };

const colorCount = 10;

export default function MetricsChart({
  yFormatter,
  tooltipValueFormatter,
  chartData,
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

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    dataKeys.forEach((key) => {
      config[key] = {
        label: key,
      };
    });
    return config satisfies ChartConfig;
  }, [dataKeys]);

  return (
    <ChartContainer className="w-full" config={chartConfig}>
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
              labelFormatter={(_, p) => {
                return format(p[0].payload.timestamp, "MMM dd, HH:mm");
              }}
              // @ts-expect-error - This is fine, it'll always be a number
              valueFormatter={tooltipValueFormatter}
            />
          }
        />
        {dataKeys.map((dataKey, i) => (
          <Area
            animationDuration={1000}
            key={dataKey}
            dataKey={dataKey}
            type="monotone"
            stroke={`hsl(var(--chart-${(i % colorCount) + 1}))`}
            strokeWidth={1.5}
            stackId={dataKey}
            fill="transparent"
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
