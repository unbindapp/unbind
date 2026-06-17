import MetricsIntervalDropdown from "@/components/metrics/metrics-interval-dropdown";
import TabWrapper from "@/components/navigation/tab-wrapper";
import Charts from "@/components/service/panel/content/deployed/metrics/charts";

export default function Metrics() {
  return (
    <TabWrapper>
      <MetricsIntervalDropdown />
      <div className="flex w-full flex-row flex-wrap pt-1">
        <Charts noLegends />
      </div>
    </TabWrapper>
  );
}
