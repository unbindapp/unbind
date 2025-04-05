import MetricsIntervalDropdown from "@/components/metrics/metrics-interval-dropdown";
import Charts from "@/components/service/panel/tabs/metrics/charts";
import TabWrapper from "@/components/navigation/tab-wrapper";

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
