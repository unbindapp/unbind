import TabWrapper from "@/components/navigation/tab-wrapper";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";

type TProps = {
  deployment: TDeploymentShallow;
};

export default function Info({}: TProps) {
  return (
    <TabWrapper>
      <div className="text-muted-foreground">Info</div>
    </TabWrapper>
  );
}
