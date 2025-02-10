"use client";

import DeploymentCard from "@/components/project/services/tabs/deployments/deployment-card";
import { useAppPathnames } from "@/lib/hooks/use-app-pathnames";
import { api } from "@/server/trpc/setup/client";

export default function Deployments() {
  const { teamId, projectId, environmentId, serviceId } = useAppPathnames();
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
    <div className="w-full flex flex-col p-6 gap-2">
      {data?.deployments?.map((deployment, i) => (
        <DeploymentCard
          key={deployment.id}
          deployment={deployment}
          active={i === 0}
        />
      ))}
    </div>
  );
}
