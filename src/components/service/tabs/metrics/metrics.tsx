import Charts from "@/components/service/tabs/metrics/charts";
import TabWrapper from "@/components/service/tabs/tab-wrapper";

export default function Metrics() {
  return (
    <TabWrapper className="flex flex-row flex-wrap">
      <Charts />
    </TabWrapper>
  );
}
