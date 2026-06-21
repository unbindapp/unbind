"use client";

import DeploymentPanel from "@/components/deployment/panel/deployment-panel";
import DeploymentPanelProvider from "@/components/deployment/panel/deployment-panel-provider";
import ErrorCard from "@/components/error-card";
import TabWrapper from "@/components/navigation/tab-wrapper";
import NoItemsCard from "@/components/no-items-card";
import { useDeployments } from "@/components/deployment/deployments-provider";
import DeploymentCard from "@/components/deployment/deployment-card";
import { useService } from "@/components/service/service-provider";
import { TDeploymentShallow } from "@/lib/queries/deployments";
import { TServiceShallow } from "@/lib/queries/services";
import { HistoryIcon, RocketIcon, ServerIcon } from "lucide-react";
import { useMemo } from "react";
import { useInstanceHealth } from "@/components/instances/instance-health-provider";
import { LinkButton } from "@/components/ui/button";
import { deploySectionInstanceSliderId } from "@/components/service/panel/content/deployed/settings/sections/deploy-section";

export default function Deployments({ service }: { service: TServiceShallow }) {
  const {
    query: { data: deploymentsData, isPending: isPendingDeployments, error: errorDeployments },
  } = useDeployments();

  const {
    query: { data: serviceData, isPending: isPendingService, error: errorService },
  } = useService();

  const isPending = isPendingDeployments || isPendingService;
  const error = errorDeployments || errorService;
  const hasData = deploymentsData !== undefined && serviceData !== undefined;

  const currentOrLastDeployment = useMemo(() => {
    if (!deploymentsData) return undefined;
    if (deploymentsData.current_deployment) return deploymentsData.current_deployment;
    if (deploymentsData.deployments && deploymentsData.deployments.length > 0) {
      return deploymentsData.deployments[0];
    }
    return undefined;
  }, [deploymentsData]);

  const filteredDeployments: TDeploymentShallow[] | undefined = useMemo(() => {
    if (!deploymentsData?.deployments) return undefined;
    return deploymentsData.deployments.filter((d) =>
      currentOrLastDeployment ? currentOrLastDeployment.id !== d.id : true,
    );
  }, [deploymentsData, currentOrLastDeployment]);

  const hasNoDeployment =
    deploymentsData?.deployments && deploymentsData.deployments.length === 0 ? true : false;

  return (
    <TabWrapper>
      <DeploymentPanelProvider
        deployments={deploymentsData?.deployments || null}
        isPending={isPendingDeployments}
      >
        <InfoRow />
        <DeploymentPanel service={service} />
        {(isPending || currentOrLastDeployment) && (
          <div className="w-full pb-3">
            {serviceData && currentOrLastDeployment ? (
              <DeploymentCard
                service={service}
                deployment={currentOrLastDeployment}
                currentDeployment={deploymentsData?.current_deployment}
                showInstances={true}
              />
            ) : (
              <DeploymentCard showInstances={true} isPlaceholder={true} service={service} />
            )}
          </div>
        )}
        {(isPending || !hasNoDeployment) && (
          <div
            data-pending={isPending || undefined}
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
                    <DeploymentCard
                      service={service}
                      key={deployment.id}
                      deployment={deployment}
                      currentDeployment={deploymentsData.current_deployment}
                    />
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
          Array.from({ length: 10 }).map((_, i) => (
            <DeploymentCard key={i} isPlaceholder service={service} />
          ))}
        {!hasData && !isPending && error && <ErrorCard message={error.message} />}
      </DeploymentPanelProvider>
    </TabWrapper>
  );
}

function InfoRow() {
  return (
    <div className="-mt-1 flex w-full items-center sm:-mt-2">
      <InstancesButton />
    </div>
  );
}

function InstancesButton() {
  const { teamId, projectId } = useService();
  const { data, isPending, isError } = useInstanceHealth();

  const isHardError = !data && isError;

  const text = useMemo(() => {
    if (isPending) return "1 Instance";
    if (isHardError) {
      return "Error";
    }
    const instanceCount = data.data.instances.length;
    return `${instanceCount} Instance${instanceCount !== 1 ? "s" : ""}`;
  }, [data, isPending, isHardError]);

  return (
    <LinkButton
      to="/$team_id/project/$project_id"
      hash="deploy"
      params={{ team_id: teamId, project_id: projectId }}
      search={(prev) => ({
        ...prev,
        service_tab: "settings",
        highlight_id: deploySectionInstanceSliderId,
      })}
      data-pending={isPending || undefined}
      data-error={isHardError || undefined}
      variant="ghost"
      className="group/button data-error:text-destructive text-muted-foreground flex items-center justify-start gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium"
    >
      <ServerIcon className="group-data-pending/button:bg-muted-foreground group-data-pending/button:animate-skeleton -ml-px size-4 group-data-pending/button:rounded-sm" />
      <p className="group-data-pending/button:bg-muted-foreground group-data-pending/button:animate-skeleton min-w-0 shrink truncate leading-tight group-data-pending/button:rounded-sm group-data-pending/button:text-transparent">
        {text}
      </p>
    </LinkButton>
  );
}
