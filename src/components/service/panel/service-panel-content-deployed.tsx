import TabIndicator from "@/components/navigation/tab-indicator";
import { TTab } from "@/components/service/panel/service-panel-content";
import { useService } from "@/components/service/service-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { ReactNode } from "react";

type TProps = {
  tabs: TTab[];
  currentTab: TTab | undefined;
  currentTabId: string;
  setCurrentTab: (tab: string) => void;
  service: TServiceShallow;
};

export function DeployedServiceContent({
  tabs,
  currentTab,
  currentTabId,
  setCurrentTab,
  service,
}: TProps) {
  const { teamId, projectId, environmentId } = useService();
  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden">
      <nav className="touch:scrollbar-hidden flex w-full justify-start overflow-auto border-b">
        <div className="flex justify-start px-2 pt-3.5 sm:px-4.5">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              variant="ghost"
              onClick={() => setCurrentTab(tab.value)}
              data-active={tab.value === currentTabId ? true : undefined}
              className="group/button text-muted-foreground data-active:text-foreground min-w-0 shrink rounded-t-md rounded-b-none px-3 pt-2.5 pb-4.5 font-medium active:bg-transparent has-hover:hover:bg-transparent"
            >
              {tab.value === currentTabId && <TabIndicator layoutId="service-panel-tab" />}
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
                serviceId={service.id}
              >
                <currentTab.Page />
              </currentTab.Provider>
            )}
          </ConditionalScrollArea>
        </div>
      </div>
    </div>
  );
}

function ConditionalScrollArea({ noArea, children }: { noArea?: boolean; children?: ReactNode }) {
  if (noArea) return children;
  return <ScrollArea viewportClassName="pb-[var(--safe-area-inset-bottom)]">{children}</ScrollArea>;
}
