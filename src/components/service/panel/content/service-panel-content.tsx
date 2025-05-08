"use client";

import DeploymentsProvider from "@/components/deployment/deployments-provider";
import InstanceHealthProvider, {
  useInstanceHealth,
} from "@/components/instances/instance-health-provider";
import MetricsProvider from "@/components/metrics/metrics-provider";
import MetricsStateProvider from "@/components/metrics/metrics-state-provider";
import { TServicePanelTabEnum } from "@/components/service/panel/constants";
import ServicePanelContentDeployed from "@/components/service/panel/content/service-panel-content-deployed";
import ServicePanelContentUndeployed from "@/components/service/panel/content/undeployed/service-panel-content-undeployed";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import Deployments from "@/components/service/panel/tabs/deployments/deployments";
import Logs from "@/components/service/panel/tabs/logs/logs";
import Metrics from "@/components/service/panel/tabs/metrics/metrics";
import Settings from "@/components/service/panel/tabs/settings/settings";
import Variables from "@/components/service/panel/tabs/variables/variables";
import { useService } from "@/components/service/service-provider";
import SystemProvider from "@/components/system/system-provider";
import VariableReferencesProvider, {
  useVariableReferenceUtils,
} from "@/components/variables/variable-references-provider";
import { arrayHasAllSpecialDbVariables } from "@/components/variables/variables-list";
import VariablesProvider, {
  useVariables,
  useVariablesUtils,
} from "@/components/variables/variables-provider";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { FC, ReactNode, useEffect } from "react";

type TServicePage = FC<{ service: TServiceShallow }>;
type TServicePageProvider = FC<TServicePageProviderProps>;

export type TServicePanelTab = {
  title: string;
  value: TServicePanelTabEnum;
  Page: TServicePage;
  Provider: TServicePageProvider;
  noScrollArea?: boolean;
};

type TServiceProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  service: TServiceShallow;
};

type TServicePageProviderProps = {
  children: ReactNode;
} & TServiceProps;

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
    Provider: ({ children, ...rest }: TServicePageProviderProps) => (
      <VariablesProvider type="service" {...rest}>
        <VariableReferencesProvider type="service" {...rest}>
          <VariablesTabWrapper {...rest}>{children}</VariablesTabWrapper>
        </VariableReferencesProvider>
      </VariablesProvider>
    ),
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
      <SystemProvider>
        <DeploymentsProvider>
          <VariablesProvider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            serviceId={service.id}
            service={service}
            type="service"
          >
            <ServicePanelContentUndeployed
              data-vaul-no-drag
              className={className}
              service={service}
            />
          </VariablesProvider>
        </DeploymentsProvider>
      </SystemProvider>
    );
  }

  return (
    <InstanceHealthProvider
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
      serviceId={service.id}
    >
      <ServicePanelContentDeployed
        data-vaul-no-drag
        tabs={tabs}
        service={service}
        currentTab={currentTab}
      />
    </InstanceHealthProvider>
  );
}

function VariablesTabWrapper({ children, ...props }: { children: ReactNode } & TServiceProps) {
  const { data: instancesHealthData } = useInstanceHealth();
  const { invalidate: invalidateVariableReferences } = useVariableReferenceUtils({
    type: "service",
    ...props,
  });
  const { invalidate: invalidateVariables } = useVariablesUtils({ type: "service", ...props });
  const {
    list: { data: variablesData },
  } = useVariables();

  useEffect(() => {
    if (!instancesHealthData) return;
    if (props.service.type !== "database") return;

    const variableNames = variablesData?.variables.map((v) => v.name) || [];
    const hasAllNeededVariables = arrayHasAllSpecialDbVariables(
      variableNames,
      props.service.database_type || "",
    );

    if (hasAllNeededVariables) return;

    invalidateVariableReferences();
    invalidateVariables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instancesHealthData]);

  return children;
}
