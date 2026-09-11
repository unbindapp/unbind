import MetricsFilterDropdown from "@/components/metrics/metrics-filter-dropdown";
import TabWrapper from "@/components/navigation/tab-wrapper";
import Charts from "@/components/service/panel/content/deployed/metrics/charts";

export default function Metrics() {
  return (
    <TabWrapper>
      <div className="flex w-full items-center">
        <MetricsFilterDropdown />
      </div>
      <div className="flex w-full flex-row flex-wrap pt-1">
        <Charts noLegends />
      </div>
    </TabWrapper>
  );
}
