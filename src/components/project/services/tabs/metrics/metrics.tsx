import Charts from "@/components/project/services/tabs/metrics/charts";
import TabWrapper from "@/components/project/services/tabs/tab-wrapper";

export default function Metrics() {
  return (
    <TabWrapper>
      <div className="w-full flex flex-wrap">
        <Charts />
      </div>
    </TabWrapper>
  );
}
