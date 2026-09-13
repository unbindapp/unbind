"use client";

import { deploymentPanelDeploymentIdKey } from "@/components/deployment/panel/constants";
import { usePanelSearchState } from "@/components/panel/use-panel-search-state";
import {
  servicePanelDefaultTabId,
  servicePanelOwnedSearchKeys,
  servicePanelServiceIdKey,
  servicePanelTabKey,
  TServicePanelTabEnum,
} from "@/components/service/panel/constants";
import { getRouteApi } from "@tanstack/react-router";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

const nestedIdKeys = [deploymentPanelDeploymentIdKey];

type TServicePanelContext = {
  currentTabId: TServicePanelTabEnum;
  currentServiceId: string | null;
  getOpenSearch: (serviceId: string) => Record<string, unknown>;
  closePanel: () => void;
  openPanel: (serviceId: string, tabId?: TServicePanelTabEnum) => void;
  // The terminal tab can maximize to fill the viewport; while it does, Esc should exit
  // fullscreen instead of closing the drawer, so the drawer needs to know.
  isTerminalFullscreen: boolean;
  setIsTerminalFullscreen: (value: boolean) => void;
};

const ServicePanelContext = createContext<TServicePanelContext | null>(null);

export const ServicePanelProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const currentTabId = routeApi.useSearch({
    select: (s) => s[servicePanelTabKey] ?? servicePanelDefaultTabId,
  });

  const {
    currentId: currentServiceId,
    getOpenSearch,
    openPanel,
    closePanel,
  } = usePanelSearchState({
    idKey: servicePanelServiceIdKey,
    ownedKeys: servicePanelOwnedSearchKeys,
    nestedIdKeys,
  });

  const [isTerminalFullscreen, setIsTerminalFullscreen] = useState(false);

  const value: TServicePanelContext = useMemo(
    () => ({
      currentTabId,
      currentServiceId,
      getOpenSearch,
      closePanel,
      openPanel: (serviceId: string, tabId?: TServicePanelTabEnum) =>
        openPanel(serviceId, tabId ? { [servicePanelTabKey]: tabId } : undefined),
      isTerminalFullscreen,
      setIsTerminalFullscreen,
    }),
    [currentTabId, currentServiceId, getOpenSearch, openPanel, closePanel, isTerminalFullscreen],
  );

  return <ServicePanelContext.Provider value={value}>{children}</ServicePanelContext.Provider>;
};

export const useServicePanel = () => {
  const context = useContext(ServicePanelContext);
  if (!context) {
    throw new Error("useServicePanel must be used within an ServicePanelProvider");
  }
  return context;
};

export default ServicePanelProvider;
