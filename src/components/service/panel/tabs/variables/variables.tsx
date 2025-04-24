import TabWrapper from "@/components/navigation/tab-wrapper";
import { useService } from "@/components/service/service-provider";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import VariablesHeader from "@/components/variables/variables-header";
import VariablesList from "@/components/variables/variables-list";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { useMemo } from "react";

export default function Variables({ service }: { service: TServiceShallow }) {
  const { teamId, projectId, environmentId } = useService();
  const variableTypeProps: TEntityVariableTypeProps = useMemo(
    () => ({
      type: "service",
      teamId,
      projectId,
      environmentId,
      serviceId: service.id,
    }),
    [teamId, projectId, environmentId, service.id],
  );

  return (
    <TabWrapper>
      <VariablesHeader />
      <VariablesList variableTypeProps={variableTypeProps} />
    </TabWrapper>
  );
}
