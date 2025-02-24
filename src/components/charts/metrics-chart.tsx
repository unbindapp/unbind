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
  yFormatter: ((value: any, index: number) => string) | undefined;
  chartData: (Record<string, number> & { timestamp: number })[];
};

export default function MetricsChart({ yFormatter, chartData }: Props) {
  const dataKeys = useMemo(() => {
    let keys = new Set<string>();
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
    let config: ChartConfig = {};
    dataKeys.forEach((key, i) => {
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
        margin={{
          left: 12,
          right: 12,
          top: 12,
          bottom: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => format(value, "MMM d")}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={yFormatter}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        {dataKeys.map((dataKey, i) => (
          <Line
            key={dataKey}
            dataKey={dataKey}
            type="monotone"
            stroke={`hsl(var(--chart-${(i % 10) + 1}))`}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
