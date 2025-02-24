import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { format } from "date-fns";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

type Props = {
  yFormatter: ((value: number, index: number) => string) | undefined;
  tooltipValueFormatter: (value: number) => string;
  chartData: (Record<string, number> & { timestamp: number })[];
};

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
      <LineChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => format(value, "MMM dd")}
        />
        <YAxis tickLine={false} axisLine={false} tickFormatter={yFormatter} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              label="Test"
              labelFormatter={(_, p) => {
                return format(p[0].payload.timestamp, "MMM dd, HH:mm");
              }}
              // @ts-expect-error - This is fine, it'll always be a number
              valueFormatter={tooltipValueFormatter}
            />
          }
        />
        {dataKeys.map((dataKey, i) => (
          <Line
            key={dataKey}
            dataKey={dataKey}
            type="linear"
            stroke={`hsl(var(--chart-${(i % 10) + 1}))`}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
