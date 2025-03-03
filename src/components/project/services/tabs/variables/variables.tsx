import ErrorCard from "@/components/error-card";
import TabWrapper from "@/components/project/services/tabs/tab-wrapper";
import VariableCard from "@/components/project/services/tabs/variables/variable-card";
import { TService } from "@/server/trpc/api/main/router";
import { api } from "@/server/trpc/setup/client";

type Props = {
  service: TService;
};

export default function Variables({ service }: Props) {
  const { data, isPending, isError, error } = api.main.getVariables.useQuery({
    teamId: service.teamId,
    projectId: service.projectId,
    environmentId: service.environmentId,
    serviceId: service.id,
  });

  return (
    <TabWrapper>
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
