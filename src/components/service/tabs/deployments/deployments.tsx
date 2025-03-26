"use client";

import ErrorCard from "@/components/error-card";
import { useDeployments } from "@/components/service/deployments/deployments-provider";
import { useService } from "@/components/service/service-provider";
import DeploymentCard from "@/components/service/tabs/deployments/deployment-card";
import TabWrapper from "@/components/service/tabs/tab-wrapper";

export default function Deployments() {
  const {
    query: { data: serviceData },
  } = useService();
  const {
    query: { data, isPending, error },
  } = useDeployments();

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
