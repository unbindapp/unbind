"use client";

import ErrorCard from "@/components/error-card";
import { useService } from "@/components/service/service-provider";
import DeploymentCard from "@/components/service/tabs/deployments/deployment-card";
import TabWrapper from "@/components/service/tabs/tab-wrapper";
import { api } from "@/server/trpc/setup/client";

export default function Deployments() {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { data, isPending, isError, error } = api.main.getDeployments.useQuery({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });

  return (
    <TabWrapper>
      {data?.deployments &&
        data.deployments.length > 0 &&
        data.deployments.map((deployment, i) => (
          <DeploymentCard key={deployment.id} deployment={deployment} active={i === 0} />
        ))}
      {data?.deployments && data.deployments.length === 0 && (
        <div className="text-muted-foreground px-2 py-5 text-center leading-tight font-medium">
          No deployments yet
        </div>
      )}
      {!data &&
        isPending &&
        Array.from({ length: 10 }).map((_, i) => <DeploymentCard key={i} isPlaceholder />)}
      {!data && !isPending && isError && <ErrorCard message={error.message} />}
    </TabWrapper>
  );
}
