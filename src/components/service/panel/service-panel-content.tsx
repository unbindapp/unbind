"use client";

import { servicePanelTabKey } from "@/components/service/constants";
import DeploymentsProvider from "@/components/service/deployments/deployments-provider";
import { DeployedServiceContent } from "@/components/service/panel/service-panel-content-deployed";
import UndeployedServiceContent from "@/components/service/panel/service-panel-content-undeployed";
import { useService } from "@/components/service/service-provider";
import Deployments from "@/components/service/tabs/deployments/deployments";
import Logs from "@/components/service/tabs/logs/logs";
import Metrics from "@/components/service/tabs/metrics/metrics";
import Settings from "@/components/service/tabs/settings/settings";
import Variables from "@/components/service/tabs/variables/variables";
import VariablesProvider from "@/components/service/tabs/variables/variables-provider";
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
  { title: "Deployments", value: "deployments", Page: Deployments, Provider: DeploymentsProvider },
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
      <DeploymentsProvider>
        <VariablesProvider
          teamId={teamId}
          projectId={projectId}
          environmentId={environmentId}
          serviceId={service.id}
        >
          <UndeployedServiceContent service={service} />
        </VariablesProvider>
      </DeploymentsProvider>
    );
  }

  return (
    <DeployedServiceContent
      currentTab={currentTab}
      currentTabId={currentTabId}
      tabs={tabs}
      setCurrentTab={setCurrentTab}
      service={service}
    />
  );
}
