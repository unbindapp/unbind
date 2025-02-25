import Charts from "@/components/project/services/tabs/metrics/charts";
import TabWrapper from "@/components/project/services/tabs/tab-wrapper";
import { TService } from "@/server/trpc/api/main/router";

type Props = {
  service: TService;
};

export default function Metrics({ service }: Props) {
  return (
    <TabWrapper>
      <div className="w-full flex flex-wrap">
        <Charts service={service} />
      </div>
    </TabWrapper>
  );
}
