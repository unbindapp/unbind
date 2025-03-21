import ErrorCard from "@/components/error-card";
import { useService } from "@/components/service/service-provider";
import TabWrapper from "@/components/service/tabs/tab-wrapper";
import VariableCard from "@/components/service/tabs/variables/variable-card";
import VariableForm from "@/components/service/tabs/variables/variable-form";
import { api } from "@/server/trpc/setup/client";

export default function Variables() {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { data, isPending, isError, error } = api.main.getVariables.useQuery({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });

  return (
    <TabWrapper>
      {data?.variables && (
        <VariableForm
          teamId={teamId}
          projectId={projectId}
          environmentId={environmentId}
          serviceId={serviceId}
        />
      )}
      {data?.variables &&
        data.variables.length > 0 &&
        data.variables.map((variable) => <VariableCard key={variable.key} variable={variable} />)}
      {data?.variables && data.variables.length === 0 && (
        <div className="text-muted-foreground px-2 py-5 text-center leading-tight font-medium">
          No variables yet
        </div>
      )}
      {!data &&
        isPending &&
        Array.from({ length: 10 }).map((_, i) => <VariableCard key={i} isPlaceholder />)}
      {!data && !isPending && isError && <ErrorCard message={error.message} />}
    </TabWrapper>
  );
}
