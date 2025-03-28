"use client";

import ErrorCard from "@/components/error-card";
import { useDeployments } from "@/components/service/deployments/deployments-provider";
import { useService } from "@/components/service/service-provider";
import DeploymentCard from "@/components/service/tabs/deployments/deployment-card";
import TabWrapper from "@/components/service/tabs/tab-wrapper";

export default function Deployments() {
  const {
    query: { data: serviceData, isPending: isServicePending, error: err },
  } = useService();
  const {
    query: { data, isPending, error },
  } = useDeployments();

  const currentDeployment = serviceData?.service.current_deployment;

  const isAnyPending = isServicePending || isPending;

  return (
    <TabWrapper>
      {(isAnyPending || currentDeployment) && (
        <>
          {currentDeployment ? (
            <DeploymentCard deployment={currentDeployment} currentDeployment={currentDeployment} />
          ) : (
            <DeploymentCard isPlaceholder={true} />
          )}
        </>
      )}
      <div
        data-pending={isPending ? true : undefined}
        className="group/header flex w-full items-center justify-start px-2 pt-3 pb-0.5"
      >
        <h3 className="text-muted-foreground group-data-pending/header:bg-muted-foreground group-data-pending/header:animate-skeleton leading-tight font-medium group-data-pending/header:rounded-md group-data-pending/header:text-transparent">
          History
        </h3>
      </div>
      {data?.deployments &&
        data.deployments.length > 0 &&
        data.deployments
          .filter((d) => (currentDeployment ? currentDeployment.id !== d.id : true))
          .map((deployment) => (
            <DeploymentCard
              key={deployment.id}
              deployment={deployment}
              currentDeployment={serviceData?.service.current_deployment}
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
