import Charts from "@/components/service/tabs/metrics/charts";
import TabWrapper from "@/components/service/tabs/tab-wrapper";
import { TService } from "@/server/trpc/api/main/router";

type TProps = {
  service: TService;
};

export default function Metrics({ service }: TProps) {
  return (
    <TabWrapper className="flex flex-row flex-wrap">
      <Charts service={service} />
    </TabWrapper>
  );
}
