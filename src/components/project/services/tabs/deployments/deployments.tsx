"use client";

import ErrorCard from "@/components/error-card";
import DeploymentCard from "@/components/project/services/tabs/deployments/deployment-card";
import TabWrapper from "@/components/project/services/tabs/tab-wrapper";
import { TService } from "@/server/trpc/api/main/router";
import { api } from "@/server/trpc/setup/client";

type TProps = {
  service: TService;
};

export default function Deployments({ service }: TProps) {
  const { data, isPending, isError, error } = api.main.getDeployments.useQuery({
    teamId: service.teamId,
    projectId: service.projectId,
    environmentId: service.environmentId,
    serviceId: service.id,
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
