import MetricsIntervalDropdown from "@/components/metrics/metrics-interval-dropdown";
import TabWrapper from "@/components/navigation/tab-wrapper";
import Charts from "@/components/service/panel/content/deployed/metrics/charts";
import { TServiceShallow } from "@/server/trpc/api/services/types";

export default function Metrics({}: { service: TServiceShallow }) {
  return (
    <TabWrapper>
      <MetricsIntervalDropdown />
      <div className="flex w-full flex-row flex-wrap pt-1">
        <Charts noLegends />
      </div>
    </TabWrapper>
  );
}
