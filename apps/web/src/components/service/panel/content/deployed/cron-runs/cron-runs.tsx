"use client";

import { useDeployments } from "@/components/deployment/deployments-provider";
import DeploymentPanel from "@/components/deployment/panel/deployment-panel";
import DeploymentPanelProvider from "@/components/deployment/panel/deployment-panel-provider";
import TabWrapper from "@/components/navigation/tab-wrapper";
import CronRuns from "@/components/service/cron/cron-runs";
import { TServiceShallow } from "@/lib/queries/services";

// A run's logs are the logs of the deployment it ran, so the deployment panel lives here too
export default function CronRunsTab({ service }: { service: TServiceShallow }) {
  const {
    query: { data: deploymentsData, isPending: isPendingDeployments },
  } = useDeployments();

  return (
    <TabWrapper>
      <DeploymentPanelProvider
        deployments={deploymentsData?.deployments || null}
        isPending={isPendingDeployments}
      >
        <DeploymentPanel service={service} />
        <CronRuns service={service} />
      </DeploymentPanelProvider>
    </TabWrapper>
  );
}
