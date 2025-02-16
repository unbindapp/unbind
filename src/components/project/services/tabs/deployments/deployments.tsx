"use client";

import ErrorCard from "@/components/error-card";
import DeploymentCard from "@/components/project/services/tabs/deployments/deployment-card";
import TabWrapper from "@/components/project/services/tabs/tab-wrapper";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";

export default function Deployments() {
  const { teamId, projectId, environmentId, serviceId } = useIdsFromPathname();
  const { data, isPending, isError, error } = api.main.getDeployments.useQuery(
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
      {data?.deployments &&
        data.deployments.length > 0 &&
        data.deployments.map((deployment, i) => (
          <DeploymentCard
            key={deployment.id}
            deployment={deployment}
            active={i === 0}
          />
        ))}
      {data?.deployments && data.deployments.length === 0 && (
        <div className="px-2 py-5 leading-tight text-muted-foreground text-center">
          No deployments yet
        </div>
      )}
      {!data &&
        isPending &&
        Array.from({ length: 10 }).map((_, i) => (
          <DeploymentCard key={i} isPlaceholder />
        ))}
      {!data && !isPending && isError && <ErrorCard message={error.message} />}
    </TabWrapper>
  );
}
