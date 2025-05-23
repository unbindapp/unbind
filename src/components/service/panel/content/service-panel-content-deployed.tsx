import PanelContentWrapper from "@/components/panel/panel-content-wrapper";
import PanelNavbar from "@/components/panel/panel-navbar";
import PanelTabWrapper from "@/components/panel/panel-tab-wrapper";
import { TServicePanelTab } from "@/components/service/panel/content/service-panel-content";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useService } from "@/components/service/service-provider";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { HTMLAttributes } from "react";

type TProps = {
  tabs: TServicePanelTab[];
  service: TServiceShallow;
  className?: string;
  currentTab: TServicePanelTab | undefined;
} & HTMLAttributes<HTMLDivElement>;

export default function ServicePanelContentDeployed({
  currentTab,
  tabs,
  service,
  className,
  ...rest
}: TProps) {
  const { teamId, projectId, environmentId } = useService();
  const { currentTabId, setCurrentTabId } = useServicePanel();

  return (
    <PanelContentWrapper className={className} {...rest}>
      <PanelNavbar
        tabs={tabs}
        currentTabId={currentTabId}
        onTabClick={(value) => setCurrentTabId(value)}
        layoutId="service-panel-tab"
      />
      <PanelTabWrapper noScrollArea={currentTab?.noScrollArea}>
        {currentTab && (
          <currentTab.Provider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            serviceId={service.id}
            service={service}
          >
            <currentTab.Page service={service} />
          </currentTab.Provider>
        )}
      </PanelTabWrapper>
    </PanelContentWrapper>
  );
}
