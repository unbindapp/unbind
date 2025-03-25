"use client";

import ErrorCard from "@/components/error-card";
import { useService } from "@/components/service/service-provider";
import DeploymentCard from "@/components/service/tabs/deployments/deployment-card";
import TabWrapper from "@/components/service/tabs/tab-wrapper";
import { api } from "@/server/trpc/setup/client";

export default function Deployments() {
  const {
    teamId,
    projectId,
    environmentId,
    serviceId,
    query: { data: serviceData },
  } = useService();
  const { data, isPending, error } = api.deployments.list.useQuery(
    {
      teamId,
      projectId,
      environmentId,
      serviceId,
    },
    { refetchInterval: 5000 },
  );

  return (
    <TabWrapper>
      {data?.deployments &&
        data.deployments.length > 0 &&
        data.deployments.map((deployment) => (
          <DeploymentCard
            key={deployment.id}
            deployment={deployment}
            lastDeploymentId={serviceData?.service.last_deployment?.id}
          />
        ))}
      {data?.deployments && data.deployments.length === 0 && (
        <div className="text-muted-foreground px-2 py-5 text-center leading-tight font-medium">
          No deployments yet
        </div>
      )}
      {!data &&
        isPending &&
        Array.from({ length: 10 }).map((_, i) => <DeploymentCard key={i} isPlaceholder />)}
      {!data && !isPending && error && <ErrorCard message={error.message} />}
    </TabWrapper>
  );
}
