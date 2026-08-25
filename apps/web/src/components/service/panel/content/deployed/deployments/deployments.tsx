"use client";

import DeploymentPanel from "@/components/deployment/panel/deployment-panel";
import DeploymentPanelProvider from "@/components/deployment/panel/deployment-panel-provider";
import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import TabWrapper from "@/components/navigation/tab-wrapper";
import NoItemsCard from "@/components/no-items-card";
import { useDeployments, useDeploymentsUtils } from "@/components/deployment/deployments-provider";
import DeploymentCard from "@/components/deployment/deployment-card";
import { useService, useServiceUtils } from "@/components/service/service-provider";
import { useServicesUtils } from "@/components/service/services-provider";
import {
  createDeployment as createDeploymentFn,
  TDeploymentShallow,
} from "@/lib/queries/deployments";
import { TServiceShallow } from "@/lib/queries/services";
import { GlobeOffIcon, HistoryIcon, RocketIcon, ServerIcon } from "lucide-react";
import { useMemo } from "react";
import { useInstanceHealth } from "@/components/instances/instance-health-provider";
import { useMutation } from "@tanstack/react-query";
import { Button, LinkButton } from "@/components/ui/button";
import { deploySectionInstanceSliderId } from "@/components/service/panel/content/deployed/settings/sections/deploy-section";
import { shouldDeploySectionHaveInstances } from "@/components/service/panel/content/deployed/settings/helpers";

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
    const current = deploymentsData.current_deployment;
    if (current && current.status !== "removed") return current;
    // Removed deployments belong to history, only show a newer deployment (e.g. an in-progress build) on top
    const newest = deploymentsData.deployments?.[0];
    if (newest && newest.id !== current?.id) return newest;
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

  const showNoActiveDeploymentCard =
    deploymentsData?.current_deployment?.status === "removed" &&
    currentOrLastDeployment === undefined;

  return (
    <TabWrapper>
      <DeploymentPanelProvider
        deployments={deploymentsData?.deployments || null}
        isPending={isPendingDeployments}
      >
        {shouldDeploySectionHaveInstances(service) && <InfoRow />}
        <DeploymentPanel service={service} />
        {hasData && showNoActiveDeploymentCard && (
          <div className="w-full pb-3">
            <NoActiveDeploymentCard />
          </div>
        )}
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

function NoActiveDeploymentCard() {
  const { teamId, projectId, environmentId, serviceId } = useService();

  const props = { teamId, projectId, environmentId, serviceId };
  const { refetch: refetchDeployments } = useDeploymentsUtils({
    ...props,
  });
  const { refetch: refetchService } = useServiceUtils({
    ...props,
  });
  const { refetch: refetchServices } = useServicesUtils({
    ...props,
  });

  const {
    mutate: deploy,
    isPending,
    error,
  } = useMutation({
    mutationFn: createDeploymentFn,
    onSuccess: async () => {
      await Promise.all([refetchServices(), refetchService(), refetchDeployments()]);
    },
  });

  return (
    <NoItemsCard Icon={GlobeOffIcon}>
      <p className="w-full leading-tight">There is no active deployment</p>
      {error && <ErrorLine message={error.message} />}
      <Button
        className="mt-2"
        onClick={() => deploy({ teamId, projectId, environmentId, serviceId })}
        isPending={isPending}
      >
        Deploy
      </Button>
    </NoItemsCard>
  );
}

function InfoRow() {
  return (
    <div className="flex w-full items-center sm:-mt-2">
      <InstancesButton />
    </div>
  );
}

function InstancesButton() {
  const { teamId, projectId } = useService();
  const { data, isPending, isError } = useInstanceHealth();

  const isHardError = !data && isError;

  const text = useMemo(() => {
    if (isPending) return "1 Replica";
    if (isHardError) {
      return "Error";
    }
    const instanceCount = data.data.instances.length;
    return `${instanceCount} Replica${instanceCount !== 1 ? "s" : ""}`;
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
