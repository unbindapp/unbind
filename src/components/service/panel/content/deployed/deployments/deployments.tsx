"use client";

import DeploymentPanel from "@/components/deployment/panel/deployment-panel";
import DeploymentPanelProvider from "@/components/deployment/panel/deployment-panel-provider";
import ErrorCard from "@/components/error-card";
import TabWrapper from "@/components/navigation/tab-wrapper";
import NoItemsCard from "@/components/no-items-card";
import { useDeployments } from "@/components/deployment/deployments-provider";
import DeploymentCard from "@/components/deployment/deployment-card";
import { useService } from "@/components/service/service-provider";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { HistoryIcon, RocketIcon } from "lucide-react";
import { useMemo } from "react";

// test deploy

export default function Deployments({ service }: { service: TServiceShallow }) {
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

  const currentOrFirstDeployment = useMemo(() => {
    if (currentDeployment) return currentDeployment;

    const activeDeployment = deploymentsData?.deployments
      ? deploymentsData.deployments.find((d) => d.status === "active")
      : undefined;

    if (activeDeployment) {
      return activeDeployment;
    }

    const lastActiveLikeDeployment = deploymentsData?.deployments
      ? deploymentsData.deployments.find(
          (d) =>
            d.status === "build-pending" ||
            d.status === "build-queued" ||
            d.status === "build-running" ||
            d.status === "build-succeeded" ||
            d.status === "build-cancelled" ||
            d.status === "build-failed" ||
            d.status === "crashing" ||
            d.status === "pending",
        )
      : undefined;

    if (lastActiveLikeDeployment) {
      return lastActiveLikeDeployment;
    }

    return undefined;
  }, [currentDeployment, deploymentsData]);

  const filteredDeployments: AppRouterOutputs["deployments"]["list"]["deployments"] | undefined =
    useMemo(() => {
      if (!deploymentsData?.deployments) return undefined;
      return deploymentsData.deployments.filter((d) =>
        currentOrFirstDeployment ? currentOrFirstDeployment.id !== d.id : true,
      );
    }, [deploymentsData, currentOrFirstDeployment]);

  const hasNoDeployment =
    deploymentsData?.deployments && deploymentsData.deployments.length === 0 ? true : false;

  return (
    <TabWrapper>
      <DeploymentPanelProvider deployments={deploymentsData?.deployments || null}>
        <DeploymentPanel service={service} />
        {(isPending || currentOrFirstDeployment) && (
          <div className="w-full pb-3">
            {serviceData && currentOrFirstDeployment ? (
              <DeploymentCard service={service} deployment={currentOrFirstDeployment} />
            ) : (
              <DeploymentCard isPlaceholder={true} />
            )}
          </div>
        )}
        {(isPending || !hasNoDeployment) && (
          <div
            data-pending={isPending ? true : undefined}
            className="group/header flex w-full items-center justify-start px-2 pb-1"
          >
            <h3 className="text-muted-foreground group-data-pending/header:bg-muted-foreground group-data-pending/header:animate-skeleton leading-tight font-medium group-data-pending/header:rounded-md group-data-pending/header:text-transparent">
              History
            </h3>
          </div>
        )}
        {hasData && filteredDeployments && !hasNoDeployment && (
          <>
            {filteredDeployments.length > 0 && (
              <ol className="flex w-full flex-col gap-2">
                {filteredDeployments.map((deployment) => (
                  <li className="w-full" key={deployment.id}>
                    <DeploymentCard service={service} key={deployment.id} deployment={deployment} />
                  </li>
                ))}
              </ol>
            )}
            {filteredDeployments.length === 0 && (
              <NoItemsCard Icon={HistoryIcon}>No history yet</NoItemsCard>
            )}
          </>
        )}
        {hasData && hasNoDeployment && (
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
