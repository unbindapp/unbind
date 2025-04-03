import MetricsIntervalDropdown from "@/components/metrics/interval-dropdown";
import Charts from "@/components/service/tabs/metrics/charts";
import TabWrapper from "@/components/service/tabs/tab-wrapper";

export default function Metrics() {
  return (
    <TabWrapper>
      <MetricsIntervalDropdown />
      <div className="flex w-full flex-row flex-wrap">
        <Charts noLegends />
      </div>
    </TabWrapper>
  );
}
