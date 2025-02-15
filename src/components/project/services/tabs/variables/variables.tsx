import ErrorCard from "@/components/error-card";
import TabWrapper from "@/components/project/services/tabs/tab-wrapper";
import VariableCard from "@/components/project/services/tabs/variables/variable-card";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";

export default function Variables() {
  const { teamId, projectId, environmentId, serviceId } = useIdsFromPathname();
  const { data, isPending, isError, error } = api.main.getVariables.useQuery(
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
      {data?.variables &&
        data.variables.length > 0 &&
        data.variables.map((variable) => (
          <VariableCard key={variable.key} variable={variable} />
        ))}
      {data?.variables && data.variables.length === 0 && (
        <div className="px-2 py-3 leading-tight text-muted-foreground text-center">
          No deployments yet
        </div>
      )}
      {!data &&
        isPending &&
        Array.from({ length: 10 }).map((_, i) => (
          <VariableCard key={i} isPlaceholder />
        ))}
      {!data && !isPending && isError && <ErrorCard message={error.message} />}
    </TabWrapper>
  );
}
