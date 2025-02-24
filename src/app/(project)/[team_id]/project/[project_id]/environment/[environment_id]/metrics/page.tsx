import ChartWrapper from "@/components/charts/chart-wrapper";
import MetricsChart from "@/components/charts/metrics-chart";

export default function Page() {
  return (
    <div className="w-full flex flex-col items-center px-3 md:px-8 pt-5 md:pt-7 pb-16">
      <div className="w-full flex flex-col max-w-5xl">
        <div className="w-full flex flex-wrap items-center justify-between gap-4 px-1">
          <h1 className="w-full font-bold text-2xl leading-tight px-2">
            Metrics
          </h1>
        </div>
        <div className="w-full flex flex-row flex-wrap pt-3">
          <ChartWrapper
            title="CPU"
            description="CPU usage over time"
            className="w-full md:w-1/2"
          >
            <MetricsChart />
          </ChartWrapper>
          <ChartWrapper
            title="RAM"
            description="RAM usage over time"
            className="w-full md:w-1/2"
          >
            <MetricsChart />
          </ChartWrapper>
          <ChartWrapper
            title="Disk"
            description="Disk usage over time"
            className="w-full md:w-1/2"
          >
            <MetricsChart />
          </ChartWrapper>
          <ChartWrapper
            title="Network"
            description="Network usage over time"
            className="w-full md:w-1/2"
          >
            <MetricsChart />
          </ChartWrapper>
        </div>
      </div>
    </div>
  );
}
