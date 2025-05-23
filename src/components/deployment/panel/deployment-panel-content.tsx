import { useDeployment } from "@/components/deployment/deployment-provider";
import { TDeploymentPanelTab } from "@/components/deployment/panel/deployment-panel";
import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import PanelContentWrapper from "@/components/panel/panel-content-wrapper";
import PanelNavbar from "@/components/panel/panel-navbar";
import PanelTabWrapper from "@/components/panel/panel-tab-wrapper";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { HTMLAttributes } from "react";

type TProps = {
  tabs: TDeploymentPanelTab[];
  className?: string;
  currentTab: TDeploymentPanelTab | undefined;
  deployment: TDeploymentShallow;
} & HTMLAttributes<HTMLDivElement>;

export function DeploymentPanelContent({
  deployment,
  currentTab,
  tabs,
  className,
  ...rest
}: TProps) {
  const { teamId, projectId, environmentId, serviceId, deploymentId } = useDeployment();
  const { currentTabId, setCurrentTabId } = useDeploymentPanel();

  return (
    <PanelContentWrapper className={className} {...rest}>
      <PanelNavbar
        tabs={tabs}
        currentTabId={currentTabId}
        onTabClick={(value) => setCurrentTabId(value)}
        layoutId="deployment-panel-tab"
      />
      <PanelTabWrapper noScrollArea={currentTab?.noScrollArea}>
        {currentTab && (
          <currentTab.Provider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            serviceId={serviceId}
            deploymentId={deploymentId}
          >
            <currentTab.Page deployment={deployment} />
          </currentTab.Provider>
        )}
      </PanelTabWrapper>
    </PanelContentWrapper>
  );
}
