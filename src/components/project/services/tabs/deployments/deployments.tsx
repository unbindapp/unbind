"use client";

import DeploymentCard from "@/components/project/services/tabs/deployments/deployment-card";
import TabWrapper from "@/components/project/services/tabs/tab-wrapper";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";

export default function Deployments() {
  const { teamId, projectId, environmentId, serviceId } = useIdsFromPathname();
  const { data } = api.main.getDeployments.useQuery(
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
      {data?.deployments?.map((deployment, i) => (
        <DeploymentCard
          key={deployment.id}
          deployment={deployment}
          active={i === 0}
        />
      ))}
    </TabWrapper>
  );
}
