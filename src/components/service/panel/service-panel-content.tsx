"use client";

import MetricsProvider from "@/components/metrics/metrics-provider";
import MetricsStateProvider from "@/components/metrics/metrics-state-provider";
import DeploymentsProvider from "@/components/service/deployments-provider";
import { TServicePanelTabEnum } from "@/components/service/panel/constants";
import ServicePanelContentDeployed from "@/components/service/panel/service-panel-content-deployed";
import ServicePanelContentDraft from "@/components/service/panel/service-panel-content-draft";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useService } from "@/components/service/service-provider";
import Logs from "@/components/service/panel/tabs/logs/logs";
import Metrics from "@/components/service/panel/tabs/metrics/metrics";
import Settings from "@/components/service/panel/tabs/settings/settings";
import Variables from "@/components/service/panel/tabs/variables/variables";
import VariablesProvider from "@/components/service/panel/tabs/variables/variables-provider";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { FC, ReactNode } from "react";
import Deployments from "@/components/service/panel/tabs/deployments/deployments";

type TServicePage = FC<{ service: TServiceShallow }>;
type TServicePageProvider = FC<TServicePageProviderProps>;

export type TServicePanelTab = {
  title: string;
  value: TServicePanelTabEnum;
  Page: TServicePage;
  Provider: TServicePageProvider;
  noScrollArea?: boolean;
};

type TServicePageProviderProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
};

const EmptyProvider = ({ children }: TServicePageProviderProps) => children;

const tabs: TServicePanelTab[] = [
  { title: "Deployments", value: "deployments", Page: Deployments, Provider: DeploymentsProvider },
  { title: "Logs", value: "logs", Page: Logs, Provider: EmptyProvider, noScrollArea: true },
  {
    title: "Metrics",
    value: "metrics",
    Page: Metrics,
    Provider: (props: TServicePageProviderProps) => (
      <MetricsStateProvider>
        <MetricsProvider type="service" {...props} />
      </MetricsStateProvider>
    ),
  },
  {
    title: "Variables",
    value: "variables",
    Page: Variables,
    Provider: (props: TServicePageProviderProps) => <VariablesProvider type="service" {...props} />,
  },
  { title: "Settings", value: "settings", Page: Settings, Provider: EmptyProvider },
];

type TProps = {
  service: TServiceShallow;
  className?: string;
};

export default function ServicePanelContent({ service, className }: TProps) {
  const { teamId, projectId, environmentId } = useService();
  const { currentTabId } = useServicePanel();
  const currentTab = tabs.find((tab) => tab.value === currentTabId);

  if (!service.last_deployment) {
    return (
      <DeploymentsProvider>
        <VariablesProvider
          teamId={teamId}
          projectId={projectId}
          environmentId={environmentId}
          serviceId={service.id}
          type="service"
        >
          <ServicePanelContentDraft className={className} service={service} />
        </VariablesProvider>
      </DeploymentsProvider>
    );
  }

  return <ServicePanelContentDeployed tabs={tabs} service={service} currentTab={currentTab} />;
}
