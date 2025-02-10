import TabWrapper from "@/components/project/services/tabs/tab-wrapper";
import VariableLine from "@/components/project/services/tabs/variables/variable-line";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";

export default function Variables() {
  const { teamId, projectId, environmentId, serviceId } = useIdsFromPathname();
  const { data } = api.main.getVariables.useQuery(
    {
      teamId: teamId!,
      projectId: projectId!,
      environmentId: environmentId!,
      serviceId: serviceId!,
    },
    {
      enabled:
        teamId !== undefined &&
        projectId !== undefined &&
        environmentId !== undefined &&
        serviceId !== undefined,
    }
  );
  return (
    <TabWrapper>
      {data?.variables?.map((variable) => (
        <VariableLine key={variable.key} variable={variable} />
      ))}
    </TabWrapper>
  );
}
