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
    <div className="w-full flex flex-col p-4 sm:p-6 gap-1">
      {data?.variables?.map((variable) => (
        <VariableLine key={variable.key} variable={variable} />
      ))}
    </div>
  );
}
