"use client";

import {
  deploymentPanelDefaultTabId,
  deploymentPanelDeploymentIdKey,
  DeploymentPanelTabEnum,
  deploymentPanelTabKey,
  TDeploymentPanelTabEnum,
} from "@/components/deployment/panel/constants";
import { parseAsStringEnum, useQueryState, UseQueryStateReturn } from "nuqs";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TDeploymentPanelContext = {
  currentTabId: TDeploymentPanelTabEnum;
  setCurrentTabId: UseQueryStateReturn<TDeploymentPanelTabEnum, TDeploymentPanelTabEnum>["1"];
  currentDeploymentId: string | null;
  setCurrentDeploymentId: UseQueryStateReturn<string | null, string | null>["1"];
  resetCurrentTabId: () => void;
  closePanel: () => void;
  openPanel: (serviceId: string, tabId?: TDeploymentPanelTabEnum) => void;
};

const DeploymentPanelContext = createContext<TDeploymentPanelContext | null>(null);

export const DeploymentPanelProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [currentTabId, setCurrentTabId] = useQueryState(
    deploymentPanelTabKey,
    parseAsStringEnum(DeploymentPanelTabEnum.options).withDefault(deploymentPanelDefaultTabId),
  );

  const [currentDeploymentId, setCurrentDeploymentId] = useQueryState(
    deploymentPanelDeploymentIdKey,
  );

  const value: TDeploymentPanelContext = useMemo(
    () => ({
      currentTabId,
      setCurrentTabId,
      currentDeploymentId,
      setCurrentDeploymentId,
      openPanel: (serviceId: string, tabId?: TDeploymentPanelTabEnum) => {
        setCurrentDeploymentId(serviceId);
        setCurrentTabId(tabId ?? deploymentPanelDefaultTabId);
      },
      closePanel: () => {
        setCurrentDeploymentId(null);
        setCurrentTabId(deploymentPanelDefaultTabId);
      },
      resetCurrentTabId: () => setCurrentTabId(deploymentPanelDefaultTabId),
    }),
    [currentTabId, setCurrentTabId, currentDeploymentId, setCurrentDeploymentId],
  );

  return (
    <DeploymentPanelContext.Provider value={value}>{children}</DeploymentPanelContext.Provider>
  );
};

export const useDeploymentPanel = () => {
  const context = useContext(DeploymentPanelContext);
  if (!context) {
    throw new Error("useDeploymentPanel must be used within an DeploymentPanelProvider");
  }
  return context;
};

export default DeploymentPanelProvider;
