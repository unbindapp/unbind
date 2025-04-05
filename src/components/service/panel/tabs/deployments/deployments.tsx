"use client";

import DeploymentPanel from "@/components/deployment/panel/deployment-panel";
import DeploymentPanelProvider from "@/components/deployment/panel/deployment-panel-provider";
import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { useDeployments } from "@/components/service/deployments-provider";
import DeploymentCard from "@/components/service/panel/tabs/deployments/deployment-card";
import TabWrapper from "@/components/navigation/tab-wrapper";
import { useService } from "@/components/service/service-provider";
import { RocketIcon } from "lucide-react";

export default function Deployments() {
  const {
    query: { data: deploymentsData, isPending: isPendingDeployments, error: errorDeployments },
  } = useDeployments();

  const currentDeployment = deploymentsData?.current_deployment;

  const {
    query: { data: serviceData, isPending: isPendingService, error: errorService },
  } = useService();

  const isPending = isPendingDeployments || isPendingService;
  const error = errorDeployments || errorService;
  const hasData = deploymentsData !== undefined && serviceData !== undefined;

  return (
    <TabWrapper>
      <DeploymentPanelProvider>
        {(isPending || currentDeployment) && (
          <div className="w-full pb-3">
            {serviceData && currentDeployment ? (
              <DeploymentPanel deployment={currentDeployment} service={serviceData?.service}>
                <DeploymentCard
                  deployment={currentDeployment}
                  currentDeployment={currentDeployment}
                />
              </DeploymentPanel>
            ) : (
              <DeploymentCard isPlaceholder={true} />
            )}
          </div>
        )}
        <div
          data-pending={isPending ? true : undefined}
          className="group/header flex w-full items-center justify-start px-2 pb-1"
        >
          <h3 className="text-muted-foreground group-data-pending/header:bg-muted-foreground group-data-pending/header:animate-skeleton leading-tight font-medium group-data-pending/header:rounded-md group-data-pending/header:text-transparent">
            History
          </h3>
        </div>
        {hasData && deploymentsData?.deployments && deploymentsData.deployments.length > 0 && (
          <ol className="flex w-full flex-col gap-2">
            {deploymentsData.deployments
              .filter((d) => (currentDeployment ? currentDeployment.id !== d.id : true))
              .map((deployment) => (
                <li className="w-full" key={deployment.id}>
                  <DeploymentPanel deployment={deployment} service={serviceData.service}>
                    <DeploymentCard
                      key={deployment.id}
                      deployment={deployment}
                      currentDeployment={currentDeployment}
                    />
                  </DeploymentPanel>
                </li>
              ))}
          </ol>
        )}
        {hasData && deploymentsData?.deployments && deploymentsData.deployments.length === 0 && (
          <NoItemsCard
            Icon={RocketIcon}
            className="text-muted-foreground px-2 py-5 text-center leading-tight font-medium"
          >
            No deployments yet
          </NoItemsCard>
        )}
        {!hasData &&
          isPending &&
          Array.from({ length: 10 }).map((_, i) => <DeploymentCard key={i} isPlaceholder />)}
        {!hasData && !isPending && error && <ErrorCard message={error.message} />}
      </DeploymentPanelProvider>
    </TabWrapper>
  );
}
