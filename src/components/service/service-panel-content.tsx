"use client";

import TabIndicator from "@/components/navigation/tab-indicator";
import { servicePanelTabKey } from "@/components/service/constants";
import { useService } from "@/components/service/service-provider";
import Deployments from "@/components/service/tabs/deployments/deployments";
import Logs from "@/components/service/tabs/logs/logs";
import Metrics from "@/components/service/tabs/metrics/metrics";
import Settings from "@/components/service/tabs/settings/settings";
import Variables from "@/components/service/tabs/variables/variables";
import VariablesProvider from "@/components/service/tabs/variables/variables-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { parseAsString, useQueryState } from "nuqs";
import { FC, ReactNode } from "react";

export type TServicePage = FC;
export type TServicePageProvider = FC<TServicePageProviderProps>;

export type TTab = {
  title: string;
  value: string;
  Page: TServicePage;
  Provider: TServicePageProvider;
  noScrollArea?: boolean;
};

export type TServicePageProviderProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
};

export const EmptyProvider = ({ children }: TServicePageProviderProps) => children;

export const tabs: TTab[] = [
  { title: "Deployments", value: "deployments", Page: Deployments, Provider: EmptyProvider },
  { title: "Variables", value: "variables", Page: Variables, Provider: VariablesProvider },
  { title: "Logs", value: "logs", Page: Logs, Provider: EmptyProvider, noScrollArea: true },
  { title: "Metrics", value: "metrics", Provider: EmptyProvider, Page: Metrics },
  { title: "Settings", value: "settings", Provider: EmptyProvider, Page: Settings },
];

type TProps = {
  service: TServiceShallow;
};

export default function ServicePanelContent({ service }: TProps) {
  const { teamId, projectId, environmentId } = useService();
  const [currentTabId, setCurrentTab] = useQueryState(
    servicePanelTabKey,
    parseAsString.withDefault(tabs[0].value),
  );
  const currentTab = tabs.find((tab) => tab.value === currentTabId);

  if (!service.last_deployment) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center overflow-hidden">
        Initial setup
      </div>
    );
  }

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
  return <ScrollArea className="pb-[var(--safe-area-inset-bottom)]">{children}</ScrollArea>;
}
