import ConditionalScrollArea from "@/components/conditional-scroll-area";
import { useDeployment } from "@/components/deployment/deployment-provider";
import { TDeploymentPanelTab } from "@/components/deployment/panel/deployment-panel";
import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import TabIndicator from "@/components/navigation/tab-indicator";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";

type TProps = {
  tabs: TDeploymentPanelTab[];
  className?: string;
  currentTab: TDeploymentPanelTab | undefined;
  deployment: TDeploymentShallow;
};

export function DeploymentPanelContent({ deployment, currentTab, tabs, className }: TProps) {
  const { teamId, projectId, environmentId, serviceId, deploymentId } = useDeployment();
  const { currentTabId, setCurrentTabId } = useDeploymentPanel();

  return (
    <div className={cn("flex w-full flex-1 flex-col overflow-hidden", className)}>
      <nav className="touch:scrollbar-hidden flex w-full justify-start overflow-auto border-b">
        <div className="flex justify-start px-2 pt-2 sm:px-4.5 sm:pt-3">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              variant="ghost"
              onClick={() => setCurrentTabId(tab.value)}
              data-active={tab.value === currentTabId ? true : undefined}
              className="group/button text-muted-foreground data-active:text-foreground min-w-0 shrink rounded-t-md rounded-b-none px-3 pt-2.5 pb-4.5 font-medium active:bg-transparent has-hover:hover:bg-transparent"
            >
              {tab.value === currentTabId && <TabIndicator layoutId="deployment-panel-tab" />}
              <div className="pointer-events-none absolute h-full w-full py-1">
                <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border h-full w-full rounded-lg" />
              </div>
              <p className="relative min-w-0 shrink leading-none">{tab.title}</p>
            </Button>
          ))}
        </div>
      </nav>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <ConditionalScrollArea noArea={currentTab?.noScrollArea}>
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
          </ConditionalScrollArea>
        </div>
      </div>
    </div>
  );
}
